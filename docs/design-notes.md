# Design notes

## The reference, read rather than guessed

Captured `https://elvalabs.ai/` with `scripts/shot.mjs` (7 viewports, computed
styles pulled from the live DOM). What it actually does:

| | |
|---|---|
| Canvas | `rgb(19,19,19)` near-black, full-bleed, one `<canvas>` WebGL layer |
| Type | Neue Haas Grotesk Display Pro throughout, one family, no serif |
| Display sizes | 104px and 121px, weight 400, letter-spacing **-3.12px** (about -0.03em) |
| Mid sizes | 42-43px, letter-spacing -0.84px |
| Body | 16px, weight 400, normal tracking |
| Structure | 2528px of scroll over a 900px viewport, about 2.8 screens |
| Chrome | Pill-shaped floating chips in all four corners, nothing docked |
| Motion | Scroll-driven. Headlines scale and fade through the viewport and overlap in depth as you pass them |
| Texture | Film grain over a warm amber light bleeding out of the dark |
| Stack | THREE.js + troika-three-text + GSAP ScrollTrigger |

The through-line is **restraint plus scale**. One idea per screen, enormous type,
almost no chrome, and the only colour is light leaking through darkness.

## What we take, and what we deliberately do not

The vocabulary transfers. The technique does not, for two concrete reasons.

**GPU contention.** A THREE.js render loop and a 2 GB Gemma model both want the
same GPU on an 8 GB machine. Running a continuous WebGL scene while the model
generates is how the tab gets killed mid-demo. So the landing motion is CSS,
Canvas2D grain, and IntersectionObserver, with any heavy layer torn down before
the engine warms.

**Audience.** This tool is read by people who are often low-vision, often reading
in a second language, often on a phone, and often frightened by the letter in
their hand. A dark cinematic agency aesthetic on the screen that tells someone
their coverage deadline would be the wrong instrument. Two of the five judges are
clinician-adjacent and read startup flash on a benefits tool as a tell.

So: **two surfaces, one URL.**

### Surface 1, the landing

Takes the reference vocabulary directly.

- Near-black field, warm light bleeding through, film grain.
- One idea per screen, giant type, tight negative tracking.
- Pill chrome in the corners: wordmark, offline status, model status.
- **The preloader is the model download.** The 2 GB progress bar becomes the hero
  moment rather than a wait, with the percentage set at display scale. This is
  the single best idea borrowed from the reference, because it converts our
  largest liability into the thing that proves the claim.
- The one honest borrowing of the "light out of darkness" metaphor: the packet
  photograph is the light source. The document the reader is afraid of is the
  thing that lights the page.

### Surface 2, the tool

Government-benefits trust aesthetic, USWDS-adjacent. Non-negotiables:

- 18px body minimum, 4.5:1 body contrast, 3:1 for UI and focus rings.
- 44x44px touch targets, visible focus on everything interactive.
- The deadline is the largest element on the page, then the case number, then the
  checklist.
- `lang="es"` on Spanish blocks so screen readers switch pronunciation.
- `aria-live="polite"` for pipeline progress.
- No motion beyond the progress region. `prefers-reduced-motion` respected
  globally, already set in `src/index.css`.
- The amber mismatch banner uses plain words and puts the value read from the
  document on top.

## Type

The reference uses a licensed face we cannot ship. The equivalent move with a
free family is a tight, neutral grotesque at display scale with negative
tracking, and system-ui for the tool surface where familiarity beats character.

Scale, carried across both surfaces:

```
display   clamp(3.5rem, 11vw, 7.5rem)   tracking -0.03em   weight 400
title     clamp(1.75rem, 4vw, 2.7rem)   tracking -0.02em
lead      1.125rem
body      1.125rem (18px floor)
meta      0.9375rem
```

## Colour

```
ink        #131313   near-black field (taken from the reference)
paper      #ffffff   the tool surface
warm       #f5a623   the light bleeding through; also the mismatch banner
gov-blue   #1a4480   focus rings, primary action (USWDS base)
alert      #b50909   used only for a passed deadline
```

Contrast is checked with Lighthouse in the Friday chain, not by eye.
