# Claim ledger — content-authoring (`add-a-new-problem.md`, `add-a-new-level.md`)

Every substantive factual claim in the two guides, with the evidence and how it was verified.
`run` means the exact command shown in the guide was executed and its real output pasted;
`read` means the cited source was read. Commit: `3838343`. Environment: Node `v22.23.1`,
`jq` 1.8.1, Python 3.14, FastAPI 0.141.1.

## A. Content shape and per-puzzle contract (`add-a-new-problem.md`)

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| `content/levels.json` has 4 levels with 4 / 12 / 12 / 12 puzzles = **40** stages | §1, §4, §6 | `content/levels.json` | ran `jq -r '[.[] \| .puzzles \| length] as $c \| "per-level \($c\|join(","))  total \($c\|add)"'` → `per-level 4,12,12,12  total 40` |
| Level ids are 0, 1, 2, 3 and 0 = "Tutorial", 1 = "Level 1", 2 = "Level 2", 3 = "Level 3 — Boss" | §4 | `content/levels.json`; `frontend/src/config/gameRules.js:82-85` | ran `jq -r '.[] \| "id=\(.id)  \(.name)  varCount=\(.varCount)  puzzles=\(.puzzles\|length)"'` |
| Per-puzzle keys are exactly `expr, goal, targetLaws, hints, optimalSteps, optimalHint` | §1, §7.1 | `content/levels.json` | ran `jq -c '[.[] \| .puzzles[] \| keys] \| unique'` → one array with those six keys |
| A stage index is the puzzle's array position; there is no `id` field in a puzzle | §1 | `backend/repositories/content_repository.py:60-62`, `backend/services/content_service.py:40-42` | read |
| `content/laws.json` holds exactly 10 law ids: `complement, idempotent, absorption, identity, annulment, distributive, double-neg, demorgan-and, demorgan-or, associative` | §7.4, §8 | `content/laws.json` | ran `jq -r '[.[].id] \| join(", ")' content/laws.json` |
| The learner-facing number is `Stage {idx + 1}` | §4 | `frontend/src/pages/StageSelectorPage.jsx:315-318` | read |
| The backend rejects only `stage_idx >= len(puzzles)`, so `stageIdx: -1` resolves Python-style to the last stage | §4 warning | `backend/services/content_service.py:40-42` | read; ran `POST /api/score` with `stageIdx: 11` and `stageIdx: -1` against the running dev backend → identical `targetLawsRequired: ["annulment","demorgan-or","complement"]` (Level 1 stage 12) |
| Scoring a non-existent stage returns the 404 envelope `{"code":"not_found","message":"Stage 12 not found"}` | §7.7 | `backend/services/content_service.py:40-42`, `backend/api/routes/score.py:27-35` | ran the `curl -X POST /api/score` in §7.7 → real 404 envelope |
| `GET /api/levels` exposes the per-level `puzzleCount` | §6, §7.7 | `backend/repositories/content_repository.py:46-57` | ran `curl -s http://127.0.0.1:8000/api/levels \| jq -r '.data[] \| …'` → `puzzleCount` 4/12/12/12 |

## B. The six keys, their consumers and their traps

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| `expr` is parsed with `parseExpr` when the stage opens | §2 | `frontend/src/state/useGameState.js:82` | read |
| `goal` is parsed and canonicalised with `canonText(parseExpr(...))`; the stage is solved when the learner's canonical text matches | §2 | `frontend/src/state/useGameState.js:83`, `frontend/src/engine/solver.js:216` | read |
| `targetLaws` drives the 30-point target-law band | §2, §9 | `backend/services/scoring_service.py:46`, `:99-107` | read; ran the real backend `POST /api/score` → `targetLaw: 30.0` with all three target law ids submitted |
| `hints` is only a **fallback**: the Hint button first asks `scanHints`/`buildHintText` | §2 | `frontend/src/state/useGameState.js:501-520`, `frontend/src/state/hintText.js:18-77` | read |
| Both hint branches charge one hint against the score | §2 | `frontend/src/state/useGameState.js:509`, `:518` | read |
| `optimalHint` renders only when `scoreResult.efficiency < 40` | §2 | `frontend/src/components/puzzle/ScoreModal.jsx:154-156` | read |
| `optimalSteps` is a fallback: the workspace re-derives the optimum at load and prefers the solver's answer | §2, §7.3 | `frontend/src/state/useGameState.js:88-95` | read |
| The client submits `optimalSteps` to `/api/score` | §2 | `frontend/src/components/puzzle/usePuzzleSession.js:166-170`, `frontend/src/services/scoreApi.js:31-35` | read |
| The backend uses `min(explicit optimalSteps, stepsUsed)` when resolving the optimum | §7.3 (implied by §9 numbers) | `backend/services/scoring_service.py:80-88` | read |
| `allowExpand` is the only extra key the graded workspace reads, and it enables the sandbox-only law | §2 | `frontend/src/components/puzzle/usePuzzleSession.js:84`, `frontend/src/engine/laws/index.js:33-34` | read |
| The parser silently skips unknown characters | §7.2 | `frontend/src/engine/parser.js:11`, `:51-53` | read |
| `validateExpr` exists as a stricter string gate and the graded flow does not call it | §7.2 | `frontend/src/engine/validate.js:16-77`; only caller is `frontend/src/engine/sandbox/generator.js:84` | read + repository-wide grep for `validateExpr` |

