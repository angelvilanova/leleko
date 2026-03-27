import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  CalendarDays,
  TrendingUp,
  Package,
  RefreshCcw,
  DollarSign,
} from 'lucide-react';

type Row = {
  id: string;
  dispatched_at: string | null;
  order_items: Array<{
    quantity: number;
    unit_price: number;
    unit_cost: number;
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

function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromYMD(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function CashierDashboard() {
  const [loading, setLoading] = useState(true);
  const [rowsDay, setRowsDay] = useState<Row[]>([]);
  const [rowsMonth, setRowsMonth] = useState<Row[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(toYMD(now));

  const selectedDay = fromYMD(selectedDate);
  const dayStart = startOfDay(selectedDay);
  const nextDayStart = startOfDay(addDays(selectedDay, 1));

  const monthStart = startOfMonth(selectedDay);
  const nextMonthStart = startOfMonth(
    addDays(new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1), 32)
  );

  async function load() {
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data: d1, error: e1 } = await supabase
        .from('orders')
        .select(
          `
          id,
          dispatched_at,
          order_items (
            quantity,
            unit_price,
            unit_cost,
            products ( name )
          )
        `
        )
        .eq('status', 'dispatched')
        .gte('dispatched_at', dayStart.toISOString())
        .lt('dispatched_at', nextDayStart.toISOString())
        .order('dispatched_at', { ascending: false });

      if (e1) throw e1;
      setRowsDay((d1 || []) as Row[]);

      const { data: d2, error: e2 } = await supabase
        .from('orders')
        .select(
          `
          id,
          dispatched_at,
          order_items (
            quantity,
            unit_price,
            unit_cost,
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
      setErrorMsg(
        'Erro ao carregar dados do caixa. Verifique RLS e as colunas unit_price e unit_cost.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [selectedDate]);

  const dayStats = useMemo(() => buildStats(rowsDay), [rowsDay]);
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
            Dia selecionado: {dayStart.toLocaleDateString('pt-BR')} • Mês:{' '}
            {monthStart.toLocaleDateString('pt-BR')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
          />

          <button
            onClick={() => setSelectedDate(toYMD(new Date()))}
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
          >
            Hoje
          </button>

          <button
            onClick={load}
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-md p-5">
          <div className="flex items-center gap-2 text-gray-700 mb-2">
            <CalendarDays className="w-5 h-5" />
            <span className="font-semibold">Faturamento do dia</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {formatBRL(dayStats.totalRevenue)}
          </div>
          <div className="text-sm text-gray-600 mt-2">
            Pedidos: <span className="font-semibold">{dayStats.ordersCount}</span> •
            Itens: <span className="font-semibold">{dayStats.totalItems}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-md p-5">
          <div className="flex items-center gap-2 text-gray-700 mb-2">
            <DollarSign className="w-5 h-5" />
            <span className="font-semibold">Custo do dia</span>
          </div>
          <div className="text-3xl font-bold text-orange-600">
            {formatBRL(dayStats.totalCost)}
          </div>
          <div className="text-sm text-gray-600 mt-2">
            Ticket bruto: <span className="font-semibold">{formatBRL(dayStats.totalRevenue)}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-md p-5">
          <div className="flex items-center gap-2 text-gray-700 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="font-semibold">Lucro líquido do dia</span>
          </div>
          <div className="text-3xl font-bold text-green-600">
            {formatBRL(dayStats.totalProfit)}
          </div>
          <div className="text-sm text-gray-600 mt-2">
            Margem: <span className="font-semibold">{dayStats.margin}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-md p-5">
          <div className="flex items-center gap-2 text-gray-700 mb-2">
            <CalendarDays className="w-5 h-5" />
            <span className="font-semibold">Faturamento no mês</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {formatBRL(monthStats.totalRevenue)}
          </div>
          <div className="text-sm text-gray-600 mt-2">
            Pedidos: <span className="font-semibold">{monthStats.ordersCount}</span> •
            Itens: <span className="font-semibold">{monthStats.totalItems}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-md p-5">
          <div className="flex items-center gap-2 text-gray-700 mb-2">
            <DollarSign className="w-5 h-5" />
            <span className="font-semibold">Custo no mês</span>
          </div>
          <div className="text-3xl font-bold text-orange-600">
            {formatBRL(monthStats.totalCost)}
          </div>
          <div className="text-sm text-gray-600 mt-2">
            Ticket bruto: <span className="font-semibold">{formatBRL(monthStats.totalRevenue)}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-md p-5">
          <div className="flex items-center gap-2 text-gray-700 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="font-semibold">Lucro líquido no mês</span>
          </div>
          <div className="text-3xl font-bold text-green-600">
            {formatBRL(monthStats.totalProfit)}
          </div>
          <div className="text-sm text-gray-600 mt-2">
            Margem: <span className="font-semibold">{monthStats.margin}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankingCard title="Resultado por produto (dia)" items={dayStats.byProduct} />
        <RankingCard title="Resultado por produto (mês)" items={monthStats.byProduct} />
      </div>
    </div>
  );
}

function buildStats(rows: Row[]) {
  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let totalItems = 0;

  const map: Record<
    string,
    {
      name: string;
      qty: number;
      revenue: number;
      cost: number;
      profit: number;
    }
  > = {};

  for (const order of rows) {
    for (const item of order.order_items || []) {
      const name = item.products?.name ?? 'Produto';
      const qty = Number(item.quantity || 0);
      const unitPrice = Number(item.unit_price || 0);
      const unitCost = Number(item.unit_cost || 0);

      const revenue = qty * unitPrice;
      const cost = qty * unitCost;
      const profit = revenue - cost;

      totalItems += qty;
      totalRevenue += revenue;
      totalCost += cost;
      totalProfit += profit;

      if (!map[name]) {
        map[name] = {
          name,
          qty: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        };
      }

      map[name].qty += qty;
      map[name].revenue += revenue;
      map[name].cost += cost;
      map[name].profit += profit;
    }
  }

  const byProduct = Object.values(map).sort((a, b) => b.profit - a.profit);

  const margin =
    totalRevenue > 0 ? Number(((totalProfit / totalRevenue) * 100).toFixed(2)) : 0;

  return {
    ordersCount: rows.length,
    totalItems,
    totalRevenue,
    totalCost,
    totalProfit,
    margin,
    byProduct,
  };
}

function RankingCard({
  title,
  items,
}: {
  title: string;
  items: Array<{
    name: string;
    qty: number;
    revenue: number;
    cost: number;
    profit: number;
  }>;
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
            <div
              key={p.name}
              className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{p.name}</div>
                  <div className="text-xs text-gray-600">Quantidade: {p.qty}</div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-gray-900">{formatBRL(p.revenue)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-200">
                <div className="text-gray-600">
                  Custo: <span className="font-semibold">{formatBRL(p.cost)}</span>
                </div>
                <div className="text-right text-green-700">
                  Lucro: <span className="font-semibold">{formatBRL(p.profit)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
