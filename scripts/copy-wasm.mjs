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
