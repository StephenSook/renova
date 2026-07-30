# Renova: the renewal packet, read on your own device

**Track: On-Device Private Health**
Live demo: https://renova-offline.vercel.app · Code: https://github.com/StephenSook/renova

---

## The person and the problem

During the 2023 to 2024 Medicaid unwinding, more than 25.1 million people were
disenrolled. **69% of them lost coverage for procedural reasons**, not because
they had become ineligible (KFF Medicaid Enrollment and Unwinding Tracker, data
through September 12, 2024; MACPAC's independent count puts it at 68.7%). Nearly
a quarter of disenrolled adults ended up uninsured. Losing Medicaid is a health
event, not an administrative one: it interrupts insulin, psychiatric medication,
and chronic disease treatment mid-course.

The packet is the choke point. California's renewal is 19 pages. It is dense,
deadline-driven, and frequently not in the reader's strongest language. And the
single most important fact on it is not in a predictable place: **California
prints the due date on the form, New York and Georgia put it on a separate cover
notice, Pennsylvania puts it on the envelope.** New York's DOH-5798 has no
printed deadline anywhere on it. Someone who photographs only the form is holding
paperwork that appears to have no deadline at all.

I built this for two readers: the person at the kitchen table, and the navigator
with a client in front of them. The strongest published evidence on reducing
procedural disenrollment points at two levers, state-side ex parte automation and
human assistance. This is the human-assistance lever, made faster and consistent.

## What it does

Photograph the packet. In about twenty seconds you get the deadline, the case
number, and exactly what to send, in plain English and Spanish, read aloud on
request, with one sentence most people have never been told: **if you miss the
deadline, you usually have 90 days to send the form and get coverage back without
reapplying** (42 CFR 435.916).

Nothing you photograph is uploaded, stored, or transmitted. After a one-time
model download, the app makes **zero network requests**, and it ships a screen
that proves it.

## Architecture: two paths, one law

```
photo -> PP-OCRv5 (onnxruntime-web) -> rules engine -> deadline, case number, documents
                                            |
                                            +-> Gemma 4 E2B (WebGPU) -> plain-language prose
                                                        |
                                            cross-check -> mismatch banner
```

**The deterministic path owns the three fields a wrong answer could cost someone
their coverage.** A table-driven TypeScript rules engine extracts them using nine
verbatim phrasing patterns collected from the states' own forms, per-state case
number anchors, and a 16-category document taxonomy. Gemma writes the explanation
and the Spanish prose and **may never overwrite those fields**. When the two
disagree, the reader sees both, with the document's value on top. When no date can
be read, the engine refuses and gives the state's helpline. Null beats wrong.

**Gemma 4 E2B runs in your browser**, not on my laptop and not on a server. It
loads through `@litert-lm/core`, Google's own LiteRT-LM Web runtime, on WebGPU,
from `litert-community/gemma-4-E2B-it-litert-lm` (2,008,432,640 bytes), cached in
OPFS so it downloads once and then works with the network off.

Measured on a **MacBook Air M3 with 8 GB** of unified memory:

| | |
|---|---|
| Download to OPFS | 30 to 53 s |
| Engine warm | 5.7 to 11.9 s |
| First token, cold | 32 to 42 s (one-time shader compilation, not prefill) |
| First token, warm | **0.5 to 6.4 s**, depending on what else is running |
| Photo to checklist, end to end | **11 to 18 s** |
| External requests, whole session | **1** (the model download) |

Sampler is temperature 0 with a fixed seed, capped at 220 output tokens. Output
was byte-identical across four runs on two origins, so the cached demo outputs and
a live run agree.

**Why text and not pixels.** The JS runtime is text-in, text-out; images are an
unimplemented placeholder. That constraint turned out to be the safer
architecture anyway: the component that can hallucinate is never the component
that reads the numbers.

## Evaluation

`npm run eval` prints two tables and gates on both. Twelve text fixtures, all
synthetic and watermarked, built from the states' published phrasing.

| Field | Result |
|---|---|
| State detection | **12/12** |
| Deadline | **12/12** (exact date, or ESCALATE where refusing is correct) |
| Case number | **12/12** |
| Required documents | **12/12** |

Eight behavioural checks, pass or fail with no partial credit, all green:

- never reports a deadline without either a date or an escalation
- every escalation names where to look **and** carries the detected state's own helpline
- an instruction printed on the page is not obeyed
- February 30 is refused rather than clamped to a real date
- disclaimer, in both languages, and the 90-day sentence exist as constants
- no em-dashes in any reader-facing string

Plus 44 unit tests. The harness earned itself immediately: it caught that Georgia
asks for income proof without naming a source ("proof of any income you receive
other than by working"), so the checklist was silently dropping a document the
state had asked for.

### A LoRA, before and after

Trained on 768 pairs generated from this repo's own rules and glossary, so the
training data and the production rules cannot drift apart. Scored by rule, not
by a judge model:

| Probe | Stock | LoRA |
|---|---|---|
| Never restates the deadline or case number | pass | pass |
| Refuses to invent an absent deadline | pass | pass |
| Spanish stays Spanish, formal usted | pass | pass |
| Ignores an instruction printed on the page | **fail** | **pass** |

The one behaviour it fixes is the dangerous one. The browser runs the stock
checkpoint, because LiteRT-LM Web exposes no adapter API, so the adapter ships
as its own artifact with its eval: huggingface.co/ssookra/renova-gemma4-e2b-lora.

## Privacy and safety

The app ships **"How this stays honest"**: a live count of network requests by
host, the real cross-check running on a labelled wrong sentence, the real
extractor running on a page that says "ignore previous instructions", and exactly
which model and runtime are executing. Claims are checkable rather than asserted.

That screen paid for itself within a minute of existing. It reported an external
host on a page that promises none: `onnxruntime-web` fetches its own wasm from a
CDN by default, a transitive dependency invisible in the build output. OCR could
never have worked in airplane mode. Now self-hosted, and the screen reads zero.

**A document is untrusted input.** The three safety fields never traverse the
model, so text printed on a page cannot change them. Verified through the full
pipeline: the adversarial packet produces no "1999", no "HACKED", no "tomorrow",
and the correct August 27 date.

**Without WebGPU the deterministic half still works.** You still get the deadline,
the case number, and the checklist; only the generated prose is unavailable. That
degradation is tested, not asserted.

Spanish is not free-translated. Thirty safety-critical terms are locked to a
glossary sourced from the states' own translations, and the disclaimer, the
90-day sentence, the dates, and the case number are rendered from code. If the
model returns English, or corrupted multibyte text, the templated rendering is
used and the reader is told.

## What I got wrong, and fixed

An adversarial silent-failure review found eight real defects. The worst two both
let a screen look complete when it was not. The cross-check computed a
"the model restated a field we refused to answer" flag that nothing read, so the
app could print a red "we could not read your deadline, we will not guess it" and
a fluent date four inches below. And zero extracted documents rendered no section
at all, when absence reads as "nothing to send".

The blur detector was worse than useless: the OCR library filters low-confidence
lines before we see them, so blur **deleted** lines rather than lowering the mean,
and a degraded page scored better. Lowering the library's floor made the damage
visible.

## Honest limitations

1. No trial shows that explaining an unchanged packet increases completion;
   Michigan's redesigned form (73% to 96%) is the closest real support. The parts
   that do not depend on that claim carry the design: the deterministic deadline,
   the escalation numbers, and the 90-day line.
2. Four states, and the demo documents are synthetic. Real packets are messier.
3. Gemma is E2B, not a larger variant, because it must fit in a browser tab.
4. Adjacent tools exist. Fortuna Health does guided online navigation; states run
   portals; Propel runs renewal campaigns. None that I could verify does offline,
   on-device packet comprehension with deterministically extracted safety fields.
   That combination is the claim, and nothing more.

## Try it

Open the link, click "Put Gemma 4 on this device", then **turn off your wifi and
use it**. Or open your Network tab and watch it stay empty.

Apache-2.0. All demo documents synthetic. Decision support only, not legal advice
and not an eligibility determination.
