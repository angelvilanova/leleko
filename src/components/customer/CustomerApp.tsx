import { useEffect, useState } from 'react';
import { StoreLogin } from './StoreLogin';
import { StoreShell } from './StoreShell';
import { clearStoreSession, getStoreSession, setStoreSession } from '../../lib/storeSession';
import { DEFAULT_STORE_NAME } from '../../lib/storeSettings';

/**
 * Raiz do endereço dos clientes (loja). Não monta AuthProvider, ThemeProvider
 * nem qualquer tela da equipe.
 *
 * Sem sessão: tela de entrada pelo celular. Com sessão: a loja.
 */
export function CustomerApp() {
  const [session, setSession] = useState<string | null>(getStoreSession);

  // Título neutro até as configurações da loja carregarem; o nome configurado
  // substitui assim que a loja abre.
  useEffect(() => {
    document.title = DEFAULT_STORE_NAME;
  }, []);

  if (!session) {
    return (
      <StoreLogin
        onLoggedIn={(token) => {
          setStoreSession(token);
          setSession(token);
        }}
      />
    );
  }

  return (
    <StoreShell
      session={session}
      onLogout={() => {
        clearStoreSession();
        setSession(null);
      }}
    />
  );
}
