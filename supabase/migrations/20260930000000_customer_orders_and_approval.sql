/*
  # Pedidos pelo link do cliente + fluxo de aprovação

  Rode este arquivo inteiro no SQL Editor do Supabase ANTES de publicar o
  código novo. Ele é idempotente: pode ser executado mais de uma vez.

  NENHUMA TABELA, COLUNA, RESTRIÇÃO OU POLÍTICA EXISTENTE É ALTERADA.
  Tudo o que este arquivo faz é CRIAR objetos novos:

  1. Tabela customer_links
     - código secreto (token) que forma o link próprio de cada cliente

  2. Tabela customer_order_requests
     - pedidos feitos pelos clientes no link, aguardando aprovação
     - guardam os itens com preço e custo do momento, o total e a observação
     - estoque é reservado ao criar e devolvido ao reprovar
     - ao aprovar, vira um pedido normal na tabela orders (status pending),
       com o mesmo número que o cliente viu
     - campos de pagamento já preparados para a etapa do Pix

  3. Funções (SECURITY DEFINER; as tabelas continuam fechadas para anon)
     - ensure_customer_link(uuid)                  equipe: gera/obtém o link
     - get_customer_by_token(uuid)                 cliente: dados pelo link
     - get_public_products()                       cliente: catálogo
     - create_customer_order_request(uuid,jsonb,text)  cliente: envia pedido
     - approve_customer_order_request(uuid)        equipe: aprova
     - reject_customer_order_request(uuid)         equipe: reprova
     - auto_approve_customer_order_requests()      aprova o que passou de 5 min

  4. Job pg_cron a cada minuto. Se pg_cron não estiver habilitado, o painel
     chama a função ao carregar, como rede de segurança.
*/

-- ---------------------------------------------------------------------------
-- 1. Link próprio do cliente
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_links (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  token       uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe pode ver links dos clientes" ON public.customer_links;
CREATE POLICY "Equipe pode ver links dos clientes"
  ON public.customer_links FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- 2. Pedidos aguardando aprovação
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_order_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number   text NOT NULL UNIQUE,

  customer_id      uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name    text NOT NULL,
  customer_phone   text,
  customer_address text,

  -- [{ product_id, name, description, quantity, unit_price, unit_cost }]
  items            jsonb NOT NULL,
  total            numeric NOT NULL DEFAULT 0,
  notes            text NOT NULL DEFAULT '',

  payment_method   text NOT NULL DEFAULT 'on_delivery'
                   CHECK (payment_method IN ('on_delivery', 'pix')),
  payment_status   text NOT NULL DEFAULT 'unpaid'
                   CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'expired')),
  pix_txid         text,
  paid_at          timestamptz,

  status           text NOT NULL DEFAULT 'awaiting'
                   CHECK (status IN ('awaiting', 'approved', 'rejected', 'expired')),
  decision_mode    text CHECK (decision_mode IS NULL OR decision_mode IN ('manual', 'auto')),
  decided_at       timestamptz,
  decided_by       uuid REFERENCES public.profiles(id),
  order_id         uuid REFERENCES public.orders(id) ON DELETE SET NULL,

  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_order_requests_status_created
  ON public.customer_order_requests (status, created_at);

CREATE INDEX IF NOT EXISTS idx_customer_order_requests_order_id
  ON public.customer_order_requests (order_id);

ALTER TABLE public.customer_order_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe pode ver pedidos do link" ON public.customer_order_requests;
CREATE POLICY "Equipe pode ver pedidos do link"
  ON public.customer_order_requests FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- 3. Funções
-- ---------------------------------------------------------------------------

-- Número único no mesmo formato do painel: PED-AAAAMMDD-NNNN.
-- Checa as duas tabelas para o número poder ser reaproveitado na aprovação.
CREATE OR REPLACE FUNCTION public.next_customer_request_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v text;
BEGIN
  LOOP
    v := 'PED-'
      || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD')
      || '-'
      || lpad(floor(random() * 10000)::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM orders o WHERE o.order_number = v)
         AND NOT EXISTS (SELECT 1 FROM customer_order_requests r WHERE r.request_number = v);
  END LOOP;
  RETURN v;
END;
$$;

