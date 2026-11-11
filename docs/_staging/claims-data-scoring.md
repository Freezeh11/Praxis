# Claim ledger — data-scoring (task-1)

**What this is:** every substantive factual claim in my deliverables, with the evidence and how I
verified it. The verifier spot-checks this table, so every row must be reproducible.
**Deliverables covered:** [../03-database/SCHEMA.md](../03-database/SCHEMA.md),
[../03-database/ERD.md](../03-database/ERD.md),
[../06-reference/scoring-and-rewards.md](../06-reference/scoring-and-rewards.md).

**How verified** legend: `read` = read the cited lines; `ran` = executed the command shown;
`grep` = pattern search over the repo; `counted` = derived numbers produced by running code.

**Environment for every `ran` row:** `/home/xris/Documents/GitHub/Praxis`, Python from
`backend/venv/bin/python` (backend `.env` present, so the settings singleton imports), Node for the
frontend mirror. Commands are quoted verbatim and can be pasted.

---

## A. Database claims

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| The entire schema is one 58-line file and creates exactly three tables | SCHEMA.md — Where the schema lives; How to read this reference | `database/init.sql:1-58` | read (`wc -l database/init.sql` → 58) + `grep -rn "CREATE TABLE" --include=*.sql .` → exactly 3 hits at `database/init.sql:7,16,28` |
| All three tables live in the `public` schema; no `CREATE SCHEMA` exists | SCHEMA.md — Where the schema lives | absence in `database/init.sql` | read the whole file + `grep -n "CREATE SCHEMA" database/init.sql` → no match |
| `user_progress.user_id` is both the primary key and the FK to `auth.users(id)`, `ON DELETE CASCADE` | SCHEMA.md — user_progress | `database/init.sql:8` | read |
| `user_progress` columns `points` / `streak` / `best_streak` are `INTEGER DEFAULT 0` and are nullable | SCHEMA.md — user_progress | `database/init.sql:9-11` | read |
| `user_progress.updated_at` is nullable `TIMESTAMPTZ DEFAULT now()` and nothing ever refreshes it (no trigger, no writer sends it) | SCHEMA.md — user_progress | `database/init.sql:12`; payload omits it at `backend/services/progress_service.py:63-70` | read + `grep -n "TRIGGER" database/init.sql` → no match |
| `stage_progress` has an `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` plus the seven other columns exactly as tabulated | SCHEMA.md — stage_progress | `database/init.sql:16-25` | read |
| `stage_progress` carries `UNIQUE(user_id, level_id, stage_idx)` | SCHEMA.md — stage_progress; Constraints in full | `database/init.sql:24` | read |
| That UNIQUE constraint is the upsert conflict target (`on_conflict=user_id,level_id,stage_idx`) | SCHEMA.md — stage_progress | `backend/repositories/progress_repository.py:18` and `:65-68` | read + `grep -rn "on_conflict\|STAGE_CONFLICT_COLUMNS" backend/repositories/progress_repository.py` |
| A broken progress write surfaces as `UpstreamError("Progress storage is unavailable")` | SCHEMA.md — stage_progress | `backend/repositories/progress_repository.py:21-26` | read |
| `score_history` has 13 columns, all `NOT NULL` except `created_at` | SCHEMA.md — score_history | `database/init.sql:28-42` | read |
| `score_history.laws_used` is `TEXT[]` and stores law ids as submitted, duplicates included | SCHEMA.md — score_history | `database/init.sql:34`; `backend/services/scoring_service.py:22,61` | read |
| `score_history.hints_used` stores hints **plus** Guides (one assistance figure), not hints alone | SCHEMA.md — score_history; scoring-and-rewards.md — Hints and Guides | `backend/services/scoring_service.py:51` → `backend/services/progress_service.py:101` | read (two-hop trace of `assistance_used`) |
| `score_history.earned_points` is the bonus only, not the 10-point base XP — and it is **not** bounded to 0–5: it scales with the unclamped `total` | SCHEMA.md — score_history; ERD.md — SCORE_HISTORY; scoring-and-rewards.md — Limits | `backend/services/scoring_service.py:55`; `frontend/src/config/gameRules.js:29,32` | read + **ran** (verification-round M2): `hintsUsed: -99` → `earned_points 53` |
| **The score is not bounded.** No field of `ScoreRequest` has a lower bound, and a negative assistance count **inflates** `hint_independence` instead of being ignored | SCHEMA.md — score_history (`hint_independence`, `total`, `earned_points`); scoring-and-rewards.md — Limits row 5 | `backend/api/schemas/score.py:13-20`; `backend/services/scoring_service.py:110-115`; `backend/config/constants.py:12` | **ran**: `compute_score(level_id=1, stage_idx=0, steps_used=1, laws_used=[], hints_used=-99, guides_used=0)` → `hint_independence 1020.0, total 1060.0, earned_points 53`. Independent verifier reproduced the same via HTTP (`docs/verification-report.md` §2.4). |
| `total` has **no upper cap**; its only lower floor is 0 — `efficiency` and `hint_independence` clamp there (`backend/services/scoring_service.py:96`, `:112-115`) and `target_law` is a non-negative ratio by construction (`:103-107`) | SCHEMA.md — score_history (`total`); scoring-and-rewards.md — Limits row 5 | `backend/services/scoring_service.py:96,103-107,112-115` | read (each component is non-negative) + **ran**: all-negative inputs still returned `total 2050.0`, and the worst positive case (W6) returned `0.0` — never negative |
| `best_score` has no range guarantee either, since it stores `total` | SCHEMA.md — stage_progress (`best_score`) | `backend/services/progress_service.py:110-122`; `database/init.sql:21` (no `CHECK`) | read + grep (`grep -n "CHECK" database/init.sql` → no match) |
| The three explicit indexes are on `stage_progress(user_id)`, `score_history(user_id)`, `score_history(user_id, level_id, stage_idx)` | SCHEMA.md — Indexes in full | `database/init.sql:45-47` | read |
| `score_history` is never read back by application code; only inserted | SCHEMA.md — Indexes in full; score_history | `backend/repositories/progress_repository.py:57-59` is the only `score_history` use | grep (`grep -rn "score_history" backend --include=*.py` → only the insert path) |
| RLS is enabled on all three tables | SCHEMA.md — Row Level Security | `database/init.sql:50-52` | read |
| Each table has exactly one policy, literally named `"Service role full access"`, `FOR ALL USING (true)` | SCHEMA.md — Row Level Security | `database/init.sql:56-58` | read |
| The policies have no `TO` clause and no `WITH CHECK` clause | SCHEMA.md — Row Level Security | `database/init.sql:56-58` | read (lines quoted verbatim in the doc) |
| There is no `auth.uid()` / `auth.jwt()` predicate and no role check anywhere in the repo | SCHEMA.md — Row Level Security | `database/init.sql:54` is the only `service_role` mention; no `auth.uid` anywhere | grep (`grep -rn "auth\.uid\|auth\.jwt\|service_role\|anon" database/ backend/ --include=*.sql --include=*.py`) |
| A `TO`-less `FOR ALL` policy applies to `PUBLIC` (so also `anon`), and a `FOR ALL` policy without `WITH CHECK` reuses `USING` for writes | SCHEMA.md — Row Level Security | PostgreSQL documented behaviour; policies at `database/init.sql:56-58` | **Not executed** — no PostgreSQL client in this workspace (`which psql` → not found). Marked as documented behaviour in the doc, not as a repo-verified fact. |
| Whether the live Supabase project exposes these tables to `anon` via `/rest/v1` | SCHEMA.md — Row Level Security | — | ⚠️ **Unverified** — depends on the live project's Exposed-schemas setting and key role; no credentials used. Flagged as unverified in the doc. |
| The e2e suites do **not** prove anon access: they authenticate with the service key, which bypasses RLS | SCHEMA.md — Row Level Security | `.e2e/_harness.mjs:99-101`; `.e2e/tutorial-gate.mjs:31-32` | read |
| The frontend Supabase client is used for auth only — no table queries | SCHEMA.md — Row Level Security | `frontend/src/services/supabaseClient.js:6-10`; calls at `frontend/src/services/authActions.js:11,21,33`, `frontend/src/state/AuthProvider.jsx:23,37` | grep (`grep -rn "supabase\." frontend/src` → only `supabase.auth.*`) |
| No `CHECK` constraints exist at all | SCHEMA.md — Constraints in full | absence in `database/init.sql` | grep (`grep -n "CHECK" database/init.sql` → no match) |
| No `TRIGGER` exists at all | SCHEMA.md — Constraints in full | absence in `database/init.sql` | grep (`grep -n "TRIGGER" database/init.sql` → no match) |
| No `CREATE EXTENSION`; `gen_random_uuid()` therefore requires PostgreSQL ≥ 13 | SCHEMA.md — Constraints in full | absence in `database/init.sql`; `database/init.sql:17,29` | grep (`grep -n "EXTENSION" database/init.sql` → no match) |
| `points` is client-authoritative: the server stores the snapshot the client sends and never sums points itself | SCHEMA.md — user_progress | `backend/api/schemas/progress.py:12`; `backend/services/progress_service.py:66` | read |
| A learner with no `user_progress` row gets zeros, not an error | SCHEMA.md — user_progress; ERD.md — USER_PROGRESS | `backend/services/progress_service.py:45-47` | read |
| `stageSolutions` is silently dropped by `POST /api/progress/save` (Pydantic ignores unknown keys) | SCHEMA.md — What is NOT in the database; ERD.md — What the picture deliberately does not show | `backend/api/schemas/progress.py:11-18` | **ran**: `SaveProgressRequest.model_validate({... "stageSolutions": {...} ...})` → parsed model contains only `points, streak, bestStreak, stageProgress, stageScores` |
| `levelsCompleted` / `hasSeenTutorial` are not returned by `GET /api/progress` | SCHEMA.md — What is NOT in the database | `backend/services/progress_service.py:44-50` | read |
| `POST /api/progress/save` applies no bounds: `points: -5`, `level_id: 99`, `stage_idx: -4` and `best_score: 999.9` are all accepted and would be written as-is | SCHEMA.md — user_progress; stage_progress | `backend/api/schemas/progress.py:11-18`; writer loop `backend/services/progress_service.py:72-84` | **ran**: `SaveProgressRequest.model_validate({"progress": {"points": -5, "streak": -1, "stageProgress": {"99": [-4, 0]}, "stageScores": {"99:-4": 999.9}}})` parsed with no error, and replaying the service loop produced `upsert stage_progress(level_id=99, stage_idx=-4, best_score=999.9, completed=True)` |
| `level_id` is the 0-based content id and `0` is the Tutorial | ERD.md — The index convention; SCHEMA.md — stage_progress | `frontend/src/config/gameRules.js:82` (`TUTORIAL.levelId = 0`); `content/levels.json` | read + ran `python3` over `content/levels.json` printing each level's `id` |
| There are 40 puzzles: the Tutorial (id 0) has 4 stages and Levels 1–3 have 12 each | ERD.md — Game content is NOT in the database; SCHEMA.md — Tables at a glance | `content/levels.json` | **ran**: `python3 -c "import json;levels=json.load(open('content/levels.json'));print(sum(len(l['puzzles']) for l in levels))"` → `40`; independent check `grep -c '"expr"' content/levels.json` → `40` |
| `stage_idx` is a 0-based index into the level's `puzzles` array | ERD.md — The index convention | `backend/services/content_service.py:39-42` | read |
| `stage_idx` is rejected only when it is too large; a negative index resolves Python-style | ERD.md — The index convention; scoring-and-rewards.md — Limits and verification gaps | `backend/services/content_service.py:40-41` | **ran**: `compute_score(level_id=1, stage_idx=-1, …)` returned a normal score; `stage_idx=12` raised `NotFoundError("Stage 12 not found")` |
| There is no content table; levels/laws are JSON served from disk with `lru_cache` | ERD.md — Game content is NOT in the database | `backend/repositories/content_repository.py:16,34-43` | read |
| Missing content makes every content route return `503 content_unavailable` | ERD.md — Game content is NOT in the database | `backend/repositories/content_repository.py:24-31` | read |
| `puzzleCount` in `/api/levels` is `len(level["puzzles"])` | ERD.md — Unlocking the next level (in scoring doc) | `backend/repositories/content_repository.py:54` | read |
| `GET /api/levels/{level_id}` requires no authentication | scoring-and-rewards.md — Unlocking the next level | `backend/api/routes/levels.py:24-27` | read (no `Depends`, no security import in the module) |
| All three FKs cascade: deleting an auth user erases totals, stage rows and history | ERD.md — AUTH_USERS | `database/init.sql:8,18,30` | read |
| The backend is 1,241 lines of Python | SCHEMA.md — What is NOT in the database | `backend/**/*.py` excluding `venv`/`__pycache__` | **ran**: `find backend -name "*.py" -not -path "*/venv/*" -not -path "*/__pycache__/*" \| xargs wc -l \| tail -3` → `1241 total` |
| `completed_at` is not refreshed by a later upsert (PostgREST updates only payload columns) | SCHEMA.md — stage_progress | payload at `backend/services/progress_service.py:114-122` omits `completed_at` | read + inferred from documented PostgREST upsert semantics — **flagged in the doc as not executed against a live database** |

