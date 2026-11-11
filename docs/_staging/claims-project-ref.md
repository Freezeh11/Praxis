# Claim ledger — `project-ref` (task-6)

Every substantive factual claim in the four documents this writer produced, with the evidence behind
it and how it was checked. Format follows `docs/_staging/GROUND-TRUTH.md` §9.

**Documents covered:** [`docs/10-project/glossary.md`](../10-project/glossary.md),
[`docs/10-project/file-map.md`](../10-project/file-map.md),
[`docs/10-project/changelog.md`](../10-project/changelog.md),
[`docs/rules/RULES.md`](../rules/RULES.md).

**Verified against commit** `38383439478bb3260eecc88bccc456e3e4209ec0` (short `3838343`).

Legend for **How verified**: **ran** = executed a command and read its output; **read** = read the
file and quoted it; **derived** = computed mechanically from a listing (import graph, key-set
extraction, git index).

---

## 1. Inventory and counts (the numbers most likely to be wrong)

| # | Claim | Doc + section | Evidence | How verified |
|---|---|---|---|---|
| 1.1 | The repository has **212** tracked paths, **211** after excluding the generated lockfile | file-map §1, §2 | `git ls-files \| wc -l` → 212 | **ran** |
| 1.2 | `frontend/package-lock.json` is the **only** path the exclusion filter removes | file-map §1, §22 | `comm -23 <(git ls-files\|sort) <(git ls-files\|grep -vE '…'\|sort)` → exactly that one path | **ran** |
| 1.3 | All **211** listed paths exist on disk; none is invented | file-map §1, acceptance | `git ls-files … \| while read -r f; do [ -e "$f" ] \|\| echo "MISSING: $f"; done` → no output | **ran** |
| 1.4 | file-map lists **211** rows, **0** duplicates, **0** tracked files missing, **0** invented | file-map §2 | extracted all 211 markdown link labels, diffed against the tracked list both ways → empty both ways | **derived** |
| 1.5 | Backend is **28 Python modules / 1,241 lines** | file-map §2, §4; changelog findings | `git ls-files 'backend/*.py' \| wc -l` → 28; `… \| xargs wc -l \| tail -1` → 1241 | **ran** |
| 1.6 | Backend has **29** tracked files total (the extra is `backend/requirements.txt`) | file-map §2, §4 | `git ls-files 'backend/*' \| wc -l` → 29 | **ran** |
| 1.7 | Engine has **23 non-test modules / 3,182 lines** | file-map §2, §13; changelog findings | `git ls-files 'frontend/src/engine/*.js' \| grep -v __tests__ \| wc -l` → 23; `xargs wc -l` → 3182 | **ran** |
| 1.8 | Engine has **7 test files / 1,246 lines**, and **30 files / 4,428 lines** including tests | file-map §2, §13.6; changelog findings | same split; totals 30 files / 4428 lines | **ran** |
| 1.9 | `frontend/src/engine/render.js` is 46 lines and exports `nodeText`/`canonText` | file-map §13.1 | `wc -l` → 46; `grep -oE "^export …"` on the file | **ran** |
| 1.10 | Engine test suite: **76 tests, 76 pass, 0 fail** | file-map §2, §13.6; RULES §F1 | `cd frontend && npm test` → `# tests 76 / # pass 76 / # fail 0` | **ran** |
| 1.11 | `.e2e/` has **19 `.mjs`** files and `.e2e/run-all-suites.sh` has **16** `run` lines | file-map §7; RULES §F3, §F4 | `ls .e2e/*.mjs \| wc -l` → 19; `grep -cE '^run ' .e2e/run-all-suites.sh` → 16 | **ran** |
| 1.12 | The 3 unwired `.mjs` are `_harness.mjs`, `gate-fresh-user-check.mjs`, `lead-engine-fingerprint.mjs` — i.e. **18 suites + 1 shared harness**, of which 16 suites are wired and 2 are not | file-map §7, §2; RULES §F4 | looped every `.mjs` and tested whether its basename appears in the runner → exactly those 3 absent; `ls .e2e/_*.mjs \| wc -l` → 1 (the harness), so `19 − 1 = 18` suites. **Original wording called all 19 "suites"**, which contradicted file-map §7; the verifier caught it (N2) | **ran** (clarified in remediation) |
| 1.13 | `_harness.mjs` is a shared helper imported by 13 browser suites | file-map §7 | inverted import graph over `.e2e/*.mjs` → 13 importers (excluding itself) | **derived** |
| 1.14 | `content/laws.json` holds **10** laws | file-map §2, §5; glossary "law id" | `len(json.load(...))` → 10; ids printed in authoring order | **ran** |
| 1.15 | `content/levels.json` holds **4** levels and **40** puzzles, counts `[4, 12, 12, 12]` | file-map §2, §5; glossary "level"; RULES §D4; changelog findings | `[len(l['puzzles']) for l in …]` → `[4,12,12,12]`; `grep -c '"expr"'` → 40 | **ran** |
| 1.16 | Every one of the 40 puzzles has **exactly** the same 6-key set | file-map §5; RULES §D1 | `Counter(tuple(sorted(p.keys())) …)` → one distinct member: `(expr, goal, hints, optimalHint, optimalSteps, targetLaws)` | **ran** |
| 1.17 | `frontend/src/hooks/` holds **8** files, all `use*` | file-map §2, §17; changelog findings | `ls` + `grep -c '^use'` → 8 | **ran** |
| 1.18 | `frontend/src/components/` has **65** files, of which **10** are top-level `.jsx` | file-map §2, §14; changelog findings | per-directory `git ls-files` counts: 10+2+4+16+12+11 = 65; top-level = 10 | **ran** |
| 1.19 | `frontend/src/` has **138** tracked files and **17,018** lines of `.js/.jsx/.css` | file-map §2 | `git ls-files` count; `find … \| xargs wc -l \| tail -1` | **ran** |
| 1.20 | Per-area tracked counts: root 4, backend 29, content 2, database 1, `.e2e` 22, `frontend` 148, `docs` 5 | file-map §2 | per-prefix `git ls-files \| grep -cE` counts summing to 211 | **ran** |

