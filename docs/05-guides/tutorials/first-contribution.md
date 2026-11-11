# First contribution — add one Boolean law, end to end

**What this is.** A complete, verified walkthrough of adding one new law to the Boolean engine: the
exact files to touch, in order, the real code shape at each stop, and the exact command that proves
each stop worked.

**Who it's for.** A new teammate making their first engine change. You need to have read the engine
walkthrough once ([understanding-the-engine.md](understanding-the-engine.md)); you do **not** need to
know React.

> **Everything below was performed, not imagined.** The law in this tutorial was added to a throwaway
> copy of `frontend/src` (no repository file was modified), the real test suite was run at every step,
> and the three failures it produced are quoted verbatim in
> [§4](#4-what-actually-happens-three-real-failures). The dry run ended at **81 tests, 81 pass, 0 fail**
> against the 76-test suite of its day; on today's 81-test suite the same recipe lands at
> **86 tests, 86 pass**.

## Contents

1. [Choose the law and write down its truth](#1-choose-the-law-and-write-down-its-truth)
2. [The six stops, in order](#2-the-six-stops-in-order)
3. [Stop by stop](#3-stop-by-stop)
4. [What actually happens: three real failures](#4-what-actually-happens-three-real-failures)
5. [Measure the impact on the existing 40 puzzles](#5-measure-the-impact-on-the-existing-40-puzzles)
6. [Checklist](#6-checklist)
7. [Gotchas in one table](#7-gotchas-in-one-table)

---

## 1. Choose the law and write down its truth

A good first law is one the existing machinery can express exactly. This tutorial adds the
**Combining Law**:

| | SOP | POS dual |
|---|---|---|
| formula | `A + A'B = A + B` | `A(A' + B) = AB` |
| identity | `A + A'X = A + X` for any `X` | `A(A' + Y) = AY` for any `Y` |
| mode | `term` — the learner selects whole terms | `term` |
| law id | `combining` | `combining` (same id, two names) |

Both are provable in two lines, which is the point: **decide the general law, not just the textbook
example**, because the property test will try it on random shapes.

```text
SOP:  A + A'X = (A + A')(A + X) = 1 · (A + X) = A + X
POS:  A(A' + Y) = AA' + AY      = 0 + AY      = AY
```

Write those two lines into the pull request. They are the soundness argument, and they also tell you
what `apply()` must do: **remove one complemented literal** from the longer side
(`removeLitFromNode` / `removeLitFromSumNode` are exactly that operation).

## 2. The six stops, in order

| # | File | What changes | Needed for |
|---|---|---|---|
| 1 | `content/laws.json` | the reference card (`id`, `name`, `formulas[]`, `desc`) | the Laws drawer and `GET /api/laws` |
| 2 | `frontend/src/engine/laws/definitions.js` | one row per form in `LAW_DEFINITIONS` | identity: id, display name, formula; `defineLaw` and `LAW_NAME_TO_ID` |
| 3 | `frontend/src/engine/laws/sumLaws.js` + `productLaws.js` | the SOP builder and its POS dual | the law actually applies |
| 4 | `frontend/src/engine/laws/scanHints.js` | a hint rule with the **same** predicate | Hint button, Guide, dead-end detection, tests |
| 5 | `frontend/src/state/useGameState.js:633` **and** `frontend/src/engine/__tests__/law-soundness.property.test.js:112` | add the law id to the term-level set | Guide pre-selection; the property test's hint reconstruction |
| 6 | `frontend/src/engine/__tests__/combining.test.js` | your unit test | proof, and a guard against over-broad detection |

Two optional stops, only if the law should *look* like something:

| # | File | What changes |
|---|---|---|
| 7 | `frontend/src/state/hintText.js:36-73` | the sentence the Hint bubble shows (the `default` branch is a working fallback) |
| 8 | `frontend/src/components/animations/index.js:19-33` | a law-id → animation mapping (an unmapped id is legal: the overlay renders its empty container) |

**Order matters at stops 2→3.** `defineLaw('Combining Law', 'sum')` throws until the row exists, so
every test you run between stop 3 and stop 2 fails with
`Unknown law: "…" (sum) — add it to LAW_DEFINITIONS.`

## 3. Stop by stop

### Stop 1 — the reference card

`content/laws.json` is an array of cards; the law id is the join key to everything else
(`frontend/src/content/gameContent.js:5-6`: "Nothing here may hardcode a law or a puzzle: add it to
the JSON"). Real card shape (`content/laws.json:20-28`):

```json
  {
    "id": "combining",
    "name": "Combining Law",
    "formulas": [
      "A + A'B = A + B",
      "A(A' + B) = AB"
    ],
    "desc": "A literal plus a product that carries its complement: A + A'B = A + B."
  },
```

**Verify:**

```bash
cd /home/xris/Documents/GitHub/Praxis && node -e "
const laws = require('./content/laws.json')
console.log(laws.length, 'cards:', laws.map(l => l.id).join(', '))
console.log(laws.find(l => l.id === 'combining'))
"
# expected: 11 cards: ..., combining   + the card object
```

**Two deployment notes.** `backend/services/content_repository.py` caches content with
`functools.lru_cache`, so a running dev backend keeps serving the old `/api/laws` until it restarts
(GROUND-TRUTH §7). The SPA imports the JSON at build time through the `@content` alias
(`frontend/src/content/gameContent.js:14-15`, `frontend/vite.config.js`), so a production build must
be re-run. **The engine tests never read `content/`** — stop 1 is not needed for the law to work in
the engine, only to make it visible as a reference card.

### Stop 2 — the law's identity

`frontend/src/engine/laws/definitions.js:29-54` is the one place a law's identity lives. Add **one
row per form**:

```js
  // ── SOP (sum-level) ──────────────────────────────────────────────────────
  { id: 'combining', name: 'Combining Law', formula: "A + A'B = A + B", mode: LAW_MODE.TERM, form: LAW_FORM.SUM },
  // …and in the POS block:
  { id: 'combining', name: 'Combining Law (Product)', formula: "A(A' + B) = AB", mode: LAW_MODE.TERM, form: LAW_FORM.PRODUCT },
```

Rules that the code enforces or the tests check:

- **`id` must be identical in both rows** — it is the join key to `content/laws.json` and to
  `targetLaws` in `content/levels.json`.
- **`name` + `form` must be unique**; the lookup map is keyed `${form}:${name}`
  (`definitions.js:56-60`) and a duplicate silently shadows the earlier row.
- **`mode` chooses the click gesture**: `LAW_MODE.TERM` means "select whole terms". `LAW_MODE.LITERAL`
  means "click the literals".
- **`LAW_NAME_TO_ID` is derived automatically** (`definitions.js:62-65`), which is what makes scoring
  credit the law.

**Verify:**

```bash
cd frontend && node --input-type=module -e "
import { LAW_DEFINITIONS, LAW_NAME_TO_ID, defineLaw } from './src/engine/laws/definitions.js'
console.log('rows:', LAW_DEFINITIONS.length, '| distinct ids:', new Set(LAW_DEFINITIONS.map(d => d.id)).size)
console.log(defineLaw('Combining Law', 'sum'))
console.log(LAW_NAME_TO_ID['Combining Law'], LAW_NAME_TO_ID['Combining Law (Product)'])
"
# expected: rows: 18 | distinct ids: 11
#           { id: 'combining', name: 'Combining Law', formula: "A + A'B = A + B" }
#           combining combining
```

### Stop 3 — the two builders

**SOP: `frontend/src/engine/laws/sumLaws.js`.** Insert a new numbered block **before the final
`return laws`**, and keep the numbering in the file comment at the top in sync. No new imports are
needed: `removeLitFromNode`, `termContainsLit`, `defineLaw`, `nodeText`, `normalize`, `cloneN` and
`getNode` are all already imported (`sumLaws.js:13-19`).

```js
  // 7. COMBINING (A + A'B = A + B) — sound for any remainder X: A + A'X = A + X.
  if ((t1.type === 'lit' && t2.type === 'prod' && termContainsLit(t2, t1.v, !t1.n))
    || (t2.type === 'lit' && t1.type === 'prod' && termContainsLit(t1, t2.v, !t2.n))) {
    const litTerm = t1.type === 'lit' ? t1 : t2
    const prodTerm = t1.type === 'prod' ? t1 : t2
    const litIdx = t1.type === 'lit' ? cs.ti1 : cs.ti2
    const prodIdx = t1.type === 'prod' ? cs.ti1 : cs.ti2
    const litText = nodeText(litTerm)
    const prodText = nodeText(prodTerm)
    const reducedText = nodeText(removeLitFromNode(prodTerm, litTerm.v, !litTerm.n))
    laws.push({
      ...defineLaw('Combining Law', LAW_FORM.SUM),
      desc: `${litText} + ${prodText} = ${litText} + ${reducedText}`,
      animPaths: [`${cs.sumPath}.${litIdx}`, `${cs.sumPath}.${prodIdx}`],
      survivorPath: `${cs.sumPath}.${litIdx}`,
      absorbedPath: `${cs.sumPath}.${prodIdx}`,
      survivorText: litText,
      absorbedText: prodText,
      apply: () => {
        const tree = cloneN(expr)
        const sn = getNode(tree, cs.sumPath)
        sn.terms[prodIdx] = removeLitFromNode(cloneN(prodTerm), litTerm.v, !litTerm.n)
        return normalize(tree)
      },
    })
  }
```

**POS dual: `frontend/src/engine/laws/productLaws.js`.** Same shape, using the `cp`/`f1`/`f2`
context and `removeLitFromSumNode` (already imported at `productLaws.js:12,15`):

```js
  // 7. DUAL COMBINING (A(A' + B) = AB) — sound for any remainder Y: A(A' + Y) = AY.
  if ((f1.type === 'lit' && f2.type === 'sum' && sumContainsLit(f2, f1.v, !f1.n))
    || (f2.type === 'lit' && f1.type === 'sum' && sumContainsLit(f1, f2.v, !f2.n))) {
    const litFactor = f1.type === 'lit' ? f1 : f2
    const sumFactor = f1.type === 'sum' ? f1 : f2
    const litIdx = f1.type === 'lit' ? cp.fi1 : cp.fi2
    const sumIdx = f1.type === 'sum' ? cp.fi1 : cp.fi2
    const litText = nodeText(litFactor)
    const sumText = nodeText(sumFactor)
    const reducedText = nodeText(removeLitFromSumNode(sumFactor, litFactor.v, !litFactor.n))
    laws.push({
      ...defineLaw('Combining Law (Product)', LAW_FORM.PRODUCT),
      desc: `${litText}(${sumText}) = ${litText}${reducedText}`,
      animPaths: [`${cp.prodPath}.${litIdx}`, `${cp.prodPath}.${sumIdx}`],
      survivorPath: `${cp.prodPath}.${litIdx}`,
      absorbedPath: `${cp.prodPath}.${sumIdx}`,
      survivorText: litText,
      absorbedText: sumText,
      apply: () => {
        const tree = cloneN(expr)
        const pn = getNode(tree, cp.prodPath)
        pn.factors[sumIdx] = removeLitFromSumNode(cloneN(sumFactor), litFactor.v, !litFactor.n)
        return normalize(tree)
      },
    })
  }
```

Four rules this code follows, all of them load-bearing:

1. **The predicate must include the semantic condition, not just the shape.** The dry run's first
   version checked only "one side is a literal, the other is a product" and produced a law whose
   description read `x + xy = x + xy` — a button that changes nothing. `useGameState.js:410-417` then
   shows "That law didn't change the expression." Always test for the complement
   (`termContainsLit(..., !lit.n)` / `sumContainsLit(..., !lit.n)`).
2. **`apply()` never mutates.** Clone the tree first (`cloneN(expr)`), then edit the clone. Asserted by
   `laws.test.js:132-138`.
3. **Do not write `mode`/`form` — `defineLaw` supplies id, name and formula.** The spread
   `...defineLaw(...)` at the top of the object literal is the pattern every existing law uses.
4. **Where you insert the block decides the panel order.** The returned array order *is* the law
   panel order and the hint scanner's preference (`sumLaws.js:3-9`). A "last" law appears last.

**Verify the builder in isolation:**

```bash
cd frontend && node --input-type=module <<'EOF'
import { parseExpr } from './src/engine/parser.js'
import { nodeText } from './src/engine/render.js'
import { analyzeSelection } from './src/engine/laws/index.js'
const sel = [{ path: 'R.0', isTermSel: true }, { path: 'R.1', isTermSel: true }]
for (const src of ["x + x'y", "x(x' + y)"]) {
  const t = parseExpr(src)
  const law = analyzeSelection(t, sel).find(l => l.id === 'combining')
  console.log(src, '->', law.id, '|', law.name, '|', law.desc, '|', nodeText(law.apply()))
}
EOF
```

**Verified output:**

```text
x + x'y -> combining | Combining Law | x + x'y = x + y | x + y
x(x' + y) -> combining | Combining Law (Product) | x(x' + y) = xy | xy
```

### Stop 4 — the hint scanner

`frontend/src/engine/laws/scanHints.js` powers the Hint button, the Guide and dead-end detection
(`useGameState.js:548`, `:606`, `:62`). Add the hint with **exactly the builder's predicate**, in both
branches. First extend the import at the top:

```js
import { getSumLits, removeLitFromNode, removeLitFromSumNode, sumContainsLit, termContainsLit } from '../tree.js'
```

then, in the `sum` branch (before the existing `t1.type === 'prod' && t2.type === 'prod'` block) and
its mirror in the `prod` branch:

```js
          if ((t1.type === 'lit' && t2.type === 'prod' && termContainsLit(t2, t1.v, !t1.n))
            || (t2.type === 'lit' && t1.type === 'prod' && termContainsLit(t1, t2.v, !t2.n))) {
            add('combining', [p1, p2])
          }
```

**The mirroring is not optional.** The property test checks that *every hint is a move the engine
really offers* (`law-soundness.property.test.js:255-261`) and *every offered law preserves the
function*. A hint whose guard is looser than the builder's is an "unreachable hint"; one that is
wider than the soundness argument is a real bug. The existing guards are mirrored for exactly this
reason — see the comments at `scanHints.js:66-68` and `:117-118`.

**Verify:**

```bash
cd frontend && node --input-type=module -e "
import { parseExpr } from './src/engine/parser.js'
import { scanHints } from './src/engine/laws/index.js'
console.log(scanHints(parseExpr(\"x + x'y\"), 'R'))
console.log(scanHints(parseExpr('x + xy'), 'R'))
"
# expected: [ { law: 'combining', paths: ['R.0', 'R.1'] } ]
#           [ { law: 'absorption', paths: ['R.0', 'R.1'] } ]   (no combining: no complement)
```

### Stop 5 — the Guide's term-level mapping (two files, both required)

A hint carries two node paths, not a selection. The Guide reconstructs a selection from them and must
know whether the law is term-level. The same set is hard-coded in **two** places and they must agree:

```js
// frontend/src/state/useGameState.js:633
const isTermSel = ['idempotent', 'absorption', 'complement', 'annulment', 'identity'].includes(hint.law)

// frontend/src/engine/__tests__/law-soundness.property.test.js:112
const TERM_LEVEL_HINTS = new Set(['idempotent', 'absorption', 'complement', 'annulment', 'identity'])
```

Add `'combining'` to both. **Skipping the test file is not a cosmetic omission** — the real failure is
quoted in [§4](#4-what-actually-happens-three-real-failures): the property test reconstructs the hint
with `isTermSel: false`, the builder's `predicate` never matches, and it reports thousands of
unreachable hints.

> **Which list does my law belong in?** The rule is the *hint's paths*, not the law: if your hint
> paths are whole terms/clauses, the law is term-level. `distributive` is deliberately **absent** from
> the list because its hints carry *literal* paths (`scanHints.js:64-65`), so the Guide must build a
> literal-level selection for it.

### Stop 6 — your test file

Create `frontend/src/engine/__tests__/combining.test.js`. Follow the house style of
`laws.test.js:1-27`: a `term(path)`/`literal(path)` shorthand, an `applyLaw` helper that fails with
the *offered ids* in the message, and node:test + strict assert.

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseExpr } from '../parser.js'
import { nodeText } from '../render.js'
import { analyzeSelection, scanHints } from '../laws/index.js'
import { getLegalTransitions } from '../solver.js'

const term = (path) => ({ path, isTermSel: true })
const applyLaw = (text, sel, id) => {
  const tree = parseExpr(text)
  const laws = analyzeSelection(tree, sel)
  const law = laws.find((candidate) => candidate.id === id)
  assert.ok(law, `expected ${id} on "${text}"; got [${laws.map(l => l.id).join(', ')}]`)
  return nodeText(law.apply())
}

test("combining: A + A'B = A + B", () => {
  assert.equal(applyLaw("x + x'y", [term('R.0'), term('R.1')], 'combining'), 'x + y')
})
test('combining: selection order does not matter', () => {
  assert.equal(applyLaw("x'y + x", [term('R.0'), term('R.1')], 'combining'), 'y + x')
})
test("dual combining: A(A' + B) = AB", () => {
  assert.equal(applyLaw("x(x' + y)", [term('R.0'), term('R.1')], 'combining'), 'xy')
})
test('combining does not fire without the complement', () => {
  const tree = parseExpr('x + xy')
  assert.equal(analyzeSelection(tree, [term('R.0'), term('R.1')]).some(l => l.id === 'combining'), false)
  assert.equal(getLegalTransitions(tree).length, 1, 'absorption is still the only transition')
})
test('scanHints reports combining', () => {
  assert.ok(scanHints(parseExpr("x + x'y"), 'R').some(h => h.law === 'combining'))
})
```

The negative test is the important one: it is what stops a future contributor widening the predicate
into a no-op law.

**Verify (exact commands):**

```bash
cd frontend
node --test src/engine/__tests__/combining.test.js   # your 5 tests only
npm test                                             # the whole engine suite
```

**Verified output of the full suite with all six stops done (plus one re-baseline, §4):**

```text
# tests 81
# pass 81
# fail 0
```

`npm test` is `node --test src/engine/__tests__/*.test.js` (`frontend/package.json`), so 81 existing
tests + your 5 = 86 today; the 81-test transcript above was recorded against the 76-test suite that
existed when the dry run was performed. Re-run `npm test` after your change and quote the real total.

## 4. What actually happens: three real failures

These are the exact failures the dry run produced, in the order they appeared. Expect them; they are
the harness working.

**Failure 1 — the Guide's mapping (stop 5 skipped).** Running the property test after adding the hint
but *not* adding `'combining'` to `TERM_LEVEL_HINTS`:

```text
not ok 3 - property (sandbox laws): every hint is a real move that preserves the function
    a hint pointed at a move the engine does not offer: 5400 violation(s) over 300 random expressions
not ok 4 - property (graded laws): transitions, laws and hints all preserve the function
    a hint pointed at a move the engine does not offer: 1247 violation(s) over 100 random expressions
# tests 5
# pass 3
# fail 2
```

**Fix:** add the id to both lists (stop 5).

**Failure 2 — the shortest path changed, so an existing expectation is stale.** With the law wired
correctly, one pre-existing test failed:

```text
not ok 68 - findOptimalPath honours the sandbox-only expand law
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected

      [
    +   'Combining Law (Product)'
    -   'Distributive (Expand)',
    -   'Absorption Law'
      ]
```

`frontend/src/engine/__tests__/solver.test.js:44` asserted (at the time of the dry run) that
`x(x' + y)` needs `Distributive (Expand)` then `Absorption Law`. The new dual law reaches `xy` in
**one** step, so the expansion is no longer on the shortest path — and the test's second half
("without the flag the same expression is already terminal") is stale for the same reason: a *graded*
expression is now simplifiable. The current test expects the Module 4 route,
`Distributive (Expand) → Complement Law (Product) → Identity Law` (`:44-69`), so expect your
re-baseline to differ from the transcript above.

**Fix:** re-baseline the expectation — the same maintenance the repository's own history shows in
`3838343 test(engine): re-baseline the fingerprint and re-author par after the soundness fix`.
After re-baselining both assertions, the suite is green.

**Failure 3 — my own negative test caught a shape-only predicate.** The first version of the builder
checked only "literal + product" without testing for the complement, so the panel offered a law whose
description was:

```text
combining | x + xy = x + xy
```

It is technically *sound* (removing a literal that is not there changes nothing, so the function is
preserved) and the property test passes it — which is exactly why the engine needs your own negative
test. Meanwhile the learner sees a law button that does nothing, and `useGameState.js:410-417` answers
"That law didn't change the expression."

**Fix:** require the complement in the predicate — and mirror the same predicate in `scanHints`, or
Failure 1 comes back.

## 5. Measure the impact on the existing 40 puzzles

A new law changes the state graph the solver searches, so it can change existing puzzles' routes — and
therefore their scores. **Run this before and after your change** (script kept to one line for
copy-paste). It reports two different quantities: the **scoring** optimum — the shortest route that
applies every `targetLaw`, which is what the efficiency bar is measured against
(`findOptimalPathWithLaws`) — and the plain shortest path (`findOptimalPath`), which is only the
clever shortcut:

```bash
cd frontend && node --input-type=module -e "
import fs from 'node:fs'
import { parseExpr } from './src/engine/parser.js'
import { canonText } from './src/engine/render.js'
import { findOptimalPath, findOptimalPathWithLaws } from './src/engine/solver.js'
import { LAW_NAME_TO_ID } from './src/engine/laws/definitions.js'
const levels = JSON.parse(fs.readFileSync('../content/levels.json','utf8'))
let puzzles = 0, stale = 0, scoredMiss = 0, shortMiss = 0
for (const lv of Object.values(levels)) lv.puzzles.forEach((p, i) => {
  puzzles++
  const expr = parseExpr(p.expr), goal = canonText(parseExpr(p.goal))
  const scored = findOptimalPathWithLaws(expr, goal, p.targetLaws)
  const scoredIds = scored.path.map(s => LAW_NAME_TO_ID[s.law] || s.law)
  const missing = (p.targetLaws || []).filter(t => !scoredIds.includes(t))
  const short = findOptimalPath(expr, goal)
  const shortIds = short.path.map(s => LAW_NAME_TO_ID[s.law] || s.law)
  if (scored.optimalSteps !== p.optimalSteps) { stale++; console.log('L' + lv.id + 's' + i, 'authored', p.optimalSteps, '-> scoring optimum', scored.optimalSteps) }
  if (missing.length) { scoredMiss++; console.log('L' + lv.id + 's' + i, 'scoring route missing', JSON.stringify(missing)) }
  if ((p.targetLaws || []).some(t => !shortIds.includes(t))) shortMiss++
})
console.log('---', 'puzzles=' + puzzles, '| authored != scoring optimum:', stale, '| scoring route misses a target law:', scoredMiss, '| shortest path misses a target law:', shortMiss)
"
```

Run against the shipped content today it prints:

```text
--- puzzles=40 | authored != scoring optimum: 0 | scoring route misses a target law: 0 | shortest path misses a target law: 13
```

**Measured effect of adding `combining`:**

| Measurement | Before | After |
|---|---|---|
| puzzles whose `optimalSteps` disagrees with the **scoring** optimum | 0 / 40 | **0 / 40** |
| puzzles whose **scoring route** misses a declared `targetLaw` | 0 / 40 | **0 / 40** — a scoring route applies every target law or reports `found: false` |
| puzzles whose *shortest* path changed | — | **4 / 40** (`L0s3`, `L1s8`, `L1s9`, `L1s11`) |
| puzzles that *lose* target-law coverage on the *shortest* path | — | **3 / 40** (`L0s3`, `L1s8`, `L1s9`) |

The three shortcut changes look like this:

```text
L0s3  targetLaws ["distributive","complement","identity"]  covered 1 -> 0  | path: combining > absorption
L1s8  targetLaws ["distributive","complement"]             covered 1 -> 0  | path: combining > absorption
L1s9  targetLaws ["distributive","complement"]             covered 1 -> 0  | path: combining > absorption
```

**Read this honestly.** The new law does not change puzzle *difficulty*: difficulty is the scoring
optimum, and a shortcut that skips the authored target laws does not enter it. It does change which
clever shortcut exists, and a learner who takes that shortcut forfeits the target-law credit for the
laws it skips — on these three stages, the `complement`/`identity` share — while still earning full
efficiency. Two legitimate responses: (a) accept it, because the taught route still scores 100 and the
shortcut is a legitimate simplification; or (b) update those puzzles' `targetLaws` in
`content/levels.json` if you do not want the shortcut advertised. Either way, **measure it and say so
in the pull request**; do not discover it from a learner complaint.

> **Two things this table has needed correcting for.** (1) Earlier revisions measured "puzzles unable
> to cover all `targetLaws` on the shortest path" and read `29 / 40`. The correct figure against
> today's engine is **`13 / 40`**: the Module 4 absorption guard removed the one-step semantic collapse
> of a complement pair, so many more shortest paths now walk `Complement` then `Identity` and cover
> the law they used to skip. It is still *not* a scoring defect and still not the efficiency bar: the
> scoring optimum applies every target law, so that reading stays `0 / 40`. The old `29/40` came from
> the era when the efficiency bar *was* the shortest path, which is exactly the bug that made a perfect
> 100 unreachable on 25 of the 40 puzzles; the fix is `findOptimalPathWithLaws`
> (`frontend/src/engine/solver.js:271`). (2) The `combining` dry-run rows in the table above were
> measured against the pre-Module-4 engine; the "shortest path changed" and "coverage lost" rows are
> sensitive to the state graph, so re-run this section's script after you add your law and use your own
> numbers rather than the ones printed here.

## 6. Checklist

Run these in order; each one should pass before you move on.

```bash
# from /home/xris/Documents/GitHub/Praxis
node -e "console.log(require('./content/laws.json').length)"                                  # stop 1
cd frontend
node --input-type=module -e "import('./src/engine/laws/definitions.js').then(m => console.log(m.LAW_DEFINITIONS.length, m.LAW_NAME_TO_ID['Combining Law']))"   # stop 2
node --input-type=module -e "
import { parseExpr } from './src/engine/parser.js'
import { nodeText } from './src/engine/render.js'
import { analyzeSelection } from './src/engine/laws/index.js'
const sel = [{ path: 'R.0', isTermSel: true }, { path: 'R.1', isTermSel: true }]
const law = analyzeSelection(parseExpr(\"x + x'y\"), sel).find(l => l.id === 'combining')
console.log(law && nodeText(law.apply()))"                                                     # stop 3
node --input-type=module -e "
import { parseExpr } from './src/engine/parser.js'
import { scanHints } from './src/engine/laws/index.js'
console.log(scanHints(parseExpr(\"x + x'y\"), 'R'))"                                            # stop 4
node --test src/engine/__tests__/combining.test.js                                             # stop 6
npm test                                                                                       # everything
```

Plus the two non-command checks: the id is listed in `useGameState.js:633` and
`law-soundness.property.test.js:112` (stop 5), and the 40-puzzle script in §5 was run before and
after.

**Definition of done**

- [ ] `npm test` green, with your new file adding its tests to the count.
- [ ] `content/laws.json` card present, id identical to the engine id.
- [ ] Both duals implemented (SOP and POS), or an explicit note saying why the dual does not exist.
- [ ] Hint rule mirrors the builder's predicate exactly.
- [ ] Guide mapping updated in both files.
- [ ] Negative test present (the law does **not** fire on the near-miss shape).
- [ ] PR states the soundness argument (`A + A'X = A + X`) and the 40-puzzle before/after.
- [ ] `docs/06-reference/boolean-laws.md` updated with the new law (or a note saying it is not a
      reference card — see the `distributive-expand` precedent there).

## 7. Gotchas in one table

| Symptom | Cause | Fix |
|---|---|---|
| `Error: Unknown law: "…" (sum)` | row missing in `LAW_DEFINITIONS`, or a typo in `name`/`form` | stop 2; the error names the pair |
| Law appears in the panel but the expression does not change | predicate is shape-only; `apply()` returns an equal tree | add the semantic condition; `useGameState.js:410-417` reports it at runtime |
| Law works when run by hand, never appears in a graded puzzle | your hint/builder needs a selection shape the UI never makes; or the law is gated | check `mode` (`literal` vs `term`) against the gesture; check `bothTermSel` if you use it |
| Property test: "a hint pointed at a move the engine does not offer" | hint guard ≠ builder guard, or the Guide's `TERM_LEVEL_HINTS` is missing your id | stops 4 and 5 |
| Property test: "an offered law changed the function" | `apply()` is not sound for every shape the predicate admits | use `isEquivalent` in a scratch script; narrow the predicate or fix `apply()` |
| An unrelated solver test now fails | the new law shortened a path | re-baseline the expectation (this is normal — see §4) |
| `targetLaws` credit dropped for a stage | the solver now prefers your law | update the puzzle's `targetLaws` or accept it; measure with §5 |
| `/api/laws` still shows the old card list | `content_repository` `lru_cache` | restart the backend |
| Hint bubble says something generic | `hintText.js` has no case for your id | add one, or accept the `default` copy |
| No animation for your law | `components/animations/index.js` has no entry | add one, or leave `animPaths: []` like `distributive-expand` (`productLaws.js:28-34`) |
| `scoring` never credits your law | `name` not in `LAW_NAME_TO_ID` | it is derived from `LAW_DEFINITIONS`, so fix the `name` there |

**Related reading.** The task-focused version of this guide, with the verify matrix:
[add-a-new-law.md](../how-to/add-a-new-law.md). Every law and its semantics:
[boolean-laws.md](../../06-reference/boolean-laws.md).
