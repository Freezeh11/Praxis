# Praxis — Documentation Hub

**Praxis** is an interactive web application for learning **Boolean expression simplification**
through step-by-step logic puzzles. A learner is shown an expression such as `x + xy`, selects
literals or terms in the expression, chooses the Boolean law that applies, and watches the
expression simplify one justified step at a time until it reaches the target form.

This folder is the complete technical documentation suite for Praxis. It is written so that a
new team member — including one who is a student and has never seen this repository — can go
from `git clone` to understanding the Boolean engine internals **without asking anyone**.

---

## Contents

1. [What this is / who it is for](#what-this-is--who-it-is-for)
2. [Start here — pick your path](#start-here--pick-your-path)
3. [Doc-to-audience matrix](#doc-to-audience-matrix)
4. [Full structure](#full-structure)
5. [How these docs were verified](#how-these-docs-were-verified)
6. [Keeping these docs current](#keeping-these-docs-current)

---

## What this is / who it is for

These docs describe **the code as it actually exists**, verified against the repository at
commit `3838343`. Where the original project proposal disagrees with the code, the code is
documented as truth and the disagreement is recorded in a discrepancy register — see
[known-limitations.md](07-explanation/known-limitations.md) and the
[verification report](verification-report.md).

---

## Start here — pick your path

### Path 1 — New developer (you will write code)

| # | Read | Why |
|---|---|---|
| 1 | [getting-started.md](05-guides/tutorials/getting-started.md) | Clone → env → both servers → Supabase → solve Level 1 |
| 2 | [SAD.md](02-architecture/SAD.md) | The 10-minute mental model of the whole system |
| 3 | [file-map.md](10-project/file-map.md) | "Where does X live?" |
| 4 | [glossary.md](10-project/glossary.md) | The vocabulary you need before anything else makes sense |
| 5 | [RULES.md](rules/RULES.md) | The conventions you are expected to follow |
| 6 | [API-REFERENCE.md](04-api/API-REFERENCE.md) | Every endpoint you will call |
| 7 | [understanding-the-engine.md](05-guides/tutorials/understanding-the-engine.md) | How the Boolean engine actually works |
| 8 | [first-contribution.md](05-guides/tutorials/first-contribution.md) | Your first real change, end to end |

### Path 2 — New teammate, non-coder (product, design, QA, support)

| # | Read | Why |
|---|---|---|
| 1 | [PRD.md](01-product/PRD.md) | What the product is and who it serves |
| 2 | [glossary.md](10-project/glossary.md) | Plain-language definitions of every domain term |
| 3 | [DIAGRAMS.md](09-diagrams/DIAGRAMS.md) | Every flow as a picture — start with the context and container diagrams |
| 4 | [scoring-and-rewards.md](06-reference/scoring-and-rewards.md) | How points, stars and unlocks really work |
| 5 | [boolean-laws.md](06-reference/boolean-laws.md) | The 10 laws the game teaches |
| 6 | [known-limitations.md](07-explanation/known-limitations.md) | What the product does *not* do, and where the proposal is stale |
| 7 | [SRS.md](01-product/SRS.md) | Requirements with acceptance criteria, for test planning |

### Path 3 — DevOps / operations

| # | Read | Why |
|---|---|---|
| 1 | [installation-manual.md](08-devops/installation-manual.md) | Reproducible setup on Windows and macOS/Linux |
| 2 | [configuration-guide.md](08-devops/configuration-guide.md) | Every environment variable, and what breaks without it |
| 3 | [deployment.md](08-devops/deployment.md) | Render (backend) + Vercel (frontend) deployment |
| 4 | [monitoring.md](08-devops/monitoring.md) | What to watch and when to alert |
| 5 | [runbooks.md](08-devops/runbooks.md) | Step-by-step recovery procedures |
| 6 | [config-reference.md](06-reference/config-reference.md) | Every constant and design token in one table |

> **Before you deploy anything, read the deployment reality check:** `render.yaml` defines
> **only** the Python API service. The React single-page app is deployed separately to Vercel.
> See [deployment.md](08-devops/deployment.md) §1.

---

## Doc-to-audience matrix

Audience key: **Dev** = developer/engineer · **Non-dev** = product, design, QA, support ·
**Ops** = DevOps/SRE · **New** = first week on the project.

| Document | Primary audience | Also useful for | Answers the question |
|---|---|---|---|
| [README.md](README.md) | everyone | — | Where do I start? |
| **01-product** | | | |
| [PRD.md](01-product/PRD.md) | Non-dev | New, Dev | What are we building and for whom? |
| [SRS.md](01-product/SRS.md) | Non-dev | Dev, QA | What exactly must the software do? |
| **02-architecture** | | | |
| [SAD.md](02-architecture/SAD.md) | Dev | Ops, New | How is the system put together? |
| [SDD.md](02-architecture/SDD.md) | Dev | — | How is each module designed? |
| [REFACTOR-NOTES.md](02-architecture/REFACTOR-NOTES.md) | Dev | New | Why is the layout shaped this way? |
| **03-database** | | | |
| [ERD.md](03-database/ERD.md) | Dev | Ops | What tables exist and how do they relate? |
| [SCHEMA.md](03-database/SCHEMA.md) | Dev | Ops | What is every column, index and RLS policy? |
| **04-api** | | | |
| [API-REFERENCE.md](04-api/API-REFERENCE.md) | Dev | QA | What are the endpoints and their exact payloads? |
| **05-guides** | | | |
| [getting-started.md](05-guides/tutorials/getting-started.md) | New | Ops | How do I run this today? |
| [understanding-the-engine.md](05-guides/tutorials/understanding-the-engine.md) | New | Non-dev | How does the Boolean engine work? |
| [first-contribution.md](05-guides/tutorials/first-contribution.md) | New | — | How do I make my first change? |
| [add-a-new-level.md](05-guides/how-to/add-a-new-level.md) | Dev | Non-dev | How do I add a level? |
| [add-a-new-problem.md](05-guides/how-to/add-a-new-problem.md) | Dev | Non-dev | How do I add a puzzle? |
| [add-a-new-law.md](05-guides/how-to/add-a-new-law.md) | Dev | — | How do I add a Boolean law? |
| [debug-a-failing-step.md](05-guides/how-to/debug-a-failing-step.md) | Dev | QA | A step is broken — where do I look? |
| [reset-user-progress.md](05-guides/how-to/reset-user-progress.md) | Dev | Ops, QA | How do I wipe a user's progress? |
| [run-locally-with-docker.md](05-guides/how-to/run-locally-with-docker.md) | Dev | Ops | Can I run this in Docker? |
| **06-reference** | | | |
| [boolean-laws.md](06-reference/boolean-laws.md) | Non-dev | Dev, QA | What are the 10 laws, exactly? |
| [scoring-and-rewards.md](06-reference/scoring-and-rewards.md) | Non-dev | Dev, QA | How is a score computed? |
| [config-reference.md](06-reference/config-reference.md) | Dev | Ops | What is every tunable value? |
| [error-codes.md](06-reference/error-codes.md) | Dev | QA, Ops | What does this error code mean? |
| **07-explanation** | | | |
| [why-this-architecture.md](07-explanation/why-this-architecture.md) | Dev | Non-dev | Why was it built this way? |
| [design-decisions.md](07-explanation/design-decisions.md) | Dev | — | What did we decide, and what did we reject? |
| [known-limitations.md](07-explanation/known-limitations.md) | everyone | — | What is broken, missing, or stale? |
| **08-devops** | | | |
| [installation-manual.md](08-devops/installation-manual.md) | Ops | New | How do I set up a machine? |
| [deployment.md](08-devops/deployment.md) | Ops | Dev | How do I ship it? |
| [configuration-guide.md](08-devops/configuration-guide.md) | Ops | Dev | Which env vars do I need? |
| [runbooks.md](08-devops/runbooks.md) | Ops | Dev | It is down — what now? |
| [monitoring.md](08-devops/monitoring.md) | Ops | Dev | What should I watch? |
| **09-diagrams** | | | |
| [DIAGRAMS.md](09-diagrams/DIAGRAMS.md) | everyone | — | Show me a picture of the flow |
| **10-project** | | | |
| [glossary.md](10-project/glossary.md) | everyone | — | What does this word mean? |
| [file-map.md](10-project/file-map.md) | Dev | New | Where does X live? |
| [changelog.md](10-project/changelog.md) | everyone | — | What changed in the docs? |
| **rules** | | | |
| [RULES.md](rules/RULES.md) | Dev | Non-dev | What are the house rules? |
| **verification** | | | |
| [verification-report.md](verification-report.md) | Dev | Non-dev | How do we know these docs are accurate? |

---

## Full structure

```
docs/
├── README.md                      ← you are here
├── 01-product/
│   ├── PRD.md                     Product Requirements Document
│   └── SRS.md                     Software Requirements Specification
├── 02-architecture/
│   ├── SAD.md                     System Architecture Description
│   ├── SDD.md                     Software Design Description
│   └── REFACTOR-NOTES.md          Layer rationale and the engine contract
├── 03-database/
│   ├── ERD.md                     Entity-relationship diagram + per-table notes
│   └── SCHEMA.md                  Column-by-column reference incl. RLS policies
├── 04-api/
│   └── API-REFERENCE.md           All 7 endpoints, fields, errors, examples
├── 05-guides/
│   ├── tutorials/
│   │   ├── getting-started.md
│   │   ├── understanding-the-engine.md
│   │   └── first-contribution.md
│   └── how-to/
│       ├── add-a-new-level.md
│       ├── add-a-new-problem.md
│       ├── add-a-new-law.md
│       ├── debug-a-failing-step.md
│       ├── reset-user-progress.md
│       └── run-locally-with-docker.md
├── 06-reference/
│   ├── boolean-laws.md
│   ├── scoring-and-rewards.md
│   ├── config-reference.md
│   └── error-codes.md
├── 07-explanation/
│   ├── why-this-architecture.md
│   ├── design-decisions.md
│   └── known-limitations.md       ← includes the Known Discrepancies register
├── 08-devops/
│   ├── installation-manual.md
│   ├── deployment.md
│   ├── configuration-guide.md
│   ├── runbooks.md
│   └── monitoring.md
├── 09-diagrams/
│   └── DIAGRAMS.md                All 12 Mermaid diagrams in one place
├── 10-project/
│   ├── glossary.md
│   ├── file-map.md                "Where does X live?" index
│   └── changelog.md
├── rules/
│   └── RULES.md
├── verification-report.md         Independent accuracy audit of this suite
│
├── _staging/                      ⚙️ INTERNAL working material — not part of the suite
├── context.md                     ⚠️ LEGACY proposal — stale, see note below
├── ARCHITECTURE.md                ⚠️ LEGACY folder map — partially superseded
├── REFACTOR_REPORT.md             ⚠️ LEGACY refactor write-up — input to REFACTOR-NOTES.md
├── SKILLS.md                      ⚠️ LEGACY skills/onboarding notes
└── Software Proposal Writing Guide (LAWS) v2.0.docx.md   ⚠️ LEGACY course rubric for the proposal
```

### About the five legacy files

`context.md`, `ARCHITECTURE.md`, `REFACTOR_REPORT.md`, `SKILLS.md` and the
`Software Proposal Writing Guide (LAWS) v2.0.docx.md` rubric predate this suite and have been
**kept as historical inputs**. `context.md` in particular is a *proposal* written
before most of the application existed, and large parts of it are now false — it states that
Supabase is not integrated, that there is no authentication, that no landing/login/register
pages exist, that there are 3 levels with 6 puzzles each, and that Level 3 is unplayable.
None of that is true of the current code.

**Read the new suite, not the legacy files.** Where any legacy file conflicts with this suite,
this suite wins because it was verified against the code. The specific conflicts are
catalogued in [known-limitations.md](07-explanation/known-limitations.md).

### Internal working material (`_staging/`)

`docs/_staging/` holds the **audit trail** behind this suite, not part of the reader-facing
documentation:

| File | What it is |
|---|---|
| `GROUND-TRUTH.md` | The verified fact base every writer worked from — code layout, every endpoint behaviour, all constants, and the D0–D27 discrepancy register. |
| `claims-*.md` | Seven **claim ledgers**: one row per substantive claim, with its `file:line` evidence and how it was verified (read / ran). |
| `diagram-input-*.md` | The per-domain Mermaid source the diagrams author reconciled into `09-diagrams/DIAGRAMS.md`. |
| `prep-diagrams.md` | The diagrams author's verified notes and correction register. |
| `verification/` | The independent verifier's scratch output (audit JSON, citation checker, one-shot re-run script). |
| `tools/` | `check-docs.mjs` — the suite acceptance gate (completeness, every cross-link and anchor, secret scan, Mermaid fence sanity) — plus a Mermaid parser validator and its rebuild recipe. |

Maintainers should keep `tools/check-docs.mjs` green after any doc change:

```bash
node docs/_staging/tools/check-docs.mjs
```


---

## How these docs were verified

Accuracy was the primary requirement, so the suite was produced under a verification regime:

1. **Ground truth first.** A verified fact base — code layout, all 7 endpoint behaviours
   (captured by executing the API), all database columns and policies, every scoring constant,
   and a register of 28 proposal-vs-code discrepancies (D0–D27, 17 of them serious) — was
   established before writing began.
2. **Executable evidence.** Writers were required to *run* the code rather than read it where
   possible: the API was exercised with `fastapi.testclient`, the scoring service was executed
   with real inputs, the Boolean engine was driven from `node`, and `npm test` was run to
   confirm the engine test count.
3. **Claim ledgers.** Every writer recorded each substantive claim with its `file:line`
   evidence, so claims are traceable rather than asserted.
4. **Independent verification.** A separate verifier — which did not write any of the docs —
   re-checked the suite against the code: mechanically resolving every cross-link, spot-checking
   60+ code claims, re-executing all 7 endpoints, re-deriving every scoring example, and
   auditing counts, terminology and consistency. Its findings are in
   [verification-report.md](verification-report.md).

### Documentation conventions

- **Language:** English, Markdown only.
- **Links:** relative paths, always verified to resolve on disk.
- **Evidence:** non-obvious claims are cited inline as `path/to/file.py:123`.
- **Uncertainty:** anything unverifiable is explicitly marked rather than guessed.
- **Secrets:** no document in this suite contains a real credential value. Environment
  variables are shown as placeholders such as `<service-role-key>`.
- **Terminology:** one canonical term per concept; the authority is
  [glossary.md](10-project/glossary.md).

---

## Keeping these docs current

The suite is only as good as its freshness. These source files carry the highest documentation
risk — change one and the listed docs likely need an update:

| If you change… | Update… |
|---|---|
| `backend/api/routes/*`, `backend/api/schemas/*` | [API-REFERENCE.md](04-api/API-REFERENCE.md), [error-codes.md](06-reference/error-codes.md) |
| `backend/config/constants.py` | [scoring-and-rewards.md](06-reference/scoring-and-rewards.md), [config-reference.md](06-reference/config-reference.md) |
| `frontend/src/config/gameRules.js` | [config-reference.md](06-reference/config-reference.md), [scoring-and-rewards.md](06-reference/scoring-and-rewards.md) |
| `database/init.sql` | [SCHEMA.md](03-database/SCHEMA.md), [ERD.md](03-database/ERD.md) |
| `content/laws.json` | [boolean-laws.md](06-reference/boolean-laws.md) |
| `content/levels.json` | [add-a-new-problem.md](05-guides/how-to/add-a-new-problem.md), [SRS.md](01-product/SRS.md) |
| `frontend/src/App.jsx` | [SAD.md](02-architecture/SAD.md), [DIAGRAMS.md](09-diagrams/DIAGRAMS.md) |
| `frontend/src/engine/**` | [understanding-the-engine.md](05-guides/tutorials/understanding-the-engine.md), [boolean-laws.md](06-reference/boolean-laws.md) |
| `render.yaml` | [deployment.md](08-devops/deployment.md), [configuration-guide.md](08-devops/configuration-guide.md) |
| anything under `backend/` or `frontend/src/` | [file-map.md](10-project/file-map.md) |

The maintenance procedure itself is described in
[changelog.md](10-project/changelog.md).
