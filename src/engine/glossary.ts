/**
 * English to Spanish, locked.
 *
 * Every term here is sourced from a state's own published translation, chiefly
 * the New York DOH-5798 Spanish edition, supported by California's MC 216 SPA and
 * the CMS Spanish Uniform Glossary. The model is never allowed to translate any
 * of them.
 *
 * The reason is narrow and worth stating. A model asked to render "fair hearing"
 * in Spanish will produce something fluent, and fluent is not the bar. A person
 * reading "audiencia imparcial" can search for it, say it to a caseworker, and
 * find it on a state web page. An invented synonym is a dead end for someone who
 * is already out of time. So the model writes prose, and every term that could
 * cost someone coverage is substituted from this table.
 *
 * Accents are correct here on purpose. Some of the source research stripped
 * diacritics; "renovacion" is not a word, and shipping it to a Spanish-dominant
 * reader signals immediately that nobody who speaks the language checked.
 */
import type { StateCode } from './types';

export interface GlossaryEntry {
  en: string;
  es: string;
  source: string;
}

/** The 29 safety-critical terms. Never free-translated, in either direction. */
export const GLOSSARY: GlossaryEntry[] = [
  { en: 'renewal', es: 'renovación', source: 'NY DOH-5798 SPA' },
  { en: 'recertification', es: 'recertificación', source: 'NY DOH-5798 SPA' },
  { en: 'redetermination', es: 'redeterminación de la elegibilidad', source: 'CMS unwinding toolkit' },
  { en: 'deadline', es: 'fecha límite', source: 'CMS Spanish unwinding toolkit' },
  { en: 'due date', es: 'fecha límite', source: 'CMS Spanish unwinding toolkit' },
  { en: 'case number', es: 'número de caso', source: 'NY DOH-5798 SPA' },
  { en: 'proof of income', es: 'comprobante de ingresos', source: 'NY DOH-5798 SPA' },
  { en: 'pay stub', es: 'talón de pago', source: 'CMS/HHS Spanish materials' },
  { en: 'household', es: 'grupo familiar', source: 'CA MC 216 SPA' },
  { en: 'eligibility', es: 'elegibilidad', source: 'NY DOH-5798 SPA' },
  { en: 'coverage', es: 'cobertura', source: 'NY DOH-5798 SPA' },
  { en: 'terminate', es: 'cancelar', source: 'HHS Spanish sample letter' },
  { en: 'fair hearing', es: 'audiencia imparcial', source: 'CMS Spanish materials' },
  { en: 'notice', es: 'aviso', source: 'CMS Spanish materials' },
  { en: 'sign and date', es: 'firme y feche', source: 'NY DOH-5798 SPA' },
  { en: 'self-employment', es: 'trabajo por cuenta propia', source: 'CMS Spanish Uniform Glossary' },
  { en: 'resources', es: 'recursos', source: 'NY DOH-5798 SPA' },
  { en: 'citizenship', es: 'ciudadanía', source: 'CA MC 216 SPA' },
  { en: 'immigration status', es: 'estado migratorio', source: 'CA MC 216 SPA' },
  { en: 'income', es: 'ingresos', source: 'NY DOH-5798 SPA' },
  { en: 'health insurance', es: 'seguro médico', source: 'NY DOH-5798 SPA' },
  { en: 'spouse', es: 'cónyuge', source: 'NY DOH-5798 SPA' },
  { en: 'signature', es: 'firma', source: 'NY DOH-5798 SPA' },
  { en: 'penalties', es: 'sanciones', source: 'NY DOH-5798 SPA' },
  { en: 'life insurance', es: 'seguro de vida', source: 'NY DOH-5798 SPA' },
  { en: 'burial fund', es: 'fondo funerario', source: 'NY DOH-5798 SPA' },
  { en: 'disability benefits', es: 'beneficios por discapacidad', source: 'NY DOH-5798 SPA' },
  { en: 'renewal form', es: 'formulario de renovación', source: 'CA MC 216 SPA' },
  { en: 'authorized representative', es: 'representante autorizado', source: 'NY DOH-5798 SPA' },
];

/** Spanish labels for the document checklist, matching DocumentId in rules.ts. */
export const DOCUMENT_LABELS_ES: Record<string, string> = {
  'earned-income': 'Talones de pago recientes de todas las personas que trabajan',
  'self-employment': 'Registros de trabajo por cuenta propia o un estado de ganancias y pérdidas',
  'unearned-income':
    'Cartas de adjudicación del Seguro Social, desempleo, pensión o beneficios para veteranos',
  'loss-of-income': 'Comprobante de que un trabajo terminó, si alguien dejó de trabajar',
  'prior-year-tax': 'Su declaración de impuestos del año pasado',
  citizenship: 'Comprobante de ciudadanía para cualquier miembro nuevo del grupo familiar',
  immigration: 'Documentos de inmigración, incluyendo su número de documento o de extranjero',
  residency: 'Comprobante de dónde vive',
  'household-changes':
    'Cualquier cambio en su grupo familiar, como un nacimiento, un matrimonio o una mudanza',
  resources: 'Estados de cuenta bancarios y de otras cuentas',
  'property-vehicles': 'Documentos de propiedades o vehículos que usted tenga',
  'life-insurance': 'Información de su póliza de seguro de vida',
  burial: 'Documentos del fondo funerario o del acuerdo funerario',
  'asset-transfers': 'Registros de bienes que regaló o vendió en los últimos cinco años',
  'disability-medical': 'Documentos de discapacidad o facturas médicas sin pagar',
  'work-hours': 'Comprobante de sus horas de trabajo, escuela o voluntariado',
};

