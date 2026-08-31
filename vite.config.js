import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'project/editor',
  base: '/Boop-mascotte/',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        editor: resolve(import.meta.dirname, 'project/editor/index.html'),
        demo: resolve(import.meta.dirname, 'project/editor/demo/index.html')
      }
    }
  }
});
