import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Shadow Matrix — frontend dev server.
// The browser must never talk to the FastAPI backend directly; every
// `/api/*` request is proxied from this dev server so the app works
// unchanged behind any preview/CDN host.
export default defineConfig(() => {
  const backendTarget = process.env.BACKEND_URL ?? 'http://127.0.0.1:8000';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      // Preview hosts are generated per sandbox; allow them all.
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
