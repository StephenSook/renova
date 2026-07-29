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
import { daysUntil } from './engine/dates';
import { ES, enforceGlossary, isSpanishIntact } from './engine/glossary';
import { SYSTEM_PROMPT, buildPrompt } from './engine/prompt';
import { extract, normalize } from './engine/rules';
import { NINETY_DAY_SENTENCE_EN, primaryHelpline } from './engine/states';
import { ESCALATE, type ExtractionResult } from './engine/types';
import { generate } from './model/engine';
import { isLowQuality, readPages, type OcrPage } from './ocr/paddle';

export type Stage = 'idle' | 'reading' | 'extracting' | 'explaining' | 'done' | 'error';

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
  /** Pages the reader should probably retake. */
  lowQualityPages: number[];
  /** Whether Gemma ran at all. False means the deterministic result stands alone. */
  modelRan: boolean;
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
    lowQualityPages,
    modelRan: false,
    timings,
  };

  if (!engine) {
    step('done');
    return analysis;
  }

  step('explaining');
  t = performance.now();
  try {
    analysis.explanationEn = (
      await generate(engine, buildPrompt({ fields, packetText, language: 'en' }), {
        system: SYSTEM_PROMPT,
        signal,
      })
    ).trim();

    const rawEs = (
      await generate(engine, buildPrompt({ fields, packetText, language: 'es' }), {
        system: SYSTEM_PROMPT,
        signal,
      })
    ).trim();

    if (isSpanishIntact(rawEs)) {
      analysis.explanationEs = enforceGlossary(rawEs).text;
    } else {
      // Corrupted multibyte output is worse than no prose: it tells a
      // Spanish-dominant reader that nobody who speaks their language checked.
      // The templated fields below still carry the whole actionable answer.
      analysis.spanishFellBack = true;
    }

    analysis.mismatches = crossCheck(analysis.explanationEn, fields).mismatches;
    analysis.modelRan = true;
  } catch {
    // A model failure must never cost the reader their deadline. The
    // deterministic result is already complete and is returned as it stands.
    analysis.modelRan = false;
  }
  timings.model = Math.round(performance.now() - t);

  step('done');
  return analysis;
}

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