## B. Scoring claims

| Claim | Doc + section | Evidence (file:line) | How verified |
|---|---|---|---|
| The six weights/penalties are 40 / 30 / 30 / 10 / 10 / 5 | scoring-and-rewards.md — Where the rules live | `backend/config/constants.py:9-19` | read |
| `MAX_SCORE` is computed as the sum `= 100.0` | scoring-and-rewards.md — Where the rules live | `backend/config/constants.py:12` | read |
| `SCORE_ROUNDING_DP = 1` | scoring-and-rewards.md — Where the rules live | `backend/config/constants.py:22` | read |
| The frontend mirrors the same numbers in `gameRules.js` | scoring-and-rewards.md — Where the rules live | `frontend/src/config/gameRules.js:14-55` | read |
| `optimal` resolves as: positive override → else the puzzle's `optimalSteps` → else `stepsUsed` | scoring-and-rewards.md — The algorithm, step by step | `backend/services/scoring_service.py:80-86` | read + **ran** (`optimalSteps: 0` and `-3` both fell back to the content value `3`) |
| `optimal` is then clamped with `min(optimal, steps_used)`, so a shorter solution lowers the bar | scoring-and-rewards.md — The optimal step count; W2 | `backend/services/scoring_service.py:87-88` | read + **ran**: W2 returned `breakdown['optimalSteps'] = 2` while `content/levels.json` declares 3 |
| Efficiency is 40 at or below the optimum, else `max(0, 40 − 10 × over)` | scoring-and-rewards.md — Efficiency | `backend/services/scoring_service.py:91-96` | read + **ran** (W3 over-2 → 20.0; W6 over-8 → 0.0) |
| Target-law credit is the set intersection proportion, rounded to 1 dp | scoring-and-rewards.md — Target laws | `backend/services/scoring_service.py:99-107` | read + **ran** (W4 2-of-3 → 20.0; W7 1-of-2 → 15.0; W3 1-of-3 → 10.0) |
| An empty `targetLaws` set awards the full 30 | scoring-and-rewards.md — Target laws; W8 | `backend/services/scoring_service.py:101-102` | **ran**: `_target_law(set(), set())` → `30.0`, and a stubbed `get_puzzle` run of the real `compute_score` → `total 100.0` |
| No shipped puzzle omits `targetLaws` (so the empty-set branch is unreachable via shipped content) | scoring-and-rewards.md — Target laws; W8 | `content/levels.json` | **ran**: scan of all 40 puzzles → `puzzles with empty/absent targetLaws: []` |
| `distributive-expand` is an engine law id that is not one of the ten reference cards, so it earns no `distributive` credit | scoring-and-rewards.md — Target laws | `frontend/src/engine/laws/definitions.js:44,63-65`; `content/laws.json` (10 ids) | **ran**: `[l['id'] for l in laws]` → 10 ids, `distributive-expand` absent |
| `assistance = (hints or 0) + (guides or 0)` and hint independence is `max(0, 30 − 10 × assistance)` | scoring-and-rewards.md — Hint independence | `backend/services/scoring_service.py:51,110-115` | read + **ran** (W3 assistance 2 → 10.0; W6 assistance 4 → 0.0) |
| `guides_used=None` is treated as 0 | scoring-and-rewards.md — The algorithm, step by step | `backend/services/scoring_service.py:51` | **ran**: `guides_used=None` → `assistance_used = 0` |
| `total = round(eff + targetLaw + hintIndep, 1)` | scoring-and-rewards.md — The algorithm, step by step | `backend/services/scoring_service.py:54` | read + **ran** (all eight examples) |
| `earnedPoints = round((total / 100) × 5)` | scoring-and-rewards.md — The algorithm, step by step | `backend/services/scoring_service.py:55` | read + **ran** |
| The breakdown echoes exactly eight fields | scoring-and-rewards.md — The breakdown object | `backend/services/scoring_service.py:68-76` | read + **ran** (printed breakdown for W1) |
| `lawsUsed` duplicates are preserved in the outcome but the intersection is a set | scoring-and-rewards.md — Target laws | `backend/services/scoring_service.py:47,61,72` | **ran**: `lawsUsed: ["absorption","absorption"]` → `laws_used=('absorption','absorption')`, matched once |
| Python `round()` is half-to-even: `round(4.5) = 4`, `round(2.5) = 2`, `round(0.5) = 0` | scoring-and-rewards.md — The rounding trap | `backend/services/scoring_service.py:55` | **ran**: real scorer on W4 → `total 90.0, earned_points 4`; W5 → `total 50.0, earned_points 2` |
| JS `Math.round` is half-up: `Math.round(4.5) = 5`, `Math.round(2.5) = 3` | scoring-and-rewards.md — The rounding trap | `frontend/src/engine/scoring.js:80` | **ran** in Node: `estimateScore` W4 → `earnedPoints 5`; W5 → `3`; plus `Math.round(4.5)=5`, `Math.round(2.5)=3` |
| Exactly three reachable totals diverge (10.0, 50.0, 90.0), and 19 totals are reachable in all | scoring-and-rewards.md — The rounding trap | component value sets from `backend/services/scoring_service.py:91-115` | **counted**: enumerated `{0,10,20,30,40} × {0,10,15,20,30} × {0,10,20,30}`, rounded each total both ways → divergence at 10, 50, 90 only |
| `SCORE_ROUNDING_DP = 1` is currently a no-op because every component is a multiple of 5 | scoring-and-rewards.md — The rounding trap | `backend/config/constants.py:22`; component values above | **counted** (same enumeration: all reachable totals are exact at 1 dp) |
| The learner is credited the browser's value and the database stores the server's | scoring-and-rewards.md — Which number the learner ends up with | `frontend/src/components/puzzle/usePuzzleSession.js:190-192` (credit) vs `:208-213` (server replaces the result); `backend/services/progress_service.py:101-106` (stored) | read (line-by-line trace of both paths) |
| Points are credited only on the first completion of a stage | scoring-and-rewards.md — What the learner actually ends up with | `frontend/src/components/puzzle/usePuzzleSession.js:190-192` (`if (isFirstTime)`) | read |
| Base XP is a flat 10 and is added to the bonus | scoring-and-rewards.md — What the learner actually ends up with | `frontend/src/config/gameRules.js:32`; `frontend/src/state/useGameState.js:439`; `frontend/src/components/puzzle/usePuzzleSession.js:191` | read |
| `addPoints` also increments `streak` and raises `best_streak` | scoring-and-rewards.md — What the learner actually ends up with | `frontend/src/state/progressStore.js:170-175` | read |
| The only point spend in the app is the Guide, and it is clamped at 0 | scoring-and-rewards.md — Hints and Guides | `frontend/src/pages/ProblemPage.jsx:268`; `frontend/src/state/progressStore.js:178` | grep (`grep -rn "deductPoints(" frontend/src` → one call site) |
| A Guide costs 20 spendable points **and** 10 score points; a hint costs only the 10 | scoring-and-rewards.md — Hints and Guides | `frontend/src/config/gameRules.js:35`; `backend/config/constants.py:16`; `frontend/src/pages/ProblemPage.jsx:261-270` | read |
| Guide activation requires `progress.points >= 20`, else a toast and no activation | scoring-and-rewards.md — Hints and Guides | `frontend/src/pages/ProblemPage.jsx:264-271` | read |
| The Guide is free in the sandbox | scoring-and-rewards.md — Hints and Guides | `frontend/src/pages/ProblemPage.jsx:259-261` | read |
| Star thresholds are 90 / 75 / any completion, inclusive | scoring-and-rewards.md — Stars | `frontend/src/config/gameRules.js:38-43`; `frontend/src/state/progressStore.js:281-285` | read |
| A completed stage with no score still earns 1 star | scoring-and-rewards.md — Stars | `frontend/src/state/progressStore.js:298`; `frontend/src/pages/StageSelectorPage.jsx:68-78` | read |
| Stars are computed, never stored (no stars column) | scoring-and-rewards.md — Stars; ERD.md — What the picture deliberately does not show | `database/init.sql` (no such column); `frontend/src/state/progressStore.js:291-313` | read |
| `MAX_STARS_PER_STAGE = 3` and the per-level maximum is `totalStages × 3` | scoring-and-rewards.md — Stars | `frontend/src/config/gameRules.js:46`; `frontend/src/state/progressStore.js:311` | read |
| The unlock rule is `allDone && avgScore >= 80` | scoring-and-rewards.md — Unlocking the next level | `frontend/src/state/progressStore.js:304-309`; `frontend/src/config/gameRules.js:49` | read |
| The average is divided by `totalStages` (not by completed count) and rounded with `Math.round` first | scoring-and-rewards.md — Unlocking the next level | `frontend/src/state/progressStore.js:300-303` | read |
| `allDone` counts non-null **scores**, not the `completed` flag | scoring-and-rewards.md — Unlocking the next level | `frontend/src/state/progressStore.js:297-304` | read |
| Level 1 and the Sandbox require the whole Tutorial; Level 2 requires Level 1 unlocked; Level 3 requires Level 2 unlocked; the Tutorial is always open | scoring-and-rewards.md — Unlocking the next level | `frontend/src/pages/LevelSelectPage.jsx:60-123` | read |
| Inside a level, stage 0 is always available and stage N needs stage N−1 completed | scoring-and-rewards.md — Unlocking the next level | `frontend/src/pages/StageSelectorPage.jsx:55-62` | read |
| The unlock gate is a UI rule only — no server-side enforcement | scoring-and-rewards.md — Unlocking the next level; Limits | `backend/api/routes/levels.py:24-27`; `backend/api/routes/progress.py:26-41` | read |
| `UNLOCK_AVERAGE` and `STAR_THRESHOLDS` in the backend are declarations only, unread server-side | scoring-and-rewards.md — Where the rules live; Stars | `backend/config/constants.py:25-26` are the only matches | grep (`grep -rn "UNLOCK_AVERAGE\|STAR_THRESHOLDS" backend --include=*.py`) |
| The whole score is client-trusted: `stepsUsed`, `lawsUsed`, `hintsUsed`, `guidesUsed` and `optimalSteps` all come from the request | scoring-and-rewards.md — Limits and verification gaps | `backend/api/schemas/score.py:13-20` | read + **ran**: `stepsUsed: 0` with three claimed laws → `total 100.0`, `earnedPoints 5` |
| A large `optimalSteps` override grants full efficiency | scoring-and-rewards.md — Limits and verification gaps | `backend/services/scoring_service.py:83-88` | **ran**: `optimal_steps=999, steps_used=10` → efficiency 40, `total 70.0` |
| Hints are unbounded and each request increments the counter, repeats included | scoring-and-rewards.md — Hint independence | `frontend/src/state/useGameState.js:501-520` (note `:515-518` reuse the last static hint) | read |
| Hint/guide counters reset when a puzzle loads | scoring-and-rewards.md — Hint independence | `frontend/src/state/useGameState.js:136-137` | read |
| A drag/reorder is not a step | scoring-and-rewards.md — The algorithm, step by step | `frontend/src/state/useGameState.js:522-523` | read |
| Eight worked examples, all arithmetic copied from program output | scoring-and-rewards.md — Worked examples | — | **ran** the real scorer for W1–W7 and a stubbed-content run of the real `compute_score` for W8 |
| W1 reproduces the verbatim response quoted in GROUND-TRUTH §2 | scoring-and-rewards.md — W1 | `docs/_staging/GROUND-TRUTH.md:88-96` | **ran**: output matched `efficiency 40.0, targetLaw 30.0, hintIndependence 30.0, total 100.0, earnedPoints 5` |
| Nothing in the repo asserts the scoring arithmetic | scoring-and-rewards.md — Limits and verification gaps | no `test_*.py` anywhere outside `venv`; `frontend/src/engine/__tests__/` has 7 files, none mentioning scoring | grep (`grep -rln "estimateScore\|earnedPoints\|scoring" frontend/src/engine/__tests__/` → no match; `find . -name "test_*.py" -not -path "*/venv/*"` → empty) |

