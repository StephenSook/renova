/**
 * Ask a question about your own letter.
 *
 * This is the part a static explanation cannot do. People do not arrive with the
 * question the explanation answers; they arrive with "do I have to send my
 * husband's pay stubs too", "what if I already sent this", "does this mean my
 * kids too". Those answers are in the packet, and reading nineteen pages to find
 * one of them is the whole problem.
 *
 * The containment is the same as everywhere else. The model answers only from
 * the letter, is told to say it does not know rather than fill a gap, and the
 * answer is prose. No question can change the deadline, the case number, or the
 * checklist, because those never traverse the model at all.
 */
import { useCallback, useRef, useState } from 'react';
import type { Engine } from '@litert-lm/core';
import { buildQuestionPrompt, SYSTEM_PROMPT } from '../engine/prompt';
import { normalize } from '../engine/rules';
import { primaryHelpline } from '../engine/states';
import { generate } from '../model/engine';
import { MODEL_BUDGET_MS, type Analysis } from '../pipeline';


interface Props {
  analysis: Analysis;
  engine: Engine | null;
  language: 'en' | 'es';
}

/** Openers, so nobody faces an empty box wondering what is allowed. */
const SUGGESTIONS: Record<'en' | 'es', string[]> = {
  en: [
    'Do I have to send anything for my children?',
    'What happens if I already sent this?',
    'Where do I mail it?',
  ],
  es: [
    '¿Tengo que enviar algo para mis hijos?',
    '¿Qué pasa si ya envié esto?',
    '¿A dónde lo envío?',
  ],
};

export function AskQuestion({ analysis, engine, language }: Props) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [thinking, setThinking] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const es = language === 'es';
  const help = primaryHelpline(analysis.fields.state, language);

  const ask = useCallback(
    async (text: string) => {
      if (!engine || !text.trim()) return;
      setThinking(true);
      setFailed(false);
      setAnswer('');

      const packetText = analysis.pages.map((p) => normalize(p.text)).join('\n');
      try {
        const out = await generate(
          engine,
          buildQuestionPrompt(text.trim(), { fields: analysis.fields, packetText, language }),
          {
            system: SYSTEM_PROMPT,
            signal: AbortSignal.timeout(MODEL_BUDGET_MS),
            onToken: (chunk) => setAnswer((a) => a + chunk),
          },
        );
        if (!out.trim()) setFailed(true);
      } catch {
        // Silence would leave the reader staring at a box that did nothing.
        setFailed(true);
      } finally {
        setThinking(false);
      }
    },
    [analysis, engine, language],
  );

  if (!engine) return null;

  return (
    <section className="mt-9 border-t border-slate-line pt-5 no-print">
      <h2 className="text-[0.9375rem] font-bold uppercase tracking-[0.08em] text-slate-text">
        {es ? 'Pregunte sobre su carta' : 'Ask about your letter'}
      </h2>
      <p className="mt-2 text-[1rem] text-slate-text">
        {es
          ? 'La respuesta viene de su propia carta y se genera en este dispositivo.'
          : 'The answer comes from your own letter and is written on this device.'}
      </p>

      <form
        className="mt-4 flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <label className="sr-only" htmlFor="packet-question">
          {es ? 'Su pregunta' : 'Your question'}
        </label>
        <input
          id="packet-question"
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={es ? 'Escriba su pregunta' : 'Type your question'}
          className="min-h-14 min-w-60 flex-1 rounded border-2 border-slate-line px-4 text-[1.0625rem]"
        />
        <button
          type="submit"
          disabled={thinking || !question.trim()}
          className="min-h-14 rounded bg-gov px-7 text-[1.0625rem] font-bold text-white disabled:opacity-40"
        >
          {thinking ? (es ? 'Leyendo...' : 'Reading...') : es ? 'Preguntar' : 'Ask'}
        </button>
      </form>

      {!answer && !thinking && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS[language].map((s) => (
            <li key={s}>
              <button
                onClick={() => {
                  setQuestion(s);
                  void ask(s);
                }}
                className="min-h-11 rounded-full border border-slate-line px-4 text-[0.9375rem] text-slate-text"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div aria-live="polite">
        {answer && (
          <p className="mt-4 whitespace-pre-wrap rounded bg-gov-light p-4 text-[1.125rem]">
            {answer}
          </p>
        )}
        {failed && (
          <p className="mt-4 rounded border-l-4 border-warn bg-warn-bg p-4 text-[1.0625rem]">
            {es
              ? `No pudimos responder eso en este dispositivo. Llame a ${help.name} al ${help.number}.`
              : `We could not answer that on this device. Call ${help.name} at ${help.number}.`}
          </p>
        )}
      </div>

      {answer && (
        <p className="mt-3 text-[0.9375rem] text-slate-text">
          {es
            ? 'Esta respuesta es una explicación, no una decisión sobre su elegibilidad. Confirme con su oficina estatal.'
            : 'This answer is an explanation, not a decision about your eligibility. Confirm with your state office.'}
        </p>
      )}
    </section>
  );
}
