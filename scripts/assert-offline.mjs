/**
 * The offline claim, tested rather than asserted.
 *
 * Serves the production build, loads it in a real browser, drives OCR on a demo
 * packet, and fails if the page contacted any host other than its own origin.
 *
 * This replaces an earlier CI check that grepped the bundle for CDN URLs. That
 * check failed on its first run and was right to, but for the wrong reason: both
 * `@litert-lm/core` and `onnxruntime-web` carry their CDN defaults as string
 * constants, and we override both at runtime. A grep cannot tell a dead default
 * from a live fetch. This can.
 *
 * What it does NOT cover: the model download itself, which is a real request to
 * Hugging Face and is the one external request this product makes. It is not
 * triggered here because headless Chromium has no WebGPU, which is also why the
 * deterministic path is what gets exercised. That path is the one that must work
 * for every reader regardless of hardware, so it is the right thing to gate on.
 *
 *   node scripts/assert-offline.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

if (!existsSync(root)) {
  console.error('[offline] dist/ not found. Run npm run build first.');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.onnx': 'application/octet-stream',
  '.txt': 'text/plain',
};

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  // Contain path traversal; this serves a build directory in CI, not the disk.
  const safe = normalize(url).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, safe);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');

  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(res);
});

await new Promise((resolve) => server.listen(0, resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
console.log(`[offline] serving dist at ${origin}`);

const browser = await chromium.launch();
const page = await browser.newPage();

const external = [];
page.on('request', (req) => {
  const url = req.url();
  if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return;
  external.push(url);
});

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

await page.goto(origin, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

// Drive the deterministic path so the OCR runtime actually initialises. If
// onnxruntime were still pointed at a CDN, this is where it would reach for it.
await page
  .getByRole('button', { name: /Read my packet/i })
  .first()
  .click()
  .catch(() => {});
await page.waitForTimeout(800);

const input = await page.$('input[type=file][accept^="image"]:not([capture])');
if (input) {
  await input.setInputFiles(join(root, 'demo', 'ny-02-notice.png'));
  // OCR session creation plus a page read. Generous, because CI runners are slow.
  await page.waitForTimeout(45_000);
}

const body = await page.innerText('body').catch(() => '');
await browser.close();
server.close();

console.log(`[offline] external requests: ${external.length}`);
for (const url of external) console.log(`  ${url}`);
if (pageErrors.length) {
  console.log(`[offline] page errors: ${pageErrors.length}`);
  for (const e of pageErrors.slice(0, 5)) console.log(`  ${e}`);
}

if (external.length > 0) {
  console.error(
    '\n[offline] FAIL. The page contacted another host. The offline claim is false.',
  );
  process.exit(1);
}

// A page that renders nothing also makes no requests, so prove it did the work.
if (!/deadline/i.test(body)) {
  console.error('\n[offline] FAIL. Zero external requests, but the app produced no result.');
  console.error(body.slice(0, 400));
  process.exit(1);
}

console.log('\n[offline] PASS. Zero external requests, and the deterministic path produced a result.');
