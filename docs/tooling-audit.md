# Tooling audit, complete enumeration

Every capability installed on this machine, listed and judged against Renova.
Counted from disk on 2026-07-29:

| Surface | Count |
|---|---|
| Personal skills (`~/.claude/skills/`) | **117** |
| Plugin skill directories | **195** |
| Installed plugins (7 marketplaces) | **25** |
| MCP servers | **11** (9 in `.claude.json`, 2 in `settings.json`) |
| claude.ai connectors | **8** |
| Subagent types (runtime + plugin + personal) | **~45** |
| Plugin slash commands | **~60** |

Verdicts: **USED** (already earned its keep), **QUEUED** (has a named trigger
phase), **NO** (with the reason, because the reasons are what get quietly
reversed under deadline pressure).

Internal document. Not published: a list of which tools built the thing is
process, and process detail is an anti-signal to operator judges.

---

## 1. Personal skills, all 117

### Design and frontend
| Skill | Verdict |
|---|---|
| `frontend-design` | **USED.** Drove the "letter is the light source" direction and both surfaces. |
| `ui-ux-pro-max` | QUEUED. Palette and pairing check against the shipped tokens. |
| `ux-expert` | QUEUED. Dense-interface audit of the result screen. |
| `ui-self-heal` | QUEUED. Iterate the built UI against `docs/design-notes.md` until it measures up. |
| `theme-factory` | NO. The theme is derived from a captured reference plus USWDS. A generated one would fight both. |
| `canvas-design` | NO. No poster or static art needed. |
| `figma-implement-design` | NO. There is no Figma file; the reference was a live site. |
| `concept-to-image` | NO. Diagrams for the writeup are better as prose plus one screenshot. |

### Research and web
| Skill | Verdict |
|---|---|
| `web-research-analyst` | QUEUED. Competitor sweep before the writeup's prior-art paragraph. |
| `last30days` | QUEUED. Only if a Gemma 4 runtime change lands before Saturday. |
| `web-fetch` | **USED.** Verified the model URL, CORS, and byte size by hand. |
| `tavily` | NO. `exa` and `firecrawl` already cover search; a third is redundant. |
| `literature-review` | NO. The health-outcomes evidence is already assembled and fact-checked. |
| `research-critique`, `manuscript-review`, `manuscript-provenance`, `paper-to-skill` | NO. Academic-paper workflows. Not shipping a paper. |
| `youtube-analysis`, `youtube-search` | NO. No video source material to mine. |
| `notebooklm` | NO. Would put the research in a Google notebook rather than in the repo. |
| `to-markdown` | NO. The PDFs were read directly with the Read tool. |

### Code quality, review, debugging
| Skill | Verdict |
|---|---|
| `karpathy-guidelines` | **USED.** Scope discipline; it is why there is no router and no state library. |
| `debug-investigator` | QUEUED. First opaque wasm or WebGPU failure. |
| `pr-review` | QUEUED. Pre-submission diff review. |
| `pre-landing-review` | QUEUED. Friday gate. |
| `plan-review` | **USED** (via `plan-gap-scanner`). 28 gaps, 10 blockers, all closed before code. |
| `devils-advocate` | QUEUED. Pre-mortem refresh Friday night. |
| `grilling` / `grill-me` | **USED.** The four locked decisions came out of a grilling pass. |
| `code-refiner` | QUEUED. Only if the engine grows past readable. |
| `codebase-design` | NO. Modules are already small and single-purpose. |
| `test-harness` | NO. Pytest-oriented; this is Vitest. |
| `qa-systematic` | QUEUED. Golden-path smoke before submit. |
| `immune` | NO. Adaptive-memory layer, redundant with the eval harness here. |
| `improve` | NO. Read-only survey for handing work to other agents; I am doing the work. |

### Security and repo hygiene
| Skill | Verdict |
|---|---|
| `repo-sentinel` | QUEUED. Full audit before the repo is linked from the submission. |
| `security-audit` | NO. Auth, DB permissions, API keys. This app has none of the three. |
| `dependency-audit` | QUEUED. License check feeding `THIRD-PARTY-NOTICES`. |
| `env-validator` | NO. There are no environment variables. |
| `scan-skill` | NO. No third-party skills being installed. |
| `migration-risk-analyzer` | NO. No database. |

