import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { friendlyError } from '../../lib/storeSession';
import { storeDisplayName, useStoreSettings } from '../../lib/storeSettings';
import { ShoppingBag, Smartphone, Loader2, AlertCircle, ArrowRight } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-sm shadow-blue-600/30">
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{storeName}</h1>
          <p className="text-slate-600 mt-1">Faça seu pedido online</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Seu celular</label>
            <div className="relative">
              <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
                className="w-full pl-9 pr-3 py-3 border border-slate-300 rounded-xl text-slate-900 text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">Use o mesmo número cadastrado na loja.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
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
      </div>
    </div>
  );
}
