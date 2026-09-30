/**
 * Superfície da aplicação.
 *
 * O mesmo código é publicado em dois endereços da Vercel:
 *   - painel  (equipe): VITE_APP_SURFACE ausente ou 'panel'
 *   - loja    (clientes): VITE_APP_SURFACE = 'customer'
 *
 * Cada endereço monta apenas a sua parte. No endereço da loja a tela de
 * login da equipe nunca é carregada. O painel não muda em nada quando a
 * variável está ausente.
 */
export type AppSurface = 'panel' | 'customer';

export const APP_SURFACE: AppSurface =
  import.meta.env.VITE_APP_SURFACE === 'customer' ? 'customer' : 'panel';

const DEFAULT_STORE_URL = 'https://paulo-pedidos.vercel.app';

/** Endereço público da loja dos clientes. */
export const STORE_URL: string = (
  (import.meta.env.VITE_CUSTOMER_APP_URL as string | undefined) || DEFAULT_STORE_URL
).replace(/\/+$/, '');