/**
 * Sentences rendered from code, never generated.
 *
 * These carry legal meaning or a phone number. Generating them would put the one
 * component that can hallucinate in charge of the one sentence that has to be
 * exactly right.
 */
export const ES = {
  disclaimer:
    'Esta herramienta explica su paquete de renovación en lenguaje sencillo. No es asesoramiento legal y no reemplaza la orientación de su oficina estatal de Medicaid. Confirme siempre su fecha límite y los documentos requeridos con su agencia estatal de Medicaid.',

  /**
   * The single highest-value sentence in the product.
   *
   * Federal law (42 CFR 435.916) gives a person 90 days to return the form and
   * be reconsidered without reapplying. Most people have never been told this.
   * For the seven in ten who lost coverage to paperwork rather than to income,
   * this one line is the difference between a gap and no gap.
   */
  ninetyDay:
    'Si no cumple con la fecha límite, por lo general tiene 90 días para enviar el formulario y recuperar su cobertura sin volver a solicitarla.',

  deadlineLabel: 'Su fecha límite',
  caseNumberLabel: 'Su número de caso',
  documentsLabel: 'Lo que debe enviar',
  daysLeft: (n: number) =>
    n === 1 ? 'Queda 1 día' : n > 0 ? `Quedan ${n} días` : 'La fecha límite ya pasó',
  callToday: (name: string, number: string) => `Llame a ${name} al ${number} hoy mismo.`,
  cannotRead:
    'No pudimos leer su fecha límite. No vamos a adivinarla, porque una fecha equivocada podría costarle su cobertura.',
} as const;

export const EN = {
  deadlineLabel: 'Your deadline',
  caseNumberLabel: 'Your case number',
  documentsLabel: 'What to send',
  daysLeft: (n: number) =>
    n === 1 ? '1 day left' : n > 0 ? `${n} days left` : 'This deadline has passed',
  callToday: (name: string, number: string) => `Call ${name} at ${number} today.`,
  cannotRead:
    'We could not read your deadline. We will not guess it, because a wrong date could cost you your coverage.',
} as const;

/** Program name in Spanish, which differs by state. */
export function programNameEs(state: StateCode | null): string {
  if (!state) return 'Medicaid';
  return { CA: 'Medi-Cal', NY: 'Medicaid', GA: 'Medicaid', PA: 'Asistencia Médica' }[state];
}

/**
 * Replace any glossary term the model used with the locked translation.
 *
 * Longest terms first, so "renewal form" is not half-replaced by "renewal".
 * Case-insensitive, and the original capitalisation of the first letter is kept
 * so a substitution mid-sentence does not shout.
 */
const SORTED = [...GLOSSARY].sort((a, b) => b.en.length - a.en.length);

export function enforceGlossary(spanishProse: string): {
  text: string;
  substitutions: { en: string; es: string }[];
} {
  let text = spanishProse;
  const substitutions: { en: string; es: string }[] = [];

  for (const entry of SORTED) {
    const re = new RegExp(`\\b${entry.en.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
    if (!re.test(text)) continue;
    re.lastIndex = 0;
    text = text.replace(re, (match) =>
      match[0] === match[0].toUpperCase()
        ? entry.es.charAt(0).toUpperCase() + entry.es.slice(1)
        : entry.es,
    );
    substitutions.push({ en: entry.en, es: entry.es });
  }

  return { text, substitutions };
}

/**
 * Reject Spanish that came back corrupted.
 *
 * Small models and some runtimes drop or garble multibyte characters, which
 * turns "año" into "ao" and "niño" into "nio". Those are different words or no
 * words, and a reader sees a tool that does not really speak their language.
 * When this trips, the caller falls back to the templated rendering.
 */
const ES_MARKERS =
  /\b(usted|su|sus|para|que|debe|puede|necesita|documentos|antes|enviar|cobertura|fecha|carta|formulario)\b/gi;
const EN_MARKERS =
  /\b(the|you|your|this|need|must|send|before|coverage|letter|documents|deadline|form)\b/gi;

export function isSpanishIntact(text: string): boolean {
  if (!text.trim()) return false;
  // The replacement character means bytes were already lost.
  if (text.includes('\uFFFD')) return false;
  // Mojibake signature: UTF-8 read as Latin-1 produces these pairs.
  if (/[\u00C3\u00C2][\u00A0-\u00BF]/.test(text)) return false;

  /*
   * Is it actually Spanish?
   *
   * Everything above only proves the bytes survived. A small model given an
   * English system prompt and an English task line frequently answers in English
   * anyway, and English prose passes every encoding check. Worse, it then goes
   * through enforceGlossary, which substitutes terms in place and produces
   * "You must send comprobante de ingresos before the fecha limite", served to a
   * Spanish-dominant reader as their explanation.
   *
   * Counting markers is crude and sufficient: the two vocabularies do not
   * overlap, and the fallback when this returns false is the templated
   * rendering, which is always correct.
   */
  const es = (text.match(ES_MARKERS) ?? []).length;
  const en = (text.match(EN_MARKERS) ?? []).length;
  return es > en;
}
