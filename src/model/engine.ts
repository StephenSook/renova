/**
 * The only place in this codebase that touches @litert-lm/core.
 *
 * Gemma 4 E2B runs here, in the reader's own browser, on WebGPU. Nothing it
 * reads is transmitted anywhere. Keeping every call to Engine.create behind this
 * module is what makes that claim auditable in one file.
 *
 * Two settings are deliberate and should not be "cleaned up":
 *
 *  - `backend` is never set. The default (GPU_ARTISAN) streams weights straight
 *    to the GPU. Every other backend copies the full 2 GB into the wasm heap
 *    first, which an 8 GB machine will not survive. It also runs single
 *    threaded, which is why this app needs no COOP/COEP headers.
 *  - The wasm is loaded from our own origin, not a CDN, so the app starts with
 *    the network off and a judge watching the Network tab sees nothing.
 */
import {
  Engine,
  loadLiteRtLm,
  type ConversationConfig,
  type EngineSettings,
} from '@litert-lm/core';

/** Self-hosted by scripts/copy-wasm.mjs. Never point this at a CDN. */
const WASM_PATH = `${import.meta.env.BASE_URL}litertlm-wasm/`;

/**
 * Context budget. The prompt carries OCR text for one packet plus the
 * deterministic fields, which sits comfortably under this.
 */
const MAX_NUM_TOKENS = 4096;

/**
 * Hard cap on generated tokens.
 *
 * This is a demo-safety number, not a style preference. At the 5 tokens/second
 * floor we are willing to ship on, an uncapped explanation becomes minutes of
 * dead air in front of judges. 220 tokens is a full plain-language explanation
 * and finishes inside the stage budget even on the slow path.
 */
export const MAX_OUTPUT_TOKENS = 220;

export interface WebGpuStatus {
  supported: boolean;
  reason?: string;
  adapterInfo?: string;
}

/**
 * Check WebGPU before offering the live path.
 *
 * The deterministic half of the product does not need this. When WebGPU is
 * missing the user still gets their deadline, case number, and checklist from
 * OCR plus the rules engine, and only the generated prose is unavailable. That
 * degradation is the dual-path safety design doing its job in public, so this
 * returns a reason worth showing rather than a bare boolean.
 */
export async function checkWebGpu(): Promise<WebGpuStatus> {
  if (!('gpu' in navigator)) {
    return {
      supported: false,
      reason: 'This browser does not support WebGPU. Chrome or Edge 113 and later do.',
    };
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        reason: 'WebGPU is present but no graphics adapter was available.',
      };
    }
    const info = (adapter as GPUAdapter & { info?: GPUAdapterInfo }).info;
    return {
      supported: true,
      adapterInfo: info ? [info.vendor, info.architecture].filter(Boolean).join(' ') : undefined,
    };
  } catch (err) {
    return { supported: false, reason: `WebGPU probe failed: ${String(err)}` };
  }
}

let enginePromise: Promise<Engine> | null = null;

/**
 * Create the engine, or return the one already being created.
 *
 * Warm this at page load rather than on a button press. Loading 2 GB of weights
 * onto the GPU takes tens of seconds even from a warm cache, and doing it lazily
 * puts that wait between a judge's click and any visible response.
 */
export function warmEngine(model: File | Blob | string): Promise<Engine> {
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    await loadLiteRtLm(WASM_PATH);
    const settings: EngineSettings = {
      model,
      mainExecutorSettings: { maxNumTokens: MAX_NUM_TOKENS },
    };
    return Engine.create(settings);
  })();

  // A failed warm must not poison every later attempt.
  enginePromise.catch(() => {
    enginePromise = null;
  });

  return enginePromise;
}

export function isEngineWarm(): boolean {
  return enginePromise !== null;
}

export async function disposeEngine(): Promise<void> {
  const p = enginePromise;
  enginePromise = null;
  if (!p) return;
  try {
    await (await p).delete();
  } catch {
    // Already gone, or the GPU device was lost underneath us. Either way the
    // reference is dropped and the next warm starts clean.
  }
}

/** Deterministic by default: temperature 0, fixed seed, capped output. */
export const DEFAULT_CONVERSATION: ConversationConfig = {
  sessionConfig: {
    samplerParams: { temperature: 0, seed: 7 },
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  },
};

export interface GenerateOptions {
  system?: string;
  signal?: AbortSignal;
  onToken?: (text: string) => void;
}

/**
 * Stream one completion and return the full text.
 *
 * A fresh conversation per call is intentional. Each packet is an independent
 * request, and carrying history between them risks one reader's document
 * leaking into another's explanation.
 */
export async function generate(
  engine: Engine,
  prompt: string,
  { system, signal, onToken }: GenerateOptions = {},
): Promise<string> {
  const config: ConversationConfig = {
    ...DEFAULT_CONVERSATION,
    ...(system ? { preface: { messages: [{ role: 'system', content: system }] } } : {}),
  };

  const conversation = await engine.createConversation(config);
  let out = '';

  try {
    const stream = conversation.sendMessageStreaming(prompt);
    const reader = stream.getReader();

    const onAbort = () => conversation.cancel();
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = messageText(value);
        if (text) {
          out += text;
          onToken?.(text);
        }
      }
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  } finally {
    await conversation.delete().catch(() => {});
  }

  return out;
}

/** Message.content is a string or an array of typed parts; only text is used. */
function messageText(message: { content?: unknown }): string {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) =>
      part && typeof part === 'object' && (part as { type?: string }).type === 'text'
        ? ((part as { text?: string }).text ?? '')
        : '',
    )
    .join('');
}
