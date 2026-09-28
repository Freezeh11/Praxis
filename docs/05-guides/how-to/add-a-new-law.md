# How to add a new law

**What this is.** The task-focused checklist for adding one Boolean law to the engine: choose the
right module, get the identity right, guard soundness, wire the hint scanner, and prove it.

**Who it's for.** Someone who already knows the engine shape and wants the short version. For the
narrated, evidence-heavy version with a full worked example, read
[first-contribution.md](../tutorials/first-contribution.md) instead — this document is its checklist.

## Contents

1. [Step 0 — pick the shape, then the module](#1-step-0--pick-the-shape-then-the-module)
2. [Step 1 — the six fields of a law identity](#2-step-1--the-six-fields-of-a-law-identity)
3. [Step 2 — prove the law before you code it](#3-step-2--prove-the-law-before-you-code-it)
4. [Step 3 — wire the builders](#4-step-3--wire-the-builders)
5. [Step 4 — make it reachable by the solver](#5-step-4--make-it-reachable-by-the-solver)
6. [Step 5 — hints, Guide and hint copy](#6-step-5--hints-guide-and-hint-copy)
7. [Step 6 — tests that actually protect the law](#7-step-6--tests-that-actually-protect-the-law)
8. [Step 7 — content, animation, docs](#8-step-7--content-animation-docs)
9. [Verification matrix](#9-verification-matrix)
10. [Gotchas, ranked by how much time they cost](#10-gotchas-ranked-by-how-much-time-they-cost)

---

## 1. Step 0 — pick the shape, then the module

The engine has four builder modules and there is exactly one right answer for a given selection
shape.

| Your law fires on… | Module | Add it as | Existing precedent |
|---|---|---|---|
| two nodes inside the same **sum** | `frontend/src/engine/laws/sumLaws.js:32` | a numbered block before `return laws` | the six SOP laws (`sumLaws.js:38-256`) |
| two nodes inside the same **product** | `frontend/src/engine/laws/productLaws.js:63` | same | five POS laws + gated expand (`productLaws.js:69-221`) |
| one `not` node | `frontend/src/engine/laws/notLaws.js:21` | a new branch on `child.type` | `double-neg`, `demorgan-and`, `demorgan-or` |
| one `const` node | `frontend/src/engine/laws/constLaws.js:19,61` | a new branch on `constVal` — **and** a pairwise branch in the sum/product module if the solver must find it (see §5) | `identity`, `annulment` |
| a whole expression (not a local rewrite) | — | do **not** add a law; the engine's model is local rewrites | reordering is `useGameState.swapTerms`, not a law |

**Do you need a new entry point?** A pair law needs **no change** to
`frontend/src/engine/laws/index.js` — `analyzeSelection` already routes both sum and product
selections (`laws/index.js:43-57`). A new **single-node** shape does: add an `analyzeX` to
`laws/index.js`, export it from the barrel (`frontend/src/engine/index.js:41-54`), call it from the
UI (`useGameState.js:171-179` for `not`, `:232-246` for constants) **and** from
`getLegalTransitions` (`solver.js:70-76`, `:83-86`), or the solver will never use it.

**Gate it if it makes expressions bigger.** A productive rewrite (like expansion) must sit behind
`options.allowExpand` and a narrow guard; the unguarded general case made the solver ~20× slower
(`laws/helpers.js:144-150`). Non-simplifying laws also have to survive `findSimplestForm`, which
defines "simplest" as "no transitions left" (`solver.js:282-285`).

## 2. Step 1 — the six fields of a law identity

| Field | Where | Rule |
|---|---|---|
| `id` | `content/laws.json` + every `LAW_DEFINITIONS` row | **identical string in both**; it is the join key to `targetLaws` and to scoring |
| `name` | `LAW_DEFINITIONS` | unique per `form`; this is what `LAW_NAME_TO_ID` keys on (`definitions.js:62-65`) |
| `formula` | `LAW_DEFINITIONS` | the text the law panel quotes; keep it consistent with the card's `formulas[]` |
| `mode` | `LAW_DEFINITIONS` | `LAW_MODE.LITERAL` (click the literals) or `LAW_MODE.TERM` (click the terms) |
| `form` | `LAW_DEFINITIONS` | `LAW_FORM.SUM`, `PRODUCT` or `NODE`; it selects which module owns the law |
| `formulas[]` + `desc` | `content/laws.json` | one card per id, both duals listed |

**Both duals, or an explicit reason.** `complement`, `idempotent`, `absorption`, `identity`,
`annulment` and `distributive` each have a sum row *and* a product row; the three `NODE` laws are
self-dual. A missing dual does not error — the law simply never appears on that side of the
expression.

**Idempotent add:** re-running your content edit must not duplicate the card.

## 3. Step 2 — prove the law before you code it

Write the algebra down first, in its **general** form, not the textbook instance:

```text
good:  A + A'X = A + X        for ANY X
bad:   A + A'B = A + B        (only says what happens when X is a literal)
```

The predicate you write admits shapes you did not imagine, and the property test
(`frontend/src/engine/__tests__/law-soundness.property.test.js`) will generate them. A general proof is
also what tells you whether the fast path is safe: `absorbsInSum`/`absorbsInProduct` exist in the shape
they do because a syntactic literal-subset test was *unsound* — the regression is described at
`frontend/src/engine/laws/helpers.js:26-34` and at the top of the property test.

If you cannot prove it, the correct move is to **use `isEquivalent` as the decision** (a truth table
over ≤ 64 rows) instead of inventing a predicate:

```js
// frontend/src/engine/laws/helpers.js:73-78
export function absorbsInSum(survivor, absorbed) {
  if (!survivor || !absorbed) return false
  if (survivor.type === 'lit' && termContainsLit(absorbed, survivor.v, survivor.n)) return true
  if (isLitProduct(survivor) && litsContained(survivor, absorbed)) return true
  return isEquivalent(prod(cloneN(survivor), cloneN(absorbed)), absorbed)
}
```

## 4. Step 3 — wire the builders

Copy the shape of the nearest existing law — the object literal, not a class:

```js
laws.push({
  ...defineLaw('<Display Name>', LAW_FORM.SUM),   // id + name + formula from the table
  desc: `…`,                                      // the sentence under the formula
  animPaths: [`${cs.sumPath}.${cs.ti1}`, `${cs.sumPath}.${cs.ti2}`],
  // …animation metadata the overlay reads
  apply: () => {                                  // pure: clone, edit, return
    const tree = cloneN(expr)
    const sn = getNode(tree, cs.sumPath)
    // …edit sn
    return normalize(tree)                        // or normalizeFlat for flat-only clean-up
  },
})
```

Four non-negotiables:

1. **`apply()` never mutates its input.** `cloneN(expr)` first. Asserted by `laws.test.js:132-138`.
2. **`apply()` must return a different text.** `useGameState.js:366-373` and `getLegalTransitions`
   (`solver.js:49-50`) both drop no-op steps, so a law that can return an equal tree shows a button
   that does nothing.
3. **Choose `normalize` vs `normalizeFlat` deliberately.** `normalize` also drops `0`/`1` and collapses
   double negation — correct when the law has just made those removable; `normalizeFlat` preserves
   them, which is what you want when the learner should see the constant (`productLaws.js:14,99` uses
   `normalizeFlat` after factoring).
4. **Insertion point = panel order.** The returned array order is the law panel order and the hint
   preference (`sumLaws.js:3-9`).

## 5. Step 4 — make it reachable by the solver

`getLegalTransitions` (`frontend/src/engine/solver.js:37-162`) is what the Hint/Guide solver and the
optimal-path BFS enumerate. A law that the panel can offer but the solver cannot enumerate will never
appear in `findOptimalPath` — and `useGameState.loadPuzzle` prefers the solver's answer over the
authored `optimalSteps` (`useGameState.js:86-99`; `engine/scoring.js:39-42`), so the mismatch is
visible.

Verified coverage of the current enumeration:

| Expression | Transitions found | Via |
|---|---|---|
| `x + 0` | `identity -> x`, `absorption -> x` | term-level pair in `sumLaws.js:124-159` |
| `x + 1` | `annulment -> 1`, `absorption -> 1` | term-level pair in `sumLaws.js:162-185` |
| `x · 1` | `absorption -> x`, `identity -> x` | `analyzeProductConst` (`solver.js:83-86`) **and** the dual pair |
| `x · 0` | `absorption -> 0`, `annulment -> 0` | same two paths |
| `x + x'` | `complement -> 1` | literal-level pair in `sumLaws.js:99-121` |
| `(x + y)'` | `demorgan-or`, `double-neg` (when applicable) | `analyzeNot` (`solver.js:70-75`) |

Note the asymmetry: the product branch of `getLegalTransitions` calls `analyzeProductConst`
explicitly (`solver.js:83-86`), the sum branch has **no** `analyzeSumConst` call — constants in sums
are reached through the pairwise term-level laws instead. If your law is single-node-only, add it to
`getLegalTransitions` too.

**Verify reachability:**

```bash
cd frontend && node --input-type=module -e "
import { parseExpr } from './src/engine/parser.js'
import { getLegalTransitions } from './src/engine/solver.js'
console.log(getLegalTransitions(parseExpr(\"x + 0\")).map(t => [t.lawId, t.to]))
"
```

## 6. Step 5 — hints, Guide and hint copy

Three surfaces, and they must agree:

| Surface | File | What to add |
|---|---|---|
| hint rule | `laws/scanHints.js` (sum branch ~`:87-130`, product branch ~`:42-85`) | `add('<law id>', [p1, p2])` **inside the same predicate the builder uses** |
| Guide pre-selection | `state/useGameState.js:589` | add the id to the `isTermSel` list when the hint paths are whole terms |
| property-test mirror | `engine/__tests__/law-soundness.property.test.js:112` | the same id, same list (`TERM_LEVEL_HINTS`) |
| hint sentence | `state/hintText.js:36-73` | a `case` for your id (the `default` branch is a working fallback) |

Measured cost of skipping the property-test mirror: **5,400 unreachable-hint violations** in the
sandbox scan and **1,247** in the graded scan, i.e. two failing property tests. The full failure text
is quoted in [first-contribution.md §4](../tutorials/first-contribution.md#4-what-actually-happens-three-real-failures).

**The rule behind the two lists.** They are keyed by the *hint's paths*, not by the law: a hint that
carries two whole terms needs `isTermSel: true`; a hint that carries two literals needs `false`.
`distributive` is absent from `TERM_LEVEL_HINTS` for exactly that reason (`scanHints.js:64-65` builds
literal paths).

## 7. Step 6 — tests that actually protect the law

Add a file under `frontend/src/engine/__tests__/` with five kinds of test:

1. **the positive case**, both duals (`A + A'B -> A + B`, `A(A' + B) -> AB`);
2. **selection order independence** (reverse the two paths);
3. **the near-miss negative**: the law must **not** fire without its semantic condition
   (`x + xy` has no complement);
4. **a "no extra transitions" assertion** where the law could plausibly over-fire
   (`getLegalTransitions(parseExpr('x + xy')).length === 1`);
5. **a hint assertion** (`scanHints(...)` reports your id).

Run exactly:

```bash
cd frontend
node --test src/engine/__tests__/<your-file>.test.js   # fast loop
npm test                                                # the gate: node --test src/engine/__tests__/*.test.js
```

The existing suite is **76 tests / 76 pass**; yours add to that count. A correct five-test file plus
the six wiring stops produced **81 tests / 81 pass / 0 fail** in a verified dry run.

## 8. Step 7 — content, animation, docs

- **`content/laws.json`** — the reference card. Remember the backend's `lru_cache` (restart the dev
  backend) and the build-time `@content` import (`frontend/src/content/gameContent.js:14-15`).
- **`components/animations/index.js:19-33`** — map your law id to an animation component. An unmapped
  id is legal and resolves to `null`, so only the empty container renders
  (`animations/index.js:6-8,30-33`). If you ship no animation, keep `animPaths: []` and say why, as
  `distributive-expand` does (`productLaws.js:28-34`).
- **`docs/06-reference/boolean-laws.md`** — add the law to the card table and to the law-by-law
  sections, or record why it is not a reference card (the `distributive-expand` precedent).
- **`content/levels.json`** — only if a puzzle should *target* the law. `targetLaws` entries are law
  **ids**, and a puzzle that names a law no step can produce silently loses the 30-point band.

## 9. Verification matrix

| What you want to know | Command |
|---|---|
| the law is offered, with the right id/name/formula | `analyzeSelection` script (see below) |
| `apply()` produces the expected text | same script, `nodeText(law.apply())` |
| `apply()` does not mutate | assert `nodeText(tree)` before/after (`laws.test.js:132-138` pattern) |
| hints agree with the builder | `scanHints(expr, 'R')` vs `getLegalTransitions(expr)` |
| the solver can use it | `getLegalTransitions(expr).map(t => t.lawId)` |
| it never changes the function | `npm test` (the property test does this automatically for every law) |
| the Guide can pre-select it | `useGameState.activateGuide` list + `TERM_LEVEL_HINTS` |
| the whole suite is green | `npm test` |
| existing puzzles did not silently regress | the 40-puzzle before/after script in [first-contribution.md §5](../tutorials/first-contribution.md#5-measure-the-impact-on-the-existing-40-puzzles) |

```bash
cd frontend && node --input-type=module -e "
import { parseExpr } from './src/engine/parser.js'
import { nodeText } from './src/engine/render.js'
import { analyzeSelection, scanHints } from './src/engine/laws/index.js'
import { getLegalTransitions } from './src/engine/solver.js'
const t = parseExpr(\"x + x'y\")
const sel = [{ path: 'R.0', isTermSel: true }, { path: 'R.1', isTermSel: true }]
console.log('laws  :', analyzeSelection(t, sel).map(l => [l.id, l.name, l.formula]))
console.log('result:', analyzeSelection(t, sel).map(l => nodeText(l.apply())))
console.log('hints :', scanHints(t, 'R'))
console.log('moves :', getLegalTransitions(t).map(x => [x.lawId, x.to]))
"
```

## 10. Gotchas, ranked by how much time they cost

| # | Gotcha | Why it bites | Guard |
|---|---|---|---|
| 1 | hint guard ≠ builder guard | property test fails with thousands of "unreachable hint" violations | copy the predicate, do not retype it |
| 2 | Guide list updated in one file only | same failure, from the other file | `useGameState.js:589` **and** `law-soundness.property.test.js:112` |
| 3 | shape-only predicate | the law is sound but useless: `x + xy = x + xy` | negative test; `useGameState.js:366-373` reports it at runtime |
| 4 | missing `TERM_LEVEL_HINTS` entry | Guide pre-selects with the wrong `isTermSel` | the measured failure in §6 |
| 5 | existing solver test breaks | a newer/shorter path made the old expectation stale | re-baseline it (the repo does this too: commit `3838343`) |
| 6 | `targetLaws` coverage drops | the solver prefers your shortcut and skips the authored law | run the 40-puzzle script before/after |
| 7 | `id` mismatch between card and engine | scoring never credits the law; the card is unreachable | one id, two files, same string |
| 8 | duplicate `name`+`form` | `BY_NAME_AND_FORM` shadows the earlier row silently | keep names unique per form |
| 9 | new single-node law not in the solver | panel works, `findOptimalPath` never sees it | add to `getLegalTransitions` |
| 10 | ungated productive law | `findSimplestForm` stops terminating early; search slows | gate with `allowExpand` + a narrow guard |
| 11 | `normalize` where `normalizeFlat` was meant | the learner's next law disappears (e.g. the `1` in `y1 + z`) | pick per law, see §4 rule 3 |
| 12 | backend still serves the old card list | `content_repository` `lru_cache` | restart the dev backend |

**Related reading.** Full worked example with the real failure transcripts:
[first-contribution.md](../tutorials/first-contribution.md). Every law and its dual:
[boolean-laws.md](../../06-reference/boolean-laws.md). Engine internals:
[understanding-the-engine.md](../tutorials/understanding-the-engine.md).
