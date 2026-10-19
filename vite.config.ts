import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const api = 'http://localhost:3000';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: '../dist/web', emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: {
    port: 5173,
    proxy: {
      '/api': api,
      '/media': api,
      '/favicon.ico': api,
      '/ws': { target: api, ws: true },
    },
  },
});
