import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Serve the self-hosted onnxruntime runtime in dev without Vite touching it.
 *
 * onnxruntime-web dynamically imports its own wasm glue at runtime. Those files
 * live in public/ so the production build copies them as-is, and production is
 * fine because nothing transforms public/. The dev server is the problem: it
 * sees a module import for a path under public/ and refuses it outright
 * ("should not be imported from source code. It can only be referenced via HTML
 * tags"), returning a 500 that surfaces as "no available backend found".
 *
 * This middleware answers /ort/* from disk before Vite's transform pipeline
 * sees it, which makes dev behave the way the built site already does.
 *
 * Self-hosting is not optional here. Left at its default, onnxruntime-web
 * fetches its runtime from cdn.jsdelivr.net, which breaks offline start and puts
 * a third-party request in the Network tab of a page that promises none.
 */
function serveOrtRuntime(): Plugin {
  const types: Record<string, string> = {
    '.mjs': 'text/javascript',
    '.js': 'text/javascript',
    '.wasm': 'application/wasm',
  };

  return {
    name: 'renova:serve-ort-runtime',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (!url.startsWith('/ort/')) return next();

        const file = join(server.config.publicDir, url.replace(/^\//, ''));
        if (!existsSync(file)) return next();

        const ext = url.slice(url.lastIndexOf('.'));
        res.setHeader('Content-Type', types[ext] ?? 'application/octet-stream');
        res.setHeader('Content-Length', String(statSync(file).size));
        createReadStream(file).pipe(res);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), serveOrtRuntime()],
  // The LiteRT-LM and onnxruntime wasm ship as prebuilt binaries in public/ and
  // must not be touched by the bundler.
  assetsInclude: ['**/*.wasm'],
  server: {
    fs: { allow: ['..'] },
  },
  build: {
    // The 2 GB model is never bundled; only our own code is.
    chunkSizeWarningLimit: 1500,
  },
  optimizeDeps: {
    // Keep the runtime's own dynamic imports literal rather than pre-bundled,
    // so they resolve to the self-hosted files.
    exclude: ['onnxruntime-web', 'ppu-paddle-ocr', 'ppu-ocv'],
  },
})
