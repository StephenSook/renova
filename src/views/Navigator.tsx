/**
 * Navigator mode.
 *
 * The same engine, aimed at the person sitting across the desk rather than the
 * person holding the letter. Community health workers, benefits navigators, and
 * hospital financial counsellors process renewal packets one client at a time,
 * often in a community room with unreliable wifi, and often for someone who is
 * anxious about where their documents are going.
 *
 * Two things make this mode worth building rather than describing:
 *
 *   - The strongest published evidence on reducing procedural disenrollment
 *     points at state-side automation and human assistance. This is the human
 *     assistance lever, made faster and more consistent.
 *   - It is the only surface where the tool is a workflow rather than a
 *     document. Time-to-checklist is shown because that is the number a program
 *     manager asks about.
 *
 * The queue lives in memory and nowhere else. Refresh the page and it is gone,
 * which is the correct behaviour for a list of other people's case numbers
 * sitting on a shared laptop.
 */
import { useState } from 'react';
import { formatLong } from '../engine/dates';
import { STATES } from '../engine/states';
import { ESCALATE } from '../engine/types';
import { urgency, type Analysis } from '../pipeline';

export interface QueueEntry {
  id: string;
  /** Whatever the navigator wants to call this client. Never a real name by default. */
  label: string;
  analysis: Analysis;
  /** Wall-clock seconds from photographs chosen to checklist on screen. */
  seconds: number;
}

interface Props {
  queue: QueueEntry[];
  onAdd: () => void;
  onOpen: (entry: QueueEntry) => void;
  onClear: () => void;
  busy: boolean;
}

export function NavigatorQueue({ queue, onAdd, onOpen, onClear, busy }: Props) {
  const [note, setNote] = useState('');

  const median =
    queue.length > 0
      ? [...queue.map((q) => q.seconds)].sort((a, b) => a - b)[Math.floor(queue.length / 2)]
      : null;

  return (
    <section className="mx-auto max-w-3xl px-5 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-sm">Navigator</h1>
          <p className="mt-2 max-w-[54ch] text-[1.0625rem] text-slate-text">
            Read a client's packet, hand them the checklist, move on. Nothing is uploaded and
            nothing is saved. Closing this page erases the list.
          </p>
        </div>
        {median !== null && (
          <p className="text-right">
            <span className="display-sm block leading-none">{median.toFixed(0)}s</span>
            <span className="text-[0.9375rem] text-slate-text">median time to checklist</span>
          </p>
        )}
      </header>

      <div className="mt-8 flex flex-wrap items-center gap-3 no-print">
        <label className="sr-only" htmlFor="client-label">
          Label for this client
        </label>
        <input
          id="client-label"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Label, for example: Tuesday walk-in 3"
          className="min-h-14 min-w-64 flex-1 rounded border-2 border-slate-line px-4 text-[1.0625rem]"
        />
        <button
          onClick={onAdd}
          disabled={busy}
          className="min-h-14 rounded bg-gov px-7 text-[1.0625rem] font-bold text-white disabled:opacity-40"
        >
          {busy ? 'Reading...' : 'Read a packet'}
        </button>
        {queue.length > 0 && (
          <button
            onClick={onClear}
            className="min-h-14 rounded-full px-5 text-[1rem] text-slate-text underline"
          >
            Clear the list
          </button>
        )}
      </div>

      <p className="mt-3 text-[0.9375rem] text-slate-text no-print">
        Use a label, not a name. This is a shared screen.
      </p>

      {queue.length === 0 ? (
        <p className="mt-10 border-t border-slate-line pt-8 text-[1.125rem] text-slate-text">
          No packets read yet.
        </p>
      ) : (
        <ol className="mt-8 border-t border-slate-line">
          {queue.map((entry) => {
            const days = urgency(entry.analysis.fields);
            const escalated = entry.analysis.fields.deadline.value === ESCALATE;
            const state = entry.analysis.fields.state;

            return (
              <li key={entry.id} className="border-b border-slate-line">
                <button
                  onClick={() => onOpen(entry)}
                  className="flex w-full items-center gap-5 py-5 text-left hover:bg-gov-light"
                >
                  <span
                    aria-hidden
                    className={`h-14 w-1.5 shrink-0 rounded-full ${
                      escalated || (days !== null && days <= 7)
                        ? 'bg-alert'
                        : days !== null && days <= 21
                          ? 'bg-warn'
                          : 'bg-ok'
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[1.125rem] font-semibold">
                      {entry.label}
                    </span>
                    <span className="block text-[0.9375rem] text-slate-text">
                      {state ? `${STATES[state].programEn} (${state})` : 'State not identified'}
                      {' · '}
                      {entry.analysis.fields.caseNumber.value === ESCALATE
                        ? 'case number unread'
                        : entry.analysis.fields.caseNumber.value}
                      {' · '}
                      read in {entry.seconds.toFixed(0)}s
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {escalated ? (
                      <span className="text-[1.0625rem] font-bold text-alert">Call the state</span>
                    ) : (
                      <>
                        <span className="block text-[1.0625rem] font-semibold">
                          {formatLong(entry.analysis.fields.deadline.value)}
                        </span>
                        <span
                          className={`block text-[0.9375rem] ${
                            days !== null && days <= 7 ? 'font-bold text-alert' : 'text-slate-text'
                          }`}
                        >
                          {days !== null && days > 0 ? `${days} days left` : 'passed'}
                        </span>
                      </>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {queue.length > 0 && (
        <p className="mt-6 text-[0.9375rem] text-slate-text">
          Red means the deadline is inside a week or could not be read. Those are the ones to call
          the state about while the client is still in the room.
        </p>
      )}
    </section>
  );
}
