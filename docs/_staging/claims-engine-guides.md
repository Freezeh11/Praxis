# Claim ledger — `engine-guides`

Every substantive factual claim made in my five docs and the diagram staging file, with the evidence
and how it was verified. Verified against commit `3838343`.

Legend for **How verified**: `read` = read the source; `ran` = executed the engine/test suite and
recorded the real output; `grep` = exhaustive search over the tree.

---

## 1. `docs/06-reference/boolean-laws.md`

| Claim | Section | Evidence (file:line) | How verified |
|---|---|---|---|
| A law is emitted as `{ id, name, formula, desc, apply(), …animation metadata }` | §2 | `frontend/src/engine/laws/index.js:13-15` | read |
| `apply()` never mutates the input tree | §2 | `frontend/src/engine/__tests__/laws.test.js:132-138` | read |
| Identity is keyed by `name`+`form`, because `Identity Law` has two formulas | §2 | `frontend/src/engine/laws/definitions.js:56-60` | read |
| `defineLaw` throws `Unknown law: "…" (…)` on an unknown name+form pair | §2 | `frontend/src/engine/laws/definitions.js:79-84` | ran (threw for `Associative Law`/`node`) |
| `content/laws.json` has 10 cards; the engine has 16 rows → 10 distinct ids, 16 `name`+`form` keys and 15 display names (`Identity Law` is declared for `sum` and for `product`); union is 11 | §3 | `content/laws.json`; `laws/definitions.js:29-54` | ran (printed both id sets and the two set differences; counted the 16 rows and the 15 distinct display names) |
| The hint scanner emits a third non-card token, un-suffixed `demorgan`, matching neither `demorgan-and` nor `demorgan-or` | §3 note, §5.8, §5.9 | `laws/scanHints.js:38`; `state/hintText.js:39-42`; `engine/scoring.js:25-28` | ran (`LAW_NAME_TO_ID['demorgan']` → `undefined`; `lawIdOf('demorgan')` → `'demorgan'`) + measured over the 40 start expressions: `{absorption: 27, distributive: 22, demorgan: 15, idempotent: 2}` |
| Engine-only id: `distributive-expand`; card-only id: `associative` | §3 | `laws/definitions.js:44`; `content/laws.json:80-88` | ran |
| Scoring maps the recorded display name → id via `LAW_NAME_TO_ID`, with a lowercase fallback | §3 | `frontend/src/engine/scoring.js:25-28`; `definitions.js:62-65` | read |
| The reference drawer "documents laws the tool does not automate" | §3 | `docs/REFACTOR_REPORT.md:170` | read |
| Four law entry points + `scanHints`; `analyzeSelection` returns `[]` unless exactly 2 nodes are selected | §4 | `laws/index.js:33-70` | read |
| Pair laws only apply when the two paths share a sum/prod ancestor | §4 | `laws/index.js:43-55` | read |
| `options.allowExpand` is off by default and graded levels pass no options | §4 | `laws/index.js:17-19,34` | read |
| `complement` fires only on two bare literal terms | §5.1 | `laws/sumLaws.js:99-101` | ran (`x'y + xy` terms → `[]`) |
| SOP complement result keeps the `1` explicit (`y1 + z`) | §5.1 | `laws/sumLaws.js:110-118` | ran (real Tutorial 0.1 chain) |
| `termsEq` compares rendered text and is order-sensitive | §5.2 | `laws/helpers.js:21-24` | ran (`termsEq('x+y','y+x') === false`) |
| Reordered duplicates fall back to semantic absorption | §5.2 | `laws/helpers.js:94-99` | ran (`(x+y)(y+x)` → `["absorption","absorption"]`) |
| Absorption is decided by a truth table; the syntactic tests are fast accepts only | §5.3 | `laws/helpers.js:26-34, 73-78, 94-99` | read |
| The historical absorption bug lost `A'B'CD`; the property test guards it | §5.3 | `__tests__/law-soundness.property.test.js:1-13` | read |
| `AB + AA'` collapses to `AB` in one absorption step | §5.3, §12 | `laws/helpers.js:77` | ran (`getLegalTransitions` on `AB + AA'`) |
| A nested common factor is invisible to `getLits` (`(x+y)z + (x+y)w` → `[]`) | §5.3 | `laws/helpers.js:14-19` | ran |
| `identity` has two entry paths (single const + pairwise) | §5.4 | `laws/constLaws.js:19,61`; `useGameState.js:232-246`; `sumLaws.js:124-159` | read |
| `x + 0` is reachable by the solver through the pairwise law, not `analyzeSumConst` | §5.4 | `solver.js:122-157` (no `analyzeSumConst` call) vs `sumLaws.js:124-159` | ran (`getLegalTransitions('x + 0')` → `identity`, `absorption`) |
| Annulment removes only the sibling factor, so `y(1 + x)` → `y` | §5.5 | `laws/productLaws.js:200-211` | ran |
| Distributive requires a direct literal operand on both sides and refuses the bare-`1` remainder | §5.6 | `laws/sumLaws.js:40-47` | read |
| Hint scanner mirrors that bare-`1` / bare-`0` guard | §5.6 | `laws/scanHints.js:117-122, 66-72` | read |
| `double-neg` needs a `not` whose child is a `not` | §5.7 | `laws/notLaws.js:22-28` | read |
| The parser folds `(x')'` to the literal `x`, so only a negated group keeps the `not` node | §5.7 | `parser.js:117-124` | ran (`(x')'` → `lit`; `((x+y)')'` → `not`) |
| The sandbox builds a real double-negation puzzle from `((x + y)')'` | §5.7 | `sandbox/input.js:109-206` | ran (`expr (x + y)''`, goal `x + y`, 1 step) |
| De Morgan complements every operand, any arity | §5.8, §5.9 | `laws/notLaws.js:44, 58-60, 74, 88-90` | read |
| `associative` has no engine builder, no hint, no `LAW_DEFINITIONS` row | §5.10 | exhaustive grep: only `content/laws.json:81`, `docs/REFACTOR_REPORT.md:170`, the proposal | grep + ran (`defineLaw` throws) |
| Regrouping is structural: `normalizeFlat` splices nested sums/products at parse time | §5.10 | `normalize.js:47-68`; `parser.js:75` | ran (`x + (y + z)` and `(x + y) + z` → identical text/canon) |
| Drag-reorder records no step | §5.10 | `state/useGameState.js:522-558` | read |
| `distributive-expand` is complement-guarded and refuses the general expansion | §6 | `laws/helpers.js:144-150` | read |
| `allowExpand` is set only by `sandbox/input.js` | §6 | `sandbox/input.js:51,153,166,197`; consumed `usePuzzleSession.js:84`, `useGameState.js:14` | grep |
| Same expression/selection is empty in graded mode and offers the law in the sandbox | §6 | `laws/productLaws.js:215-221`; `laws/index.js:34` | ran |
| `distributive-expand` has empty `animPaths` and no animation branch | §6 | `laws/productLaws.js:28-34`; `components/animations/index.js:6-8,30-33` | read |
| A typed `x(y + z)` is refused as `already-simplest` | §6 | `sandbox/input.js:157-159` | ran |
| 4 levels with `[4,12,12,12]` puzzles = 40 | §7 | `content/levels.json` | ran (counted) |
| All 40 puzzles: solver finds the goal, 0 step-count mismatches vs authored `optimalSteps` | §7 | `solver.js:175` | ran (aggregate scan) |
| Law usage counts on the shortest paths (23/24/23/22/5/5/2/2, five laws at 0) | §7 | `solver.js:175` | ran |
| `double-neg` is unreachable in all 40 puzzles and absent from the curated pool | §7 | `sandbox/pool.js:11-40`; `sandbox/generator.js:73-75` (SOP/POS rules only) | ran (state-graph scan) + read |
| Module/line map (23 non-test modules / 3,182 lines; 7 test files / 1,246) | §8 | `frontend/src/engine/**` | ran (`wc -l`) |
| `lawAnimationMs = 1350` (not 2.5 s) | §9 | `config/gameRules.js` `TIMING`; `useGameState.js:447` | read |
| Client `Math.round` vs Python `round` can differ by one bonus point | §9 | `engine/scoring.js:80` vs `backend/services/scoring_service.py:55` | ran (JS: total 90 → 5, total 50 → 3; Python: 4 and 2) |

