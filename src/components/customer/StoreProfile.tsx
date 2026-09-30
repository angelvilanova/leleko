import type { StoreCustomer } from './StoreShell';
import { formatPhoneBR } from '../../lib/storeSession';
import { User, Smartphone, MapPin, LogOut, Info } from 'lucide-react';

/** Dados do cliente como estão no painel, só leitura. */
export function StoreProfile({ customer, onLogout }: { customer: StoreCustomer; onLogout: () => void }) {
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
        <User className="w-5 h-5 text-blue-600" />
        Meus dados
      </h2>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        <div className="px-5 py-4">
          <p className="text-xs text-slate-500">Nome</p>
          <p className="text-slate-900 font-medium mt-0.5">{customer.name}</p>
        </div>
        <div className="px-5 py-4 flex items-start gap-3">
          <Smartphone className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
          <div>
            <p className="text-xs text-slate-500">Celular</p>
            <p className="text-slate-900 font-medium mt-0.5">{formatPhoneBR(customer.phone) || 'Não informado'}</p>
          </div>
        </div>
        <div className="px-5 py-4 flex items-start gap-3">
          <MapPin className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
          <div>
            <p className="text-xs text-slate-500">Endereço de entrega</p>
            <p className="text-slate-900 font-medium mt-0.5">{customer.address || 'Não informado'}</p>
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-600 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />
        <span>Para alterar seus dados, fale com a loja. Você também pode avisar mudanças na observação do pedido.</span>
      </p>

      <button
        onClick={onLogout}
        className="w-full border border-slate-300 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 transition flex items-center justify-center gap-2"
      >
        <LogOut className="w-5 h-5" />
        Sair da loja
      </button>
    </div>
  );
}
