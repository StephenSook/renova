/**
 * The deterministic path.
 *
 * This module owns the three fields a wrong answer could cost someone their
 * health coverage: the response deadline, the case number, and the documents to
 * send. Nothing here calls a model. The model reads this module's output as
 * ground truth it is not allowed to contradict.
 *
 * The governing rule is that a refusal is a valid answer and a guess is not.
 * "We could not read your deadline, call this number today" is a useful sentence.
 * A confidently wrong date is the failure this whole product exists to prevent.
 */
import { endOfRenewalMonth, parseDate } from './dates';
import { FEDERAL_FLOOR, STATES, primaryHelpline } from './states';
import {
  ESCALATE,
  type CaseNumber,
  type Deadline,
  type DocumentId,
  type ExtractionResult,
  type RequiredDocument,
  type StateCode,
} from './types';

/**
 * Deadline phrasings, taken verbatim from the states' own forms and notices.
 *
 * Order matters. The most explicit phrasings are tried first so that a page
 * containing both "due date of March 3" and a stray unrelated date resolves to
 * the one the state actually meant.
 */
const DEADLINE_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'due-date-of', re: /\bdue\s+date\s+of\s+([^.;\n]{4,40})/i },
  { name: 'must-receive-by', re: /\bwe\s+must\s+receive\s+your\s+repl(?:y|ies)[^.\n]*?\bby\s+([^.;\n]{4,40})/i },
  { name: 'must-be-received-by', re: /\bmust\s+be\s+received\s+(?:by|before)\s+([^.;\n]{4,40})/i },
  { name: 'do-not-respond-by', re: /\bif\s+you\s+do\s+not\s+respond\s+by\s+([^.;\n]{4,40})/i },
  { name: 'respond-by', re: /\brespond\s+by\s+([^.;\n]{4,40})/i },
  { name: 'return-by', re: /\b(?:return|send|submit)[^.\n]{0,60}?\bby\s+([^.;\n]{4,40})/i },
  { name: 'reply-by', re: /\breply\s+by\s+([^.;\n]{4,40})/i },
  { name: 'complete-by', re: /\bcomplete[^.\n]{0,40}?\bby\s+([^.;\n]{4,40})/i },
  { name: 'deadline-is', re: /\b(?:deadline|fecha\s+limite)\s*(?:is|:)?\s*([^.;\n]{4,40})/i },
];

/**
 * Phrases that look like deadlines and are not.
 *
 * Pennsylvania's packet says the county office "will notify you within 30 days".
 * That is the agency's processing time, not the reader's deadline, and reading it
 * as one would tell someone they have a month when they may have a week.
 */
const DEADLINE_ANTI_PATTERNS: RegExp[] = [
  /\bwill\s+notify\s+you\s+within\b/i,
  /\bwithin\s+30\s+days\s+of\s+(?:receiving|a\s+complete)/i,
  /\bprocess(?:ing|ed)?\s+(?:your\s+)?(?:application|renewal)\s+within\b/i,
  /\ballow\s+up\s+to\s+\d+\s+days\b/i,
];

/** "by the end of your renewal month" needs a month named somewhere nearby. */
const RENEWAL_MONTH_RE = /\bby\s+the\s+end\s+of\s+(?:your|the)\s+renewal\s+month\b/i;

interface DocumentRule {
  id: DocumentId;
  label: string;
  triggers: RegExp[];
}

/**
 * Document taxonomy.
 *
 * Labels are written to be read aloud: short, one action each, no jargon. They
 * are what a person carries to a filing cabinet, so "Your last year's tax return"
 * beats "Prior-year federal income tax documentation".
 */
