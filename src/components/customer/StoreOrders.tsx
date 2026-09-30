import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { RepeatItem } from './StoreCatalog';
import { describeError, formatBRL, isSessionExpired } from '../../lib/storeSession';
import { Card, Pill, orderStatusStyles, primaryButton, secondaryButton } from './ui';
import { ClipboardList, Loader2, AlertCircle, RefreshCw, RotateCcw, FileText, Package, Truck } from 'lucide-react';

type HistoryItem = {
  product_id?: string | null;
  name: string;
  quantity: number;
  unit_price: number;
};

type HistoryEntry = {
  kind: 'request' | 'order';
  id: string;
  number: string;
  status: string;
  created_at: string;
  dispatched_at: string | null;
  total: number;
  notes: string | null;
  items: HistoryItem[];
};

const REFRESH_MS = 30_000;

type Props = {
  session: string;
  onRepeat: (items: RepeatItem[]) => void;
  onSessionExpired: () => void;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Histórico do cliente: todos os pedidos, inclusive cancelados e não aprovados. */
export function StoreOrders({ session, onRepeat, onSessionExpired }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const load = useCallback(
    async (initial = false) => {
      if (initial) setLoading(true);
      else setRefreshing(true);
      setError(null);
      setErrorDetail(null);

      try {
        const { data, error: rpcError } = await supabase.rpc('store_my_orders', { p_session: session });
        if (rpcError) throw rpcError;
        setEntries((Array.isArray(data) ? data : []) as HistoryEntry[]);
      } catch (e) {
        console.error(e);
        if (isSessionExpired(e)) {
          onSessionExpired();
          return;
        }
        setError('Não foi possível carregar seus pedidos. Tente novamente.');
        setErrorDetail(describeError(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session, onSessionExpired]
  );

  useEffect(() => {
    load(true);
    const timer = setInterval(() => load(false), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-3" />
        <p className="text-slate-500">Carregando seus pedidos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="py-14 px-6 text-center max-w-md mx-auto">
        <span className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7" />
        </span>
        <p className="text-slate-700">{error}</p>
        {errorDetail && <p className="text-xs text-slate-400 mt-2 break-words">Detalhe técnico: {errorDetail}</p>}
        <button onClick={() => load(true)} className={`${primaryButton} mt-5 px-5 py-2.5 mx-auto`}>
          Tentar novamente
        </button>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Meus pedidos</h2>
          <p className="text-sm text-slate-500">
            {entries.length === 0 ? 'Nenhum pedido ainda' : `${entries.length} ${entries.length === 1 ? 'pedido' : 'pedidos'}`}
          </p>
        </div>
        <button
          onClick={() => load(false)}
          disabled={refreshing}
          className={`${secondaryButton} px-3.5 py-2 text-sm disabled:opacity-50`}
          title="Atualizar"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {entries.length === 0 ? (
        <Card className="text-center py-16 px-6">
          <span className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8" />
          </span>
          <p className="text-slate-700 font-medium">Você ainda não fez nenhum pedido.</p>
          <p className="text-sm text-slate-500 mt-1">Seus pedidos e o andamento de cada um aparecem aqui.</p>
        </Card>
      ) : (
        entries.map((entry) => {
          const st = orderStatusStyles[entry.status] || {
            label: entry.status,
            className: 'bg-slate-100 text-slate-600 ring-slate-200',
            dot: 'bg-slate-400',
          };
          const items = Array.isArray(entry.items) ? entry.items : [];
          const repeatable = items.filter((i) => i.product_id);

          return (
            <Card key={`${entry.kind}-${entry.id}`} className="overflow-hidden">
              <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{entry.number}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{formatDate(entry.created_at)}</p>
                </div>
                <Pill className={st.className}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                  {st.label}
                </Pill>
              </div>

              <div className="px-5 pb-4 space-y-3">
                <div className="space-y-1.5">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm gap-3">
                      <span className="text-slate-700 min-w-0 truncate flex items-center gap-2">
                        <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                          {item.quantity}x
                        </span>
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="text-slate-900 font-medium shrink-0">
                        {formatBRL(Number(item.quantity) * Number(item.unit_price))}
                      </span>
                    </div>
                  ))}
                </div>

                {entry.notes && (
                  <p className="text-xs text-slate-600 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
                    <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                    <span className="whitespace-pre-line">{entry.notes}</span>
                  </p>
                )}

                {entry.dispatched_at && (
                  <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" />
                    Despachado em {formatDate(entry.dispatched_at)}
                  </p>
                )}
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="font-bold text-slate-900">{formatBRL(Number(entry.total))}</span>
                {repeatable.length > 0 ? (
                  <button
                    onClick={() =>
                      onRepeat(
                        repeatable.map((i) => ({
                          product_id: String(i.product_id),
                          name: i.name,
                          quantity: Number(i.quantity),
                        }))
                      )
                    }
                    className="text-sm font-medium text-emerald-700 hover:bg-emerald-50 ring-1 ring-emerald-200 bg-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Repetir pedido
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" />
                    {items.length} {items.length === 1 ? 'item' : 'itens'}
                  </span>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
