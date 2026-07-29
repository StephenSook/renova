/**
 * Put the deadline in the reader's pocket.
 *
 * Everything else this product does is information. This is the one thing that
 * leaves the screen and follows the person: a calendar entry on the day, and a
 * reminder a week before, generated on the device and downloaded as a file.
 *
 * It matters because the failure this product exists to prevent is not
 * misunderstanding, it is forgetting. Seven in ten people who lost coverage were
 * still eligible. The envelope sat on the counter. A tool that explains the
 * envelope beautifully and then lets the person walk away with nothing in their
 * calendar has solved the smaller half of the problem.
 *
 * No library. RFC 5545 is a text format, and a dependency here would be another
 * thing to break offline.
 */
import { formatLong } from './dates';
import { DOCUMENT_LABELS_ES, ES } from './glossary';
import { STATES, NINETY_DAY_SENTENCE_EN, primaryHelpline } from './states';
import { ESCALATE, type ExtractionResult } from './types';

/** Escape per RFC 5545: backslash, semicolon, comma, newline. */
function esc(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Fold to 75 OCTETS, not 75 characters.
 *
 * RFC 5545 counts octets. "í" is two octets in UTF-8, so a character-counting
 * fold writes over-long lines for exactly the Spanish text this product exists
 * to render well. Splitting a multi-byte character across the fold would also
 * corrupt it outright.
 */
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = '';
  let limit = 75;

  for (const char of line) {
    const width = enc.encode(char).length;
    if (enc.encode(current).length + width > limit) {
      out.push(current);
      current = char;
      // Continuation lines carry a leading space, which costs one octet.
      limit = 74;
    } else {
      current += char;
    }
  }
  out.push(current);

  return out[0] + out.slice(1).map((part) => '\r\n ' + part).join('');
}

/**
 * Reverse the fold, as any calendar client does before reading a value.
 *
 * Exported so tests assert on what a calendar actually sees. Asserting on the
 * raw text is how a folded case number ("AB" + newline + " 12345C") reads as a
 * failure when the file is correct, or worse, hides a real corruption.
 */
export function unfold(ics: string): string {
  return ics.replace(/\r\n /g, '');
}

function toIcsDate(iso: string): string {
  return iso.replace(/-/g, '');
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export interface CalendarOptions {
  language: 'en' | 'es';
  /** Injectable so the output is deterministic in tests. */
  now?: Date;
}

/**
 * Build an all-day event on the deadline, plus a reminder seven days earlier.
 *
 * The description carries what the person will need when the reminder fires and
 * this app is not open: the document list, the case number, the helpline, and
 * the 90-day right. A reminder that only says "deadline" makes someone go
 * looking for the packet again.
 */
export function buildIcs(fields: ExtractionResult, { language, now = new Date() }: CalendarOptions): string | null {
  if (fields.deadline.value === ESCALATE) return null;

  const es = language === 'es';
  const program = fields.state
    ? es
      ? STATES[fields.state].programEs
      : STATES[fields.state].programEn
    : 'Medicaid';
  const help = primaryHelpline(fields.state, language);

  const title = es
    ? `Fecha límite: enviar su renovación de ${program}`
    : `Deadline: send your ${program} renewal`;

  // The checklist inside the reminder must be in the reader's language too.
  // An English list inside a Spanish event is the same failure as an English
  // sentence on a Spanish screen, and harder to notice because it arrives days
  // later in a different app.
  const docs = fields.documents
    .map((d) => `- ${es ? (DOCUMENT_LABELS_ES[d.id] ?? d.label) : d.label}`)
    .join('\n');

  const body = es
    ? [
        `Su fecha límite es el ${formatLong(fields.deadline.value, 'es-US')}.`,
        fields.caseNumber.value !== ESCALATE ? `Número de caso: ${fields.caseNumber.value}` : '',
        docs ? `\nLo que debe enviar:\n${docs}` : '',
        `\n${ES.ninetyDay}`,
        `\n${help.name}: ${help.number}`,
      ]
    : [
        `Your deadline is ${formatLong(fields.deadline.value)}.`,
        fields.caseNumber.value !== ESCALATE ? `Case number: ${fields.caseNumber.value}` : '',
        docs ? `\nWhat to send:\n${docs}` : '',
        `\n${NINETY_DAY_SENTENCE_EN}`,
        `\n${help.name}: ${help.number}`,
      ];

  const description = body.filter(Boolean).join('\n');

  // All-day event. DTEND is exclusive in RFC 5545, so it is the following day.
  const start = toIcsDate(fields.deadline.value);
  const [y, m, d] = fields.deadline.value.split('-').map(Number);
  const end = toIcsDate(new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10));

  // A stable UID from the packet's own values, so re-importing updates the same
  // entry instead of stacking duplicates every time someone re-reads a packet.
  const uid = `renova-${fields.state ?? 'xx'}-${fields.deadline.value}-${
    fields.caseNumber.value === ESCALATE ? 'nocase' : fields.caseNumber.value
  }`.toLowerCase();

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Renova//Medicaid renewal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(description)}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    // A week out is the useful reminder. On the day itself it is often too late
    // to gather pay stubs and get to a mailbox.
    'TRIGGER:-P7D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(
      es
        ? `Su renovación de ${program} vence en una semana.`
        : `Your ${program} renewal is due in one week.`,
    )}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Filename a person can recognise in a downloads folder six weeks later. */
export function icsFilename(fields: ExtractionResult): string {
  const state = fields.state ? fields.state.toLowerCase() : 'medicaid';
  return `renewal-deadline-${state}-${fields.deadline.value}.ics`;
}
