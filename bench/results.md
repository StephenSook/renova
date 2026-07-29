# Benchmarks

All numbers measured, none estimated. Anything quoted in the writeup, the README,
or the demo narration comes from this file.

## Environment

| | |
|---|---|
| Machine | MacBook Air, Apple M3, 8-core GPU |
| Memory | 8 GB unified (`navigator.deviceMemory` reports 8) |
| Browser | Chrome, WebGPU adapter reported as `apple metal-3` |
| Model | `gemma-4-E2B-it-web.litertlm`, 2,008,432,640 bytes (1.87 GiB) |
| Runtime | `@litert-lm/core` 0.14.0, default `GPU_ARTISAN` backend, WebGPU |
| Sampler | temperature 0, seed 7, `maxOutputTokens` 220 |
| Origin | `http://localhost:5173` (re-measure on the deploy origin before quoting) |

## Run 1, 2026-07-29: cold start through steady state

Prompt: "Explain in three short sentences, at a sixth grade reading level, what a
Medicaid renewal packet is and why the deadline on it matters."

| Step | First run | Second run | Notes |
|---|---|---|---|
| Model download to OPFS | 30.6 s | cached | ~73 MB/s on home wifi, streamed to disk, never buffered in the JS heap |
| Engine warm (`Engine.create`) | 11.9 s | 0.0 s | 2 GB of weights onto the GPU |
| Time to first token | 32.37 s | **0.48 s** | The first-run cost is one-time shader and graph compilation, not per-request prefill |
| Decode | 41.0 chunks/s over 1.8 s | 41.7 chunks/s over 1.8 s | Chunks, not tokens. A chunk is a stream event and is a lower bound on token count. Never quote this as tokens/second. |
| Output | 365 chars | 365 chars | Byte-identical across runs, confirming temperature 0 is deterministic here |

**Cold path, once per device:** about 75 s total (download + warm + compile).
**Steady state, every run after:** first token in about 0.5 s, complete explanation in about 2.3 s.

Design consequence: warm the engine *and* run one throwaway priming generation
while the download progress bar is still on screen. That absorbs the 32 s
compilation into a wait the user is already having, so their first real packet
returns in about half a second.

## Network audit, same session

Measured with `performance.getEntriesByType('resource')` after a full
download-warm-generate-generate cycle:

| | |
|---|---|
| Total requests | 18 |
| External requests | **1** (`huggingface.co`, the one-time model download) |
| LiteRT-LM wasm served from | our own origin, not a CDN |
| OPFS usage / quota | 1.87 GB / 11.87 GB |

This is the evidence behind the privacy claim, and it is why the claim is worded
as "after the one-time model download, zero network requests" rather than
"nothing leaves the device". The model fetch is a real request and is stated.

## Run 2, 2026-07-29: the production origin

Same machine, same model, same prompt, at `https://renova-offline.vercel.app`.
This is the origin a judge will use, and it is the one that matters, because OPFS
is origin-scoped and a cache warmed on localhost does not exist here.

| Step | First run | Second run |
|---|---|---|
| Model download to OPFS | 53.3 s | cached |
| Engine warm | 5.7 s | 0.0 s |
| Time to first token | 42.12 s | **6.39 s** |
| Decode | 19.5 chunks/s over 3.8 s | 19.8 chunks/s over 3.7 s |
| Output | 365 chars | 365 chars |

Two things to be honest about rather than to quote selectively:

**Warm first-token was 6.39 s here against 0.48 s on localhost.** Same code, same
model, same machine. The difference is machine state: by run 2 the laptop had a
long-running Chrome, a dev server, and a build toolchain resident, and 8 GB of
unified memory is shared between the OS and the WebGPU allocation. So the honest
range for warm time-to-first-token on this hardware is **0.5 to 6.5 seconds
depending on what else is running**, and the demo machine should be booted clean.
Quoting 0.48 s without that condition would be the kind of number that survives
into a video and then cannot be defended.

**Decode was 19.5 chunks/s here against 41 on localhost**, for the same reason.
Both are comfortably inside the stage budget with `maxOutputTokens` at 220.

Output was byte-identical across all four runs on both origins, which is the
result worth relying on: temperature 0 with a fixed seed is genuinely
deterministic in this runtime, so the cached demo outputs and the live run agree.

Network audit repeated on production: **1 external request** (`huggingface.co`),
everything else same-origin.

## Open items

- `navigator.storage.persist()` was **REFUSED** on localhost, so the cache is
  evictable. Re-test on the deploy origin. The file-picker load path exists
  precisely because this can refuse.
- Re-measure every row on the production origin before any number is quoted.
- Peak memory during generation not yet captured from Activity Monitor.
- Not yet tested: reload with the network fully off (airplane mode).