## 2. `docs/05-guides/tutorials/understanding-the-engine.md`

| Claim | Section | Evidence (file:line) | How verified |
|---|---|---|---|
| The engine has no React/DOM/network; only non-relative import is `config/gameRules.js` | §2 | `engine/index.js:8-11`; `solver.js:1`, `sandbox/input.js:36-37`, `sandbox/generator.js:11`, `scoring.js:14-18` | grep (no react/document/window/fetch/localStorage under `engine/`) |
| 23 non-test modules / 3,182 lines; 7 test files / 1,246 lines; 30 files / 4,428 lines | §2, §16 | `frontend/src/engine/**` | ran (`wc -l`) |
| `parseExpr` calls `normalizeFlat` internally, so "parser → normalizer" is not a chain | §3, §7 | `parser.js:72-76,160-166`; `normalize.js:47` | read |
| The token streams for `A(B + A')` (both scanners) | §4 | `parser.js:18-56`; `sandbox/validate.js:100-117` | ran (private `tokenize` observed via a byte-identical copy loaded from a data: URL — no repo file modified) |
| The parser's tokenizer silently skips unknown characters | §4 | `parser.js:11,51-53` | read |
| The AST for `A(B + A')` with real `_id`s; ids follow construction order | §5 | real `JSON.stringify(parseExpr(...))` output | ran |
| `n` marks a complemented literal; `A'` is a `lit`, not a `not` | §5 | `node.js:19`; `parser.js:119-120` | ran + read |
| `_id` is a per-process monotonic counter | §5 | `node.js:15-17` | read |
| `nodeText` is order-sensitive, `canonText` sorts literals and terms | §6 | `render.js:12-25, 28-46` | ran (`A(B + A')` vs `A(A'+B)`) |
| `normalizeFlat` flattens only; `normalize` also drops 0/1 and collapses double negation | §7 | `normalize.js:14-45, 47-68` | ran (`A + 0` preserved; `normalize` → `A`) |
| `normalize` is called **only** by law `apply()` bodies | §7 | `notLaws.js:39,69,99`; `constLaws.js:53,95`; `sumLaws.js:138,156,201,228,253`; `productLaws.js:144,165,184` | grep (exhaustive) |
| `validateExpr` judges characters/parens/operators and returns a verdict object | §8 | `validate.js:6-8,16-77` | read |
| `validateExpr` is called by the generator (`sandbox/generator.js:84`), not by the sandbox screen | §8 | grep for `validateExpr` callers | grep |
| `validateSandboxInput` is called by `SandboxPage.jsx:122,124` and `sandbox/input.js:113` | §8 | grep for `validateSandboxInput` callers | grep |
| The sandbox screen validates twice (debounced for feedback, raw for the button) and debounces 300 ms | §8 | `pages/SandboxPage.jsx:116-126`; `config/gameRules.js` `TIMING.sandboxValidationDebounceMs` | read |
| Completion is canonical-text equality; the goal is canonicalised once | §8, §12, §13 | `useGameState.js:437, 83-84` | read |
| Dead-end detection is an empty `scanHints` | §8, §13 | `useGameState.js:61, 504, 562` | read |
| `isEquivalent` is **not** on the per-step path; its only consumers are listed | §8 | `laws/helpers.js:77,98`; `sandbox/generator.js:94`; `sandbox/input.js:161` | grep |
| Soundness is guaranteed by the law implementations + the property test | §8 | `law-soundness.property.test.js:1-13,218-230` | read |
| `isEquivalent` is a truth table over the union of variables | §9 | `equivalence.js:11-57` | ran (truth table for `A(B + A')`) |
| The selection `A`+`A'` shares the root product, so only POS laws are considered | §10 | `laws/index.js:43-55`; `tree.js:66-82` | ran (`findCommonProd` result + `analyzeSelection`) |
| `A(B + A')` has **no** legal move in graded mode; one in the sandbox | §10 | `laws/productLaws.js:215-221` | ran (laws + hints + transitions, both gates) |
| `law.apply()` is pure and the panel uses `data-law-id` | §11 | `laws/productLaws.js:38-47`; `LawPanel.jsx:164-176` | ran + read |
| The step is recorded after `TIMING.lawAnimationMs`; tutorial pre-highlight is 1500 ms | §11 | `useGameState.js:423-425,447,450-455` | read |
| The full derivation: expand → `AB + AA'` (3 moves) → `AB` (absorption) or `AB + 0` → `AB` | §12 | observed `getLegalTransitions` output at each state | ran |
| `findSimplestForm`/`findOptimalPath` both report the 2-step path to `AB` | §12 | `solver.js:175,258` | ran |
| Terminal = zero legal transitions | §13 | `solver.js:282-285` | ran |
| A semantically correct terminal form can fail the win check: Tutorial 0.3 `x + x'y` | §13 | `useGameState.js:437`; `hintText.js:10` | ran (`canon` differs, `isEquivalent` true, hints `[]`, transitions `[]`) |
| Local estimate can be one bonus point off the server's authoritative value | §14 | `engine/scoring.js:80` vs `backend/services/scoring_service.py:55`; overwrite at `usePuzzleSession.js:208-213` | ran both sides |
| `npm test` = 76 tests, 76 pass, 0 fail | §16 | `frontend/package.json`; `npm test` | ran (76/76, 11292.96 ms) |
| `node --test src/engine/__tests__/laws.test.js` = 10/10 | §16 | — | ran (10/10) |
| Module table line counts | §16 | `frontend/src/engine/**` | ran (`wc -l`) |

