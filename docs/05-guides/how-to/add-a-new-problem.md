# How to add a new problem (a stage) to Praxis

**What this is:** an executable procedure for adding one problem — Praxis calls it a *stage* — to
an existing level, and then **proving** it is well formed: the start expression parses, the goal is
equivalent to it, the puzzle is solvable, `optimalSteps` is the real scoring optimum (the shortest
derivation that applies every law the puzzle names), and every law id the puzzle names can actually
be earned by the learner.
**Who it's for:** a new contributor with zero prior context. You need a terminal, Node.js and `jq`.
No React or Python knowledge is required — every verification step below runs the real engine.

> Read [`../tutorials/understanding-the-engine.md`](../tutorials/understanding-the-engine.md) first
> if you have not yet seen how parsing, laws and the solver fit together. That tutorial explains the
> *engine contract*; this guide only tells you how to add content that satisfies it.

## Contents

1. [What a "problem" is in this codebase](#1-what-a-problem-is-in-this-codebase)
2. [The six keys, one by one](#2-the-six-keys-one-by-one)
3. [Before you start: the two-line setup](#3-before-you-start-the-two-line-setup)
4. [Step 1 — choose the level and the stage slot](#4-step-1--choose-the-level-and-the-stage-slot)
5. [Step 2 — write the puzzle object](#5-step-2--write-the-puzzle-object)
6. [Step 3 — append it to `content/levels.json`](#6-step-3--append-it-to-contentlevelsjson)
7. [Step 4 — verify, for real](#7-step-4--verify-for-real)
8. [The `distributive-expand` trap](#8-the-distributive-expand-trap)
9. [Which route earns the target-law credit](#9-which-route-earns-the-target-law-credit)
10. [Checklist](#10-checklist)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. What a "problem" is in this codebase

A *level* is one object in `content/levels.json`. A *stage* (what the learner sees as
"Stage 4", what the API calls `stageIdx`) is one object inside that level's `puzzles` array.
Its array position **is** its stage index — there is no `id` field inside a puzzle
(`backend/repositories/content_repository.py:60-62`, `backend/services/content_service.py:40-42`).

The same JSON file feeds three consumers, so a new stage becomes visible everywhere at once:

| Consumer | How it reads the file | Evidence |
|---|---|---|
| The React app | bundles it at build time through the `@content` Vite alias | `frontend/vite.config.js:16`, `frontend/src/content/gameContent.js:14-15` |
| The FastAPI backend | reads it from disk once per process | `backend/repositories/content_repository.py:16`, `:34-43` |
| The `/api/*` routes | serve exactly what the backend loaded | `backend/api/routes/levels.py:18-27` |

The verified shape of the shipped file is **4 levels with 4 / 12 / 12 / 12 puzzles = 40 stages**
(measured with the `jq` command in §4). Per-puzzle keys are **exactly** these six, with no
exceptions anywhere in the shipped content:

```text
expr, goal, targetLaws, hints, optimalSteps, optimalHint
```

The engine and the backend both work in terms of an **AST** (an expression tree) and a **literal**
(a single variable such as `x`, or its complement `x'`). A **term** is a product of literals
(`xy'`); a **clause** is a sum of literals (`x' + y`). "SOP" is a sum of products, "POS" is a
product of sums, and the two are *duals* of each other.

---

## 2. The six keys, one by one

| Key | Type | Who reads it | Evidence |
|---|---|---|---|
| `expr` | string | parsed into the start AST with `parseExpr` when the stage opens | `frontend/src/state/useGameState.js:83` |
| `goal` | string | parsed and canonicalised with `canonText(parseExpr(...))`; the puzzle is solved when the learner's AST canonicalises to the same text | `frontend/src/state/useGameState.js:83`, `frontend/src/engine/solver.js:217` |
| `targetLaws` | array of law ids | the target-law band of the score (30 of 100 points) | `backend/services/scoring_service.py:46`, `:99-107` |
| `hints` | array of strings | the Hint button's **fallback** copy (see the warning below) | `frontend/src/state/useGameState.js:558-559` |
| `optimalSteps` | number | the fallback "perfect" step count when the solver cannot confirm one at runtime; when the solver does confirm one it is the **scoring** optimum — the shortest derivation that applies every `targetLaws` id | `frontend/src/state/useGameState.js:107-117`, `frontend/src/engine/solver.js:271`, `backend/services/scoring_service.py:85` |
| `optimalHint` | string | the "💡 Tip" inside the score modal | `frontend/src/components/puzzle/ScoreModal.jsx:154-156` |

Three of those need a warning, because their behaviour is not what the names suggest:

**`hints` is a fallback, not the normal hint.** When the learner presses Hint, Praxis first asks the
engine for a contextual hint (`scanHints`, rendered by `buildHintText`) and shows that. Your
`hints` strings are used only when the engine finds *no* applicable law from the current state —
which in practice means "the expression is already at the goal, but the learner has not finished".
Both branches charge one hint against the score. Evidence:
`frontend/src/state/useGameState.js:501-520`, `frontend/src/state/hintText.js:18-77`.

**`optimalHint` is shown only when the learner lost efficiency points.** The score modal renders it
behind `scoreResult.efficiency < 40`, i.e. only when the learner used more steps than the optimum.
That is why the shipped texts read like "Did you take a longer route?". Evidence:
`frontend/src/components/puzzle/ScoreModal.jsx:154-156`.

**`optimalSteps` is a fallback, not the authority.** The workspace re-derives the optimum with the
solver every time a stage opens and uses *that* number when the solver succeeds, falling back to
your figure only when it does not. The figure the solver derives for a graded stage is not the raw
shortest path: it is the shortest derivation that reaches the goal **and** applies every law in
`targetLaws` (`findOptimalPathWithLaws`, `frontend/src/engine/solver.js:271`), with the plain
shortest path as the fallback when no such route exists
(`frontend/src/state/useGameState.js:87-117`). You still have to author it correctly: it is what the
learner sees on a puzzle the runtime solver cannot confirm, it is what the client sends to the score
endpoint (`frontend/src/components/puzzle/usePuzzleSession.js:166-170`, `frontend/src/services/scoreApi.js:31-35`),
and `frontend/src/engine/__tests__/solver.test.js:162-201` fails the suite when an authored figure
disagrees with the computed scoring optimum — including when a declared `targetLaw` has no
goal-route that can apply it.

**One more rule: do not add extra keys.** Only the six above are part of the contract. There is
exactly one exception in the whole codebase — `allowExpand` — and it belongs to sandbox puzzles only:
`frontend/src/components/puzzle/usePuzzleSession.js:84` reads `Boolean(puzzle.allowExpand)` and
hands it to the engine, which would switch on the gated `distributive-expand` law in a graded stage.
Never set it in `content/levels.json`.

---

## 3. Before you start: the two-line setup

Everything below runs the **real engine**, imported straight from source. The engine is pure ESM
with no React, DOM or network dependency (`frontend/src/engine/index.js:1-14`), so Node can run it
directly. The engine's public surface is the barrel export, and the four search entry points are:

```js
// frontend/src/engine/index.js:57
export { getLegalTransitions, findOptimalPath, findOptimalPathWithLaws, findSimplestForm } from './solver.js'
```

Run snippets from inside `frontend/` using a heredoc — it avoids quoting problems with the `'`
character in `x'`:

```bash
cd /home/xris/Documents/GitHub/Praxis/frontend
node --input-type=module <<'EOF'
import * as engine from './src/engine/index.js'
console.log(Object.keys(engine).length + ' exports')
EOF
```

```text
60 exports
```

> Every command in this guide was executed against the repository at commit `3838343` with Node
> `v22.23.1`, `jq` 1.8.1, Python 3.14 and FastAPI 0.141.1. The outputs below are the real ones.

---

## 4. Step 1 — choose the level and the stage slot

Levels are numbered **0-based**, and **id `0` is the Tutorial** (`frontend/src/config/gameRules.js:82-85`).
The shipped levels are:

```bash
cd /home/xris/Documents/GitHub/Praxis
jq -r '.[] | "id=\(.id)  \(.name)  varCount=\(.varCount)  puzzles=\(.puzzles|length)"' content/levels.json
```

```text
id=0  Tutorial  varCount=2  puzzles=4
id=1  Level 1  varCount=2  puzzles=12
id=2  Level 2  varCount=3  puzzles=12
id=3  Level 3 — Boss  varCount=4  puzzles=12
```

```bash
jq -r '[.[] | .puzzles | length] as $c | "per-level \($c|join(","))  total \($c|add)"' content/levels.json
```

```text
per-level 4,12,12,12  total 40
```

So a new stage for Level 1 goes at the end of `.[1].puzzles`, and its stage index is the length of
that array before you append: **12** (the 13th stage). The learner sees `Stage 13`, because the
stage screen renders `Stage {idx + 1}` (`frontend/src/pages/StageSelectorPage.jsx:315-318`).

> **Warning — the negative stage index trap.** The backend rejects only `stage_idx >= len(puzzles)`:
>
> ```python
> # backend/services/content_service.py:40-42
> if stage_idx >= len(puzzles):
>     raise NotFoundError(f"Stage {stage_idx} not found")
> return puzzles[stage_idx]
> ```
>
> A negative `stageIdx` therefore resolves Python-style to the *last* stage instead of 404ing.
> Measured against the running dev backend: `POST /api/score` with `stageIdx: 11` and with
> `stageIdx: -1` return byte-identical payloads for Level 1. If you mis-number a stage while
> authoring, the API may silently score a *different* puzzle. Always verify the index you actually
> wrote with the appending command in §6.

---

## 5. Step 2 — write the puzzle object

This guide's worked example adds a 13th stage to Level 1: a POS dual pair exercise that does not
exist anywhere in the shipped content — `(x + y)(x + y')` simplifies to `x`.

```json
{
  "expr": "(x + y)(x + y')",
  "goal": "x",
  "targetLaws": ["distributive", "complement", "identity"],
  "hints": [
    "Both clauses share x. Look for a law that joins them.",
    "Dual Distributive: (A + B)(A + C) = A + BC - factor x out.",
    "yy' is 0 by the Complement Law, and x + 0 is x by the Identity Law."
  ],
  "optimalSteps": 3,
  "optimalHint": "Dual Distributive turns (x + y)(x + y') into x + yy', the Complement Law collapses yy' to 0, and Identity leaves x."
}
```

How each field was chosen, in authoring order:

1. **`expr`** — write it in the notation the parser accepts: `+` for OR, implicit adjacency or
   `*` for AND, a postfix `'` for NOT (`frontend/src/engine/parser.js:9-13`). Case matters: `x` and
   `X` are different literals.
2. **`goal`** — the target text. It must be **equivalent** to `expr` under a truth table, not just
   "look simpler" (`frontend/src/engine/equivalence.js:45-58`). §7.2 proves this.
3. **`targetLaws`** — law ids from `content/laws.json` only. Pick the laws your intended textbook
   derivation uses, which is the house style: e.g. Tutorial *Stage 2* (`x'y + z + xy` → `y + z`)
   authors `["distributive", "complement", "identity"]`. That is safe: since the objective-aware
   optimum landed, the shortest derivation that applies *all* of `targetLaws` sets the efficiency bar
   (see §9). What is **not** safe is naming a law that no route to the goal can apply — that law's
   share of the 30-point band becomes unreachable and the puzzle can never score 100. Four shipped
   stages (`2:2`, `2:3`, `2:6`, `2:7`) fell into exactly that trap: they declared `absorption` and
   relied on a *semantic* absorption step that swallowed a clause equal to a constant, which the
   proposal's Module 4 now forbids, so absorption cannot appear on any goal-route there. Their
   `targetLaws` were re-authored to what their solutions actually use. Check yours with §7.5 and
   §7.6.
4. **`hints`** — two or three short sentences in teaching order; shipped stages use 2-4.
5. **`optimalSteps`** — the number `findOptimalPathWithLaws` reports for your `targetLaws`, never a
   guess (§7.3). For the example above `targetLaws` is `["distributive", "complement", "identity"]`,
   so the figure is `3` — and the plain shortest path is `3` too, because the Module 4 guard removed
   the 2-step semantic-absorption route through `yy'`.
6. **`optimalHint`** — one sentence naming the *optimal* route, shown only to learners who were
   inefficient (§2).

---

## 6. Step 3 — append it to `content/levels.json`

Save the object above as `/tmp/new-stage.json`, then append it with `jq`. This is the exact command
that produced the output below (it writes a *copy* so that this guide's before/after numbers stay
reproducible; drop the redirection into a temp file and `mv` it over `content/levels.json` to apply
the change for real):

```bash
cd /home/xris/Documents/GitHub/Praxis
mkdir -p /tmp/demo-content && cp content/levels.json content/laws.json /tmp/demo-content/
jq --slurpfile stage /tmp/new-stage.json '.[1].puzzles += $stage' content/levels.json > /tmp/demo-content/levels.json

echo "BEFORE:"; jq -r '[.[] | .puzzles | length] as $c | "  per-level \($c|join(","))  total \($c|add)"' content/levels.json
echo "AFTER:";  jq -r '[.[] | .puzzles | length] as $c | "  per-level \($c|join(","))  total \($c|add)"' /tmp/demo-content/levels.json
```

```text
BEFORE:
  per-level 4,12,12,12  total 40
AFTER:
  per-level 4,13,12,12  total 41
```

The game total therefore goes **40 → 41** stages. `GET /api/levels` reports the per-level figure as
`puzzleCount`, so Level 1 changes from `12` to `13` there too (`backend/repositories/content_repository.py:46-57`).

If you edit the JSON by hand instead, keep the file a single JSON array, keep the puzzle you added
as the **last** element of `.[1].puzzles`, and mind the trailing comma before the closing `]`.
Then confirm the slot with `jq '.[1].puzzles[12]' content/levels.json`.

---

## 7. Step 4 — verify, for real

Run all eight checks. They take about a minute in total and catch every content mistake this project
has actually shipped.

### 7.1 The six keys are exactly right

```bash
cd /home/xris/Documents/GitHub/Praxis
jq -c '[.[] | .puzzles[] | keys] | unique' content/levels.json
```

```text
[["expr","goal","hints","optimalHint","optimalSteps","targetLaws"]]
```

A typo such as `optimalStep` or `targetLaw` will show up here as a second array in the result.

### 7.2 `expr` parses, round-trips, and `goal` is equivalent to it

```bash
cd /home/xris/Documents/GitHub/Praxis/frontend
node --input-type=module <<'EOF'
import * as engine from './src/engine/index.js'

const exprText = "(x + y)(x + y')"
const goalText = 'x'
const expr = engine.parseExpr(exprText)
const goal = engine.parseExpr(goalText)

console.log('re-renders identically:', engine.nodeText(expr).replace(/\s+/g, '') === exprText.replace(/\s+/g, ''))
console.log('goal is equivalent    :', engine.isEquivalent(expr, goal))
console.log('literals in expr      :', engine.extractVariables(expr).join(', '))
EOF
```

```text
re-renders identically: true
goal is equivalent    : true
literals in expr      : x, y
```

The round-trip test matters because the parser **silently skips unknown characters**
(`frontend/src/engine/parser.js:11`, `:51-53`), and there is a second, stricter string gate in
`validateExpr` (`frontend/src/engine/validate.js:16-77`) that the graded flow does not call. If your
text does not render back to itself, the parser dropped something: rewrite the expression instead of
patching the AST.

`isEquivalent` is a real truth-table comparison over the union of both expressions' literals —
2ⁿ evaluations (`frontend/src/engine/equivalence.js:46-57`), so it is cheap for the 2-4 literal
puzzles this game ships and gets expensive fast beyond that.

### 7.3 The puzzle is solvable and `optimalSteps` is the real scoring optimum

Ask the engine for the **scoring** optimum — the shortest derivation that reaches the goal *and*
applies every law you declared — not for the raw shortest path. For the worked example the two agree
at 3 steps: the 2-step route the engine used to find (`Distributive (POS)` then `Absorption Law` over
`yy'`) is gone, because the proposal's Module 4 forbids absorption from swallowing a clause that is
equivalent to a constant. On 11 of the 40 shipped stages the two figures still differ, so measure
both.

```bash
cd /home/xris/Documents/GitHub/Praxis/frontend
node --input-type=module <<'EOF'
import * as engine from './src/engine/index.js'

const expr = engine.parseExpr("(x + y)(x + y')")
const goal = engine.parseExpr('x')
const targetLaws = ['distributive', 'complement', 'identity']
const result = engine.findOptimalPathWithLaws(expr, engine.canonText(goal), targetLaws)
console.log(JSON.stringify(result, null, 2))
console.log('law ids on that path:', engine.lawsUsedFromSteps(result.path).join(', '))
const shortest = engine.findOptimalPath(expr, engine.canonText(goal))
console.log('plain shortest path:', shortest.optimalSteps, 'steps, law ids:', engine.lawsUsedFromSteps(shortest.path).join(', '))
EOF
```

```text
{
  "optimalSteps": 3,
  "path": [
    {
      "law": "Distributive (POS)",
      "from": "(x + y)(x + y')",
      "to": "x + yy'"
    },
    {
      "law": "Complement Law (Product)",
      "from": "x + yy'",
      "to": "x + 0"
    },
    {
      "law": "Identity Law",
      "from": "x + 0",
      "to": "x"
    }
  ],
  "found": true
}
law ids on that path: distributive, complement, identity
plain shortest path: 3 steps, law ids: distributive, complement, identity
```

Read the result like this:

| Field | Meaning |
|---|---|
| `found` | `true` when a derivation inside the search budget reached the goal **while applying every required law**. **Check this first.** |
| `optimalSteps` | the number of steps on that derivation — this is your authored figure |
| `path[].law` | the law's **display name**, not a law id. Convert with `lawIdOf` / `lawsUsedFromSteps` (`frontend/src/engine/scoring.js:25-33`) |
| `path[].from` / `.to` | the `nodeText` rendering of each intermediate state |

`findOptimalPathWithLaws(startExpr, targetCanon, requiredLawIds, options)`
(`frontend/src/engine/solver.js:271-346`) falls through to `findOptimalPath` when `requiredLawIds` is
empty (`:274`), so a puzzle with no target laws still gets the plain shortest path. It returns
`found: false` when no derivation applies all the required laws inside the budget; the workspace then
falls back to the plain optimum (`frontend/src/state/useGameState.js:101-105`), which is why an
unsatisfiable `targetLaws` list is a content bug rather than a crash — and why the shipped content is
guarded by `frontend/src/engine/__tests__/solver.test.js:162-201`. A `found: false` result is also the
signal that a declared law may be **unappliable on every goal-route** (§7.5).

> **`optimalSteps: 0` with `found: false` does not mean "already solved".** An expression already
> equal to the goal returns `{ optimalSteps: 0, path: [], found: true }`
> (`frontend/src/engine/solver.js:180-182`); a search that ran out of budget returns
> `{ optimalSteps: 0, path: [], found: false }` (`frontend/src/engine/solver.js:237-241` for the
> plain search, `:342-346` for the objective-aware one). Always branch on `found`.

The search budget is not a magic number. Both searches default to `SOLVER_BUDGET.graded`:

```js
// frontend/src/engine/solver.js:184-185 (findOptimalPath) and :277-278 (findOptimalPathWithLaws)
const maxDepth = options.maxDepth ?? SOLVER_BUDGET.graded.maxDepth
const maxStates = options.maxStates ?? SOLVER_BUDGET.graded.maxStates
```

```js
// frontend/src/config/gameRules.js:202-210
export const SOLVER_BUDGET = {
  graded: { maxDepth: 16, maxStates: 3000 },
  generator: {
    simplestForm: { maxDepth: 12, maxStates: 8000 },
    optimalPath: { maxDepth: 12, maxStates: 12000 },
  },
}
```

Two consequences every author must know:

- The **runtime** uses exactly this default, so a puzzle whose optimum is deeper than 16 steps is
  unverifiable by the workspace: the learner still plays it, but the "optimal" figure they see is
  *your* `optimalSteps` (`frontend/src/state/useGameState.js:107-117`). The figure was 10 until the
  Module 4 guard lengthened the longest authored optimum to 14 steps.
- You may pass `{ maxDepth, maxStates }` yourself to search harder while authoring — that is how you
  derive a figure for a deep puzzle. The number that matters here is the default in
  `frontend/src/config/gameRules.js:204`, and the sandbox's larger budgets sit at `:121-132` in the
  same file. §7 of [`add-a-new-level.md`](add-a-new-level.md) shows a measured case where the
  graded budget runs out and a 16/40000 run succeeds.

The example puzzle now has **one** shortest route, the 3-step textbook chain that the scoring optimum
follows (`Distributive (POS) → Complement Law (Product) → Identity Law`); the 2-step absorption route
that used to parallel it was the Module 4 bypass. Other stages still have shortcuts, and that is the
normal shape of an authored stage, not a defect. What matters for scoring is that the route your
`targetLaws` describes is the shortest route that uses *all* of them — §9 works through the numbers.

### 7.4 Every `targetLaws` entry is a real law id

```bash
cd /home/xris/Documents/GitHub/Praxis
jq -r '[.[].id] | join(", ")' content/laws.json
```

```text
complement, idempotent, absorption, identity, annulment, distributive, double-neg, demorgan-and, demorgan-or, associative
```

Those ten ids are the only legal values. Anything else scores **0 of the 30 target-law points** for
that entry, and there is one specific id that *looks* legal and is not — see §8.

### 7.5 Every `targetLaws` entry is applied by the scoring route

This is the subtle check, so read the reason before the code.

There are two different questions hiding here, and only the first one decides whether a perfect 100 is
reachable.

**Question 1 — does the route the score is measured against apply every law you named?** Ask it with
`findOptimalPathWithLaws`: the function only returns routes that apply every required law, so
`found: true` plus all ids present in `lawsUsedFromSteps(result.path)` is the proof. Run it over the
shipped content:

```bash
cd /home/xris/Documents/GitHub/Praxis/frontend
node --input-type=module <<'EOF'
import { readFileSync } from 'node:fs'
import * as engine from './src/engine/index.js'

const levels = JSON.parse(readFileSync('../content/levels.json', 'utf8'))
let puzzles = 0, flagged = 0
for (const lv of levels) lv.puzzles.forEach((p, idx) => {
  puzzles++
  const goal = engine.canonText(engine.parseExpr(p.goal))
  const res = engine.findOptimalPathWithLaws(engine.parseExpr(p.expr), goal, p.targetLaws)
  const pathIds = engine.lawsUsedFromSteps(res.path)
  const missing = res.found ? p.targetLaws.filter(id => !pathIds.includes(id)) : p.targetLaws
  if (missing.length) {
    flagged++
    console.log(`L${lv.id}S${idx}  ${p.expr} -> ${p.goal}   not on the scoring route: ${missing.join(', ')}`)
  }
})
console.log(`--- ${flagged} of ${puzzles} shipped stages flagged by the scoring-optimum test`)
EOF
```

```text
--- 0 of 40 shipped stages flagged by the scoring-optimum test
```

**Question 2 — is a target law *earnable* at all?** This is the other check, and it is the one that
catches a law id that no route can ever apply (a typo), **and** a law that the shape rules make
unreachable on every route to the goal. A law your puzzle names can be perfectly respectable and still
never appear on the *shortest* route: from the intermediate state `y(x' + x) + z` the engine offers
exactly one move today —

```text
complement           Complement Law               => y1 + z
```

— because the other move it used to offer, `absorption => y + z`, was the Module 4 bypass. The plain
shortest route from the example puzzle's start state therefore has to render that `1` and remove it,
so `complement` and `identity` appear on it; a neighbouring route can still reach the goal without
them. The reverse case is the trap: before the guard, `Absorption Law (Product)` did the work a
textbook attributes to `complement` followed by `identity`, so a puzzle could declare `absorption` and
have no goal-route that can apply it. That is exactly what happened to four shipped stages (`2:2`,
`2:3`, `2:6`, `2:7`), whose `targetLaws` were re-authored to `["distributive","complement","identity"]`.

A naive test — "is every `targetLaws` id on the BFS shortest path?" — therefore reports false alarms:
**13 of the 40 shipped stages are flagged** against today's engine, including Level 1 *stage 2*
(`x'y + xy + xy` → `y`, whose authored `targetLaws` are `idempotent, distributive, complement` while
the shortest path is `distributive, complement, absorption` and never merges the duplicate). Those
stages are fine. The shortcut is a legitimate route; it is simply not the route the score is measured
against, and taking it forfeits the skipped laws' share of the target-law band (§9). The gate for a new
stage is Question 1 — the scoring route must apply every declared law — plus the earnability walk in
§7.6, which is the test that catches a declared law no goal-route can apply.

The verifier in §7.6 answers Question 2 by building the reachable state graph, reversing it from the
goal, and collecting the law ids offered on every state that can still reach the goal. Measured on the
shipped content it reports **0 failures out of 40**.

### 7.6 The full verifier

Save this as a file of your choice — for example `/tmp/verify-puzzle.mjs` — and run it from
`frontend/`. It checks the six keys, parse round-tripping, equivalence, `optimalSteps` against the
**scoring** optimum (`findOptimalPathWithLaws`), `targetLaws` membership, and target-law earnability,
for every stage in the file. It always exits 0, so read the summary line: `failures=0` is what you
want. (The script resolves the engine from the working directory, so it does not matter where you
keep it.)

```bash
cd /home/xris/Documents/GitHub/Praxis/frontend
node /tmp/verify-puzzle.mjs ../content/levels.json ../content/laws.json
```

Applied to the real content, before any change:

```text
---
levels=4 puzzles=40 failures=0
```

Applied to the scratch copy that has the new 13th stage appended (§6):

```text
---
levels=4 puzzles=41 failures=0
```

The script itself, complete — save it, do not retype it:

```js
/**
 * verify-puzzle.mjs - run from frontend/:  node /tmp/verify-puzzle.mjs ../content/levels.json ../content/laws.json
 */
import { readFileSync } from 'node:fs'
const E = await import(process.cwd() + '/src/engine/index.js')
const levels = JSON.parse(readFileSync(process.argv[2] || '../content/levels.json', 'utf8'))
const lawIds = new Set(JSON.parse(readFileSync(process.argv[3] || '../content/laws.json', 'utf8')).map((l) => l.id))
const REQUIRED_KEYS = ['expr', 'goal', 'targetLaws', 'hints', 'optimalSteps', 'optimalHint']
const MAX_STATES = 6000
function closure(startTree) {
  const nodes = new Map()
  nodes.set(E.canonText(startTree), { tree: startTree, laws: new Set(), edges: [] })
  const stack = [startTree]; let truncated = false
  while (stack.length) {
    if (nodes.size > MAX_STATES) { truncated = true; break }
    const tree = stack.pop(); const node = nodes.get(E.canonText(tree))
    for (const t of E.getLegalTransitions(tree)) {
      node.laws.add(t.lawId); node.edges.push(t.nextCanon)
      if (!nodes.has(t.nextCanon)) { nodes.set(t.nextCanon, { tree: t.nextTree, laws: new Set(), edges: [] }); stack.push(t.nextTree) }
    }
  }
  return { nodes, truncated }
}
function earnableLaws(nodes, targetCanon) {
  const radj = new Map()
  for (const [key, node] of nodes) for (const next of node.edges) { if (!radj.has(next)) radj.set(next, []); radj.get(next).push(key) }
  const canReach = new Set(); if (!nodes.has(targetCanon)) return canReach
  const queue = [targetCanon]; canReach.add(targetCanon)
  while (queue.length) for (const prev of radj.get(queue.shift()) || []) if (!canReach.has(prev)) { canReach.add(prev); queue.push(prev) }
  const earnable = new Set()
  for (const key of canReach) for (const id of nodes.get(key).laws) earnable.add(id)
  return earnable
}
const tidy = (s) => String(s).replace(/\s+/g, '')
let puzzles = 0, failures = 0
for (const level of levels) level.puzzles.forEach((p, idx) => {
  puzzles++
  const label = `L${level.id}S${idx}`
  const problems = []
  for (const key of REQUIRED_KEYS) if (!(key in p)) problems.push(`missing key "${key}"`)
  if (problems.length) { failures++; console.log(`${label} FAIL ${problems.join('; ')}`); return }
  const exprText = String(p.expr).trim(), goalText = String(p.goal).trim()
  const expr = E.parseExpr(exprText), goal = E.parseExpr(goalText)
  if (tidy(E.nodeText(expr)) !== tidy(exprText)) problems.push(`expr re-renders as "${E.nodeText(expr)}"`)
  if (tidy(E.nodeText(goal)) !== tidy(goalText)) problems.push(`goal re-renders as "${E.nodeText(goal)}"`)
  if (!E.isEquivalent(expr, goal)) problems.push('goal is NOT equivalent to expr')
  const targetCanon = E.canonText(goal)
  const res = E.findOptimalPathWithLaws(expr, targetCanon, p.targetLaws)
  if (!res.found) problems.push('no route reaches the goal while applying every targetLaw within the graded budget')
  else if (res.optimalSteps !== p.optimalSteps) problems.push(`optimalSteps authored=${p.optimalSteps} scoring-optimum=${res.optimalSteps}`)
  for (const id of p.targetLaws) if (!lawIds.has(id)) problems.push(`targetLaws id "${id}" is not in laws.json`)
  const { nodes, truncated } = closure(expr)
  const earnable = earnableLaws(nodes, targetCanon)
  for (const id of p.targetLaws) if (lawIds.has(id) && !earnable.has(id)) problems.push(`targetLaws id "${id}" can never be applied on a route to goal`)
  if (truncated) problems.push(`closure truncated at ${MAX_STATES} states - deep check inconclusive`)
  if (problems.length) { failures++; console.log(`${label} FAIL ${problems.join('; ')}`) }
})
console.log('---')
console.log(`levels=${levels.length} puzzles=${puzzles} failures=${failures}`)
```

The two functions to understand are `closure()` — a forward walk over every canonical state reachable
from the start expression, recording the law ids each state offers (`getLegalTransitions` returns
`lawId` directly, so no name mapping is needed) — and `earnableLaws()` — a reverse breadth-first
search from the goal over that recorded graph, then a union of the law ids on every state that can
still reach the goal. Keep the `MAX_STATES` guard: a 2-4 literal puzzle's graph is small, but a
5-literal one can be very large (a measured 60 000+ state case is in
[`add-a-new-level.md`](add-a-new-level.md) §7).

### 7.7 The API serves it — and the restart caveat

The backend loads `content/*.json` **once per process** and memoises it:

```python
# backend/repositories/content_repository.py:34-43
@lru_cache(maxsize=None)
def list_laws() -> list[dict[str, Any]]:
    """All law reference cards, in authoring order."""
    return _load("laws.json")

@lru_cache(maxsize=None)
def list_levels() -> list[dict[str, Any]]:
    """All levels with their full puzzle data."""
    return _load("levels.json")
```

> **A running backend will not see your edit until you restart it.** `list_levels()` re-reads the
> file only on a cache miss, so the process keeps serving the content it loaded at start-up. The
> same is true of the Vite dev server and its `@content` alias: the app bundles the JSON through
> `frontend/src/content/gameContent.js:14-15`, so a page refresh may keep serving the old module
> until the dev server picks the file up (restart it, or hard-refresh the page).
> `frontend/src/services/contentApi.js:13-17` additionally caches levels in a module-level `Map`
> for the lifetime of the tab.

The stale read, reproduced against the real repository module (the first line rebuilds the scratch
copy of §6, so this block is self-contained):

```bash
cd /home/xris/Documents/GitHub/Praxis
rm -rf /tmp/demo-content && mkdir -p /tmp/demo-content && cp content/levels.json content/laws.json /tmp/demo-content/
python3 - <<'PY'
import json, sys
from pathlib import Path
sys.path.insert(0, 'backend')
from repositories import content_repository as cr

print('CONTENT_DIR       :', cr.CONTENT_DIR)
print('before            :', [len(l['puzzles']) for l in cr.list_levels()])
print('second call       :', [len(l['puzzles']) for l in cr.list_levels()], cr.list_levels.cache_info())

scratch = Path('/tmp/demo-content')
levels = json.loads((scratch / 'levels.json').read_text(encoding='utf-8'))
levels[1]['puzzles'].append({'expr': 'x + xy', 'goal': 'x', 'targetLaws': ['absorption'],
                             'hints': [], 'optimalSteps': 1, 'optimalHint': 'demo'})
(scratch / 'levels.json').write_text(json.dumps(levels), encoding='utf-8')
cr.CONTENT_DIR = scratch

print('on disk           :', [len(l['puzzles']) for l in json.loads((scratch / 'levels.json').read_text(encoding='utf-8'))])
print('repository returns:', [len(l['puzzles']) for l in cr.list_levels()], '<-- STALE')
print('cache             :', cr.list_levels.cache_info())
cr.list_levels.cache_clear()
print('after cache_clear :', [len(l['puzzles']) for l in cr.list_levels()])
PY
```

```text
CONTENT_DIR       : /home/xris/Documents/GitHub/Praxis/content
before            : [4, 12, 12, 12]
second call       : [4, 12, 12, 12] CacheInfo(hits=1, misses=1, maxsize=None, currsize=1)
on disk           : [4, 13, 12, 12]
repository returns: [4, 12, 12, 12] <-- STALE
cache             : CacheInfo(hits=2, misses=1, maxsize=None, currsize=1)
after cache_clear : [4, 13, 12, 12]
```

Observed on the running dev backend before any edit:

```bash
curl -s http://127.0.0.1:8000/api/levels | jq -r '.data[] | "  id=\(.id) \(.name) puzzleCount=\(.puzzleCount)"'
```

```text
  id=0 Tutorial puzzleCount=4
  id=1 Level 1 puzzleCount=12
  id=2 Level 2 puzzleCount=12
  id=3 Level 3 — Boss puzzleCount=12
```

With the backend started against the edited content — this is what a restart gives you, verified by
booting the real app with `fastapi.testclient` pointed at the scratch copy — Level 1 reports 13:

```bash
cd /home/xris/Documents/GitHub/Praxis/backend
SUPABASE_URL=https://example.supabase.co SUPABASE_SERVICE_KEY=dummy python3 - <<'PY'
from pathlib import Path
from fastapi.testclient import TestClient
from repositories import content_repository as cr
cr.CONTENT_DIR = Path('/tmp/demo-content')   # stand-in for "I restarted the backend"
from main import app
client = TestClient(app)
for level in client.get('/api/levels').json()['data']:
    print('  id=%s %-14s puzzleCount=%s' % (level['id'], level['name'], level['puzzleCount']))
data = client.get('/api/levels/1').json()['data']
print('  GET /api/levels/1 -> puzzles=%d, puzzles[12].expr=%r' % (len(data['puzzles']), data['puzzles'][12]['expr']))
PY
```

```text
  id=0 Tutorial       puzzleCount=4
  id=1 Level 1        puzzleCount=13
  id=2 Level 2        puzzleCount=12
  id=3 Level 3 — Boss puzzleCount=12
  GET /api/levels/1 -> puzzles=13, puzzles[12].expr="(x + y)(x + y')"
```

The same request *before* the restart is still `puzzleCount=12`, and scoring the new stage fails with
a 404 until the restart — measured against the running dev backend, where stage 12 does not exist yet:

```bash
curl -s -X POST http://127.0.0.1:8000/api/score -H 'Content-Type: application/json' \
  -d '{"levelId":1,"stageIdx":12,"stepsUsed":2,"lawsUsed":["distributive"],"hintsUsed":0,"guidesUsed":0}'
```

```text
{"success":false,"data":null,"error":{"code":"not_found","message":"Stage 12 not found","detail":null}}
```

That call is submitted with `silent: true`, so the app shows the learner their locally computed score
and silently drops the server one (`frontend/src/services/scoreApi.js:31-35`,
`frontend/src/services/apiClient.js:76-78`). Nothing crashes — which is exactly why the stale-content
trap is easy to miss.

Note that the *frontend* does not need the API to see a new stage at all: `contentApi.fetchLevel`
answers from the bundled levels first and only falls back to `GET /api/levels/{id}`
(`frontend/src/services/contentApi.js:36-45`), and `useGameContent` hands the stage screen the
bundled summaries with `loading: false` (`frontend/src/state/useGameContent.js:18-22`). The API
matters for scoring and for any id that is not bundled.

### 7.8 The stage screen shows it

The stage screen renders exactly one card per puzzle in the array, and derives the rest from the
array length:

- `puzzles.map((puz, idx) => …)` — one card per stage (`frontend/src/pages/StageSelectorPage.jsx:278`)
- the card title is `Stage {idx + 1}` (`frontend/src/pages/StageSelectorPage.jsx:315-318`)
- the "Stages done" counter shows `completedSet.size / puzzles.length` (`frontend/src/pages/StageSelectorPage.jsx:184`)
- the level-progress bar is computed with `getLevelProgress(numLevelId, puzzles.length || 12)` (`frontend/src/pages/StageSelectorPage.jsx:87`)
- a stage is playable only if it is stage 0 or the previous stage is completed:
  `const isAvailable = (idx) => idx === 0 || completedSet.has(idx - 1)` (`frontend/src/pages/StageSelectorPage.jsx:56`)

So after the edit, Level 1 shows 13 cards, the progress bar's denominator is 13, and stage 13 unlocks
only after stage 12 is completed. The unlock *average* also changes meaning: it is now computed over
13 scores, not 12 (`frontend/src/state/progressStore.js:291-313`) — see
[`add-a-new-level.md`](add-a-new-level.md) §4 for the exact formula.

---

## 8. The `distributive-expand` trap

`LAW_DEFINITIONS` contains an eleventh engine law that is **not** one of the ten reference cards:

```js
// frontend/src/engine/laws/definitions.js:44
{ id: 'distributive-expand', name: 'Distributive (Expand)', formula: 'A(B + C) = AB + AC', mode: LAW_MODE.LITERAL, form: LAW_FORM.PRODUCT },
```

`lawIdOf('Distributive (Expand)')` really does return `'distributive-expand'`
(`frontend/src/engine/scoring.js:25-28` maps names through `LAW_NAME_TO_ID`,
`frontend/src/engine/laws/definitions.js:63-65`), so it passes any name-to-id sanity check. It is
still **not a valid `targetLaws` entry**, for two independent reasons — both measured:

```bash
cd /home/xris/Documents/GitHub/Praxis/frontend
node --input-type=module <<'EOF'
import * as engine from './src/engine/index.js'

console.log('lawIdOf ->', JSON.stringify(engine.lawIdOf('Distributive (Expand)')))
const expr = engine.parseExpr("x(x' + y)")
const goal = engine.parseExpr('xy')
console.log('graded  :', JSON.stringify(engine.findOptimalPath(expr, engine.canonText(goal))))
console.log('allowExpand:', JSON.stringify(engine.findOptimalPath(expr, engine.canonText(goal), { allowExpand: true })))
console.log('graded moves from start :', engine.getLegalTransitions(expr).map(t => t.lawId))
console.log('sandbox moves from start:', engine.getLegalTransitions(expr, { allowExpand: true }).map(t => t.lawId))
const scored = engine.estimateScore({ stepsUsed: 1, optimalSteps: 1, targetLaws: ['distributive-expand'], lawsUsed: ['absorption'], hintsUsed: 0 })
console.log('score with that id as a target ->', JSON.stringify({ targetLaw: scored.targetLaw, total: scored.total }))
EOF
```

```text
lawIdOf -> "distributive-expand"
graded  : {"optimalSteps":0,"path":[],"found":false}
allowExpand: {"optimalSteps":3,"path":[{"law":"Distributive (Expand)","from":"x(x' + y)","to":"xx' + xy"},{"law":"Complement Law (Product)","from":"xx' + xy","to":"0 + xy"},{"law":"Identity Law","from":"0 + xy","to":"xy"}],"found":true}
graded moves from start : []
sandbox moves from start: [ 'distributive-expand' ]
score with that id as a target -> {"targetLaw":0,"total":70}
```

That `allowExpand` route is three steps now, not two: it used to finish with a one-step
`Absorption Law` that swallowed `xx'`, and the Module 4 guard replaced that with
`Complement Law (Product)` → `0 + xy`, then `Identity Law` → `xy`. The conclusion is unchanged — the
expand law is a sandbox convenience, not a graded route.

1. It is not in `content/laws.json` (§7.4 lists all ten ids), so `GET /api/laws` never shows it and
   the target-law band can never match it: `estimateScore` with
   `targetLaws: ['distributive-expand']` and a real graded derivation returns **`targetLaw: 0`**.
2. The graded workspace never offers it. `options.allowExpand` is `false` by default
   (`frontend/src/engine/laws/index.js:33-34`), and the graded flow passes no options: a stage whose
   only route needs the expand law is **unsolvable**, as the empty move list above shows.

The expand law exists for the Sandbox, where the learner may type a product of a literal and a
clause (`frontend/src/engine/sandbox/input.js:151-153`, `:196-197`). If a graded puzzle of yours
seems to need it, the puzzle is wrong, not the engine: rewrite it so the goal is reachable by
simplification (see the two derivation directions in
[`../../06-reference/boolean-laws.md`](../../06-reference/boolean-laws.md)).

---

## 9. Which route earns the target-law credit

The three scoring bands are 40 (efficiency) / 30 (target laws) / 30 (hint independence)
(`frontend/src/config/gameRules.js:13-18`, mirrored by
`backend/services/scoring_service.py:99-115`), and the target-law band is proportional:
`30 × |targetLaws ∩ lawsUsed| / |targetLaws|` (`backend/services/scoring_service.py:99-107`).

For the worked example — `targetLaws: ["distributive", "complement", "identity"]`, and therefore
`optimalSteps: 3` (§7.3) — there is now exactly **one** shortest route, and the arithmetic shows what
the target-law band is worth. The second row is the route the engine *used to* offer, kept only to
show what it was worth:

```bash
cd /home/xris/Documents/GitHub/Praxis/frontend
node --input-type=module <<'EOF'
import * as engine from './src/engine/index.js'

const targetLaws = ['distributive', 'complement', 'identity']
const routes = {
  'textbook 3-step route': [{ law: 'Distributive (POS)' }, { law: 'Complement Law' }, { law: 'Identity Law' }],
  'removed 2-step shortcut': [{ law: 'Distributive (POS)' }, { law: 'Absorption Law' }],
}
for (const [label, steps] of Object.entries(routes)) {
  const r = engine.estimateScore({
    stepsUsed: steps.length, optimalSteps: 3, targetLaws, lawsUsed: engine.lawsUsedFromSteps(steps),
  })
  console.log(label.padEnd(26), 'total=' + r.total, 'earnedPoints=' + r.earnedPoints, 'targetLaw=' + r.targetLaw, 'efficiency=' + r.efficiency)
}
// proof the shortcut is gone: the only move from the intermediate state is Complement
console.log("moves at x + yy' :", engine.getLegalTransitions(engine.parseExpr("x + yy'")).map(t => t.law).join(', '))
EOF
```

```text
textbook 3-step route      total=100 earnedPoints=5 targetLaw=30 efficiency=40
removed 2-step shortcut    total=80 earnedPoints=4 targetLaw=10 efficiency=40
moves at x + yy' : Complement Law (Product)
```

Read that honestly. The `removed 2-step shortcut` row is arithmetic on a route the engine **no longer
offers**: `Absorption` cannot swallow `yy'`, because that clause is the constant `0` and the proposal's
Module 4 requires the constant to be rendered (`x + 0`) before Identity removes it. A learner cannot
take it; the row exists only to show what the shortcut was worth. The textbook route earns both bands
in full and reaches `100`. **The general rule still holds wherever a shortcut is legal**: a route that
reaches the goal in fewer steps while skipping a declared law keeps the full 40 efficiency points and
forfeits that law's share of the target-law band (10 points per law when three are declared). The live
case is Tutorial stage 0.2 (`(x + y)' + x'y'` → `x'y'`, `targetLaws: ["demorgan-or","idempotent"]`,
optimum 2): its 1-step absorption route scores **70** — full efficiency, zero target-law credit — while
the taught 2-step route scores **100**
([scoring-and-rewards.md §W9](../../06-reference/scoring-and-rewards.md#w9--the-taught-route-is-now-the-only-route-tutorial-stage-1)
has the full table). It is also why §7.5's Question 1 — "does the scoring route apply every target
law?" — is the correct gate for a new stage, with Question 2 as the reachability backstop.

> **Observed frontend/backend rounding difference.** With `total = 90.0`, the backend returns
> `earnedPoints: 4` (`round(4.5)` in Python rounds half to even —
> `backend/services/scoring_service.py:55`) while the client-side mirror predicts `5`
> (`Math.round(4.5)` — `frontend/src/engine/scoring.js:80`). The backend is authoritative and its
> value replaces the local one when it arrives (`frontend/src/components/puzzle/usePuzzleSession.js:208-212`),
> so the learner may see the estimate change by one point. Content authoring does not depend on this,
> but do not be surprised by it when you test a stage.

---

## 10. Checklist

Copy this into your pull request description and tick every line.

| # | Check | Command / evidence |
|---|---|---|
| 1 | The stage is the last element of the level's `puzzles` array | `jq '.[1].puzzles[12]' content/levels.json` |
| 2 | The object has exactly the six keys | `jq -c '[.[] \| .puzzles[] \| keys] \| unique' content/levels.json` → one array |
| 3 | `expr` and `goal` round-trip through the parser | §7.2 |
| 4 | `goal` is equivalent to `expr` | §7.2 (`isEquivalent`) |
| 5 | `found: true` and `optimalSteps` matches the **scoring** optimum (`findOptimalPathWithLaws`), not the raw shortest path | §7.3 |
| 6 | Every `targetLaws` id is one of the ten in `content/laws.json` | §7.4 |
| 7 | Every `targetLaws` id is applied by the scoring route (§7.5, Question 1) and earnable on some route to the goal (§7.6 verifier) | §7.5, §7.6 |
| 8 | The full verifier says `failures=0` | §7.6 |
| 9 | The backend was restarted before checking the API | §7.7 |
| 10 | `GET /api/levels` `puzzleCount` went up by one | §7.7 |
| 11 | The stage screen shows the new card and the right denominator | §7.8 |
| 12 | `allowExpand` is **not** set on the new stage | §2 |

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `jq` shows two key arrays | a misspelled or extra key | use exactly `expr, goal, targetLaws, hints, optimalSteps, optimalHint` |
| Solver returns `found: false` and `optimalSteps: 0` | the goal is unreachable by simplification inside the graded budget, or **no route applies every `targetLaws` id** — including a law that no goal-route can apply at all | check equivalence first; confirm each target law is earnable (§7.5, §7.6); if the textbook route needs `distributive-expand`, rewrite the puzzle (§8) |
| Verifier says `optimalSteps authored=N scoring-optimum=M` | you counted the raw shortest path instead of the shortest route that applies every target law | author the scoring optimum (§7.3); a legal shortcut still earns full efficiency, but it forfeits the skipped laws' target-law credit (§9) |
| Verifier says `targetLaws id "X" is not in laws.json` | typo, or you used `distributive-expand` | §7.4, §8 |
| Verifier says a target law "can never be applied on a route to goal" | the law is not reachable before the goal — e.g. `idempotent` on a puzzle with no duplicates, or `absorption` on a stage whose only absorption route was the Module 4 constant collapse (the `2:2`/`2:3`/`2:6`/`2:7` trap) | either name laws the derivation can actually use, or change the puzzle (§7.5) |
| The API still returns the old `puzzleCount` | `lru_cache` (§7.7) | restart the backend |
| The stage screen still shows 12 cards after a refresh | Vite served the old bundled module | restart the dev server, or hard-refresh |
| Scoring the new stage returns `not_found` | the backend is serving cached content | restart the backend |
| You scored the wrong puzzle | a negative `stageIdx` resolved Python-style | fix the index; §4 warning |

---

**Next:** [`add-a-new-law.md`](add-a-new-law.md) — if the puzzle you want to write needs a law that
does not exist yet. [`add-a-new-level.md`](add-a-new-level.md) — if the puzzle needs a level that does
not exist yet. [`../../04-api/API-REFERENCE.md`](../../04-api/API-REFERENCE.md) — the exact request and
response shapes of `/api/levels` and `/api/score`.
