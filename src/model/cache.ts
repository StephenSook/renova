/**
 * Model custody: download once, keep it on the device, work offline forever after.
 *
 * Everything here exists because @litert-lm/core does no caching of its own.
 * EngineSettings.model accepts a URL, a Blob, or a stream, and that is the whole
 * contract. If we hand it the Hugging Face URL every time, the app re-downloads
 * 2 GB on every visit and cannot run in airplane mode, which is the product.
 *
 * The failure modes this guards against, all of which were designed for rather
 * than discovered in production:
 *
 *  - Buffering 2 GB into the JS heap crashes the tab on an 8 GB machine, so the
 *    response body is piped straight to disk and never materialized.
 *  - A refresh or crash mid-download leaves a truncated file that would fail
 *    forever with an opaque wasm abort, so bytes land in a .partial file and are
 *    only promoted after the exact byte count is verified.
 *  - Chrome evicts OPFS under storage pressure, silently and overnight, so we
 *    ask for persistence and report honestly when it is refused.
 *  - OPFS is origin-scoped, so a cache warmed on localhost does not exist on the
 *    deployed origin. The file picker is the escape hatch for that and for bad
 *    venue wifi: the model is just a file, and the user can hand us one.
 */

/** Exact size of gemma-4-E2B-it-web.litertlm, verified against the source repo. */
export const MODEL_BYTES = 2_008_432_640;

export const MODEL_URL =
  'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm';

const FILE_NAME = 'gemma-4-E2B-it-web.litertlm';
const PARTIAL_NAME = `${FILE_NAME}.partial`;

export interface DownloadProgress {
  receivedBytes: number;
  totalBytes: number;
  /** 0..1 */
  fraction: number;
  /** Bytes per second over the whole transfer so far. */
  bytesPerSecond: number;
}

export type ModelSource =
  | { kind: 'cache' }
  | { kind: 'download' }
  | { kind: 'file'; name: string };

export class ModelCacheError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ModelCacheError';
  }
}

export function isOpfsSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;
}

async function rootDir(): Promise<FileSystemDirectoryHandle> {
  if (!isOpfsSupported()) {
    throw new ModelCacheError('This browser has no OPFS, so the model cannot be cached.');
  }
  return navigator.storage.getDirectory();
}

/**
 * Ask the browser not to evict our 2 GB under storage pressure.
 *
 * Returns whether persistence is actually granted. Chrome decides this on
 * engagement heuristics and can refuse, so callers surface the answer rather
 * than assuming it. A refusal is not fatal, it just means the cache may vanish
 * and the download may be needed again.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Returns the cached model, or null. Only a byte-exact file counts as cached. */
export async function getCachedModel(): Promise<File | null> {
  if (!isOpfsSupported()) return null;
  try {
    const dir = await rootDir();
    const handle = await dir.getFileHandle(FILE_NAME);
    const file = await handle.getFile();
    if (file.size !== MODEL_BYTES) {
      // A wrong-sized file is worse than no file: it fails deep inside wasm with
      // an unreadable error. Drop it and let the caller download again.
      await dir.removeEntry(FILE_NAME).catch(() => {});
      return null;
    }
    return file;
  } catch {
    return null;
  }
}

export async function clearCachedModel(): Promise<void> {
  if (!isOpfsSupported()) return;
  const dir = await rootDir();
  await dir.removeEntry(FILE_NAME).catch(() => {});
  await dir.removeEntry(PARTIAL_NAME).catch(() => {});
}

/**
 * Download the model to OPFS, resuming a previous partial transfer if one exists.
 *
 * The response body is piped to disk chunk by chunk. Nothing larger than one
 * chunk is ever held in memory.
 */
export async function downloadModel(
  onProgress?: (p: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<File> {
  const dir = await rootDir();

  // Resume point: how many verified bytes are already on disk.
  let already = 0;
  try {
    const h = await dir.getFileHandle(PARTIAL_NAME);
    already = (await h.getFile()).size;
    if (already > MODEL_BYTES) already = 0; // corrupt, start over
  } catch {
    already = 0;
  }

  const headers: HeadersInit = already > 0 ? { Range: `bytes=${already}-` } : {};
  const res = await fetch(MODEL_URL, { headers, signal });

  if (!res.ok) {
    throw new ModelCacheError(`Model download failed with HTTP ${res.status}.`);
  }
  if (already > 0 && res.status !== 206) {
    // The server ignored our Range header, so the body starts at zero and our
    // partial file is meaningless. Start clean rather than concatenating garbage.
    already = 0;
  }
  if (!res.body) {
    throw new ModelCacheError('Model download returned no body.');
  }

  const partial = await dir.getFileHandle(PARTIAL_NAME, { create: true });
  const writable = await partial.createWritable({ keepExistingData: already > 0 });
  if (already > 0) await writable.seek(already);

  let received = already;
  const startedAt = performance.now();
  const reader = res.body.getReader();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await writable.write(value);
      received += value.byteLength;
      const seconds = (performance.now() - startedAt) / 1000;
      onProgress?.({
        receivedBytes: received,
        totalBytes: MODEL_BYTES,
        fraction: Math.min(received / MODEL_BYTES, 1),
        bytesPerSecond: seconds > 0 ? (received - already) / seconds : 0,
      });
    }
    await writable.close();
  } catch (err) {
    // Leave the .partial in place: it is a valid resume point, not garbage.
    await writable.close().catch(() => {});
    throw new ModelCacheError('Model download interrupted. It will resume where it stopped.', {
      cause: err,
    });
  }

  // Commit only after the byte count is exactly right.
  const partialFile = await partial.getFile();
  if (partialFile.size !== MODEL_BYTES) {
    throw new ModelCacheError(
      `Model download ended at ${partialFile.size} bytes, expected ${MODEL_BYTES}. Not caching a truncated file.`,
    );
  }

  const final = await dir.getFileHandle(FILE_NAME, { create: true });
  const finalWritable = await final.createWritable();
  await finalWritable.write(partialFile);
  await finalWritable.close();
  await dir.removeEntry(PARTIAL_NAME).catch(() => {});

  return final.getFile();
}

/**
 * Accept a model file the user hands us directly.
 *
 * This is the venue insurance. If wifi is unusable, if OPFS was evicted, or if
 * the demo is running in the wrong Chrome profile, the 2 GB file on a USB stick
 * still works, because EngineSettings.model takes a Blob.
 */
export function validateModelFile(file: File): File {
  if (file.size !== MODEL_BYTES) {
    throw new ModelCacheError(
      `That file is ${file.size} bytes. The model must be exactly ${MODEL_BYTES} bytes (gemma-4-E2B-it-web.litertlm).`,
    );
  }
  return file;
}

/** Copy a user-supplied file into OPFS so it survives the next reload. */
export async function adoptModelFile(file: File): Promise<File> {
  validateModelFile(file);
  if (!isOpfsSupported()) return file;
  const dir = await rootDir();
  const handle = await dir.getFileHandle(FILE_NAME, { create: true });
  const writable = await handle.createWritable();
  await file.stream().pipeTo(writable);
  return handle.getFile();
}