### Architecture and planning
| Skill | Verdict |
|---|---|
| `architecture-reviewer` | QUEUED. One pass before the writeup's architecture section. |
| `adr-writer` | **USED** in spirit: the architecture decision is written to the vault as a decision note. |
| `architecture-diagram` | NO. The README's eight-line ASCII pipeline is clearer than a rendered diagram. |
| `task-decomposer`, `estimate-calibrator` | NO. The plan file already carries hour blocks and gates. |
| `feasibility-assessor`, `idea-validator` | NO. Feasibility was settled by GATE W, empirically. |
| `benchmark-runner` | **USED** in spirit: `bench/results.md` follows its shape. |
| `team-plan` | NO. Solo. |
| `boil-the-ocean` | NO. Scope is fixed by a hard deadline and a cut ladder. |

### Hackathon and Sookra methodology
| Skill | Verdict |
|---|---|
| `hackathon-project-flow` | **USED.** Six-phase discipline is the spine of the plan. |
| `hackathon-pre-deploy` | QUEUED. Friday chain. |
| `hard-rule-harvest` | QUEUED. Post-event, into the Galaxy playbook. |
| `sookra-council`, `claude-council` | NO. The five-pillar pressure test was already run at concept lock. |
| `sookra-ideate` | NO. Candidate selection is closed. |
| `grade-rivals` | NO for now. Confidential, local-only, and no rival field exists until Saturday. |
| `three-brain` | QUEUED. Codex adversarial pass on my own diff. Never self-review. |

### Writing and communication
| Skill | Verdict |
|---|---|
| `humanize` | QUEUED. The 1,500-word writeup. |
| `copywriting`, `copy-editing` | QUEUED. Landing copy is written; these audit it. |
| `divergent-ideation` | NO. Naming and framing are locked. |
| `linkedin-post-style` | NO. Not the channel. |
| `md-to-pdf`, `marp-slides`, `html-presentation` | NO. The event is explicitly anti-slides. `marp-cli` is not installed anyway. |
| `changelog-composer` | NO. Commit messages already carry the reasoning. |
| `api-docs-generator` | NO. There is no API. |

### Media
| Skill | Verdict |
|---|---|
| `demo-video-studio` | QUEUED. The submission video, measurement-gated. |
| `demo-video` | QUEUED. Playwright capture of the real app. |
| `remotion-video`, `remotion-best-practices` | QUEUED. Edit layer for the video. |
| `banana`, `video-gen`, `concept-to-video` | NO. Generated media has no place in a demo whose credibility rests on real screen capture. |
| `knowledge-graph-3d`, `graphify`, `drawio-skill` | NO. Nothing here is a graph. |
| `static-web-artifacts-builder` | NO. The product is already a static web artifact. |

### Data and performance
| Skill | Verdict |
|---|---|
| `sql-optimizer` | NO. No database, by design. |
| `gpu-optimizer` | NO. Consumer NVIDIA CUDA. This is Apple Silicon WebGPU. |
| `rag-auditor` | NO. No retrieval layer. |
| `ab-test-setup` | NO. One demo, one day, no traffic. |
| `auto-research` | NO. Hill-climbing loop needs a stable metric and idle time; neither exists. |

### Meta and personal ops
| Skill | Verdict |
|---|---|
| `session-memory` | **USED.** Memory written to both the project store and the vault. |
| `memory-lint` | QUEUED. After the retro, to check the new notes link correctly. |
| `skill-update` | QUEUED. If a reusable workflow emerges. |
| `usage-audit` | NO. Auditing my own context is not on the critical path this week. |
| `filesystem`, `github` | **USED.** File ops and `gh` throughout. |
| `agent-builder`, `mcp-to-skill`, `skill-distiller`, `skill-library`, `package-evaluator`, `surrogate-verifier`, `writing-great-skills`, `prompt-lab` | NO. Skill-engineering workflows, not product work. |
| `morning-brief`, `distill-imports`, `engineering-retro`, `teach` | NO. Not this week. |
| `printing-press` suite (9 skills) | NO. Generates Go CLIs for APIs. Wrong artifact entirely. |
| `lightpanda-browser` | NO. Playwright is already working and WebGPU needs real Chrome. |
| `ship-workflow` | NO. Release pipeline for a versioned package. |
| `doc-condenser`, `regex-builder`, `sequential-thinking` | NO. All three marked deprecated: the base model handles them natively. |

