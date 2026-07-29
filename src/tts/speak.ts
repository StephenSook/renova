/**
 * Read the answer aloud.
 *
 * This uses the operating system's own speech synthesis rather than a neural TTS
 * model, and that is a decision rather than a shortcut.
 *
 * Kokoro would sound better. It also costs 86 to 155 MB of weights, a second
 * onnxruntime session competing for the same 8 GB of unified memory the language
 * model is already using, and another fetch from Hugging Face on a page whose
 * verification screen now reports zero external requests. `speechSynthesis` is
 * zero bytes, genuinely offline (macOS, Windows, Android and iOS all ship
 * Spanish voices locally), costs no memory, and for a reader with low vision it
 * speaks in the voice their device already uses for everything else.
 *
 * What is read is chosen carefully. Not the whole page: the deadline, how long
 * is left, the case number, what to send, and the 90-day right. Those are the
 * things someone needs while looking for a folder rather than at a screen.
 */
import { formatLong } from '../engine/dates';
import { DOCUMENT_LABELS_ES, ES, EN } from '../engine/glossary';
import { NINETY_DAY_SENTENCE_EN, primaryHelpline } from '../engine/states';
import { ESCALATE } from '../engine/types';
import { closingLines, urgency, type Analysis } from '../pipeline';

export interface Voice {
  name: string;
  lang: string;
}

/**
 * Pick a voice for the language, preferring regional Spanish that matches the
 * audience. Latin American Spanish first, because that is who this is for.
 */
export function pickVoice(language: 'en' | 'es'): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;

  const order =
    language === 'es'
      ? ['es-MX', 'es-US', 'es-419', 'es-ES', 'es']
      : ['en-US', 'en-GB', 'en'];

  for (const tag of order) {
    const hit = voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(tag.toLowerCase()));
    if (hit) return hit;
  }
  return null;
}

export function isSpeechAvailable(language: 'en' | 'es'): boolean {
  return typeof speechSynthesis !== 'undefined' && pickVoice(language) !== null;
}

/**
 * Build the spoken script.
 *
 * Every sentence here is rendered from the deterministic fields and the locked
 * glossary, never from model prose. Speech is harder to double-check than text,
 * so the thing being read aloud must be the thing we are surest of.
 */
export function buildScript(analysis: Analysis, language: 'en' | 'es'): string {
  const { fields } = analysis;
  const es = language === 'es';
  const L = es ? ES : EN;
  const days = urgency(fields);
  const help = primaryHelpline(fields.state);
  const lines: string[] = [];

  if (fields.deadline.value === ESCALATE) {
    lines.push(es ? ES.cannotRead : EN.cannotRead);
    lines.push(L.callToday(help.name, help.number));
  } else {
    lines.push(
      es
        ? `Su fecha límite es el ${formatLong(fields.deadline.value, 'es-US')}.`
        : `Your deadline is ${formatLong(fields.deadline.value)}.`,
    );
    if (days !== null) lines.push(L.daysLeft(days) + '.');
  }

  if (fields.caseNumber.value !== ESCALATE) {
    // Spaced out so a screen reader and a synthesiser both say the characters
    // one at a time rather than trying to pronounce "AB12345C" as a word.
    const spoken = fields.caseNumber.value.split('').join(' ');
    lines.push(es ? `Su número de caso es ${spoken}.` : `Your case number is ${spoken}.`);
  }

  if (fields.documents.length) {
    lines.push(es ? 'Esto es lo que debe enviar.' : 'Here is what to send.');
    for (const doc of fields.documents) {
      lines.push((es ? (DOCUMENT_LABELS_ES[doc.id] ?? doc.label) : doc.label) + '.');
    }
  }

  lines.push(es ? ES.ninetyDay : NINETY_DAY_SENTENCE_EN);
  lines.push(closingLines(fields, language).help);

  return lines.join(' ');
}

let current: SpeechSynthesisUtterance | null = null;

/**
 * Speak, and report when it stops for any reason.
 *
 * The `onEnd` callback fires on completion, on cancel, and on error alike. On a
 * product for low-vision readers a button stuck on "Stop" after the audio has
 * already failed is its own small trap, so every exit path is reported rather
 * than only the happy one.
 */
export function speak(
  text: string,
  language: 'en' | 'es',
  onEnd?: (reason: 'done' | 'cancelled' | 'error') => void,
): boolean {
  if (typeof speechSynthesis === 'undefined') {
    onEnd?.('error');
    return false;
  }

  stop();

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(language);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = language === 'es' ? 'es-MX' : 'en-US';
  }
  // Slightly under default. This is read by people acting on it, not skimming.
  utterance.rate = 0.92;

  utterance.onend = () => {
    current = null;
    onEnd?.('done');
  };
  utterance.onerror = (event) => {
    current = null;
    onEnd?.(event.error === 'interrupted' || event.error === 'canceled' ? 'cancelled' : 'error');
  };

  current = utterance;
  speechSynthesis.speak(utterance);
  return true;
}

export function stop(): void {
  if (typeof speechSynthesis === 'undefined') return;
  if (current || speechSynthesis.speaking || speechSynthesis.pending) {
    current = null;
    speechSynthesis.cancel();
  }
}

/**
 * Voices load asynchronously in most browsers, and `getVoices()` is empty on the
 * first call. Resolve once they arrive so the Listen button is not offered
 * before it can work, or hidden when it could.
 */
export function whenVoicesReady(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === 'undefined') return resolve();
    if (speechSynthesis.getVoices().length) return resolve();

    const done = () => {
      speechSynthesis.removeEventListener('voiceschanged', done);
      resolve();
    };
    speechSynthesis.addEventListener('voiceschanged', done);
    // Some browsers never fire the event. Do not hang the UI on it.
    setTimeout(done, 1500);
  });
}
