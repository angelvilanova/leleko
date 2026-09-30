/*
  # Loja: endereço de entrega e forma de pagamento no checkout

  Rode este arquivo inteiro no SQL Editor do Supabase ANTES de publicar o
  código novo. Ele é idempotente: pode ser executado mais de uma vez.
  Pressupõe as duas migrações anteriores (customer_orders_and_approval e
  store_login_and_history) já aplicadas.

  NENHUMA TABELA EXISTENTE DO PAINEL É ALTERADA. Só objetos novos, mais
  colunas na tabela customer_order_requests, que foi criada por estas
  migrações.

  1. Tabela store_settings (uma linha): chave Pix, nome do recebedor,
     instruções e WhatsApp da loja. PREENCHA O BLOCO "CONFIGURE AQUI".
  2. customer_order_requests: address_changed (cliente informou outro endereço)
  3. store_create_order_request passa a receber forma de pagamento e
     endereço de entrega. Ao aprovar, a observação do pedido criado em
     orders recebe no início "Pagamento: Pix" e/ou "Entregar em: ...",
     para o operador e o cupom mostrarem sem mudança nas telas deles.
*/

-- ---------------------------------------------------------------------------
-- 1. Configurações da loja
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.store_settings (
  id               smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pix_key          text NOT NULL DEFAULT '',
  pix_receiver     text NOT NULL DEFAULT '',
  pix_instructions text NOT NULL DEFAULT '',
  whatsapp         text NOT NULL DEFAULT '',
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam configuracoes da loja" ON public.store_settings;
CREATE POLICY "Admins gerenciam configuracoes da loja"
  ON public.store_settings FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

INSERT INTO public.store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- CONFIGURE AQUI: troque só os quatro valores entre aspas abaixo.
-- Se deixar os textos de exemplo, nada é gravado e a loja avisa que a chave
-- Pix será enviada pelo WhatsApp. Dá para preencher depois em
-- Table Editor > store_settings, sem rodar SQL de novo.
-- ===========================================================================
DO $$
DECLARE
  v_pix_key          text := 'COLOQUE_AQUI_A_CHAVE_PIX';
  v_pix_receiver     text := 'COLOQUE_AQUI_O_NOME_DO_RECEBEDOR';
  v_pix_instructions text := 'Após pagar, envie o comprovante pelo WhatsApp da loja.';
  v_whatsapp         text := 'COLOQUE_AQUI_O_WHATSAPP_DA_LOJA_COM_DDD';
BEGIN
  IF v_pix_key LIKE 'COLOQUE_AQUI%' THEN
    RAISE NOTICE 'Chave Pix não configurada. Preencha depois em Table Editor > store_settings.';
  ELSE
    UPDATE public.store_settings
    SET pix_key          = v_pix_key,
        pix_receiver     = CASE WHEN v_pix_receiver LIKE 'COLOQUE_AQUI%' THEN '' ELSE v_pix_receiver END,
        pix_instructions = v_pix_instructions,
        whatsapp         = CASE WHEN v_whatsapp LIKE 'COLOQUE_AQUI%' THEN '' ELSE regexp_replace(v_whatsapp, '\D', '', 'g') END,
        updated_at       = now()
    WHERE id = 1;
    RAISE NOTICE 'Configurações da loja gravadas.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Pedidos aguardando: o cliente informou outro endereço?
-- ---------------------------------------------------------------------------

ALTER TABLE public.customer_order_requests
  ADD COLUMN IF NOT EXISTS address_changed boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 3. Funções
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.store_public_settings()
RETURNS TABLE (pix_key text, pix_receiver text, pix_instructions text, whatsapp text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT s.pix_key, s.pix_receiver, s.pix_instructions, s.whatsapp
  FROM store_settings s
  WHERE s.id = 1;
$$;

-- Assinaturas antigas saem para não virar sobrecarga.
DROP FUNCTION IF EXISTS public.store_create_order_request(uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.store_create_order_request_internal(uuid, jsonb, text);

CREATE OR REPLACE FUNCTION public.store_create_order_request_internal(
  p_customer_id uuid,
  p_items jsonb,
  p_notes text,
  p_payment_method text,
  p_delivery_address text
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
  v_payment  text;
  v_address  text;
  v_changed  boolean;
BEGIN
  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'O pedido precisa ter pelo menos um item.';
  END IF;

  v_payment := coalesce(nullif(trim(p_payment_method), ''), 'on_delivery');
  IF v_payment NOT IN ('on_delivery', 'pix') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida.';
  END IF;

  v_address := nullif(trim(coalesce(p_delivery_address, '')), '');
  v_changed := v_address IS NOT NULL AND v_address <> coalesce(trim(v_customer.address), '');
  IF v_address IS NULL THEN
    v_address := v_customer.address;
  END IF;
  IF coalesce(trim(v_address), '') = '' THEN
    RAISE EXCEPTION 'Informe o endereço de entrega.';
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
    address_changed, items, total, notes, payment_method, payment_status
  )
  VALUES (
    v_number, v_customer.id, v_customer.name, v_customer.phone, left(v_address, 500),
    v_changed, v_items, v_total, coalesce(left(p_notes, 500), ''), v_payment, 'unpaid'
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.store_create_order_request(
  p_session uuid,
  p_items jsonb,
  p_notes text DEFAULT '',
  p_payment_method text DEFAULT 'on_delivery',
  p_delivery_address text DEFAULT NULL
)
RETURNS TABLE (request_id uuid, request_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_customer uuid;
BEGIN
  v_customer := store_session_customer(p_session);
  RETURN QUERY
    SELECT * FROM store_create_order_request_internal(v_customer, p_items, p_notes, p_payment_method, p_delivery_address);
END;
$$;

-- Aprovação: o pedido criado em orders recebe, no início da observação,
-- a forma de pagamento (se Pix) e o endereço informado (se diferente do
-- cadastrado). Assim operador e cupom mostram sem mudança nas telas deles.
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
  v_prefix   text := '';
  v_notes    text;
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

  IF v_req.payment_method = 'pix' THEN
    v_prefix := 'Pagamento: Pix';
  END IF;

  IF coalesce(v_req.address_changed, false) AND coalesce(trim(v_req.customer_address), '') <> '' THEN
    v_prefix := concat_ws(E'\n', nullif(v_prefix, ''), 'Entregar em: ' || v_req.customer_address);
  END IF;

  v_notes := concat_ws(E'\n', nullif(v_prefix, ''), nullif(trim(coalesce(v_req.notes, '')), ''));

  INSERT INTO orders (order_number, status, created_by, customer_id, cash_date, notes)
  VALUES (
    v_req.request_number,
    'pending',
    p_approver,
    v_req.customer_id,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date,
    coalesce(v_notes, '')
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

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.store_create_order_request_internal(uuid, jsonb, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_customer_order_request_internal(uuid, uuid, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.store_public_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_create_order_request(uuid, jsonb, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.store_public_settings() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_create_order_request(uuid, jsonb, text, text, text) TO anon, authenticated;