### 1.21 Counts I corrected, and the commands that proved them wrong

| Claim | Doc + section | Evidence | How verified |
|---|---|---|---|
| The "48 puzzles" figure is wrong; truth is **40** | changelog findings | `[4,12,12,12]`; `grep -c '"expr"'` → 40 | **ran** |
| The "30 backend Python modules" figure is wrong; truth is **28** | changelog findings | `git ls-files 'backend/*.py' \| wc -l` → 28 | **ran** |
| The "22 engine modules / 4,428 lines" pairing conflates two different counts; truth is 23 modules / 3,182 lines, with 4,428 = all 30 files including tests | changelog findings | split by `__tests__` | **ran** |
| The "9 UI hooks" figure is wrong; truth is **8** | changelog findings | `ls frontend/src/hooks/` → 8 | **ran** |
| The "8 top-level components" figure is wrong; truth is **10** | changelog findings | `git ls-files 'frontend/src/components/*.jsx'` → 10 | **ran** |
| Backend **1,241 lines** and engine **4,428-line** total are correct as previously stated | changelog findings | `wc -l` both ways | **ran** |
| `backend/venv/` contains 887 `.py` files and would inflate the module count to 915 | file-map §22; changelog findings | `find backend -name '*.py' \| wc -l` → 915 including venv | **ran** |

---

## 2. Backend layering and behaviour (RULES §A, file-map §4)

