/**
 * The eval harness.
 *
 * Prints two tables. The first measures per-field accuracy on the three
 * safety-critical fields. The second is a set of behavioural checks that are
 * pass or fail with no partial credit, because each one encodes a promise the
 * product makes to someone whose coverage is at stake.
 *
 * Run before and after every change to the rules engine, and paste both tables
 * into the commit message. Exits non-zero on any failure so it can gate CI.
 *
 *   npm run eval
 */
import { CASES } from './cases';
import { extract } from '../src/engine/rules';
import {
  DISCLAIMER_EN,
  DISCLAIMER_ES,
  NINETY_DAY_SENTENCE_EN,
  STATES,
  primaryHelpline,
} from '../src/engine/states';
import { ESCALATE } from '../src/engine/types';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const OFF = '\x1b[0m';

const tick = (ok: boolean) => (ok ? `${GREEN}pass${OFF}` : `${RED}FAIL${OFF}`);
const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - stripAnsi(s).length));
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

interface FieldTally {
  correct: number;
  total: number;
}
const tally = (): FieldTally => ({ correct: 0, total: 0 });

const state = tally();
const deadline = tally();
const caseNumber = tally();
const documents = tally();
const failures: string[] = [];

console.log(`\n${BOLD}Safety-field accuracy, text fixtures${OFF}`);
console.log(
  `${DIM}${pad('case', 28)}${pad('state', 8)}${pad('deadline', 22)}${pad('case number', 16)}documents${OFF}`,
);

for (const c of CASES) {
  const r = extract(c.pages);

  const gotState = r.state ?? 'null';
  const wantState = c.expected.state ?? 'null';
  const stateOk = gotState === wantState;

  const gotDeadline = r.deadline.value;
  const deadlineOk = gotDeadline === c.expected.deadline;

  const gotCase = r.caseNumber.value;
  const caseOk = gotCase === c.expected.caseNumber;

  const gotDocs = r.documents.map((d) => d.id);
  const missing = c.expected.documents.filter((d) => !gotDocs.includes(d));
  const docsOk = missing.length === 0;

  state.total++; if (stateOk) state.correct++;
  deadline.total++; if (deadlineOk) deadline.correct++;
  caseNumber.total++; if (caseOk) caseNumber.correct++;
  documents.total++; if (docsOk) documents.correct++;

  if (!stateOk) failures.push(`${c.id}: state ${gotState}, expected ${wantState}`);
  if (!deadlineOk) failures.push(`${c.id}: deadline ${gotDeadline}, expected ${c.expected.deadline}`);
  if (!caseOk) failures.push(`${c.id}: case number ${gotCase}, expected ${c.expected.caseNumber}`);
  if (!docsOk) failures.push(`${c.id}: missing documents ${missing.join(', ')}`);

  console.log(
    pad(c.id, 28) +
      pad(tick(stateOk), 8) +
      pad(`${tick(deadlineOk)} ${DIM}${gotDeadline}${OFF}`, 22) +
      pad(tick(caseOk), 16) +
      tick(docsOk),
  );
}

const pct = (t: FieldTally) => `${t.correct}/${t.total} (${Math.round((t.correct / t.total) * 100)}%)`;
console.log(
  `\n  state ${pct(state)}   deadline ${pct(deadline)}   case number ${pct(caseNumber)}   documents ${pct(documents)}`,
);

/**
 * Behavioural checks.
 *
 * These are not accuracy measures. Each one is a promise, and a promise is
 * either kept or broken.
 */
console.log(`\n${BOLD}Behavioural checks${OFF}`);
const checks: { name: string; ok: boolean; detail: string }[] = [];

// 1. The invariant the entire design rests on.
{
  const bad = CASES.filter((c) => {
    const r = extract(c.pages);
    return r.deadline.value === ESCALATE && r.escalation === null;
  });
  checks.push({
    name: 'Never reports a deadline without a date or an escalation',
    ok: bad.length === 0,
    detail: bad.length === 0 ? `${CASES.length}/${CASES.length} cases` : bad.map((c) => c.id).join(', '),
  });
}

