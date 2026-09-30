import type { StoreCustomer } from './StoreShell';
import { formatPhoneBR } from '../../lib/storeSession';
import { Card, initials, secondaryButton, tileClass } from './ui';
import { Smartphone, MapPin, LogOut, Info } from 'lucide-react';

/** Dados do cliente como estão no painel, só leitura. */
export function StoreProfile({ customer, onLogout }: { customer: StoreCustomer; onLogout: () => void }) {
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-emerald-600 to-teal-600" />
        <div className="px-5 pb-5">
          <div className={`w-20 h-20 rounded-2xl ring-4 ring-white -mt-10 flex items-center justify-center text-2xl font-bold shadow-md ${tileClass(customer.name)}`}>
            {initials(customer.name)}
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-3">{customer.name}</h2>
          <p className="text-sm text-slate-500">Cliente cadastrado</p>
        </div>

        <div className="border-t border-slate-100 divide-y divide-slate-100">
          <div className="px-5 py-4 flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </span>
            <div>
              <p className="text-xs text-slate-500">Celular</p>
              <p className="text-slate-900 font-medium mt-0.5">{formatPhoneBR(customer.phone) || 'Não informado'}</p>
            </div>
          </div>
          <div className="px-5 py-4 flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </span>
            <div>
              <p className="text-xs text-slate-500">Endereço de entrega</p>
              <p className="text-slate-900 font-medium mt-0.5">{customer.address || 'Não informado'}</p>
            </div>
          </div>
        </div>
      </Card>

      <p className="text-sm text-slate-600 bg-sky-50 ring-1 ring-sky-200 rounded-xl px-4 py-3 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 text-sky-600 shrink-0" />
        <span>Para alterar seus dados, fale com a loja. Você também pode avisar mudanças na observação do pedido.</span>
      </p>

      <button onClick={onLogout} className={`${secondaryButton} w-full py-3 text-slate-700`}>
        <LogOut className="w-5 h-5" />
        Sair da loja
      </button>
    </div>
  );
}
