/**
 * Superfície da aplicação.
 *
 * O mesmo código é publicado em dois endereços da Vercel:
 *   - painel  (equipe): VITE_APP_SURFACE ausente ou 'panel'
 *   - cliente (link próprio): VITE_APP_SURFACE = 'customer'
 *
 * Cada endereço monta apenas a sua parte. No endereço do cliente a tela de
 * login nunca é carregada.
 */
export type AppSurface = 'panel' | 'customer';

export const APP_SURFACE: AppSurface =
  import.meta.env.VITE_APP_SURFACE === 'customer' ? 'customer' : 'panel';

const DEFAULT_CUSTOMER_APP_URL = 'https://paulo-pedidos.vercel.app';

export const CUSTOMER_APP_URL: string = (
  (import.meta.env.VITE_CUSTOMER_APP_URL as string | undefined) || DEFAULT_CUSTOMER_APP_URL
).replace(/\/+$/, '');

export function customerOrderLink(linkToken: string): string {
  return `${CUSTOMER_APP_URL}/pedido/${linkToken}`;
}