---

## 2. Plugin skills, by plugin

| Plugin | Skills | Verdict |
|---|---|---|
| **superpowers** (14) | brainstorming, dispatching-parallel-agents, executing-plans, finishing-a-development-branch, receiving-code-review, requesting-code-review, subagent-driven-development, systematic-debugging, test-driven-development, using-git-worktrees, using-superpowers, verification-before-completion, writing-plans, writing-skills | **USED**: writing-plans, using-superpowers, dispatching-parallel-agents, test-driven-development. QUEUED: systematic-debugging, verification-before-completion, requesting-code-review. NO: git-worktrees (solo, one branch), executing-plans and subagent-driven-development (plan is being executed directly). |
| **vercel** (29) | ai-gateway, ai-sdk, auth, bootstrap, cdn-caching, chat-sdk, deployments-cicd, env-vars, eve, knowledge-update, marketplace, microfrontends, next-cache-components, next-forge, next-upgrade, nextjs, react-best-practices, routing-middleware, runtime-cache, shadcn, turbopack, vercel-agent, vercel-cli, vercel-connect, vercel-firewall, vercel-functions, vercel-sandbox, vercel-storage, verification, workflow | **USED**: vercel-cli, deployments-cicd (the `ssoProtection` fix). QUEUED: react-best-practices, verification. NO: the other 25. This is a static Vite site with no Next.js, no functions, no storage, no auth, and no AI gateway (the model runs in the browser). |
| **figma** (12) | figma-code-connect, -create-new-file, -design-to-code, -generate-design, -generate-diagram, -generate-library, -implement-motion, -swiftui, -use, -use-figjam, -use-motion, -use-slides | NO, all 12. No Figma file exists; the design reference was a live site captured with Playwright. |
| **pr-review-toolkit** (6 agents) | code-reviewer, code-simplifier, comment-analyzer, pr-test-analyzer, silent-failure-hunter, type-design-analyzer | QUEUED, all. **silent-failure-hunter is the primary lens**: on a tool for low-vision readers, a swallowed error is invisible to exactly the person it harms. |
| **codex** (3 + agent) | codex-cli-runtime, codex-result-handling, gpt-5-4-prompting, codex-rescue | QUEUED. Adversarial pass on my own hardening diff, run foreground. |
| **caveman** (5) | caveman, -commit, -help, -review, compress | **USED**: caveman (active output mode). NO: the rest. |
| **feature-dev** (3 agents) | code-architect, code-explorer, code-reviewer | NO. The codebase is small enough to hold whole. |
| **supabase** (2) | supabase, supabase-postgres-best-practices | NO. No backend and no database, by design. |
| **claude-md-management** (1) | claude-md-improver | **USED** in spirit: wrote a fresh `CLAUDE.md` for the new repo. |
| **code-review**, **code-simplifier**, **improve**, **playground** | | QUEUED: code-review. NO: the others. |
| **cc-gemini-plugin** (agent) | gemini-agent | NO. Large-context codebase sweep; this repo is ~2k lines. |
| **claude-for-legal** (~140 skills across 12 packs) | commercial, corporate, employment, ip, litigation, privacy, product, regulatory, ai-governance, law-student, legal-clinic, legal-builder-hub | **NO, all of them, and this one is worth stating plainly.** The legal packs are tempting for a product that touches benefits law, and using them would be a mistake. Renova must never render legal advice, the disclaimer says so, and running a legal-review skill over it would produce exactly the analysis the product promises not to give. The unauthorized-practice question is a product-scope decision already made, not a document to review. |
| **plugin-dev**, **mcp-server-dev**, **hookify**, **skill-creator**, **agent-sdk-dev**, **code-modernization**, **claude-security**, **cwc-makers**, **math-olympiad**, **session-report**, **receipts**, **discord**, **telegram**, **imessage**, **project-artifact**, **ralph-loop**, **mcp-tunnels** | | NO. Tooling for building tooling, chat integrations, or unrelated domains. |
| **typescript-lsp**, **swift-lsp**, **security-guidance**, **wakatime** | | Passive. typescript-lsp is doing useful work implicitly via `tsc`. |

---

