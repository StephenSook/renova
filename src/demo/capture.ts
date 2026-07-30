/**
 * Dev-only capture harness for the demo cache.
 *
 * The provenance rule for demo mode: cached prose is captured from this app's
 * own engine running in this browser, never authored by hand. This file is the
 * only way the cache gets made. It is imported dynamically from main.tsx in
 * dev builds only, so it cannot exist in the production bundle.
 *
 * Usage, in a real Chrome with the model already in OPFS on this origin:
 *
 *     await __renovaCaptureDemo()
 *
 * then paste the logged JSON into DEMO_CACHE in src/demo/cached.ts.
 */
import { getCachedModel } from '../model/cache';
import { warmEngine } from '../model/engine';
import { analyse } from '../pipeline';
import { DEMO_SCENARIOS } from './scenarios';

declare global {
  interface Window {
    __renovaCaptureDemo?: () => Promise<unknown>;
  }
}

async function captureDemoOutputs() {
  const model = await getCachedModel();
  if (!model) throw new Error('Model is not in OPFS on this origin. Download it first.');
  const engine = await warmEngine(model);

  const scenarios: Record<string, { explanationEn: string; explanationEs: string }> = {};
  for (const s of DEMO_SCENARIOS) {
    const blobs = await Promise.all(
      s.images.map(async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
        return res.blob();
      }),
    );
    const a = await analyse(blobs, { engine });
    if (!a.modelRan) throw new Error(`${s.id}: model did not run (${a.modelError ?? 'unknown'})`);
    if (a.spanishFellBack) throw new Error(`${s.id}: Spanish fell back; refusing to capture a broken cache`);
    scenarios[s.id] = { explanationEn: a.explanationEn, explanationEs: a.explanationEs };
    console.log(`[capture] ${s.id} done`);
  }

  const cache = {
    capturedAt: new Date().toISOString().slice(0, 10),
    model: 'litert-community/gemma-4-E2B-it-litert-lm',
    settings: 'temperature 0, fixed seed, 220 max output tokens',
    scenarios,
  };
  console.log(JSON.stringify(cache, null, 2));
  return cache;
}

window.__renovaCaptureDemo = captureDemoOutputs;

export {};
