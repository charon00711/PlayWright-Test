import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { platformApiPlugin } from './vite-plugin-platform-api.mjs';

export default defineConfig({
  // VITE_BASE_PATH can override for GitHub Pages sub-path; Cloudflare Pages uses '/'
  base: process.env.VITE_BASE_PATH ?? '/',
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
