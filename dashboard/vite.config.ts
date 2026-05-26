import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { platformApiPlugin } from './vite-plugin-platform-api.mjs';

export default defineConfig({
  plugins: [react(), platformApiPlugin()],
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    fs: { allow: ['..'] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
