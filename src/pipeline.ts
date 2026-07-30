/**
 * Photograph to checklist, on one device.
 *
 * The order is fixed and the ownership is fixed with it: OCR reads the pixels,
 * the rules engine owns the three safety fields, and only then does Gemma see
 * anything, and only to write prose. If the model fails, times out, or is
 * unavailable because the machine has no WebGPU, the reader still gets their
 * deadline, their case number, and their checklist. That is the degradation path
 * and it is a feature, not a fallback.
 */
import type { Engine } from '@litert-lm/core';
import { crossCheck, type Mismatch } from './engine/crosscheck';
import { mergeMismatches } from './engine/prose';
import { daysUntil } from './engine/dates';
import { ES, enforceGlossary, isSpanishIntact } from './engine/glossary';
import { SYSTEM_PROMPT, buildPrompt } from './engine/prompt';
import { extract, normalize } from './engine/rules';
import { NINETY_DAY_SENTENCE_EN, primaryHelpline } from './engine/states';
import { ESCALATE, type ExtractionResult } from './engine/types';
import { generate } from './model/engine';
import { isLowQuality, readPages, type OcrPage } from './ocr/paddle';

export type Stage = 'idle' | 'reading' | 'extracting' | 'explaining' | 'done' | 'error';

/**
 * How long the model gets before the deterministic answer is delivered without
 * it. Chosen so a slow machine still finishes, and a stalled one never strands
 * a reader in front of a spinner.
 */
export const MODEL_BUDGET_MS = 45_000;

export interface Progress {
  stage: Stage;
  /** Plain sentence for the aria-live region. Never jargon. */
  message: string;
}

export interface Analysis {
  fields: ExtractionResult;
  pages: OcrPage[];
  /** Gemma's explanation in English. Empty when the model did not run. */
  explanationEn: string;
  /** Spanish explanation, glossary-enforced. Empty when unavailable. */
  explanationEs: string;
  /** True when Spanish came from templates because the model's output was unusable. */
  spanishFellBack: boolean;
  mismatches: Mismatch[];
  /**
   * The model wrote a date or a case number for a field the document reader
   * refused to answer.
   *
   * This is the most dangerous thing the model can do, and it is invisible to
   * the mismatch check: with nothing to compare against, there is no mismatch to
   * report. Left unhandled the screen shows "we could not read your deadline"
   * in red, and four inches below, in fluent prose, a date. The reader takes the
   * concrete number and treats the refusal as boilerplate, which is the exact
   * inversion of this product's design law.
   */
  modelGuessedRefusedField: boolean;
  /** Present when the model path failed, so the UI can say so rather than go quiet. */
  modelError: string | null;
  /** Pages the reader should probably retake. */
  lowQualityPages: number[];
  /** Whether Gemma ran at all. False means the deterministic result stands alone. */
  modelRan: boolean;
  /**
   * The prose came from the demo cache rather than a live generation. The
   * reader is told so on screen; a saved answer presented as a live one would
   * be a lie on a page whose whole argument is checkability.
   */
  proseFromCache: boolean;
  timings: Record<string, number>;
}

const MESSAGES: Record<Exclude<Stage, 'idle' | 'error'>, string> = {
  reading: 'Reading your document...',
  extracting: 'Finding your deadline...',
  explaining: 'Putting it in plain words...',
  done: 'Done.',
};

export interface AnalyseOptions {
  /** Omit to run the deterministic path only. */
  engine?: Engine | null;
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal;
}

