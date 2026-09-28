# Claim ledger — `product-arch` (task-5)

Every substantive factual claim this writer made, with its evidence and **how it was verified**
(`read` = inspected the source; `ran` = executed something and observed the output). This is the
audit trail for the verifier.

**Deliverables covered:**

| Doc | Lines |
|---|---|
| `docs/01-product/PRD.md` | see completion report |
| `docs/01-product/SRS.md` | see completion report |
| `docs/02-architecture/SAD.md` | see completion report |
| `docs/02-architecture/SDD.md` | see completion report |
| `docs/02-architecture/REFACTOR-NOTES.md` | see completion report |
| `docs/07-explanation/why-this-architecture.md` | see completion report |
| `docs/07-explanation/design-decisions.md` | see completion report |
| `docs/07-explanation/known-limitations.md` | see completion report |
| `docs/_staging/diagram-input-product-arch.md` | this file's sibling |

**Verification commands used** (all run from the repository root unless stated):

```bash
cd frontend && npm test                        # engine suite
cd frontend && npx eslint .                    # lint findings, by rule
cd backend && ./venv/bin/python -c "<TestClient script>"   # all 7 endpoints live
python3 -c "<content JSON inspection>"         # level/law/puzzle counts
node -e "<reachable-totals enumeration>"       # rounding-divergence set
git log --format='%h %ad %s' --date=short      # decision dates + D3 evidence
grep -rn … / find … / wc -l                    # import analysis, counts, consumers
node docs/_staging/tools/check-docs.mjs        # link/anchor/secret/mermaid gate
```

---

## 1. Repository shape and counts

| Claim | Doc + section | Evidence (file:line / command) | How verified |
|---|---|---|---|
| The backend is 28 Python modules / 1,241 lines | SAD §1, §3; SDD §2; REFACTOR-NOTES §7 | `git ls-files 'backend/*.py' \| wc -l` → 28; `xargs wc -l` → 1241 | ran |
| The backend has no `app/` package | SAD §4; SDD §9 | `find backend -type d` shows `api/{routes,schemas}`, `config`, `core`, `repositories`, `services` only | ran |
| The engine is 23 modules / 3,182 lines, or 30 files / 4,428 lines including 7 test files (1,246) | SAD §1; SDD §4, §5.1 | `find frontend/src/engine -name '*.js' \| wc -l` → 30; non-test → 23/3182; `__tests__` → 7/1246 | ran |
| `hooks/` holds 8 files | SAD §5; SDD §4 | `ls frontend/src/hooks/*.js \| wc -l` → 8 | ran |
| `components/` holds 10 top-level modules + 6 feature folders | SAD §5; SDD §4 | `ls frontend/src/components/*.jsx \| wc -l` → 10; `ls -d */ \| wc -l` → 6 | ran |
| Per-folder line counts (state 1,217 · services 426 · pages 2,103 · config 218 · content 400 · styles 450 · components 1,134 + 5,288) | SDD §4 | `for d in …; do wc -l; done` | ran |
| The API answers through `main.py → api/routes → services → repositories → supabase_client` | SAD §4; SDD §3 | `backend/main.py:15-20`, `:79-83`; `backend/api/routes/score.py:15`, `:27`; `backend/services/scoring_service.py:12`; `backend/repositories/progress_repository.py:13` | read |
| The engine imports only `config/` and itself | SAD §5; SRS NFR-2; REFACTOR-NOTES §9 | The only cross-folder engine imports are `../../config/gameRules.js` at `engine/scoring.js:18` and `engine/sandbox/input.js:36` | ran (grep) |
| The one layering exception is `services/contentApi.js → content/gameContent.js` | SRS §9; REFACTOR-NOTES §3 | `frontend/src/services/contentApi.js:10` | ran (grep) |
| Components import the engine only through the barrel | SDD §5.5 | grep for `from '../engine/[a-z]` in `components/` and `pages/` returns nothing deep | ran (grep) |
| 17 files exceed 250 lines | REFACTOR-NOTES §7 row 12 | `find … \| wc -l \| awk '$1>250'` → 17 | ran |

## 2. The API surface

