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
import { PaddleOcrService, isWebGpuAvailable } from 'ppu-paddle-ocr/web';

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
    const service = new PaddleOcrService({ model: MODEL });
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
  return page.lines.length < 3 || page.confidence < 0.55;
}

function meanConfidence(lines: OcrLine[]): number {
  if (!lines.length) return 0;
  return lines.reduce((sum, l) => sum + l.confidence, 0) / lines.length;
}

/** PP-OCR returns a polygon. Reduce it to the rectangle the UI can highlight. */
function toRect(box: unknown): OcrLine['box'] {
  const points = Array.isArray(box)
    ? (box as unknown[]).filter(
        (p): p is [number, number] => Array.isArray(p) && p.length >= 2,
      )
    : [];
  if (points.length < 2) return null;

  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
