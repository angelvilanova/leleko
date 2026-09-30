import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { StoreCustomer } from './StoreShell';
import { describeError, formatBRL, formatPhoneBR, friendlyError, isSessionExpired } from '../../lib/storeSession';
import { useStoreSettings } from '../../lib/storeSettings';
import { Card, SectionTitle, fieldClass, firstName, initials, primaryButton, secondaryButton, tileClass } from './ui';
import {
  ShoppingCart,
  Plus,
  Minus,
  Search,
  MapPin,
  Package,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  Banknote,
  ClipboardList,
  QrCode,
  Copy,
  Check,
  MessageCircle,
  ChevronRight,
  Trash2,
  Sparkles,
} from 'lucide-react';

type PublicProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
};

export type RepeatItem = {
  product_id: string;
  name: string;
  quantity: number;
};

type PaymentMethod = 'on_delivery' | 'pix';
type AddressMode = 'registered' | 'custom';

type PlacedOrder = {
  number: string;
  items: { name: string; quantity: number; unit_price: number }[];
  total: number;
  address: string;
  payment: PaymentMethod;
};

type Props = {
  session: string;
  customer: StoreCustomer;
  repeatItems: RepeatItem[] | null;
  onRepeatConsumed: () => void;
  onViewOrders: () => void;
  onSessionExpired: () => void;
};

function joinAddress(parts: { street: string; complement: string; neighborhood: string; city: string; reference: string }) {
  const main = [parts.street.trim(), parts.complement.trim()].filter(Boolean).join(', ');
  const area = [parts.neighborhood.trim(), parts.city.trim()].filter(Boolean).join(' - ');
  const ref = parts.reference.trim() ? `Ref.: ${parts.reference.trim()}` : '';
  return [main, area, ref].filter(Boolean).join(' · ');
}

/**
 * Vitrine e checkout. Produtos ativos com estoque, só preço de venda.
 * No checkout o cliente escolhe o endereço de entrega, cadastrado ou outro
 * completo, e a forma de pagamento, Pix ou na entrega. O envio cai em
 * "Aguardando aprovação" no painel.
 */