## C. Places where GROUND-TRUTH.md was wrong (reported to the Lead, both confirmed and fixed)

| Claim | GROUND-TRUTH said | Truth | Evidence | Status |
|---|---|---|---|---|
| Puzzle count | `docs/_staging/GROUND-TRUTH.md:161` and the D10 row: "4 levels, 12 stages each = **48 puzzles**" | **40** (Tutorial 4 + 12 + 12 + 12) | **ran**: `sum(len(l['puzzles']) for l in levels)` → 40; `grep -c '"expr"' content/levels.json` → 40 | Messaged the Lead; GROUND-TRUTH corrected in place and the convention fixed to "the Tutorial (id 0) has 4 stages and Levels 1–3 have 12 each → 40 puzzles total" |
| Bonus rounding | `docs/_staging/GROUND-TRUTH.md:212` wrote `earnedPoints = round((total / 100) * 5)`, which reads as ordinary half-up rounding | The backend uses Python's **half-to-even** `round()`, the frontend uses half-up `Math.round` — they disagree at totals 10.0, 50.0 and 90.0 | **ran** both sides (see section B) | Messaged the Lead; GROUND-TRUTH updated and register row **D21** added, which I own documenting |
| Negative stage index | GROUND-TRUTH did not mention it | `content_service.py:40-41` rejects only `stage_idx >= len(puzzles)`, so `stageIdx: -1` resolves to the **last** puzzle instead of 404ing | **ran**: `compute_score(level_id=1, stage_idx=-1, …)` returned a score; `stage_idx=12` raised `NotFoundError` | Messaged the Lead; Lead asked me to document it (done in scoring-and-rewards.md — Limits), and product-arch is covering it in known-limitations.md |

