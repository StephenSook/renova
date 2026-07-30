/**
 * Insurance-video capture: drive the REAL production app, record the screen.
 *
 * Runs headed, because WebGPU wants a real GPU. Uses a persistent profile so
 * the 2 GB model downloads once and every later run starts warm. Logs a beat
 * timeline (name + seconds from recording start) so the edit can cut scenes
 * from one continuous recording without guessing.
 *
 *   node scripts/capture-demo.mjs [--url=https://renova-offline.vercel.app]
 *
 * Output: shots/video/<timestamp>/  (webm + beats.json)
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readdir, rename } from 'node:fs/promises';
import { join } from 'node:path';

const flag = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const URL = flag('url', 'https://renova-offline.vercel.app');
const PROFILE = flag('profile', '/tmp/renova-video-profile');
const OUT = join('shots', 'video', new Date().toISOString().replace(/[:.]/g, '-'));

await mkdir(OUT, { recursive: true });

const context = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
});
const page = context.pages()[0] ?? (await context.newPage());

const t0 = Date.now();
const beats = [];
const beat = (name) => {
  const at = (Date.now() - t0) / 1000;
  beats.push({ name, at });
  console.log(`[beat] ${at.toFixed(1)}s  ${name}`);
};

const clickText = async (text, timeout = 30_000) => {
  await page.getByText(text, { exact: false }).first().click({ timeout });
};
const waitText = (text, timeout = 60_000) =>
  page.getByText(text, { exact: false }).first().waitFor({ timeout });
// The app remembers its language across results; headings must match either.
const waitProse = (timeout = 120_000) =>
  page.getByText(/What this letter says|Qué dice esta carta/i).first().waitFor({ timeout });

console.log(`[capture] ${URL} -> ${OUT}`);
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => document.fonts?.ready).catch(() => {});
await page.waitForTimeout(2500);
beat('landing-top');

// Scroll the story panels so the film opens with the argument, not a UI.
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => window.scrollBy({ top: window.innerHeight * 0.95, behavior: 'smooth' }));
  await page.waitForTimeout(2200);
}
beat('landing-panels-done');
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await page.waitForTimeout(1800);

// Model gate. Fresh profile: the download counter IS the hero shot. Warm
// profile: skip straight to the loaded state.
const alreadyCached = await page
  .getByText('Gemma 4 is on this device', { exact: false })
  .first()
  .isVisible()
  .catch(() => false);

if (!alreadyCached) {
  beat('download-start');
  await clickText('Put Gemma 4 on this device');
  // The counter runs to 100, then the gate flips to the cached state.
  await waitText('Gemma 4 is on this device', 600_000);
  beat('download-done');
  await page.waitForTimeout(2000);
}
beat('model-on-device');
await clickText('Read my packet');
await page.waitForTimeout(1200);
beat('capture-screen');

// Wait for the engine to actually be warm before the sample run so the film
// shows live generation, not the cached path.
await waitText('Gemma 4 is loaded on this device', 240_000);
beat('engine-warm');

try {
  // NY sample: the whole product story in one run.
  await clickText('New York: the form and the notice');
  beat('ny-sample-clicked');
  await waitProse();
  beat('ny-result-live-prose');
  await page.waitForTimeout(2500);

  // Spanish, the reader this was built for, then back so later scenes and
  // selectors run in English.
  await clickText('Español');
  await page.waitForTimeout(3000);
  beat('ny-result-spanish');
  await clickText('English');
  await page.waitForTimeout(1500);

  // Back, then the adversarial page: the safety kicker.
  await clickText('Read another packet');
  await page.waitForTimeout(1200);
  await clickText('A page that tries to trick');
  beat('adversarial-clicked');
  await waitProse();
  beat('adversarial-result');
  await page.waitForTimeout(2500);

  // The proof surface.
  await clickText('How this stays honest');
  beat('verify-screen');
  await page.waitForTimeout(3500);
  await page.evaluate(() => window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' }));
  await page.waitForTimeout(3000);
  beat('verify-scrolled');
  await page.waitForTimeout(1500);
  beat('end');
} finally {
  // Always finalize, or the webm ships without its duration header.
  await context.close();
}

// Playwright names the webm opaquely; give it a stable name next to the beats.
const files = await readdir(OUT);
const webm = files.find((f) => f.endsWith('.webm'));
if (webm) await rename(join(OUT, webm), join(OUT, 'capture.webm'));
await writeFile(join(OUT, 'beats.json'), JSON.stringify({ url: URL, beats }, null, 2));
console.log(`[capture] done: ${OUT}/capture.webm + beats.json`);