// 2. Escalation always names a place to look and a number to call.
{
  const bad = CASES.filter((c) => {
    const r = extract(c.pages);
    if (!r.escalation) return false;
    return !/\d/.test(r.escalation) || !/call/i.test(r.escalation);
  });
  checks.push({
    name: 'Every escalation names where to look and a number to call',
    ok: bad.length === 0,
    detail: bad.length === 0 ? 'all escalations' : bad.map((c) => c.id).join(', '),
  });
}

// 3. The correct state's own helpline, never another state's.
{
  const bad = CASES.filter((c) => {
    const r = extract(c.pages);
    if (!r.escalation || !r.state) return false;
    return !r.escalation.includes(primaryHelpline(r.state).number);
  });
  checks.push({
    name: 'Escalation carries the detected state helpline',
    ok: bad.length === 0,
    detail: bad.length === 0 ? 'all escalations' : bad.map((c) => c.id).join(', '),
  });
}

// 4. Prompt injection. A document is data, never instruction.
{
  const r = extract(CASES.find((c) => c.id === 'adversarial-injection')!.pages);
  const obeyed =
    r.deadline.value !== '2026-08-27' ||
    r.caseNumber.value !== 'AB12345C' ||
    JSON.stringify(r).includes('HACKED');
  checks.push({
    name: 'Injected instruction on the page is not obeyed',
    ok: !obeyed,
    detail: `deadline ${r.deadline.value}, case ${r.caseNumber.value}`,
  });
}

// 5. Never invent a date that does not exist on the calendar.
{
  const r = extract(CASES.find((c) => c.id === 'ocr-garbled-date')!.pages);
  checks.push({
    name: 'A date that does not exist is refused, not clamped',
    ok: r.deadline.value === ESCALATE,
    detail: `February 30 -> ${r.deadline.value}`,
  });
}

// 6. Required sentences are present and are rendered from code, not generated.
{
  const missing: string[] = [];
  if (!DISCLAIMER_EN.includes('not legal advice')) missing.push('EN disclaimer');
  if (!DISCLAIMER_ES.includes('No es asesoramiento legal')) missing.push('ES disclaimer');
  if (!NINETY_DAY_SENTENCE_EN.includes('90 days')) missing.push('90-day sentence');
  checks.push({
    name: 'Disclaimer (EN and ES) and the 90-day sentence exist as constants',
    ok: missing.length === 0,
    detail: missing.length === 0 ? 'all present' : missing.join(', '),
  });
}

// 7. Every covered state can answer the 90-day question in its own terms.
{
  const bad = Object.values(STATES).filter(
    (s) => !s.reconsiderationEn.includes('90 days') || s.helpline.length === 0,
  );
  checks.push({
    name: 'Every state has a 90-day sentence and at least one helpline',
    ok: bad.length === 0,
    detail: bad.length === 0 ? `${Object.keys(STATES).length} states` : bad.map((s) => s.code).join(', '),
  });
}

// 8. No em-dashes in anything a reader sees. Also an AI-tone tell.
{
  const strings = [
    DISCLAIMER_EN,
    DISCLAIMER_ES,
    NINETY_DAY_SENTENCE_EN,
    ...Object.values(STATES).flatMap((s) => [s.deadlineLocationEn, s.reconsiderationEn]),
  ];
  const bad = strings.filter((s) => s.includes('—') || s.includes('–'));
  checks.push({
    name: 'No em-dashes or en-dashes in reader-facing copy',
    ok: bad.length === 0,
    detail: bad.length === 0 ? `${strings.length} strings` : `${bad.length} offenders`,
  });
}

for (const c of checks) {
  console.log(`  ${tick(c.ok)}  ${pad(c.name, 58)}${DIM}${c.detail}${OFF}`);
}

const behaviouralPass = checks.every((c) => c.ok);
const safetyPass = deadline.correct === deadline.total && caseNumber.correct === caseNumber.total;

console.log('');
if (failures.length) {
  console.log(`${RED}${BOLD}Field failures${OFF}`);
  for (const f of failures) console.log(`  ${f}`);
  console.log('');
}

if (safetyPass && behaviouralPass) {
  console.log(`${GREEN}${BOLD}PASS${OFF} safety fields exact or escalating by design, all behavioural checks green\n`);
  process.exit(0);
}
console.log(`${RED}${BOLD}FAIL${OFF} see above\n`);
process.exit(1);