-- Equipe (admin): gera o link do cliente se ainda não existir e devolve o token.
CREATE OR REPLACE FUNCTION public.ensure_customer_link(p_customer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id) THEN
    RAISE EXCEPTION 'Cliente não encontrado.';
  END IF;

  INSERT INTO customer_links (customer_id)
  VALUES (p_customer_id)
  ON CONFLICT (customer_id) DO NOTHING;

  SELECT token INTO v FROM customer_links WHERE customer_id = p_customer_id;
  RETURN v;
END;
$$;

-- Cliente: identifica-se pelo token do link.
CREATE OR REPLACE FUNCTION public.get_customer_by_token(p_token uuid)
RETURNS TABLE (id uuid, name text, address text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT c.id, c.name::text, c.address::text
  FROM customer_links l
  JOIN customers c ON c.id = l.customer_id
  WHERE l.token = p_token;
$$;

-- Cliente: catálogo de produtos ativos com estoque. Não expõe custo.
CREATE OR REPLACE FUNCTION public.get_public_products()
RETURNS TABLE (id uuid, name text, description text, price numeric, stock_quantity integer)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.id, p.name::text, p.description::text, p.price::numeric, p.stock_quantity::integer
  FROM products p
  WHERE p.active = true
    AND p.stock_quantity > 0
  ORDER BY p.name;
$$;

-- Cliente: envia o pedido. Reserva o estoque e grava em customer_order_requests.
CREATE OR REPLACE FUNCTION public.create_customer_order_request(
  p_token uuid,
  p_items jsonb,
  p_notes text DEFAULT ''
)
RETURNS TABLE (request_id uuid, request_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer customers%ROWTYPE;
  v_product  products%ROWTYPE;
  v_item     jsonb;
  v_qty      integer;
  v_items    jsonb := '[]'::jsonb;
  v_total    numeric := 0;
  v_awaiting integer;
  v_id       uuid;
  v_number   text;
BEGIN
  SELECT c.* INTO v_customer
  FROM customer_links l
  JOIN customers c ON c.id = l.customer_id
  WHERE l.token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link inválido.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'O pedido precisa ter pelo menos um item.';
  END IF;

  SELECT count(*) INTO v_awaiting
  FROM customer_order_requests
  WHERE customer_id = v_customer.id AND status = 'awaiting';

  IF v_awaiting >= 5 THEN
    RAISE EXCEPTION 'Você já tem pedidos aguardando aprovação. Aguarde a análise antes de enviar outro.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida.';
    END IF;

    SELECT * INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::uuid AND active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Um dos produtos não está mais disponível.';
    END IF;

    IF v_product.stock_quantity < v_qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para %. Disponível: %.', v_product.name, v_product.stock_quantity;
    END IF;

    -- Reserva o estoque já no envio, igual ao fluxo do painel.
    UPDATE products SET stock_quantity = stock_quantity - v_qty WHERE id = v_product.id;

    v_items := v_items || jsonb_build_object(
      'product_id',  v_product.id,
      'name',        v_product.name,
      'description', v_product.description,
      'quantity',    v_qty,
      'unit_price',  coalesce(v_product.price, 0),
      'unit_cost',   coalesce(v_product.cost_price, 0)
    );
    v_total := v_total + v_qty * coalesce(v_product.price, 0);
  END LOOP;

  v_number := next_customer_request_number();

  INSERT INTO customer_order_requests (
    request_number, customer_id, customer_name, customer_phone, customer_address,
    items, total, notes
  )
  VALUES (
    v_number, v_customer.id, v_customer.name, v_customer.phone, v_customer.address,
    v_items, v_total, coalesce(left(p_notes, 500), '')
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_number;
END;
$$;

-- Interno: transforma um pedido aguardando em pedido normal (orders + order_items).
-- Não é exposto à API; só as funções abaixo chamam.
CREATE OR REPLACE FUNCTION public.approve_customer_order_request_internal(
  p_request_id uuid,
  p_approver uuid,
  p_mode text
)
RETURNS TABLE (order_id uuid, order_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req      customer_order_requests%ROWTYPE;
  v_order_id uuid;
  v_item     jsonb;
BEGIN
  SELECT * INTO v_req FROM customer_order_requests WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF v_req.status <> 'awaiting' THEN
    RAISE EXCEPTION 'Este pedido já foi decidido.';
  END IF;

  IF p_approver IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário disponível para registrar a aprovação.';
  END IF;

  INSERT INTO orders (order_number, status, created_by, customer_id, cash_date, notes)
  VALUES (
    v_req.request_number,
    'pending',
    p_approver,
    v_req.customer_id,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date,
    v_req.notes
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_req.items) LOOP
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost)
    VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::int,
      coalesce((v_item->>'unit_price')::numeric, 0),
      coalesce((v_item->>'unit_cost')::numeric, 0)
    );
  END LOOP;

  UPDATE customer_order_requests
  SET status        = 'approved',
      decision_mode = p_mode,
      decided_at    = now(),
      decided_by    = p_approver,
      order_id      = v_order_id
  WHERE id = p_request_id;

  RETURN QUERY SELECT v_order_id, v_req.request_number;
END;
$$;

-- Equipe: aprova manualmente. O pedido entra na fila do operador com caixa de hoje.
CREATE OR REPLACE FUNCTION public.approve_customer_order_request(p_request_id uuid)
RETURNS TABLE (order_id uuid, order_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operator')) THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;

  RETURN QUERY
    SELECT * FROM approve_customer_order_request_internal(p_request_id, auth.uid(), 'manual');
END;
$$;

-- Equipe: reprova. Devolve o estoque reservado. Nada entra na tabela orders.
CREATE OR REPLACE FUNCTION public.reject_customer_order_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req  customer_order_requests%ROWTYPE;
  v_item jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operator')) THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;

  SELECT * INTO v_req FROM customer_order_requests WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF v_req.status <> 'awaiting' THEN
    RAISE EXCEPTION 'Este pedido já foi decidido.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_req.items) LOOP
    UPDATE products
    SET stock_quantity = stock_quantity + (v_item->>'quantity')::int
    WHERE id = (v_item->>'product_id')::uuid;
  END LOOP;

  UPDATE customer_order_requests
  SET status        = 'rejected',
      decision_mode = 'manual',
      decided_at    = now(),
      decided_by    = auth.uid()
  WHERE id = p_request_id;
END;
$$;

-- Aprova automaticamente o que passou de 5 minutos sem decisão.
-- Registra a aprovação em nome do primeiro administrador cadastrado.
CREATE OR REPLACE FUNCTION public.auto_approve_customer_order_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req      record;
  v_approver uuid;
  n          integer := 0;
BEGIN
  SELECT id INTO v_approver FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF v_approver IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_req IN
    SELECT id
    FROM customer_order_requests
    WHERE status = 'awaiting'
      AND created_at < now() - interval '5 minutes'
    ORDER BY created_at
  LOOP
    BEGIN
      PERFORM approve_customer_order_request_internal(v_req.id, v_approver, 'auto');
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falha ao aprovar automaticamente %: %', v_req.id, SQLERRM;
    END;
  END LOOP;

  RETURN n;
END;
$$;

-- ---------------------------------------------------------------------------
-- Permissões: só as funções ficam acessíveis; as tabelas continuam fechadas.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.next_customer_request_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_customer_order_request_internal(uuid, uuid, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.ensure_customer_link(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_customer_by_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_products() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_customer_order_request(uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_customer_order_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_customer_order_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_approve_customer_order_requests() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_customer_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_products() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_order_request(uuid, jsonb, text) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ensure_customer_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_customer_order_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_customer_order_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_approve_customer_order_requests() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Job a cada minuto. Se pg_cron não estiver habilitado no projeto, este
-- bloco só registra um aviso; habilite em Database > Extensions > pg_cron e
-- rode novamente apenas este bloco.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'auto-approve-customer-orders';
  PERFORM cron.schedule(
    'auto-approve-customer-orders',
    '* * * * *',
    $job$ SELECT public.auto_approve_customer_order_requests(); $job$
  );

  RAISE NOTICE 'Job auto-approve-customer-orders agendado a cada minuto.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponível (%). A aprovação automática rodará quando o painel for aberto.', SQLERRM;
END $$;
