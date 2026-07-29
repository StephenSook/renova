/**
 * Copies the LiteRT-LM wasm runtime out of node_modules and into public/ so the
 * app self-hosts it.
 *
 * This matters for correctness, not convenience. loadLiteRtLm() feature-detects
 * the browser and fetches one of four wasm variants from whatever path it is
 * given. If we let it default, the page makes a runtime request to a CDN, the
 * app cannot start in airplane mode, and a judge watching the Network tab sees
 * traffic while we claim nothing leaves the device.
 *
 * The files are ~102 MB total, so they are gitignored and regenerated here on
 * every install and build rather than committed.
 */
import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', '@litert-lm', 'core', 'wasm');
const dest = join(root, 'public', 'litertlm-wasm');

if (!existsSync(src)) {
  console.error(`[copy-wasm] missing ${src}. Run npm install first.`);
  process.exit(1);
}

await mkdir(dest, { recursive: true });
await cp(src, dest, { recursive: true });

const files = await readdir(dest);
let total = 0;
for (const f of files) total += (await stat(join(dest, f))).size;

console.log(
  `[copy-wasm] ${files.length} files, ${(total / 1024 / 1024).toFixed(1)} MB -> public/litertlm-wasm/`,
);

/*
 * onnxruntime-web has the same problem and it is easier to miss, because it is a
 * transitive dependency nobody configured. Left alone it fetches its wasm from
 * cdn.jsdelivr.net at runtime, which was caught by the app's own verification
 * screen showing an external host on a page that promises none.
 *
 * Only the variants the browser can actually select are copied. The full dist is
 * 128 MB and most of it is builds for capabilities we never use.
 */
const ortSrc = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const ortDest = join(root, 'public', 'ort');

if (existsSync(ortSrc)) {
  await mkdir(ortDest, { recursive: true });
  const wanted = [
    // WebGPU / JSEP path, which is what this app takes when WebGPU is present.
    'ort-wasm-simd-threaded.jsep.mjs',
    'ort-wasm-simd-threaded.jsep.wasm',
    // Plain SIMD threaded, the wasm fallback when WebGPU is unavailable. That
    // fallback is the whole reason the deterministic path still works without a
    // GPU, so it has to be self-hosted too.
    'ort-wasm-simd-threaded.mjs',
    'ort-wasm-simd-threaded.wasm',
  ];

  let ortTotal = 0;
  for (const name of wanted) {
    const from = join(ortSrc, name);
    if (!existsSync(from)) {
      console.error(`[copy-wasm] missing ${name} in onnxruntime-web/dist`);
      process.exit(1);
    }
    await cp(from, join(ortDest, name));
    ortTotal += (await stat(from)).size;
  }

  console.log(
    `[copy-wasm] ${wanted.length} files, ${(ortTotal / 1024 / 1024).toFixed(1)} MB -> public/ort/`,
  );
}