## 3. `docs/05-guides/tutorials/first-contribution.md`

| Claim | Section | Evidence (file:line) | How verified |
|---|---|---|---|
| The six stops are the files that must change for a pair law | §2, §3 | the existing 10 laws' wiring: `definitions.js`, `sumLaws.js`, `productLaws.js`, `scanHints.js`, `useGameState.js:589`, `law-soundness.property.test.js:112` | ran a full dry run on a temp copy |
| `content/laws.json` is the content source and the id is the join key | §3 | `content/gameContent.js:5-6,14-15`; `vite.config.js` `@content` alias | read |
| `content_repository` caches with `functools.lru_cache` (restart needed) | §3 | `backend/services/content_repository.py`; GROUND-TRUTH §7 | read |
| `sumLaws.js` needs no new imports for such a law | §3 | `sumLaws.js:13-19` | read |
| `productLaws.js` needs no new imports either | §3 | `productLaws.js:11-17` | read |
| A shape-only predicate is sound but useless (`x + xy = x + xy`) and the runtime guard says "That law didn't change the expression." | §3, §4 | `useGameState.js:366-373`; `solver.js:49-50` | ran (dry run: the law was offered with an unchanged description) |
| Skipping the property-test `TERM_LEVEL_HINTS` entry fails with 5,400 sandbox + 1,247 graded unreachable-hint violations | §4 | `law-soundness.property.test.js:112,255-261` | ran (dry run: `not ok 3`, `not ok 4`, `# pass 3 / # fail 2`) |
| Adding the dual law makes `x(x' + y)` a 1-step problem and breaks `solver.test.js:42-63` | §4 | `solver.test.js:42-63` | ran (real deep-equal diff captured) |
| After re-baselining, the suite is 81 tests / 81 pass / 0 fail (76 + 5 new) | §3, §4 | `frontend/package.json` | ran (final dry run) |
| The new law changes 4/40 shortest paths, 0/40 step counts, and lowers target-law coverage on 3/40 | §5 | `content/levels.json`; `solver.js:175` | ran (before/after diff) |
| 29/40 puzzles already cannot cover all `targetLaws` on the shortest path | §5 | `content/levels.json` | ran |
| `LAW_MODE.TERM` vs `LITERAL` decides the click gesture | §1, §3 | `laws/definitions.js:18-21`; `useGameState.js:589` | read |