## C. Engine API and search budgets

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| The engine barrel exports 60 symbols | §3 | `frontend/src/engine/index.js:1-84` | ran `node --input-type=module` importing the barrel → `60 exports` |
| The search entry points are `getLegalTransitions`, `findOptimalPath`, `findSimplestForm` | §3 | `frontend/src/engine/index.js:57` | read |
| `findOptimalPath(startExpr, targetCanon, options)` returns `{optimalSteps, path, found}` | §7.3 | `frontend/src/engine/solver.js:164-241` | read; ran it |
| An expression already equal to the goal returns `{optimalSteps: 0, path: [], found: true}` | §7.3 | `frontend/src/engine/solver.js:179-181` | read |
| Budget exhaustion returns `{optimalSteps: 0, path: [], found: false}` | §7.3 | `frontend/src/engine/solver.js:236-240` | read; ran the 5-variable case (§7 of the level guide) → `found=false steps=0` |
| Default options are `SOLVER_BUDGET.graded = {maxDepth: 10, maxStates: 3000}` | §7.3 | `frontend/src/engine/solver.js:183-184`, `frontend/src/config/gameRules.js:173-181` | read |
| `maxStates` counts transitions explored, not states stored | §7 of the level guide | `frontend/src/engine/solver.js:200-205` | read; confirmed by measurement (a 2499-state graph still fails the 3000-transition budget) |
| `path[].law` is a display name; `lawIdOf` / `lawsUsedFromSteps` convert it to a law id | §7.3 | `frontend/src/engine/scoring.js:25-33`, `frontend/src/engine/laws/definitions.js:63-65` | read; ran `lawsUsedFromSteps` on a real path |
| `findOptimalPath` dedupes transitions by canonical target + law name | §7.5 (behaviour explained) | `frontend/src/engine/solver.js:50` | read |
| `isEquivalent` is a truth-table comparison over the union of literals (2ⁿ rows) | §7.2 | `frontend/src/engine/equivalence.js:45-58` | read; ran it |
| `nodeText` is the display rendering and `canonText` the order-independent canonical text | §7.2, §7.3 | `frontend/src/engine/render.js:12`, `:28` | read |

## D. Verification method (`add-a-new-problem.md` §7)

| Claim | Doc + section | Evidence | How verified |
|---|---|---|---|
| The worked example `(x + y)(x + y')` → `x` parses, round-trips and is equivalent | §7.2 | — | ran the §7.2 snippet → `re-renders identically: true`, `goal is equivalent: true`, `literals in expr: x, y` |
| Its optimal derivation is 2 steps: `Distributive (POS)` then `Absorption Law` | §7.3, §9 | — | ran the §7.3 snippet → exact JSON pasted in the guide |
| All 40 shipped stages pass the published verifier | §7.6 | `frontend/src/engine/solver.js`, `content/levels.json` | ran `node /tmp/verify-puzzle.mjs ../content/levels.json ../content/laws.json` → `levels=4 puzzles=40 failures=0` |
| A 13th Level 1 stage takes the file to `4,13,12,12` = 41 stages, and all 41 pass | §6, §7.6 | `content/levels.json` (scratch copy) | ran the §6 `jq --slurpfile stage … '.[1].puzzles += $stage'` command → `BEFORE 40 / AFTER 41`; ran the verifier on the copy → `levels=4 puzzles=41 failures=0` |
| The naive "target law must be on the BFS shortest path" test flags 29 of the 40 shipped stages | §7.5 | — | ran the published naive-check snippet → `--- 29 of 40 shipped stages flagged by the shortest-path test`, with the four sample lines pasted |
| The engine offers both `absorption → y + z` and `complement → y1 + z` from `y(x' + x) + z` | §7.5 | — | ran `getLegalTransitions` on that state → the two-line output pasted |
| The target-law band is proportional: `30 × matched / required` | §9 | `backend/services/scoring_service.py:99-107`, `frontend/src/engine/scoring.js:70-72` | read; ran `estimateScore` |
| For the worked example the 2-step route scores 80 and the 3-step textbook route scores 90 | §9 | `frontend/src/engine/scoring.js:54-97` | ran the §9 snippet → `total=80 earnedPoints=4 targetLaw=10` and `total=90 earnedPoints=5 targetLaw=30` |
| Backend and frontend round `earnedPoints` differently at exactly .5 (Python `round(4.5)=4`, JS `Math.round(4.5)=5`) | §9 note | `backend/services/scoring_service.py:55`, `frontend/src/engine/scoring.js:80` | ran the real backend `POST /api/score` for a 90-total submission → `earnedPoints: 4`; ran `estimateScore` on the same band → `earnedPoints=5` |
| The backend is authoritative and replaces the local score figure | §9 note | `frontend/src/components/puzzle/usePuzzleSession.js:208-212` | read |

