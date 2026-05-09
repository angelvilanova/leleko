import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  TrendingUp,
  DollarSign,
  Package,
  Clock,
  AlertTriangle,
  ShoppingCart,
  ArrowUpRight,
  Truck,
} from 'lucide-react';

function formatBRL(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type DaySummary = {
  revenue: number;
  cost: number;
  profit: number;
  ordersDispatched: number;
  totalItems: number;
};

type RecentOrder = {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  customers: { name: string } | null;
  order_items: { quantity: number }[];
};

type LowStockProduct = {
  id: string;
  name: string;
  stock_quantity: number;
};

interface HomeDashboardProps {
  onNavigate: (tab: string) => void;
}

export function HomeDashboard({ onNavigate }: HomeDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [daySummary, setDaySummary] = useState<DaySummary>({
    revenue: 0,
    cost: 0,
    profit: 0,
    ordersDispatched: 0,
    totalItems: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const today = toYMD(new Date());

      // Pedidos pendentes
      const { count: pending } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPendingCount(pending || 0);

      // Faturamento do dia
      const { data: dayOrders } = await supabase
        .from('orders')
        .select(`
          id,
          order_items ( quantity, unit_price, unit_cost )
        `)
        .eq('status', 'dispatched')
        .eq('cash_date', today);

      let revenue = 0;
      let cost = 0;
      let totalItems = 0;
      for (const order of dayOrders || []) {
        for (const item of (order as any).order_items || []) {
          const qty = Number(item.quantity || 0);
          totalItems += qty;
          revenue += qty * Number(item.unit_price || 0);
          cost += qty * Number(item.unit_cost || 0);
        }
      }
      setDaySummary({
        revenue,
        cost,
        profit: revenue - cost,
        ordersDispatched: (dayOrders || []).length,
        totalItems,
      });

      // Últimos pedidos
      const { data: recent } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          created_at,
          customers ( name ),
          order_items ( quantity )
        `)
        .order('created_at', { ascending: false })
        .limit(8);
      setRecentOrders((recent || []) as RecentOrder[]);

      // Estoque baixo (< 5 unidades, apenas produtos ativos)
      const { data: lowStockData } = await supabase
        .from('products')
        .select('id, name, stock_quantity')
        .eq('active', true)
        .lt('stock_quantity', 5)
        .order('stock_quantity', { ascending: true })
        .limit(10);
      setLowStock((lowStockData || []) as LowStockProduct[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
    pending: { label: 'Pendente', color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30', dot: 'bg-amber-500' },
    dispatched: { label: 'Despachado', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30', dot: 'bg-emerald-500' },
    cancelled: { label: 'Cancelado', color: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30', dot: 'bg-red-500' },
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-500 dark:text-slate-400">Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Bom {new Date().getHours() < 12 ? 'dia' : new Date().getHours() < 18 ? 'tarde' : 'noite'}!
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Resumo de hoje — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Faturamento */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <button
              onClick={() => onNavigate('cashier')}
              className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Faturamento hoje</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatBRL(daySummary.revenue)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            {daySummary.ordersDispatched} pedidos • {daySummary.totalItems} itens
          </p>
        </div>

        {/* Lucro */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Lucro do dia</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatBRL(daySummary.profit)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            Custo: {formatBRL(daySummary.cost)}
          </p>
        </div>

        {/* Pedidos pendentes */}
        <div
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => onNavigate('manageOrders')}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              pendingCount > 0
                ? 'bg-amber-50 dark:bg-amber-900/30'
                : 'bg-slate-50 dark:bg-slate-700'
            }`}>
              <Clock className={`w-5 h-5 ${
                pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
              }`} />
            </div>
            {pendingCount > 0 && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Pendentes</p>
          <p className={`text-2xl font-bold mt-1 ${
            pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
          }`}>
            {pendingCount}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            {pendingCount > 0 ? 'Aguardando despacho' : 'Tudo em dia!'}
          </p>
        </div>

        {/* Estoque baixo */}
        <div
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => onNavigate('products')}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              lowStock.length > 0
                ? 'bg-red-50 dark:bg-red-900/30'
                : 'bg-slate-50 dark:bg-slate-700'
            }`}>
              <AlertTriangle className={`w-5 h-5 ${
                lowStock.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'
              }`} />
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Estoque baixo</p>
          <p className={`text-2xl font-bold mt-1 ${
            lowStock.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
          }`}>
            {lowStock.length}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            {lowStock.length > 0 ? 'Produtos com menos de 5 un.' : 'Estoque OK'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Últimos pedidos */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Últimos Pedidos</h3>
            </div>
            <button
              onClick={() => onNavigate('manageOrders')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Ver todos
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {recentOrders.length === 0 ? (
              <p className="text-center py-8 text-slate-500 dark:text-slate-400">Nenhum pedido ainda</p>
            ) : (
              recentOrders.map((order) => {
                const st = statusConfig[order.status] || statusConfig.pending;
                const totalQty = order.order_items?.reduce(
                  (s, i) => s + Number(i.quantity || 0), 0
                ) || 0;
                return (
                  <div key={order.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {order.order_number}
                          </p>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${st.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                            {st.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {order.customers?.name || 'Sem cliente'} • {totalQty} itens
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 shrink-0 ml-3">
                      {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Estoque baixo - lista */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-red-500 dark:text-red-400" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Estoque Baixo</h3>
            </div>
            <button
              onClick={() => onNavigate('products')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Ver todos
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {lowStock.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">Tudo abastecido!</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Nenhum produto com estoque baixo</p>
              </div>
            ) : (
              lowStock.map((product) => (
                <div key={product.id} className="flex items-center justify-between px-5 py-3">
                  <p className="text-sm text-slate-900 dark:text-white font-medium truncate">
                    {product.name}
                  </p>
                  <span className={`text-sm font-bold shrink-0 ml-3 ${
                    product.stock_quantity === 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {product.stock_quantity === 0 ? 'Esgotado' : `${product.stock_quantity} un.`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
