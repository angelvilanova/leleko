import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { StoreCatalog, type RepeatItem } from './StoreCatalog';
import { StoreOrders } from './StoreOrders';
import { StoreProfile } from './StoreProfile';
import { isSessionExpired } from '../../lib/storeSession';
import { storeDisplayName, useStoreSettings } from '../../lib/storeSettings';
import { ShoppingBag, Store, ClipboardList, User, LogOut, Loader2 } from 'lucide-react';

export type StoreCustomer = {
  id: string;
  name: string;
  phone: string;
  address: string;
};

type Tab = 'loja' | 'pedidos' | 'dados';

export function StoreShell({ session, onLogout }: { session: string; onLogout: () => void }) {
  const [customer, setCustomer] = useState<StoreCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('loja');
  const [repeatItems, setRepeatItems] = useState<RepeatItem[] | null>(null);

  const settings = useStoreSettings();
  const storeName = storeDisplayName(settings);

  useEffect(() => {
    document.title = storeName;
  }, [storeName]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data, error } = await supabase.rpc('store_me', { p_session: session });
        if (error) throw error;

        const row = Array.isArray(data) ? data[0] : data;
        if (!row) throw new Error('Sessão expirada. Entre novamente.');

        if (!cancelled) setCustomer(row as StoreCustomer);
      } catch (e) {
        console.error(e);
        if (isSessionExpired(e) || (e as { message?: string })?.message?.includes('Sessão')) {
          onLogout();
          return;
        }
        if (!cancelled) setLoadError('Não foi possível carregar seus dados. Tente novamente.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function logout() {
    try {
      await supabase.rpc('store_logout', { p_session: session });
    } catch (e) {
      console.warn(e);
    } finally {
      onLogout();
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-500">Entrando na loja...</p>
        </div>
      </div>
    );
  }

  if (loadError || !customer) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <p className="text-slate-700">{loadError || 'Algo deu errado.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition"
          >
            Tentar novamente
          </button>
          <button onClick={logout} className="mt-3 block mx-auto text-sm text-slate-500 hover:underline">
            Sair
          </button>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Store }[] = [
    { id: 'loja', label: 'Loja', icon: Store },
    { id: 'pedidos', label: 'Meus pedidos', icon: ClipboardList },
    { id: 'dados', label: 'Meus dados', icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-8">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 leading-tight">{storeName}</h1>
              <p className="text-[11px] text-slate-500 leading-tight truncate">Olá, {customer.name}</p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                  tab === id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-slate-500 hover:text-red-600 transition shrink-0"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden sm:inline text-sm font-medium">Sair</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {tab === 'loja' && (
          <StoreCatalog
            session={session}
            customer={customer}
            repeatItems={repeatItems}
            onRepeatConsumed={() => setRepeatItems(null)}
            onViewOrders={() => setTab('pedidos')}
            onSessionExpired={onLogout}
          />
        )}
        {tab === 'pedidos' && (
          <StoreOrders
            session={session}
            onRepeat={(items) => {
              setRepeatItems(items);
              setTab('loja');
              window.scrollTo({ top: 0 });
            }}
            onSessionExpired={onLogout}
          />
        )}
        {tab === 'dados' && <StoreProfile customer={customer} onLogout={logout} />}
      </main>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-20">
        <div className="grid grid-cols-3">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`py-2.5 flex flex-col items-center gap-0.5 text-[11px] font-medium transition ${
                tab === id ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
