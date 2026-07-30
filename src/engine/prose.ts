/**
 * Attaching model prose to a deterministic analysis.
 *
 * Lives in the engine because it is pure: no OCR, no wasm, no model. The
 * pipeline uses it for live generations and the demo path uses it for cached
 * ones, so the two cannot apply different scrutiny.
 */
import { crossCheck, type Mismatch } from './crosscheck';
import { enforceGlossary, isSpanishIntact } from './glossary';
import { ESCALATE, type ExtractionResult } from './types';

/** The slice of an analysis that prose attachment reads and writes. */
export interface ProseCarrier {
  fields: ExtractionResult;
  explanationEn: string;
  explanationEs: string;
  spanishFellBack: boolean;
  mismatches: Mismatch[];
  modelGuessedRefusedField: boolean;
  proseFromCache: boolean;
}

/** One banner per field, first sighting wins, so a reader is never shown the same disagreement twice. */
export function mergeMismatches(a: Mismatch[], b: Mismatch[]): Mismatch[] {
  const seen = new Set(a.map((m) => m.field));
  return [...a, ...b.filter((m) => !seen.has(m.field))];
}

/**
 * Attach prose captured earlier from this app's own engine to a fresh
 * deterministic analysis.
 *
 * The capture is never trusted. The cross-check, the glossary, and the
 * Spanish-intactness test all run again, right now, against the fields just
 * read from the document, exactly as the live path would run them. If the
 * cache and the document disagree, the reader sees the same mismatch banner a
 * live run would show. The deterministic fields are untouched; that is the law.
 */
export function applyCachedProse<T extends ProseCarrier>(
  analysis: T,
  cached: { explanationEn: string; explanationEs: string },
): T {
  const next: T = { ...analysis, proseFromCache: true };
  const refused =
    next.fields.deadline.value === ESCALATE || next.fields.caseNumber.value === ESCALATE;

  const en = cached.explanationEn.trim();
  const checked = crossCheck(en, next.fields);
  next.explanationEn = en;
  next.mismatches = checked.mismatches;
  next.modelGuessedRefusedField = checked.modelRestatedFields && refused;

  const rawEs = cached.explanationEs.trim();
  if (isSpanishIntact(rawEs)) {
    next.explanationEs = enforceGlossary(rawEs).text;
    const checkedEs = crossCheck(next.explanationEs, next.fields);
    next.mismatches = mergeMismatches(next.mismatches, checkedEs.mismatches);
    next.modelGuessedRefusedField ||= checkedEs.modelRestatedFields && refused;
  } else {
    next.explanationEs = '';
    next.spanishFellBack = true;
  }

  return next;
}