## 4. `docs/05-guides/how-to/add-a-new-law.md`

| Claim | Section | Evidence (file:line) | How verified |
|---|---|---|---|
| Four builder modules; a pair law needs no `laws/index.js` change | §1 | `laws/index.js:33-58` | read |
| A new single-node shape needs an `analyzeX`, a barrel export, a UI call site and a `getLegalTransitions` branch | §1, §5 | `laws/index.js:60-70`; `engine/index.js:41-54`; `useGameState.js:171-179,232-246`; `solver.js:70-76,83-86` | read |
| Ungated productive laws made the solver ~20× slower (why gating exists) | §1 | `laws/helpers.js:144-150` | read |
| Six identity fields and the name+form uniqueness rule | §2 | `laws/definitions.js:29-60` | read |
| The general-form proof requirement (with the unsound syntactic regression as precedent) | §3 | `laws/helpers.js:26-34`; `law-soundness.property.test.js:1-13` | read |
| `apply()` purity, no-op drop, normalize choice, insertion order | §4 | `laws.test.js:132-138`; `useGameState.js:366-373`; `solver.js:49-50`; `sumLaws.js:3-9` | read |
| Solver enumeration table (`x + 0`, `x + 1`, `x · 1`, `x · 0`, `x + x'`, `(x + y)'`) | §5 | `solver.js:37-162`; `sumLaws.js:99-185`; `constLaws.js` | ran (printed every transition) |
| The sum branch has no `analyzeSumConst` call while the product branch calls `analyzeProductConst` | §5 | `solver.js:83-86` vs `:122-157` | read |
| Hint rules must mirror the builder's guard (existing comments say so) | §6 | `scanHints.js:66-72,117-122` | read |
| The Guide/property-test list rule is keyed on the *hint's paths*; `distributive` is absent because its hint paths are literals | §6 | `scanHints.js:64-65`; `useGameState.js:589`; `law-soundness.property.test.js:112` | read |
| Five test kinds, incl. the negative near-miss test | §7 | house style at `laws.test.js:1-27` | ran (dry run) |
| Animation registry: an unmapped id resolves to `null` and an empty `animPaths` is legal | §8 | `components/animations/index.js:6-8,30-33`; `productLaws.js:28-34` | read |
| Gotcha list (12 rows) | §10 | each row cites the code above; rows 1–3 measured in the dry run | ran + read |