## E. The `distributive-expand` trap (`add-a-new-problem.md` §8)

| Claim | Doc + section | Evidence | How verified |
|---|---|---|---|
| `distributive-expand` is a real engine law id, not one of the ten reference cards | §8 | `frontend/src/engine/laws/definitions.js:44`, `content/laws.json` | read; ran `lawIdOf('Distributive (Expand)')` → `"distributive-expand"`; ran `jq '[.[].id]'` on `laws.json` |
| The graded workspace never offers it, so `x(x' + y)` is unsolvable in the graded flow | §8 | `frontend/src/engine/laws/index.js:33-34`, `frontend/src/engine/solver.js:183-184` | ran the §8 snippet → `graded: {"optimalSteps":0,"path":[],"found":false}`, `graded moves from start: []` |
| With `allowExpand` it solves in 2 steps through the expand law | §8 | `frontend/src/engine/solver.js:204` | ran the §8 snippet → `allowExpand` path pasted |
| Naming it in `targetLaws` yields `targetLaw: 0` | §8 | `frontend/src/engine/scoring.js:62-72` | ran `estimateScore({targetLaws:['distributive-expand'], lawsUsed:['absorption'], …})` → `{"targetLaw":0,"total":70}` |

## F. Level object, numbering and display (`add-a-new-level.md`)

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| Level keys are exactly `desc, id, name, puzzles, varCount` | §1 | `content/levels.json` | ran `jq -c '[.[] \| keys] \| unique'` → `[["desc","id","name","puzzles","varCount"]]` |
| The backend projects levels into `{id, name, desc, varCount, puzzleCount}` | §1 | `backend/repositories/content_repository.py:46-57` | read; ran `GET /api/levels` through the real app |
| A missing key makes `GET /api/levels` return HTTP 500 | §1 | `backend/repositories/content_repository.py:53`; `backend/main.py` (AppError handler only) | ran the app with `varCount` deleted from the new level via `TestClient(raise_server_exceptions=False)` → `missing varCount -> HTTP 500`; with the key present → `200` |
| The frontend builds the same summary projection at bundle time | §1 | `frontend/src/content/gameContent.js:21-28` | read |
| `TUTORIAL.levelId = 0` and `stageIndexes = [0,1,2,3]` | §2, §5 | `frontend/src/config/gameRules.js:81-85` | read |
| Duplicate ids: backend `get_level` first-wins, frontend level cache last-wins, progress keys collide | §2 | `backend/repositories/content_repository.py:60-62`; `frontend/src/services/contentApi.js:13-17`; `frontend/src/state/progressStore.js:209-215` | read |
| The card order on `/levels` is file order, with the Sandbox card last | §2 | `frontend/src/pages/LevelSelectPage.jsx:51` | read |
| `varCount`'s only consumers are the two summary projections and one display line | §3 | `backend/repositories/content_repository.py:53`, `frontend/src/content/gameContent.js:22-26`, `frontend/src/pages/StageSelectorPage.jsx:151` | ran a repository-wide grep for `varCount` over `backend/` and `frontend/src/` |
| No code validates the literals in a puzzle against `varCount` | §3 | same grep result (no engine/validation site reads it) | ran the grep; read the three consumer sites |
| `SANDBOX.maxVariables = 4` is a separate ceiling | §3, §7 | `frontend/src/config/gameRules.js:110-112` | read |

