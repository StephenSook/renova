/**
 * The answer.
 *
 * Reading order is the priority order, deliberately: the deadline is the largest
 * thing on the page, then the case number, then what to send. Someone standing
 * at a kitchen table holding a nineteen-page packet needs the date before they
 * need anything else, and a layout that makes them hunt for it has failed no
 * matter how correct it is.
 *
 * Everything with legal weight (the disclaimer, the 90-day right, the helpline)
 * is rendered from constants. The model's prose sits in one clearly bounded
 * block and nowhere else.
 */
import { formatLong } from '../engine/dates';
import { mismatchMessage } from '../engine/crosscheck';
import { DOCUMENT_LABELS_ES, ES, EN, programNameEs } from '../engine/glossary';
import { DISCLAIMER_EN, DISCLAIMER_ES, STATES, primaryHelpline } from '../engine/states';
import { ESCALATE } from '../engine/types';
import { closingLines, urgency, type Analysis } from '../pipeline';

interface Props {
  analysis: Analysis;
  language: 'en' | 'es';
  onLanguageChange: (l: 'en' | 'es') => void;
  onSpeak?: () => void;
  speaking?: boolean;
}

export function Result({ analysis, language, onLanguageChange, onSpeak, speaking }: Props) {
  const { fields } = analysis;
  const es = language === 'es';
  const L = es ? ES : EN;
  const days = urgency(fields);
  const closing = closingLines(fields, language);
  const help = primaryHelpline(fields.state);
  const program = es ? programNameEs(fields.state) : (fields.state ? STATES[fields.state].programEn : 'Medicaid');

  return (
    <article className="mx-auto max-w-2xl px-5 pb-24" lang={language}>
      <header className="flex items-center justify-between gap-4 py-5 no-print">
        <p className="text-[0.9375rem] text-slate-text">
          {program}
          {fields.state ? ` (${fields.state})` : ''}
        </p>
        <div
          className="flex overflow-hidden rounded-full border-2 border-gov"
          role="group"
          aria-label={es ? 'Idioma' : 'Language'}
        >
          {(['en', 'es'] as const).map((code) => (
            <button
              key={code}
              onClick={() => onLanguageChange(code)}
              aria-pressed={language === code}
              className={`min-h-11 px-5 text-[0.9375rem] font-semibold ${
                language === code
                  ? 'bg-gov text-white'
                  : 'bg-white text-gov'
              }`}
            >
              {code === 'en' ? 'English' : 'Español'}
            </button>
          ))}
        </div>
      </header>

      {analysis.mismatches.map((m) => (
        <MismatchBanner key={m.field} message={mismatchMessage(m, language)} value={m.fromDocument} language={language} />
      ))}

      {analysis.lowQualityPages.length > 0 && (
        <p className="mb-5 rounded border-l-4 border-warn bg-warn-bg p-4 text-[1rem]">
          {es
            ? 'Algunas fotos salieron borrosas. Si algo se ve mal, tome la foto otra vez con más luz.'
            : 'Some photos came out blurry. If anything looks wrong, retake it with more light.'}
        </p>
      )}

      {/* The deadline. Largest element on the page, by design. */}
      <section className="border-t-4 border-ink pt-5">
        <h2 className="text-[0.9375rem] font-bold uppercase tracking-[0.08em] text-slate-text">
          {L.deadlineLabel}
        </h2>

        {fields.deadline.value === ESCALATE ? (
          <div className="mt-2">
            <p className="display-sm text-alert">{L.cannotRead}</p>
            <p className="mt-4 text-[1.125rem]">
              {es
                ? fields.state
                  ? STATES[fields.state].deadlineLocationEn
                  : ''
                : fields.escalation}
            </p>
            <a
              href={`tel:${help.number.replace(/[^\d+]/g, '')}`}
              className="mt-4 inline-flex min-h-14 items-center rounded bg-alert px-6 text-[1.125rem] font-bold text-white"
            >
              {L.callToday(help.name, help.number)}
            </a>
          </div>
        ) : (
          <div className="mt-1">
            <p className="display leading-[0.9]">{formatLong(fields.deadline.value, es ? 'es-US' : 'en-US')}</p>
            <p
              className={`mt-2 text-[1.25rem] font-bold ${
                days !== null && days <= 7 ? 'text-alert' : 'text-slate-text'
              }`}
            >
              {days !== null ? L.daysLeft(days) : ''}
            </p>
          </div>
        )}
      </section>

      <section className="mt-9 border-t border-slate-line pt-5">
        <h2 className="text-[0.9375rem] font-bold uppercase tracking-[0.08em] text-slate-text">
          {L.caseNumberLabel}
        </h2>
        <p className="display-sm mt-1 font-mono tracking-tight">
          {fields.caseNumber.value === ESCALATE
            ? es
              ? 'No lo pudimos leer'
              : 'We could not read it'
            : fields.caseNumber.value}
        </p>
      </section>

      {fields.documents.length > 0 && (
        <section className="mt-9 border-t border-slate-line pt-5">
          <h2 className="text-[0.9375rem] font-bold uppercase tracking-[0.08em] text-slate-text">
            {L.documentsLabel}
          </h2>
          <ul className="mt-3 space-y-1">
            {fields.documents.map((doc) => (
              <li key={doc.id}>
                <label className="flex min-h-14 cursor-pointer items-center gap-4 rounded px-2 py-2 text-[1.125rem] hover:bg-gov-light">
                  <input
                    type="checkbox"
                    className="size-7 shrink-0 accent-gov"
                  />
                  <span>{es ? (DOCUMENT_LABELS_ES[doc.id] ?? doc.label) : doc.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(analysis.explanationEn || analysis.explanationEs) && (
        <section className="mt-9 border-t border-slate-line pt-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-[0.9375rem] font-bold uppercase tracking-[0.08em] text-slate-text">
              {es ? 'Qué dice esta carta' : 'What this letter says'}
            </h2>
            {onSpeak && (
              <button
                onClick={onSpeak}
                className="min-h-11 rounded-full border-2 border-gov px-5 text-[0.9375rem] font-semibold text-gov no-print"
              >
                {speaking ? (es ? 'Detener' : 'Stop') : es ? 'Escuchar' : 'Listen'}
              </button>
            )}
          </div>

          {es && analysis.spanishFellBack ? (
            <p className="mt-3 text-[1.125rem]">
              La explicación en español no se pudo generar correctamente en este dispositivo. La
              información importante que aparece arriba es completa y correcta.
            </p>
          ) : (
            <p className="mt-3 whitespace-pre-wrap text-[1.125rem]">
              {es ? analysis.explanationEs : analysis.explanationEn}
            </p>
          )}
        </section>
      )}

      {/* Always present, in every output, in both languages. */}
      <section className="mt-9 rounded border-l-4 border-gov bg-gov-light p-5">
        <p className="text-[1.125rem] font-semibold">{closing.ninetyDay}</p>
      </section>

      <footer className="mt-8 space-y-3 border-t border-slate-line pt-5 text-[1rem] text-slate-text">
        <p>{closing.help}</p>
        <p>{es ? DISCLAIMER_ES : DISCLAIMER_EN}</p>
      </footer>
    </article>
  );
}

/**
 * Disagreement, shown rather than resolved.
 *
 * Two readers looked at the same page and reached different answers. The honest
 * response is to say so, put the value taken from the document on top, and let
 * the person check the paper in their hand.
 */
function MismatchBanner({
  message,
  value,
  language,
}: {
  message: string;
  value: string;
  language: 'en' | 'es';
}) {
  return (
    <div
      role="alert"
      className="mb-5 rounded border-l-4 border-warn bg-warn-bg p-4"
    >
      <p className="text-[1.0625rem] font-semibold">{message}</p>
      <p className="mt-2 text-[0.9375rem] uppercase tracking-[0.06em] text-slate-text">
        {language === 'es' ? 'De su documento' : 'From your document'}
      </p>
      <p className="text-[1.25rem] font-bold">{value}</p>
    </div>
  );
}