export async function analyse(
  images: (Blob | ArrayBuffer)[],
  { engine, onProgress, signal }: AnalyseOptions = {},
): Promise<Analysis> {
  const timings: Record<string, number> = {};
  const step = (stage: Exclude<Stage, 'idle' | 'error'>) =>
    onProgress?.({ stage, message: MESSAGES[stage] });

  step('reading');
  let t = performance.now();
  const pages = await readPages(images);
  timings.ocr = Math.round(performance.now() - t);

  step('extracting');
  t = performance.now();
  const packetText = pages.map((p) => normalize(p.text)).join('\n');
  const fields = extract(pages.map((p) => p.text));
  timings.rules = Math.round(performance.now() - t);

  const lowQualityPages = pages.flatMap((p, i) => (isLowQuality(p) ? [i] : []));

  const analysis: Analysis = {
    fields,
    pages,
    explanationEn: '',
    explanationEs: '',
    spanishFellBack: false,
    mismatches: [],
    modelGuessedRefusedField: false,
    modelError: null,
    lowQualityPages,
    modelRan: false,
    proseFromCache: false,
    timings,
  };

  if (!engine) {
    step('done');
    return analysis;
  }

  step('explaining');
  t = performance.now();

  /*
   * A wall-clock budget on the model, not just an abort signal.
   *
   * Without one, a stalled generation leaves the reader on "Putting it in plain
   * words..." forever while a complete deterministic answer sits finished in
   * memory two lines up. The timeout lands in the catch below and delivers that
   * answer instead.
   */
  const budget = AbortSignal.timeout(MODEL_BUDGET_MS);
  const stop = signal ? AbortSignal.any([signal, budget]) : budget;

  try {
    const en = (
      await generate(engine, buildPrompt({ fields, packetText, language: 'en' }), {
        system: SYSTEM_PROMPT,
        signal: stop,
      })
    ).trim();

    // Check BEFORE publishing. Assigning prose to the analysis and cross-checking
    // it three statements later leaves a window where a later throw ships
    // unchecked text to the screen with an empty mismatch list.
    const checked = crossCheck(en, fields);
    analysis.explanationEn = en;
    analysis.mismatches = checked.mismatches;
    analysis.modelGuessedRefusedField =
      checked.modelRestatedFields &&
      (fields.deadline.value === ESCALATE || fields.caseNumber.value === ESCALATE);

    const rawEs = (
      await generate(engine, buildPrompt({ fields, packetText, language: 'es' }), {
        system: SYSTEM_PROMPT,
        signal: stop,
      })
    ).trim();

    if (isSpanishIntact(rawEs)) {
      analysis.explanationEs = enforceGlossary(rawEs).text;
      // The Spanish prose gets the same scrutiny as the English. Numeric dates
      // and case numbers are language-independent, and the Spanish-dominant
      // reader is the one this product was built for.
      const checkedEs = crossCheck(analysis.explanationEs, fields);
      analysis.mismatches = mergeMismatches(analysis.mismatches, checkedEs.mismatches);
      analysis.modelGuessedRefusedField ||=
        checkedEs.modelRestatedFields &&
        (fields.deadline.value === ESCALATE || fields.caseNumber.value === ESCALATE);
    } else {
      // Corrupted or English-when-Spanish-was-asked-for output is worse than no
      // prose: it tells a Spanish-dominant reader that nobody who speaks their
      // language checked. The templated fields still carry the actionable answer.
      analysis.spanishFellBack = true;
    }

    analysis.modelRan = true;
  } catch (err) {
    // A model failure must never cost the reader their deadline. The
    // deterministic result is already complete and is returned as it stands.
    analysis.modelRan = false;
    analysis.modelError = err instanceof Error ? err.message : String(err);
    // If Spanish never arrived, say so rather than rendering an empty paragraph
    // under a heading, which reads as "there is nothing to tell you".
    if (!analysis.explanationEs) analysis.spanishFellBack = true;
  }
  timings.model = Math.round(performance.now() - t);

  step('done');
  return analysis;
}

export { applyCachedProse } from './engine/prose';

/**
 * The closing lines, rendered from code in both languages.
 *
 * These carry a legal right and a phone number, so the component that can
 * hallucinate is never the component that writes them.
 */
export function closingLines(
  fields: ExtractionResult,
  language: 'en' | 'es',
): { ninetyDay: string; help: string } {
  const help = primaryHelpline(fields.state);
  return language === 'es'
    ? { ninetyDay: ES.ninetyDay, help: ES.callToday(help.name, help.number) }
    : {
        ninetyDay: NINETY_DAY_SENTENCE_EN,
        help: `Call ${help.name} at ${help.number} if you have questions.`,
      };
}

/** Days remaining, or null when the deadline could not be read. */
export function urgency(fields: ExtractionResult): number | null {
  return fields.deadline.value === ESCALATE ? null : daysUntil(fields.deadline.value);
}
