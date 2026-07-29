/**
 * The cross-check that makes the mismatch banner real.
 *
 * Gemma is told not to restate the deadline or the case number. This module
 * checks whether it did anyway, and whether what it said agrees with what the
 * document says.
 *
 * The design law is that disagreement is shown, never resolved. Two readers
 * looked at the same page and reached different answers; the honest response is
 * to say so, put the value taken from the document on top, and let the person
 * check the paper in their hand. Quietly picking a winner is how a tool becomes
 * confidently wrong, which is the failure mode that costs someone coverage.
 *
 * This is also the only place the model's output is allowed to affect anything
 * other than prose, and even here it can only raise a warning, never change a
 * field.
 */
import { parseDate } from './dates';
import type { ExtractionResult } from './types';
import { ESCALATE } from './types';

export type MismatchField = 'deadline' | 'caseNumber';

export interface Mismatch {
  field: MismatchField;
  /** The value read from the document. Always the one shown to the reader. */
  fromDocument: string;
  /** What the model said instead. */
  fromModel: string;
  /** The sentence it appeared in, so the reader can see the context. */
  context: string;
}

export interface CrossCheckResult {
  mismatches: Mismatch[];
  /** True when the model restated a field it was told to leave alone. */
  modelRestatedFields: boolean;
}

/** Case-number shapes across the four states, deliberately loose. */
const CASE_SHAPE = /\b[A-Z]{0,2}\d{2}[A-Z0-9-]{3,17}\b/g;

/** A window around a match, so a mismatch can be shown in context. */
function sentenceAround(text: string, index: number): string {
  const start = Math.max(0, text.lastIndexOf('.', index) + 1);
  const dot = text.indexOf('.', index);
  const end = dot === -1 ? text.length : dot + 1;
  return text.slice(start, end).trim();
}

/**
 * Compare the model's prose against the deterministic fields.
 *
 * Only fields the deterministic path actually resolved are checked. If the
 * document reader escalated, there is nothing to disagree with, and a model
 * guessing a date in that situation is caught by `modelRestatedFields` instead.
 */
export function crossCheck(prose: string, fields: ExtractionResult): CrossCheckResult {
  const mismatches: Mismatch[] = [];
  let restated = false;

  // Deadline. Any date-shaped string in the prose is a claim about the deadline,
  // because the prompt gives the model no other date to talk about.
  const dateMatches = findDates(prose);
  if (dateMatches.length) {
    restated = true;
    if (fields.deadline.value !== ESCALATE) {
      for (const found of dateMatches) {
        if (found.iso !== fields.deadline.value) {
          mismatches.push({
            field: 'deadline',
            fromDocument: fields.deadline.value,
            fromModel: found.iso,
            context: sentenceAround(prose, found.index),
          });
          break;
        }
      }
    }
  }

  // Case number.
  if (fields.caseNumber.value !== ESCALATE) {
    const expected = fields.caseNumber.value.toUpperCase();
    for (const match of prose.toUpperCase().matchAll(CASE_SHAPE)) {
      const candidate = match[0];
      // Dates already handled above; do not report 2026-08-27 as a case number.
      if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) continue;
      restated = true;
      if (candidate !== expected) {
        mismatches.push({
          field: 'caseNumber',
          fromDocument: fields.caseNumber.value,
          fromModel: match[0],
          context: sentenceAround(prose, match.index ?? 0),
        });
      }
      break;
    }
  }

  return { mismatches, modelRestatedFields: restated };
}

/** Every date in the prose, with where it was found. */
function findDates(text: string): { iso: string; index: number }[] {
  const out: { iso: string; index: number }[] = [];
  // Scan in windows so several dates in one paragraph are each caught.
  const windows = text.split(/(?<=[.!?])\s+/);
  let offset = 0;
  for (const window of windows) {
    const parsed = parseDate(window);
    if (parsed) out.push({ iso: parsed.iso, index: offset + window.indexOf(parsed.text) });
    offset += window.length + 1;
  }
  return out;
}

/**
 * The banner copy.
 *
 * Plain words, no jargon, and it names which value came from where. "Our two
 * readers disagree" is understandable; "extraction confidence below threshold"
 * is not, and this is read by people who are already frightened.
 */
export function mismatchMessage(mismatch: Mismatch, language: 'en' | 'es'): string {
  const what = mismatch.field === 'deadline' ? 'deadline' : 'case number';
  const queEs = mismatch.field === 'deadline' ? 'fecha límite' : 'número de caso';

  return language === 'es'
    ? `Nuestros dos lectores no coinciden en su ${queEs}. Le mostramos el valor que aparece en su documento. Por favor verifíquelo en el papel.`
    : `Our two readers disagree on this ${what}. The value from your document is shown. Please double-check the paper.`;
}
