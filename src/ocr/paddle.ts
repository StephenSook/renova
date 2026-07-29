/**
 * OCR, in the browser, from our own origin.
 *
 * PP-OCRv5 detection and Latin recognition run on onnxruntime-web, preferring
 * WebGPU and falling back to wasm. The models are vendored into
 * `public/models/ocr/` by `scripts/fetch-ocr-models.mjs` rather than fetched from
 * GitHub at runtime, because the library's defaults would break offline start
 * and would put third-party requests in the Network tab while the product claims
 * there are none.
 *
 * The Latin recognizer is chosen over a plain English one on purpose. California
 * publishes MC 216 in Spanish and a reader may photograph either language, and
 * dropping an accent inside a case number or a document name is a silent
 * corruption nobody downstream can detect.
 */
import { env } from 'onnxruntime-web';
import { PaddleOcrService, isWebGpuAvailable } from 'ppu-paddle-ocr/web';

/**
 * Serve onnxruntime's own wasm from this origin.
 *
 * Left at its default, onnxruntime-web fetches its runtime from
 * cdn.jsdelivr.net the first time a session is created. It is a transitive
 * dependency, so nothing in this codebase asks for it and nothing in the build
 * output shows it; the app's own verification screen is what surfaced it, by
 * reporting an external host on a page that promises none.
 *
 * Two consequences if this line is removed: OCR cannot initialize in airplane
 * mode, and a judge watching the Network tab sees a CDN request while being told
 * nothing leaves the device.
 */
env.wasm.wasmPaths = `${import.meta.env.BASE_URL}ort/`;

const MODEL = {
  detection: `${import.meta.env.BASE_URL}models/ocr/det.onnx`,
  recognition: `${import.meta.env.BASE_URL}models/ocr/rec.onnx`,
  charactersDictionary: `${import.meta.env.BASE_URL}models/ocr/dict.txt`,
};

export interface OcrLine {
  text: string;
  confidence: number;
  /** Bounding box in the original image's coordinates, for showing provenance. */
  box: { x: number; y: number; width: number; height: number } | null;
}

export interface OcrPage {
  /** Lines in reading order, joined with newlines. This is what the rules engine reads. */
  text: string;
  lines: OcrLine[];
  /** Mean confidence across lines, 0 to 1. */
  confidence: number;
}

let servicePromise: Promise<PaddleOcrService> | null = null;

/**
 * Create the OCR service once and reuse it.
 *
 * Session creation compiles the ONNX graphs, which is slow enough that doing it
 * per photograph would dominate the pipeline. Warm this alongside the model
 * download rather than on the first upload.
 */
export function warmOcr(): Promise<PaddleOcrService> {
  if (servicePromise) return servicePromise;

  servicePromise = (async () => {
    const service = new PaddleOcrService({
      model: MODEL,
      /*
       * See low-confidence lines rather than having them removed upstream.
       *
       * The library filters at 0.5 by default, before anything here runs. That
       * makes a blurry page look BETTER, not worse: weak lines are deleted from
       * the array, so the mean confidence of the survivors goes up while the
       * text needed for the checklist silently disappears. Lowering the floor
       * lets isLowQuality() below see the damage and warn the reader.
       */
      recognition: { minimumConfidence: 0.3 } as never,
    });
    await service.initialize();
    return service;
  })();

  servicePromise.catch(() => {
    servicePromise = null;
  });

  return servicePromise;
}

export function isOcrWarm(): boolean {
  return servicePromise !== null;
}

/** Whether OCR will run on the GPU. Informational; wasm is a correct fallback. */
export async function ocrUsesWebGpu(): Promise<boolean> {
  try {
    return await isWebGpuAvailable();
  } catch {
    return false;
  }
}

/**
 * Read one page.
 *
 * Lines come back in reading order and are joined with newlines rather than
 * spaces, because the rules engine relies on line structure: a label like
 * "CASE NUMBER" and its value are frequently on the same line, while the
 * deadline sentence routinely wraps across two.
 */
export async function readPage(image: Blob | ArrayBuffer): Promise<OcrPage> {
  const service = await warmOcr();
  // The web build takes bytes or a canvas. Path strings are the Node build only.
  const source = image instanceof Blob ? await image.arrayBuffer() : image;

  const result = await service.recognize(source, { flatten: true });
  const items = result.results;

  const lines: OcrLine[] = items.map((item) => ({
    text: item.text,
    confidence: item.confidence,
    box: toRect(item.box),
  }));

  return {
    text: lines.map((l) => l.text).join('\n'),
    lines,
    confidence: result.confidence ?? meanConfidence(lines),
  };
}

/** Read several photographed pages in order. */
export async function readPages(images: (Blob | ArrayBuffer)[]): Promise<OcrPage[]> {
  const pages: OcrPage[] = [];
  // Sequential on purpose. Two ONNX sessions and a 2 GB language model already
  // share this GPU, and running pages concurrently is how an 8 GB machine
  // reaches memory pressure mid-demo.
  for (const image of images) pages.push(await readPage(image));
  return pages;
}

/**
 * Whether a page is too poor to trust.
 *
 * Used to tell someone to retake a photo rather than to hand them a checklist
 * quietly built from noise. This gates the ADVICE, never the safety fields; the
 * rules engine still refuses on its own terms.
 */
export function isLowQuality(page: OcrPage): boolean {
  /*
   * Thresholds measured, not guessed.
   *
   * Clean renders of the four demo packets read at 10 to 13 lines, 0.99 mean
   * confidence, and zero weak lines. An earlier version required at least 12
   * lines and flagged three of those four, which is worse than no warning at
   * all: a banner that cries wolf on a legible page teaches people to ignore it
   * on the page that matters. Line count turned out to be the wrong instrument
   * anyway, because a cover notice is legitimately short.
   *
   * The real signal is the proportion of weakly-recognized lines. That only
   * became visible after lowering the library's own 0.5 pre-filter above;
   * before that, blur deleted lines rather than lowering the average, so
   * degradation made a page look better.
   */
  if (page.lines.length < 4) return true;
  const weak = page.lines.filter((l) => l.confidence < 0.65).length;
  return weak / page.lines.length > 0.25 || page.confidence < 0.85;
}

function meanConfidence(lines: OcrLine[]): number {
  if (!lines.length) return 0;
  return lines.reduce((sum, l) => sum + l.confidence, 0) / lines.length;
}

/**
 * Normalise the bounding box.
 *
 * The library returns `{ x, y, width, height }`, not a polygon. An earlier
 * version here branched on `Array.isArray` and therefore returned null for every
 * line, which harmed nothing yet because no view draws boxes, and would have
 * silently defeated highlighting the moment one did.
 */
function toRect(box: unknown): OcrLine['box'] {
  if (!box || typeof box !== 'object') return null;
  const b = box as Partial<Record<'x' | 'y' | 'width' | 'height', number>>;
  if ([b.x, b.y, b.width, b.height].some((n) => typeof n !== 'number')) return null;
  return { x: b.x!, y: b.y!, width: b.width!, height: b.height! };
}
