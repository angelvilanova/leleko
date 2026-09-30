import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/storeSession';
import { storeDisplayName, useStoreSettings } from '../../lib/storeSettings';
import { BrandMark, Card, fieldClass, primaryButton } from './ui';
import { Smartphone, Loader2, AlertCircle, ArrowRight, Truck, Clock, ShieldCheck } from 'lucide-react';

function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Entrada da loja. BETA: só o celular cadastrado no painel.
 * Quando houver código de acesso, entra um segundo campo aqui e a checagem
 * na função store_login do banco.
 */
export function StoreLogin({ onLoggedIn }: { onLoggedIn: (token: string) => void }) {
  const settings = useStoreSettings();
  const storeName = storeDisplayName(settings);

  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = phone.replace(/\D/g, '');
  const canSubmit = digits.length >= 10 && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('store_login', { p_phone: digits });
      if (rpcError) throw rpcError;

      const row = Array.isArray(data) ? data[0] : data;
      const token: string | undefined = row?.session_token;
      if (!token) throw new Error('Não foi possível entrar. Tente novamente.');

      onLoggedIn(token);
    } catch (err) {
      console.error(err);
      setError(friendlyError(err, 'Não foi possível entrar. Tente novamente.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white">
        <div className="max-w-md mx-auto px-6 pt-14 pb-20 text-center">
          <div className="flex justify-center mb-5">
            <BrandMark size="lg" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{storeName}</h1>
          <p className="text-emerald-100 mt-2">Peça online e receba em casa</p>
        </div>
      </div>

      <div className="max-w-md mx-auto w-full px-6 -mt-12 pb-10 flex-1">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">Entrar</h2>
          <p className="text-sm text-slate-500 mt-1">Use o celular cadastrado na loja.</p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Seu celular</label>
              <div className="relative">
                <Smartphone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => {
                    setError(null);
                    setPhone(maskPhone(e.target.value));
                  }}
                  placeholder="(71) 99999-9999"
                  className={`${fieldClass} pl-10 py-3 text-lg tracking-wide`}
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 ring-1 ring-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={!canSubmit} className={`${primaryButton} w-full py-3.5`}>
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </Card>

        <div className="grid grid-cols-3 gap-3 mt-6 text-center">
          {[
            { icon: Truck, label: 'Entrega em casa' },
            { icon: Clock, label: 'Pedido em minutos' },
            { icon: ShieldCheck, label: 'Preços da loja' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <span className="w-10 h-10 rounded-xl bg-white ring-1 ring-slate-200/70 shadow-sm flex items-center justify-center text-emerald-600">
                <Icon className="w-5 h-5" />
              </span>
              <span className="text-xs text-slate-500 leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
