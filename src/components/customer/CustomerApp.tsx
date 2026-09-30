import { useState } from 'react';
import { CustomerOrderPage } from './CustomerOrderPage';
import { CustomerLanding } from './CustomerLanding';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readTokenFromLocation(): string | null {
  const raw = new URLSearchParams(window.location.search).get('c');
  if (!raw) return null;
  const token = raw.trim().toLowerCase();
  return UUID.test(token) ? token : null;
}

/**
 * Raiz do endereço dos clientes. Não monta AuthProvider, ThemeProvider nem
 * qualquer tela da equipe. Só ?c=<código> abre a página de pedido; o resto
 * cai numa página neutra.
 */
export function CustomerApp() {
  const [token] = useState<string | null>(readTokenFromLocation);

  if (!token) {
    return <CustomerLanding />;
  }

  return <CustomerOrderPage token={token} />;
}
