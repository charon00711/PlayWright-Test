import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { platformApiPlugin } from './vite-plugin-platform-api.mjs';

const BUILD_TIME_BASE_URL =
  process.env.VITE_BASE_URL ??
  process.env.BASE_URL ??
  '';

export default defineConfig({
  // VITE_BASE_PATH can override for GitHub Pages sub-path; Cloudflare Pages uses '/'
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), platformApiPlugin()],
  root: '.',
  publicDir: 'public',
  define: {
    'import.meta.env.VITE_BASE_URL': JSON.stringify(BUILD_TIME_BASE_URL),
  },
  server: {
    port: 5173,
    fs: { allow: ['..'] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