All other GROUND-TRUTH claims I depended on (58-line `init.sql`, 3 tables, `FOR ALL USING (true)`
policies, the scoring constants, the 0-based level convention, `GUIDE_COST_POINTS` vs
`ASSISTANCE_PENALTY`, the mirror in `gameRules.js`) were re-verified against source and **held**.

## D. What I could not verify (stated as limitations, not as facts)

| Item | Why | Where the doc says so |
|---|---|---|
| The DDL was never executed | No PostgreSQL client and no Supabase credentials in this workspace (`which psql` → not found); running `init.sql` needs the Supabase SQL Editor (`database/init.sql:2`) | SCHEMA.md — Applying and verifying the schema (verification queries are supplied for a reviewer to run) |
| Live-project RLS exposure to `anon` | Depends on the Supabase dashboard's Exposed-schemas setting and the key's role; both live outside the repo | SCHEMA.md — Row Level Security (marked `⚠️ Unverified`) |
| Postgres policy semantics (`TO`-less ⇒ `PUBLIC`; `FOR ALL` + no `WITH CHECK` ⇒ `USING` reused for writes) | Documented PostgreSQL behaviour, not executable here | SCHEMA.md — Row Level Security (explicitly labelled as documented behaviour) |
| PostgREST upsert column semantics (`completed_at` / `updated_at` not refreshed) | Inferred from the payload plus documented PostgREST behaviour; no live database to test against | SCHEMA.md — `completed_at` row; `updated_at` row |
| Whether the deployed database still matches `init.sql` | Requires live credentials | SCHEMA.md — Where the schema lives ("the schema is applied by hand, out of band") |
| Whether a learner has ever hit a 90.0 / 50.0 / 10.0 total in production, i.e. how often D21 bites | Requires live `score_history` rows; no credentials used | scoring-and-rewards.md — The rounding trap (describes the mechanism, not a frequency) |

