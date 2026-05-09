import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Customer } from '../../types/database';
import {
  Search,
  User,
  Package,
  FileText,
  CalendarDays,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type HistoryOrder = {
  id: string;
  order_number: string;
  status: string;
  cash_date: string | null;
  notes: string | null;
  created_at: string;
  dispatched_at: string | null;
  order_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    unit_cost: number;
    products: { name: string } | null;
  }>;
};

function formatBRL(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDateTime(date?: string | null) {
  if (!date) return '—';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('pt-BR');
}

function formatPhone(phone?: string | null): string {
  if (!phone) return 'Não informado';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  dispatched: { label: 'Despachado', color: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800 border-red-200' },
};

export function CustomerHistory() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) throw error;
      setCustomers((data || []) as Customer[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setExpandedOrder(null);
    setOrdersLoading(true);

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          cash_date,
          notes,
          created_at,
          dispatched_at,
          order_items (
            id,
            quantity,
            unit_price,
            unit_cost,
            products ( name )
          )
        `)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data || []) as HistoryOrder[]);
    } catch (e) {
      console.error(e);
    } finally {
      setOrdersLoading(false);
    }
  }

  const phoneNorm = (v: string) => v.replace(/\D/g, '');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;

    const qPhone = phoneNorm(q);
    return customers.filter((c) => {
      const n = (c.name || '').toLowerCase();
      const a = (c.address || '').toLowerCase();
      const p = phoneNorm(c.phone || '');
      return n.includes(q) || a.includes(q) || (qPhone && p.includes(qPhone));
    });
  }, [customers, query]);

  const totals = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalItems = 0;
    const dispatched = orders.filter((o) => o.status === 'dispatched');

    for (const order of dispatched) {
      for (const item of order.order_items || []) {
        const qty = Number(item.quantity || 0);
        totalItems += qty;
        totalRevenue += qty * Number(item.unit_price || 0);
        totalCost += qty * Number(item.unit_cost || 0);
      }
    }

    return {
      ordersCount: dispatched.length,
      totalItems,
      totalRevenue,
      totalProfit: totalRevenue - totalCost,
    };
  }, [orders]);

  if (loading) {
    return <div className="text-center py-8">Carregando clientes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de clientes */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-2 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 mb-4">
            <Search className="w-4 h-4 text-gray-500 dark:text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="outline-none text-sm w-full dark:bg-transparent dark:text-white"
              placeholder="Buscar cliente..."
            />
          </div>

          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">Nenhum cliente encontrado.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectCustomer(c)}
                  className={`w-full text-left px-3 py-3 rounded-lg transition text-sm ${
                    selectedCustomer?.id === c.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 border border-transparent'
                  }`}
                >
                  <p className="font-semibold text-gray-900 dark:text-white">{c.name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{formatPhone(c.phone)}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Histórico do cliente selecionado */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedCustomer ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
              <User className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-slate-400">Selecione um cliente para ver o histórico</p>
            </div>
          ) : (
            <>
              {/* Info do cliente */}
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-bold text-blue-900 dark:text-blue-100 text-lg">{selectedCustomer.name}</h3>
                </div>
                <div className="text-sm text-blue-800 dark:text-blue-200 space-y-0.5">
                  <p><span className="font-semibold">Telefone:</span> {formatPhone(selectedCustomer.phone)}</p>
                  <p><span className="font-semibold">Endereço:</span> {selectedCustomer.address}</p>
                </div>
              </div>

              {/* Resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Pedidos</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{totals.ordersCount}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Itens comprados</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{totals.totalItems}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Total gasto</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatBRL(totals.totalRevenue)}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Lucro gerado</p>
                  <p className="text-2xl font-bold text-green-600">{formatBRL(totals.totalProfit)}</p>
                </div>
              </div>

              {/* Lista de pedidos */}
              {ordersLoading ? (
                <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-gray-500 dark:text-slate-400 text-sm">Carregando pedidos...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
                  <Package className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-slate-400">Nenhum pedido encontrado para este cliente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => {
                    const st = statusLabels[order.status] || {
                      label: order.status,
                      color: 'bg-gray-100 text-gray-800 border-gray-200',
                    };
                    const totalItems = order.order_items.reduce(
                      (s, i) => s + Number(i.quantity || 0),
                      0
                    );
                    const totalOrder = order.order_items.reduce(
                      (s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0),
                      0
                    );
                    const isExpanded = expandedOrder === order.id;

                    return (
                      <div
                        key={order.id}
                        className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden"
                      >
                        <button
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                          className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-gray-900 dark:text-white">{order.order_number}</h4>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${st.color}`}
                              >
                                {st.label}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                              {formatDateTime(order.created_at)} • {totalItems} itens •{' '}
                              {formatBRL(totalOrder)}
                            </p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="border-t border-gray-100 dark:border-slate-700 p-4 space-y-3">
                            {order.dispatched_at && (
                              <p className="text-xs text-gray-500 dark:text-slate-400">
                                Despachado em: {formatDateTime(order.dispatched_at)}
                              </p>
                            )}

                            {order.notes && (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <FileText className="w-4 h-4 text-amber-600" />
                                  <span className="font-semibold text-amber-900 text-sm">
                                    Observação
                                  </span>
                                </div>
                                <p className="text-sm text-amber-800 whitespace-pre-line">
                                  {order.notes}
                                </p>
                              </div>
                            )}

                            <div className="space-y-1.5">
                              {order.order_items.map((item) => {
                                const subtotal =
                                  Number(item.quantity || 0) * Number(item.unit_price || 0);
                                return (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 px-3 py-2 rounded-lg"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Package className="w-4 h-4 text-gray-400 shrink-0" />
                                      <span className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">
                                        {item.products?.name || 'Produto'}
                                      </span>
                                    </div>
                                    <div className="text-right shrink-0 ml-2">
                                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                                        {item.quantity} un.
                                      </span>
                                      <span className="text-xs text-gray-500 dark:text-slate-400 ml-2">
                                        {formatBRL(subtotal)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-700">
                              <span className="text-sm text-gray-600 dark:text-slate-400 font-medium">
                                Total do pedido:
                              </span>
                              <span className="text-lg font-bold text-gray-900 dark:text-white">
                                {formatBRL(totalOrder)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