## 5. `docs/05-guides/how-to/debug-a-failing-step.md`

| Claim | Section | Evidence (file:line) | How verified |
|---|---|---|---|
| The full 16-hop chain for one click, with the network hops marked | §1 | the file:line column of the table | read |
| A step never reaches the server; only level load and score do | §1 | `useGameState.js:354-459`; `usePuzzleSession.js:111,200-213` | read + grep (no fetch under `engine/`) |
| `GET /api/levels/:id` only happens for an unbundled id | §1, §6 | `services/contentApi.js:36-45` | read |
| The sandbox never submits a score | §1, §6 | `usePuzzleSession.js:185-188` | read |
| `POST /api/score` failure is silent by design | §1, §6 | `services/scoreApi.js:34` | read |
| The selection shapes the UI builds (literal / term / not / const) | §2 | `useGameState.js:199-348` | read |
| The reproduction script's outputs are real | §2 | the script itself | ran |
| Log locations: browser console warns, backend JSON stdout, Network, localStorage, tests | §3 | `useGameState.js:112`; `usePuzzleSession.js:61,122`; `sandboxPuzzle.js:37`; `core/logging.py:34-50` | read |
| The backend cannot boot without `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` | §3 | `backend/config/settings.py:30-38,75` | read (the runtime message text is quoted from that code) |
| The exact JSON log-line shape | §3 | `core/logging.py:34-50`; `core/middleware.py:47-57` | ran (the project's own `JsonFormatter` produced the quoted line) |
| Every response carries `X-Request-ID`, echoed if supplied | §3, §4 | `core/middleware.py:27,61` | read |
| The frontend never reads `X-Request-ID` | §4 | grep over `frontend/src` (no match) | grep |
| The Vite proxy targets and the dead `/api/auth` → :3001 remnant | §4, §8 | `frontend/vite.config.js` | read |
| Two string gates with distinct callers | §5 | grep + `SandboxPage.jsx:116-126` | grep + read |
| Sandbox debounce is 300 ms | §5 | `config/gameRules.js` `TIMING`; `SandboxPage.jsx:117-120` | read |
| 20 decision-tree rows | §6 | each row cites code; rows 6, 7, 13, 17 verified independently | ran + read |
| No-op guard message text | §6 | `useGameState.js:371` | read |
| Dead-end message text | §6 | `state/hintText.js:10` | ran (printed) |
| The 422 envelope names the missing field in `error.detail[].loc` | §6 | `backend/main.py:60-66`; GROUND-TRUTH §2 | read |

## 6. `docs/_staging/diagram-input-engine-guides.md`

| Claim | Section | Evidence | How verified |
|---|---|---|---|
| Component graph nodes/edges | §1 | `file:line` per node/edge in the table | read |
| No server in the step diagram; the only two API calls | §1, §2 | `usePuzzleSession.js:111,200-213` | read + grep |
| Sequence diagram steps 1–18 | §2 | `file:line` per step | read |
| Sandbox input flow, incl. the two gates and the 300 ms debounce | §3 | `SandboxPage.jsx:116-126,171`; `sandbox/input.js:113,127-149,161,180-182` | read |
| AST diagram node shapes | §4 | real `parseExpr("A(B + A')")` JSON | ran |
| Verification snippet's expected output | §4 | — | ran |

---

## 7. Corrections and new findings for the Lead

### GROUND-TRUTH.md corrections I independently confirmed

| Where | Issue | Verified truth |
|---|---|---|
| §3 / D10 | "4 levels, 12 stages each = **48** puzzles" | **40** puzzles: `content/levels.json` counts are `[4,12,12,12]` (Lead already corrected this) |
| §4 | "22 modules" + "the frontend engine is 4,428 lines" | **23 non-test modules / 3,182 lines**; the 4,428 total includes 7 test files / 1,246 lines. `render.js` (46 lines) was omitted from the module list (Lead already corrected this) |
| §4 | "76 tests … ~9.4 s" | 76/76 confirmed; measured **11,292.96 ms** on this machine — timing variance, not a discrepancy |
| §3 | "the engine also knows an internal law id `distributive-expand`" | Confirmed, and the mismatch is **two-way**: `distributive-expand` is engine-only **and** `associative` is card-only; the union is 11 ids, each set has 10 |

### New findings, not in GROUND-TRUTH.md

1. **29 of the 40 authored puzzles cannot cover all their `targetLaws` on the solver's shortest
   path.** Measured with `findOptimalPath` over `(expr, goal)` for every puzzle. Example: Tutorial
   stage 0.1 declares `["distributive","complement","identity"]` but the shortest derivation is
   `Distributive (Factor) → Absorption Law (Product)`, which credits only `distributive`. The solver
   is correct; the *authored* `targetLaws` and the *optimal* route disagree. This is a scoring-product
   observation, not an engine bug — flagged for whoever owns scoring/known-limitations.
2. **`double-neg` is unreachable in the entire authored game.** A full reachable-state scan of all 40
   puzzles never offers it, and the curated sandbox pool has no double negation
   (`sandbox/pool.js:11-40`); the generator only expands `absorb`/`dual-absorb`/`complement-split`/
   `dual-complement` shapes (`sandbox/expand.js:73-75`). Only learner-typed sandbox input exercises
   the law.
3. **`associative` is card-only (already implied by `docs/REFACTOR_REPORT.md:170`, now proven):** no
   `LAW_DEFINITIONS` row, no hint, no builder; `defineLaw('Associative Law', …)` throws. Regrouping is
   free at parse time (`normalize.js:47-68`) and via drag-reorder (`useGameState.js:522-558`), so no
   step can ever carry the id and no puzzle should target it.
4. **A semantically correct terminal form can fail the win check.** Real example on Tutorial stage 0.3
   (`x + x'y + xy → x + y`): one legal absorption step reaches the terminal `x + x'y`, which is
   `isEquivalent` to the goal but not `canonText`-equal, so the UI reports a dead end
   (`useGameState.js:437,61-67`). The Lead flagged this class of issue; this is a concrete,
   reproducible instance with real content.
5. **Adding one law re-baselines more than the law.** Measured in a temp-copy dry run: a single new
   pair law turned one existing solver expectation stale (shortest path changed from 2 steps to 1),
   changed 4/40 shortest paths, and lowered target-law coverage on 3/40 puzzles. Anyone adding a law
   must run the 40-puzzle before/after script — the recipe is in `first-contribution.md` §5.
6. **The sum branch of `getLegalTransitions` has no `analyzeSumConst` call** (`solver.js:122-157`),
   while the product branch does call `analyzeProductConst` (`solver.js:83-86`). Constants inside sums
   are still reachable because `sumLaws.js:124-159,162-185` handle them as term-level pairs. Not a bug,
   but a trap when adding a single-constant law.

### Explicitly unverified

- **`scanHints` two-path results vs the Guide's `TERM_LEVEL_HINTS` list.** Nothing in the engine
  asserts that the two agree; the property test hard-codes one list and the Guide hard-codes the
  other. I verified the *current* pair is consistent for the existing laws (the property test passes),
  but there is no mechanical guarantee. Marked `⚠️ Unverified` in `boolean-laws.md` §4 in the sense
  that no guard exists — the behaviour itself is verified.
- **`backend/services/content_repository.py` line numbers.** I cited the `lru_cache` behaviour from
  GROUND-TRUTH §7 and the module docstring, not from a fresh line-by-line read; the file was not part
  of my scope. The claim ("restart the backend after editing content") is solid; the exact line is not
  cited in my docs.
- **Live HTTP behaviour.** I did not start the backend (no network calls were made in this session
  beyond `localhost`-free local execution). Every endpoint claim in my docs is quoted from
  GROUND-TRUTH §2 or from the route/middleware source, and is labelled as such; the log-line shape was
  produced by running the project's own formatter, not by capturing a live request.