| # | Claim | Doc + section | Evidence | How verified |
|---|---|---|---|---|
| 2.1 | `api/routes/*` import `services` and `core`, never `repositories` | RULES A1 | `backend/api/routes/levels.py:13`, `backend/api/routes/score.py:15`; inverted import graph | **read** + **derived** |
| 2.2 | `services/*` import `repositories`, never `api` | RULES A1 | `backend/services/content_service.py:11`, `backend/services/progress_service.py:12` | **read** |
| 2.3 | `repositories/*` import `core.errors` and `supabase_client` only | RULES A1 | `backend/repositories/progress_repository.py:12-13` | **read** |
| 2.4 | No upward import edge exists anywhere in `backend/` | RULES A1; file-map §4.7 | full import graph over all 28 modules; every edge follows routes→services→repositories→client | **derived** |
| 2.5 | `supabase.table(...)` appears **only** in `progress_repository.py` | RULES A2; file-map §4.7 | `grep -rn "supabase.table(" backend/` → 6 hits, all in that file | **ran** |
| 2.6 | The one other `supabase.` use is `get_user` for token verification, not data access | RULES A2; glossary "bearer token" | `backend/core/security.py:27` | **read** |
| 2.7 | `main.py` is 83 lines, wiring only, and imports no `services`/`repositories`/`supabase_client` | RULES A3; file-map §4.1 | `wc -l` → 83; `backend/main.py:15-20`; docstring at `:1` | **ran** + **read** |
| 2.8 | All seven routes return the envelope except `GET /`, which is deliberately plain | RULES A6; glossary "envelope" | `backend/core/responses.py:24-43`; `backend/api/routes/health.py:1-3,15-18` | **read** |
| 2.9 | `ErrorCode` defines exactly **7** codes; there are 4 `AppError` subclasses with pinned 404/503/502/401 | RULES A5; file-map §4.3 | `backend/core/errors.py:11-20` and `:52-81` | **read** |
| 2.10 | `settings = Settings.from_env()` runs at import time and **requires** `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` | RULES A7; glossary "service_role" | `backend/config/settings.py:60-63`, `:74-75` | **read** |
| 2.11 | Render declares `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` with `sync: false` | RULES A7, G3 | `render.yaml:12-15` | **read** |
| 2.12 | `main.py` registers CORS **outside** `RequestContextMiddleware` and installs 4 exception handlers | file-map §4.1 | `backend/main.py:29-36`, `:39-76` | **read** |
| 2.13 | `X-Request-ID` is set on every response, echoed or freshly generated | file-map §4.3 | `backend/core/middleware.py:27`, `:61` | **read** |
| 2.14 | Logging emits one JSON object per line with keys `ts, level, logger, message, request_id` + merged `fields` | file-map §4.3 | `backend/core/logging.py:38-50` | **read** |
| 2.15 | `required_env` fails fast naming the missing variable | RULES A7 | `backend/config/settings.py:30-38` | **read** |
| 2.16 | `get_puzzle` rejects an out-of-range stage but keeps Python-style negative indexing | file-map §4.5 | `backend/services/content_service.py:32-42` (its own docstring says so) | **read** |
| 2.17 | `CONTENT_DIR` is `parents[2] / "content"`, so `content/` must ship beside `backend/` | file-map §4.6 | `backend/repositories/content_repository.py:16`; the failure message at `:25-31` | **read** |
| 2.18 | Content loaders are `functools.lru_cache`d | file-map §4.6 | `backend/repositories/content_repository.py:34,40` | **read** |
| 2.19 | A transport failure becomes `UpstreamError` (502) | file-map §4.6 | `backend/repositories/progress_repository.py:21-26` | **read** |
| 2.20 | `POST /api/score` queues persistence on `BackgroundTasks` only when a user is present | file-map §4.4; changelog findings | `backend/api/routes/score.py:38-39` | **read** |
| 2.21 | `persist_score` swallows storage failures and logs them | glossary "earnedPoints"; file-map §4.5 | `backend/services/progress_service.py:123-127` | **read** |
| 2.22 | `supabase_client.py` avoids the official SDK to dodge pyiceberg/C++ build deps and implements only `eq` + select/insert/upsert | file-map §4.1 | `backend/supabase_client.py:16-20`, `:44-65` | **read** |
| 2.23 | The `stage_progress` conflict key is `user_id,level_id,stage_idx` | glossary "stage" | `backend/repositories/progress_repository.py:18`; `database/init.sql:24` | **read** |
| 2.24 | `GET /` returns `{"message":"Praxis API is running","docs":"/docs"}` | file-map §4.2 | `backend/api/routes/health.py:16-18` | **read** |

---

## 3. Scoring and numbers (glossary, RULES §D, changelog)

