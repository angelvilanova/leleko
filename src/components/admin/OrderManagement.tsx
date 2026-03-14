import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Check, Edit3, Trash2, X, Plus, Minus, Package, User } from 'lucide-react';

type Product = {
  id: string;
  name: string;
  description?: string | null;
  stock_quantity: number;
};

type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  products: Product;
};

type OrderRow = {
  id: string;
  order_number: string;
  status: 'pending' | 'dispatched' | 'cancelled';
  created_at: string;
  dispatched_at: string | null;
  customer_id: string | null;
  customers: Customer | null;
  order_items: OrderItem[];
};

type DraftItem = {
  id: string;
  product_id: string;
  quantity: number;
};

const statusLabel: Record<OrderRow['status'], string> = {
  pending: 'Pendente',
  dispatched: 'Despachado',
  cancelled: 'Cancelado',
};

const statusClasses: Record<OrderRow['status'], string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  dispatched: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

function toStartISO(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

function toEndISO(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfMonthYMD(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function addDays(date: Date, days: number) {
  const x = new Date(date);
  x.setDate(x.getDate() + days);
  return x;
}

export function OrderManagement() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<OrderRow['status']>('pending');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState('');
  const [dispatchFrom, setDispatchFrom] = useState('');
  const [dispatchTo, setDispatchTo] = useState('');

  useEffect(() => {
    (async () => {
      await Promise.all([loadOrders(), loadProducts()]);
      setLoading(false);
    })();
  }, []);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;

    return orders.filter((o) => {
      const c = o.customers;
      const translatedStatus = statusLabel[o.status].toLowerCase();

      return (
        o.order_number.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q) ||
        translatedStatus.includes(q) ||
        (c?.name?.toLowerCase().includes(q) ?? false) ||
        (c?.phone?.toLowerCase().includes(q) ?? false) ||
        (c?.address?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [orders, query]);

  async function loadProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,description,stock_quantity')
      .order('name');

    if (error) {
      console.error(error);
      return;
    }

    setProducts((data || []) as Product[]);
  }

  async function loadOrders() {
    let q = supabase
      .from('orders')
      .select(
        `
        id, order_number, status, created_at, dispatched_at, customer_id,
        customers ( id, name, phone, address ),
        order_items ( id, order_id, product_id, quantity, products ( id, name, description, stock_quantity ) )
      `
      )
      .order('created_at', { ascending: false });

    if (dispatchFrom || dispatchTo) {
      q = q.eq('status', 'dispatched');
      if (dispatchFrom) q = q.gte('dispatched_at', toStartISO(dispatchFrom));
      if (dispatchTo) q = q.lte('dispatched_at', toEndISO(dispatchTo));
    }

    const { data, error } = await q;

    if (error) {
      console.error(error);
      return;
    }

    setOrders((data || []) as OrderRow[]);
  }

  function applyQuickRange(range: 'today' | 'yesterday' | 'month') {
    const now = new Date();

    if (range === 'today') {
      const ymd = toYMD(now);
      setDispatchFrom(ymd);
      setDispatchTo(ymd);
      return;
    }

    if (range === 'yesterday') {
      const y = toYMD(addDays(now, -1));
      setDispatchFrom(y);
      setDispatchTo(y);
      return;
    }

    setDispatchFrom(startOfMonthYMD(now));
    setDispatchTo(toYMD(now));
  }

  function clearFilters() {
    setDispatchFrom('');
    setDispatchTo('');
  }

  function startEdit(order: OrderRow) {
    setEditingId(order.id);
    setDraftStatus(order.status);
    setDraftItems(
      order.order_items.map((it) => ({
        id: it.id,
        product_id: it.product_id,
        quantity: it.quantity,
      }))
    );
    setExpandedId(order.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftItems([]);
  }

  function updateDraftItem(itemId: string, patch: Partial<DraftItem>) {
    setDraftItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)));
  }

  function removeDraftItem(itemId: string) {
    setDraftItems((prev) => prev.filter((it) => it.id !== itemId));
  }

  function addDraftItem() {
    const tempId = `tmp_${Math.random().toString(16).slice(2)}`;
    const firstProduct = products[0];
    if (!firstProduct) return;

    setDraftItems((prev) => [
      ...prev,
      { id: tempId, product_id: firstProduct.id, quantity: 1 },
    ]);
  }

  async function saveEdit(orderId: string) {
    setSaving(true);

    try {
      const { data: currentItems, error: curErr } = await supabase
        .from('order_items')
        .select('id, product_id, quantity')
        .eq('order_id', orderId);

      if (curErr) throw curErr;

      const current = (currentItems || []) as Array<{
        id: string;
        product_id: string;
        quantity: number;
      }>;

      const updatePayload: {
        status: OrderRow['status'];
        dispatched_at?: string | null;
      } = {
        status: draftStatus,
      };

      if (draftStatus === 'dispatched') {
        updatePayload.dispatched_at = new Date().toISOString();
      } else if (draftStatus === 'pending' || draftStatus === 'cancelled') {
        updatePayload.dispatched_at = null;
      }

      const { error: stErr } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId);

      if (stErr) throw stErr;

      for (const it of current) {
        const { data: prod, error: pErr } = await supabase
          .from('products')
          .select('id, stock_quantity')
          .eq('id', it.product_id)
          .single();

        if (pErr) throw pErr;

        const { error: uErr } = await supabase
          .from('products')
          .update({ stock_quantity: (prod.stock_quantity as number) + it.quantity })
          .eq('id', it.product_id);

        if (uErr) throw uErr;
      }

      const existingDraft = draftItems.filter((d) => !d.id.startsWith('tmp_'));
      const newDraft = draftItems.filter((d) => d.id.startsWith('tmp_'));

      for (const d of existingDraft) {
        const { error } = await supabase
          .from('order_items')
          .update({ product_id: d.product_id, quantity: d.quantity })
          .eq('id', d.id);

        if (error) throw error;
      }

      if (newDraft.length > 0) {
        const payload = newDraft.map((d) => ({
          order_id: orderId,
          product_id: d.product_id,
          quantity: d.quantity,
        }));

        const { error } = await supabase.from('order_items').insert(payload);
        if (error) throw error;
      }

      const draftRealIds = new Set(existingDraft.map((d) => d.id));
      const removed = current.filter((c) => !draftRealIds.has(c.id));

      for (const r of removed) {
        const { error } = await supabase.from('order_items').delete().eq('id', r.id);
        if (error) throw error;
      }

      const { data: finalItems, error: finErr } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', orderId);

      if (finErr) throw finErr;

      const finalIt = (finalItems || []) as Array<{ product_id: string; quantity: number }>;

      for (const it of finalIt) {
        const { data: prod, error: pErr } = await supabase
          .from('products')
          .select('id, stock_quantity')
          .eq('id', it.product_id)
          .single();

        if (pErr) throw pErr;

        const newStock = (prod.stock_quantity as number) - it.quantity;
        if (newStock < 0) {
          throw new Error('Estoque insuficiente para salvar as alterações do pedido.');
        }

        const { error: uErr } = await supabase
          .from('products')
          .update({ stock_quantity: newStock })
          .eq('id', it.product_id);

        if (uErr) throw uErr;
      }

      setEditingId(null);
      setDraftItems([]);
      await Promise.all([loadOrders(), loadProducts()]);
    } catch (e) {
      console.error(e);
      alert('Não foi possível salvar. Verifique estoque/policies. (Detalhes no console)');
      await Promise.all([loadOrders(), loadProducts()]);
      setEditingId(null);
      setDraftItems([]);
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrder(order: OrderRow) {
    const ok = confirm(`Apagar o pedido ${order.order_number}? Isso não pode ser desfeito.`);
    if (!ok) return;

    try {
      for (const it of order.order_items) {
        const { data: prod, error: pErr } = await supabase
          .from('products')
          .select('id, stock_quantity')
          .eq('id', it.product_id)
          .single();

        if (pErr) throw pErr;

        const { error: uErr } = await supabase
          .from('products')
          .update({ stock_quantity: (prod.stock_quantity as number) + it.quantity })
          .eq('id', it.product_id);

        if (uErr) throw uErr;
      }

      const { error } = await supabase.from('orders').delete().eq('id', order.id);
      if (error) throw error;

      await Promise.all([loadOrders(), loadProducts()]);
    } catch (e) {
      console.error(e);
      alert('Erro ao apagar o pedido. Veja o console.');
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Carregando pedidos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-2xl font-bold text-gray-900">Gerenciar Pedidos</h2>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-80 max-w-full"
            placeholder="Buscar por pedido, status, cliente..."
          />

          <button
            onClick={() => {
              applyQuickRange('today');
              setTimeout(loadOrders, 0);
            }}
            className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
          >
            Hoje
          </button>

          <button
            onClick={() => {
              applyQuickRange('yesterday');
              setTimeout(loadOrders, 0);
            }}
            className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
          >
            Ontem
          </button>

          <button
            onClick={() => {
              applyQuickRange('month');
              setTimeout(loadOrders, 0);
            }}
            className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
          >
            Este mês
          </button>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Despacho De</label>
            <input
              type="date"
              value={dispatchFrom}
              onChange={(e) => setDispatchFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Até</label>
            <input
              type="date"
              value={dispatchTo}
              onChange={(e) => setDispatchTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={loadOrders}
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
          >
            Filtrar
          </button>

          <button
            onClick={() => {
              clearFilters();
              setTimeout(loadOrders, 0);
            }}
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
          >
            Limpar
          </button>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-600">
          Nenhum pedido encontrado.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const expanded = expandedId === order.id;
            const editing = editingId === order.id;

            return (
              <div key={order.id} className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
                <div className="p-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={() => setExpandedId(expanded ? null : order.id)}
                        className="text-left"
                        title="Expandir/Fechar"
                      >
                        <div className="text-lg font-bold text-gray-900">{order.order_number}</div>
                        <div className="text-sm text-gray-600">
                          Criado em: {new Date(order.created_at).toLocaleString('pt-BR')}
                        </div>
                        {order.dispatched_at && (
                          <div className="text-sm text-gray-600">
                            Despachado em: {new Date(order.dispatched_at).toLocaleString('pt-BR')}
                          </div>
                        )}
                      </button>

                      <span
                        className={`text-xs px-3 py-1 rounded-full border ${statusClasses[order.status]}`}
                      >
                        Status: <span className="font-semibold">{statusLabel[order.status]}</span>
                      </span>
                    </div>

                    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2 mb-1 text-blue-900 font-semibold">
                        <User className="w-4 h-4" /> Cliente
                      </div>
                      {order.customers ? (
                        <div className="text-blue-900 space-y-1">
                          <div><span className="font-semibold">Nome:</span> {order.customers.name}</div>
                          <div><span className="font-semibold">Telefone:</span> {order.customers.phone}</div>
                          <div><span className="font-semibold">Endereço:</span> {order.customers.address}</div>
                        </div>
                      ) : (
                        <div className="text-blue-900">Sem cliente associado</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!editing ? (
                      <>
                        <button
                          onClick={() => startEdit(order)}
                          className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
                          title="Editar pedido"
                        >
                          <Edit3 className="w-4 h-4" />
                          Editar
                        </button>

                        <button
                          onClick={() => deleteOrder(order)}
                          className="px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 flex items-center gap-2"
                          title="Apagar pedido"
                        >
                          <Trash2 className="w-4 h-4" />
                          Apagar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => saveEdit(order.id)}
                          disabled={saving}
                          className="px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                          title="Salvar"
                        >
                          <Check className="w-4 h-4" />
                          {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                          title="Cancelar"
                        >
                          <X className="w-4 h-4" />
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="px-5 pb-5">
                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="font-semibold text-gray-900">Status do pedido</div>

                        {editing ? (
                          <select
                            value={draftStatus}
                            onChange={(e) => setDraftStatus(e.target.value as OrderRow['status'])}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="pending">Pendente</option>
                            <option value="dispatched">Despachado</option>
                            <option value="cancelled">Cancelado</option>
                          </select>
                        ) : (
                          <div className="text-sm text-gray-700">
                            <span className="font-semibold">{statusLabel[order.status]}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="font-semibold text-gray-900">Itens do pedido</div>
                        {editing && (
                          <button
                            onClick={addDraftItem}
                            className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Adicionar item
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {(editing ? draftItems : order.order_items).map((it: any) => {
                          const isDraft = editing;
                          const draft = it as DraftItem;
                          const real = it as OrderItem;

                          const productId = isDraft ? draft.product_id : real.product_id;
                          const qty = isDraft ? draft.quantity : real.quantity;
                          const prod = isDraft
                            ? products.find((p) => p.id === productId)
                            : real.products;

                          return (
                            <div key={isDraft ? draft.id : real.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex items-center gap-3">
                                  <Package className="w-5 h-5 text-gray-500" />
                                  <div className="min-w-0">
                                    {editing ? (
                                      <select
                                        value={productId}
                                        onChange={(e) =>
                                          updateDraftItem(draft.id, { product_id: e.target.value })
                                        }
                                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                                      >
                                        {products.map((p) => (
                                          <option key={p.id} value={p.id}>
                                            {p.name} (estoque: {p.stock_quantity})
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <>
                                        <div className="font-semibold text-gray-900 truncate">
                                          {prod?.name}
                                        </div>
                                        {prod?.description && (
                                          <div className="text-sm text-gray-600 truncate">
                                            {prod.description}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>

                                {editing && (
                                  <button
                                    onClick={() => removeDraftItem(draft.id)}
                                    className="text-red-700 hover:text-red-900"
                                    title="Remover item"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                )}
                              </div>

                              <div className="mt-3 flex items-center justify-between">
                                <div className="text-sm text-gray-700">
                                  Estoque atual: <span className="font-semibold">{prod?.stock_quantity ?? '-'}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {editing ? (
                                    <>
                                      <button
                                        onClick={() =>
                                          updateDraftItem(draft.id, {
                                            quantity: Math.max(1, qty - 1),
                                          })
                                        }
                                        className="bg-white border border-gray-300 p-2 rounded-lg hover:bg-gray-100"
                                        title="-"
                                      >
                                        <Minus className="w-4 h-4" />
                                      </button>
                                      <input
                                        type="number"
                                        min={1}
                                        value={qty}
                                        onChange={(e) => {
                                          const v = Number(e.target.value);
                                          updateDraftItem(draft.id, {
                                            quantity: Number.isFinite(v) ? Math.max(1, v) : 1,
                                          });
                                        }}
                                        className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm text-center"
                                      />
                                      <button
                                        onClick={() => updateDraftItem(draft.id, { quantity: qty + 1 })}
                                        className="bg-white border border-gray-300 p-2 rounded-lg hover:bg-gray-100"
                                        title="+"
                                      >
                                        <Plus className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <div className="font-bold text-gray-900">{qty} un.</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-2 text-sm text-gray-700 flex items-center justify-between">
                        <span className="font-semibold">Total de itens:</span>
                        <span className="font-bold">
                          {(editing ? draftItems : order.order_items).reduce(
                            (sum: number, i: any) => sum + (i.quantity || 0),
                            0
                          )}
                        </span>
                      </div>

                      {editing && (
                        <div className="text-xs text-gray-500">
                          * Ao salvar, o sistema devolve o estoque antigo e aplica o novo para manter tudo correto.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}