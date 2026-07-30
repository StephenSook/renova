/**
 * Entry point for the JavaScriptCore bundle the iOS app embeds.
 *
 * This is the whole trick: the safety-critical code that ships to iPhones is
 * the exact TypeScript the web app runs and the eval harness measures, not a
 * port. esbuild rolls the engine into one IIFE, JavaScriptCore executes it,
 * and Swift talks to `Renova.*` through JSContext. If a function is not
 * exposed here, the app does not have it.
 */
import { crossCheck, mismatchMessage, type Mismatch } from '../src/engine/crosscheck';
import { daysUntil, formatLong } from '../src/engine/dates';
import {
  DOCUMENT_LABELS_ES,
  EN,
  ES,
  enforceGlossary,
  isSpanishIntact,
  programNameEs,
} from '../src/engine/glossary';
import { SYSTEM_PROMPT, buildPrompt } from '../src/engine/prompt';
import { applyCachedProse, closingLines, urgency, type ProseCarrier } from '../src/engine/prose';
import { buildEscalation, extract, normalize } from '../src/engine/rules';
import {
  DISCLAIMER_EN,
  DISCLAIMER_ES,
  NINETY_DAY_SENTENCE_EN,
  STATES,
  primaryHelpline,
} from '../src/engine/states';
import { ESCALATE } from '../src/engine/types';
import { DEMO_CACHE } from '../src/demo/cached';
import { DEMO_SCENARIOS } from '../src/demo/scenarios';
import { buildScript } from '../src/tts/speak';
import type { Analysis } from '../src/pipeline';

/**
 * The JSON payload Swift consumes. A superset of ProseCarrier so the checks in
 * applyCachedProse run on exactly this object.
 */
interface SwiftAnalysis extends ProseCarrier {
  helpline: { name: string; number: string };
  /** Rendered banner text per mismatch, in the requested language. */
  mismatchMessages: string[];
  closing: { ninetyDay: string; help: string };
  closingEs: { ninetyDay: string; help: string };
  daysLeft: number | null;
}

function decorate(carrier: ProseCarrier, language: 'en' | 'es'): SwiftAnalysis {
  return {
    ...carrier,
    helpline: primaryHelpline(carrier.fields.state),
    mismatchMessages: carrier.mismatches.map((m: Mismatch) => mismatchMessage(m, language)),
    closing: closingLines(carrier.fields, 'en'),
    closingEs: closingLines(carrier.fields, 'es'),
    daysLeft: urgency(carrier.fields),
  };
}

/** OCR page texts in, complete deterministic analysis out. */
function analyzePages(pagesJson: string, language: 'en' | 'es'): string {
  const pages: string[] = JSON.parse(pagesJson);
  const carrier: ProseCarrier = {
    fields: extract(pages),
    explanationEn: '',
    explanationEs: '',
    spanishFellBack: false,
    mismatches: [],
    modelGuessedRefusedField: false,
    proseFromCache: false,
  };
  return JSON.stringify(decorate(carrier, language));
}

/**
 * Attach prose to an analysis under the full check-suite. `fromCache` only
 * controls the provenance flag the UI shows; the scrutiny is identical.
 */
function attachProse(
  analysisJson: string,
  en: string,
  es: string,
  fromCache: boolean,
  language: 'en' | 'es',
): string {
  const carrier = JSON.parse(analysisJson) as SwiftAnalysis;
  const next = applyCachedProse(carrier, { explanationEn: en, explanationEs: es });
  next.proseFromCache = fromCache;
  return JSON.stringify(decorate(next, language));
}

/** The exact prompt the web app would build for these pages and fields. */
function promptFor(analysisJson: string, pagesJson: string, language: 'en' | 'es'): string {
  const carrier = JSON.parse(analysisJson) as SwiftAnalysis;
  const pages: string[] = JSON.parse(pagesJson);
  const packetText = pages.map(normalize).join('\n');
  return buildPrompt({ fields: carrier.fields, packetText, language });
}

/** Cached demo prose for a scenario id, or null when there is none. */
function demoProse(id: string): string | null {
  const hit = DEMO_CACHE.scenarios[id];
  return hit ? JSON.stringify(hit) : null;
}

/** The read-aloud script, built from deterministic fields only. */
function speechScript(analysisJson: string, language: 'en' | 'es'): string {
  const carrier = JSON.parse(analysisJson) as SwiftAnalysis;
  return buildScript(carrier as unknown as Analysis, language);
}

declare global {
  // eslint-disable-next-line no-var
  var Renova: Record<string, unknown>;
}

globalThis.Renova = {
  // The deterministic path. Owns the deadline, the case number, the documents.
  extract,
  normalize,
  buildEscalation,
  // The law applied to prose, cached or live.
  crossCheck,
  mismatchMessage,
  applyCachedProse,
  // Prompting, identical bytes to the web app's.
  SYSTEM_PROMPT,
  buildPrompt,
  // Language safety.
  enforceGlossary,
  isSpanishIntact,
  DOCUMENT_LABELS_ES,
  programNameEs,
  ES,
  EN,
  // Rendered-from-constants strings.
  DISCLAIMER_EN,
  DISCLAIMER_ES,
  NINETY_DAY_SENTENCE_EN,
  STATES,
  primaryHelpline,
  // Dates and shared vocabulary.
  daysUntil,
  formatLong,
  ESCALATE,
  // Swift-facing glue. JSON strings across the boundary, logic stays here.
  analyzePages,
  attachProse,
  promptFor,
  demoProse,
  speechScript,
  DEMO_SCENARIOS,
  DEMO_CACHE,
};