| Claim | Doc + section | Evidence | How verified |
|---|---|---|---|
| There are exactly 7 application endpoints | SRS §5.1; SAD §2; PRD §10 | OpenAPI `paths` enumeration: `/`, `/api/levels`, `/api/levels/{level_id}`, `/api/laws`, `/api/score`, `/api/progress`, `/api/progress/save` | ran (`TestClient`) |
| `GET /` is plain, outside the envelope | SRS §5.1; SDD §3.5 | `backend/api/routes/health.py:15-18`; ran → `200 {"message":"Praxis API is running","docs":"/docs"}` | ran |
| `GET /api/levels` returns 4 summaries with ids `[0,1,2,3]` and `puzzleCount [4,12,12,12]` | SRS §5.1, DR §6.2; PRD D10 | ran → `data[].id`, `data[].puzzleCount` | ran |
| `GET /api/levels/999` → `404 not_found` with message `"Level 999 not found"` | SRS FR-8; §5.1 | ran → exact body reproduced in SRS | ran |
| Out-of-range stage → 404, not `IndexError` | SRS FR-8 | `backend/services/content_service.py:40-41`; ran → `NotFoundError 404 not_found` | ran + read |
| A negative stage index resolves Python-style (`-1` = last stage) | SAD? / SDD §3.6 | `backend/services/content_service.py:35-37` (docstring), ran → `get_puzzle(1,-1)` → `(x' + y)'(x + y')(x + y)` | ran |
| `GET /api/laws` returns 10 cards | SRS FR-9 | ran → `len(data) == 10`; `content/laws.json` | ran |
| `POST /api/score` returns the exact quoted payload for the quoted request | SRS §5.1 | ran → byte-comparable JSON in SRS | ran |
| A missing `stepsUsed` → `422 validation_error` inside the envelope | SRS NFR-5 | ran → `{"success":false,…,"error":{"code":"validation_error","message":"Request validation failed",…}}`; `backend/main.py:60-66` | ran |
| An unknown path → `404 http_error` inside the envelope | SRS NFR-5 | ran → `{"code":"http_error","message":"Not Found"}`; `backend/main.py:50-57` | ran |
| `GET /api/progress` and `POST /api/progress/save` → `401 unauthorized` without a bearer | SRS FR-32, NFR-6; SAD §8.3 | ran → both exact bodies; `backend/core/security.py:21-22` | ran |
| `X-Request-ID` is on every response | SRS NFR-10; SAD §8.2 | `backend/core/middleware.py:27`, `:61`; ran → header present on `GET /` | ran + read |
| The OpenAPI spec declares no security scheme | SRS §5.1 D22; SAD §8.3; SDD §9 | ran → `security=None` on all seven paths | ran |
| `POST /api/score` schedules persistence only when `user` is truthy | SRS FR-28; SDD §3.5 | `backend/api/routes/score.py:38-39` | read |
| `persist_score` inserts `score_history` and raises `best_score` only when higher, swallowing all failures | SRS FR-28; SAD §9.1; SDD §3.6 | `backend/services/progress_service.py:93-127` | read |
| The stored `hints_used` equals hints **+ guides** | SRS DR-2; known-limitations §4.1 | `backend/services/scoring_service.py:51` (the sum) → `backend/services/progress_service.py:101` (the write) | read |

## 3. Scoring semantics