## G. Gates, unlock rule and stage conventions (`add-a-new-level.md`)

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| Every non-tutorial graded route is wrapped in `TutorialGate` and requires tutorial completion | §4 | `frontend/src/components/TutorialGate.jsx:41-43`, `:61-62`; `frontend/src/App.jsx:40-53` | read |
| `getLockState` names ids 0, 1, 2, 3 explicitly; any other id is unlocked | §4 | `frontend/src/pages/LevelSelectPage.jsx:78`, `:80-92`, `:94-106`, `:108-120`, `:122` | read |
| The "Coming Soon" list is empty despite the comment | §4 | `frontend/src/pages/LevelSelectPage.jsx:19-20`, `:76` | read |
| `getLevelProgress` counts scored stages, divides by `totalStages`, and unlocks at `allDone && avgScore >= 80` | §4 | `frontend/src/state/progressStore.js:291-313` | read |
| `UNLOCK_AVERAGE_SCORE = 80` | §4 | `frontend/src/config/gameRules.js:48-49` | read |
| The stage screen passes the real puzzle count, falling back to 12 on an empty array | §4 | `frontend/src/pages/StageSelectorPage.jsx:87` | read |
| A stage is available only if it is stage 0 or its predecessor is completed | §4 | `frontend/src/pages/StageSelectorPage.jsx:56` | read |
| A completed stage with `best_score` 0 is absent from `stageScores`, so the completion counter and the unlock counter can disagree | §4 | `backend/services/progress_service.py:41-42`, `:72-75`; `frontend/src/pages/StageSelectorPage.jsx:184` | read |
| Levels with id ≥ 3 render a mastery banner instead of an unlock gate | §4 | `frontend/src/pages/StageSelectorPage.jsx:88`, `:213`, `:233-246` | read |
| Tutorial = 4 stages, Levels 1-3 = 12 each, 40 total; the 12-stage convention gives six dual pairs | §5 | `content/levels.json`; `frontend/src/pages/StageSelectorPage.jsx:160`; `frontend/src/config/gameRules.js:82-85` | ran the §5 `jq` commands → `per-level 4,12,12,12   total 40` |
| The stage grid is four columns on desktop | §5 | `frontend/src/pages/StageSelectorPage.jsx:277` | read |

## H. Worked example: a new level (`add-a-new-level.md` §6)

| Claim | Doc + section | Evidence | How verified |
|---|---|---|---|
| Appending the example level gives ids `0,1,2,3,4` and shape `4,12,12,12,2` = 42 stages | §6 | `content/levels.json` scratch copy | ran the §6 command block → `ids BEFORE: 0, 1, 2, 3` / `ids AFTER: 0, 1, 2, 3, 4`, `shape BEFORE … total 40` / `shape AFTER … total 42` |
| Both new stages pass the verifier | §6 | — | ran `node /tmp/verify-puzzle.mjs /tmp/demo-content/levels.json …` → `levels=5 puzzles=42 failures=0` |
| After a restart `GET /api/levels` returns 5 levels and `GET /api/levels/4` returns the 5-key object with 2 puzzles | §6 | `backend/api/routes/levels.py:18-27` | ran the real app through `TestClient` with `CONTENT_DIR` pointed at the edited copy → the output pasted in the guide |

