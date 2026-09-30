import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { StoreCustomer } from './StoreShell';
import { describeError, formatBRL, friendlyError, isSessionExpired } from '../../lib/storeSession';
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

type PlacedOrder = {
  number: string;
  items: { name: string; quantity: number; unit_price: number }[];
  total: number;
};

type Props = {
  session: string;
  customer: StoreCustomer;
  repeatItems: RepeatItem[] | null;
  onRepeatConsumed: () => void;
  onViewOrders: () => void;
  onSessionExpired: () => void;
};

/**
 * Vitrine: produtos ativos com estoque, só preço de venda. Carrinho,
 * observação, pagamento na entrega. O envio cai em "Aguardando aprovação"
 * no painel.
 */
export function StoreCatalog({ session, customer, repeatItems, onRepeatConsumed, onViewOrders, onSessionExpired }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorDetail, setLoadErrorDetail] = useState<string | null>(null);
  const [products, setProducts] = useState<PublicProduct[]>([]);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);

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

    setSubmitting(true);
    setSubmitError(null);

    try {
      const { data, error } = await supabase.rpc('store_create_order_request', {
        p_session: session,
        p_items: cartItems.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
        p_notes: notes.trim(),
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
      });
      setCart({});
      setNotes('');
      setQuery('');
      setNotice(null);
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

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
        <p className="text-slate-500">Carregando produtos...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="py-16 text-center max-w-sm mx-auto">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <p className="text-slate-700">{loadError}</p>
        {loadErrorDetail && (
          <p className="text-xs text-slate-400 mt-2 break-words">Detalhe técnico: {loadErrorDetail}</p>
        )}
        <button
          onClick={() => loadProducts(true)}
          className="mt-5 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (placedOrder) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900">Pedido enviado!</h2>
          <p className="text-2xl font-bold text-blue-600 mt-1">{placedOrder.number}</p>
          <p className="text-slate-600 mt-3 leading-relaxed">
            Recebemos seu pedido e ele está em análise. Em poucos minutos ele entra na fila de entrega.
          </p>

          <div className="mt-6 text-left border-t border-slate-100 pt-4 space-y-2">
            {placedOrder.items.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  <span className="font-semibold">{item.quantity}x</span> {item.name}
                </span>
                <span className="text-slate-900 font-medium">{formatBRL(item.quantity * item.unit_price)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="font-semibold text-slate-900">Total</span>
              <span className="font-bold text-lg text-slate-900">{formatBRL(placedOrder.total)}</span>
            </div>
            <p className="text-xs text-slate-500 pt-1 flex items-center gap-1.5">
              <Banknote className="w-4 h-4" />
              Pagamento na entrega
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={onViewOrders}
              className="w-full border border-slate-300 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-50 transition flex items-center justify-center gap-2"
            >
              <ClipboardList className="w-5 h-5" />
              Ver meus pedidos
            </button>
            <button
              onClick={() => setPlacedOrder(null)}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
            >
              Fazer outro pedido
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-sm text-slate-600 flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />
            <span>
              Entrega em: <span className="font-medium text-slate-800">{customer.address || 'endereço não informado'}</span>
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-2">Se o endereço mudou, avise na observação do pedido.</p>
        </div>

        {notice && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-xl text-sm">{notice}</div>
        )}

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full pl-9 pr-3 py-3 border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">
              {products.length === 0 ? 'Nenhum produto disponível no momento.' : 'Nenhum produto encontrado.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((product) => {
              const quantity = cart[product.id] || 0;
              const lowStock = product.stock_quantity <= 5;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">{product.name}</h3>
                    {product.description && <p className="text-sm text-slate-600 mt-0.5">{product.description}</p>}
                    <p className="text-base font-bold text-blue-600 mt-1">{formatBRL(product.price)}</p>
                    {lowStock && <p className="text-xs text-amber-600 mt-0.5">Restam {product.stock_quantity} un.</p>}
                  </div>

                  {quantity === 0 ? (
                    <button
                      onClick={() => setQuantity(product, 1)}
                      className="shrink-0 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar
                    </button>
                  ) : (
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => setQuantity(product, quantity - 1)}
                        className="w-10 h-10 rounded-xl border border-slate-300 bg-white flex items-center justify-center hover:bg-slate-100 transition"
                        aria-label="Diminuir"
                      >
                        <Minus className="w-4 h-4 text-slate-700" />
                      </button>
                      <span className="w-8 text-center font-bold text-slate-900">{quantity}</span>
                      <button
                        onClick={() => setQuantity(product, quantity + 1)}
                        disabled={quantity >= product.stock_quantity}
                        className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Aumentar"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <aside id="resumo" className="lg:col-span-1">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 lg:sticky lg:top-20">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">Seu pedido</h2>
          </div>

          {cartItems.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Adicione produtos para montar seu pedido.</p>
          ) : (
            <>
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {cartItems.map(({ product, quantity }) => (
                  <div key={product.id} className="flex items-center justify-between text-sm gap-3">
                    <span className="text-slate-700 min-w-0 truncate">
                      <span className="font-semibold">{quantity}x</span> {product.name}
                    </span>
                    <span className="text-slate-900 font-medium shrink-0">{formatBRL(quantity * product.price)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div>
                  <label className="flex items-center gap-1.5 text-sm text-slate-700 mb-1">
                    <FileText className="w-4 h-4" />
                    Observação
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Ex: entregar a partir das 14h, ligar antes, sem troco..."
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  Pagamento na entrega
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-600">
                    {totalItems} {totalItems === 1 ? 'item' : 'itens'}
                  </span>
                  <span className="text-2xl font-bold text-slate-900">{formatBRL(totalValue)}</span>
                </div>

                {submitError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <button
                  onClick={submitOrder}
                  disabled={submitting}
                  className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
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
              </div>
            </>
          )}
        </div>
      </aside>

      {cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-14 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200 p-3 z-20">
          <a
            href="#resumo"
            className="flex items-center justify-between bg-blue-600 text-white rounded-xl px-4 py-3 font-semibold"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {totalItems} {totalItems === 1 ? 'item' : 'itens'}
            </span>
            <span>{formatBRL(totalValue)}</span>
          </a>
        </div>
      )}
    </div>
  );
}
