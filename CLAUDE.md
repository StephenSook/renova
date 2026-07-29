# Renova

Offline, on-device reader for US Medicaid renewal packets. Photograph the packet;
a deterministic OCR plus rules engine extracts the deadline, the case number, and
the required documents; Gemma 4 E2B writes the plain-language English and Spanish
explanation. Everything runs in the visitor's own browser. There is no server.

## Commands

- `npm run dev` — vendors wasm, OCR models, and fonts, then starts Vite
- `npm run build` — same vendoring, then `tsc -b && vite build`
- `npm test` — Vitest
- `npm run eval` — the harness. **Must pass before any "done" claim.**
- `node scripts/make-packets.mjs` — regenerate the synthetic demo documents
- `node scripts/shot.mjs <url> [dir] --scrolls=N` — screenshot harness

## The law

**The deterministic path owns the deadline, the case number, and the documents.**
Gemma writes prose and may never overwrite those fields. Disagreement is shown as
a mismatch banner with the document value on top, never resolved silently.

**Null beats wrong.** The extractor never says "no deadline found"; it escalates
with the state's own helpline. A date that does not exist on the calendar is
refused, not clamped.

**Every output carries** the disclaimer, the correct state helpline, and the
90-day reconsideration sentence, all rendered from constants in
`src/engine/states.ts` and `src/engine/glossary.ts`, never generated.

## Architecture

```
photo -> ocr/paddle.ts -> engine/rules.ts  -> deadline, case number, documents
                              |
                              +-> model/engine.ts (Gemma 4 E2B, WebGPU) -> prose
                                        |
                              engine/crosscheck.ts -> mismatch banner
```

`src/model/engine.ts` is the only file that touches `@litert-lm/core`.

## Constraints that will silently break this

1. **Never set `EngineSettings.backend`.** The default `GPU_ARTISAN` streams
   weights to the GPU. Any other backend copies 2 GB into the wasm heap, which
   8 GB will not survive. It also runs single-threaded, so no COOP/COEP needed.
2. **Everything is self-hosted, and each one was a bug first.** LiteRT wasm,
   onnxruntime wasm, PP-OCR models, and both fonts. Left at their defaults,
   `@litert-lm/core` and `onnxruntime-web` fetch from CDNs, which breaks offline
   start and puts third-party requests in the Network tab of a page that promises
   none. `scripts/copy-wasm.mjs` and `scripts/fetch-*.mjs` run on install and build.
3. **The model commits to OPFS only after its exact byte count is verified**
   (2,008,432,640). A truncated file fails deep inside wasm with an opaque abort.
4. **Tailwind v4 changed the CSS-variable syntax.** `text-[--color-ink]` is dead
   and silently renders nothing. Use the utilities `@theme` generates: `text-ink`,
   `bg-gov`, `border-warn`.
5. **`onnxruntime-web` is an optional peer dep** of `ppu-paddle-ocr`. The build
   passes without it and OCR fails at runtime.
6. **Vite refuses to serve `public/` files as modules.** The dev-only middleware
   in `vite.config.ts` answers `/ort/*` from disk. Production never needed it.

## Style

TypeScript strict. React 19 function components. Tailwind v4 via
`@tailwindcss/vite`. Small pure functions in `src/engine/`; per-state knowledge is
data in `states.ts`, so adding a state is a row, not a code change.

**No em-dashes anywhere**, including comments and commit messages. The eval
harness checks reader-facing strings for them.

Spanish uses correct accents and formal `usted`. Both were bugs once: the source
research stripped diacritics, and Gemma defaults to `tú`.

## Accessibility is the design language

18px body floor, 4.5:1 body contrast, 3:1 for UI and focus rings, 44x44px
targets, visible focus everywhere, `lang="es"` on Spanish blocks,
`aria-live="polite"` for progress, `prefers-reduced-motion` respected globally.
The deadline is the largest element on the page.

**The primary review lens is silent failure.** On a tool for low-vision readers a
swallowed error is invisible to exactly the person it harms. A section that is
absent because extraction found nothing reads as "there is nothing to send", so
every empty state says so explicitly.

## Definition of done

1. `npm run build` clean, `npm test` green, `npm run eval` passing on all four
   safety fields and all eight behavioural checks
2. Verified end to end in real Chrome, not headless: WebGPU needs a real browser
3. The verification screen reports **zero external hosts** after the model is cached
4. Deployed, then checked logged-out from a phone on cellular

Run every gate bare. `cmd | tail` returns tail's exit code and swallows failure.

## Data

`eval/photo/` and `public/demo/` are synthetic, watermarked, invented values in
real formats. **No real personal information belongs anywhere in this repo.**
Model weights are never committed.
