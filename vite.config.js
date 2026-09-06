import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const DEMO_ASSET = /\/demo\/(mascot\.svg|rig\.json|runtime\.js)$/;

/**
 * The runtime demo loads `mascot.svg`, `rig.json` and `runtime.js` from its own
 * folder the way a web page would. Those three files are what Export writes
 * for the untouched face template, so they are produced from the template and
 * the runtime sources at build time (`scripts/demo-assets.mjs`) rather than
 * checked in — the demo cannot fall behind either.
 */
function demoAssets() {
  const create = async () => (await import(new URL('./scripts/demo-assets.mjs', import.meta.url).href)).createDemoAssets();
  return {
    name: 'boop-demo-assets',
    async generateBundle() {
      for (const { name, source } of await create()) this.emitFile({ type: 'asset', fileName: `demo/${name}`, source });
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const match = DEMO_ASSET.exec(new URL(request.url, 'http://localhost').pathname);
        if (!match) return next();
        const asset = (await create()).find((item) => item.name === match[1]);
        response.setHeader('Content-Type', `${asset.type}; charset=utf-8`);
        response.end(asset.source);
      });
    }
  };
}

export default defineConfig({
  root: 'project/editor',
  base: '/Boop-mascotte/',
  plugins: [demoAssets()],
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
