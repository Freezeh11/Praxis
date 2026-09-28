# How to debug a failing step

**What this is.** One learner click traced through every hop it really takes, where the logs live, how
to correlate a browser action with a backend line, and a symptom → cause → fix decision tree for the
step workflow.

**Who it's for.** Anyone staring at a derivation that will not move, a law button that does nothing, a
score that looks wrong, or an empty step history.

> **Correct the mental model first.** A *step* never goes to the server. The engine is a pure,
> synchronous JS module tree in the browser; the learner selects AST nodes and picks a law, and
> `law.apply()` computes the next tree locally. The only network calls in the puzzle flow are
> `GET /api/levels/:id` when a level is loaded and `POST /api/score` when a puzzle is *already solved*.
> There is **no `POST /sandbox/validate` endpoint** (the task brief implies one; it does not exist),
> and there is no reducer — state is React `useState` inside `useGameState` plus a
> publish/subscribe store (`state/progressStore.js`).

## Contents

1. [The real hop chain for one click](#1-the-real-hop-chain-for-one-click)
2. [Reproduce a click without the browser](#2-reproduce-a-click-without-the-browser)
3. [Where the logs are](#3-where-the-logs-are)
4. [The `X-Request-ID` correlation trick](#4-the-x-request-id-correlation-trick)
5. [The two string gates (do not conflate them)](#5-the-two-string-gates-do-not-conflate-them)
6. [Decision tree: symptom → cause → fix](#6-decision-tree-symptom--cause--fix)
7. [What to put in a bug report](#7-what-to-put-in-a-bug-report)
8. [Known discrepancies and dead code you will trip over](#8-known-discrepancies-and-dead-code-you-will-trip-over)

---

## 1. The real hop chain for one click

| # | Hop | File:line | Runs where | Can fail how |
|---|---|---|---|---|
| 1 | literal click → path | `frontend/src/components/ExpressionDisplay.jsx:59-60` (`data-path`, `onClickLit(path)`) | browser | click lands on a group, not a literal |
| 2 | page wrapper forwards the snapshot | `frontend/src/pages/ProblemPage.jsx:305-308` | browser | `expr` null (puzzle not loaded) |
| 3 | selection machine | `frontend/src/state/useGameState.js:240-312` | browser | `isAnimating` swallows the click (`:241`) |
| 4 | **law discovery** | `analyzeSelection(expr, sel, { allowExpand })` `:156` → `engine/laws/index.js:33` | browser | returns `[]` → "No laws apply" |
| 5 | panel renders the laws | `components/puzzle/LawPanel.jsx:126-137,164-176` (`data-law-id`) | browser | `applicableLaws` empty |
| 6 | law click → `applyLaw` | `pages/ProblemPage.jsx:317-322` → `state/useGameState.js:398-503` | browser | no-op guard `:410-417` |
| 7 | **pure rewrite** | `law.apply()` → `laws/*.js` | browser | throws (caught upstream in solver only) |
| 8 | animation delay | `setTimeout(..., TIMING.lawAnimationMs)` `:467-469,491` = **1350 ms** | browser | nothing visible for 1.35 s (not a bug) |
| 9 | history update (the "reducer") | `setHistory(h => [...h, { expr, step }])` `:469` | browser | timer cleared by undo/reset/load (`:78-81`, `:505-513`) |
| 10 | step history card | `components/puzzle/StepHistoryPanel.jsx:50-84` | browser | — |
| 11 | completion check | `canonText(newExpr) === goalCanonRef.current` `:437` | browser | semantically equal ≠ canonically equal (§6, row 6) |
| 12 | dead-end check | `scanHints(...)` empty `:61-67` | browser | shows `DEAD_END_MSG` (`state/hintText.js:10`) |
| 13 | score estimate | `engine/scoring.js:54-97` via `usePuzzleSession.js:166-180` | browser | off-by-one vs server (§6, row 7) |
| 14 | `POST /api/score` | `services/scoreApi.js:31-35` → `backend/api/routes/score.py:20` | **network** | silent by design (`silent: true`) |
| 15 | response overwrites the estimate | `components/puzzle/usePuzzleSession.js:208-213` | browser | if it fails, the local estimate stays on screen |
| 16 | progress persists | `state/progressStore.js:60-94` → `services/progressApi.js:19-25` | browser + network | guest / debounce 500 ms / silent failure |

**The network half in one line each:**

- `GET /api/levels/:id` is called **only for a level id that is not bundled**
  (`services/contentApi.js:36-45`). Levels 0–3 ship inside the SPA, so a dead backend is invisible
  until you open an unknown level — a classic red herring.
- `POST /api/score` fires once, after `isComplete` (`components/puzzle/usePuzzleSession.js:200-213`);
  the sandbox never calls it (`:185-188`).
- `GET/POST /api/progress*` are the only **authenticated** routes
  (`services/progressApi.js:12,19`; bearer attached at `services/apiClient.js:27-31`).

## 2. Reproduce a click without the browser

Nine times out of ten the bug is in the *selection*, not the law. Reproduce both exactly as
`useGameState` builds them:

| Gesture | Selection element |
|---|---|
| click a literal | `{ path: 'R.1.0', isTermSel: false }` |
| click the `⠿` term handle | `{ path: 'R.1', isTermSel: true }` |
| click a NOT capsule | `{ path: 'R.0', isTermSel: false }` on the `not` node → `analyzeNot` |
| click a constant | one element, routed to `analyzeSumConst` / `analyzeProductConst` (`useGameState.js:274-288`) |

```bash
cd frontend && node --input-type=module <<'EOF'
import { parseExpr } from './src/engine/parser.js'
import { nodeText, canonText } from './src/engine/render.js'
import { analyzeSelection, analyzeNot, scanHints } from './src/engine/laws/index.js'
import { getLegalTransitions } from './src/engine/solver.js'

const expr = parseExpr("x'y + z + xy")           // the expression on screen
const sel = [{ path: 'R.0.1', isTermSel: false }, { path: 'R.2.1', isTermSel: false }]  // the two literals
console.log('screen   :', nodeText(expr), '| canon:', canonText(expr))
console.log('laws     :', analyzeSelection(expr, sel).map(l => [l.id, l.desc]))
console.log('hints    :', scanHints(expr, 'R'))
console.log('moves    :', getLegalTransitions(expr).map(t => [t.lawId, t.from, '->', t.to]))
console.log('not-laws :', [...sel.map(s => s.path)].map(p => analyzeNot(expr, p).map(l => l.id)))
EOF
```

If `analyzeSelection` is empty here but the UI shows a law, you are reproducing the wrong selection —
check `isTermSel` first, it changes the law set completely (`aggregate` vs `literal` laws,
`laws/sumLaws.js:40`).

## 3. Where the logs are

| Where | What you get | How to read it |
|---|---|---|
| browser console | `console.warn` on a failed saved-derivation restore (`state/useGameState.js:130`), generation/level-load failures (`usePuzzleSession.js:61,122`), sandbox sessionStorage warnings (`components/puzzle/sandboxPuzzle.js:37`) | DevTools → Console. **The step flow itself logs nothing.** |
| backend stdout | one JSON object per line per HTTP request | terminal running `uvicorn`, or Render logs |
| Network tab | URL, status, request/response bodies, `x-request-id` response header | DevTools → Network |
| localStorage | the progress snapshot under the key from `config/storageKeys.js` | DevTools → Application → Local Storage |
| test output | the property test's violation dumps | `cd frontend && node --test src/engine/__tests__/law-soundness.property.test.js` |

**Start the backend locally** (both `.env` files exist locally and are gitignored; never print their
values):

```bash
cd backend && python3 -m uvicorn main:app --reload --port 8000
```

If `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` are missing the process dies **at import**
(`backend/config/settings.py:75` → `:30-38`) with:

```text
RuntimeError: Missing required environment variable: SUPABASE_URL. Set it in backend/.env (local) or in the deployment environment.
```

Every route then fails, including `/api/levels`.

**The log line shape** — this is real output from the project's own formatter
(`backend/core/logging.py:34-50`), produced by logging one synthetic `request completed` event:

```json
{"ts": "2026-09-28T05:50:16.081Z", "level": "INFO", "logger": "praxis.request", "message": "request completed", "request_id": "9f2c1d3e4b5a4c6d8e7f0a1b2c3d4e5f", "method": "POST", "path": "/api/score", "status": 200, "duration_ms": 12.34}
```

Keys, in order: `ts`, `level`, `logger`, `message`, `request_id`, then the merged `fields`
(`method`, `path`, `status`, `duration_ms`). One line per request, including 401s and 500s
(`backend/core/middleware.py:26-61`). Every response carries `X-Request-ID` — the request's own
header if supplied, otherwise a fresh `uuid4().hex` (`middleware.py:27,61`).

## 4. The `X-Request-ID` correlation trick

The frontend **never reads** the header (verified: no reference to `X-Request-ID` anywhere under
`frontend/src`), so you cannot get the id from JS. Take it from DevTools:

1. DevTools → Network → reproduce the action.
2. Click the request (usually `score` or `levels`).
3. Response Headers → `x-request-id` → copy the value.
4. Correlate in the backend log:

```bash
# the whole request, one line
grep '9f2c1d3e4b5a4c6d8e7f0a1b2c3d4e5f' backend.log

# just the fields that matter
grep '9f2c1d3e4b5a4c6d8e7f0a1b2c3d4e5f' backend.log | jq '{ts, method, path, status, duration_ms}'

# everything that failed in the last run
jq -c 'select(.status >= 400)' backend.log
```

To make the id deterministic instead of random, send it yourself — the middleware echoes it:

```bash
curl -s -D- -o /dev/null -H 'X-Request-ID: debug-001' http://127.0.0.1:8000/api/levels | grep -i x-request-id
# x-request-id: debug-001
```

**Why this matters for a step bug:** it does not. A step never produces a request. The request id is
for the two things that *do* talk to the server — level loading and score submission — and for the
progress sync.

**Vite dev proxy.** The SPA calls relative paths; the dev server forwards them
(`frontend/vite.config.js`):

- `/api/*` → `http://127.0.0.1:8000` (override with `VITE_API_TARGET`)
- `/api/auth/*` → `http://127.0.0.1:3001` — **a dead remnant**, see §8. An ECONNREFUSED on
  `/api/auth` is expected and harmless.

## 5. The two string gates (do not conflate them)

There are **two** validators with different callers. Merging them into "the validator" wastes an
afternoon.

| Gate | File | Caller | Judges |
|---|---|---|---|
| `validateExpr` | `frontend/src/engine/validate.js:16-77` | `engine/sandbox/generator.js:84` — **generated** sandbox expressions only | characters, parens, operator placement |
| `validateSandboxInput` | `frontend/src/engine/sandbox/validate.js:155-234` | `pages/SandboxPage.jsx:122` (debounced, for the feedback line) and `:124` (raw text, to enable Play), plus `sandbox/input.js:113` | the above **plus** the variable budget, operand structure and the stray-NOT rule, with exact user-facing messages |

The sandbox screen runs the second one twice on purpose: `live` uses `debouncedRaw` so a learner
mid-word is not told off, and `current` uses `raw` so the button follows what is typed
(`pages/SandboxPage.jsx:116-126`). The debounce is
`TIMING.sandboxValidationDebounceMs = 300` (`frontend/src/config/gameRules.js`).

**So:** if the sandbox shows no error for ~300 ms after a keystroke, that is the debounce. If Play is
enabled but the build refuses, that is the *third* verdict — `buildSandboxPuzzle`'s solvability check
(`sandbox/input.js:151-182`), which is not a syntax error at all.

## 6. Decision tree: symptom → cause → fix

| # | Symptom | Most likely cause | How to confirm | Fix |
|---|---|---|---|---|
| 1 | Clicking a term does nothing | a step is animating (`isAnimating`) | the expression is mid-animation | wait 1.35 s (`TIMING.lawAnimationMs`) |
| 2 | "No laws apply — try a different selection" | `analyzeSelection` returned `[]`: wrong `isTermSel`, or the shape genuinely has no law | §2 script with the same paths | select the literals, not the terms (or vice versa); check `mode` in `laws/definitions.js:29-54` |
| 3 | No law panel at all, and a *graded* puzzle expression looks simplifiable | the expression needs a gated law | `scanHints(expr,'R')` → `[]` while `scanHints(expr,'R',{allowExpand:true})` is non-empty | the puzzle is only playable in the Sandbox — by design (`A(B + A')` is the canonical example) |
| 4 | The law button is there but the expression does not change | no-op guard: `before === after` (`state/useGameState.js:410-417`) | the status message reads "That law didn't change the expression." | the law's predicate is over-broad for that shape — a builder bug (see [add-a-new-law.md](add-a-new-law.md)) |
| 5 | The step appears ~1.35 s late | **not a bug**: the step is recorded after the animation | `:423-425,447` | none |
| 6 | The expression looks simplified but the stage does not complete, and the dead-end message shows | completion is **canonical-text** equality, not semantic equivalence (`:437`) | §2 script: `canonText(expr)` vs `canonText(parseExpr(goal))` and `isEquivalent(...)` | a real, documented limitation — the learner must take the authored route; see the `x + x'y` example in [understanding-the-engine.md §13](../tutorials/understanding-the-engine.md#13-stage-10--terminal-form-dead-ends-and-the-canonical-text-limitation) |
| 7 | Local score and server score differ by exactly 1 point | JS `Math.round` (half-up) vs Python `round` (half-to-even) | `total` ends in 5: `earnedPoints` client 5 vs server 4 at total 90 | known divergence D21; the server value wins when it arrives (`usePuzzleSession.js:208-213`) |
| 8 | Steps taken > `optimalSteps`, but efficiency is full | the solver prefers its own BFS answer over the authored figure | `effectiveOptimalSteps` (`engine/scoring.js:39-42`); server `min(optimal, used)` (`scoring_service.py:80-88`) | working as designed; the authored `optimalSteps` is the fallback |
| 9 | `POST /api/score` never fires | the puzzle is in the Sandbox (never scored) or is not `isComplete` | Network tab; `usePuzzleSession.js:185-188` | expected in sandbox |
| 10 | Score request failed but the modal still shows a score | `silent: true` by design (`services/scoreApi.js:34`) | Network tab shows 4xx/5xx or no request; console is quiet | the local estimate is the fallback; check the backend log by request id |
| 11 | `401` on `/api/score` | impossible in practice: the route uses `optional_user` | compare with `/api/progress`, which is authenticated | a 401 means you hit `/api/progress*` without a bearer token (`backend/api/routes/score.py:24` vs `backend/core/security.py`) |
| 12 | `422` on `/api/score` | the body is missing a required field | the envelope's `error.detail[].loc` names it (`backend/main.py:60-66`) | send `levelId, stageIdx, stepsUsed, lawsUsed, hintsUsed, guidesUsed, optimalSteps` (`backend/api/schemas/score.py`; `services/scoreApi.js:31-35`) |
| 13 | The level loads fine even with the backend down | content is bundled at build time for the four known ids | `services/contentApi.js:36-45` returns the bundled level before any fetch | only an **unknown** level id reaches the API — test with one |
| 14 | `/api/laws` still shows the old cards after editing `content/laws.json` | `content_repository` caches with `functools.lru_cache` | restart the backend and re-check | restart; a production SPA also needs a rebuild (`content/gameContent.js:14-15`) |
| 15 | Progress is not on the server after a stage | guest profile, or the debounced save never ran | `progressStore.js:87-94` (returns early unless `serverLoaded` and not guest); 500 ms debounce | sign in; wait; check `/api/progress/save` in the Network tab |
| 16 | Sandbox: type → "Invalid character(s)" for a character you did not type | the live verdict is debounced and still reflects older text | `pages/SandboxPage.jsx:117-124` | wait ~300 ms |
| 17 | Sandbox: "Valid expression" but Play refuses | the second gate judged solvability, not syntax | the error text is one of `sandbox/input.js:53-54` | simplify the expression; the engine must reach an equivalent terminal form |
| 18 | An unrelated test starts failing after an engine change | the new law shortened an existing solver path | run `npm test`; read the deep-equal diff | re-baseline the expectation — see [first-contribution.md §4](../tutorials/first-contribution.md#4-what-actually-happens-three-real-failures) |
| 19 | A step is missing from the history after a re-render | undo/reset/load clears the pending animation timer (`useGameState.js:78-81,505-513`) | the derivation only commits after the timer | expected; the step was never recorded |
| 20 | The same law name maps to an unexpected scoring credit | the step records the display `name`, scoring maps it through `LAW_NAME_TO_ID` | `engine/scoring.js:25-28` | names must exist in `LAW_DEFINITIONS` (`laws/definitions.js:62-65`) |

## 7. What to put in a bug report

For anything step-related, these five facts make it reproducible in one pass:

1. **the puzzle**: level id + stage index (or "sandbox") and the expression + goal text;
2. **the exact selection**: paths and whether each was a whole term or a literal (`R.1`, term vs
   `R.1.0`, literal) — this is the fact that is almost always missing;
3. **the law** that was picked, by **law id** (`data-law-id` on the button, or the step card's name);
4. **the output of the §2 script** with your selection;
5. if the server is involved: the URL, status, `x-request-id`, and the matching backend log line.

## 8. Known discrepancies and dead code you will trip over

| Stale/implied | Reality | Evidence |
|---|---|---|
| a `POST /sandbox/validate` endpoint exists | **no such route**; sandbox validation is 100% client-side | no route in `backend/api/routes/`; `sandbox/validate.js`, `sandbox/input.js` |
| a step is sent to the backend for validation | a step is local and synchronous; only load and score use the network | `useGameState.js:398-503`; `usePuzzleSession.js:111,200` |
| "the validator" is one thing | two gates with different callers | §5 |
| the law animation is 2.5 s | **1350 ms** (`lawAnimationMs`), tutorial pre-highlight 1500 ms | `config/gameRules.js` `TIMING`; `useGameState.js:491,499` |
| the engine has 46 tests | **81 tests, 81 pass** | `npm test` |
| `/api/auth` proxy → a Better Auth server on :3001 | dead remnant; no auth server exists; auth is Supabase | `frontend/vite.config.js`; GROUND-TRUTH §7-D3 |
| client score equals the server score | off by one at totals ending in 5 | `engine/scoring.js:80` vs `scoring_service.py:55` |

**Related reading.** The engine walkthrough with the real call graph:
[understanding-the-engine.md](../tutorials/understanding-the-engine.md). Law semantics and the
card/engine id mismatch: [boolean-laws.md](../../06-reference/boolean-laws.md). Adding a law safely:
[add-a-new-law.md](add-a-new-law.md).