| # | Claim | Doc + section | Evidence | How verified |
|---|---|---|---|---|
| 3.1 | Weights are 40/30/30 and `MAX_SCORE` is derived by adding them | glossary "score weight"; RULES §B4 | `backend/config/constants.py:9-12`; mirror `frontend/src/config/gameRules.js:14-18` | **read** |
| 3.2 | `STEP_PENALTY` and `ASSISTANCE_PENALTY` are both 10.0; `MAX_BONUS_POINTS` is 5; `SCORE_ROUNDING_DP` is 1 | glossary "earnedPoints", "guide" | `backend/config/constants.py:15-22` | **read** |
| 3.3 | `STAR_THRESHOLDS = (90.0, 75.0)`; `UNLOCK_AVERAGE = 80.0` | glossary "star rating", "unlock threshold" | `backend/config/constants.py:25-26` | **read** |
| 3.4 | `earnedPoints = round((total / 100) * MAX_BONUS_POINTS)` — hence 5 at a perfect score | glossary "earnedPoints" | `backend/services/scoring_service.py:55` | **read** |
| 3.5 | The optimal step count is `min(declared, steps_used)`, so a shorter solution lowers the bar | RULES §D5 | `backend/services/scoring_service.py:80-88` | **read** |
| 3.6 | No declared target laws ⇒ the target-law band is full 30 | glossary "target law" | `backend/services/scoring_service.py:99-107` | **read** |
| 3.7 | `guidesUsed` and `hintsUsed` are summed into one `assistance` figure that drives the 30-point band | glossary "guide" | `backend/services/scoring_service.py:51-52` | **read** |
| 3.8 | `GUIDE_COST_POINTS = 20` is a point spend, separate from the 10-point score penalty | glossary "guide" | `frontend/src/config/gameRules.js:35`; `backend/config/constants.py:16` | **read** |
| 3.9 | Stars are ≥90→3, ≥75→2, else 1; a completed stage with no score counts as 1 | glossary "star rating" | `frontend/src/state/progressStore.js:281-284`, `:298` | **read** |
| 3.10 | Unlock requires **both** all stages done **and** average ≥ 80 | glossary "unlock threshold"; RULES §D4 | `frontend/src/state/progressStore.js:309` | **read** |
| 3.11 | `STAGE_COMPLETION_XP = 10`; `earnedPoints` is a bonus on top | glossary "XP", "earnedPoints" | `frontend/src/config/gameRules.js:32`; `backend/services/scoring_service.py:55` | **read** |
| 3.12 | The client mirror uses `Math.round`, the backend uses Python `round()` (banker's rounding), so they can differ by 1 | glossary "banker's rounding" | `frontend/src/engine/scoring.js:80` vs `backend/services/scoring_service.py:55`; semantics confirmed by running both | **read** + **ran** |
| 3.13 | Python `round(2.5)` → 2 while JS `Math.round(2.5)` → 3 | glossary "banker's rounding" | `python3 -c "print(round(2.5))"` → 2; `node -e "console.log(Math.round(2.5))"` → 3 | **ran** |
| 3.14 | `TIMING.lawAnimationMs = 1350` and `preLawHighlightMs = 1500` | file-map §15 | `frontend/src/config/gameRules.js:58-79` | **read** |
| 3.15 | `SOLVER_BUDGET` and `SANDBOX.budget` are measured values with the worst case documented in comments | RULES §D4 | `frontend/src/config/gameRules.js:115-132`, `:173-181` | **read** |

---

## 4. Frontend layering, engine and content (RULES §B, §C, §D)

| # | Claim | Doc + section | Evidence | How verified |
|---|---|---|---|---|
| 4.1 | `fetch(` appears **exactly once** in `frontend/src/`, at `apiClient.js:63` | RULES B1; file-map §11; glossary "engine contract" | `grep -rn "fetch(" frontend/src/` → 1 line | **ran** |
| 4.2 | The "components must never call fetch directly" rule is written in the code | RULES B1 | `frontend/src/services/apiClient.js:5-6` | **read** |
| 4.3 | Only 3 modules consume `apiRequest`: `contentApi`, `progressApi`, `scoreApi` | file-map §11 | inverted import graph for `services/apiClient.js` | **derived** |
| 4.4 | The engine imports no React/router/Supabase, has no DOM/storage/network access | RULES B2; file-map §13 | three greps over `frontend/src/engine/` all return nothing | **ran** |
| 4.5 | The engine's only external import is `config/gameRules.js` | RULES B2 | `engine/solver.js:1`, `engine/scoring.js:14-18`, `engine/sandbox/generator.js:11`, `engine/sandbox/validate.js:26`, `engine/sandbox/input.js:36` | **read** |
| 4.6 | Nothing in `engine/` imports upward into `components/`, `pages/`, `state/`, `services/` or `hooks/` | RULES B2; file-map §13.5 | `grep -rn "from '\.\./\(components\|pages\|state\|services\|hooks\)" frontend/src/engine/` → no matches | **ran** |
| 4.7 | The purity rule is stated as "enforced by review, not by the bundler" | RULES B2, H | `frontend/src/engine/index.js:9` | **read** |
| 4.8 | All 7 in-app engine consumers import the barrel, not deep modules | RULES B3; file-map §13.1 | inverted import graph for `engine/index.js` | **derived** |
| 4.9 | `config/gameRules.js` is imported by **21** files (20 excluding tests) | file-map §15; RULES B4 | `grep -rlE "from '[^']*config/gameRules(\.js)?'" frontend/src \| wc -l` → 21. **Original method was wrong:** this row previously claimed 22 and cited `grep -rln "gameRules" frontend/src` → 22, a *text* match that also hits a comment in `frontend/src/engine/index.js:10`; the verifier caught it (m10). Counted imports, not mentions | **ran** (corrected in remediation) |
| 4.9b | `config/gameRules.js`, `config/storageKeys.js` and `config/appLinks.js` together are imported by **24** files (23 excluding tests) | file-map §15 | `grep -rlE "from '[^']*(config/gameRules\|config/storageKeys\|config/appLinks)" frontend/src \| wc -l` → 24; `… \| grep -v __tests__ \| wc -l` → 23 | **ran** (added in remediation, m1) |
| 4.10 | The "tunable numbers in one place" rule is stated in the file, with the four-places history | RULES B4 | `frontend/src/config/gameRules.js:1-11` | **read** |
| 4.11 | Storage keys are namespaced `praxis_` and defined in one file; the e2e harness re-exports them | RULES E6 | `frontend/src/config/storageKeys.js:10-28`; `.e2e/_harness.mjs:54-60` | **read** |
| 4.12 | `authContext.js` and `authInputStyles.js` exist to keep component/hook exports in separate files (Fast Refresh) | RULES B6 | `frontend/src/state/authContext.js:1-6`; `frontend/src/components/ui/authInputStyles.js:1-5` | **read** |
| 4.13 | `react-refresh` is enabled in the flat ESLint config | RULES B6, H | `frontend/eslint.config.js:14` | **read** |
| 4.14 | No `no-restricted-imports` or boundary plugin is configured | RULES §H | `grep -n "no-restricted-imports\|boundaries\|import/" frontend/eslint.config.js` → nothing | **ran** |
| 4.15 | There is **no** algebra code in `backend/` | RULES C1; glossary "engine contract" | backend content layer returns JSON verbatim (`content_repository.py:19-43`); scoring layer consumes pre-computed numbers (`api/schemas/score.py:13-21`); no parser/AST/law module exists in `backend/` | **read** + **derived** |
| 4.16 | The engine's public surface is the barrel, which re-exports the AST, traversal, parsing, rendering, normalization, validation, semantics, law detection, search, scoring and sandbox APIs | file-map §13.1 | `frontend/src/engine/index.js:16-84`; export list extracted mechanically | **ran** |
| 4.17 | The node-path convention is `'R'`, `'R.1'`, `'R.1.0'`, with `.0` for a `not` child | glossary "node path" | `frontend/src/engine/tree.js:4-8`; `getNode` at `:14` | **read** |
| 4.18 | Hints are reported as `{ law, paths }`, de-duplicated by `law\|paths`, in traversal order | glossary "hint" | `frontend/src/engine/laws/scanHints.js:8-9`, `:26-31` | **read** |
| 4.19 | A derivation step is `{ law: <display name>, from, to }` | glossary "derivation step" | `frontend/src/state/useGameState.js:425` | **read** |
| 4.20 | History is append-only, with `undoAction` removing the last entry and no edit path | glossary "step-locking" | `frontend/src/state/useGameState.js:15-18`, `:461` | **read** |
| 4.21 | The sandbox replays a proposed solution through the same moves the UI offers, "what step-locking relies on" | glossary "step-locking"; RULES C4 | `frontend/src/engine/sandbox/input.js:60-70`, `:165` | **read** |
| 4.22 | `distributive-expand` is engine-only, absent from `content/laws.json`, and gated behind `allowExpand` (default `false`) | glossary "distributive-expand" | `frontend/src/engine/laws/definitions.js:44`; `solver.js:172,255`; `sandbox/input.js:196`; `laws.test.js:106-109` | **read** + **ran** (`git grep`) |
| 4.23 | Corpus law ids and engine law ids currently agree (10 each) | RULES C3 | extracted `id` from `content/laws.json` and from `LAW_DEFINITIONS` and diffed | **derived** |
| 4.24 | **No test** compares `content/laws.json` to `LAW_DEFINITIONS` | RULES C3 (flagged unverified) | `grep -rn "laws.json" frontend/src/engine/__tests__/` → no matches | **ran** |
| 4.25 | The random generator emits the same 6-key puzzle shape as authored puzzles | RULES D1 | `frontend/src/engine/sandbox/generator.js:137` | **read** |
| 4.26 | `optimalHint` is consumed by the score modal; `hints` by the game state | RULES D1 | `frontend/src/components/puzzle/ScoreModal.jsx:154-156`; `frontend/src/state/useGameState.js:514-515` | **read** |
| 4.27 | Tutorial narration lives in `tutorialContent.js`, not in `content/*.json` | RULES D6 | `frontend/src/content/tutorialContent.js:1-5`; consumers `WelcomeModal.jsx`, `useTutorialProgress.js` | **read** |
| 4.28 | `TUTORIAL = { levelId: 0, stageIndexes: [0,1,2,3] }` and the gate hardcodes `TUTORIAL_LEVEL_ID = 0` | RULES D3; glossary "level", "tutorial gate" | `frontend/src/config/gameRules.js:82-85`; `frontend/src/components/TutorialGate.jsx:4-5` | **read** |
| 4.29 | The tutorial gate is a UX gate, not a security boundary; it exempts the tutorial route and waits for hydration | glossary "tutorial gate" | `frontend/src/components/TutorialGate.jsx:18-30` | **read** |
| 4.30 | The orientation gate has three outcomes and does no User-Agent sniffing | glossary "orientation gate" | `frontend/src/components/OrientationGate.jsx:1-10` | **read** |
| 4.31 | `App.jsx` declares **9** routes, with everything under `/levels` wrapped `ProtectedRoute > TutorialGate` | file-map §9; glossary "level" | `frontend/src/App.jsx:30-57` | **read** |
| 4.32 | `/sandbox/play` reuses `ProblemPage`, and the absence of route params is what selects sandbox mode | glossary "sandbox" | `frontend/src/App.jsx:48-53` | **read** |
| 4.33 | The Vite `@content` alias points at `<repo>/content` and `server.fs.allow` is widened to the repo root | RULES C2; file-map §8 | `frontend/vite.config.js:14-22` | **read** |
| 4.34 | The `/api/auth` → `127.0.0.1:3001` proxy precedes `/api` and targets a service that does not exist | glossary "Better Auth" | `frontend/vite.config.js:24-28` | **read** |
| 4.35 | `database/init.sql`'s header claims Better Auth tables via `npx auth migrate`, and no such tooling is tracked | glossary "Better Auth" | `database/init.sql:4`; no `auth-server/` in `git ls-files` | **read** + **ran** |
| 4.36 | RLS is enabled on all three tables with one `FOR ALL USING (true)` policy each, permissive to every role | glossary "RLS"; changelog findings | `database/init.sql:49-58` | **read** |
| 4.37 | There is no `auth.uid() = user_id` predicate anywhere | glossary "RLS" | `grep -n "auth.uid()" database/init.sql` → no matches | **ran** |
| 4.38 | Per-user isolation is enforced in code by `.eq("user_id", …)` | glossary "RLS" | `backend/repositories/progress_repository.py:32,40,51-52` | **read** |
| 4.39 | `package.json`'s test script is exactly `node --test src/engine/__tests__/*.test.js` | RULES F1 | `frontend/package.json:11` | **read** |
| 4.40 | The sound mixer is module state and every cue comes from `gameRules.SOUND` | file-map §11 | `frontend/src/services/soundEffects.js:1-14`; `frontend/src/config/gameRules.js:148-170` | **read** |

---

## 5. Testing, enforcement and process (RULES §F, §H)

| # | Claim | Doc + section | Evidence | How verified |
|---|---|---|---|---|
| 5.1 | **No CI configuration is tracked** | RULES §H; changelog findings | `git ls-files \| grep -iE "\.github\|workflow\|\.gitlab\|Jenkinsfile\|\.circleci"` → nothing | **ran** |
| 5.2 | The `.e2e` runner does not fail the shell on a failing suite; it prints `exit=N` and continues | RULES F3; changelog "How to run the checks" | `.e2e/run-all-suites.sh:6-14`, `:31` | **read** |
| 5.3 | `.e2e/run-all-suites.sh:26` runs the popup suite a second time with `SKIP_TIP=1` | RULES F3 | `.e2e/run-all-suites.sh:26` | **read** |
| 5.4 | Browser suites use one shared seeded e2e account whose progress persists, so `resetE2eProgress()` must be called first | RULES F5 | `.e2e/_harness.mjs:86-115`, `:126-156` | **read** |
| 5.5 | `resetE2eProgress()` returns `null` when credentials are unavailable so callers skip rather than fail | RULES F5 | `.e2e/_harness.mjs:97-99`, `:104-106` | **read** |
| 5.6 | 13 of the 16 wired suites drive a browser; 3 are pure node | file-map §7 | `_harness` importer set (13 wired) vs the 3 node-only suites | **derived** |
| 5.7 | A hardcoded e2e test-account password is committed | RULES G3; changelog findings | `.e2e/_harness.mjs:47` (value **not reproduced** anywhere in the docs) | **read** |
| 5.8 | `.env` files are gitignored and were **not** tracked | RULES G3 | `.gitignore:3`; `frontend/.gitignore:12-13`; `git ls-files` contains neither | **read** + **ran** |
| 5.9 | The checker enforces 5 secret patterns and validates mermaid fence heads | RULES G3, G6 | `docs/_staging/tools/check-docs.mjs:70-77`, `:228-249` | **read** |
| 5.10 | The checker resolves every relative link and intra-doc anchor | RULES G1 | `docs/_staging/tools/check-docs.mjs:161-193` | **read** |
| 5.11 | The checker counts `file:line` citations per document | RULES G2 | `docs/_staging/tools/check-docs.mjs:129` | **read** |
| 5.12 | The suite's terminology authority is stated in the hub | RULES G4 | `docs/README.md:228-229` | **read** |
| 5.13 | The legacy files are kept as historical inputs and the new suite wins | RULES G7 | `docs/README.md:186-197` | **read** |
| 5.14 | All four documents are ≥ 30 lines (the checker's threshold) | changelog "Verification method" | `check-docs.mjs` output: glossary 781, file-map 689, changelog 285, RULES 880 lines | **ran** |

---

## 6. Naming conventions (RULES §E) — all derived mechanically

| # | Claim | Doc + section | Evidence | How verified |
|---|---|---|---|---|
| 6.1 | Every backend `def` is `snake_case` (only `__init__`/`__repr__` are not) | RULES E1 | extracted all `def` names from the 28 tracked modules and filtered | **derived** |
| 6.2 | All **17** backend classes are `PascalCase` | RULES E1 | extracted all `^class` names; listed them in the rule | **derived** |
| 6.3 | All **18** module-level constants are `SCREAMING_SNAKE_CASE` | RULES E1 | extracted all `^[A-Z][A-Z0-9_]+ = ` names from the 28 tracked backend modules only (an unscoped grep picks up hundreds of names from `backend/venv/`) | **derived** |
| 6.4 | **9** of 28 backend modules carry an explicit "Imported by …" docstring line | RULES E2 | `grep -l "Imported by" $(git ls-files 'backend/*.py') \| wc -l` → 9; the 9 paths are listed in the ledger above | **ran** |
| 6.5 | All 7 pages are `PascalCase.jsx`; all 8 hooks are `use*`; HTTP services are `*Api.js`; 7 engine tests are `*.test.js` | RULES E3 | `ls` per directory | **ran** |
| 6.6 | The 10 top-level engine modules are lowercase single words; `laws/` uses lowerCamelCase | RULES E4 | file listing | **ran** |
| 6.7 | All 10 content law ids and the 11th engine id are kebab-case | RULES E5 | extracted `id` values from both sources | **derived** |
| 6.8 | All 7 storage keys start with `praxis_` | RULES E6 | `frontend/src/config/storageKeys.js:10-28` | **read** |
| 6.9 | The `praxis-*` utility prefix is used in `utilities.css` (24 occurrences) | RULES E7 | `grep -c "praxis-" frontend/src/styles/utilities.css` → 24 | **ran** |
| 6.10 | Design tokens reachable by class name live in `tailwind.config.js`; only inline-only values become CSS custom properties | RULES E7 | `frontend/src/styles/tokens.css:1-9` states it; `frontend/tailwind.config.js` holds the colour/radius/shadow scale | **read** |
| 6.11 | Client-exposed env vars use the `VITE_` prefix | RULES E8 | `frontend/src/services/supabaseClient.js:6-7`; `frontend/vite.config.js:8` | **read** |
| 6.12 | Backend env vars are `SCREAMING_SNAKE` | RULES E8 | `backend/config/settings.py:60-62` | **read** |

---

## 7. Claims I could NOT verify (recorded, not guessed)

| # | Open question | Where it is flagged | Why it stayed open |
|---|---|---|---|
| 7.1 | Why `vite.config.js` proxies `/api/auth` to port 3001 | glossary "Better Auth"; changelog "Unverified claims" | No tracked artifact explains the intent; documented as a dead remnant, not as a decision. |
| 7.2 | Whether `frontend/package-lock.json` is intentionally committed | file-map §22; changelog "Unverified claims" | Not determinable from the repository. It is excluded as generated, and the exclusion is stated explicitly. |
| 7.3 | The exact runtime of `npm test` | changelog "Unverified claims" | Observed between ~9.4 s and ~13.7 s across runs; only pass/fail counts are documented as fact. |
| 7.4 | Whether a `targetLaws` id could ever be unsatisfiable in practice (e.g. reachable only via `distributive-expand`) | RULES §D2 | Checked that all used ids exist in `content/laws.json`; did **not** run a full solvability proof per puzzle. RULES §D5 flags authored-puzzle verification as a manual step. |
| 7.5 | Whether the e2e suites all currently pass | RULES §F3; changelog "How to run the checks" | Running `.e2e/run-all-suites.sh` requires a live frontend + backend + Playwright/Chromium; this writer verified the **inventory and wiring** only, not the pass state. |

---

## 8. Post-write verification performed on this writer's own output

| # | Check | Command / method | Result |
|---|---|---|---|
| 8.1 | file-map lists every tracked file exactly once | extracted 211 link labels; diffed against `git ls-files` both ways | 211 listed, 0 missing, 0 extra, 0 duplicates |
| 8.2 | Every path listed in file-map exists on disk | `[ -e "$f" ]` over the tracked list | no `MISSING:` output |
| 8.3 | Every relative link in the four docs resolves | `node docs/_staging/tools/check-docs.mjs` | all of this writer's links OK except files owned by other writers that had not landed yet at check time (see §9) |
| 8.4 | Every intra-doc anchor matches the checker's slug algorithm | ran the checker's exact `slug()`/`headingsOf()` logic over all anchors in the four docs, then again via `check-docs.mjs` | all fixed; 0 remaining `BADANCH` in this writer's files |
| 8.5 | No inline-code snippet creates a false "link" | `check-docs.mjs` link scan | 2 false positives found and rewritten (a grep pattern containing `](`); 0 remaining |
| 8.6 | No reproduced secret | `check-docs.mjs` secret scan | clean for all four documents |
| 8.7 | Each document is ≥ 30 lines and carries `file:line` citations | `check-docs.mjs` completeness block | glossary 781 lines/85 cites, file-map 689/20, changelog 285/2, RULES 880/94 |

---

## 9. Hand-off notes for the Lead and the verifier

1. **The four count corrections are in `docs/_staging/GROUND-TRUTH.md`'s register now** (Lead
   confirmed and edited that file). Use these phrasings everywhere:
   "**28 Python modules / 1,241 lines**" for the backend, and
   "**23 engine modules / 3,182 lines excluding tests**" (or "30 files / 4,428 lines including the
   7 test files") for the engine. Never "30 backend modules" or "22 modules / 4,428 lines", and the
   puzzle total is **40**.
2. **Nine links in this slice point at documents owned by other writers that had not landed when
   this task was completed.** They are correct in intent and all three targets are on the Lead's
   required-documents list, so they will resolve once those writers finish. **Re-run
   `node docs/_staging/tools/check-docs.mjs` after all writers finish** and confirm the count below
   drops to zero.

   | Pending target | Owner (task) | Links from |
   |---|---|---|
   | `docs/07-explanation/known-limitations.md` | product-arch (task-5) | [glossary.md:743](../10-project/glossary.md), [changelog.md:58](../10-project/changelog.md), [changelog.md:121](../10-project/changelog.md), [changelog.md:211](../10-project/changelog.md), [RULES.md:803](../rules/RULES.md) |
   | `docs/09-diagrams/DIAGRAMS.md` | diagrams (task-7) | [changelog.md:60](../10-project/changelog.md), [changelog.md:214](../10-project/changelog.md) |
   | `docs/verification-report.md` | verifier (task-8) | [changelog.md:65](../10-project/changelog.md), [changelog.md:284](../10-project/changelog.md) |

   Every other link in all five of this writer's files resolves today: **694 relative links
   checked, 0 bad anchors, 9 pending targets, 0 other defects.**
3. **Two rules deserve a test**, because both currently fail silently: law-id parity between
   `content/laws.json` and `frontend/src/engine/laws/definitions.js` (RULES C3), and the six-key
   puzzle shape in `content/levels.json` (RULES D1). Neither is machine-checked today.
4. **There is no CI.** Every check this ledger describes was run by hand on one machine. If a
   pipeline is ever added, the commands in
   [changelog.md "How to run the checks"](../10-project/changelog.md#how-to-run-the-checks) are the
   ones worth wiring in.
