import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Configurações públicas do portal do cliente, lidas da tabela store_settings
 * pela função store_public_settings. O portal não tem nome fixo: usa o que
 * estiver configurado, ou "Loja online" enquanto estiver vazio.
 */
export type StoreSettings = {
  store_name: string;
  pix_key: string;
  pix_receiver: string;
  pix_instructions: string;
  whatsapp: string;
};

export const DEFAULT_STORE_NAME = 'Loja online';

export const EMPTY_SETTINGS: StoreSettings = {
  store_name: '',
  pix_key: '',
  pix_receiver: '',
  pix_instructions: '',
  whatsapp: '',
};

let cached: StoreSettings | null = null;
let pending: Promise<StoreSettings> | null = null;

export async function fetchStoreSettings(): Promise<StoreSettings> {
  if (cached) return cached;
  if (pending) return pending;

  pending = (async () => {
    try {
      const { data, error } = await supabase.rpc('store_public_settings');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      cached = { ...EMPTY_SETTINGS, ...((row || {}) as Partial<StoreSettings>) };
      return cached;
    } catch (e) {
      console.warn('store_public_settings:', (e as { message?: string })?.message);
      return EMPTY_SETTINGS;
    } finally {
      pending = null;
    }
  })();

  return pending;
}

export function storeDisplayName(settings: StoreSettings): string {
  return settings.store_name.trim() || DEFAULT_STORE_NAME;
}

/** Carrega as configurações uma vez por sessão do navegador e compartilha entre telas. */
export function useStoreSettings(): StoreSettings {
  const [settings, setSettings] = useState<StoreSettings>(cached || EMPTY_SETTINGS);

  useEffect(() => {
    let active = true;
    fetchStoreSettings().then((s) => {
      if (active) setSettings(s);
    });
    return () => {
      active = false;
    };
  }, []);

  return settings;
}
