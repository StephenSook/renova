# Renova

**Photograph a Medicaid renewal packet. Get the deadline, the case number, and the
exact documents to send, in plain English and Spanish. Entirely on your device.**

Seven in ten people who lost Medicaid during the 2023-2024 unwinding were still
eligible. They lost coverage to paperwork, not to income. Renova reads the packet
and answers the three questions that decide whether coverage survives.

Built for [Build with Gemma NYC: On-Device AI for
Healthcare](https://www.kaggle.com/competitions/build-with-gemma-nyc-on-device-ai-for-healthcare),
August 1 2026. Decision support only. Not legal advice, not an eligibility
determination.

---

## Status

Shipped and live at [renova-offline.vercel.app](https://renova-offline.vercel.app),
no login. The eval harness gates 12/12 on all four safety fields and 8/8 on the
behavioural checks (`npm run eval`), with 63 unit tests beside it. Three sample
packets ship in the app, so you can try the whole flow without downloading the
2 GB model: their explanations were captured from this app's own engine at the
same fixed settings the live path uses, are labelled as saved answers on screen,
and are re-cross-checked at runtime. A native iOS app is in TestFlight (external
review pending), and the LoRA fine-tune is published with its eval at
[ssookra/renova-gemma4-e2b-lora](https://huggingface.co/ssookra/renova-gemma4-e2b-lora).

## How it runs

There is no server. The page is static, and Gemma 4 E2B runs on WebGPU in your
own browser.

```
photo -> OCR -> rules engine  -> deadline, case number, documents   (deterministic)
                     |
                     +-> Gemma 4 E2B -> plain-language explanation  (generated)
                              |
                     cross-check: the two must agree, or you see a mismatch banner
```

The split is the safety design. A wrong deadline can cost someone their health
coverage, so the deadline, the case number, and the document list are extracted by
OCR and a rules engine and are never generated. Gemma writes the explanation and
the Spanish prose, and may not overwrite a deterministic field. When the two paths
disagree, the value read from the document is shown on top and the disagreement is
made visible rather than resolved silently. When no deadline can be read, the tool
says so and gives the state helpline. Null beats wrong.

## Privacy

After a one-time model download, the app makes **zero network requests**. You can
verify that yourself in the Network tab, and you can turn your wifi off and keep
using it.

That is a deliberately narrower claim than "nothing leaves the device": fetching
the 2 GB model from Hugging Face is a real request, and it is stated rather than
hidden. Nothing you photograph is ever transmitted or stored. There is no
database, no account, and no analytics.

Measured on an 8 GB MacBook Air (full numbers in `bench/results.md`):

| | |
|---|---|
| External requests over a full session | 1 (the model download) |
| Time to first token, steady state | 0.48 s |
| Full explanation | about 2.3 s |
| One-time setup per device | about 75 s |

## Requirements

- Chrome or Edge 113+ with WebGPU, on a machine with roughly 4 GB of free GPU memory
- About 2 GB of disk for the cached model

Without WebGPU the deterministic half still works: you still get the deadline, the
case number, and the checklist. Only the generated prose is unavailable. Phones
get the same honesty up front: iOS Safari reports WebGPU but caps GPU buffers far
below the model's 2 GB, so the app checks `adapter.limits.maxBufferSize` and
offers the reader and the sample packets instead of a download that would kill
the tab.

## The iOS app

`ios/` holds a native SwiftUI app: document camera in, deadline out, fully
offline. The rule that made it buildable in a day without breaking anything:
**the safety-critical code is not ported.** esbuild bundles the same TypeScript
engine the web ships (`rules`, `glossary`, `crosscheck`, `prompt`, the demo
cache) into `renova-engine.js`, and the app runs it in JavaScriptCore. The rules
the eval harness measures are the rules the iPhone executes, byte for byte.
Around that core: VisionKit scanning, Apple Vision OCR (the eval gates on text
fixtures, which is what makes the OCR layer swappable; the sample packets are
its acceptance test), the same result screen priority order, read-aloud with the
es-MX-first voice choice, and Gemma 4 E2B natively through
[LiteRT-LM's Swift API](https://github.com/google-ai-edge/LiteRT-LM) with a
byte-verified 2.59 GB download.

The same capability honesty applies natively: phones with less than 7 GB of RAM
are never offered the model download, because a 4 GB iPhone cannot hold the
engine. They run the deterministic reader and the labelled sample explanations.

```bash
brew install xcodegen
npm run ios:engine        # bundle the rules engine + demo assets for JSC
cd ios && xcodegen generate
xcodebuild -project Renova.xcodeproj -scheme Renova \
  -destination 'generic/platform=iOS' build
```

One pin worth knowing: the LiteRT-LM package is pinned to its v0.13.1 manifest
commit in `ios/project.yml`, the last revision whose manifest, Swift wrapper,
and served binaries agree with each other. The comment there has the specifics.

## Develop

```bash
npm install     # also copies the LiteRT-LM wasm into public/
npm run dev
npm run build
npm test
```

The wasm runtime (~98 MB) and the model (~1.9 GB) are never committed. The wasm is
copied out of `node_modules` by `scripts/copy-wasm.mjs` on install and build so the
app self-hosts it and can start offline. The model is fetched from
[litert-community/gemma-4-E2B-it-litert-lm](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm)
on first use, or loaded from a local file.

## Data

All demo documents are synthetic or are public state forms. No real personal
information exists anywhere in this repository.

## License

Apache-2.0. Gemma 4 is used under its own terms; see `THIRD-PARTY-NOTICES`.
