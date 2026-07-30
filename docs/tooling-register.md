# Complete per-item tooling register

Every individual capability installed on this machine, named and judged against
Renova. The companion `tooling-audit.md` explains the reasoning that came out of
this sweep; this file is the raw enumeration it was drawn from, so nothing is
represented by a category summary.

Counted from disk 2026-07-29:

| Surface | Count |
|---|---|
| Personal skills | 117 |
| Plugin skills (marketplaces) | 196 |
| Plugin skills (cache, incl. duplicate versions) | 106 |
| Installed plugins, 7 marketplaces | 25 |
| MCP servers | 11 |
| claude.ai connectors | 8 |
| Subagent types | ~45 |

Legend: **U** used · **Q** queued with a named trigger · **N** not applicable.

---

## 1. Personal skills, 117 of 117

`ab-test-setup` N one demo, one day, no traffic · `adr-writer` U architecture decision written to the vault · `agent-builder` N not building an agent · `api-docs-generator` N no API · `architecture-diagram` N the README's ASCII pipeline is clearer · `architecture-reviewer` Q one pass before the writeup · `auto-research` N needs a stable metric and idle time · `banana` N generated imagery has no place in this demo · `benchmark-runner` U `bench/results.md` follows its shape · `boil-the-ocean` N scope fixed by deadline and cut ladder · `canvas-design` N no poster · `changelog-composer` N commit messages carry the reasoning · `claude-council` N pillar test already run at concept lock · `code-refiner` Q only if the engine outgrows readable · `codebase-design` N modules already single-purpose · `concept-to-image` N · `concept-to-video` N manim not installed · `copy-editing` Q audits the landing copy · `copywriting` Q same · `debug-investigator` Q first opaque wasm failure · `demo-video` Q Playwright capture of the real app · `demo-video-studio` Q the submission video · `dependency-audit` Q license check feeding THIRD-PARTY-NOTICES · `devils-advocate` Q pre-mortem refresh Friday · `distill-imports` N · `divergent-ideation` N naming locked · `doc-condenser` N deprecated · `drawio-skill` N nothing here is a diagram · `engineering-retro` N post-event at best · `env-validator` N no environment variables · `estimate-calibrator` N plan carries hour blocks · `feasibility-assessor` N settled empirically by GATE W · `figma-implement-design` N no Figma file · `filesystem` U throughout · `frontend-design` U drove both surfaces · `github` U `gh` throughout · `gpu-optimizer` N CUDA, not Apple WebGPU · `grade-rivals` N confidential, no rival field until Saturday · `graphify` N · `grill-me` U the four locked decisions · `grilling` U same · `hackathon-pre-deploy` Q Friday chain · `hackathon-project-flow` U the spine of the plan · `hard-rule-harvest` Q post-event · `html-presentation` N event is anti-slides · `humanize` Q the writeup · `idea-validator` N candidate selection closed · `immune` N redundant with the eval harness · `improve` N I am doing the work, not delegating it · `karpathy-guidelines` U why there is no router · `knowledge-graph-3d` N · `last30days` Q only if a Gemma runtime change lands · `lightpanda-browser` N WebGPU needs real Chrome · `linkedin-post-style` N wrong channel · `literature-review` N evidence already assembled · `manuscript-provenance` N · `manuscript-review` N · `marp-slides` N marp-cli not installed · `mcp-to-skill` N · `md-to-pdf` N · `memory-lint` Q after the retro · `migration-risk-analyzer` N no database · `morning-brief` N · `notebooklm` N research belongs in the repo · `package-evaluator` N · `paper-to-skill` N · `plan-review` U via plan-gap-scanner, 28 gaps · `pr-review` Q pre-submission · `pre-landing-review` Q Friday gate · `printing-press` N generates Go CLIs · `printing-press-catalog` N · `printing-press-import` N · `printing-press-output-review` N · `printing-press-polish` N · `printing-press-publish` N · `printing-press-reprint` N · `printing-press-retro` N · `printing-press-score` N · `prompt-lab` Q if Gemma's prose quality needs work · `qa-systematic` Q golden-path smoke · `rag-auditor` N no retrieval · `regex-builder` N deprecated · `remotion-best-practices` Q video edit layer · `remotion-video` Q same · `repo-sentinel` Q before the submission links the repo · `research-critique` N · `scan-skill` N installing no third-party skills · `security-audit` N no auth, no DB, no keys · `sequential-thinking` N deprecated · `session-memory` U memory written both places · `ship-workflow` N not a versioned package · `skill-distiller` N · `skill-library` N · `skill-update` Q if a reusable workflow emerges · `sookra-council` N pillar test done · `sookra-ideate` N · `sql-optimizer` N no database · `static-web-artifacts-builder` N the product already is one · `surrogate-verifier` N · `task-decomposer` N · `tavily` N exa and firecrawl already cover search · `teach` N · `team-plan` N solo · `test-harness` N pytest-oriented, this is Vitest · `theme-factory` N theme derived from reference plus USWDS · `three-brain` Q Codex adversarial pass · `to-markdown` N PDFs read directly · `ui-self-heal` Q iterate against design-notes · `ui-ux-pro-max` Q palette and pairing check · `usage-audit` N not critical path · `ux-expert` Q result-screen audit · `video-gen` N · `web-fetch` U verified the model URL, CORS, byte size · `web-research-analyst` Q prior-art paragraph · `writing-great-skills` N · `youtube-analysis` N · `youtube-search` N

