import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * O index.html é compartilhado pelo painel e pelo portal do cliente e não
 * muda. No build do portal (VITE_APP_SURFACE=customer), este plugin troca só
 * o título inicial da aba por um texto neutro; o nome configurado da loja
 * substitui em seguida, quando a página carrega. O build do painel passa por
 * aqui sem nenhuma alteração.
 */
function storeTitle(): Plugin {
  return {
    name: 'store-title',
    transformIndexHtml(html) {
      if (process.env.VITE_APP_SURFACE !== 'customer') return html;
      return html.replace(/<title>[^<]*<\/title>/, '<title>Loja online</title>');
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), storeTitle()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
