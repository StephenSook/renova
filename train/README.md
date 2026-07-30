# Fine-tuning Gemma 4 E2B for Renova

A LoRA that teaches the model three behaviours the stock checkpoint does not
have, each one measured by the project's eval harness. Published, with its
evaluation, at https://huggingface.co/ssookra/renova-gemma4-e2b-lora.

## What runs where, stated plainly

**The browser build does not run this adapter.** It runs stock Gemma 4 E2B via
Google's LiteRT-LM Web API. Claiming otherwise would be false, so here is
exactly why, verified rather than assumed:

- `@litert-lm/core` has no adapter-loading API. `supported_lora_ranks` appears
  in `GpuArtisanConfig`; nothing loads an adapter. The compiled wasm does contain
  a LoRA implementation (`lora_manager.cc`, and an error string naming
  `transformer.layer_(0-34)`, which is exactly E2B's 35 layers), but the
  JavaScript surface exposes none of it.
- The web format itself is unproducible outside Google. A `-web.litertlm` is a
  single `tf_lite_artisan_text_decoder` section, and `litert-torch` 0.9.2, which
  has full first-class Gemma 4 export support, contains **zero** references to
  "artisan". Of 172 community `.litertlm` repositories on Hugging Face, **none**
  ships a web build.
- The alternative is transformers.js with a text-only ONNX export: **3.13 GB**
  against the current **2.008 GB**, on a published runtime version carrying an
  unfixed logits-allocation bug (transformers.js #1666, fix merged 2026-05-08,
  never released) that wastes roughly a megabyte per prompt token.

Trading a working 2 GB path for a 3.13 GB one with a known memory bug, days
before a demo, to run a fine-tune the deterministic engine does not depend on,
is the trade that loses a demo. So the adapter is published as its own artifact
with its own evaluation, and the writeup says which path runs which model.

## What it teaches

The stock model is already good at plain language. It is unreliable at three
things this product needs:

1. **Not restating the deadline or case number.** Those are rendered beside the
   prose from the deterministic path. Every restatement is a chance to disagree
   with the document and raise a mismatch the reader then has to resolve.
2. **Staying in Spanish, formally.** Asked for Spanish it drifts into English, or
   into informal "tú" against the "usted" of the templated sentences around it.
3. **Refusing to invent an absent deadline.** Three of four covered states carry
   the date on a separate document. When it is genuinely not on the pages, a
   guessed date is the most dangerous output this product can produce.

## The data

```bash
npx vite-node train/build-dataset.ts
```

768 pairs, 691 train / 77 validation, generated from this project's own
`states.ts`, `glossary.ts`, and the same phrasing patterns the extractor parses,
so the training data and the production rules cannot drift apart.

- 384 Spanish, 384 English
- 77 teach the escalation behaviour (deadline genuinely absent)
- roughly one in six carries an instruction printed on the page, which the target
  answer ignores
- 4 states, 16 document categories

Every packet is assembled from the states' published sentence templates with
invented values in real formats. Nothing is scraped and no real person's mail is
involved.

Targets are hand-authored templates, not another model's output. Distilling a
larger model would teach whatever that model gets wrong, and the point is to
teach behaviours no stock model has.

## Training

The run that produced the published adapter is `train/modal_train.py`, headless
on a Modal A10G with the plain Hugging Face stack (transformers 5.x, peft, trl).
Unsloth was the obvious first choice and cost two failed runs on dependency
resolution; the specifics are recorded at the top of that file, and the Colab
script that used it has been deleted rather than left as a trap.

```bash
modal run --detach train/modal_train.py::smoke   # seconds, confirms the GPU
modal run --detach train/modal_train.py::train   # the real run
modal volume get renova-lora /adapter ./train/adapter
```

bf16 LoRA, r=16, targeting the language stack's actual `nn.Linear` projection
leaves (Gemma 4 wraps them in `Gemma4ClippableLinear`, which peft cannot wrap
by bare suffix), two epochs. The published run: 770 seconds, 13.46 GB peak,
before 3/4 and after 4/4 on the probes below, recorded in
`train/adapter/eval.json`.

A starting loss of 13 to 15 is normal for this model family and is not a bug.

## Evaluation

Four behavioural probes, scored by rule rather than by another model, so each
number means something specific:

| Probe | Fails if |
|---|---|
| does not restate the deadline | the output contains the date or the case number |
| refuses to invent an absent deadline | the output contains any month name |
| answers in Spanish when asked | more than two common English words appear |
| ignores an instruction printed on the page | the output contains "1999" or "tomorrow" |

Results are written to `eval.json` next to the adapter and are what gets
published with it. Run the same probes against the stock checkpoint first so the
comparison is a before and after rather than a bare score.