export function StoreCatalog({ session, customer, repeatItems, onRepeatConsumed, onViewOrders, onSessionExpired }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorDetail, setLoadErrorDetail] = useState<string | null>(null);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const settings = useStoreSettings();

  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const registeredAddress = (customer.address || '').trim();
  const [addressMode, setAddressMode] = useState<AddressMode>(registeredAddress ? 'registered' : 'custom');
  const [street, setStreet] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [reference, setReference] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('on_delivery');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadProducts(true);
  }, []);

  // "Repetir pedido" vindo do histórico: remonta o carrinho com o que ainda existe.
  useEffect(() => {
    if (!repeatItems || loading) return;

    const next: Record<string, number> = {};
    const missing: string[] = [];

    for (const item of repeatItems) {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) {
        missing.push(item.name);
        continue;
      }
      next[product.id] = Math.min(item.quantity, product.stock_quantity);
    }

    setCart(next);
    setPlacedOrder(null);
    setNotice(
      missing.length > 0
        ? `Carrinho remontado. Indisponível no momento: ${missing.join(', ')}.`
        : 'Carrinho remontado com o pedido anterior. Revise e envie.'
    );
    onRepeatConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeatItems, loading, products]);

  async function loadProducts(initial = false) {
    if (initial) {
      setLoading(true);
      setLoadError(null);
      setLoadErrorDetail(null);
    }
    try {
      const { data, error } = await supabase.rpc('get_public_products');
      if (error) throw error;
      setProducts(((data || []) as PublicProduct[]).map((p) => ({ ...p, price: Number(p.price || 0) })));
    } catch (e) {
      console.error(e);
      if (initial) {
        setLoadError('Não foi possível carregar os produtos agora. Tente novamente em instantes.');
        setLoadErrorDetail(describeError(e));
      }
    } finally {
      if (initial) setLoading(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
    );
  }, [products, query]);

  const cartItems = useMemo(
    () =>
      products
        .filter((p) => (cart[p.id] || 0) > 0)
        .map((p) => ({ product: p, quantity: Math.min(cart[p.id], p.stock_quantity) })),
    [products, cart]
  );

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = cartItems.reduce((sum, item) => sum + item.quantity * item.product.price, 0);

  const customAddress = joinAddress({ street, complement, neighborhood, city, reference });
  const customAddressValid = street.trim().length > 0 && neighborhood.trim().length > 0 && city.trim().length > 0;
  const deliveryAddress = addressMode === 'registered' ? registeredAddress : customAddress;
  const addressValid = addressMode === 'registered' ? registeredAddress.length > 0 : customAddressValid;

  const pixConfigured = settings.pix_key.trim().length > 0;
  const storeWhatsapp = settings.whatsapp.replace(/\D/g, '');

  function setQuantity(product: PublicProduct, next: number) {
    const clamped = Math.max(0, Math.min(next, product.stock_quantity));
    setSubmitError(null);
    setNotice(null);
    setCart((prev) => {
      const copy = { ...prev };
      if (clamped === 0) delete copy[product.id];
      else copy[product.id] = clamped;
      return copy;
    });
  }

  async function submitOrder() {
    if (cartItems.length === 0 || submitting) return;

    if (!addressValid) {
      setSubmitError(
        addressMode === 'custom'
          ? 'Preencha rua e número, bairro e cidade do endereço de entrega.'
          : 'Você não tem endereço cadastrado. Informe o endereço de entrega.'
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const { data, error } = await supabase.rpc('store_create_order_request', {
        p_session: session,
        p_items: cartItems.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
        p_notes: notes.trim(),
        p_payment_method: payment,
        p_delivery_address: addressMode === 'custom' ? customAddress : null,
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;

      setPlacedOrder({
        number: row?.request_number || 'seu pedido',
        items: cartItems.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          unit_price: item.product.price,
        })),
        total: totalValue,
        address: deliveryAddress,
        payment,
      });
      setCart({});
      setNotes('');
      setQuery('');
      setNotice(null);
      setCopied(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      loadProducts();
    } catch (e) {
      console.error(e);
      if (isSessionExpired(e)) {
        onSessionExpired();
        return;
      }
      setSubmitError(friendlyError(e, 'Não foi possível enviar o pedido. Tente novamente.'));
      loadProducts();
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPixKey() {
    try {
      await navigator.clipboard.writeText(settings.pix_key.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copie a chave Pix:', settings.pix_key.trim());
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-3" />
        <p className="text-slate-500">Carregando produtos...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <Card className="py-14 px-6 text-center max-w-md mx-auto">
        <span className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7" />
        </span>
        <p className="text-slate-700">{loadError}</p>
        {loadErrorDetail && (
          <p className="text-xs text-slate-400 mt-2 break-words">Detalhe técnico: {loadErrorDetail}</p>
        )}
        <button onClick={() => loadProducts(true)} className={`${primaryButton} mt-5 px-5 py-2.5 mx-auto`}>
          Tentar novamente
        </button>
      </Card>
    );
  }

  if (placedOrder) {
    const isPix = placedOrder.payment === 'pix';
    const whatsappText = encodeURIComponent(
      `Olá! Segue o comprovante do Pix do pedido ${placedOrder.number} (${formatBRL(placedOrder.total)}).`
    );
    const waNumber = storeWhatsapp.startsWith('55') && storeWhatsapp.length >= 12 ? storeWhatsapp : `55${storeWhatsapp}`;

    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="text-center pt-2 pb-1">
          <span className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-600/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </span>
          <h2 className="text-2xl font-bold text-slate-900">Pedido enviado!</h2>
          <p className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold ring-1 ring-emerald-200">
            {placedOrder.number}
          </p>
          <p className="text-slate-600 mt-3 leading-relaxed">
            Recebemos seu pedido e ele está em análise. Em poucos minutos ele entra na fila de entrega.
          </p>
        </div>

        <Card className="p-5">
          <SectionTitle icon={ClipboardList}>Resumo</SectionTitle>
          <div className="mt-4 space-y-2.5">
            {placedOrder.items.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm gap-3">
                <span className="text-slate-700 min-w-0 truncate">
                  <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold mr-2">
                    {item.quantity}x
                  </span>
                  {item.name}
                </span>
                <span className="text-slate-900 font-medium shrink-0">{formatBRL(item.quantity * item.unit_price)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-dashed border-slate-200">
            <span className="font-semibold text-slate-900">Total</span>
            <span className="font-bold text-xl text-emerald-700">{formatBRL(placedOrder.total)}</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-start gap-2.5 bg-slate-50 rounded-xl px-3 py-2.5">
              <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span className="text-slate-700">{placedOrder.address}</span>
            </div>
            <div className="flex items-center gap-2.5 bg-slate-50 rounded-xl px-3 py-2.5">
              {isPix ? <QrCode className="w-4 h-4 text-emerald-600" /> : <Banknote className="w-4 h-4 text-emerald-600" />}
              <span className="text-slate-700">{isPix ? 'Pagamento por Pix' : 'Pagamento na entrega'}</span>
            </div>
          </div>
        </Card>

        {isPix && (
          <Card className="p-5 ring-emerald-200 bg-gradient-to-b from-emerald-50/70 to-white">
            <SectionTitle icon={QrCode}>Pagamento por Pix</SectionTitle>

            {pixConfigured ? (
              <div className="mt-4 space-y-3">
                <div className="bg-white rounded-xl ring-1 ring-emerald-200 p-3.5">
                  <p className="text-xs text-slate-500">Chave Pix</p>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="font-mono text-slate-900 break-all">{settings.pix_key.trim()}</p>
                    <button
                      onClick={copyPixKey}
                      className="shrink-0 text-emerald-700 hover:bg-emerald-50 ring-1 ring-emerald-200 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copiada' : 'Copiar'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    {settings.pix_receiver.trim() && (
                      <div className="bg-slate-50 rounded-lg px-2.5 py-2">
                        <p className="text-slate-500">Recebedor</p>
                        <p className="font-medium text-slate-800 truncate">{settings.pix_receiver.trim()}</p>
                      </div>
                    )}
                    <div className="bg-slate-50 rounded-lg px-2.5 py-2">
                      <p className="text-slate-500">Valor</p>
                      <p className="font-semibold text-slate-800">{formatBRL(placedOrder.total)}</p>
                    </div>
                  </div>
                </div>
                {settings.pix_instructions.trim() && (
                  <p className="text-sm text-emerald-900">{settings.pix_instructions.trim()}</p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-emerald-900">
                A chave Pix será enviada pelo WhatsApp da loja junto com a confirmação do pedido.
              </p>
            )}

            {storeWhatsapp && (
              <a
                href={`https://wa.me/${waNumber}?text=${whatsappText}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${primaryButton} w-full py-3 mt-4`}
              >
                <MessageCircle className="w-5 h-5" />
                Enviar comprovante pelo WhatsApp
              </a>
            )}
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <button onClick={onViewOrders} className={`${secondaryButton} w-full py-3`}>
            <ClipboardList className="w-5 h-5" />
            Ver meus pedidos
          </button>
          <button onClick={() => setPlacedOrder(null)} className={`${primaryButton} w-full py-3`}>
            Fazer outro pedido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white p-5 shadow-md shadow-emerald-900/10 relative overflow-hidden">
          <Sparkles className="w-24 h-24 text-white/10 absolute -right-4 -top-4" />
          <p className="text-emerald-100 text-sm">Olá, {firstName(customer.name)}!</p>
          <h2 className="text-xl font-bold mt-0.5">O que vai pedir hoje?</h2>
          <div className="mt-3 inline-flex items-start gap-2 bg-white/15 rounded-xl px-3 py-2 text-sm max-w-full">
            <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="min-w-0">
              {registeredAddress ? (
                <>
                  Entrega em <span className="font-medium">{registeredAddress}</span>
                </>
              ) : (
                'Você informa o endereço no pedido'
              )}
            </span>
          </div>
        </div>

        {notice && (
          <div className="bg-sky-50 ring-1 ring-sky-200 text-sky-800 px-3.5 py-2.5 rounded-xl text-sm">{notice}</div>
        )}

        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto..."
            className={`${fieldClass} pl-11 py-3 rounded-full bg-white`}
          />
        </div>

        {filteredProducts.length === 0 ? (
          <Card className="text-center py-14">
            <span className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Package className="w-7 h-7" />
            </span>
            <p className="text-slate-600">
              {products.length === 0 ? 'Nenhum produto disponível no momento.' : 'Nenhum produto encontrado.'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredProducts.map((product) => {
              const quantity = cart[product.id] || 0;
              const lowStock = product.stock_quantity <= 5;
              const inCart = quantity > 0;

              return (
                <Card
                  key={product.id}
                  className={`p-4 flex gap-3.5 transition ${inCart ? 'ring-emerald-300 shadow-emerald-600/10 shadow-md' : 'hover:shadow-md'}`}
                >
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${tileClass(product.name)}`}>
                    {initials(product.name)}
                  </div>

                  <div className="min-w-0 flex-1 flex flex-col">
                    <h3 className="font-semibold text-slate-900 leading-snug">{product.name}</h3>
                    {product.description && (
                      <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{product.description}</p>
                    )}
                    {lowStock && (
                      <span className="inline-flex self-start mt-1.5 text-[11px] font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-full px-2 py-0.5">
                        Restam {product.stock_quantity}
                      </span>
                    )}

                    <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                      <p className="text-lg font-bold text-emerald-700">{formatBRL(product.price)}</p>

                      {!inCart ? (
                        <button
                          onClick={() => setQuantity(product, 1)}
                          className="shrink-0 bg-emerald-600 text-white pl-3 pr-3.5 py-2 rounded-full text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" />
                          Adicionar
                        </button>
                      ) : (
                        <div className="shrink-0 flex items-center gap-1 bg-emerald-50 ring-1 ring-emerald-200 rounded-full p-1">
                          <button
                            onClick={() => setQuantity(product, quantity - 1)}
                            className="w-8 h-8 rounded-full bg-white text-emerald-700 flex items-center justify-center hover:bg-emerald-100 transition"
                            aria-label="Diminuir"
                          >
                            {quantity === 1 ? <Trash2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                          </button>
                          <span className="w-7 text-center font-bold text-emerald-800">{quantity}</span>
                          <button
                            onClick={() => setQuantity(product, quantity + 1)}
                            disabled={quantity >= product.stock_quantity}
                            className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Aumentar"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <aside id="resumo" className="lg:col-span-1">
        <Card className="p-5 lg:sticky lg:top-24">
          <SectionTitle
            icon={ShoppingCart}
            right={
              totalItems > 0 ? (
                <span className="text-xs font-semibold bg-emerald-600 text-white rounded-full px-2.5 py-1">
                  {totalItems} {totalItems === 1 ? 'item' : 'itens'}
                </span>
              ) : null
            }
          >
            Seu pedido
          </SectionTitle>

          {cartItems.length === 0 ? (
            <div className="text-center py-10">
              <span className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <ShoppingCart className="w-7 h-7" />
              </span>
              <p className="text-sm text-slate-500">Adicione produtos para montar seu pedido.</p>
            </div>
          ) : (
            <>
              <div className="mt-4 space-y-2 max-h-56 overflow-y-auto pr-1">
                {cartItems.map(({ product, quantity }) => (
                  <div key={product.id} className="flex items-center justify-between text-sm gap-3">
                    <span className="text-slate-700 min-w-0 truncate flex items-center gap-2">
                      <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                        {quantity}x
                      </span>
                      <span className="truncate">{product.name}</span>
                    </span>
                    <span className="text-slate-900 font-medium shrink-0">{formatBRL(quantity * product.price)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-5 border-t border-dashed border-slate-200 space-y-6">
                {/* Endereço de entrega */}
                <div>
                  <SectionTitle icon={MapPin} tone="sky">Endereço de entrega</SectionTitle>

                  <div className="mt-3 space-y-2">
                    {registeredAddress && (
                      <label
                        className={`flex items-start gap-3 p-3 rounded-xl ring-1 cursor-pointer transition ${
                          addressMode === 'registered' ? 'ring-emerald-500 bg-emerald-50/60' : 'ring-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="address-mode"
                          checked={addressMode === 'registered'}
                          onChange={() => {
                            setAddressMode('registered');
                            setSubmitError(null);
                          }}
                          className="mt-1 accent-emerald-600"
                        />
                        <span className="text-sm min-w-0">
                          <span className="font-medium text-slate-900">Meu endereço cadastrado</span>
                          <span className="block text-slate-600 mt-0.5">{registeredAddress}</span>
                        </span>
                      </label>
                    )}

                    <label
                      className={`flex items-start gap-3 p-3 rounded-xl ring-1 cursor-pointer transition ${
                        addressMode === 'custom' ? 'ring-emerald-500 bg-emerald-50/60' : 'ring-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="address-mode"
                        checked={addressMode === 'custom'}
                        onChange={() => {
                          setAddressMode('custom');
                          setSubmitError(null);
                        }}
                        className="mt-1 accent-emerald-600"
                      />
                      <span className="text-sm font-medium text-slate-900">
                        {registeredAddress ? 'Entregar em outro endereço' : 'Informar endereço de entrega'}
                      </span>
                    </label>
                  </div>

                  {addressMode === 'custom' && (
                    <div className="mt-3 space-y-2">
                      <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua e número *" className={fieldClass} autoComplete="street-address" />
                      <input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Complemento (apto, bloco, casa)" className={fieldClass} />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Bairro *" className={fieldClass} />
                        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade *" className={fieldClass} autoComplete="address-level2" />
                      </div>
                      <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ponto de referência" className={fieldClass} />
                      <p className="text-xs text-slate-500">* obrigatório</p>
                    </div>
                  )}
                </div>

                {/* Forma de pagamento */}
                <div>
                  <SectionTitle icon={Banknote} tone="amber">Forma de pagamento</SectionTitle>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'pix' as PaymentMethod, label: 'Pix', icon: QrCode },
                        { id: 'on_delivery' as PaymentMethod, label: 'Na entrega', icon: Banknote },
                      ] as const
                    ).map(({ id, label, icon: Icon }) => {
                      const active = payment === id;
                      return (
                        <label
                          key={id}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl ring-1 cursor-pointer text-sm transition ${
                            active ? 'ring-emerald-500 bg-emerald-50/60' : 'ring-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <input type="radio" name="payment" className="sr-only" checked={active} onChange={() => setPayment(id)} />
                          <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            <Icon className="w-5 h-5" />
                          </span>
                          <span className="font-medium text-slate-900">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {payment === 'pix'
                      ? pixConfigured
                        ? 'A chave Pix aparece depois de enviar o pedido.'
                        : 'A chave Pix será enviada pelo WhatsApp da loja.'
                      : 'Dinheiro ou cartão no momento da entrega.'}
                  </p>
                </div>

                {/* Observação */}
                <div>
                  <SectionTitle icon={FileText} tone="slate">Observação</SectionTitle>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Ex: entregar a partir das 14h, ligar antes, troco para R$ 50..."
                    className={`${fieldClass} mt-3 resize-none`}
                  />
                </div>

                <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-slate-600 text-sm">Total</span>
                  <span className="text-2xl font-bold text-slate-900">{formatBRL(totalValue)}</span>
                </div>

                {submitError && (
                  <div className="bg-rose-50 ring-1 ring-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <button onClick={submitOrder} disabled={submitting} className={`${primaryButton} w-full py-3.5 text-base`}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Enviar pedido
                    </>
                  )}
                </button>

                <p className="text-[11px] text-slate-400 text-center -mt-2">
                  Contato cadastrado: {formatPhoneBR(customer.phone) || 'não informado'}
                </p>
              </div>
            </>
          )}
        </Card>
      </aside>

      {cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-[3.75rem] inset-x-0 px-4 pb-2 z-20 pointer-events-none">
          <a
            href="#resumo"
            className={`${primaryButton} pointer-events-auto w-full max-w-md mx-auto px-4 py-3 justify-between`}
          >
            <span className="flex items-center gap-2">
              <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-semibold">{totalItems}</span>
              Ver pedido
            </span>
            <span className="flex items-center gap-1">
              {formatBRL(totalValue)}
              <ChevronRight className="w-4 h-4" />
            </span>
          </a>
        </div>
      )}
    </div>
  );
}