## 3. MCP servers, all 11

| Server | Verdict |
|---|---|
| `firecrawl` | **USED.** Found the browser-WebGPU path. Went down mid-session (ECONNREFUSED); `exa` covered. |
| `exa` | **USED.** Confirmed LiteRT-LM Web, kokoro-js, in-browser PaddleOCR, and the real CHA and CSS Navigator contacts. |
| `claude-in-chrome` | **USED.** Real Chrome with real WebGPU. Headless cannot prove this. |
| `playwright` (plugin) | Partly used, then **dropped one layer**: the MCP timed out on font-heavy and animated pages; the library called directly from `scripts/shot.mjs` works. |
| `context7` | QUEUED. Library APIs in preference to search. |
| `render` | NO. Would mean a backend, which is the thing being deliberately deleted. |
| `serena` | NO. Symbol navigation for large codebases. |
| `magic` (21st.dev) | NO. Generated UI components would fight both the captured reference and the USWDS constraints. |
| `stitch` (Google) | NO. Same reason. |
| `kie-ai` | NO. Media generation. Possible video garnish only, never evidence. |
| `higgsfield` | NO. Same. |
| `devpost` | NO. This event submits on Kaggle. |
| `nanobanana-mcp` (in settings.json) | NO. **And it holds a plaintext Google AI key that should be rotated.** |

---

## 4. claude.ai connectors, all 8

| Connector | Verdict |
|---|---|
| **Gmail** | **USED.** Two validator outreach drafts to Community Health Advocates and the CSS Navigator Network. Drafts only; Stephen sent them. |
| Context7 | QUEUED. Library docs. |
| Google Drive | NO. Nothing to store; the repo is the artifact. |
| Google Calendar | NO. The schedule lives in the plan file. |
| Notion | NO. Memory goes to the Obsidian vault and the project store. |
| Slack | NO. Event comms are on Discord, which has no connector here. |
| Airtable | NO. No structured data to hold. |
| Figma | NO. No design file. |

---

## 5. Subagents

| Agent | Verdict |
|---|---|
| `Explore` | **USED x3.** Vault playbook (71 HARD RULES), 37 memory dirs, full tool surface, in parallel. |
| `Plan` | **USED.** Verified `@litert-lm/core` against its shipped `.d.ts` and killed the browser-LoRA plan before it cost three days. |
| `plan-gap-scanner` (personal) | **USED.** 28 gaps, 10 blockers, closed before any code. |
| `pr-review-toolkit:silent-failure-hunter` | QUEUED. Primary review lens. |
| `pr-review-toolkit:*` (5 others) | QUEUED. |
| `codex:codex-rescue` | QUEUED. Adversarial pass on my own diff. |
| `general-purpose`, `claude` | Available. Not needed while the work is direct. |
| `feature-dev:*`, `cc-gemini-plugin:gemini-agent`, `code-simplifier`, `vercel:*` (3), `claude-code-guide`, `statusline-setup` | NO. Codebase too small, wrong stack, or unrelated. |
| `claude-for-legal` watchers (8), `code-modernization` (8), `claude-security` (7), `plugin-dev` (3), `agent-sdk-dev` (2), `hookify` (1) | NO. Wrong domain. |

---

## 6. What this sweep actually changed

An enumeration is only worth the time if it changes a decision. Three did.

1. **The legal packs are a trap, and I would have reached for them.** ~140 legal skills sit one command away, and a Medicaid product invites them. Using one would generate the exact legal analysis this product's disclaimer promises not to provide. Writing that down means it does not get reconsidered at 2am on Friday.

2. **The sponsor tools are all cloud, and naming them as deliberate is stronger than omitting them.** Tavily, Twilio, and Daytona are the event's own sponsors with their own side prizes, and Cerebras credits are already in hand. Every one of them is a hosted service, in direct tension with the offline claim that wins this track. "We did not use the sponsor tools, here is why" is a defensible sentence. Silence is a gap a judge notices.

3. **The MCP wrapper is not always the tool.** Playwright through the MCP timed out on the reference site and on font-heavy pages; called directly it worked, and then still needed CDP `Page.captureScreenshot` because `page.screenshot()` waits for a visual stability a continuous WebGL render loop never reaches. When a wrapper fails, drop one layer rather than abandoning the capability.
