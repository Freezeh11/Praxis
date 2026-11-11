# How to add a new level to Praxis

**What this is:** the complete procedure for adding a new *level* — a card on `/levels` with its own
stage list — to Praxis, and for understanding what the game will and will not do with it: how it is
numbered, how it appears, how it unlocks, and exactly which parts of a five-variable level work
today.
**Who it's for:** a new contributor with zero prior context. You need a terminal, Node.js, `jq` and
Python 3. Every number in this guide was measured against the real code; the commands are runnable
as written.

> Read [`add-a-new-problem.md`](add-a-new-problem.md) first — a level is mostly a container for
> stages, and that guide covers the per-puzzle contract in detail.

## Contents

1. [The level object and its five keys](#1-the-level-object-and-its-five-keys)
2. [Numbering: ids are 0-based and 0 is the Tutorial](#2-numbering-ids-are-0-based-and-0-is-the-tutorial)
3. [`varCount` — what it does, and what it does not do](#3-varcount--what-it-does-and-what-it-does-not-do)
4. [How the level appears, unlocks and is gated](#4-how-the-level-appears-unlocks-and-is-gated)
5. [How many stages is conventional](#5-how-many-stages-is-conventional)
6. [Worked example: append a new level](#6-worked-example-append-a-new-level)
7. [A five-variable level: what works and what does not](#7-a-five-variable-level-what-works-and-what-does-not)
8. [The restart caveat (both servers)](#8-the-restart-caveat-both-servers)
9. [Checklist](#9-checklist)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. The level object and its five keys

A level is one object in the top-level array of `content/levels.json`. Its keys are **exactly** these
five, in every shipped level:

```bash
cd /home/xris/Documents/GitHub/Praxis
jq -c '[.[] | keys] | unique' content/levels.json
```

```text
[["desc","id","name","puzzles","varCount"]]
```

| Key | Type | Who reads it | Evidence |
|---|---|---|---|
| `id` | number | identifies the level everywhere: `/api/levels/{id}`, the route `/level/:levelId/stages`, and the progress keys `"<levelId>:<stageIdx>"` | `backend/repositories/content_repository.py:60-62`, `frontend/src/state/progressStore.js:209-215` |
| `name` | string | the level card title and the stage-screen badge | `frontend/src/pages/LevelSelectPage.jsx:296`, `frontend/src/pages/StageSelectorPage.jsx:148` |
| `desc` | string | the card subtitle and the stage-screen paragraph | `frontend/src/pages/LevelSelectPage.jsx:297`, `frontend/src/pages/StageSelectorPage.jsx:160` |
| `varCount` | number | display metadata only — see §3 | `backend/repositories/content_repository.py:53`, `frontend/src/pages/StageSelectorPage.jsx:151` |
| `puzzles` | array of stage objects | the stage list; each element follows the six-key contract in [`add-a-new-problem.md`](add-a-new-problem.md) | `backend/services/content_service.py:39-42`, `frontend/src/pages/StageSelectorPage.jsx:278` |

The backend projects this object into the summary that `GET /api/levels` returns — dropping
`puzzles` and adding a count:

```python
# backend/repositories/content_repository.py:46-57
def list_level_summaries() -> list[dict[str, Any]]:
    """Level metadata without puzzle detail — the shape of GET /api/levels."""
    return [
        {
            "id": level["id"],
            "name": level["name"],
            "desc": level["desc"],
            "varCount": level["varCount"],
            "puzzleCount": len(level["puzzles"]),
        }
        for level in list_levels()
    ]
```

The frontend builds the same projection at bundle time and its comment requires the two to stay
identical (`frontend/src/content/gameContent.js:21-28`). Because both use direct indexing, a
**missing key is a hard failure**: removing `varCount` from one level makes `GET /api/levels` answer
`HTTP 500` (measured with the real app; `KeyError` is not one of the handled `AppError` types in
`backend/main.py`).

---

## 2. Numbering: ids are 0-based and 0 is the Tutorial

Level `id`s are **0-based**, and id `0` is the Tutorial — a real level with real puzzles, not a
special case in the data:

```bash
jq -r '[.[].id] | join(", ")' content/levels.json
```

```text
0, 1, 2, 3
```

The convention is pinned in configuration as well, so it is not something you can change by editing
the JSON alone:

```js
// frontend/src/config/gameRules.js:81-85
/** Tutorial identity. The tutorial is a real level, so these must match content. */
export const TUTORIAL = {
  levelId: 0,
  stageIndexes: [0, 1, 2, 3],
}
```

**A new level must not collide with `0`, `1`, `2` or `3`.** The next free id is therefore `4`.
Uniqueness matters more than it looks, because different consumers resolve a duplicate id
differently:

| Consumer | Duplicate-id behaviour | Evidence |
|---|---|---|
| Backend `get_level` | first match wins | `backend/repositories/content_repository.py:60-62` (`next(...)`) |
| Frontend level cache | **last** entry wins (the cache is filled by a loop over the array) | `frontend/src/services/contentApi.js:13-17` |
| Progress keys | collide silently — `"4:0"` means one stage, whichever level you meant | `frontend/src/state/progressStore.js:209-215` |

So a duplicate id makes the backend and the app disagree about which level you are playing. Check
before you commit:

```bash
jq -r '[.[].id] | length == (unique | length)' content/levels.json   # must print true
```

The order of the cards on `/levels` is the **file order** of the array: the level-select screen
renders `[...levels, SANDBOX_LEVEL]` in array order, with the always-present Sandbox card last
(`frontend/src/pages/LevelSelectPage.jsx:51`). Appending your level at the end of the JSON puts it
between Level 3 and Sandbox.

---

## 3. `varCount` — what it does, and what it does not do

`varCount` is **display metadata**. These are all of its consumers in the whole repository
(measured with a repository-wide search; the sandbox's own `varCount` values are a separate
mechanism):

| Site | What it does with the number |
|---|---|
| `backend/repositories/content_repository.py:53` | copies it into the `/api/levels` summary unchanged |
| `frontend/src/content/gameContent.js:22-26` | copies it into the bundled summary |
| `frontend/src/pages/StageSelectorPage.jsx:151` | renders `"{level.varCount}-Variable Logic"` next to the level badge |

**No code validates your puzzles against `varCount`.** Nothing counts the literals in `expr` and
compares them with the level's `varCount`, in the engine, the backend or the UI. A level that
declares `varCount: 2` and ships a four-literal puzzle will play exactly like a four-literal puzzle.
Set it to the number the learner should expect, and keep it honest — it is the only place that tells
them how wide the level is.

The number that *is* enforced is a different one: `SANDBOX.maxVariables = 4`
(`frontend/src/config/gameRules.js:110-112`). That is the **Sandbox** ceiling — the place where a
learner types their own expression — not a limit on graded levels. §7 goes through both.

---

## 4. How the level appears, unlocks and is gated

There are three independent gates in front of a level. Understanding which one applies where is the
whole trick to adding a level that behaves.

**Gate 1 — the tutorial gate (route level).** Every graded route is wrapped in `TutorialGate`, which
redirects any learner who has not finished the four tutorial stages to the tutorial:

```jsx
// frontend/src/components/TutorialGate.jsx:61-62
// Graded levels (1-3) and Sandbox strictly require full tutorial completion.
if (!hasCompletedTutorial) {
```

The only exempt level is the tutorial itself (`frontend/src/components/TutorialGate.jsx:41-43`), and
every non-tutorial route is wrapped (`frontend/src/App.jsx:40-53`). A new level id `4` inherits this
gate automatically: it is playable only after the tutorial is complete.

**Gate 2 — the level card gate (per-id, hardcoded).** The level-select screen decides whether a card
is locked in `getLockState`, and it names the levels by id:

- id `0` — always unlocked (`frontend/src/pages/LevelSelectPage.jsx:78`)
- id `1` — tutorial gate, re-stated for the card (`:80-92`)
- id `2` — requires `getLevelProgress(1, …).unlocked` (`:94-106`)
- id `3` — requires `getLevelProgress(2, …).unlocked` (`:108-120`)
- **anything else — unlocked** (`:122`, `return { locked: false, reason: '' }`)

So a new level `4` appears **unlocked** as soon as the tutorial is done. It is not gated behind
Level 3's average score, and no other level becomes gated behind it. If you want the usual
"previous level mastered" gate for it, that is a code change in `getLockState`, not a content change.
Note also that the "Coming Soon" list is empty — the comment mentions Level 4+, but the array is
`[]` (`frontend/src/pages/LevelSelectPage.jsx:19-20`, `:76`).

**Gate 3 — the unlock rule itself (the 80 % rule).** Wherever the unlock rule *is* consulted, it is
this function and no other:

```js
// frontend/src/state/progressStore.js:291-309 (abridged)
export function getLevelProgress(state, levelId, totalStages) {
  const scores = []
  let totalStars = 0
  for (let i = 0; i < totalStages; i++) {
    const score = state.stageScores[`${levelId}:${i}`] ?? null
    scores.push(score)
    const done = isStageCompleted(state, levelId, i) || score !== null
    if (done) totalStars += score === null ? 1 : starsForScore(score)
  }
  const completed = scores.filter((score) => score !== null).length
  const avgScore = completed === 0 ? 0 : Math.round(scores.reduce((sum, score) => sum + (score ?? 0), 0) / totalStages)
  const allDone = completed === totalStages
  return { completed, avgScore, allDone, unlocked: allDone && avgScore >= UNLOCK_AVERAGE_SCORE, totalStars, maxStars: totalStages * MAX_STARS_PER_STAGE }
}
```

Read it precisely, because the wording matters:

- **"every stage done" means every stage has a recorded score**, not merely a completion flag:
  `completed` counts non-null `stageScores` entries (`:300`), and `allDone` requires
  `completed === totalStages` (`:304`).
- **`avgScore` is `round(sum of scores / totalStages)`** — divided by the *total* stage count, then
  rounded to an integer (`:301-303`).
- **`unlocked` is `allDone && avgScore >= UNLOCK_AVERAGE_SCORE`** (`:309`), where the threshold is
  `UNLOCK_AVERAGE_SCORE = 80` (`frontend/src/config/gameRules.js:48-49`).
- The `totalStages` argument comes from the real puzzle count:
  `getLevelProgress(numLevelId, puzzles.length || 12)` (`frontend/src/pages/StageSelectorPage.jsx:87`),
  and `lvl1?.puzzleCount ?? 12` on the level-select screen (`frontend/src/pages/LevelSelectPage.jsx:96`).

Two consequences for a new level:

- **The denominator is your stage count.** A 13-stage level needs all 13 stages scored with
  `avgScore >= 80` before `getLevelProgress(...).unlocked` becomes true — which is what gates the
  *next* level for the shipped ids 2 and 3 (`frontend/src/pages/LevelSelectPage.jsx:94-120`). The
  displayed "Stages done" counter on the stage screen uses a different source (`completedSet.size`,
  i.e. the completion flags — `frontend/src/pages/StageSelectorPage.jsx:184`), so the two numbers can
  disagree: a stage can be flagged complete with `best_score` 0 and then never appear in
  `stageScores`, which is exactly the guard in `backend/services/progress_service.py:41-42`.
- **Never ship an empty `puzzles` array.** With `puzzles.length === 0` the stage screen falls back to
  `0 || 12` and shows a progress bar over 12 stages with no stage cards at all
  (`frontend/src/pages/StageSelectorPage.jsx:87`, `:278`). The card would render with
  `puzzleCount: 0`.

**Inside a level, stages unlock sequentially**: stage 0 is always available, every later stage needs
its immediate predecessor completed
(`const isAvailable = (idx) => idx === 0 || completedSet.has(idx - 1)`, `frontend/src/pages/StageSelectorPage.jsx:56`).

**Cosmetic labels for a new id.** The stage screen calls any level with `numLevelId >= 3` a "max
level" and switches its progress banner to a mastery banner (`frontend/src/pages/StageSelectorPage.jsx:88`,
`:213`, `:233-246`), so a new level `4` shows "Level 4 Mastery" rather than a "Level 5 Unlock Gate".
No functionality depends on it.

---

## 5. How many stages is conventional

The shipped shape, measured:

```bash
cd /home/xris/Documents/GitHub/Praxis
jq -r '.[] | "id=\(.id)  \(.name)  varCount=\(.varCount)  puzzles=\(.puzzles|length)"' content/levels.json
jq -r '[.[] | .puzzles | length] as $c | "per-level \($c|join(","))   total \($c|add)"' content/levels.json
```

```text
id=0  Tutorial  varCount=2  puzzles=4
id=1  Level 1  varCount=2  puzzles=12
id=2  Level 2  varCount=3  puzzles=12
id=3  Level 3 — Boss  varCount=4  puzzles=12
per-level 4,12,12,12   total 40
```

- **Tutorial (id 0): 4 stages.** The count is pinned in code — `TUTORIAL.stageIndexes` is
  `[0, 1, 2, 3]` (`frontend/src/config/gameRules.js:82-85`), and the tutorial gate tests those four
  indices. **Do not change the tutorial's stage count.**
- **Levels 1-3: 12 stages each.** The number is not pinned anywhere; it is a convention that gives
  six *dual pairs* per level — a SOP stage followed by its POS dual, which is what the level screen
  advertises ("Every Boolean theorem exists as a dual pair — practice both Sum of Products (SOP) and
  Product of Sums (POS)", `frontend/src/pages/StageSelectorPage.jsx:160`).
- **Total: 40 stages** (4 + 12 + 12 + 12). Match the 12-stage convention for a new level unless you
  have a reason not to; the stage grid lays out four cards per row on desktop
  (`frontend/src/pages/StageSelectorPage.jsx:277`), so 12 fills three clean rows.

The stage screen adapts to any count, so a 6- or 14-stage level will work — it will simply look
different and unlock with a different denominator.

---

## 6. Worked example: append a new level

This example adds **Level 4 — Five Variables** with two stages, deliberately small so the command
stays short; a shippable level follows the 12-stage convention from §5. Both stages were verified
with the real engine (see the output below).

Save this as `/tmp/new-level.json`:

```json
{
  "id": 4,
  "name": "Level 4 — Five Variables",
  "desc": "Five-variable expressions (SOP & POS dual pairs)",
  "varCount": 5,
  "puzzles": [
    {
      "expr": "vwx + vw'x",
      "goal": "vx",
      "targetLaws": ["distributive", "complement", "identity"],
      "hints": [
        "Both terms contain v and x.",
        "Distributive Law factors vx out of the two terms: vx(w + w').",
        "w + w' is 1 by the Complement Law, and vx · 1 is vx by the Identity Law."
      ],
      "optimalSteps": 3,
      "optimalHint": "Factor vx out of both terms, then let the Complement Law turn w + w' into 1."
    },
    {
      "expr": "(v + w + x' + y + z)(v + w + x + y + z)",
      "goal": "v + w + y + z",
      "targetLaws": ["distributive", "complement", "identity"],
      "hints": [
        "The two clauses differ only in x' and x.",
        "Dual Distributive Law joins clauses that share a common part.",
        "The Complement Law removes the x term once x and x' meet."
      ],
      "optimalSteps": 5,
      "optimalHint": "Join the two clauses with the dual Distributive Law and let the Complement Law clear the x term."
    }
  ]
}
```

Append it and check the shape (the copy in `/tmp/demo-content` is this guide's scratch workspace;
redirect over `content/levels.json` via a temp file and `mv` to apply the change for real):

```bash
cd /home/xris/Documents/GitHub/Praxis
mkdir -p /tmp/demo-content && cp content/levels.json content/laws.json /tmp/demo-content/
jq --slurpfile level /tmp/new-level.json '. + $level' content/levels.json > /tmp/demo-content/levels.json

echo "ids BEFORE:      $(jq -r '[.[].id] | join(", ")' content/levels.json)"
echo "ids AFTER:       $(jq -r '[.[].id] | join(", ")' /tmp/demo-content/levels.json)"
echo "shape BEFORE:    $(jq -r '[.[] | .puzzles | length] as $c | "levels=\(length) per-level \($c|join(",")) total \($c|add)"' content/levels.json)"
echo "shape AFTER:     $(jq -r '[.[] | .puzzles | length] as $c | "levels=\(length) per-level \($c|join(",")) total \($c|add)"' /tmp/demo-content/levels.json)"
```

```text
ids BEFORE:      0, 1, 2, 3
ids AFTER:       0, 1, 2, 3, 4
shape BEFORE:    levels=4 per-level 4,12,12,12 total 40
shape AFTER:     levels=5 per-level 4,12,12,12,2 total 42
```

Verify the new stages with the same verifier the problem guide publishes (save it as
`/tmp/verify-puzzle.mjs` — the full listing is in
[`add-a-new-problem.md`](add-a-new-problem.md) §7.6), then confirm the API serves the level after a
restart:

```bash
cd /home/xris/Documents/GitHub/Praxis/frontend
node /tmp/verify-puzzle.mjs /tmp/demo-content/levels.json /tmp/demo-content/laws.json
```

```text
---
levels=5 puzzles=42 failures=0
```

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
    print('  id=%s %-24s varCount=%s puzzles=%s' % (level['id'], level['name'], level['varCount'], level['puzzleCount']))
data = client.get('/api/levels/4').json()['data']
print('  GET /api/levels/4 -> keys=%s puzzles=%d first=%r' % (list(data.keys()), len(data['puzzles']), data['puzzles'][0]['expr']))
PY
```

```text
  id=0 Tutorial                 varCount=2 puzzles=4
  id=1 Level 1                  varCount=2 puzzles=12
  id=2 Level 2                  varCount=3 puzzles=12
  id=3 Level 3 — Boss           varCount=4 puzzles=12
  id=4 Level 4 — Five Variables varCount=5 puzzles=2
  GET /api/levels/4 -> keys=['id', 'name', 'desc', 'varCount', 'puzzles'] puzzles=2 first="vwx + vw'x"
```

(Access-log lines are emitted on stdout during that run and are elided here; `TestClient` is the
same app object `uvicorn main:app` serves, so a real restart produces the same payloads.)

Both stages of the new level solve comfortably inside the graded budget (3 and 5 steps). The third
candidate in §7 is the one that does not — it is there to show you where the boundary is.

---

## 7. A five-variable level: what works and what does not

`varCount: 5` is not blocked anywhere. The engine is literal-count agnostic — `extractVariables`
walks any tree (`frontend/src/engine/equivalence.js:11-22`), `isEquivalent` is a truth table over
2ⁿ rows (`:45-58`), and rendering, scoring, progress and the level card all work from strings and
numbers. What breaks is the **search budget**, and only for puzzles that are genuinely large.

Measure it yourself:

```bash
cd /home/xris/Documents/GitHub/Praxis/frontend
node --input-type=module <<'EOF'
import * as engine from './src/engine/index.js'

const candidates = [
  ["vwx + vw'x", 'vx'],
  ["(v + w + x' + y + z)(v + w + x + y + z)", 'v + w + y + z'],
  ["v'wxy'z + v'wxyz + vwxy'z + vwxyz", 'wxz'],
]
for (const [exprText, goalText] of candidates) {
  const expr = engine.parseExpr(exprText)
  const target = engine.canonText(engine.parseExpr(goalText))
  const graded = engine.findOptimalPath(expr, target)
  const raised = engine.findOptimalPath(expr, target, { maxDepth: 20, maxStates: 40000 })
  console.log(exprText + '  ->  ' + goalText)
  console.log('   literals:', engine.extractVariables(expr).join(''),
              ' graded(16/3000): found=' + graded.found + ' steps=' + graded.optimalSteps,
              ' raised(20/40000): found=' + raised.found + ' steps=' + raised.optimalSteps)
}
EOF
```

```text
vwx + vw'x  ->  vx
   literals: vwx  graded(16/3000): found=true steps=4  raised(20/40000): found=true steps=4
(v + w + x' + y + z)(v + w + x + y + z)  ->  v + w + y + z
   literals: vwxyz  graded(16/3000): found=true steps=6  raised(20/40000): found=true steps=6
v'wxy'z + v'wxyz + vwxy'z + vwxyz  ->  wxz
   literals: vwxyz  graded(16/3000): found=false steps=0  raised(20/40000): found=true steps=17
```

The third case is the one to plan around. The graded budget is `{ maxDepth: 16, maxStates: 3000 }`
(`frontend/src/config/gameRules.js:204`) — and `maxStates` counts *transitions explored*, not states
stored (`frontend/src/engine/solver.js:201-206`), so it is exhausted long before 3000 distinct
intermediate states are seen: that puzzle's reachable state graph contains 2499 canonical states and
the search still returns `found: false`. It is also **deep**: since the Module 4 guard put every
complement constant back into the derivation, its optimum is 17 steps, so a raised run needs
`maxDepth` at least 20 as well as the larger state budget — the default depth of 16 fails even with
40 000 states. A larger variant of the same shape
(`v'wx'y'z + v'wx'yz + v'wxy'z + v'wxyz + vwx'y'z + vwx'yz + vwxy'z + vwxyz`) has a graph larger than
60 000 states and needs the raised budget too.

What happens in the game when the runtime solver cannot find the path:

```js
// frontend/src/state/useGameState.js:88-95
const solverRes = findOptimalPath(parsedExpr, gCanon, { allowExpand })
if (solverRes.found && solverRes.optimalSteps > 0) {
  setOptimalSteps(solverRes.optimalSteps)
  setOptimalPath(solverRes.path)
} else {
  setOptimalSteps(puzzle.optimalSteps || 0)
  setOptimalPath([])
}
```

So the stage is **still playable** — the engine, the laws and the goal check do not need the solver —
but the "optimal" figure the learner sees is your authored `optimalSteps`, unverified at runtime. The
consequences to weigh:

- Your number must be right, and you must derive it with a raised budget
  (`{ maxDepth: 16, maxStates: 40000 }` is the larger of the two sandbox budgets,
  `frontend/src/config/gameRules.js:121-132`), because the default run will not confirm it.
- The published verifier ([`add-a-new-problem.md`](add-a-new-problem.md) §7.6) uses the graded
  default and will flag such a stage with `solver found no path within the graded budget`. That flag
  is information, not necessarily a defect — decide deliberately and say so in your pull request.
- Keep five-variable puzzles to a handful of terms. The two-clause POS form above verifies in
  milliseconds; the four-term SOP form does not.

The Sandbox has a second, separate ceiling:

```bash
cd /home/xris/Documents/GitHub/Praxis/frontend
node --input-type=module <<'EOF'
import * as engine from './src/engine/index.js'

console.log('MAX_SANDBOX_VARS =', engine.MAX_SANDBOX_VARS)
console.log('validateSandboxInput("v + w + x + y + z")   ->', JSON.stringify(engine.validateSandboxInput('v + w + x + y + z')))
console.log('validateSandboxInput(..., {maxVariables: 6}) ->', JSON.stringify(engine.validateSandboxInput('v + w + x + y + z', { maxVariables: 6 })))
console.log('buildSandboxPuzzle("v + w + x + y + z")     ->', JSON.stringify(engine.buildSandboxPuzzle('v + w + x + y + z')))
EOF
```

```text
MAX_SANDBOX_VARS = 4
validateSandboxInput("v + w + x + y + z")   -> {"valid":false,"error":"Sandbox supports up to 4 variables. Your expression uses 5.","errorCode":"too-many-vars"}
validateSandboxInput(..., {maxVariables: 6}) -> {"valid":true,"error":null,"errorCode":null}
buildSandboxPuzzle("v + w + x + y + z")     -> {"ok":false,"errorCode":"too-many-vars","error":"Sandbox supports up to 4 variables. Your expression uses 5."}
```

- `MAX_SANDBOX_VARS` is literally `SANDBOX.maxVariables` (`frontend/src/engine/sandbox/input.js:48`,
  `frontend/src/config/gameRules.js:110-112`), and the Sandbox screen renders that same number as
  help text (`frontend/src/pages/SandboxPage.jsx:71`, `:353`). A learner therefore cannot type a
  five-literal expression in the Sandbox; the ceiling is per *distinct literal*,
  `frontend/src/engine/sandbox/validate.js:186-194`.
- The engine itself has no fixed ceiling — every entry point takes the budget per call, and the
  option exists precisely so a caller can raise it (the test suite proves it:
  `frontend/src/engine/__tests__/sandbox.test.js:121-135`). `SandboxPage` does not pass the option,
  so the shipped UI is capped at 4.
- Random practice is capped at four literals as well: the generator's literal pool is
  `VAR_POOL_COMPLEX = ['w', 'x', 'y', 'z']` (`frontend/src/engine/sandbox/generator.js:30`), and the
  Sandbox level card is hardcoded to `varCount: 4` (`frontend/src/pages/LevelSelectPage.jsx:32`).

**Summary for a five-variable level:** the graded flow works; author short puzzles, derive
`optimalSteps` with a raised budget, expect the graded verifier to flag any stage deeper than the
graded budget, and know that your level's fifth literal cannot be practised in the Sandbox without a
one-line change to `SANDBOX.maxVariables`.

---

## 8. The restart caveat (both servers)

Content is loaded once and memoised by the backend, and bundled by the frontend. Neither picks up an
edit to `content/levels.json` while it is running:

```python
# backend/repositories/content_repository.py:34-43
@lru_cache(maxsize=None)
def list_levels() -> list[dict[str, Any]]:
    """All levels with their full puzzle data."""
    return _load("levels.json")
```

> **After editing content, restart the backend and the Vite dev server.** A running backend keeps
> serving the levels it loaded at start-up (`list_levels()` only re-reads on a cache miss), so
> `GET /api/levels` and `POST /api/score` will not know about your new level — scoring it returns
> `404 {"code":"not_found"}`, which the app swallows silently because score submission is
> `silent: true` (`frontend/src/services/scoreApi.js:31-35`). The Vite dev server has the same
> staleness problem for the `@content` alias (`frontend/vite.config.js:16`,
> `frontend/src/content/gameContent.js:14-15`), and `frontend/src/services/contentApi.js:13-17`
> caches levels in a module-level `Map` for the lifetime of the tab — so restart the dev server (or
> hard-refresh) after the edit.

The mechanism, reproduced against the real repository module:

```bash
cd /home/xris/Documents/GitHub/Praxis
python3 - <<'PY'
import sys
sys.path.insert(0, 'backend')
from repositories import content_repository as cr

print('first call  :', [len(l['puzzles']) for l in cr.list_levels()])
print('second call :', [len(l['puzzles']) for l in cr.list_levels()], cr.list_levels.cache_info())
cr.list_levels.cache_clear()   # what a process restart does
print('after clear :', [len(l['puzzles']) for l in cr.list_levels()])
PY
```

```text
first call  : [4, 12, 12, 12]
second call : [4, 12, 12, 12] CacheInfo(hits=1, misses=1, maxsize=None, currsize=1)
after clear : [4, 12, 12, 12]
```

`hits=1` after the second call is the proof: the file was read once. The full demonstration — edit
the JSON, watch the repository keep returning the old array, then `cache_clear()` — is in
[`add-a-new-problem.md`](add-a-new-problem.md) §7.7.

---

## 9. Checklist

| # | Check | Command / evidence |
|---|---|---|
| 1 | The id is free and the array is a single JSON array | `jq -r '[.[].id] \| length == (unique \| length)' content/levels.json` → `true` |
| 2 | The object has exactly `id, name, desc, varCount, puzzles` | `jq -c '[.[] \| keys] \| unique' content/levels.json` → one array |
| 3 | `id` is `4` (not `0`-`3`) | §2 |
| 4 | `varCount` matches what learners should expect | §3 |
| 5 | 12 stages, in dual pairs, following the six-key puzzle contract | §5, [`add-a-new-problem.md`](add-a-new-problem.md) |
| 6 | Every stage passes the verifier | §6 |
| 7 | For a five-variable level, `optimalSteps` was derived with a raised budget | §7 |
| 8 | The backend and the dev server will be restarted after the merge/deploy | §8 |
| 9 | You decided deliberately whether the new level needs a score gate in `getLockState` | §4 |

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/levels` shows one level twice, or the wrong stages open | duplicate `id` | backends resolve duplicates first-wins, the app last-wins: make ids unique (§2) |
| `GET /api/levels` returns `HTTP 500` | a level is missing a key (`varCount`, `desc`, …) | restore all five keys (§1) |
| The new level is locked with "Complete Tutorial" | `TutorialGate` blocks every non-tutorial level | finish the tutorial; that is by design (§4) |
| The new level is **not** gated behind Level 3 | `getLockState` only gates ids 1-3 | add an explicit gate for your id if you want one (§4) |
| The stage screen shows an empty grid | the level's `puzzles` array is empty | ship stages; the screen falls back to a 12-stage denominator (§4) |
| The level never unlocks its successor | `avgScore` divides by the stage count and requires *every* stage scored at an average ≥ 80 | §4 |
| The new level is missing from `GET /api/levels` | backend served cached content | restart it (§8) |
| A deep five-literal stage loses its "optimal" figure | the graded solver budget ran out | expected; author `optimalSteps` from a raised-budget run (§7) |
| The Sandbox refuses your five-literal expression | `SANDBOX.maxVariables = 4` | raise that one number, or keep the level at four literals (§7) |

---

**Next:** [`add-a-new-problem.md`](add-a-new-problem.md) — the stage contract and its verifier.
[`../../04-api/API-REFERENCE.md`](../../04-api/API-REFERENCE.md) — the exact `/api/levels` payloads.
[`../../03-database/SCHEMA.md`](../../03-database/SCHEMA.md) — where stage progress and scores are
persisted (progress keys are `"<levelId>:<stageIdx>"`).