const DOCUMENT_RULES: DocumentRule[] = [
  {
    id: 'earned-income',
    label: 'Recent pay stubs for anyone who works',
    triggers: [/\bpay\s*stubs?\b/i, /\bproof\s+of\s+(?:earned\s+)?(?:income|wages)\b/i, /\bemployer\s+statement\b/i],
  },
  {
    id: 'self-employment',
    label: 'Self-employment records or a profit and loss statement',
    triggers: [/\bself[-\s]?employ/i, /\bprofit\s+and\s+loss\b/i],
  },
  {
    id: 'unearned-income',
    label: 'Award letters for Social Security, unemployment, pension, or VA benefits',
    triggers: [
      /\baward\s+letters?\b/i,
      /\bsocial\s+security\b/i,
      /\bunemployment\b/i,
      /\bpension\b/i,
      /\bbenefits?\s+letters?\b/i,
      // Georgia asks for this without naming any source: "Proof of any income
      // you receive other than by working."
      /\bincome\s+you\s+receive\b/i,
      /\bproof\s+of\s+any\s+income\b/i,
      /\bunearned\s+income\b/i,
    ],
  },
  {
    id: 'loss-of-income',
    label: 'Proof that a job ended, if someone stopped working',
    triggers: [/\bstopped\s+working\b/i, /\bjob\s+ended\b/i, /\bproof\s+.{0,20}job\s+ended\b/i, /\btermination\s+letter\b/i],
  },
  {
    id: 'prior-year-tax',
    label: "Last year's tax return",
    triggers: [/\btax\s+return\b/i, /\b1040\b/],
  },
  {
    id: 'citizenship',
    label: 'Proof of citizenship for any new household members',
    triggers: [/\bcitizenship\b/i, /\bproof\s+of\s+citizenship\b/i],
  },
  {
    id: 'immigration',
    label: 'Immigration documents, including your document or alien number',
    triggers: [/\bimmigration\s+status\b/i, /\balien\s+number\b/i, /\bpermanent\s+resident\b/i],
  },
  {
    id: 'residency',
    label: 'Proof of where you live',
    triggers: [/\bproof\s+of\s+residency\b/i, /\bproof\s+of\s+address\b/i],
  },
  {
    id: 'household-changes',
    label: 'Anything that changed in your household, such as a birth, marriage, or move',
    triggers: [/\bhousehold\s+changes?\b/i, /\bchanges?\s+in\s+your\s+household\b/i, /\bmarriage|birth|divorce\b/i],
  },
  {
    id: 'resources',
    label: 'Bank statements and other account statements',
    triggers: [/\bbank\s+statements?\b/i, /\bsavings\b/i, /\bchecking\s+account\b/i, /\bIRA\b|\b401[-\s]?K\b|\bKEOGH\b/i, /\bstocks?\s+(?:and|or)\s+bonds?\b/i],
  },
  {
    id: 'property-vehicles',
    label: 'Papers for property or vehicles you own',
    triggers: [/\breal\s+(?:estate|property)\b/i, /\bmotor\s+vehicles?\b/i, /\bdeed\b/i],
  },
  {
    id: 'life-insurance',
    label: 'Life insurance policy information',
    triggers: [/\blife\s+insurance\b/i, /\bcash\s+value\b/i],
  },
  {
    id: 'burial',
    label: 'Burial fund or funeral agreement papers',
    triggers: [/\bburial\b/i, /\bfuneral\s+agreement\b/i],
  },
  {
    id: 'asset-transfers',
    label: 'Records of anything you gave away or sold in the last five years',
    triggers: [/\btransfers?\s+of\s+assets?\b/i, /\bgifts?\b/i, /\blook[-\s]?back\b/i],
  },
  {
    id: 'disability-medical',
    label: 'Disability paperwork or unpaid medical bills',
    triggers: [/\bdisabilit/i, /\bmedical\s+bills?\b/i],
  },
  {
    id: 'work-hours',
    label: 'Proof of your work, school, or volunteer hours',
    triggers: [/\bqualifying\s+(?:activit|hours)/i, /\b80\s+hours\b/i, /\bcommunity\s+engagement\b/i, /\bPathways\b/],
  },
];

