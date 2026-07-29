import { describe, expect, it } from 'vitest';
import { crossCheck, mismatchMessage } from './crosscheck';
import { enforceGlossary, isSpanishIntact } from './glossary';
import { extract } from './rules';

const NY = extract([
  `Renewal for Medicaid DOH-5798
   CASE NUMBER: AB12345C
   You must return your renewal packet by August 27, 2026.`,
]);

describe('crossCheck', () => {
  it('says nothing when the model followed instructions and wrote prose only', () => {
    const r = crossCheck(
      'This letter asks you to confirm your household information so your coverage can continue. Send the papers it asks for.',
      NY,
    );
    expect(r.mismatches).toHaveLength(0);
    expect(r.modelRestatedFields).toBe(false);
  });

  it('accepts a restated date that agrees with the document', () => {
    const r = crossCheck('You need to reply by August 27, 2026 to keep your coverage.', NY);
    expect(r.modelRestatedFields).toBe(true);
    expect(r.mismatches).toHaveLength(0);
  });

  it('flags a restated date that disagrees, and keeps the document value on top', () => {
    const r = crossCheck('You need to reply by August 17, 2026 to keep your coverage.', NY);
    expect(r.mismatches).toHaveLength(1);
    expect(r.mismatches[0].field).toBe('deadline');
    // The document value is what the reader is shown. This is the design law.
    expect(r.mismatches[0].fromDocument).toBe('2026-08-27');
    expect(r.mismatches[0].fromModel).toBe('2026-08-17');
    expect(r.mismatches[0].context).toContain('August 17');
  });

  it('flags a hallucinated case number', () => {
    const r = crossCheck('Your case number XY99999Z is on the top of the letter.', NY);
    const caseMismatch = r.mismatches.find((m) => m.field === 'caseNumber');
    expect(caseMismatch?.fromDocument).toBe('AB12345C');
  });

  it('cannot disagree with a field the document reader refused to answer', () => {
    const escalated = extract(['Renewal for Medicaid DOH-5798']);
    const r = crossCheck('The deadline is September 9, 2026.', escalated);
    // Nothing to compare against, but the restatement is still surfaced so the
    // UI can decline to show a model-invented date next to an escalation.
    expect(r.mismatches).toHaveLength(0);
    expect(r.modelRestatedFields).toBe(true);
  });

  it('never rewrites a field, only reports', () => {
    const before = JSON.stringify(NY);
    crossCheck('The deadline is January 1, 1999 and the case number is HACKED1.', NY);
    expect(JSON.stringify(NY)).toBe(before);
  });
});

describe('mismatchMessage', () => {
  it('uses plain words in both languages and names where the value came from', () => {
    const m = { field: 'deadline' as const, fromDocument: 'a', fromModel: 'b', context: '' };
    expect(mismatchMessage(m, 'en')).toContain('from your document');
    expect(mismatchMessage(m, 'es')).toContain('su documento');
    // No jargon a frightened reader would have to decode.
    expect(mismatchMessage(m, 'en')).not.toMatch(/confidence|threshold|extraction|model/i);
  });
});

describe('enforceGlossary', () => {
  it('substitutes the locked translation for a term the model left in English', () => {
    const { text, substitutions } = enforceGlossary(
      'Debe enviar su renewal form antes de la deadline.',
    );
    expect(text).toContain('formulario de renovación');
    expect(text).toContain('fecha límite');
    expect(substitutions.map((s) => s.en)).toContain('renewal form');
  });

  it('prefers the longest term so "renewal form" is not half-replaced', () => {
    const { text } = enforceGlossary('Complete the renewal form.');
    expect(text).toContain('formulario de renovación');
    expect(text).not.toContain('renovación form');
  });

  it('keeps sentence-initial capitalisation', () => {
    expect(enforceGlossary('Coverage continues.').text.startsWith('Cobertura')).toBe(true);
  });
});

describe('isSpanishIntact', () => {
  it('accepts correct Spanish with accents', () => {
    expect(isSpanishIntact('Su fecha límite es el 27 de agosto. El año pasado.')).toBe(true);
  });

  it('rejects lost bytes and mojibake', () => {
    expect(isSpanishIntact('Su fecha l�mite')).toBe(false);
    expect(isSpanishIntact('El aÃ±o pasado')).toBe(false);
    expect(isSpanishIntact('   ')).toBe(false);
  });
});