---

## 2. Vercel plugin, 29 of 29

`ai-gateway` N model runs in the browser, no gateway · `ai-sdk` N no server-side AI calls · `auth` N no accounts by design · `benchmark-agents` N plugin-internal · `benchmark-e2e` N plugin-internal · `benchmark-sandbox` N plugin-internal · `benchmark-testing` N plugin-internal · `bootstrap` N no Vercel-linked resources · `cdn-caching` Q if the 2 GB asset needs cache headers tuned · `chat-sdk` N not a chat bot · `deployments-cicd` **U** the `ssoProtection` fix came from here · `env-vars` N no env vars · `eve` N not an agent framework build · `knowledge-update` U injected at session start · `marketplace` N · `microfrontends` N single static bundle · `next-cache-components` N no Next.js · `next-forge` N · `next-upgrade` N · `nextjs` N Vite, not Next · `plugin-audit` N plugin-internal · `react-best-practices` Q TSX review before freeze · `release` N plugin-internal · `routing-middleware` N no middleware, no routes · `runtime-cache` N nothing to cache server-side · `shadcn` N no component library, by design · `turbopack` N Vite · `vercel-agent` N · `vercel-cli` **U** deploy, alias, project link · `vercel-connect` N no third-party OAuth · `vercel-firewall` N nothing to defend, no server · `vercel-functions` N zero functions, that is the architecture · `vercel-sandbox` N · `vercel-storage` N no storage, that is the point · `verification` Q full-flow check before submit · `workflow` N no durable workflows

## 3. Superpowers, 14 of 14

`brainstorming` U before plan mode · `dispatching-parallel-agents` U three Explore agents in parallel · `executing-plans` N executing directly, not in a separate session · `finishing-a-development-branch` N single branch, solo · `receiving-code-review` **U** the silent-failure review, eight fixes · `requesting-code-review` **U** requested that review · `subagent-driven-development` N tasks are not independent enough to farm out · `systematic-debugging` U the jsdelivr and Vite-public-dir hunts · `test-driven-development` U the rules engine and the regression tests · `using-git-worktrees` N solo, one branch · `using-superpowers` U session start · `verification-before-completion` **U** every "green" claim in this repo is measured · `writing-plans` U the plan file · `writing-skills` N not authoring a skill

## 4. Figma plugin, 12 of 12

`figma-code-connect` · `figma-create-new-file` · `figma-design-to-code` · `figma-generate-design` · `figma-generate-diagram` · `figma-generate-library` · `figma-implement-motion` · `figma-swiftui` · `figma-use` · `figma-use-figjam` · `figma-use-motion` · `figma-use-slides` · `generate-project-plan` · `video-interaction-mapper`

