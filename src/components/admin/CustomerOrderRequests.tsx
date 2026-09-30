import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Clock, CheckCircle2, XCircle, User, FileText, Link2, Package } from 'lucide-react';

type RequestItem = {
  product_id: string;
  name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  unit_cost?: number;
};

type OrderRequest = {
  id: string;
  request_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  items: RequestItem[];
  total: number;
  notes: string;
  status: string;
  created_at: string;
};

const AUTO_APPROVE_MINUTES = 5;
const REFRESH_MS = 15_000;
const TICK_MS = 10_000;

function formatBRL(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPhone(phone?: string | null) {
  if (!phone) return 'Não informado';
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

/**
 * Pedidos feitos pelos clientes no link próprio, aguardando decisão.
 *
 * Vive numa tabela separada (customer_order_requests). Só ao aprovar é que
 * um pedido normal é criado na tabela orders, pelo banco. Reprovar devolve o
 * estoque e nada entra em orders. Sem decisão em 5 minutos, aprova sozinho.
 *
 * Quando não há nada aguardando, o componente não renderiza nada, e a tela
 * de pedidos fica exatamente como era.
 */
export function CustomerOrderRequests({ onDecided }: { onDecided: () => void | Promise<void> }) {
  const [requests, setRequests] = useState<OrderRequest[]>([]);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const onDecidedRef = useRef(onDecided);
  useEffect(() => {
    onDecidedRef.current = onDecided;
  }, [onDecided]);

  const load = useCallback(async () => {
    // Rede de segurança: aprova o que passou do prazo mesmo se o job do banco
    // não estiver rodando. Se aprovou algo, a lista de pedidos precisa recarregar.
    const { data: approvedCount, error: autoErr } = await supabase.rpc('auto_approve_customer_order_requests');
    if (autoErr) {
      console.warn('auto_approve_customer_order_requests:', autoErr.message);
    } else if (Number(approvedCount) > 0) {
      void onDecidedRef.current();
    }

    const { data, error } = await supabase
      .from('customer_order_requests')
      .select('*')
      .eq('status', 'awaiting')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('customer_order_requests:', error.message);
      setRequests([]);
      return;
    }

    setRequests((data || []) as OrderRequest[]);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    load();
    const refresh = setInterval(load, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [load]);

  async function approve(req: OrderRequest) {
    setDeciding(req.id);
    try {
      const { error } = await supabase.rpc('approve_customer_order_request', { p_request_id: req.id });
      if (error) throw error;
    } catch (e: unknown) {
      console.error(e);
      alert((e as { message?: string })?.message || 'Não foi possível aprovar o pedido.');
    } finally {
      await load();
      await onDecidedRef.current();
      setDeciding(null);
    }
  }

  async function reject(req: OrderRequest) {
    const ok = confirm(`Reprovar o pedido ${req.request_number}? O estoque reservado será devolvido.`);
    if (!ok) return;

    setDeciding(req.id);
    try {
      const { error } = await supabase.rpc('reject_customer_order_request', { p_request_id: req.id });
      if (error) throw error;
    } catch (e: unknown) {
      console.error(e);
      alert((e as { message?: string })?.message || 'Não foi possível reprovar o pedido.');
    } finally {
      await load();
      await onDecidedRef.current();
      setDeciding(null);
    }
  }

  if (requests.length === 0) return null;

  return (
    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-purple-900 dark:text-purple-100 font-semibold">
          <Clock className="w-5 h-5" />
          Aguardando aprovação ({requests.length})
        </div>
        <p className="text-xs text-purple-800 dark:text-purple-300">
          Pedidos feitos pelos clientes no link próprio. Sem decisão em {AUTO_APPROVE_MINUTES} minutos, entram sozinhos na fila do operador.
        </p>
      </div>

      {requests.map((req) => {
        const elapsedMin = Math.floor((now - new Date(req.created_at).getTime()) / 60_000);
        const remainingMin = AUTO_APPROVE_MINUTES - elapsedMin;
        const busy = deciding === req.id;
        const items = Array.isArray(req.items) ? req.items : [];

        return (
          <div
            key={req.id}
            className="bg-white dark:bg-slate-800 rounded-xl border border-purple-200 dark:border-purple-800 shadow-sm p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
          >
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-gray-900 dark:text-white">{req.request_number}</span>
                <span className="text-xs px-2.5 py-1 rounded-full border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800 flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  Pedido pelo link
                </span>
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  há {elapsedMin < 1 ? 'menos de 1 min' : `${elapsedMin} min`}
                  {' · '}
                  {remainingMin > 0
                    ? `entra sozinho na fila em ~${remainingMin} min`
                    : 'entrando na fila...'}
                </span>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 mb-1 text-blue-900 dark:text-blue-100 font-semibold">
                  <User className="w-4 h-4" /> Cliente
                </div>
                <div className="text-blue-900 dark:text-blue-200 space-y-1">
                  <div><span className="font-semibold">Nome:</span> {req.customer_name}</div>
                  <div><span className="font-semibold">Telefone:</span> {formatPhone(req.customer_phone)}</div>
                  <div><span className="font-semibold">Endereço:</span> {req.customer_address || 'Não informado'}</div>
                </div>
              </div>

              {req.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1 text-amber-900 font-semibold">
                    <FileText className="w-4 h-4" /> Observação
                  </div>
                  <p className="text-amber-800 whitespace-pre-line">{req.notes}</p>
                </div>
              )}

              <div className="space-y-1.5">
                {items.map((item, index) => (
                  <div
                    key={`${item.product_id}-${index}`}
                    className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 px-3 py-2 rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-gray-800 dark:text-slate-200 truncate">
                        <span className="font-semibold">{item.quantity}x</span> {item.name}
                      </span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white shrink-0 ml-2">
                      {formatBRL(Number(item.quantity) * Number(item.unit_price))}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 pt-1 text-sm">
                  <span className="font-semibold text-gray-700 dark:text-slate-300">Total do pedido</span>
                  <span className="font-bold text-green-700 dark:text-green-400">{formatBRL(Number(req.total))}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-stretch shrink-0">
              <button
                onClick={() => approve(req)}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50"
                title="Aprovar: entra na fila do operador com caixa de hoje"
              >
                <CheckCircle2 className="w-4 h-4" />
                {busy ? 'Aguarde...' : 'Aprovar'}
              </button>
              <button
                onClick={() => reject(req)}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50"
                title="Reprovar: cancela e devolve o estoque"
              >
                <XCircle className="w-4 h-4" />
                Reprovar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
