import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-only: force a full browser reload (hard refresh) on every edit instead of
// HMR patching. Avoids the "I changed the CSS but the browser still shows the
// old colors" trap where stale module/css cache hides the new styles.
function fullReloadOnChange(): PluginOption {
  return {
    name: 'full-reload-on-change',
    apply: 'serve',
    handleHotUpdate({ file, server }) {
      if (/\.(css|tsx?|jsx?|html)$/.test(file)) {
        server.ws.send({ type: 'full-reload', path: '*' });
        return [];
      }
      return undefined;
    }
  };
}

export default defineConfig({
  plugins: [react(), fullReloadOnChange()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/auth': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin.html'
      }
    }
  }
});