## E. Execution transcripts (condensed)

Every command below was run from `/home/xris/Documents/GitHub/Praxis` unless it starts with `cd backend`.

| # | Command | Observed result |
|---|---|---|
| 1 | `cd backend && ./venv/bin/python -c "from services.scoring_service import compute_score; print(compute_score(level_id=1, stage_idx=0, steps_used=1, laws_used=['absorption'], hints_used=0, guides_used=0, optimal_steps=None))"` | `efficiency=40.0 target_law=30.0 hint_independence=30.0 total=100.0 earned_points=5`, breakdown as quoted in W1 |
| 2 | `cd backend && ./venv/bin/python` — eight-case script (W1–W8) | W1 `100.0/5`; W2 `100.0/5` with `optimalSteps=2`; W3 `40.0/2`; W4 `90.0/4`; W5 `50.0/2`; W6 `0.0/0`; W7 `65.0/3`; W8 `100.0/5` |
| 3 | `cd backend && ./venv/bin/python` — spoof probes | `optimal_steps=999, steps_used=10` → `total 70.0`; `steps_used=0` + three claimed laws → `total 100.0`, `earned 5`; `optimal_steps=0`/`-3` → `optimalSteps 3` (content fallback) |
| 4 | `cd backend && ./venv/bin/python` — boundary probes | `level=99` → `NotFoundError Level 99 not found`; `level=1 stage=12` → `NotFoundError Stage 12 not found`; `level=1 stage=-1` → **OK**, scored the last puzzle; `level=0 stage=4` → `NotFoundError` |
| 5 | `cd backend && ./venv/bin/python` — reachability enumeration | efficiency `{0,10,20,30,40}`, target law `{0,10,15,20,30}`, hint independence `{0,10,20,30}`; 19 reachable totals; divergence at 10/50/90 only |
| 6 | `cd backend && ./venv/bin/python` — `SaveProgressRequest.model_validate` with `stageSolutions` + `levelsCompleted` + `hasSeenTutorial` | parsed model keeps only `points, streak, bestStreak, stageProgress, stageScores` — extras ignored, no error |
| 7 | `cd frontend/src/engine && node --input-type=module -e "import { estimateScore } from './scoring.js'; …"` | W4 `total 90 earned 5`; W5 `total 50 earned 3`; `Math.round(4.5)=5`, `Math.round(2.5)=3` |
| 8 | `cd frontend/src/engine && node … effectiveOptimalSteps({optimalSteps:0, puzzleOptimalSteps:3, stepsUsed:2})` | `3` — the frontend does **not** clamp (confirms the divergence is server-only) |
| 9 | `python3 -c "import json;levels=json.load(open('content/levels.json'));…"` | `TOTAL 40`; per-level `4, 12, 12, 12`; `puzzles with empty/absent targetLaws: []`; puzzle keys `expr, goal, hints, optimalHint, optimalSteps, targetLaws` |
| 10 | `python3 -c "import json;laws=json.load(open('content/laws.json'));…"` | 10 law ids; `distributive-expand present? False` |
| 11 | `grep -rn "CREATE TABLE" --include=*.sql .` | 3 hits, all in `database/init.sql:7,16,28` |
| 12 | `grep -n "TRIGGER\|EXTENSION\|CHECK\|GRANT\|TO \|WITH CHECK" database/init.sql` | no `TRIGGER`, no `EXTENSION`, no `CHECK`, no `GRANT`, no `TO`/`WITH CHECK` in the policies |
| 13 | `grep -rn "auth\.uid\|auth\.jwt\|service_role\|anon" database/ backend/ --include=*.sql --include=*.py` | only the comment at `database/init.sql:54` |
| 14 | `grep -rn "supabase\." frontend/src` | only `supabase.auth.*` plus the client construction |
| 15 | `grep -rn "deductPoints(" frontend/src` | one call site: `frontend/src/pages/ProblemPage.jsx:268` |
| 16 | `grep -rn "UNLOCK_AVERAGE\|STAR_THRESHOLDS" backend --include=*.py` | only the definitions at `backend/config/constants.py:25-26` |
| 17 | `grep -rln "estimateScore\|earnedPoints\|scoring" frontend/src/engine/__tests__/` | no match — scoring has no unit test |
| 18 | `find backend -name "*.py" -not -path "*/venv/*" \| xargs wc -l \| tail -3` | `1241 total` |
| 19 | `cd backend && ./venv/bin/python` — `SaveProgressRequest.model_validate` with `points: -5`, `stageProgress: {"99": [-4, 0]}`, `stageScores: {"99:-4": 999.9}`, then replaying the `progress_service.save_progress` loop | parsed with no error; the loop yields `stage_progress(level_id=99, stage_idx=-4, best_score=999.9, completed=True)` — no bounds on either side |
| 20 | `grep -n "TRIGGER\|EXTENSION\|CHECK\|GRANT\|TO \|WITH CHECK" database/init.sql` and `grep -n "CREATE SCHEMA" database/init.sql` | both exit 1 (no match): no trigger, no extension, no check constraint, no grant, no policy `TO`/`WITH CHECK` clause, no schema creation |
| 21 | `cd backend && ./venv/bin/python` — M2 reproduction (remediation round): `compute_score(level_id=1, stage_idx=0, steps_used=1, laws_used=[], hints_used=-99, guides_used=0, optimal_steps=None)` | `eff 40.0, tl 0.0, hi 1020.0, total 1060.0, earned 53, assistance -99` — exactly the values in `docs/verification-report.md` §2.4 |
| 22 | same script, all-negative inputs: `steps_used=-5, hints_used=-99, guides_used=-99, optimal_steps=-100` | `eff 40.0, tl 0.0, hi 2010.0, total 2050.0, earned 102` — confirms no upper cap; combined with W6 (`total 0.0`) it confirms the lower floor is 0, not negative |
| 23 | `sed -n '138,144p' docs/context.md` | line 139 is the "≥ 70% across all 6 stages" claim and line **140** is "Level 3: Permanently Coming Soon (no puzzles yet)"; line 143 is blank — the m4 fix |
| 24 | `sed -n '168,178p' frontend/src/state/progressStore.js` | `:173` is `points: p.points + amount,`; the `bestStreak` high-water mark is `:175` inside `addPoints` (`:170-176`) — the m8 fix |

