/**
 * Per-state knowledge, as data.
 *
 * Adding a state should be a row in this file, not a change to the engine. Every
 * phone number, form code, and phrasing pattern here was taken from the state's
 * own published materials during the research phase; the URLs are kept next to
 * the values so a reviewer can check them and so the writeup can cite them.
 *
 * The 90-day reconsideration right is federal (42 CFR 435.916) and applies in all
 * four states, but what happens to coverage on reinstatement differs, so it is
 * stored per state rather than asserted globally.
 */
import type { DeadlineCarrier, StateCode } from './types';

export interface StateRules {
  code: StateCode;
  /** Program name as the reader's own paperwork calls it. */
  programEn: string;
  programEs: string;
  /** Form codes that identify this state's renewal packet. */
  formCodes: string[];
  /** Other phrases that identify the state, e.g. portal names. */
  stateAnchors: string[];
  deadlineCarrier: DeadlineCarrier;
  /** Plain-language sentence naming where to look when no date was found. */
  deadlineLocationEn: string;
  /** Labels that precede a case number, most specific first. */
  caseNumberLabels: string[];
  /** Shape of a valid case number for this state, anchored to a full match. */
  caseNumberPattern: RegExp;
  helpline: { name: string; number: string; source: string }[];
  /** What happens if the reader returns the form inside 90 days. */
  reconsiderationEn: string;
  sources: string[];
}

export const STATES: Record<StateCode, StateRules> = {
  CA: {
    code: 'CA',
    programEn: 'Medi-Cal',
    programEs: 'Medi-Cal',
    formCodes: ['MC 216', 'MC216'],
    stateAnchors: ['BenefitsCal', 'Medi-Cal', 'California Department of Health Care Services', 'DHCS'],
    // California is the only one of the four that prints the due date on the
    // form, as a fill-in line on page 1.
    deadlineCarrier: 'form',
    deadlineLocationEn: 'Your due date is printed on page 1 of your MC 216 form.',
    caseNumberLabels: ['Case number', 'Case #', 'Case No'],
    caseNumberPattern: /^[A-Z0-9][A-Z0-9-]{4,19}$/i,
    helpline: [
      {
        name: 'Covered California',
        number: '1-800-300-1506',
        source: 'https://www.coveredca.com/',
      },
      {
        name: 'Covered California TTY',
        number: '1-888-889-4500',
        source: 'https://www.coveredca.com/',
      },
    ],
    reconsiderationEn:
      'If you send your form within 90 days, your Medi-Cal can be restored back to the day it stopped, with no new application.',
    sources: [
      'https://www.dhcs.ca.gov/formsandpubs/forms/Forms/MC-216.pdf',
      'DHCS ACWDL 24-06 (90-day cure period)',
      'DHCS MEDIL I 23-58 (no new application required)',
    ],
  },

  NY: {
    code: 'NY',
    programEn: 'Medicaid',
    programEs: 'Medicaid',
    formCodes: ['DOH-5798', 'DOH 5798', 'LDSS-4411', 'LDSS 4411'],
    stateAnchors: [
      'NY State of Health',
      'New York State Department of Health',
      'ACCESS HRA',
      'Human Resources Administration',
    ],
    // The DOH-5798 has no printed deadline anywhere on it. The date arrives on a
    // separate NY State of Health or HRA notice. A reader holding only the form
    // is holding a packet with no visible deadline, which is exactly the case
    // this product exists to catch.
    deadlineCarrier: 'notice',
    deadlineLocationEn:
      'Your deadline is not on the renewal form. It is on the separate notice that came with it.',
    caseNumberLabels: ['CASE NUMBER', 'Case Number', 'Case #'],
    caseNumberPattern: /^[A-Z]{2}\d{5}[A-Z]$|^[A-Z0-9][A-Z0-9-]{4,19}$/i,
    helpline: [
      {
        name: 'NY Medicaid Helpline',
        number: '1-800-541-2831',
        source: 'https://www.health.ny.gov/health_care/medicaid/',
      },
      {
        name: 'NY State of Health',
        number: '1-855-355-5777',
        source: 'https://nystateofhealth.ny.gov/',
      },
      {
        name: 'NYC HRA Medicaid Helpline',
        number: '1-888-692-6116',
        source: 'https://www.nyc.gov/site/hra/help/medicaid.page',
      },
    ],
    reconsiderationEn:
      'If you send your form within 90 days, your case can be reopened and coverage restored back to the day it stopped, with no new application.',
    sources: [
      'NY DOH-5798 / LDSS-4411',
      'NY DOH GIS 25 MA/06 (90-day reopen, retroactive)',
    ],
  },

  PA: {
    code: 'PA',
    programEn: 'Medical Assistance',
    programEs: 'Asistencia Medica',
    formCodes: ['PA 600 L', 'PA600L', 'PA 600L'],
    stateAnchors: ['COMPASS', 'myCOMPASS', 'County Assistance Office', 'Department of Human Services'],
    deadlineCarrier: 'packet',
    deadlineLocationEn:
      'Your due date is printed on the renewal packet that came in the mail, often on the cover.',
    caseNumberLabels: ['RECORD NUMBER', 'Record Number', 'Record #'],
    caseNumberPattern: /^[A-Z0-9][A-Z0-9-]{4,19}$/i,
    helpline: [
      {
        name: 'PA Customer Service Center',
        number: '1-877-395-8930',
        source: 'https://www.dhs.pa.gov/',
      },
      {
        name: 'Philadelphia',
        number: '1-215-560-7226',
        source: 'https://www.dhs.pa.gov/',
      },
    ],
    reconsiderationEn:
      'If you send your packet within 90 days, your Medical Assistance can be reopened with no gap in coverage. You do not have to ask for reconsideration.',
    sources: ['PA 600 L', 'PA DHS glossary (90-day reconsideration, no gap)'],
  },

  GA: {
    code: 'GA',
    programEn: 'Medicaid',
    programEs: 'Medicaid',
    formCodes: ['Georgia Gateway', 'Gateway'],
    stateAnchors: ['Georgia Gateway', 'DFCS', 'Division of Family and Children Services', 'Pathways'],
    deadlineCarrier: 'notice',
    deadlineLocationEn:
      'Your deadline is on the renewal notice Georgia mailed or emailed you. It is usually the last day of your renewal month.',
    caseNumberLabels: ['Client ID', 'Case Number', 'Case ID', 'Gateway ID'],
    caseNumberPattern: /^[A-Z0-9][A-Z0-9-]{4,19}$/i,
    helpline: [
      {
        name: 'Georgia DFCS',
        number: '877-423-4746',
        source: 'https://dfcs.georgia.gov/',
      },
      { name: 'Georgia DFCS TTY', number: '1-800-255-0556', source: 'https://dfcs.georgia.gov/' },
    ],
    reconsiderationEn:
      'If you send your renewal within 90 days after it ends, your coverage can be put back in place.',
    sources: [
      'https://staycovered.ga.gov/',
      'https://dch.georgia.gov/announcement/2025-10-01/pathways-updates-oct12025',
    ],
  },
};

