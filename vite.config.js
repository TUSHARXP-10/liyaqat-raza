import { defineConfig } from 'vite';

export default defineConfig({
  // relative asset paths so the built site works from any folder or sub-path
  base: './',
  build: {
    target: 'es2022',
    // three.js is intentionally bundled whole; the warning is expected
    chunkSizeWarningLimit: 1200,
  },
});
