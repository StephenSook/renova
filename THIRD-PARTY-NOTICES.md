# Third-party notices

Renova is Apache-2.0. It redistributes or loads the following third-party
components. Each is listed with what it is, where it comes from, and the terms it
arrives under.

## Model weights

### Gemma 4 E2B

`gemma-4-E2B-it-web.litertlm` (2,008,432,640 bytes) is **not redistributed by this
repository**. It is fetched at runtime from
[litert-community/gemma-4-E2B-it-litert-lm](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm)
on Hugging Face, or loaded from a file the user selects from their own disk.

Gemma is provided by Google under the
[Gemma Terms of Use](https://ai.google.dev/gemma/terms) and the
[Gemma Prohibited Use Policy](https://ai.google.dev/gemma/prohibited_use_policy).
Users of this application are subject to those terms. Renova uses Gemma for
plain-language explanation only. It does not diagnose, does not determine
eligibility, and does not generate any of the safety-critical fields.

### PP-OCRv5 detection and Latin recognition

`public/models/ocr/det.onnx`, `rec.onnx`, and `dict.txt` **are redistributed in
this repository**, converted to ONNX by
[PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models)
from [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR), which is
**Apache-2.0**. Redistribution is permitted under that license.

They are vendored rather than fetched so that the application starts and runs
with the network off, and so that no third-party request is made while the
product is telling a user that nothing leaves their device.

## Runtime

| Component | Use | License |
|---|---|---|
| [`@litert-lm/core`](https://www.npmjs.com/package/@litert-lm/core) | Google AI Edge LiteRT-LM Web runtime; runs Gemma on WebGPU | Apache-2.0 |
| LiteRT-LM wasm (`public/litertlm-wasm/`) | Copied out of `@litert-lm/core` at build time by `scripts/copy-wasm.mjs`, served from our own origin. Not committed. | Apache-2.0 |
| [`ppu-paddle-ocr`](https://www.npmjs.com/package/ppu-paddle-ocr) | PP-OCR inference on onnxruntime-web | MIT |
| [`ppu-ocv`](https://www.npmjs.com/package/ppu-ocv) | OpenCV.js image preprocessing, pulled in by the above | Apache-2.0 (OpenCV) |
| [React](https://react.dev/) 19 | UI | MIT |
| [Vite](https://vite.dev/) | Build | MIT |
| [Tailwind CSS](https://tailwindcss.com/) 4 | Styling | MIT |
| [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/) | Tests and screenshots. Development only, not shipped. | MIT / Apache-2.0 |

## Content and data

State form text, phrasing patterns, helpline numbers, and the English to Spanish
glossary are drawn from public materials published by the California Department
of Health Care Services, the New York State Department of Health, the
Pennsylvania Department of Human Services, Georgia DFCS, and CMS. Sources are
recorded inline in `src/engine/states.ts`.

**All demo and evaluation documents in this repository are synthetic**, written
from published phrasing patterns and watermarked `SAMPLE, NOT A REAL NOTICE`.
Case numbers are invented values in real formats. No real personal information
exists anywhere in this repository.

## Design

The landing surface's visual approach was informed by studying
[elvalabs.ai](https://elvalabs.ai/) as a reference for scale, contrast, and
scroll-driven pacing. No code, asset, typeface, or copy from that site is used or
redistributed here, and the reference captures are not committed. The typeface it
uses is licensed and is not shipped by this project.
