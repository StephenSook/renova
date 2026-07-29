# Tooling audit

Full sweep of the capability surface on this machine: **117 personal skills, 25
plugins across 7 marketplaces (~66 plugin skills, 14 plugin agents, 17 commands),
11 MCP servers, 8 claude.ai connectors, 15 subagent types.** Every one was read.
This records what is load-bearing, what is deliberately unused, and why, so the
decision is auditable rather than repeated.

Kept internal. Not published, because a list of which tools built the thing is
process, not product, and process detail is an anti-signal to operator judges.

## Already used, with what it produced

| Capability | What it actually did here |
|---|---|
| `firecrawl` MCP | Found the browser-WebGPU path. Went down mid-session (ECONNREFUSED); `exa` covered. |
| `exa` MCP | Confirmed LiteRT-LM Web, kokoro-js, in-browser PaddleOCR. Found the real CHA and CSS Navigator contacts. |
| `Explore` subagent x3 | Read the vault playbook (71 HARD RULES), 37 project memory dirs, and the full tool surface in parallel. |
| `Plan` subagent | Verified `@litert-lm/core` against its shipped `.d.ts` and killed the browser-LoRA plan before it cost three days. |
| `plan-gap-scanner` subagent | 28 gaps on the draft plan, 10 blockers. All closed before any code. |
| `claude-in-chrome` MCP | Real Chrome with real WebGPU. Headless Chromium cannot prove this. |
| `playwright` (direct, not MCP) | `scripts/shot.mjs`. The MCP times out on font-heavy and animated pages. |
| Gmail connector | Two validator outreach drafts. Drafts only; sending is the human's call. |
| `Read` on PDFs | 220 pages of research read directly rather than summarized secondhand. |
| Vercel REST API | Found and disabled `ssoProtection`, which would have put a login wall in front of every judge. |

## Queued, with the phase that triggers it

| Capability | Trigger |
|---|---|
| `frontend-design`, `ui-ux-pro-max` | Landing and tool surfaces, against `docs/design-notes.md` |
| `ux-expert`, `ui-self-heal` | Accessibility pass; Lighthouse is the gate, not judgement |
| `superpowers:test-driven-development` | Already the pattern in `src/engine`; continues for OCR and cross-check |
| `superpowers:systematic-debugging` | First opaque wasm or WebGPU failure |
| `three-brain` + `codex:codex-rescue` | Adversarial pass on my own diff before any hardening merge. Never self-review. |
| `pr-review-toolkit:silent-failure-hunter` | The primary review lens here. On a tool for low-vision readers, a swallowed error is invisible to exactly the person it harms. |
| `repo-sentinel` + `gitleaks` | Before the repo is linked from a public submission |
| `hackathon-pre-deploy` | The Friday chain |
| `demo-video-studio` + Remotion + ffmpeg | The video, measurement-gated (loudness, duration, resolution) |
| `humanize` + AI-tone sweep | The 1,500-word writeup |
| `hard-rule-harvest`, `session-memory` | Post-event, into the vault playbook |
| `context7` MCP | Library APIs, in preference to search |

## Deliberately unused, and the reason

The reasons matter more than the list, because each is a decision that could
otherwise get quietly reversed under time pressure.

| Not used | Why |
|---|---|
| **Cerebras** (credits in hand) | Hosted inference API. Wiring it in would contradict the offline claim that is the entire product, and it is not a sponsor of this event. |
| **Tavily, Twilio, Daytona** (event sponsors) | All cloud. Each sits in direct tension with the On-Device Private Health track. Using one to chase a side prize would undercut the claim that wins the track. Named honestly rather than silently skipped. |
| **Supabase, Render, any database** | There is no backend by design. A database would be a second thing to breach. |
| `devpost` MCP | This event submits on Kaggle. |
| `kie-ai`, `higgsfield`, `banana`, `video-gen` | Generated media has no place in a demo whose credibility rests on real screen capture. Possible garnish in the video; never evidence. |
| `stitch`, `figma`, `magic` (21st.dev) | The design brief is a captured reference plus a government accessibility standard. Generated UI would fight both. |
| `serena` | The codebase is small enough to hold whole. |
| `marp-slides` | marp-cli is not installed, and this event's culture is explicitly anti-slides. |
| `concept-to-video` (Manim) | manim not installed, and nothing here needs an animated equation. |
| `grade-rivals` | Confidential and local-only. No rival field to grade yet. |
| `boil-the-ocean` | Scope is already fixed by a hard deadline and a cut ladder. |

## Two findings worth keeping

**A capability audit is worth running for what it rules out.** The three sponsor
tools and the Cerebras credits were all available, all free, and all wrong. The
audit is what made "we deliberately did not use the sponsor tools, here is why"
a defensible sentence instead of an omission a judge notices.

**The MCP wrapper is not always the tool.** Playwright through the MCP timed out
on both the reference site and font-heavy pages; the same library called directly
from a script worked, and then still needed CDP `Page.captureScreenshot` because
`page.screenshot()` waits for a visual stability that a continuous WebGL render
loop never reaches. When a wrapper fails, drop one layer rather than abandoning
the capability.
