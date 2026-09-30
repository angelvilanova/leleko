import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { RepeatItem } from './StoreCatalog';
import { describeError, formatBRL, isSessionExpired } from '../../lib/storeSession';
import { ClipboardList, Loader2, AlertCircle, RefreshCw, RotateCcw, FileText, Package } from 'lucide-react';

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

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  awaiting_approval: { label: 'Aguardando aprovação', color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  rejected: { label: 'Não aprovado', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  pending: { label: 'Na fila de entrega', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  dispatched: { label: 'Despachado', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelado', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
};

const REFRESH_MS = 30_000;

type Props = {
  session: string;
  onRepeat: (items: RepeatItem[]) => void;
  onSessionExpired: () => void;
};

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
      <div className="py-16 text-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
        <p className="text-slate-500">Carregando seus pedidos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center max-w-sm mx-auto">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <p className="text-slate-700">{error}</p>
        {errorDetail && (
          <p className="text-xs text-slate-400 mt-2 break-words">Detalhe técnico: {errorDetail}</p>
        )}
        <button
          onClick={() => load(true)}
          className="mt-5 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          Meus pedidos
        </h2>
        <button
          onClick={() => load(false)}
          disabled={refreshing}
          className="text-sm text-slate-600 hover:text-blue-700 flex items-center gap-1.5 disabled:opacity-50"
          title="Atualizar"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600">Você ainda não fez nenhum pedido.</p>
        </div>
      ) : (
        entries.map((entry) => {
          const st = statusConfig[entry.status] || { label: entry.status, color: 'bg-slate-50 text-slate-700 border-slate-200', dot: 'bg-slate-400' };
          const items = Array.isArray(entry.items) ? entry.items : [];
          const repeatable = items.filter((i) => i.product_id);

          return (
            <div key={`${entry.kind}-${entry.id}`} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-bold text-slate-900">{entry.number}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(entry.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    {entry.dispatched_at && (
                      <> · Despachado em {new Date(entry.dispatched_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</>
                    )}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${st.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                  {st.label}
                </span>
              </div>

              <div className="space-y-1.5">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 min-w-0 truncate">
                      <span className="font-semibold">{item.quantity}x</span> {item.name}
                    </span>
                    <span className="text-slate-900 font-medium shrink-0 ml-3">
                      {formatBRL(Number(item.quantity) * Number(item.unit_price))}
                    </span>
                  </div>
                ))}
              </div>

              {entry.notes && (
                <p className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
                  <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                  <span className="whitespace-pre-line">{entry.notes}</span>
                </p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-3">
                <span className="font-bold text-slate-900">{formatBRL(Number(entry.total))}</span>
                {repeatable.length > 0 && (
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
                    className="text-sm text-blue-700 hover:bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Repetir pedido
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
