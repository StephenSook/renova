/**
 * Screenshot harness.
 *
 * Two jobs:
 *   1. Study a reference site by scrolling it and capturing each viewport, so
 *      its motion and layout vocabulary can be read rather than guessed at.
 *   2. Verify our own deployed pages against the production URL, because a
 *      screenshot of localhost proves nothing about what a judge will see.
 *
 * Run it directly rather than through the Playwright MCP. The MCP times out on
 * font-heavy pages; a direct script with an explicit font wait does not.
 *
 *   node scripts/shot.mjs <url> [outDir] [--scrolls=N] [--full] [--wait=ms]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};

const url = positional[0];
if (!url) {
  console.error('usage: node scripts/shot.mjs <url> [outDir] [--scrolls=N] [--full] [--wait=ms]');
  process.exit(1);
}
const outDir = positional[1] ?? 'shots';
const scrolls = Number(flag('scrolls', 0));
const settle = Number(flag('wait', 2500));
const fullPage = args.includes('--full');

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60);

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1512, height: 900 },
  deviceScaleFactor: 2,
  // Reference sites gate animations on real user agents often enough to matter.
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
});
const page = await context.newPage();

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

console.log(`[shot] ${url}`);
// Never wait for networkidle. A WebGL or analytics-heavy site streams requests
// forever and the wait simply expires.
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 }).catch((e) => {
  console.warn(`[shot] goto slow, continuing: ${e.message}`);
});

// Fonts, not the load event, are what make a screenshot look finished.
await page.evaluate(() => document.fonts?.ready).catch(() => {});
await page.waitForTimeout(settle);

const base = join(outDir, slug(new URL(url).host + new URL(url).pathname));

/**
 * Screenshot a page that may never go still.
 *
 * page.screenshot() waits for visual stability, which never arrives on a site
 * running a continuous WebGL render loop, so it hangs until it times out. The
 * CDP command captures whatever is on screen right now and returns immediately,
 * which is exactly what studying an animated site needs.
 */
const cdp = await context.newCDPSession(page);
const shoot = async (path) => {
  try {
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: fullPage,
    });
    await writeFile(path, Buffer.from(data, 'base64'));
    console.log(`[shot] ${path}`);
  } catch (e) {
    console.warn(`[shot] FAILED ${path}: ${e.message.split('\n')[0]}`);
  }
};

await shoot(`${base}-00-top.png`);

for (let i = 1; i <= scrolls; i++) {
  await page.evaluate(() => window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' }));
  // Scroll-driven sites animate in after the scroll settles, so wait for the
  // animation rather than the scroll.
  await page.waitForTimeout(settle);
  await shoot(`${base}-${String(i).padStart(2, '0')}-scroll.png`);
}

const meta = await page.evaluate(() => {
  const cs = getComputedStyle(document.body);
  const seen = new Map();
  for (const el of Array.from(document.querySelectorAll('h1,h2,h3,p,a,button,span')).slice(0, 400)) {
    const s = getComputedStyle(el);
    const key = `${s.fontFamily}|${s.fontSize}|${s.fontWeight}|${s.letterSpacing}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return {
    title: document.title,
    scrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    bodyBackground: cs.backgroundColor,
    bodyColor: cs.color,
    bodyFont: cs.fontFamily,
    canvases: document.querySelectorAll('canvas').length,
    typeScale: [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
  };
});

console.log('[shot] page metadata:\n' + JSON.stringify(meta, null, 1));
if (errors.length) console.log(`[shot] ${errors.length} console errors, first: ${errors[0]}`);

await browser.close();
