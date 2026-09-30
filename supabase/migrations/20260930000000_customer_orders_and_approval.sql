/*
  # Pedidos pelo link do cliente + fluxo de aprovação

  Rode este arquivo inteiro no SQL Editor do Supabase ANTES de publicar o
  código novo. Ele é idempotente: pode ser executado mais de uma vez.

  1. Pedidos
     - Novo status 'awaiting_approval' (aguardando aprovação)
     - created_by passa a ser opcional (pedido do cliente não tem usuário interno)
     - origin: 'admin' | 'customer_link'
     - approved_at, approval_mode ('manual' | 'auto')
     - Campos de pagamento preparados para a etapa do Pix:
       payment_method ('on_delivery' | 'pix'), payment_status
       ('unpaid' | 'pending' | 'paid' | 'expired'), pix_txid, paid_at

  2. Clientes
     - link_token: código secreto que forma o link próprio do cliente

  3. Funções públicas (SECURITY DEFINER, chamadas pela página do cliente
     com a chave anon; as tabelas continuam fechadas para anon)
     - get_customer_by_token(uuid)
     - get_public_products()
     - create_customer_order(uuid, jsonb, text)

  4. Aprovação automática
     - approve_expired_orders(): aprova o que passou de 5 minutos
     - Job pg_cron a cada minuto. Se pg_cron não estiver habilitado, o painel
       chama a função ao carregar, como rede de segurança.
*/

-- ---------------------------------------------------------------------------
-- 1. Pedidos
-- ---------------------------------------------------------------------------

-- Remove a restrição de status atual, qualquer que seja o nome dela.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%payment_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('awaiting_approval', 'pending', 'dispatched', 'cancelled'));

ALTER TABLE public.orders ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'admin';
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_origin_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_origin_check CHECK (origin IN ('admin', 'customer_link'));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS approval_mode text;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_approval_mode_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_approval_mode_check
  CHECK (approval_mode IS NULL OR approval_mode IN ('manual', 'auto'));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'on_delivery';
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('on_delivery', 'pix'));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'expired'));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pix_txid text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_awaiting_created
  ON public.orders (created_at)
  WHERE status = 'awaiting_approval';

-- ---------------------------------------------------------------------------
-- 2. Clientes: código secreto do link
-- ---------------------------------------------------------------------------

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS link_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_link_token ON public.customers (link_token);

-- ---------------------------------------------------------------------------
-- 3. Funções públicas usadas pela página do cliente
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_customer_by_token(p_token uuid)
RETURNS TABLE (id uuid, name text, address text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT c.id, c.name::text, c.address::text
  FROM customers c
  WHERE c.link_token = p_token;
$$;

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

CREATE OR REPLACE FUNCTION public.create_customer_order(
  p_token uuid,
  p_items jsonb,
  p_notes text DEFAULT ''
)
RETURNS TABLE (order_id uuid, order_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer  customers%ROWTYPE;
  v_product   products%ROWTYPE;
  v_item      jsonb;
  v_qty       integer;
  v_order_id  uuid;
  v_number    text;
  v_awaiting  integer;
BEGIN
  SELECT * INTO v_customer FROM customers WHERE link_token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link inválido.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'O pedido precisa ter pelo menos um item.';
  END IF;

  SELECT count(*) INTO v_awaiting
  FROM orders
  WHERE customer_id = v_customer.id AND status = 'awaiting_approval';

  IF v_awaiting >= 5 THEN
    RAISE EXCEPTION 'Você já tem pedidos aguardando aprovação. Aguarde a análise antes de enviar outro.';
  END IF;

  -- Número único no mesmo formato usado pelo painel: PED-AAAAMMDD-NNNN
  LOOP
    v_number := 'PED-'
      || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD')
      || '-'
      || lpad(floor(random() * 10000)::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE orders.order_number = v_number);
  END LOOP;

  INSERT INTO orders (
    order_number, status, created_by, customer_id, origin, notes,
    payment_method, payment_status, cash_date
  )
  VALUES (
    v_number, 'awaiting_approval', NULL, v_customer.id, 'customer_link',
    coalesce(left(p_notes, 500), ''),
    'on_delivery', 'unpaid',
    (now() AT TIME ZONE 'America/Sao_Paulo')::date
  )
  RETURNING id INTO v_order_id;

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

    -- Reserva o estoque já na criação, igual ao fluxo do painel.
    UPDATE products SET stock_quantity = stock_quantity - v_qty WHERE id = v_product.id;

    INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost)
    VALUES (v_order_id, v_product.id, v_qty, coalesce(v_product.price, 0), coalesce(v_product.cost_price, 0));
  END LOOP;

  RETURN QUERY SELECT v_order_id, v_number;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Aprovação automática após 5 minutos
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_expired_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  UPDATE orders
  SET status        = 'pending',
      approved_at   = now(),
      approval_mode = 'auto',
      cash_date     = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  WHERE status = 'awaiting_approval'
    AND created_at < now() - interval '5 minutes';

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- ---------------------------------------------------------------------------
-- Permissões: só as funções ficam acessíveis; as tabelas continuam fechadas.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.get_customer_by_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_products() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_customer_order(uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_expired_orders() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_customer_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_products() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_order(uuid, jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_expired_orders() TO authenticated;

-- ---------------------------------------------------------------------------
-- Job a cada minuto. Se pg_cron não estiver habilitado no projeto, este bloco
-- só registra um aviso; habilite em Database > Extensions > pg_cron e rode
-- novamente apenas este bloco.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'auto-approve-orders';
  PERFORM cron.schedule(
    'auto-approve-orders',
    '* * * * *',
    $job$ SELECT public.approve_expired_orders(); $job$
  );

  RAISE NOTICE 'Job auto-approve-orders agendado a cada minuto.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponível (%). A aprovação automática rodará quando o painel for aberto.', SQLERRM;
END $$;
