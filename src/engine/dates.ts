/**
 * Date reading, tuned for OCR output rather than for clean input.
 *
 * Every function here refuses rather than guesses. A date this engine is not
 * sure about is worth less than no date at all, because the reader will act on
 * whatever number appears next to the word "deadline".
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const MONTH_ALT = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

/** "August 27, 2026" and "27 August 2026". */
const NAMED = new RegExp(
  `\\b(?:(${MONTH_ALT})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*(\\d{4})|(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_ALT})\\.?\\s*,?\\s*(\\d{4}))\\b`,
  'i',
);

/** "8/27/2026", "08-27-26". US order, which is what these forms use. */
const NUMERIC = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})\b/;

export interface ParsedDate {
  /** ISO YYYY-MM-DD */
  iso: string;
  /** The exact substring that produced it. */
  text: string;
}

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Reject dates that do not exist, e.g. February 30 from a bad OCR digit.
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Read the first date in a string.
 *
 * Two-digit years are windowed rather than assumed: renewal paperwork is always
 * about the near future or the recent past, so 26 means 2026 and 99 means 1999.
 */
export function parseDate(input: string): ParsedDate | null {
  const named = NAMED.exec(input);
  if (named) {
    const [text, m1, d1, y1, d2, m2, y2] = named;
    const month = MONTHS[(m1 ?? m2).toLowerCase()];
    const day = Number(d1 ?? d2);
    const year = Number(y1 ?? y2);
    const value = iso(year, month, day);
    if (value) return { iso: value, text: text.trim() };
  }

  const numeric = NUMERIC.exec(input);
  if (numeric) {
    const [text, a, b, c] = numeric;
    let year = Number(c);
    if (c.length === 2) year = year <= 70 ? 2000 + year : 1900 + year;
    const value = iso(year, Number(a), Number(b));
    if (value) return { iso: value, text: text.trim() };
  }

  return null;
}

/**
 * Resolve "by the end of your renewal month" into a real date.
 *
 * Georgia states deadlines this way rather than printing a date, so the phrase is
 * only actionable once it is turned into one. Returns null without an anchor
 * month, because inventing one would be exactly the kind of confident guess this
 * engine is built to avoid.
 */
export function endOfRenewalMonth(text: string): ParsedDate | null {
  const m = new RegExp(`\\b(${MONTH_ALT})\\.?\\s+(\\d{4})\\b`, 'i').exec(text);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  const year = Number(m[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const value = iso(year, month, lastDay);
  return value ? { iso: value, text: m[0].trim() } : null;
}

/** Whole days from `from` to the ISO date. Negative once the date has passed. */
export function daysUntil(isoDate: string, from = new Date()): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}

/** "Monday, August 27, 2026", for reading aloud and for large display. */
export function formatLong(isoDate: string, locale = 'en-US'): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, {
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