| Claim | Doc + section | Evidence | How verified |
|---|---|---|---|
| Weights are 40 / 30 / 30; penalties 10 / 10; bonus max 5; rounding 1 dp | SRS FR-24; SDD §3.2 | `backend/config/constants.py:9-22` | read |
| A perfect Level 1 stage 0 solve scores `total 100.0`, `earnedPoints 5` | SRS §5.1; SDD §6.3 | ran (`compute_score` and the endpoint) — identical output both ways | ran |
| `optimal = min(declared, stepsUsed)` — a shorter solution lowers the bar | SRS FR-24 ⑥; SDD §3.6; known-limitations §10 | `backend/services/scoring_service.py:80-88`; ran → Level 1 stage 2 (declared 3) at `stepsUsed=1` → `total 100.0` | ran + read |
| Efficiency is 40 at or below optimum, else −10 per extra step floored at 0 | SRS FR-24 ① | `backend/services/scoring_service.py:91-96` | read |
| Target law is proportional, and **full 30** when the puzzle declares none | SRS FR-24 ② | `backend/services/scoring_service.py:99-107` | read |
| `assistance = hints + guides`, independence is `30 − 10 × assistance` floored at 0 | SRS FR-24 ③ | `backend/services/scoring_service.py:51`, `:110-115`; ran → 2 hints + 1 guide → `hint_independence 0.0` | ran + read |
| `total` is the sum rounded to 1 dp; `earnedPoints = round((total/100) × 5)` | SRS FR-24 ④ | `backend/services/scoring_service.py:54-55` | read |
| Unknown level or stage in `/api/score` raises 404 before scoring | SRS FR-24; SDD §8.2 | ran → `NotFoundError 404 not_found` for both `level_id=99` and `stage_idx=99` | ran |
| `STAR_THRESHOLDS` and `UNLOCK_AVERAGE` are read by **nothing** on the server | known-limitations D26 | grep: no consumer under `backend/` | ran (grep) |
| The client mirrors the formula in `engine/scoring.js` with the same weights | SAD §6; SRS FR-25 | `frontend/src/engine/scoring.js:14-18`, `:54-97`; ran via `node` → `total 90`, `earnedPoints 5` | ran + read |
| Python `round()` (banker's) diverges from JS `Math.round` (half-up) at exact `.5` totals | known-limitations D21, §3.1; design-decisions ADR-002 | ran both directions; enumerated **19 reachable totals**, exactly 3 diverge: 10 → 0/1, 50 → 2/3, 90 → 4/5 | ran |
| The browser credits its own bonus, so the balance can differ permanently from `score_history` | known-limitations §3.1 | `frontend/src/components/puzzle/usePuzzleSession.js:190-192` vs `backend/services/progress_service.py:106` | read |
| `POST /api/score` with `stepsUsed: 0` and a claimed law returns a perfect score | known-limitations D24, §3.1 | ran → `total 100.0, earnedPoints 5` | ran |
| `optimalSteps: 999` with `stepsUsed: 10` still returns `efficiency 40.0` and echoes `optimalSteps 10` | known-limitations D24 | ran | ran |

## 4. Content and data

| Claim | Doc + section | Evidence | How verified |
|---|---|---|---|
| There are 10 law cards with the exact ids listed | SRS §6.2; SDD §5.1 | `content/laws.json` | ran |
| **4 levels; Tutorial 4 stages, Levels 1–3 12 each → 40 puzzles** | PRD D10; SRS §6.2; known-limitations D10 | `content/levels.json` counts `[4,12,12,12]`; ran → `GET /api/levels` `puzzleCount [4,12,12,12]` | ran |
| Level var counts are 2, 2, 3, 4 | SRS §6.2 | `content/levels.json` | ran |
| Per-puzzle keys are exactly `expr, goal, targetLaws, hints, optimalSteps, optimalHint` | SRS §6.2 | union of keys across all 40 puzzles | ran |
| Only 8 of the 10 law ids appear in any `targetLaws` | SRS DR-9 | union across all puzzles → `absorption, annulment, complement, demorgan-and, demorgan-or, distributive, idempotent, identity` | ran |
| The engine knows an 11th internal id `distributive-expand`, gated to the sandbox | SRS DR-8 | `frontend/src/engine/laws/definitions.js:44`; `engine/sandbox/input.js:196-197` | read |
| The engine's definition table has 15 entries for 10 reference-card ids | known-limitations §9 | `LAW_DEFINITIONS` count; `LAW_NAME_TO_ID` derived at `:63` | read |
| `content/` is resolved as `parents[2]/"content"` | SRS DR-6; SDD §3.7 | `backend/repositories/content_repository.py:16` | read |
| Content is `lru_cache`d, so an edit needs a restart | SRS DR-7; known-limitations §5.2 | `backend/repositories/content_repository.py:34`, `:40` | read |
| Missing content → `503 content_unavailable` naming the path | SRS FR-10; SDD §3.7 | `backend/repositories/content_repository.py:24-31` | read |
| The SPA bundles the same JSON through the `@content` alias | SRS FR-10; SAD §8.6 | `frontend/vite.config.js:16`; `frontend/src/content/gameContent.js:14-15` | read |
| `LEVEL_SUMMARIES` is derived at module load and mirrors the API's shape | SAD §8.6; SDD §5.7 | `frontend/src/content/gameContent.js:22-28`; `content_repository.py:46-57` | read |
| Three tables, with the exact columns and indexes listed | SRS §6.1 | `database/init.sql:7-47` | read |
| RLS is enabled with one `FOR ALL USING (true)` policy per table for all roles | SRS DR-4; known-limitations D20, §6.1 | `database/init.sql:50-58` | read |
| There is no `auth.uid() = user_id` predicate anywhere | SRS DR-4 | grep over `database/init.sql` | ran (grep) |
| `updated_at` is never refreshed (no trigger, no writer) | known-limitations §4.2 | `database/init.sql:12`; `backend/services/progress_service.py:63-70` | read |
| `POST /api/progress/save` accepts `points: -5`, `stage_idx: -4`, `level_id: 99`, `best_score: 999.9` | known-limitations D25, §4.3 | ran → `SaveProgressRequest(...)` accepted and round-tripped (no live write performed) | ran |
| `stage_progress.level_id` stores the 0-based content id; Tutorial rows are `level_id = 0` | SRS DR-1; known-limitations §4.4 | `content/levels.json` ids; `frontend/src/config/gameRules.js:82-85` | read |
| No migration tooling; one hand-run `init.sql`; no CHECK constraints; no FK on level/stage | SRS §7 C-3; known-limitations §4.3 | `database/init.sql` (no `ALTER`, no `CHECK`) | read |

## 5. Frontend behaviour and screens

| Claim | Doc + section | Evidence | How verified |
|---|---|---|---|
| There are 9 routes and 7 pages; `/` is the landing page, level selection is `/levels` | SAD §5; PRD §4; known-limitations D5 | `frontend/src/App.jsx:30-57`; `ls frontend/src/pages` → 7 | ran + read |
| Every level/stage/puzzle/sandbox route is session-gated | PRD FR-5; SAD §5 | `frontend/src/components/ProtectedRoute.jsx:27`; `App.jsx:40-53` | read |
| The tutorial gate waits for `progressHydrated` before deciding | PRD FR-6; SDD §8.5; design-decisions ADR-012 | `frontend/src/components/TutorialGate.jsx:47`; `frontend/src/state/useProgress.js:69` | read |
| The tutorial level is exempt from the gate in both route shapes | PRD FR-7; known-limitations §10 | `frontend/src/components/TutorialGate.jsx:41-43` | read |
| Levels 1–3 and the sandbox require all 4 tutorial stages, with `returnTo` carried | PRD FR-6; SRS FR-6 | `TutorialGate.jsx:62-72`; `frontend/src/config/gameRules.js:84` | read |
| Level 2 needs all Level 1 stages done **and** average ≥ 80; Level 3 likewise from Level 2 | PRD FR-12; SRS FR-12 | `frontend/src/state/progressStore.js:304-310`; `frontend/src/pages/LevelSelectPage.jsx:94-120` | read |
| The unlock threshold is 80, not 70 | known-limitations D9 | `frontend/src/config/gameRules.js:49`; `backend/config/constants.py:26` | read |
| The average is rounded **before** the threshold comparison, so a true 79.5 passes | known-limitations D26, §3.5 | `frontend/src/state/progressStore.js:301-303` then `:309` | read |
| Stage *N* is available only after stage *N−1* is complete; stage 0 always | PRD FR-13; SRS FR-13 | `frontend/src/pages/StageSelectorPage.jsx:56` | read |
| Stars are 3 at ≥ 90, 2 at ≥ 75, 1 for any completion | PRD FR-14; SRS FR-14 | `frontend/src/state/progressStore.js:281-285`; `frontend/src/pages/StageSelectorPage.jsx:68-78` | read |
| Sandbox mode is `!levelId && !stageIdx` — one component, two routes | SAD §5; SDD §5.5; design-decisions ADR-007 | `frontend/src/components/puzzle/usePuzzleSession.js:40`; `frontend/src/App.jsx:42`, `:53` | read |
| The sandbox never scores, never submits, never writes progress | PRD FR-35; SRS FR-35 | `usePuzzleSession.js:185-188`; `frontend/src/components/puzzle/ScoreModal.jsx:100-102` | read |
| The sandbox verdict distinguishes syntax from solvability, and idle from error | PRD FR-33/FR-34; SRS FR-33/FR-34 | `frontend/src/pages/SandboxPage.jsx:110-148`; `engine/sandbox/input.js:53-54`, `:153-182` | read |
| A typed sandbox expression survives a refresh via `sessionStorage` | PRD FR-37; SRS FR-37 | `frontend/src/components/puzzle/sandboxPuzzle.js:46-56`, `:81-86` | read |
| Guide costs 20 graded points and 0 in the sandbox | PRD FR-22; SRS FR-22 | `frontend/src/pages/ProblemPage.jsx:261`; `frontend/src/config/gameRules.js:35` | read |
| The Hint is contextual first, authored-hints fallback second | PRD FR-21; SRS FR-21 | `frontend/src/state/useGameState.js:501-520`; `frontend/src/state/hintText.js:18-77` | read |
| A law that changes nothing records no step | PRD FR-16; SRS FR-16 | `useGameState.js:363-373` | read |
| The law animation is 1350 ms, with a 1500 ms tutorial pre-highlight | known-limitations D12; SRS FR-39 | `frontend/src/config/gameRules.js:59-61`; `useGameState.js:447`, `:455` | read |
| Reordering consumes no step | PRD FR-18; SRS FR-18 | `useGameState.js:522-558` | read |
| The session state is a history array with `expr`/`steps` derived | SDD §5.2, §6.2; design-decisions ADR-006 | `useGameState.js:15-18` | read |
| The win test is `canonText(newExpr) === goalCanonRef.current` | SRS FR-23; known-limitations §3.3; design-decisions ADR-003 | `useGameState.js:437`; goal at `:83` | read |
| `isEquivalent` is **not** on the win path; its non-test consumers are 4 call sites | SRS FR-23 ④; known-limitations §3.3 | grep `isEquivalent` → `laws/helpers.js:77`, `:98`, `sandbox/generator.js:94`, `sandbox/input.js:161` | ran (grep) |
| Dead-end detection is an empty `scanHints` result | known-limitations §3.4 | `useGameState.js:61`, `:504`, `:562` | read |
| The first completion awards `10 + earnedPoints` once; a restored solution shows no modal | PRD FR-26; SRS FR-26 | `usePuzzleSession.js:154-158`, `:190-197` | read |
| Score and progress calls are `silent: true` | SRS NFR-9 | `services/scoreApi.js:34`; `services/progressApi.js:12`, `:23`; `apiClient.js:53` | read |
| `progressStore.update` is a no-op when the updater returns the same object | SDD §5.2; known-limitations §10 | `progressStore.js:61-62`; `saveScore` at `:209-215` | read |
| Hydration merges (max / union / local-wins) instead of overwriting | PRD FR-30; SRS FR-30; design-decisions ADR-005 | `progressStore.js:97-130` | read |
| Server saves are debounced 500 ms and gated on `serverLoaded` + non-guest | PRD FR-29; SRS FR-29 | `progressStore.js:87-94`; `frontend/src/config/gameRules.js:68` | read |
| A `setUser` race loser discards its stale response | SRS FR-30 ⑦ | `progressStore.js:159` | read |
| Sound is synthesised from config, with a persisted preference | PRD FR-40; SRS FR-40 | `frontend/src/services/soundEffects.js:43`, `:80`, `:132`; `gameRules.js:148-170` | read |
| Device tier comes from width + pointer capability, never User-Agent | PRD FR-41; SRS FR-41; design-decisions ADR-008 | `frontend/src/hooks/useDeviceTier.js:5-9`, `:57-108` | read |
| Phone portrait blocks; small-tablet portrait warns; pointer-fine is never a phone | SRS FR-41 | `useDeviceTier.js:71-93`; `frontend/src/components/OrientationGate.jsx:16-24` | read |
| The cross-refresh sandbox slot is cleared by a random visit | SRS FR-37 ② | `sandboxPuzzle.js:46-56`, `:84` | read |
| Six storage keys, all centralised | SRS §5.3 | `frontend/src/config/storageKeys.js:10-28` | read |
| `GUIDE_COST_POINTS` is a spend; `ASSISTANCE_PENALTY` is a deduction — different things | SDD §5.1 | `gameRules.js:35` vs `backend/config/constants.py:16` | read |

## 6. Verification state of the repository

| Claim | Doc + section | Evidence | How verified |
|---|---|---|---|
| 76 engine tests pass, 0 fail, ~10.7 s | SRS NFR-4; PRD D11; known-limitations D11 | `cd frontend && npm test` → `# tests 76 / # pass 76 / # fail 0 / duration_ms 10680` | ran |
| The engine tests are 7 files / 1,246 lines | SDD §5.1 | `__tests__` counts | ran |
| There is **no** backend test suite and no pytest dependency | SRS §9; known-limitations D27, §8 | `find backend -name 'test_*.py'` → empty; `grep -i pytest backend/requirements.txt` → absent | ran |
| The engine tests never mention `estimateScore`/`earnedPoints` | known-limitations D27 | grep over `frontend/src/engine/__tests__/` | ran (grep) |
| Lint reports 16 findings (11 errors, 5 warnings) in 8 files | REFACTOR-NOTES §7 row 13; known-limitations §8 | `npx eslint . -f json` → `set-state-in-effect` 9, `exhaustive-deps` 5, `no-unused-vars` 2; zero `react-refresh` | ran |
| `.e2e` holds 19 `.mjs`: 16 wired + 2 unwired + 1 harness | SAD §3; known-limitations §8 | `ls .e2e/*.mjs \| wc -l` → 19; `run-all-suites.sh` lists 16; unwired are `gate-fresh-user-check.mjs`, `lead-engine-fingerprint.mjs` | ran |
| `render.yaml` declares one service, rootDir backend | SRS NFR-14; SAD §3 | `render.yaml:1-16` | read |
| The SPA is on Vercel with an `/api` rewrite | SRS NFR-14; known-limitations D19 | `frontend/vercel.json:3-6`; `render.yaml:11` | read |
| `requirements.txt` is 5 unpinned packages; root is a shim | SRS §7 C-2; known-limitations §7.5 | `backend/requirements.txt:1-5`; root file is one line | read |
| There is no Docker, no CI, no migration tooling | known-limitations §7.2, §7.3 | no `Dockerfile`; no CI config in the tree | ran |
| The API cannot boot without Supabase credentials | SRS §7 C-3; known-limitations §7.1 | `backend/config/settings.py:59-63`, `:75` | read |
| All repository HTTP is synchronous `httpx.Client` inside `async def` routes | SRS §7 C-4; known-limitations §5.1 | `backend/supabase_client.py:69`; `backend/api/routes/progress.py:21` | read |
| `supabase_client.get_user` **is** async with a 5 s timeout | SAD §8.3; known-limitations §5.1 | `backend/supabase_client.py:87-98` | read |

## 7. Provenance and discrepancy claims

| Claim | Doc + section | Evidence | How verified |
|---|---|---|---|
| HEAD is `3838343` on branch `refactor/ui/ux`, 115 commits | PRD preamble; known-limitations §11 | `git log -1`, `git rev-list --count HEAD`, `git rev-parse --abbrev-ref HEAD` | ran |
| Auth is Supabase, settled by commit `004e0f9` (2026-05-24 "Migrate to Supabase Auth") | known-limitations D3 | `git log` | ran |
| Four Better Auth remnants survive | known-limitations D3 | `database/init.sql:4`; `frontend/vite.config.js:24-28`; `frontend/src/pages/LandingPage.jsx:21`; `frontend/src/pages/LevelSelectPage.jsx:142`; plus `.gitignore:4` and a vestigial `VITE_AUTH_URL` | read |
| Decision dates in the ADR log come from git history | design-decisions, all ADRs | `git log --format='%h %ad %s' --date=short` — `665efca`, `8e3e257`, `8da7c1f`, `c16410c`, `bbf70f6`, `e33d7b2`, `2934bd1`, `2654243`, `54ed140`, `82c9077`, `df6f35d`, `1c7f932`, `8388a57` | ran |
| The "46 tests" figure is historical, from commit `df6f35d` | known-limitations D11 | `git log` subject: "test(engine): 46 unit tests for parser, validator, laws, solver and sandbox" | ran |
| `REFACTOR_REPORT.md` is stale in 5 quantitative claims and 4 inventories | REFACTOR-NOTES §7 | 24-row reconciliation table, each row checked against the tree | ran + read |
| `ARCHITECTURE.md` §5 mis-describes guide handling as "ignoring guides in the assistance total" | REFACTOR-NOTES §7 | `docs/ARCHITECTURE.md:274` vs `backend/services/scoring_service.py:51` (the sum) and `backend/services/progress_service.py:101` (the write) | read |
| The deleted export `definitionsForId` left a dangling doc comment | REFACTOR-NOTES §6; known-limitations §8 | `frontend/src/engine/laws/definitions.js:67`; grep → 0 occurrences of the symbol | ran + read |
| GROUND-TRUTH's "48 puzzles" was an arithmetic slip; the truth is 40 | PRD D10; known-limitations D10 | `content/levels.json` `[4,12,12,12]`; ran `GET /api/levels` | ran |
| The LAWS rubric says 80 % while `context.md` says 70 % — the proposal contradicts itself | known-limitations D9, §9 | `Software Proposal Writing Guide (LAWS) v2.0.docx.md:129` vs `docs/context.md:139` | read |
| The proposal's own Limitations section is reconciled claim by claim | known-limitations §9 | `Software Proposal Writing Guide (LAWS) v2.0.docx.md:139` | read |
| `docs/context.md` §11 contains a committed credential value | known-limitations D15 | `docs/context.md:233`; **value intentionally not reproduced anywhere in this suite** | read |

## 8. Claims explicitly marked unverified

These appear in `known-limitations.md` §11 and are **not** asserted as fact anywhere:

| Item | Why unverified |
|---|---|
| Whether the D21 divergence has been hit in production | No telemetry exists. Reachability is proven (3 of 19 totals); occurrence is not. |
| Supabase project settings (email confirmation, password policy, JWT expiry) | Not in the repository. The register page navigating on session implies confirmation is off — an inference, labelled as such. |
| Behaviour of the deployed Render service | All API checks were in-process. The Render host in `vercel.json:5` was read, not called. |
| Whether Supabase enforces the upsert conflict target as expected | No live upsert was performed; this pass deliberately wrote nothing to the database. |
| `.e2e/` results at this commit | Requires a dev server and a browser; not re-run for this pass. The quoted suite results come from `REFACTOR_REPORT.md` §5, attributed as such. |
| The two unwired `.e2e` suites | Not run. |

## 9. Corrections this writer reported to the Lead

| Finding | Status |
|---|---|
| `GROUND-TRUTH.md` §3 and D10 said 48 puzzles; the tree has 40 | Accepted by the Lead; convention fixed to "4 levels; Tutorial 4 stages, Levels 1–3 12 each → 40 total" |
| A third and fourth Better Auth remnant in `LandingPage.jsx:21` and `LevelSelectPage.jsx:142` | Accepted; folded into D3 |
| No OpenAPI security scheme (auth via `Depends` emits `security=None`) | Accepted as register row D22 |
| `isEquivalent` is not on the win path — completion is canonical-text equality | Accepted; corrected in PRD §1, PRD FR-23, SRS FR-23 and SAD §6, which had stated the wrong mechanism |
| `ARCHITECTURE.md` §5 wording contradicts the code on guide handling | Reported; the file is a frozen input so it was not edited |
