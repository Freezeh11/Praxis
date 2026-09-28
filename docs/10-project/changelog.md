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

- [2026-09-28: Structure-preserving normalization — the Module 4 absorption guard](#2026-09-28-structure-preserving-normalization--the-module-4-absorption-guard)
  - [What changed in the code (not made by this pass)](#what-changed-in-the-code-not-made-by-this-pass)
  - [Content re-baseline, re-derived here](#content-re-baseline-re-derived-here)
  - [Findings: claims that were false in the working tree](#findings-claims-that-were-false-in-the-working-tree)
  - [Documents corrected by this pass](#documents-corrected-by-this-pass)
  - [Open questions for the team (curriculum, not documentation errors)](#open-questions-for-the-team-curriculum-not-documentation-errors)
  - [Historical records measured but left as written](#historical-records-measured-but-left-as-written)
  - [Verification run for this entry](#verification-run-for-this-entry)
- [2026-09-28: Citation re-measurement — repairing the drift the optimum change left in `file:line` claims](#2026-09-28-citation-re-measurement--repairing-the-drift-the-optimum-change-left-in-fileline-claims)
  - [Method: measure, do not shift](#method-measure-do-not-shift)
  - [Counts refreshed, with the command that produced each](#counts-refreshed-with-the-command-that-produced-each)
  - [Citations checked, corrected and deliberately left](#citations-checked-corrected-and-deliberately-left)
  - [Found but not fixed, and the residual imprecision](#found-but-not-fixed-and-the-residual-imprecision)
  - [Documents touched by this pass](#documents-touched-by-this-pass)
- [2026-09-28: Post-verification change — the objective-aware scoring optimum](#2026-09-28-post-verification-change--the-objective-aware-scoring-optimum)
  - [What the code change was (not made by this pass)](#what-the-code-change-was-not-made-by-this-pass)
  - [Findings: what the audit missed, and the corrected numbers](#findings-what-the-audit-missed-and-the-corrected-numbers)
  - [Documents updated by this pass](#documents-updated-by-this-pass)
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

## 2026-09-28: Structure-preserving normalization — the Module 4 absorption guard

**Verified against** `7678087` plus the uncommitted working tree, which carries **two** engine passes:
the objective-aware scoring optimum (the entry further below) and this one —
`frontend/src/engine/laws/helpers.js`, `content/levels.json`,
`frontend/src/config/gameRules.js` and `frontend/src/engine/__tests__/solver.test.js`. **Docs only** —
no file under `content/`, `backend/` or `frontend/` was touched by this pass, and nothing was committed
or pushed.

**What happened.** The proposal's **Module 4** requires *structure-preserving normalization*: "All law
applications that produce a constant factor within a product or sum use structure-preserving
normalization so that intermediate expressions are rendered as distinct, clickable states", and "The
student must explicitly click and apply each subsequent law to advance through every intermediate
state" — its worked example is `y(x + x')` → `y · 1` (Complement) → `y` (Identity)
(`Software Proposal Writing Guide (LAWS) v2.0.docx.md`, Module 4, around line 125). The engine violated
that in exactly one place: the **semantic fallback** of absorption was allowed to swallow a
tautological or contradictory clause, so `y(x + x')` collapsed straight to `y`, skipping the required
`y · 1` state. The fix guards the fallback **only**.

### What changed in the code (not made by this pass)

| File | Change |
|---|---|
| `frontend/src/engine/laws/helpers.js:82` | `absorbsInSum` now returns `false` when the clause to be absorbed is equivalent to the constant `0` |
| `frontend/src/engine/laws/helpers.js:112` | `absorbsInProduct` now returns `false` when the clause to be absorbed is equivalent to the constant `1` |
| syntactic fast-accept paths (same file) | **deliberately untouched** — textbook absorption is unchanged: `x + xy → x`, `x(x + y) → x` and `y(y + x') → y` are still one step each |
| `content/levels.json` | 7 `optimalSteps` re-baselined, 4 `targetLaws` re-authored, 2 `optimalHint` strings rewritten |
| `frontend/src/config/gameRules.js:204` | `SOLVER_BUDGET.graded.maxDepth` `10 → 16`; `maxStates` stays `3000` (measured: never reached — all 40 puzzles solve in well under a second) |
| `frontend/src/engine/__tests__/solver.test.js` | new Module 4 test (`:116-144`) plus rewritten `findOptimalPathWithLaws` expectations; suite `80 → 81` tests |

Re-measured here, against the working tree (not copied from the change request):

```text
transitions(y(x + x')) = 1   Complement Law           y(x + x')  ->  y1
transitions(y1)        = 1   Identity Law             y1         ->  y
transitions(x + y·y')  = 1   Complement Law (Product) x + yy'    ->  x + 0
transitions(y(y + x')) = 1   Absorption Law (Product) y(y + x')  ->  y
```

So `y(x + x') → y` takes **2 steps** (Complement, then Identity); `x + y·y'` offers only
`Complement Law (Product) → x + 0`; and `y(y + x') → y` is still **1 step**. All 40 authored puzzles
still score exactly **100** on their objective route, and `solvability + optimalSteps` agree with
`content/levels.json` on 40/40.

### Content re-baseline, re-derived here

"Before" is the state the previous documentation pass was written against; `git diff` against `HEAD`
shows two passes' worth of movement for some rows, which is noted underneath the table.

| Stage | `optimalSteps` (docs' baseline) → now | `targetLaws` change |
|---|---|---|
| `2:2`, `2:3` | 3 → **4** | `["absorption"]` → `["distributive","complement","identity"]` |
| `2:6`, `2:7` | 5 → **7** | `["distributive","complement","absorption"]` → `["distributive","complement","identity"]` |
| `2:10` | 7 → **11** | unchanged |
| `3:10` | 10 → **14** | unchanged |
| `3:11` | 10 → **13** | unchanged |

Against `HEAD` the same files read `2:2`/`2:3` 3, `2:6`/`2:7` 3, `2:10` 4, `3:10`/`3:11` 7 — the
earlier values include the previous pass's own re-baseline. `2:2` and `2:3` also had their
`optimalHint` rewritten, because the old strings described the absorption route that now dead-ends.
The authored optimum now spans **1–14 steps**.

### Findings: claims that were false in the working tree

| Claim (where) | Was | Now |
|---|---|---|
| W9's whole worked example — "taught 3-step route = 100, 2-step shortcut = 80" (`scoring-and-rewards.md`) | the shortcut `Distributive (Factor) → Absorption Law (Product)` existed and scored 80 | the shortcut is **not offered**; plain shortest path = objective optimum = 3 steps = 100. Rewritten as "the taught route is now the only route", with Tutorial stage 2's still-legal 1-step shortcut (70 vs 100) added so the objective-aware rule is still demonstrated |
| W6's `optimalSteps: 10` and "every band floored at zero" from `stepsUsed: 15` (`scoring-and-rewards.md`) | `optimalSteps: 10`; 5 steps over | `optimalSteps: 14`; the input moved to `stepsUsed: 19` so the example still floors every band (at 15 it is now only one step over) |
| "absorption is decided semantically… it collapses the expression in one step to `AB`" (`boolean-laws.md` §5.3) | `AB + AA'` offered `absorption` | `Absorption Law` is gone there; the state offers `Distributive (Factor)` and `Complement Law (Product)` only. §5.3 now states the shape rule, the guard and the untouched textbook forms |
| "authored `optimalSteps` equals the *plain* shortest path: 15 / 40"; "the two differ on 25 of the 40" (`boolean-laws.md` §7) | 15 / 40 and 25 / 40 | **29 / 40** and **11 / 40**; the law-usage tables and the reproduce transcript were regenerated |
| "`identity`, `idempotent` and `annulment` are never on any shortest path" (`boolean-laws.md` §7) | true before the guard | `identity` (24) and `complement` (18/16) are back on shortest paths; only `idempotent`, `annulment` and `double-neg` are absent |
| "plain shortest path: 2 steps, law ids: distributive, absorption" for the guide's own example (`add-a-new-problem.md` §7.3) | 2 steps | **3 steps, distributive, complement, identity** |
| "the engine's law set is *coarser* than the textbook — `Absorption Law (Product)` does the work of `complement` followed by `identity`" (`add-a-new-problem.md` §7.5) | true via the bypass | false: the engine now renders the constant. Rewritten around the four-stage `targetLaws` trap |
| "29 of the 40 shipped stages are flagged" by the naive shortest-path test (`add-a-new-problem.md` §7.5, `first-contribution.md` §5) | 29 / 40 | **13 / 40** |
| Tutorial §12 walked **two** routes to `AB`, the 2-step one via `Absorption Law`, and `findSimplestForm` returned `optimalSteps: 2` (`understanding-the-engine.md`) | two routes | one route, **3 steps** (`Distributive (Expand) → Complement Law (Product) → Identity Law`); the mermaid state diagram, the move lists and the solver transcript were regenerated |
| "a 2-step solve can score 80 while a 3-step solve scores 100" (`known-limitations.md` §10) | Tutorial stage 1 | Tutorial stage 2 — 1-step solve = 70, taught 2-step route = 100 |
| `SOLVER_BUDGET.graded.maxDepth` = `10` (`config-reference.md`, `add-a-new-problem.md` §7.3, `add-a-new-level.md` §7) | 10 | **16**; the 5-variable case in `add-a-new-level.md` §7 also moved: its optimum is now **17 steps** and the raised probe needs `maxDepth: 20` (`16/40000` now returns `found: false`) |
| helper citations `helpers.js:77`, `:98`, `:94`, `:127` (`SRS.md`, `SDD.md`, `SAD.md`, `why-this-architecture.md`, `design-decisions.md`, `DIAGRAMS.md`) | pre-guard lines | `:82`/`:112` (the decisions and their guards), `:100`, `:142` |
| the `allowExpand` transcript in `add-a-new-problem.md` §8 (`x(x' + y)` reaching `xy` in 2 steps via `Absorption Law`) | 2 steps | **3 steps** (`Distributive (Expand) → Complement Law (Product) → Identity Law`); the conclusion — `distributive-expand` is a sandbox-only convenience, never a graded route — is unchanged |
| `first-contribution.md` §4 Failure 2 cited `solver.test.js:44-65` as asserting `Distributive (Expand)` then `Absorption Law` | that expectation | the current test (`:44-69`) expects `Expand → Complement → Identity`; the transcript stays as the dry run it was, now labelled as such |
| test counts and engine sizes everywhere (**80** tests; 3,288 / 1,328 / 4,616 lines; `helpers.js` 152) | 80 / those sizes | **81** tests; **3,303 / 1,361 / 4,664** lines; `helpers.js` **167** |
| `API-REFERENCE.md` Level 1 stage 11 `optimalSteps` | `5` | **`4`** — a pre-existing error (the value was already 4 and this pass did not change it); caught by validating all 18 stage-table rows against `content/levels.json` |

### Documents corrected by this pass

The ten documents this change was required to correct, plus the sweep it forced:

1. [`scoring-and-rewards.md`](../06-reference/scoring-and-rewards.md) — W9 rewritten, W6 re-baselined, efficiency/optimum prose, reproduce block, test-count citation.
2. [`boolean-laws.md`](../06-reference/boolean-laws.md) — §5.3 shape rule + guard, §7 numbers and transcripts, §8 line table, D11.
3. [`understanding-the-engine.md`](../05-guides/tutorials/understanding-the-engine.md) — §12 walkthrough and mermaid, §15 script, §16 sizes/transcript, `isEquivalent` consumers.
4. [`add-a-new-problem.md`](../05-guides/how-to/add-a-new-problem.md) — §5 authoring advice, §7.3/§7.5/§7.6 outputs, budget block, §9 arithmetic, §11 troubleshooting.
5. [`RULES.md`](../rules/RULES.md) — §D5 now requires every declared `targetLaw` to be appliable on a goal route, with the four-stage trap as the worked example.
6. [`config-reference.md`](../06-reference/config-reference.md) — `SOLVER_BUDGET.graded.maxDepth` 10 → 16.
7. [`DIAGRAMS.md`](../09-diagrams/DIAGRAMS.md) — engine-figure citations, the absorption note, the scoring note and the W9 anchor.
8. [`known-limitations.md`](../07-explanation/known-limitations.md) — §10 row corrected and a new prose block recording the Module 4 deviation; D0–D27 numbering untouched (no new D-row).
9. [`changelog.md`](changelog.md) — this entry.
10. Sweep: [`API-REFERENCE.md`](../04-api/API-REFERENCE.md), [`first-contribution.md`](../05-guides/tutorials/first-contribution.md), [`getting-started.md`](../05-guides/tutorials/getting-started.md), [`add-a-new-level.md`](../05-guides/how-to/add-a-new-level.md), [`add-a-new-law.md`](../05-guides/how-to/add-a-new-law.md), [`debug-a-failing-step.md`](../05-guides/how-to/debug-a-failing-step.md), [`SRS.md`](../01-product/SRS.md), [`PRD.md`](../01-product/PRD.md), [`SAD.md`](../02-architecture/SAD.md), [`SDD.md`](../02-architecture/SDD.md), [`installation-manual.md`](../08-devops/installation-manual.md), [`file-map.md`](file-map.md), [`why-this-architecture.md`](../07-explanation/why-this-architecture.md), [`design-decisions.md`](../07-explanation/design-decisions.md).

### Open questions for the team (curriculum, not documentation errors)

1. **Module 1's "distinct primary Boolean law" per stage is mostly unenforced.** Module 1 says each
   stage requires "a distinct primary Boolean law, ensuring that students cannot pass a level by
   mastering only one law". Measured over `content/levels.json`: only **5 of 40** stages declare
   exactly one `targetLaw` — `0:0`, `1:0`, `1:1`, `3:0`, `3:1`; **13** declare two and **22** declare
   three, so 35 of 40 stages have no single primary law. (The change request for this pass said "7 of
   40"; the measurement is 5. Reproduce with
   `node -e "const L=require('./content/levels.json');const c={};for(const lv of L)for(const p of lv.puzzles)c[p.targetLaws.length]=(c[p.targetLaws.length]||0)+1;console.log(c)"`.)
   Scoring also cannot distinguish a primary law from the others: the target-law band is a flat
   `30 × |matched| / |declared|` with no weighting. Whether to re-author the curriculum or soften the
   Module 1 claim is a product decision, not a documentation fix.
2. **"All levels have all Boolean laws available for use" is not true of `Distributive (Expand)`.**
   The law exists in the engine but is gated to the Sandbox/random generator behind
   `options.allowExpand` (`frontend/src/engine/laws/helpers.js:134-141`,
   `frontend/src/engine/laws/index.js:33-34`), has no reference card in `content/laws.json`, and is
   explicitly **not** a valid `targetLaw` (`boolean-laws.md` §6). Graded play therefore offers ten
   laws where the proposal implies eleven. Also a curriculum decision; recorded, not changed.
3. **The objective-aware optimum is still load-bearing after the guard.** The guard removed the one
   shortcut that motivated `findOptimalPathWithLaws` on Tutorial stage 1, but 11 of the 40 puzzles
   still have a plain shortest path that skips a declared law (`0:2`, `1:2`, `1:3`, `1:4`, `1:5`,
   `1:10`, `2:4`, `2:5`, `3:4`, `3:5`, `3:8`), so the mechanism is not vestigial.
4. **The `.e2e` fingerprint baselines are stale and were not regenerated (outside this pass's write
   scope).** Both `.e2e/baselines/engine-default-pre-expand.json` and
   `engine-default-post-expand.json` disagree with the current engine/content on **27 of 40**
   puzzles' `optimalSteps` and on every recorded state graph — they predate even the objective-aware
   re-baseline (e.g. `0:1` is recorded as 2, now 3).

### Historical records measured but left as written

Per the suite's rules these are frozen inputs, so the stale figures found in them are reported here
instead of edited:

| Record | Stale figure |
|---|---|
| [`verification-report.md`](../verification-report.md):294 | `laws/helpers.js:77`, `:98` (now `:82`, `:112`) |
| [`verification-report.md`](../verification-report.md):461, :494 | "76 tests" — correct for the commit it audited |
| [`context.md`](../context.md):54 | "46 unit tests" — already register **D11** |
| `docs/_staging/claims-content-authoring.md`:60 | "Its optimal derivation is 2 steps: `Distributive (POS)` then `Absorption Law`" |
| `docs/_staging/claims-content-authoring.md`:64 | "The engine offers both `absorption → y + z` and `complement → y1 + z` from `y(x' + x) + z`" |
| dated entries in this changelog (lines 88–91, 208, 241–242, 553) | 80 tests; 3,288 / 1,328 / 4,616 lines; the pre-guard `solver.test.js:129-168` citation |
| `docs/_staging/tools/.mermaid-check/RECREATE.md` | its "Frozen artifact" table records `DIAGRAMS.md` at **995 lines / 12 fences** and sha256 `422ec86a…`; the file is now longer, so both the hash and the line count are stale (the frozen record itself stays as written) |
| `docs/REFACTOR-NOTES.md` | does not exist in the tracked tree (the source audit's file list names it; `git ls-files` has no such path) |

Nothing stale was found in `ARCHITECTURE.md`, `REFACTOR_REPORT.md` or `SKILLS.md`.

### Verification run for this entry

```text
$ node docs/_staging/tools/check-docs.mjs
  checked 1705 relative links, 803 with anchors
  mermaid fences found: 55
  BLOCKER 0  MAJOR 0  MINOR 0  NIT 0
  RESULT: PASS

$ node docs/_staging/tools/.mermaid-check/validate-mermaid.mjs docs/09-diagrams/DIAGRAMS.md
  Mermaid fences found: 12
  PASS #1..#12  (all 12 fences parse)
  ALL 12 MERMAID FENCES PARSE OK        # exit 0
  # the tree was rebuilt first, exactly as RECREATE.md documents
  # (`npm install mermaid jsdom --cache ./.npm-cache`), then removed again

$ node docs/_staging/tools/.mermaid-check/validate-mermaid.mjs docs/05-guides/tutorials/understanding-the-engine.md
  Mermaid fences found: 3
  PASS #1 (line 107) flowchart TD, #2 (line 211) graph TD, #3 (line 543) stateDiagram-v2
  ALL 3 MERMAID FENCES PARSE OK         # exit 0 — the edited state diagram included

$ cd frontend && npm test
  # tests 81 / # pass 81 / # fail 0  (duration_ms ~12600)
```

Every number in the corrected documents came from a command run against this working tree:
`findOptimalPath` / `findOptimalPathWithLaws` / `getLegalTransitions` over all 40 puzzles,
`estimateScore` for the W9 arithmetic, the real `backend/services/scoring_service.py` for W6's
rewritten input, and the guide's own `verify-puzzle.mjs` (40 → `failures=0`; 41 with the scratch
stage → `failures=0`).

---

## 2026-09-28: Citation re-measurement — repairing the drift the optimum change left in `file:line` claims

**Verified against** the same working tree as the entry below: on top of `7678087`, with the
uncommitted engine change (`frontend/src/engine/solver.js`, `frontend/src/engine/index.js`,
`frontend/src/state/useGameState.js`, `frontend/src/engine/__tests__/solver.test.js`,
`content/levels.json`). **Docs only** — no file under `content/`, `backend/` or `frontend/` was
touched, and nothing was committed.

**What happened.** The entry below recorded the correct *new* counts and flagged the stale ones, but
left the mechanical repair to a follow-up. This is that follow-up: every `file:line` citation into the
four changed files was re-measured against the current tree, and every stale engine size / test count
found by searching the suite (not only the spots that entry listed) was refreshed.

### Method: measure, do not shift

The suite was written against `3838343`; `7678087` and `b3c0825` landed afterwards, so some citations
were **already stale before** the optimum change. Nothing was shifted arithmetically. For each
citation the procedure was:

1. read the current file and confirm the cited line holds what the doc claims;
2. if it does not, locate the claimed construct by **content**, not by offset, using a
   `difflib.SequenceMatcher` opcode map between the audited version of the file and the working tree
   (line identity is exact text equality, so a match is a measurement);
3. accept a new number only when the doc's own wording names the construct that the matched line
   contains — otherwise leave the citation and report it.

A scanner extracted every `path/file.ext:N`, implicit `:N` continuation, and `path#LNN` anchor from
`docs/**.md` and reported, per citation, whether the target resolves, the line is in range, and the
line is not blank. Totals (all docs, including historical records):

| | before | after |
|---|---|---|
| citations extracted | 5,760 | 5,760 |
| unresolved target file | 240 | 240 |
| cited line out of range | 88 | 88 |
| single-line citation on a blank line | 106 | 84 |
| range endpoint on a blank line | 96 | 81 |
| same, excluding historical records | 42 / 42 blank | 20 / 27 blank |

The historical records were measured and then left as written, as required.

### Counts refreshed, with the command that produced each

| Figure | Old | New | Command |
|---|---|---|---|
| Engine non-test modules / lines | 23 / **3,182** | 23 / **3,288** | `git ls-files 'frontend/src/engine/*.js' \| grep -v __tests__ \| xargs wc -l` |
| Engine test files / lines | 7 / **1,246** | 7 / **1,328** | `git ls-files 'frontend/src/engine/__tests__/*.js' \| xargs wc -l` |
| Engine files / lines incl. tests | 30 / **4,428** | 30 / **4,616** | `git ls-files 'frontend/src/engine/*.js' \| xargs wc -l` |
| Engine tests | **76** | **80**, 80 pass, 0 fail | `cd frontend && npm test` → `# tests 80 / # pass 80 / # fail 0` |
| `frontend/src/engine/solver.js` | **323** | **429** | `wc -l frontend/src/engine/solver.js` |
| `frontend/src/state/useGameState.js` | **620** | **664** | `wc -l frontend/src/state/useGameState.js` |
| `frontend/src/engine/__tests__/solver.test.js` | **86** | **168** | `wc -l frontend/src/engine/__tests__/solver.test.js` |

Only `solver.js` and `solver.test.js` changed size inside `engine/`, so the other per-module and
per-test-file rows were re-checked and left alone. 35 replacements carry these figures across
[DIAGRAMS.md](../09-diagrams/DIAGRAMS.md), [file-map.md](file-map.md),
[SDD.md](../02-architecture/SDD.md), [SAD.md](../02-architecture/SAD.md),
[understanding-the-engine.md](../05-guides/tutorials/understanding-the-engine.md),
[PRD.md](../01-product/PRD.md), [SRS.md](../01-product/SRS.md),
[installation-manual.md](../08-devops/installation-manual.md),
[design-decisions.md](../07-explanation/design-decisions.md),
[why-this-architecture.md](../07-explanation/why-this-architecture.md),
[known-limitations.md](../07-explanation/known-limitations.md),
[getting-started.md](../05-guides/tutorials/getting-started.md),
[first-contribution.md](../05-guides/tutorials/first-contribution.md),
[add-a-new-law.md](../05-guides/how-to/add-a-new-law.md) and
[debug-a-failing-step.md](../05-guides/how-to/debug-a-failing-step.md). Two `npm test` transcripts were
re-pasted from a real run rather than edited in place.

### Citations checked, corrected and deliberately left

The four changed files are cited **316 times** in 20 editable documents — 65 citations into
`solver.js`, 31 into `engine/index.js`, 210 into `useGameState.js` and 10 into `solver.test.js`. The
counts include implicit `:N` continuations and one `#LNN` anchor per linked citation.

- **200 citations corrected** — their cited line no longer held what the doc claimed, or was blank, or
  was out of range. Most were `useGameState.js` numbers written against `3838343`, which the optimum
  change moved by +1 (lines 77–86), +18 (the scoring block) or +44 (everything after `loadPuzzle`).
- **116 left unchanged**, each verified rather than skipped. The interesting group is citations the
  entry below had *already* re-based on the new code — `findOptimalPathWithLaws` at `solver.js:271`,
  the `loadPuzzle` wiring at `useGameState.js:87-113` / `:101-105` / `:107-117`, the function-start
  lists in [DIAGRAMS.md](../09-diagrams/DIAGRAMS.md) and
  [understanding-the-engine.md](../05-guides/tutorials/understanding-the-engine.md), and
  `solver.js:176` / `:180-182` / `:184-185` / `:217` / `:237-241` / `:274`. A content map would have
  "corrected" all of those to the wrong place: `:271` would have become `:377`, an unrelated line
  inside `findOptimalPath`, and `:176` would have become `:177`. They are the reason the pass
  re-measured instead of shifting.
- Also corrected: [SDD.md](../02-architecture/SDD.md)'s `useGameState` public-API list (ten implicit
  `:N` references plus the returned-object range, now `:77`, `:240`, `:314`, `:351`, `:398`, `:505`,
  `:531`, `:545`, `:567`, `:604`, `:649-663`), and the import range in
  [DIAGRAMS.md](../09-diagrams/DIAGRAMS.md) (`useGameState.js:2-6` → `:2-7`, the engine import block
  gained the new symbol).
- [file-map.md](file-map.md) §13.3's `solver.js` row now lists `findOptimalPathWithLaws` among the key
  exports, describes it as the graded scoring optimum, and carries the re-measured 429 lines.

### Found but not fixed, and the residual imprecision

1. **Two stale file sizes on a line this pass already edited.**
   [known-limitations.md](../07-explanation/known-limitations.md) §D17's "largest files" row now reads
   `useGameState.js` 664 correctly, but also names `pages/ProblemPage.jsx` **521** (actual **541**) and
   `pages/LevelSelectPage.jsx` **440** (actual **475**). Neither file is in this change's scope, so
   they were reported rather than edited: `wc -l frontend/src/pages/ProblemPage.jsx frontend/src/pages/LevelSelectPage.jsx`.
2. **130 citations name a `.js` file that only exists as `.jsx`**, across 21 documents — `LoginPage.js`,
   `LevelSelectPage.js`, `TutorialGate.js`, `StageSelectorPage.js`, `ProblemPage.js`, `SandboxPage.js`,
   `RegisterPage.js`, `LandingPage.js`, `ScoreModal.js`, `AuthProvider.js`, `App.js`, `main.js`,
   `LawPanel.js`, `StepHistoryPanel.js`, `ProtectedRoute.js`, and `content/levels.js` (the tracked file
   is `content/levels.json`). This predates the engine change and is out of scope; the line numbers are
   generally right, the extension is not.
3. **The `optimalHint` strings in `content/levels.json`** recorded in the entry below (five shipped
   counts still name a pre-fix step count) are still unfixed — `content/` is out of scope for a
   documentation pass.
4. **The entry below quotes `solver.js:271-346` and `:341-346`.** `findOptimalPathWithLaws` spans
   `271-347` and its final `found: false` return is `342-346`; line 341 of that file is blank. The
   dated entry is a historical record and was left as written.
5. **One dry-run figure is baseline-bound.** [add-a-new-law.md](../05-guides/how-to/add-a-new-law.md)
   §7's "81 tests / 81 pass in a verified dry run" was measured against the 76-test suite; with today's
   80-test suite the same five-test file would give 85. The sentence now says so instead of inventing a
   new measured total.
6. **Range endpoints that land on a blank line**, left because they bracket the claimed construct:
   `solver.js:389-399` ([understanding-the-engine.md](../05-guides/tutorials/understanding-the-engine.md))
   and `useGameState.js:165-215` ([DIAGRAMS.md](../09-diagrams/DIAGRAMS.md)).
7. **A duration nobody re-measured.** [SRS.md](../01-product/SRS.md) NFR-4 quotes
   `# duration_ms ~9100`; this pass measured 12,820 ms on the same machine. Timing varies by machine, so
   the approximate figure was left.

### Documents touched by this pass

| Document | What changed |
|---|---|
| `docs/01-product/PRD.md`, `SRS.md` | 17 and 32 citation corrections; NFR-4/F-counters to 80; the §8 traceability matrix's test count |
| `docs/02-architecture/SAD.md`, `SDD.md` | engine size, test count, `solver.test.js` 86 → 168, and the `useGameState` public-API line list |
| `docs/05-guides/how-to/*` | `add-a-new-law.md` (solver ranges), `add-a-new-level.md`, `add-a-new-problem.md`, `debug-a-failing-step.md` citation corrections |
| `docs/05-guides/tutorials/*` | `understanding-the-engine.md` (module map, §13/§14 citations, D11), `first-contribution.md`, `getting-started.md` |
| `docs/06-reference/*`, `docs/07-explanation/*` | `boolean-laws.md`, `scoring-and-rewards.md`, `known-limitations.md`, `design-decisions.md`, `why-this-architecture.md` |
| `docs/08-devops/installation-manual.md` | the `npm test` transcript and its prose count |
| `docs/09-diagrams/DIAGRAMS.md`, `docs/10-project/file-map.md`, `docs/10-project/glossary.md`, `docs/rules/RULES.md` | citation corrections, the engine map's size line, the `solver.js` row |
| this file | this entry; the entry below is unchanged |

**Gate.** `node docs/_staging/tools/check-docs.mjs` → `RESULT: PASS`, 0 blocker / 0 major / 0 minor /
0 nit, 1,671 relative links and 794 anchors checked.

---

## 2026-09-28: Post-verification change — the objective-aware scoring optimum

**Verified against** the working tree on top of `7678087`, whose uncommitted diff is
`frontend/src/engine/solver.js`, `frontend/src/engine/index.js`, `frontend/src/state/useGameState.js`,
`frontend/src/engine/__tests__/solver.test.js` and `content/levels.json`. **Nothing was committed by
this pass**; it updates documents that the initial suite had verified against `3838343` *before* the
fix below existed.

**What happened.** The suite was written, audited and independently verified against the tree in which
the efficiency bar was the **raw shortest path** to the goal (`findOptimalPath`) while the target-law
band demanded the laws in `targetLaws`. A post-verification code change replaced that bar for graded
puzzles with the **objective-aware optimum**: the fewest steps in which the goal is reached *and* every
law in `targetLaws` is applied.

### What the code change was (not made by this pass)

| File | Change |
|---|---|
| `frontend/src/engine/solver.js` | new `findOptimalPathWithLaws(startExpr, targetCanon, requiredLawIds, options)` (`:271-346`): BFS over states of (canonical form, laws used), returning the shortest derivation that reaches the goal and applies every required law. Falls back to `findOptimalPath` when the list is empty (`:274`); returns `found: false` when no route satisfies the objective (`:341-346`) |
| `frontend/src/engine/index.js` | exports it from the engine barrel (`:57`) |
| `frontend/src/state/useGameState.js` | `loadPuzzle` scores graded puzzles against it, falling back to the plain optimum when it is not found (`:87-117`) |
| `content/levels.json` | `optimalSteps` re-authored for exactly **25 of the 40** puzzles — e.g. Tutorial stage 1 (`x'y + z + xy`): 2 → 3; Level 1 stage 2: 3 → 4; Level 3 stage 10: 7 → 10. `targetLaws` unchanged; still 4 levels / 40 puzzles |
| `frontend/src/engine/__tests__/solver.test.js` | +4 tests (`:90-168`). The suite is now **80 tests, 80 pass** (was 76) |

### Findings: what the audit missed, and the corrected numbers

1. **The audit's solver check could not have caught this.** [verification-report.md](../verification-report.md)
   §3.3 recorded "solver step count differs from authored `optimalSteps` → 0 / 0", measured over the
   same solver's shortest paths — and commit `3838343` had just re-baselined every authored figure to
   that same solver, so the check was self-confirming. The scoring-relevant question — *does the route
   the score is measured against apply every target law?* — was never asked.
2. **The symptom was documented without being recognised.**
   [boolean-laws.md](../06-reference/boolean-laws.md) §7 and
   [first-contribution.md](../05-guides/tutorials/first-contribution.md) §5 both reported that
   **29 / 40** puzzles could not cover all their `targetLaws` on the shortest path, and treated it as
   a property of the shortcuts rather than as the reason a perfect score was impossible.
3. **Corrected numbers, measured exhaustively with the real estimator** (every reachable
   `(goal, law-set)` state of every puzzle, scored by `estimateScore` against the pre-fix optimum):
   - a perfect `100` was unreachable on **25 of 40** puzzles;
   - the route that followed the puzzle's own teaching scored **90 on 19 puzzles, 80 on 2, 70 on 4**
     — one, two and three steps over the pre-fix bar;
   - the best total reachable by *any* route, including routes that trade part of the target-law band
     for a shorter derivation, was **90 on 21 puzzles and 80 on 4**.
4. **Now fixed, and guarded.** Following the objective-aware route scores exactly `100`
   (40 + 30 + 30) on all 40 puzzles, verified by running the scorer over each one.
   `frontend/src/engine/__tests__/solver.test.js:129-168` asserts that every authored puzzle has a
   reachable objective route *and* that its authored `optimalSteps` matches the computed optimum — so
   stale content now fails the suite instead of silently capping the learner at 90.
5. **Found but not fixed — `content/` is out of scope for a documentation pass.** Five shipped
   `optimalHint` strings still name a pre-fix step count: `L2S0` ("giving xz in 3 steps", now 4),
   `L2S1` ("leaving x + z in 3 steps", now 4), `L2S10` ("isolating z in 4 steps", now 7), `L3S2`
   ("giving wxz in 4 steps", now 5) and `L3S3` ("leaving w + x + z in 4 steps", now 5). A sixth,
   `L3S4` ("merged in 1 step by Idempotent"), probably refers to the merge alone and may be fine.
   No test covers `optimalHint` text; a follow-up content edit is needed.
6. **Found but not fixed — a count refresh is a separate, mechanical pass across 12 documents.**
   The same change grew the engine from **3,182 to 3,288 non-test lines** (23 modules), from
   **4,428 to 4,616 lines** including tests, and from **1,246 to 1,328 test lines** (7 files), and
   `solver.js` from **323 to 429 lines**; the suite went from 76 to **80** tests and
   `useGameState.js` from 620 to 664 lines. The stale figures are:
   - `3,182` / `4,428` / `1,246`: [file-map.md](file-map.md) `:99,:101,:103,:105-106,:356`;
     [SDD.md](../02-architecture/SDD.md) `:34-35,:360,:455`; [SAD.md](../02-architecture/SAD.md)
     `:46-47,:241`; [understanding-the-engine.md](../05-guides/tutorials/understanding-the-engine.md)
     `:79,:707`; [design-decisions.md](../07-explanation/design-decisions.md) `:688`;
     [DIAGRAMS.md](../09-diagrams/DIAGRAMS.md) `:251`.
   - `76` tests: [PRD.md](../01-product/PRD.md) `:309,:394`; [file-map.md](file-map.md) `:117,:421`;
     [SDD.md](../02-architecture/SDD.md) `:467`; [SAD.md](../02-architecture/SAD.md) `:344`;
     [understanding-the-engine.md](../05-guides/tutorials/understanding-the-engine.md) `:765`;
     [installation-manual.md](../08-devops/installation-manual.md) `:768,:778`
     (`:768` is a pasted `npm test` transcript that now reads `# tests 76`);
     [why-this-architecture.md](../07-explanation/why-this-architecture.md) `:123`;
     [design-decisions.md](../07-explanation/design-decisions.md) `:67,:687`;
     [add-a-new-law.md](../05-guides/how-to/add-a-new-law.md) `:202`;
     [debug-a-failing-step.md](../05-guides/how-to/debug-a-failing-step.md) `:235`.
   - per-module rows: `solver.js` at `323` lines ([file-map.md](file-map.md) `:397`, whose export
     list also still omits `findOptimalPathWithLaws`) and `useGameState.js` at `620`
     ([SDD.md](../02-architecture/SDD.md) `:475`).
   Re-run the maintenance procedure's step 2 for each. Historical records
   (`verification-report.md`, `REFACTOR-NOTES.md`, the `2026-09-28` entry below, `context.md`) were
   deliberately left as written; the four documents this pass *did* touch for the test count
   ([SRS.md](../01-product/SRS.md) NFR-4, [RULES.md](../rules/RULES.md) F1,
   [known-limitations.md](../07-explanation/known-limitations.md) D11,
   [boolean-laws.md](../06-reference/boolean-laws.md) D11) now say 80, which is why the list above
   names the documents that still disagree.

### Documents updated by this pass

| Document | What changed |
|---|---|
| [scoring-and-rewards.md](../06-reference/scoring-and-rewards.md) | The optimum's definition and provenance; the deliberate "full efficiency, partial target-law credit" consequence; a new worked example **W9**; W2/W3/W5/W6 re-run against the current content (W5's input gained one hint so it still demonstrates the `50.0` rounding divergence) |
| [boolean-laws.md](../06-reference/boolean-laws.md) | §7 re-measured on the scoring route (was the shortest path); the Tutorial 0.1 consequence rewritten; three authored `optimalSteps` figures; D11 |
| [add-a-new-problem.md](../05-guides/how-to/add-a-new-problem.md) | §2, §3 (barrel export), §5 (example puzzle `optimalSteps` 2 → 3), §7.3 (recipe now uses `findOptimalPathWithLaws`, with real output), §7.5 (rewritten as scoring-route coverage + earnability), §7.6 verifier, §9 worked example, §10/§11 |
| [first-contribution.md](../05-guides/tutorials/first-contribution.md) | §5 measurement script and table re-based on the scoring optimum; the obsolete `29 / 40` row reframed |
| [known-limitations.md](../07-explanation/known-limitations.md) | D11; a §10 row for the objective-aware optimum plus the "defect this replaced, now fixed" note |
| [DIAGRAMS.md](../09-diagrams/DIAGRAMS.md) | D10 prose + notes; the engine map's `solver.js` node |
| [RULES.md](../rules/RULES.md) | D5 (rule, why, evidence, enforcement) and F1's test count |
| [understanding-the-engine.md](../05-guides/tutorials/understanding-the-engine.md) | §6 engine map node, §12 solver semantics, §13/§14 citations, the scoring-flow step |
| [getting-started.md](../05-guides/tutorials/getting-started.md) | Step 6's tutorial table |
| [API-REFERENCE.md](../04-api/API-REFERENCE.md) | §3.5 resolution note, §4.3 field meaning, §7's two per-stage tables and the Level 2 summary row |
| [SRS.md](../01-product/SRS.md) | NFR-4's test count |
| [PRD.md](../01-product/PRD.md) | The goal statement's "shortest correct path" reworded to "the shortest route that applies the intended laws", with a pointer to W9 — the ambiguity was the bug's premise |
| this file | this entry |

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
| `content/levels.json` | [add-a-new-problem.md](../05-guides/how-to/add-a-new-problem.md), [add-a-new-level.md](../05-guides/how-to/add-a-new-level.md), [SRS.md](../01-product/SRS.md), [file-map.md](file-map.md), [RULES.md](../rules/RULES.md) §D5, this changelog | Level and puzzle counts appear in several documents, and §D3–§D5 of [RULES.md](../rules/RULES.md) pin the id scheme, the optimum and the target-law reachability rule. |
| `frontend/src/engine/laws/definitions.js` | [boolean-laws.md](../06-reference/boolean-laws.md), [understanding-the-engine.md](../05-guides/tutorials/understanding-the-engine.md), [glossary.md](glossary.md) | The definition table is where a law's identity lives (`distributive-expand` is the trap). |
| `frontend/src/engine/**` (anything else) | [understanding-the-engine.md](../05-guides/tutorials/understanding-the-engine.md), [file-map.md](file-map.md) | Engine module list, line counts and per-module responsibilities. |
| `frontend/src/engine/__tests__/**` | [file-map.md](file-map.md), [understanding-the-engine.md](../05-guides/tutorials/understanding-the-engine.md) | The test count (**81**, as of the newest entry) and the file list are both documented. |
| `frontend/src/engine/laws/helpers.js` (the absorption shape rules) | [boolean-laws.md](../06-reference/boolean-laws.md), [understanding-the-engine.md](../05-guides/tutorials/understanding-the-engine.md), [known-limitations.md](../07-explanation/known-limitations.md), [scoring-and-rewards.md](../06-reference/scoring-and-rewards.md) | The absorption decision, the Module 4 constant guard, which routes are reachable, and therefore which `targetLaws`/`optimalSteps` values are still true. |
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
| Engine unit tests | `cd frontend && npm test` | `# fail 0` (80 tests as of the newest entry; 76 when the suite was first written) |
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
