import { ShoppingBag } from 'lucide-react';

/**
 * Página neutra do endereço dos clientes. Aparece na raiz, em links inválidos
 * ou expirados. Não contém nenhum link nem menção ao painel da equipe.
 */
export function CustomerLanding({ invalid = false }: { invalid?: boolean }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-5 shadow-sm shadow-blue-600/30">
          <ShoppingBag className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Leleko</h1>
        <p className="text-slate-600 mt-3 leading-relaxed">
          {invalid
            ? 'Este link não é válido. Peça um novo link para quem te atende.'
            : 'Para fazer seu pedido, use o link que você recebeu no WhatsApp.'}
        </p>
      </div>
    </div>
  );
}