## I. Five-variable behaviour (`add-a-new-level.md` §7)

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| The engine is literal-count agnostic: `extractVariables` walks any tree, `isEquivalent` is a 2ⁿ truth table | §7 | `frontend/src/engine/equivalence.js:11-22`, `:45-58` | read; ran the §7 snippet on 5-literal puzzles |
| A 5-literal 4-term SOP puzzle (`v'wxy'z + v'wxyz + vwxy'z + vwxyz` → `wxz`) is not solvable inside the graded budget but solves in 10 steps with `{maxDepth:16, maxStates:40000}` | §7 | `frontend/src/engine/solver.js:183-184`, `frontend/src/config/gameRules.js:175` | ran the published §7 snippet → `graded(10/3000): found=false steps=0  raised(16/40000): found=true steps=10` |
| That puzzle's reachable state graph contains 2499 canonical states; a larger variant exceeds 60 000 | §7 | — | ran a closure probe with `getLegalTransitions` (state cap 60 000) → `2499` and `>60000` |
| Two of the three measured 5-literal puzzles solve inside the graded budget (3 and 5 steps) | §7 | — | ran the published §7 snippet |
| When the solver fails, `useGameState` falls back to the authored `optimalSteps` | §7 | `frontend/src/state/useGameState.js:88-95` | read |
| `MAX_SANDBOX_VARS` is `SANDBOX.maxVariables` = 4 | §7 | `frontend/src/engine/sandbox/input.js:48`, `frontend/src/config/gameRules.js:110-112` | read; ran `console.log(engine.MAX_SANDBOX_VARS)` → `4` |
| The sandbox refuses 5 distinct literals with the exact message `"Sandbox supports up to 4 variables. Your expression uses 5."` | §7 | `frontend/src/engine/sandbox/validate.js:38-39`, `:186-194` | ran the published §7 snippet → exact `too-many-vars` payload pasted |
| The ceiling is per call: `{maxVariables: 6}` accepts 5 literals | §7 | `frontend/src/engine/sandbox/validate.js:89-92` | ran the snippet → `{"valid":true,…}` |
| `buildSandboxPuzzle` refuses the same input with the same message | §7 | `frontend/src/engine/sandbox/input.js:109-116` | ran the snippet → `{"ok":false,"errorCode":"too-many-vars",…}` |
| The Sandbox screen renders that number as help text and its level card is hardcoded to 4 | §7 | `frontend/src/pages/SandboxPage.jsx:71`, `:353`; `frontend/src/pages/LevelSelectPage.jsx:32` | read |
| Random practice is capped at four literals (`VAR_POOL_COMPLEX = ['w','x','y','z']`) | §7 | `frontend/src/engine/sandbox/generator.js:30` | read |
| A caller can raise the ceiling (`buildSandboxPuzzle(..., {maxVariables: 6})` returns a 5-variable puzzle) | §7 | `frontend/src/engine/__tests__/sandbox.test.js:121-135` | read |

## J. Restart caveat (both guides)

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| `list_levels()` and `list_laws()` are memoised with `functools.lru_cache`, so a running backend serves the content it loaded at start-up | problem §7.7, level §8 | `backend/repositories/content_repository.py:34-43` | read; ran the published Python snippet → second call `CacheInfo(hits=1, …)` |
| Editing the JSON on disk does not change what the repository returns until `cache_clear()` / a restart | problem §7.7 | same | ran the published snippet → `on disk: [4, 13, 12, 12]` vs `repository returns: [4, 12, 12, 12] <-- STALE`, then `after cache_clear: [4, 13, 12, 12]` |
| Content is resolved as `parents[2] / "content"`, i.e. `content/` must sit beside `backend/` | problem §7.7 | `backend/repositories/content_repository.py:16` | read; the snippet printed `CONTENT_DIR: /home/xris/Documents/GitHub/Praxis/content` |
| The Vite dev server bundles the same JSON through the `@content` alias, so it is stale the same way | problem §7.7, level §8 | `frontend/vite.config.js:16`, `frontend/src/content/gameContent.js:14-15` | read |
| The app caches levels in a module-level `Map` for the lifetime of the tab | problem §7.7 | `frontend/src/services/contentApi.js:13-17` | read |
| Score submission is silent, so a stale-content 404 is dropped | problem §7.7 | `frontend/src/services/scoreApi.js:31-35`, `frontend/src/services/apiClient.js:76-78` | read |
| The frontend answers from the bundled levels before falling back to the API, and `useGameContent` never blocks on the network | problem §7.7 | `frontend/src/services/contentApi.js:36-45`, `frontend/src/state/useGameContent.js:18-22` | read |
| After a restart the API serves the new stage and `POST /api/score` for it returns 200 | problem §7.7 | `backend/api/routes/score.py:20-49` | ran the real app with the edited copy through `TestClient` → `GET /api/levels/1 -> puzzles=13`, `POST /api/score` stageIdx 12 → `200` with `total 90`, `earnedPoints 4` |

## K. Caveats and unverified items

| Item | Status |
|---|---|
| Whether the Vite dev-server watcher picks up an edit to `content/levels.json` outside the Vite root without a restart | **Not verified by running a dev server.** The guide states the conservative, evidence-backed rule: the app reads the bundled module (`frontend/src/content/gameContent.js:14-15`), the module cache lives for the lifetime of the tab, and a restart/hard-refresh is the safe step. Reported as unverified rather than asserted. |
| `earnedPoints` rounding difference | **Verified on both sides** but recorded here as a possible discrepancy-register entry for the Lead: Python `round()` (banker's) vs JS `Math.round()`. |
| The GROUND-TRUTH "48 puzzles" figure | **Contradicted**: the verified total is 40 (4 + 12 + 12 + 12). The Lead sent the correction; both guides state 40/41/42 consistently. |
| Five-variable puzzles beyond the three measured | Only the three §7 candidates were measured; the guide does not generalise beyond them. |
