/**
 * Vendors the two typefaces into public/fonts/ so the app never touches a CDN.
 *
 * A Google Fonts <link> would be a request to fonts.googleapis.com on every
 * page load. That breaks offline start, and it puts a third-party request in the
 * Network tab of a page telling the reader nothing leaves their device. Fonts
 * are also a fingerprinting surface, which is the wrong thing to hand a product
 * used by people who are afraid of leaving a data trail.
 *
 * Public Sans is the U.S. Web Design System's own typeface. Using it on the tool
 * surface is not a neutral pick: it is what federal benefits material is set in,
 * which is exactly the register a renewal explainer should speak in.
 *
 * Bricolage Grotesque carries the landing. It is a variable grotesque with more
 * warmth and more voice than a neutral one, which is what the dark surface needs
 * so it reads as considered rather than as a template.
 *
 *   node scripts/fetch-fonts.mjs
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'public', 'fonts');

const FAMILIES = [
  { file: 'public-sans.woff2', css: 'https://fonts.googleapis.com/css2?family=Public+Sans:wght@300..800&display=swap' },
  { file: 'bricolage.woff2', css: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap' },
];

// Ask as a modern browser or Google serves legacy formats instead of woff2.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

await mkdir(dest, { recursive: true });

let total = 0;
for (const family of FAMILIES) {
  const path = join(dest, family.file);
  if (existsSync(path)) {
    const size = (await stat(path)).size;
    total += size;
    console.log(`[fonts] have ${family.file} (${(size / 1024).toFixed(0)} KB)`);
    continue;
  }

  const cssRes = await fetch(family.css, { headers: { 'User-Agent': UA } });
  if (!cssRes.ok) {
    console.error(`[fonts] FAILED css for ${family.file}: HTTP ${cssRes.status}`);
    process.exit(1);
  }
  const css = await cssRes.text();

  // Prefer the latin subset; it covers English and the accented Spanish this
  // product renders. Fall back to whatever woff2 is listed first.
  const urls = [...css.matchAll(/url\((https:\/\/[^)]+\.woff2)\)/g)].map((m) => m[1]);
  const latinBlock = css.split('@font-face').find((b) => b.includes('U+0000-00FF'));
  const chosen = latinBlock?.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1] ?? urls.at(-1);

  if (!chosen) {
    console.error(`[fonts] FAILED: no woff2 url found for ${family.file}`);
    process.exit(1);
  }

  const fontRes = await fetch(chosen, { headers: { 'User-Agent': UA } });
  if (!fontRes.ok) {
    console.error(`[fonts] FAILED font for ${family.file}: HTTP ${fontRes.status}`);
    process.exit(1);
  }
  const buf = Buffer.from(await fontRes.arrayBuffer());
  await writeFile(path, buf);
  total += buf.byteLength;
  console.log(`[fonts] fetched ${family.file} (${(buf.byteLength / 1024).toFixed(0)} KB)`);
}

console.log(`[fonts] ${(total / 1024).toFixed(0)} KB in public/fonts/`);
