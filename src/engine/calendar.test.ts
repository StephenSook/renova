import { describe, expect, it } from 'vitest';
import { buildIcs, icsFilename, unfold } from './calendar';
import { extract } from './rules';

const NOW = new Date(Date.UTC(2026, 6, 29, 12, 0, 0));

const NY = extract([
  `NY State of Health
   Renewal for Medicaid DOH-5798
   CASE NUMBER: AB12345C
   You must return your renewal packet by August 27, 2026.
   Please send recent pay stubs.`,
]);

const ESCALATED = extract(['Renewal for Medicaid DOH-5798']);

describe('buildIcs', () => {
  it('produces a valid all-day event on the deadline', () => {
    const ics = buildIcs(NY, { language: 'en', now: NOW })!;
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260827');
    // DTEND is exclusive in RFC 5545, so an all-day event ends the next day.
    expect(ics).toContain('DTEND;VALUE=DATE:20260828');
    expect(ics).toMatch(/\r\n/);
  });

  it('sets a reminder a week out, not on the day', () => {
    // On the day itself it is usually too late to gather pay stubs and reach a
    // mailbox, which is the failure this whole product exists to prevent.
    const ics = buildIcs(NY, { language: 'en', now: NOW })!;
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-P7D');
  });

  it('carries what the person needs when the reminder fires and the app is closed', () => {
    // Unfold first. Folding legitimately splits "AB12345C" across lines, and a
    // calendar client rejoins it before reading, so the raw string is the wrong
    // thing to assert on.
    const ics = unfold(buildIcs(NY, { language: 'en', now: NOW })!);
    expect(ics).toContain('AB12345C');
    expect(ics).toContain('90 days');
    expect(ics).toContain('1-800-541-2831');
    expect(ics.toLowerCase()).toContain('pay stubs');
  });

  it('refuses rather than inventing a date when the deadline escalated', () => {
    expect(buildIcs(ESCALATED, { language: 'en', now: NOW })).toBeNull();
  });

  it('writes Spanish when asked, including the 90-day right and Spanish documents', () => {
    const ics = unfold(buildIcs(NY, { language: 'es', now: NOW })!);
    expect(ics).toContain('Fecha límite');
    expect(ics).toContain('90 días');
    expect(ics).not.toMatch(/Your deadline is/);
    // An English checklist inside a Spanish reminder is the same failure as an
    // English sentence on a Spanish screen, and arrives days later in another app.
    expect(ics).toContain('Talones de pago');
    expect(ics).not.toContain('Recent pay stubs');
  });

  it('escapes RFC 5545 special characters so the file is not corrupt', () => {
    const ics = buildIcs(NY, { language: 'en', now: NOW })!;
    // Commas inside SUMMARY and DESCRIPTION must be backslash-escaped, or the
    // parser reads them as field separators and the entry imports mangled.
    const summary = ics.split('\r\n').find((l) => l.startsWith('SUMMARY:'))!;
    expect(summary.includes(',')).toBe(summary.includes('\\,'));
  });

  it('uses a stable UID so re-importing updates rather than duplicates', () => {
    const a = buildIcs(NY, { language: 'en', now: NOW })!;
    const b = buildIcs(NY, { language: 'en', now: new Date(Date.UTC(2026, 6, 30)) })!;
    const uid = (s: string) => s.split('\r\n').find((l) => l.startsWith('UID:'));
    expect(uid(a)).toBe(uid(b));
  });

  it('folds to 75 OCTETS, not characters, in both languages', () => {
    // Spanish is the case that matters: an accented character is two octets, so
    // a character-counting fold writes over-long lines for exactly the text this
    // product exists to render well.
    const enc = new TextEncoder();
    for (const language of ['en', 'es'] as const) {
      const ics = buildIcs(NY, { language, now: NOW })!;
      for (const line of ics.split('\r\n')) {
        expect(enc.encode(line).length).toBeLessThanOrEqual(75);
      }
    }
  });

  it('survives a fold-unfold round trip without corrupting accents', () => {
    const ics = unfold(buildIcs(NY, { language: 'es', now: NOW })!);
    expect(ics).not.toContain('\uFFFD');
    expect(ics).toContain('renovación');
  });
});

describe('icsFilename', () => {
  it('is recognisable in a downloads folder weeks later', () => {
    expect(icsFilename(NY)).toBe('renewal-deadline-ny-2026-08-27.ics');
  });
});
