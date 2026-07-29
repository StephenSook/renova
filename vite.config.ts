import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The LiteRT-LM wasm ships as prebuilt binaries in public/litertlm-wasm/ and
  // must not be touched by the bundler.
  assetsInclude: ['**/*.wasm'],
  server: {
    // Large model reads from OPFS plus wasm streaming are happier without the
    // dev server trying to be clever about these.
    fs: { allow: ['..'] },
  },
  build: {
    // The 2 GB model is never bundled; only our own code is.
    chunkSizeWarningLimit: 1500,
  },
})
