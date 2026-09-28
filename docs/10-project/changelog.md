# Praxis — Documentation Changelog

**What this is:** the change history of the Praxis documentation suite, plus the maintenance
procedure for keeping it accurate.

**Who it's for:** anyone who needs to know whether a document is current, what was verified when,
and which source files force which documents to be updated.

Entries are newest-first. Each entry records the **date**, the **commit the claims were verified
against**, what changed, and — importantly — the **findings**: numbers that turned out to be wrong,
rules that turned out to be unenforced, and claims that could not be verified.

---

## Contents

- [2026-09-28: Initial documentation suite](#2026-09-28-initial-documentation-suite)
  - [What was created](#what-was-created)
  - [Verification method](#verification-method)
  - [Findings: verified counts that correct earlier figures](#findings-verified-counts-that-correct-earlier-figures)
  - [Findings: proposal-vs-code discrepancies](#findings-proposal-vs-code-discrepancies)
  - [Findings: things that are not enforced](#findings-things-that-are-not-enforced)
  - [Findings: security and hygiene observations](#findings-security-and-hygiene-observations)
  - [Unverified claims](#unverified-claims)
  - [Remediation round: independent audit of the project-reference slice](#remediation-round-independent-audit-of-the-project-reference-slice)
- [How to keep these docs current](#how-to-keep-these-docs-current)
  - [Change-to-document trigger table](#change-to-document-trigger-table)
  - [The five-step maintenance procedure](#the-five-step-maintenance-procedure)
  - [How to run the checks](#how-to-run-the-checks)

---

## 2026-09-28: Initial documentation suite

**Verified against commit** `38383439478bb3260eecc88bccc456e3e4209ec0` (short `3838343`),
"test(engine): re-baseline the fingerprint and re-author par after the soundness fix".

**What happened.** The repository previously had five tracking documents — `context.md`,
`ARCHITECTURE.md`, `REFACTOR_REPORT.md`, `SKILLS.md` and the original proposal guide. The first of
those is a *proposal* written before most of the application existed, and large parts of it are now
false. This was the creation of a complete, code-verified documentation suite to replace it: a hub,
nine numbered sections, a project-reference slice and a rules page, every claim cited to `file:line`.

The five pre-existing documents were **kept and frozen** as historical inputs rather than edited or
deleted, so the reasoning that produced the current architecture is still readable and the
disagreements are traceable.

### What was created

| Document | What it covers |
|---|---|
| [`docs/README.md`](../README.md) | The hub: three reading paths (developer, non-coder, ops), a doc-to-audience matrix, and the conventions. |
| [`docs/01-product/PRD.md`](../01-product/PRD.md), [`SRS.md`](../01-product/SRS.md) | What the product is and what it must do. |
| [`docs/02-architecture/SAD.md`](../02-architecture/SAD.md) | The system architecture and module design. |
| [`docs/03-database/SCHEMA.md`](../03-database/SCHEMA.md), [`ERD.md`](../03-database/ERD.md) | Every table, column, index and RLS policy. |
| [`docs/04-api/API-REFERENCE.md`](../04-api/API-REFERENCE.md) | All 7 endpoints, with verified requests and responses. |
| [`docs/05-guides/`](../05-guides/) | Getting started, the engine explained, first contribution, and how-to recipes. |
| [`docs/06-reference/boolean-laws.md`](../06-reference/boolean-laws.md), [`scoring-and-rewards.md`](../06-reference/scoring-and-rewards.md), [`config-reference.md`](../06-reference/config-reference.md), [`error-codes.md`](../06-reference/error-codes.md) | The ten laws, the scoring rules, every constant, every error code. |
| [`docs/07-explanation/known-limitations.md`](../07-explanation/known-limitations.md) | The discrepancy register and what the product does not do. |
| [`docs/08-devops/`](../08-devops/) | Installation, configuration, deployment, monitoring, runbooks. |
| [`docs/09-diagrams/DIAGRAMS.md`](../09-diagrams/DIAGRAMS.md) | Every flow as a Mermaid diagram. |
| [`docs/10-project/glossary.md`](glossary.md) | The canonical vocabulary — the authority every other document points at. |
| [`docs/10-project/file-map.md`](file-map.md) | Every one of the 211 tracked files, with its responsibility, exports and importers. |
| [`docs/10-project/changelog.md`](changelog.md) | This file. |
| [`docs/rules/RULES.md`](../rules/RULES.md) | The layering, naming, content, testing and documentation rules, each with evidence. |
| [`docs/verification-report.md`](../verification-report.md) | An independent audit of the suite, written by a verifier who wrote none of it. |

### Verification method

The suite was produced under a verification regime rather than written from memory:

1. **Ground truth first.** A fact base was established before writing began, and corrected during
   the pass whenever a writer proved a figure wrong (see below).
2. **Execute rather than assume.** The API was exercised with `fastapi.testclient`; the scoring
   service was run with real inputs; the Boolean engine was driven from `node`; `npm test` was run
   to get the real test count; the file inventory was produced with `git ls-files`.
3. **Claim ledgers.** Every writer recorded each substantive claim with its `file:line` evidence, so
   claims are traceable rather than asserted. This writer's ledger is
   [`docs/_staging/claims-project-ref.md`](../_staging/claims-project-ref.md).
4. **Independent verification.** A separate verifier re-checked the suite against the code.

For **this slice** (`10-project/`, `rules/`), the specific verification performed was:

| Checked | Command | Result |
|---|---|---|
| Tracked file inventory | `git ls-files \| grep -vE 'node_modules\|venv\|__pycache__\|package-lock' \| sort` | 211 paths |
| Every listed path exists | `… \| while read -r f; do [ -e "$f" ] \|\| echo "MISSING: $f"; done` | no output |
| file-map completeness | extracted all 211 link labels and diffed against the tracked list | 211 listed, 0 missing, 0 duplicates, 0 invented |
| Backend size | `git ls-files 'backend/*.py' \| wc -l` and `… \| xargs wc -l` | 28 modules, 1,241 lines |
| Engine size | `git ls-files 'frontend/src/engine/*.js'` split by `__tests__` | 23 modules / 3,182 lines, plus 7 tests / 1,246 lines = 30 files / 4,428 lines |
| Engine tests | `npm test` (in `frontend/`) | 76 tests, 76 pass, 0 fail |
| e2e inventory | `ls .e2e/*.mjs \| wc -l` vs `grep -cE '^run ' .e2e/run-all-suites.sh` | 19 `.mjs`, 16 wired |
| Content volume | `python3 -c "…len(l['puzzles'])…"` and `grep -c '"expr"'` | levels `[4,12,12,12]`, **40** puzzles, 10 laws |
| Puzzle key shape | distinct key-tuples across all 40 puzzles | exactly one key set |
| Backend import direction | inverted import graph over all 28 modules | no upward edges |

### Findings: verified counts that correct earlier figures

Four counts circulated during this documentation pass were **wrong**, were caught by executing
commands rather than trusting the summary, and are corrected here. The second column is what the
earlier working figure said; the third is what the code says.

| Subject | Earlier figure | Verified figure | How it was verified |
|---|---|---|---|
| Puzzles in `content/levels.json` | 48 | **40** — Tutorial 4, Levels 1–3 have 12 each (`[4, 12, 12, 12]`) | `python3 -c "import json;print([len(l['puzzles']) for l in json.load(open('content/levels.json'))])"` → `[4, 12, 12, 12]`; `grep -c '"expr"' content/levels.json` → `40` |
| Backend Python modules | 30 | **28** (1,241 lines was correct) | `git ls-files 'backend/*.py' \| wc -l` → 28. Total tracked `backend/**` is 29, the extra being `backend/requirements.txt` |
| Engine module count | 22 | **23 non-test modules / 3,182 lines**; the widely-quoted **4,428 lines is the total including the 7 test files** (30 files) | `git ls-files 'frontend/src/engine/*.js'` split by `__tests__`. The earlier list omitted `frontend/src/engine/render.js` (46 lines) |
| `frontend/src/hooks/` | 9 hooks | **8** `.js` files | `git ls-files 'frontend/src/hooks/*'` |
| Top-level components | 8 | **10** top-level `.jsx` files (65 component files in total) | `git ls-files 'frontend/src/components/*.jsx'` |

> **The lesson, recorded deliberately.** Each of these was a plausible-looking number that nobody
> had executed. The "48 puzzles" figure in particular had already propagated into a task brief; it
> was corrected in the ground-truth file and in every document before publication. This is why
> [RULES.md §G8](../rules/RULES.md#g8-mark-what-you-could-not-verify) requires an explicit
> "unverified" marker instead of a guess.

Two counts that were checked and found **correct**: the backend's **1,241 lines** and the engine's
**4,428-line** total.

### Findings: proposal-vs-code discrepancies

The full register lives in [known-limitations.md](../07-explanation/known-limitations.md). The
findings with the highest chance of misleading a newcomer, all confirmed against the code:

1. **There is no Better Auth in this repository.** `database/init.sql`'s header claims Better Auth
   tables are created by `npx auth migrate`, and `frontend/vite.config.js` still proxies `/api/auth`
   to a "Better Auth server" on port 3001 — but no such tooling or service exists. Auth is
   **Supabase Auth**. Three dead remnants remain in tracked files.
   See [glossary.md → Better Auth](glossary.md#better-auth).
2. **There is no sandbox API endpoint.** Sandbox validation, generation and scoring are 100 %
   client-side. Any diagram or document implying a `POST /sandbox/validate` call is wrong.
3. **`POST /api/score` does persist** for a signed-in caller, via `BackgroundTasks`. The proposal
   says it does not.
4. **RLS is not per-user.** All three tables have exactly one policy, `FOR ALL USING (true)`,
   permissive to every role including `anon`, with no `auth.uid() = user_id` predicate. Per-user
   isolation is enforced by the backend's `.eq("user_id", …)` filters, not by the database.
5. **`render.yaml` declares one service**, the Python backend. The SPA is deployed separately to
   Vercel, and `frontend/vercel.json` rewrites `/api/*` to Render.
6. **Level 3 is fully playable** with 12 four-variable puzzles — not "Coming Soon".
7. **Unlock needs two conditions**, not one: every stage done **and** average ≥ 80. The proposal
   said a 70 % average alone.
8. **The engine has 76 tests**, not 46.

### Findings: things that are not enforced

Three facts about this repository's safety nets are worth recording, because assuming a net that is
not there is how a rule quietly dies:

1. **There is no CI.** `git ls-files` contains no `.github/`, no workflow file and no pipeline
   configuration. Every test in this repository is run by a human remembering to run it.
2. **The layering rules are review-enforced only.** `frontend/eslint.config.js` enables
   `js.configs.recommended`, `react-hooks` and `react-refresh` — there is no `no-restricted-imports`
   and no boundary plugin. The engine's own comment says the layering rule is "enforced by review,
   not by the bundler" (`frontend/src/engine/index.js:9`).
3. **Two content rules fail silently and have no test.** There is no check that a law id in
   `content/laws.json` matches the engine's `LAW_DEFINITIONS`, and no schema validating the six
   puzzle keys in `content/levels.json`. Both are read with `puzzle.get(key, default)`, so a typo
   produces an empty list rather than an error. These are flagged in
   [RULES.md §C3](../rules/RULES.md#c3-law-ids-are-the-join-key-between-content-engine-and-storage)
   and [§D1](../rules/RULES.md#d1-a-puzzles-keys-are-exactly-expr-goal-targetlaws-hints-optimalsteps-optimalhint)
   as the two highest-value candidates for a first test.

### Findings: security and hygiene observations

1. **The RLS policies are permissive** (finding 4 above) — documented honestly rather than
   described as per-user policies.
2. **A hardcoded e2e test-account password is committed** in `.e2e/_harness.mjs:47`. It is a
   test-only account, but it is recorded in [RULES.md §G3](../rules/RULES.md#g3-never-commit-a-secret-value)
   so it is not mistaken for an approved pattern.
3. **No secret value is reproduced anywhere in this suite.** The checker enforces this with five
   patterns; the `.env` files are gitignored and untracked, and Render's Supabase variables use
   `sync: false`.
4. **`backend/venv/` exists on disk** and contains 887 `.py` files. Counting them inflates "backend
   Python modules" from 28 to 915, which is why every size claim in this suite names its command and
   excludes it.

### Unverified claims

Recorded per [RULES.md §G8](../rules/RULES.md#g8-mark-what-you-could-not-verify). Nothing in the
`10-project/` and `rules/` slice is asserted without evidence; the following are the places where an
answer was deliberately left open rather than guessed:

- **Why `frontend/vite.config.js` proxies `/api/auth` to port 3001** cannot be established from the
  repository — no commit history in the working tree explains it. It is documented as a dead
  remnant, not as an intent.
- **The runtime of `npm test`** varies by machine (9.4 s to ~13.7 s across runs here); only the
  pass/fail counts are stated as facts.
- **Whether `frontend/package-lock.json` is intentionally committed** is not determinable from the
  repository; it is excluded from the file map because it is generated, and the exclusion is stated
  explicitly rather than silently applied.

### Remediation round: independent audit of the project-reference slice

An independent verifier audited the whole suite, including the four documents above, and reported
its findings in [verification-report.md](../verification-report.md). Four defects were assigned to
this slice and are fixed. All four had the same root cause — **a count produced by a text match
rather than by the thing being counted** — which is worth recording, because it is the same failure
mode as the "48 puzzles" slip below.

| ID | Where | What was wrong | Now |
|---|---|---|---|
| **m1** | [file-map.md §15](file-map.md) | "These three modules are imported by 22 other frontend files" — the real figure is higher | **24** files (23 excluding tests), measured with an import-shaped grep over all three config modules |
| **m2** | [file-map.md §15](file-map.md), [RULES.md §B4](../rules/RULES.md) | "22 modules import `gameRules.js`" | **21** imports (20 excluding tests). The 22nd match, `frontend/src/engine/index.js:10`, *mentions* the path in a comment and imports nothing from it — both documents now say so explicitly, since [RULES.md](../rules/RULES.md) is prescriptive and must count real imports |
| **m10** | `docs/_staging/claims-project-ref.md` row 4.9 | The ledger recorded the wrong verdict **and** the wrong method, with `grep -rln "gameRules"` (a text match) as evidence | Claim corrected to 21, evidence replaced with the import-shaped pattern, and the row now states candidly that the original method was text-matching |
| **N2** | [file-map.md §2](file-map.md) | The area table called all 19 `.mjs` files "suites", which contradicted §7's own split | "18 `.mjs` suites + 1 shared harness + 1 runner shell script + 2 JSON baselines" — `_harness.mjs` is a library, not a suite |

Two lessons for whoever maintains this suite:

1. **Count the relation, not the string.** `grep -rln "gameRules"` counts files that *mention* a
   path; only `grep -rlE "from '[^']*config/gameRules(\.js)?'"` counts files that *import* it. Three
   of the four defects above are that single distinction, and a comment in one file was enough to
   move the number.
2. **A count stated twice must agree.** N2 was not a wrong number — it was §2 disagreeing with §7 of
   the same document. Cross-check a repeated figure against its other occurrence before shipping.

---

## How to keep these docs current

Documentation rots silently. The only defence is knowing exactly which source file invalidates
which document — so a change to one file comes with a known documentation obligation.

### Change-to-document trigger table

| If you change… | Update… | Because |
|---|---|---|
| `content/laws.json` | [boolean-laws.md](../06-reference/boolean-laws.md), [glossary.md](glossary.md), [file-map.md](file-map.md) | Law ids are the join key between content, engine and scoring; a new card also changes the count. |
| `content/levels.json` | [add-a-new-problem.md](../05-guides/how-to/add-a-new-problem.md), [add-a-new-level.md](../05-guides/how-to/add-a-new-level.md), [SRS.md](../01-product/SRS.md), [file-map.md](file-map.md), this changelog | Level and puzzle counts appear in several documents, and §D3/§D4 of [RULES.md](../rules/RULES.md) pin the id scheme. |
| `frontend/src/engine/laws/definitions.js` | [boolean-laws.md](../06-reference/boolean-laws.md), [understanding-the-engine.md](../05-guides/tutorials/understanding-the-engine.md), [glossary.md](glossary.md) | The definition table is where a law's identity lives (`distributive-expand` is the trap). |
| `frontend/src/engine/**` (anything else) | [understanding-the-engine.md](../05-guides/tutorials/understanding-the-engine.md), [file-map.md](file-map.md) | Engine module list, line counts and per-module responsibilities. |
| `frontend/src/engine/__tests__/**` | [file-map.md](file-map.md), [understanding-the-engine.md](../05-guides/tutorials/understanding-the-engine.md) | The test count (76) and the file list are both documented. |
| `backend/config/constants.py` | [scoring-and-rewards.md](../06-reference/scoring-and-rewards.md), [config-reference.md](../06-reference/config-reference.md) | Every weight, penalty, threshold and rounding rule. |
| `backend/api/routes/**` or `backend/api/schemas/**` | [API-REFERENCE.md](../04-api/API-REFERENCE.md), [error-codes.md](../06-reference/error-codes.md), [file-map.md](file-map.md) | Endpoint count (7), paths, request/response field names, and the 401/404/422/503 shapes. |
| `backend/core/errors.py` or `backend/core/responses.py` | [error-codes.md](../06-reference/error-codes.md), [API-REFERENCE.md](../04-api/API-REFERENCE.md) | The seven error codes and the envelope are a public contract. |
| `backend/repositories/**` | [SCHEMA.md](../03-database/SCHEMA.md), [ERD.md](../03-database/ERD.md), [file-map.md](file-map.md) | Table names, conflict columns and the per-user filters. |
| `database/init.sql` | [SCHEMA.md](../03-database/SCHEMA.md), [ERD.md](../03-database/ERD.md), [known-limitations.md](../07-explanation/known-limitations.md) | Columns, indexes and the RLS policies — including whether they are still permissive. |
| `frontend/src/config/gameRules.js` | [config-reference.md](../06-reference/config-reference.md), [scoring-and-rewards.md](../06-reference/scoring-and-rewards.md), [glossary.md](glossary.md) | Stars, unlock gate, XP, guide cost, timings and budgets. |
| `frontend/src/config/storageKeys.js` | [config-reference.md](../06-reference/config-reference.md), [RULES.md](../rules/RULES.md) | The `praxis_*` key inventory and the "never inline a key" rule. |
| `frontend/src/App.jsx` | [SAD.md](../02-architecture/SAD.md), [DIAGRAMS.md](../09-diagrams/DIAGRAMS.md), [file-map.md](file-map.md) | The route table (9 routes) and which are gated. |
| `frontend/src/services/apiClient.js` | [SAD.md](../02-architecture/SAD.md), [RULES.md](../rules/RULES.md), [error-codes.md](../06-reference/error-codes.md) | The single HTTP entry point and the `ApiError` contract. |
| `frontend/src/engine/scoring.js` | [scoring-and-rewards.md](../06-reference/scoring-and-rewards.md), [glossary.md](glossary.md) | The client mirror must stay in lockstep with the backend; the rounding difference is documented. |
| `frontend/tailwind.config.js` or `frontend/src/styles/**` | [config-reference.md](../06-reference/config-reference.md), [SAD.md](../02-architecture/SAD.md) | Design tokens and the load-bearing stylesheet import order. |
| `render.yaml` or `frontend/vercel.json` | [deployment.md](../08-devops/deployment.md), [configuration-guide.md](../08-devops/configuration-guide.md) | Backend on Render, SPA on Vercel; the `/api` rewrite. |
| `frontend/package.json` (scripts) | [getting-started.md](../05-guides/tutorials/getting-started.md), [RULES.md](../rules/RULES.md), [file-map.md](file-map.md) | The test and build commands are cited as rules. |
| `.e2e/**` or `.e2e/run-all-suites.sh` | [RULES.md](../rules/RULES.md) §F3–F4, [file-map.md](file-map.md) | The 19-files/16-wired split and the wiring rule. |
| **Adding, moving, renaming or deleting any tracked file** | [file-map.md](file-map.md) | It claims to list **every** tracked file exactly once. |
| Adding a new concept or a new term | [glossary.md](glossary.md) | One term per concept; the glossary is the authority. |
| Adding a new project rule | [RULES.md](../rules/RULES.md) — including section H | A rule without an honest "Enforced by" line is worse than no rule. |
| Any change to this suite's scope or method | this changelog | Newest entry first, with the commit it was verified against. |

### The five-step maintenance procedure

1. **Regenerate the file inventory.** Never hand-edit [file-map.md](file-map.md)'s file list:

   ```bash
   cd /home/xris/Documents/GitHub/Praxis
   git ls-files | grep -vE 'node_modules|venv|__pycache__|package-lock' | sort
   ```

   Diff the result against the paths in the map. Add a row for anything new, delete rows for
   anything removed, and **re-verify that every listed path exists**:

   ```bash
   git ls-files | grep -vE 'node_modules|venv|__pycache__|package-lock' \
     | while read -r f; do [ -e "$f" ] || echo "MISSING: $f"; done
   ```

2. **Re-run the counts you are about to state.** Every number in this suite has a command behind it.
   Re-run the command; do not copy the number forward. The five counts that were wrong during the
   initial pass were all copied forward.

3. **Check the links.** From the repository root:

   ```bash
   node docs/_staging/tools/check-docs.mjs
   ```

   This resolves every relative link and every intra-doc anchor, scans for reproduced secrets,
   validates Mermaid fence headers, and counts `file:line` citations per document. Fix every
   `BROKEN` and `BADANCH` before you finish.

4. **Re-run the tests you cite.** `npm test` in `frontend/` must report the count the docs claim. If
   the engine test count changed, update [file-map.md](file-map.md), the
   [engine tutorial](../05-guides/tutorials/understanding-the-engine.md) and this changelog.

5. **Write an entry here.** State the date, the commit verified against, what changed, and any
   finding — especially a corrected number. A changelog entry that says "updated docs" is useless;
   one that says "the level count changed from 4 to 5, and here is the command that proves it" is
   the reason this file exists.

### How to run the checks

| Check | Command | Passes when |
|---|---|---|
| Documentation links, anchors, secrets, Mermaid | `node docs/_staging/tools/check-docs.mjs` | `RESULT: PASS` (exit 0) |
| Engine unit tests | `cd frontend && npm test` | `# fail 0` (76 tests at the time of writing) |
| Browser/end-to-end suites | `bash .e2e/run-all-suites.sh` | every suite in `.e2e/_results/*.log` reports no `FAIL` |
| File inventory | the `git ls-files` command in step 1 | the list matches [file-map.md](file-map.md) row for row |
| Frontend lint | `cd frontend && npm run lint` | no errors |

> **Remember:** the `.e2e` runner does **not** exit non-zero on a failing suite — it prints
> `exit=N` per suite and continues to `ALL DONE`. Read the per-suite logs.

---

**Related:** [file-map.md](file-map.md) for the file inventory this changelog tracks ·
[glossary.md](glossary.md) for every term used here ·
[RULES.md](../rules/RULES.md) for the rules the maintenance procedure enforces ·
[verification-report.md](../verification-report.md) for the independent audit of this suite.
