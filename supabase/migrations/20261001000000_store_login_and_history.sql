/*
  # Loja do cliente: entrada pelo celular, sessão e histórico

  Rode este arquivo inteiro no SQL Editor do Supabase ANTES de publicar o
  código novo. Ele é idempotente: pode ser executado mais de uma vez.
  Pressupõe que a migração anterior (customer_orders_and_approval) já rodou.

  NENHUMA TABELA, COLUNA, RESTRIÇÃO OU POLÍTICA EXISTENTE É ALTERADA.
  Só objetos novos:

  1. Tabela customer_sessions
     - sessão do cliente na loja (token no navegador), 90 dias renováveis

  2. Funções (SECURITY DEFINER; tabelas continuam fechadas para anon)
     - store_login(celular)            BETA: entra só com o celular cadastrado.
                                       Para exigir um código depois, basta
                                       acrescentar a checagem nesta função.
     - store_me(sessão)                dados do cliente logado
     - store_logout(sessão)            encerra a sessão
     - store_create_order_request(sessão, itens, observação)
                                       envia pedido para "Aguardando aprovação"
     - store_my_orders(sessão)         histórico: pedidos aguardando/reprovados
                                       e todos os pedidos da tabela orders

  A vitrine continua usando get_public_products() da migração anterior.
  As funções de link secreto da migração anterior ficam no banco, sem uso.
*/

-- ---------------------------------------------------------------------------
-- 1. Sessões da loja
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_sessions (
  token        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '90 days',
  revoked_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer ON public.customer_sessions (customer_id);

-- Sem políticas: ninguém lê ou escreve direto; só as funções abaixo.
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. Funções
-- ---------------------------------------------------------------------------

-- Só dígitos; remove o 55 do país quando vier com 12 ou 13 dígitos.
CREATE OR REPLACE FUNCTION public.store_normalize_phone(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
           WHEN length(d) IN (12, 13) AND left(d, 2) = '55' THEN substr(d, 3)
           ELSE d
         END
  FROM (SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g') AS d) t;
$$;

-- Interno: valida a sessão, renova o prazo e devolve o cliente.
CREATE OR REPLACE FUNCTION public.store_session_customer(p_session uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_customer uuid;
BEGIN
  SELECT s.customer_id INTO v_customer
  FROM customer_sessions s
  WHERE s.token = p_session
    AND s.revoked_at IS NULL
    AND s.expires_at > now();

  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada. Entre novamente.';
  END IF;

  UPDATE customer_sessions
  SET last_seen_at = now(),
      expires_at   = now() + interval '90 days'
  WHERE token = p_session;

  RETURN v_customer;
END;
$$;

-- BETA: entra só com o celular cadastrado no painel.
CREATE OR REPLACE FUNCTION public.store_login(p_phone text)
RETURNS TABLE (session_token uuid, customer_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits   text;
  v_customer customers%ROWTYPE;
  v_token    uuid;
BEGIN
  v_digits := store_normalize_phone(p_phone);

  IF length(v_digits) < 10 THEN
    RAISE EXCEPTION 'Informe o celular com DDD.';
  END IF;

  SELECT c.* INTO v_customer
  FROM customers c
  WHERE store_normalize_phone(c.phone) = v_digits
  ORDER BY c.created_at
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Celular não encontrado. Fale com a loja para fazer seu cadastro.';
  END IF;

  INSERT INTO customer_sessions (customer_id)
  VALUES (v_customer.id)
  RETURNING token INTO v_token;

  RETURN QUERY SELECT v_token, v_customer.name::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.store_me(p_session uuid)
RETURNS TABLE (id uuid, name text, phone text, address text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_customer uuid;
BEGIN
  v_customer := store_session_customer(p_session);

  RETURN QUERY
    SELECT c.id, c.name::text, c.phone::text, c.address::text
    FROM customers c
    WHERE c.id = v_customer;
END;
$$;

CREATE OR REPLACE FUNCTION public.store_logout(p_session uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE customer_sessions SET revoked_at = now() WHERE token = p_session AND revoked_at IS NULL;
$$;

-- Interno: cria o pedido aguardando aprovação para um cliente já resolvido.
-- Reserva o estoque e guarda os itens com preço e custo do momento.
CREATE OR REPLACE FUNCTION public.store_create_order_request_internal(
  p_customer_id uuid,
  p_items jsonb,
  p_notes text
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
  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado.';
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

-- Loja: envia o pedido do cliente logado.
CREATE OR REPLACE FUNCTION public.store_create_order_request(
  p_session uuid,
  p_items jsonb,
  p_notes text DEFAULT ''
)
RETURNS TABLE (request_id uuid, request_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_customer uuid;
BEGIN
  v_customer := store_session_customer(p_session);
  RETURN QUERY SELECT * FROM store_create_order_request_internal(v_customer, p_items, p_notes);
END;
$$;

-- Loja: histórico do cliente logado. Junta pedidos aguardando/reprovados
-- (tabela nova) com todos os pedidos da tabela orders, mais recentes primeiro.
-- Cada item: { kind, id, number, status, created_at, dispatched_at, total, notes, items[] }
CREATE OR REPLACE FUNCTION public.store_my_orders(p_session uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer uuid;
  v_result   jsonb;
BEGIN
  v_customer := store_session_customer(p_session);

  SELECT coalesce(jsonb_agg(s.x ORDER BY s.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT u.x, u.created_at
    FROM (
      SELECT
        jsonb_build_object(
          'kind',          'request',
          'id',            r.id,
          'number',        r.request_number,
          'status',        CASE r.status WHEN 'awaiting' THEN 'awaiting_approval' ELSE r.status END,
          'created_at',    r.created_at,
          'dispatched_at', NULL,
          'total',         r.total,
          'notes',         r.notes,
          'items',         r.items
        ) AS x,
        r.created_at
      FROM customer_order_requests r
      WHERE r.customer_id = v_customer
        AND r.status IN ('awaiting', 'rejected')

      UNION ALL

      SELECT
        jsonb_build_object(
          'kind',          'order',
          'id',            o.id,
          'number',        o.order_number,
          'status',        o.status,
          'created_at',    o.created_at,
          'dispatched_at', o.dispatched_at,
          'total',         (SELECT coalesce(sum(oi.quantity * oi.unit_price), 0)
                            FROM order_items oi WHERE oi.order_id = o.id),
          'notes',         o.notes,
          'items',         (SELECT coalesce(jsonb_agg(jsonb_build_object(
                              'product_id', oi.product_id,
                              'name',       coalesce(p.name, 'Produto'),
                              'quantity',   oi.quantity,
                              'unit_price', oi.unit_price
                            )), '[]'::jsonb)
                            FROM order_items oi
                            LEFT JOIN products p ON p.id = oi.product_id
                            WHERE oi.order_id = o.id)
        ) AS x,
        o.created_at
      FROM orders o
      WHERE o.customer_id = v_customer
    ) u
    ORDER BY u.created_at DESC
    LIMIT 100
  ) s;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.store_session_customer(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_create_order_request_internal(uuid, jsonb, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.store_normalize_phone(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_login(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_me(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_logout(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_create_order_request(uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_my_orders(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.store_normalize_phone(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_login(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_me(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_logout(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_create_order_request(uuid, jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_my_orders(uuid) TO anon, authenticated;