## F. Remediation-round corrections (from `docs/verification-report.md`)

| Defect | Report ref | What I changed |
|---|---|---|
| **M2** — documented ranges are false | §2.4 | `SCHEMA.md` `best_score` cell: dropped "(`0–100`)" and added the no-range-guarantee note; `SCHEMA.md` `total` cell: `0–100 sum` → `unclamped sum`; `hint_independence` and `earned_points` cells qualified (0–30 / 0–5 hold only for non-negative inputs). `scoring-and-rewards.md` limitation row 5 replaced with the verifier's text plus the D25 and D24 cross-references. `ERD.md`: the erDiagram attribute comments and the SCORE_HISTORY bullet no longer claim bounds. |
| **m4** — blank citation target | §m4 | `scoring-and-rewards.md` D9 row: `docs/context.md:143` → `docs/context.md:140` (verified: `:139` was already correct and `:143` is blank). |
| **m8** — wrong line for `best_streak` | §m8 | `SCHEMA.md` `best_streak` row: `frontend/src/state/progressStore.js:173` → `:175` (verified `:173` is `points: p.points + amount,`). |

Deliberate deviation from the requested text, flagged to the Lead: the verifier's replacement sentence ended
"…the score is not capped at `MAX_SCORE` in either direction." That reads as "it can go negative too", which is
false — `efficiency` and `hint_independence` each clamp at 0 (`backend/services/scoring_service.py:96`, `:112-115`) and
`target_law` is a non-negative ratio by construction (`:103-107`), so `total >= 0` always. W6 (`total 0.0`) and execution 22
(`total 2050.0`, never negative) both confirm it, so the doc now says "no upper cap, lower floor 0" instead.
