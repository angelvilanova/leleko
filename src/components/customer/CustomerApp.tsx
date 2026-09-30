import { useState } from 'react';
import { CustomerOrderPage } from './CustomerOrderPage';
import { CustomerLanding } from './CustomerLanding';

const TOKEN_PATH = /^\/pedido\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

function readTokenFromLocation(): string | null {
  const match = window.location.pathname.match(TOKEN_PATH);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Raiz do endereço dos clientes. Não monta AuthProvider, ThemeProvider nem
 * qualquer tela da equipe. Só /pedido/<código> abre a página de pedido; o
 * resto cai numa página neutra.
 */
export function CustomerApp() {
  const [token] = useState<string | null>(readTokenFromLocation);

  if (!token) {
    return <CustomerLanding />;
  }

  return <CustomerOrderPage token={token} />;
}