**All N.** There is no Figma file. The design reference was a live website captured with Playwright, and the constraints are a captured vocabulary plus a government accessibility standard. `figma-swiftui` is doubly out: no iOS surface.

## 5. Other plugins, every skill

**codex** `codex-cli-runtime` Q, `codex-result-handling` Q, `gpt-5-4-prompting` Q — all three load when the adversarial pass runs.
**caveman** `caveman` U (active output mode), `caveman-commit` N (commits are written normally, per its own rule), `caveman-review` N, `caveman-help` N, `compress` N.
**cc-gemini-plugin** `gemini` N — large-context sweep, this repo is ~3k lines.
**claude-md-management** `claude-md-improver` Q — the new repo needs its own CLAUDE.md before Friday.
**frontend-design** `frontend-design` **U**.
**improve** `improve` N — produces plans for other agents.
**playground** `playground` N — the product is already an interactive page.
**supabase** `supabase` N, `supabase-postgres-best-practices` N — no backend, no database.
**hookify / mcp-server-dev / plugin-dev / skill-creator / agent-sdk-dev / code-modernization / claude-security / cwc-makers / math-olympiad / session-report / receipts / discord / telegram / imessage / project-artifact / ralph-loop / mcp-tunnels / example-plugin** — all N. Tooling for building tooling, chat integrations, or unrelated domains.

## 6. claude-for-legal, all 110 distinct skills across 12 packs

`ai-inventory` `ai-tool-handoff` `aia-generation` `amendment-history` `auto-updater` `bar-prep-questions` `board-minutes` `brief-section-drafter` `build-guide` `case-brief` `cease-desist` `chronology` `claim-chart` `clearance` `client-comms-log` `client-intake` `client-letter` `closing-checklist` `cold-call-prep` `cold-start-interview` `comments` `customize` `deadlines` `deal-team-summary` `deep-research` `demand-draft` `demand-intake` `demand-received` `deposition-prep` `diligence-issue-extraction` `disable` `dpa-review` `draft` `dsar-response` `entity-compliance` `escalation-flagger` `exam-forecast` `expansion-kickoff` `expansion-update` `feature-risk-assessment` `flashcards` `form-generation` `fto-triage` `gap-surfacer` `gaps` `handbook-updates` `hiring-review` `infringement-triage` `integration-management` `internal-investigation` `international-expansion` `invention-intake` `investigation-add` `investigation-memo` `investigation-open` `investigation-query` `investigation-summary` `ip-clause-review` `irac-practice` `is-this-a-problem` `launch-review` `leave-tracker` `legal-hold` `legal-writing` `log-leave` `marketing-claims-review` `material-contract-schedule` `matter-briefing` `matter-close` `matter-intake` `matter-update` `matter-workspace` `memo` `nda-review` `oc-status` `oss-review` `outline-builder` `pia-generation` `plain-language-letters` `policy-diff` `policy-drafting` `policy-monitor` `policy-redraft` `portfolio` `portfolio-status` `privilege-log-review` `ramp` `reg-feed-watcher` `reg-gap-analysis` `registry-browser` `related-skills-surfacer` `renewal-tracker` `research-start` `review` `review-proposals` `saas-msa-review` `semester-handoff` `session` `skill-installer` `skill-manager` `skills-qa` `socratic-drill` `stakeholder-summary` `status` `study-plan` `subpoena-triage` `supervisor-review-queue` `tabular-review` `takedown` `termination-review` `uninstall` `use-case-triage` `vendor-agreement-review` `vendor-ai-review` `wage-hour-qa` `worker-classification` `written-consent`

**All N, and this is the most important N in the register.** A Medicaid product invites these, and three look directly relevant: `plain-language-letters`, `deadlines`, `client-letter`. Using any of them would generate exactly the legal analysis this product's disclaimer promises **not** to provide. The unauthorized-practice question is a scope decision already made and encoded in the disclaimer, not a document to be reviewed. `oss-review` is the one arguable exception, and `THIRD-PARTY-NOTICES` already covers it by hand.

---

## 7. MCP servers, 11 of 11