/**
 * Federal floor, applied when the state cannot be identified.
 *
 * 42 CFR 435.916 binds every state: try ex parte first, give at least 30 days to
 * respond, and reconsider a returned form within 90 days without a new
 * application. Falling back to this is always safe, because it under-promises
 * relative to what any individual state actually offers.
 */
export const FEDERAL_FLOOR = {
  minimumResponseDays: 30,
  reconsiderationDays: 90,
  advanceNoticeDays: 10,
  deadlineLocationEn:
    'Your deadline is on the notice that came with your renewal packet. If you cannot find it, call your state Medicaid office today.',
  reconsiderationEn:
    'If you miss the deadline, you usually have 90 days to send the form and get coverage back without reapplying.',
  nationalHelp: [
    { name: 'Community resource line', number: '211', source: 'https://www.211.org/' },
    { name: 'Legal aid finder', number: 'lawhelp.org', source: 'https://www.lawhelp.org/' },
  ],
  source: '42 CFR 435.916',
} as const;

/**
 * The sentence that goes in every single output.
 *
 * All four covered states implement the federal 90-day reconsideration right, and
 * most readers have never been told it exists. For the seven in ten people who
 * lost coverage to paperwork rather than to income, this one sentence is the
 * highest-value fact in the entire product.
 */
export const NINETY_DAY_SENTENCE_EN =
  'If you miss the deadline, you usually have 90 days to send the form and get coverage back without reapplying.';

export const DISCLAIMER_EN =
  'This tool explains your renewal packet in plain language. It is not legal advice and does not replace guidance from your state Medicaid office. Always confirm your deadline and required documents with your state Medicaid agency.';

export const DISCLAIMER_ES =
  'Esta herramienta explica su paquete de renovacion en lenguaje sencillo. No es asesoramiento legal y no reemplaza la orientacion de su oficina estatal de Medicaid.';

export function primaryHelpline(state: StateCode | null): { name: string; number: string } {
  if (!state) return { name: 'your state Medicaid office', number: '211' };
  const first = STATES[state].helpline[0];
  return { name: first.name, number: first.number };
}
