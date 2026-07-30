/**
 * The demo cache is reader-facing content, so it gets the same scrutiny as
 * code: present for every scenario, intact Spanish, no em-dashes, and wired
 * through exactly the checks a live generation gets.
 */
import { describe, expect, it } from 'vitest';
import { applyCachedProse, type ProseCarrier } from '../engine/prose';
import { isSpanishIntact } from '../engine/glossary';
import { extract } from '../engine/rules';
import { DEMO_CACHE } from './cached';
import { DEMO_SCENARIOS } from './scenarios';

const NY = extract([
  `Renewal for Medicaid DOH-5798
   CASE NUMBER: AB12345C
   You must return your renewal packet by August 27, 2026.`,
]);

function carrier(fields = NY): ProseCarrier {
  return {
    fields,
    explanationEn: '',
    explanationEs: '',
    spanishFellBack: false,
    mismatches: [],
    modelGuessedRefusedField: false,
    proseFromCache: false,
  };
}

describe('DEMO_CACHE', () => {
  it('has a captured entry for every scenario', () => {
    expect(DEMO_CACHE.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const s of DEMO_SCENARIOS) {
      const c = DEMO_CACHE.scenarios[s.id];
      expect(c, `missing capture for ${s.id}`).toBeDefined();
      expect(c.explanationEn.length, `empty English for ${s.id}`).toBeGreaterThan(40);
      expect(c.explanationEs.length, `empty Spanish for ${s.id}`).toBeGreaterThan(40);
    }
  });

  it('ships intact Spanish and no em-dashes, like every other reader-facing string', () => {
    for (const [id, c] of Object.entries(DEMO_CACHE.scenarios)) {
      for (const text of [c.explanationEn, c.explanationEs]) {
        expect(text.includes('—'), `em-dash in ${id}`).toBe(false);
        expect(text.includes('�'), `lost bytes in ${id}`).toBe(false);
      }
      expect(isSpanishIntact(c.explanationEs), `Spanish broken in ${id}`).toBe(true);
    }
  });
});

describe('applyCachedProse', () => {
  it('marks provenance and cross-checks the cache against the live fields', () => {
    const out = applyCachedProse(carrier(), {
      explanationEn: 'You need to reply by August 17, 2026 to keep your coverage.',
      explanationEs:
        'Esta es una carta sobre la renovación de su cobertura de Medicaid. Devuélvala pronto para conservar su cobertura.',
    });
    expect(out.proseFromCache).toBe(true);
    // The cache disagreed with the document, so the reader sees the banner.
    expect(out.mismatches.some((m) => m.field === 'deadline')).toBe(true);
  });

  it('refuses to pair a cached date with a field the reader refused to answer', () => {
    const escalated = extract(['Renewal for Medicaid DOH-5798']);
    const out = applyCachedProse(carrier(escalated), {
      explanationEn: 'The deadline is September 9, 2026.',
      explanationEs: 'La fecha límite es el 9 de septiembre de 2026.',
    });
    expect(out.modelGuessedRefusedField).toBe(true);
  });

  it('falls back rather than shipping English as Spanish', () => {
    const out = applyCachedProse(carrier(), {
      explanationEn: 'This letter asks you to renew your coverage.',
      explanationEs: 'You must send the form back with your documents to keep the coverage.',
    });
    expect(out.spanishFellBack).toBe(true);
    expect(out.explanationEs).toBe('');
  });

  it('never touches the deterministic fields', () => {
    const before = JSON.stringify(NY);
    applyCachedProse(carrier(), {
      explanationEn: 'The deadline is January 1, 1999 and the case number is HACKED1.',
      explanationEs: 'La fecha límite es el 1 de enero de 1999.',
    });
    expect(JSON.stringify(NY)).toBe(before);
  });
});
