import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  devToolbar: { enabled: false },
  build: {
    assets: '_assets',
    format: 'file',
  },
  vite: {
    build: {
      // Three.js is an optional, lazy-loaded scene runtime. The stricter
      // per-file and aggregate limits live in check-performance-budgets.mjs.
      chunkSizeWarningLimit: 768,
    },
  },
});