| Server | Verdict |
|---|---|
| `firecrawl` (23 tools) | **U** found the browser-WebGPU path. Went down mid-session; `exa` covered. |
| `exa` (2 tools) | **U** confirmed LiteRT-LM Web, kokoro-js, in-browser PaddleOCR, and the real CHA and CSS contacts. |
| `claude-in-chrome` (24 tools) | **U** real Chrome with real WebGPU. Every end-to-end verification ran here. |
| `playwright` (25 tools) | Partly used, then **dropped one layer**: the MCP times out on animated and font-heavy pages; the library called directly works. |
| `context7` (2 tools) | Q library APIs in preference to search. |
| `serena` (22 tools) | N symbol navigation for large codebases. |
| `render` (21 tools) | N would mean a backend, the thing deliberately deleted. |
| `magic` / 21st.dev | N generated components would fight the captured reference and the USWDS constraints. |
| `stitch` (16 tools) | N same. |
| `kie-ai` (30 tools) | N generated media is never evidence in this demo. |
| `higgsfield` (80+ tools) | N same. |
| `devpost` (20 tools) | N this event submits on Kaggle. |
| `nanobanana-mcp` (settings.json) | N **and it holds a plaintext Google AI key that should be rotated.** |
| `supabase`, `vercel`, `figma`, `ide` plugin MCPs | N / passive. |

## 8. claude.ai connectors, 8 of 8

`Gmail` **U** two validator drafts · `Context7` Q library docs · `Google Drive` N the repo is the artifact · `Google Calendar` N schedule lives in the plan file · `Notion` N memory goes to the vault and project store · `Slack` N event comms are on Discord, no connector · `Airtable` N no structured data · `Figma` N no design file

## 9. Subagents

**Used:** `Explore` (x3), `Plan`, `plan-gap-scanner`, `pr-review-toolkit:silent-failure-hunter`.
**Queued:** `pr-review-toolkit:code-reviewer`, `:code-simplifier`, `:comment-analyzer`, `:pr-test-analyzer`, `:type-design-analyzer`, `codex:codex-rescue`.
**N:** `general-purpose`, `claude`, `claude-code-guide`, `statusline-setup`, `feature-dev:code-architect`, `:code-explorer`, `:code-reviewer`, `cc-gemini-plugin:gemini-agent`, `code-simplifier:code-simplifier`, `vercel:ai-architect`, `:deployment-expert`, `:performance-optimizer`, plus the 8 `claude-for-legal` watchers, 8 `code-modernization`, 7 `claude-security`, 3 `plugin-dev`, 2 `agent-sdk-dev`, and `hookify:conversation-analyzer`.

---

## 10. Native iOS toolchain, added 2026-07-29 night

The iOS build (ios/) brought its own tools, each U:

| Tool | Role |
|---|---|
| Xcode 26.6 + iOS platform SDK | build, sign, archive |
| xcodegen (brew, already installed) | ios/project.yml -> Renova.xcodeproj, project stays out of git |
| esbuild (new devDependency) | bundles src/engine + demo cache + buildScript into renova-engine.js for JavaScriptCore |
| JavaScriptCore (system) | runs the exact eval'd TypeScript rules engine on device; no Swift port exists |
| LiteRT-LM Swift (SPM, google-ai-edge/LiteRT-LM) | native Gemma 4 E2B on Metal; pinned to a main revision because the v0.14.0 tag ships stale binary checksums |
| Vision / VisionKit (system) | document camera + OCR, replacing PP-OCR wasm on iOS only; acceptance is the demo packets, the eval gates on text |
| AVSpeechSynthesizer (system) | read-aloud, same voice-pick order as the web |

## What the full sweep changed

Three decisions, all recorded in `tooling-audit.md`: the legal packs are a trap
worth naming rather than silently skipping; the event's own sponsor tools are all
cloud and saying so deliberately beats omitting them; and a failing MCP wrapper
is a reason to drop one layer, not to abandon the capability.

One correction the register itself forced: `superpowers:receiving-code-review`
and `:requesting-code-review` were marked N in the first pass as ceremony for
teams. They are the two that produced the eight silent-failure fixes, which are
the most valuable changes in the repo. Reading them individually rather than
by category is what caught that.
