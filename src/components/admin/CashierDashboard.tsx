import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CalendarDays, TrendingUp, Package, RefreshCcw } from 'lucide-react';

type Row = {
  id: string;
  dispatched_at: string | null;
  order_items: Array<{
    quantity: number;
    unit_price: number;
    products: { name: string } | null;
  }>;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CashierDashboard() {
  const [loading, setLoading] = useState(true);
  const [rowsToday, setRowsToday] = useState<Row[]>([]);
  const [rowsMonth, setRowsMonth] = useState<Row[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = startOfDay(addDays(now, 1));
  const monthStart = startOfMonth(now);
  const nextMonthStart = startOfMonth(addDays(new Date(now.getFullYear(), now.getMonth(), 1), 32));

  async function load() {
    setLoading(true);
    setErrorMsg(null);

    try {
      // Hoje
      const { data: d1, error: e1 } = await supabase
        .from('orders')
        .select(
          `
          id,
          dispatched_at,
          order_items (
            quantity,
            unit_price,
            products ( name )
          )
        `
        )
        .eq('status', 'dispatched')
        .gte('dispatched_at', todayStart.toISOString())
        .lt('dispatched_at', tomorrowStart.toISOString())
        .order('dispatched_at', { ascending: false });

      if (e1) throw e1;
      setRowsToday((d1 || []) as Row[]);

      // Mês
      const { data: d2, error: e2 } = await supabase
        .from('orders')
        .select(
          `
          id,
          dispatched_at,
          order_items (
            quantity,
            unit_price,
            products ( name )
          )
        `
        )
        .eq('status', 'dispatched')
        .gte('dispatched_at', monthStart.toISOString())
        .lt('dispatched_at', nextMonthStart.toISOString())
        .order('dispatched_at', { ascending: false });

      if (e2) throw e2;
      setRowsMonth((d2 || []) as Row[]);
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao carregar dados do caixa. Verifique RLS e colunas de preço.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const todayStats = useMemo(() => buildStats(rowsToday), [rowsToday]);
  const monthStats = useMemo(() => buildStats(rowsMonth), [rowsMonth]);

  if (loading) {
    return <div className="text-center py-10 text-gray-600">Carregando caixa...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Caixa</h2>
          <p className="text-sm text-gray-600">
            Hoje: {todayStart.toLocaleDateString('pt-BR')} • Mês: {monthStart.toLocaleDateString('pt-BR')}
          </p>
        </div>

        <button
          onClick={load}
          className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCcw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-md p-5">
          <div className="flex items-center gap-2 text-gray-700 mb-2">
            <CalendarDays className="w-5 h-5" />
            <span className="font-semibold">Total vendido hoje</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{formatBRL(todayStats.totalRevenue)}</div>
          <div className="text-sm text-gray-600 mt-2">
            Pedidos: <span className="font-semibold">{todayStats.ordersCount}</span> • Itens:{' '}
            <span className="font-semibold">{todayStats.totalItems}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-md p-5">
          <div className="flex items-center gap-2 text-gray-700 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="font-semibold">Total vendido no mês</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{formatBRL(monthStats.totalRevenue)}</div>
          <div className="text-sm text-gray-600 mt-2">
            Pedidos: <span className="font-semibold">{monthStats.ordersCount}</span> • Itens:{' '}
            <span className="font-semibold">{monthStats.totalItems}</span>
          </div>
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankingCard title="Vendas por produto (hoje)" items={todayStats.byProduct} />
        <RankingCard title="Vendas por produto (mês)" items={monthStats.byProduct} />
      </div>
    </div>
  );
}

function buildStats(rows: Row[]) {
  let totalRevenue = 0;
  let totalItems = 0;

  const map: Record<string, { name: string; qty: number; revenue: number }> = {};

  for (const o of rows) {
    for (const it of o.order_items || []) {
      const name = it.products?.name ?? 'Produto';
      const qty = Number(it.quantity || 0);
      const unit = Number(it.unit_price || 0);
      const rev = qty * unit;

      totalItems += qty;
      totalRevenue += rev;

      if (!map[name]) map[name] = { name, qty: 0, revenue: 0 };
      map[name].qty += qty;
      map[name].revenue += rev;
    }
  }

  const byProduct = Object.values(map).sort((a, b) => b.revenue - a.revenue);

  return {
    ordersCount: rows.length,
    totalItems,
    totalRevenue,
    byProduct,
  };
}

function RankingCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string; qty: number; revenue: number }>;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md p-5">
      <div className="flex items-center gap-2 mb-3 text-gray-700">
        <Package className="w-5 h-5" />
        <h3 className="font-semibold">{title}</h3>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-600">Sem vendas no período.</p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 10).map((p) => (
            <div key={p.name} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 truncate">{p.name}</div>
                <div className="text-xs text-gray-600">Quantidade: {p.qty}</div>
              </div>
              <div className="font-bold text-gray-900">{p.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}