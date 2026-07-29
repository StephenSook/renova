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

Early. The model runtime is proven end to end (see `bench/results.md`); the
product pipeline is being built on top of it.

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
case number, and the checklist. Only the generated prose is unavailable.

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