/** Collapse OCR whitespace so multi-line phrases still match as one string. */
export function normalize(text: string): string {
  return text.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

/** Same, but newlines become spaces, for patterns that span a line wrap. */
function flatten(text: string): string {
  return normalize(text).replace(/\n/g, ' ');
}

export function detectState(text: string): { state: StateCode | null; evidence?: string } {
  const flat = flatten(text);
  // Form codes are the strongest signal, so they win over generic anchors.
  for (const rules of Object.values(STATES)) {
    for (const code of rules.formCodes) {
      if (new RegExp(`\\b${code.replace(/\s+/g, '\\s*')}\\b`, 'i').test(flat)) {
        return { state: rules.code, evidence: code };
      }
    }
  }
  for (const rules of Object.values(STATES)) {
    for (const anchor of rules.stateAnchors) {
      if (new RegExp(`\\b${anchor.replace(/\s+/g, '\\s+')}\\b`, 'i').test(flat)) {
        return { state: rules.code, evidence: anchor };
      }
    }
  }
  return { state: null };
}

export function extractDeadline(text: string, state: StateCode | null): Deadline {
  const flat = flatten(text);

  for (const { name, re } of DEADLINE_PATTERNS) {
    const match = re.exec(flat);
    if (!match) continue;

    // Check the sentence the match sits in, not just the captured tail, so an
    // anti-pattern earlier in the sentence still disqualifies it.
    const start = Math.max(0, match.index - 80);
    const context = flat.slice(start, match.index + match[0].length + 40);
    if (DEADLINE_ANTI_PATTERNS.some((anti) => anti.test(context))) continue;

    const parsed = parseDate(match[1]);
    if (parsed) return { value: parsed.iso, evidence: match[0].trim(), pattern: name };
  }

  // Georgia states the deadline as a rule rather than a date. Resolve it only if
  // a renewal month is actually named; never assume the current month.
  if (RENEWAL_MONTH_RE.test(flat)) {
    const resolved = endOfRenewalMonth(flat);
    if (resolved) {
      return {
        value: resolved.iso,
        evidence: 'by the end of your renewal month',
        pattern: 'end-of-renewal-month',
      };
    }
  }

  void state;
  return { value: ESCALATE };
}

export function extractCaseNumber(text: string, state: StateCode | null): CaseNumber {
  const labels = state
    ? STATES[state].caseNumberLabels
    : Object.values(STATES).flatMap((s) => s.caseNumberLabels);
  const pattern = state ? STATES[state].caseNumberPattern : /^[A-Z0-9][A-Z0-9-]{4,19}$/i;

  const flat = flatten(text);
  for (const label of labels) {
    const re = new RegExp(`${label.replace(/\s+/g, '\\s+')}\\s*[:#]?\\s*([A-Z0-9][A-Z0-9-]{3,19})`, 'i');
    const match = re.exec(flat);
    if (match) {
      const candidate = match[1].toUpperCase().replace(/[-\s]+$/, '');
      if (pattern.test(candidate)) {
        return { value: candidate, evidence: match[0].trim(), label };
      }
    }
  }
  return { value: ESCALATE };
}

export function extractDocuments(text: string): RequiredDocument[] {
  const flat = flatten(text);
  const found: RequiredDocument[] = [];
  for (const rule of DOCUMENT_RULES) {
    for (const trigger of rule.triggers) {
      const match = trigger.exec(flat);
      if (match) {
        found.push({ id: rule.id, label: rule.label, evidence: match[0] });
        break;
      }
    }
  }
  return found;
}

/**
 * Build the sentence shown when something could not be read.
 *
 * Always names where to look for the reader's specific state, and always ends
 * with a phone number. "Call today" rather than "call soon", because the whole
 * problem is that people wait.
 */
export function buildEscalation(state: StateCode | null, deadlineMissing: boolean): string | null {
  if (!deadlineMissing) return null;
  const where = state ? STATES[state].deadlineLocationEn : FEDERAL_FLOOR.deadlineLocationEn;
  const help = primaryHelpline(state);
  return `${where} If you cannot find it, call ${help.name} at ${help.number} today.`;
}

/**
 * Run the deterministic path over OCR text.
 *
 * `pages` is one string per photographed page. They are joined rather than
 * searched separately, because the deadline routinely lives on a different sheet
 * from the form, which is the entire reason this product needs the notice too.
 */
export function extract(pages: string[]): ExtractionResult {
  const text = pages.map(normalize).join('\n');
  const { state, evidence } = detectState(text);

  const deadline = extractDeadline(text, state);
  const caseNumber = extractCaseNumber(text, state);
  const documents = extractDocuments(text);

  const deadlineMissing = deadline.value === ESCALATE;

  // If the deadline is missing AND this state carries it on a separate document,
  // the likely cause is that the reader photographed the form but not the notice.
  // That is a different, more actionable message than "we could not read it".
  const missingDeadlineCarrier =
    deadlineMissing && state !== null && STATES[state].deadlineCarrier !== 'form';

  return {
    state,
    stateEvidence: evidence,
    deadline,
    caseNumber,
    documents,
    missingDeadlineCarrier,
    escalation: buildEscalation(state, deadlineMissing),
  };
}
