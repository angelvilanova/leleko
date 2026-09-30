/**
 * Sessão do cliente na loja, guardada só no navegador dele.
 * O token corresponde a uma linha em customer_sessions; o banco valida e
 * renova o prazo a cada uso.
 */
const KEY = 'leleko-store-session';

export function getStoreSession(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setStoreSession(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // navegador sem armazenamento: a sessão dura só enquanto a aba estiver aberta
  }
}

export function clearStoreSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nada a fazer
  }
}

/** Mensagens de erro vindas do banco já são amigáveis; as demais viram texto genérico. */
export function friendlyError(e: unknown, fallback: string): string {
  const message = (e as { message?: string })?.message;
  if (message && /[áéíóúãõçÁÉÍÓÚ]|celular|sess|estoque|pedido|item|cliente/i.test(message)) {
    return message;
  }
  return fallback;
}

export function isSessionExpired(e: unknown): boolean {
  const message = (e as { message?: string })?.message || '';
  return /sess[ãa]o expirada/i.test(message);
}

export function formatPhoneBR(phone?: string | null): string {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

export function formatBRL(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
