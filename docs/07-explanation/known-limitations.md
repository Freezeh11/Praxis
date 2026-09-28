# Known Limitations and Known Discrepancies

**What this is.** Everything that is wrong, missing, stale, unverified or deliberately
unprotected in Praxis — in one place, with evidence. It has two halves: the **D0–D27
discrepancy register** (where the project's own stale proposal, `context.md`, contradicts the
code) and the **genuine technical limitations** discovered while documenting the system.

**Who it's for.** Everyone. Read this before trusting any other document, before planning work,
and before quoting `context.md` — which is a proposal written before most of the application
existed. **The register below has 28 rows — 23 places where a written claim (in `context.md`, the
original task brief or the LAWS rubric) is contradicted by the code, plus 5 defects found by
executing the system — split 17 High, 8 Medium and 3 Low.**

> **The register is the most important table in this documentation suite.** It exists because
> `docs/context.md` describes a four-route app with no authentication, three levels and an
> unplayable finale. None of that is true. Anyone who reads it first will form a completely
> wrong mental model.

---

## Contents

1. [How to read this document](#1-how-to-read-this-document)
2. [Known Discrepancies — the D0–D27 register](#2-known-discrepancies--the-d0d27-register)
3. [Correctness and trust limitations](#3-correctness-and-trust-limitations)
4. [Data and schema traps](#4-data-and-schema-traps)
5. [Performance and scalability limitations](#5-performance-and-scalability-limitations)
6. [Security limitations](#6-security-limitations)
7. [Operability and deployment limitations](#7-operability-and-deployment-limitations)
8. [Process and tooling gaps](#8-process-and-tooling-gaps)
9. [Limitations inherited from the proposal](#9-limitations-inherited-from-the-proposal)
10. [Things that look wrong but are correct](#10-things-that-look-wrong-but-are-correct)
11. [Unverified items](#11-unverified-items)
12. [Severity summary](#12-severity-summary)

---

## 1. How to read this document

**Severity** is assigned by blast radius, not by effort to fix:

| Severity | Means |
|---|---|
| **High** | A reader acting on the wrong version would build the wrong thing, or the system's core guarantee is weaker than it appears. |
| **Medium** | Real but contained: a specific flow, a specific column, a specific deployment assumption. |
| **Low** | Cosmetic, or a documentation-accuracy issue with no behavioural consequence. |

**"Resolution"** in the register means *what this documentation suite does about it*: which
document states the truth, or what a reader should do instead. It is not a fix plan.

**Evidence** is cited as `path/file.ext:line`. Where a claim was established by **running**
something rather than reading it, the register says so.

**No secret appears in this document.** Environment variables are named, never valued.

## 2. Known Discrepancies — the D0–D27 register

Proposal claims are quoted from [`context.md`](../context.md) (the stale proposal), from the
original task brief, or from the LAWS rubric
([`Software Proposal Writing Guide (LAWS) v2.0.docx.md`](../Software%20Proposal%20Writing%20Guide%20%28LAWS%29%20v2.0.docx.md)).
"Code says" is the verified truth at commit `3838343`.

### 2.1 Project identity and stack

| ID | Proposal says | Code says (truth) | Sev | Resolution |
|---|---|---|---|---|
| **D0** | `docs/context.md` is the project's context source, to be fed to any agent. | It is **badly stale**: §2, §5, §7, §10, §11, §12 and §13 are contradicted by the code. Treat it as an historical proposal only. | **High** | Every document in this suite is written from the code. `context.md` is retained as a frozen historical input and labelled as such. This register supersedes it. |
| **D2** | "Database: Supabase (PostgreSQL) — credentials provided, **NOT integrated yet**"; "**Auth: None** — no login, no register, no JWT, no sessions"; "Supabase client ❌ MISSING"; "Database integration ❌ MISSING". | **Fully integrated.** `backend/supabase_client.py` is a working PostgREST/Auth client; `backend/repositories/progress_repository.py` issues six real queries; `/api/progress` and `/api/progress/save` exist and enforce bearer auth; the frontend signs in through `@supabase/supabase-js`. | **High** | [SRS.md](../01-product/SRS.md) §5.2 documents the Supabase interfaces; §6.1 the three tables. Auth flow: `frontend/src/services/authActions.js:9`, `backend/core/security.py:17`. |
| **D3** | `init.sql` header: "Better Auth tables (user, session, account, verification) are created automatically by `npx auth migrate`"; `vite.config.js` proxies `/api/auth` to a "Better Auth server" on port 3001. | **There is no Better Auth installation in this repository.** No `auth-server/` directory, no port-3001 service. Auth is **Supabase Auth**. **Four dead remnants survive:** ① the `database/init.sql:4` header comment; ② the `/api/auth` proxy block (`frontend/vite.config.js:24-28`); ③ a comment beside `signOut()` — "Wait a moment for Better Auth's global state to clear before routing" — in `frontend/src/pages/LandingPage.jsx:21`; ④ the identical comment in `frontend/src/pages/LevelSelectPage.jsx:142`. Plus a vestigial `VITE_AUTH_URL` env var and an orphaned `auth-server/node_modules/` line in `.gitignore:4`. | **High** | [SAD.md](../02-architecture/SAD.md) §8.3 states that auth is Supabase. Git history settles it: commit `004e0f9` (2026-05-24) "Migrate to Supabase Auth". The remnants were reported to the Lead rather than edited, because `vite.config.js` and `init.sql` are outside this writer's scope. |
| **D13** | "CORS: Backend allows `http://localhost:5173` and `http://127.0.0.1:5173`." | Three default origins — the two above **plus `http://localhost:3001`** (the dead Better Auth server) — and `FRONTEND_URL` is appended when the environment sets it. | Low | `backend/config/settings.py:23-27`, `:66-71`. Documented in [SAD.md](../02-architecture/SAD.md) §8.4 with the port-3001 origin marked as a stale remnant. |
| **D14** | "**No `.env` file exists yet** — the project currently has no environment variables." | Both exist locally (`backend/.env`, `frontend/.env.local`) and both are **gitignored and untracked** (verified with `git check-ignore` and `git ls-files`). | Medium | [SRS.md](../01-product/SRS.md) §5.4 lists which variables are needed; no value is reproduced anywhere. |
| **D15** | `context.md` §11 prints concrete credential values. | A publishable/anon key value is committed in a tracked file. Publishable keys are designed for client exposure, but **documentation must never reproduce a secret**. | Medium | Every document in this suite uses placeholders (`https://<project-ref>.supabase.co`, `<service-role-key>`). The values in `context.md` §11 are not repeated here or anywhere else in the suite. |
| **D16** | "Supabase is used only for progress and score history" / "all data hardcoded". | Correct in spirit — content is static JSON in `content/`, and Supabase holds only progress and score history. But the phrasing implies the Supabase client does not exist (see D2). | Low | [SAD.md](../02-architecture/SAD.md) §7 assigns each piece of data an owner. |

### 2.2 Routes, screens and layers

| ID | Proposal says | Code says (truth) | Sev | Resolution |
|---|---|---|---|---|
| **D4** | "Landing page ❌ MISSING", "Login page ❌ MISSING", "Register page ❌ MISSING", "Protected routes ❌ MISSING", "Auth middleware ❌ MISSING". | **All exist.** `LandingPage.jsx`, `LoginPage.jsx`, `RegisterPage.jsx`, `ProtectedRoute.jsx`, plus `TutorialGate` and `OrientationGate`. | **High** | [PRD.md](../01-product/PRD.md) §4 walks the real journey; [SDD.md](../02-architecture/SDD.md) §5.6 lists all seven pages. |
| **D5** | Four routes: `/`, `/level/:levelId/stages`, `/level/:levelId/stage/:stageIdx`, `*`; "`/` … acts as 'home' page — no landing page exists"; level selection at `/`. | **Nine routes:** `/`, `/login`, `/register`, `/levels`, `/level/:levelId/stages`, `/level/:levelId/stage/:stageIdx`, `/sandbox`, `/sandbox/play`, `*`. `/` is **LandingPage**; level selection moved to **`/levels`**. | **High** | Route table in [SAD.md](../02-architecture/SAD.md) §5 and [PRD.md](../01-product/PRD.md) §4; source `frontend/src/App.jsx:30-57`. |
| **D17** | Backend layering named `app/core`, `app/services`, `app/repositories`, `app/routers`, `app/schemas`. | Real paths: `backend/core`, `backend/services`, `backend/repositories`, `backend/api/routes`, `backend/api/schemas`, `backend/config`. There is **no `backend/app/`** package. 28 Python modules / 1,241 lines. | **High** | [SDD.md](../02-architecture/SDD.md) §2 enumerates all 28 modules. |
| **D18** | Frontend layering named `src/api`, `src/screens`; "9 hooks"; "8 top-level components". | Real paths: **`src/services`** (not `api`) and **`src/pages`** (not `screens`). `frontend/src/hooks/` holds **8** files; `frontend/src/components/` holds **10** top-level modules plus **6** feature folders. | Medium | Counted from the tree; [SDD.md](../02-architecture/SDD.md) §4-5. |

### 2.3 API surface and scoring

| ID | Proposal says | Code says (truth) | Sev | Resolution |
|---|---|---|---|---|
| **D6** | Five endpoints: `/`, `GET /api/levels`, `GET /api/levels/{id}`, `GET /api/laws`, `POST /api/score`. | **Seven** application endpoints. Adds `GET /api/progress` and `POST /api/progress/save`, both requiring a bearer token. | **High** | Live-verified with `fastapi.testclient`: the seven paths and their 200/404/422/401 bodies all match. Full table in [SRS.md](../01-product/SRS.md) §5.1. |
| **D7** | "`POST /api/score` … **does NOT save to DB**"; "Scores are computed but discarded". | It **does** persist, for a signed-in learner, in a background task: inserts a `score_history` row and raises `stage_progress.best_score` when the new total is higher. Failures are logged and swallowed so the response is never affected. | **High** | `backend/api/routes/score.py:38-39`; `backend/services/progress_service.py:87-127`. |
| **D8** | Score formula: efficiency `40 − over×10`; target law proportional; hint `30 − hints×10`; `earnedPoints = (total/100) × 5`. | Matches **except** four details: ① `optimal = min(declared, stepsUsed)`, so a solution shorter than the recorded optimum raises the bar to full marks; ② `guidesUsed` is added to `hintsUsed` into one `assistance` figure; ③ every component is rounded to `SCORE_ROUNDING_DP = 1`; ④ a puzzle that declares no target laws gets the **full 30**. | Medium | `backend/services/scoring_service.py:45-115`. [SRS.md](../01-product/SRS.md) FR-24 states all four; helper by helper in [SDD.md](../02-architecture/SDD.md) §3.6. |
| **D9** | "Level 2 requires Level 1 average score ≥ **70%**"; "Level 3: permanently 'Coming Soon' (no puzzles yet)". | `UNLOCK_AVERAGE = 80.0` and `UNLOCK_AVERAGE_SCORE = 80`; the client adds a second condition — **every stage done AND average ≥ 80**. **Level 3 is fully playable** with 12 four-variable puzzles. | **High** | `frontend/src/config/gameRules.js:49`; `backend/config/constants.py:26`; `frontend/src/state/progressStore.js:309`. Note `context.md` contradicts even the project's own LAWS rubric, which says "80% accuracy threshold" (`Software Proposal Writing Guide (LAWS) v2.0.docx.md:129`). |
| **D10** | "3 levels… 6 puzzles each", Level 3 empty; rubric says "Six problems per level" and "three difficulty levels". | **4 levels; the Tutorial (id 0) has 4 stages and Levels 1–3 have 12 each → 40 puzzles total.** | **High** | Counted from `content/levels.json` (per-level counts `[4,12,12,12]`) and live-verified: `GET /api/levels` returns `puzzleCount: [4,12,12,12]`. Used verbatim in [PRD.md](../01-product/PRD.md), [SRS.md](../01-product/SRS.md) and [SDD.md](../02-architecture/SDD.md). **Note:** an earlier revision of `docs/_staging/GROUND-TRUTH.md` summarised this as "4 levels × 12 stages = 48 puzzles"; that was an arithmetic slip — the Tutorial has 4 stages, not 12, so the total is **40**. Corrected by the Lead. |
| **D11** | "engine/ … + **46** unit tests" (`context.md` §3); the refactor report's §5 table also says 46/46. | **76 tests, 76 pass, 0 fail** across 7 test files (1,246 lines), ~10.7 s. | Low | Ran `cd frontend && npm test` → `# tests 76 / # pass 76 / # fail 0`. The "46" figure is genuine but historical: commit `df6f35d` added "46 unit tests"; the suite grew after the soundness fix. |
| **D12** | "**Animation pipeline** — When a law is applied, `useGameState.js` triggers a **2.5-second** animation via `AnimationOverlay.jsx` before actually updating the AST. This is important for UX flow." | The law animation is **1350 ms**, and on the tutorial path it is preceded by a separate **1500 ms** pre-law highlight. No 2.5 s wait exists anywhere. | Medium | `frontend/src/config/gameRules.js:60-62` (`lawAnimationMs: 1350`, `preLawHighlightMs: 1500`); consumed at `frontend/src/state/useGameState.js:447` (animation timer) and `:455` (pre-law timer). Also stated in [SDD.md](../02-architecture/SDD.md) §5.2 and [SRS.md](../01-product/SRS.md) FR-39. |
| **D21** | The refactor report §3 says the client and server formula "both read their numbers from config", implying they agree. | The **numbers** agree; the **rounding function** does not. `backend/services/scoring_service.py:55` uses Python `round()` — **banker's rounding, half-to-even** — while `frontend/src/engine/scoring.js:80` uses JS `Math.round` — **half-up**. | **High** | Verified by enumerating all **19 reachable totals**: exactly three diverge. `total = 10.0` → server 0, client 1; `50.0` → 2 vs 3; `90.0` → 4 vs 5. **And it is not merely a display glitch** — see §3.1. |
| **D24** | Not claimed anywhere; discovered by execution. | `POST /api/score` **trusts its inputs completely**. `stepsUsed: 0` with a claimed law id returns `total 100.0, earnedPoints 5` with no derivation at all. Passing `optimalSteps: 999` with `stepsUsed: 10` still yields full `efficiency: 40.0`, because `_resolve_optimal` clamps via `min(optimal, steps_used)`. | **High** | Reproduced with `fastapi.testclient` during this documentation pass. It is the sharpest consequence of the engine contract — see §3.1 and [why-this-architecture.md](why-this-architecture.md) §6. |
| **D27** | Not claimed anywhere; discovered by inspection. | **Nothing tests the scoring arithmetic.** `find backend -name 'test_*.py'` returns nothing — zero backend tests, no `pytest` dependency. The 7 engine test files never mention `estimateScore` or `earnedPoints`. The browser suites only assert that a `+N Points` pill renders (`.e2e/acceptance-features.mjs:900`). | Medium | Nothing would catch a D21 rounding regression. Recorded as verification gap ① in [SRS.md](../01-product/SRS.md) §9 and as [ADR-013](design-decisions.md#adr-013--verification-without-a-backend-test-suite). |

### 2.4 Deployment, data and the sandbox

| ID | Proposal says | Code says (truth) | Sev | Resolution |
|---|---|---|---|---|
| **D1** | The task brief's diagram list implies a `POST /sandbox/validate` endpoint and a request/response sequence diagram for it. | **No such endpoint exists.** Sandbox validation is 100 % client-side: `frontend/src/engine/sandbox/validate.js:155` (syntax) and `frontend/src/engine/sandbox/input.js:109` (solvability), driven by `SandboxPage.jsx` and the shared `ProblemPage` in sandbox mode. | **High** | The requested sequence diagram must be documented as **correcting the brief**: there is no server round trip. [SAD.md](../02-architecture/SAD.md) §9.2 shows the real flow. |
| **D23** | The same brief lists the sandbox validation endpoint among the API's endpoints. | The API has **7 application endpoints**, none of them sandbox-related. A sandbox expression never reaches the backend. | **High** | [SRS.md](../01-product/SRS.md) §5.1 is the complete live-verified list; FR-33 – FR-37 specify the sandbox behaviour with no server component. |
| **D19** | Deploy = "Render (`render.yaml`)" for the whole app (`context.md` §12 implies one deployment). | `render.yaml` defines **one** service — `praxis-backend` (python, `rootDir: backend`, `uvicorn main:app`). The frontend is **not** in `render.yaml`; `frontend/vercel.json` plus `render.yaml`'s `FRONTEND_URL: https://praxis-seven-puce.vercel.app` show the SPA is deployed to **Vercel**. | **High** | [SAD.md](../02-architecture/SAD.md) §3 "Deployment shape"; [SRS.md](../01-product/SRS.md) NFR-14. |
| **D20** | RLS is described as a safety feature ("configure Row Level Security"). | RLS is **enabled** on all three tables with one policy each literally named `"Service role full access"` and defined `FOR ALL USING (true)` — **fully permissive for every role, including `anon`**. There is **no `auth.uid() = user_id` predicate anywhere** in the schema, and the policy is not scoped to `service_role` despite its name. | **High** | Documented honestly in [SAD.md](../02-architecture/SAD.md) §7.2, [SRS.md](../01-product/SRS.md) DR-4 and §6. The schema is owned by another writer; this register records the finding. |
| **D22** | Not claimed anywhere; discovered by inspecting the generated spec. | The OpenAPI document declares **no security scheme**, because auth is applied through `Depends(...)` rather than a `Security` requirement. `security=None` on all seven paths. `/docs` therefore shows no **Authorize** button and cannot exercise the two progress routes. | Medium | The bearer requirement is real and enforced (`backend/core/security.py:17`); it is only invisible in the generated spec. Recorded in [SRS.md](../01-product/SRS.md) §5.1 and [SAD.md](../02-architecture/SAD.md) §8.3. |
| **D25** | Not claimed anywhere; discovered by inspecting the models and schema. | `POST /api/progress/save` has **no bounds or integrity validation**. `points: -5`, `streak: -99`, `level_id: 99`, `stage_idx: -4` and `best_score: 999.9` all parse and are written verbatim: `backend/api/schemas/progress.py` defines no validators, and `database/init.sql` has no `CHECK` constraints and no foreign key on level or stage. | **High** | Verified by instantiating `SaveProgressRequest` with out-of-range values (no live write performed). See §4. |
| **D26** | Not claimed anywhere; discovered by reading the gate. | The unlock gate is **frontend-only and slightly wrong**. `UNLOCK_AVERAGE` and `STAR_THRESHOLDS` in `backend/config/constants.py:25-26` are **never read server-side**; `GET /api/levels/{id}` has no auth dependency; no server state records an unlock. Worse: `frontend/src/state/progressStore.js:301-303` applies `Math.round()` to the average **before** the comparison at `:309`, so a **true average of 79.5 rounds to 80 and passes the gate**. | Medium | `frontend/src/state/progressStore.js:291-313`. [SRS.md](../01-product/SRS.md) FR-12 states the rule as implemented; the rounding-before-comparison defect is recorded here and in §3.1. |

### 2.5 The proposal's own limitations section

The LAWS rubric carries the proposal's Limitations section
([`Software Proposal Writing Guide (LAWS) v2.0.docx.md:139`](../Software%20Proposal%20Writing%20Guide%20%28LAWS%29%20v2.0.docx.md)).
It states several things the code now contradicts. Rather than a separate register row, they are
reconciled in [§9](#9-limitations-inherited-from-the-proposal), which restates each claim and
says whether it still holds.

## 3. Correctness and trust limitations

### 3.1 The score is client-trusted, and the client's own arithmetic drifts from the ledger

Four separate facts combine into one real problem. Taken alone, each looks minor.

**① The server cannot verify a derivation.** The algebra engine exists only in the frontend
([ADR-001](design-decisions.md#adr-001--the-engine-contract-the-frontend-owns-all-boolean-algebra)),
so `backend/services/scoring_service.py:32` receives `stepsUsed`, `lawsUsed[]`, `hintsUsed` and
`optimalSteps` as **submitted facts**. It looks the puzzle up only to read `targetLaws`
(`:43`, `:46`).

**② The score is trivially maxable.** Reproduced during this documentation pass:

```http
POST /api/score
{"levelId":1,"stageIdx":0,"stepsUsed":0,"lawsUsed":["absorption"],"hintsUsed":0}
```
```json
{"efficiency":40.0,"targetLaw":30.0,"hintIndependence":30.0,"total":100.0,"earnedPoints":5}
```

Zero steps, no derivation, a perfect score. And because `_resolve_optimal` ends in
`min(optimal, steps_used)` (`scoring_service.py:88`), inflating the declared optimum does not
penalise either: `optimalSteps: 999` with `stepsUsed: 10` still returns `efficiency: 40.0`
(the echoed `optimalSteps` becomes 10). **D24**

**③ The two implementations disagree at exactly three totals.** Of the 19 reachable totals,
`10.0`, `50.0` and `90.0` round differently: server 0/2/4 versus client 1/3/5.**D21**

**④ The disagreement is permanent, not cosmetic.** The browser credits **its own** bonus to the
learner's balance at solve time:

```js
if (isFirstTime) {
  addPoints(earnedXp + immediateScore.earnedPoints)     // usePuzzleSession.js:190-192
}
```

while the server's value only replaces the **displayed** result and is what lands in
`score_history.earned_points` (`progress_service.py:106`). On a `total = 90.0` solve, the
browser adds **+15** to `user_progress.points` (10 base XP + its own 5) while the ledger records
**4**. Nothing ever reconciles them: there is no read-back path from `score_history` into the
balance, and the two writers do not share a transaction.

**Who is affected.** Every graded completion whose total is 10.0, 50.0 or 90.0 — reachable
totals, not theoretical ones. For all other totals the two agree.

**What would fix it.** Make the server's `earnedPoints` the only figure ever added to the
balance (credit it on the `submitScore` response, or credit nothing locally and let a background
reconcile), and align the rounding function on one convention.

### 3.2 A step is structurally valid, not provationally valid

The engine never re-proves a rewrite. A step is accepted because a law implementation produced
it (`useGameState.js:363`, `:425`), not because the rewrite was checked against the source
expression. Soundness therefore rests on the law builders plus one property test
(`engine/__tests__/law-soundness.property.test.js`) — which is a strong test, but it is the only
line of defence between the learner and a law that changes meaning. The neighbouring commit
`1c7f932` ("fix(engine): decide absorption semantically so a law can never change meaning") shows
this class of bug is real and has occurred.

### 3.3 Completion is canonical-text equality, not semantic equivalence

The win test is `canonText(newExpr) === goalCanonRef.current`
(`frontend/src/state/useGameState.js:437`, goal canonicalised at `:83`). The exhaustive
truth-table checker `isEquivalent` (`engine/equivalence.js:45`) exists, is sound, and is **not**
on the win path: its non-test consumers are law detection (`engine/laws/helpers.js:77`, `:98`)
and the sandbox builders (`engine/sandbox/generator.js:94`, `engine/sandbox/input.js:161`).

**Consequence.** A learner who reaches a terminal form that is logically equivalent to the goal
but renders to different canonical text is **not** marked solved. This is a genuine pedagogical
edge case, and it is asymmetric with the 80 % unlock rule, which does not care how the learner
got there. Recorded as [ADR-003](design-decisions.md#adr-003--completion-is-canonical-text-equality-not-semantic-equivalence).

### 3.4 Dead-end detection is a heuristic

`syncDeadEndStatus` reports a dead end when `scanHints(expr, 'R')` returns an empty list
(`useGameState.js:61`, used at `:504` and `:562`). That is a statement about the **implemented
law registry** — "no law I implement applies here" — not a proof that no derivation exists.
A rewrite reachable through a law the engine does not model would be reported as unsolvable. In
practice the registry matches the taught curriculum, so the distinction is theoretical; it
becomes real if the law set is ever narrowed.

### 3.5 The unlock gate rounds before comparing

```js
const avgScore = completed === 0 ? 0
  : Math.round(scores.reduce((sum, score) => sum + (score ?? 0), 0) / totalStages)   // :301-303
…
unlocked: allDone && avgScore >= UNLOCK_AVERAGE_SCORE                                // :309
```

`Math.round` is applied **before** the threshold comparison, and JS rounds half up, so a **true
average of 79.5 becomes exactly 80 and unlocks the next level** — below the stated 80 % bar.
The fix is to compare the unrounded average (or to compare `>= 79.5` deliberately). **D26**

## 4. Data and schema traps

These are the four ways a future query or report is most likely to be wrong. Each is a place
where the schema's name or shape does not mean what it appears to mean.

### 4.1 `score_history.hints_used` stores hints **plus Guides**

The column is named for hints, but it is written from `ScoreOutcome.assistance_used`, which is
`hints + guides`:

```python
assistance_used = (hints_used or 0) + (guides_used or 0)      # scoring_service.py:51
…
"hints_used": outcome.assistance_used,                        # progress_service.py:101
```

This was a deliberate choice to avoid a schema migration (`REFACTOR_REPORT.md` §6.4), and it is
undocumented in the schema. **Any report built on this column overstates hints** by the number of
Guides consumed. There is no way to recover the split from the data — a Guide costs 20 points and
a hint costs none, so the `laws_used`/`points` combination is an indirect and unreliable proxy.

### 4.2 `user_progress.updated_at` is never refreshed

```sql
updated_at TIMESTAMPTZ DEFAULT now()        -- database/init.sql:12
```

No trigger exists in `init.sql`, and no writer ever sends the column:
`upsert_user_progress` receives `{user_id, points, streak, best_streak}`
(`backend/services/progress_service.py:63-70`). So despite its name, the column holds the row's
**insert** time forever. Any "last active" metric built on it will be wrong from the second write
onward.

### 4.3 There is no schema-migration tooling and no constraints

`database/init.sql` is a single hand-run script for the Supabase SQL editor. It uses
`CREATE TABLE IF NOT EXISTS`, which makes it safe to re-run but means it **cannot evolve an
existing schema** — a new column requires a hand-written `ALTER TABLE` that lives nowhere in the
repository. There are also **no `CHECK` constraints and no foreign keys on `level_id` or
`stage_idx`**, which is why §D25's out-of-range values are accepted and stored.

### 4.4 `stage_progress.level_id` is 0-based and starts at the Tutorial

`content/levels.json` ids are `0, 1, 2, 3` where **0 is the Tutorial**. `stage_progress.level_id`
stores the content id, so Tutorial rows carry `level_id = 0` — and the UI calls those cards
"Tutorial", "Level 1", "Level 2", "Level 3". Confusing the two numbering schemes is the single
most likely defect in a new query. `frontend/src/config/gameRules.js:82` pins
`TUTORIAL.levelId = 0` to make the mapping explicit.

## 5. Performance and scalability limitations

### 5.1 All progress I/O is synchronous inside `async def` routes

`SupabaseRESTClient.QueryBuilder.execute()` uses a **blocking** client:

```python
with httpx.Client() as c:                     # backend/supabase_client.py:69
    response = c.get(url, headers=…, params=params)
```

It is called from `async def` route handlers (`backend/api/routes/progress.py:21`, `:27`) and
from the background task. Every progress request therefore **blocks the event loop** for the
duration of the Supabase round trip, and concurrent progress requests serialise behind each
other. Only `get_user` is genuinely async (`:94`).

At current scale (single-user practice, three small tables) this is invisible. It is the first
thing to fail under concurrency, and fixing it means an `AsyncClient` plus an async repository
layer — a real refactor, not a one-line change.

### 5.2 Content is cached for the process lifetime

`list_laws()` and `list_levels()` are `@lru_cache(maxsize=None)`
(`backend/repositories/content_repository.py:34`, `:40`). A content edit therefore **requires a
process restart** before the API serves it. There is no TTL, no version key and no invalidation
hook. The frontend has the mirror-image issue: the `@content` alias is a build-time import, so a
content change also needs a frontend rebuild to reach the bundle.

### 5.3 Free-tier cold starts

`render.yaml:5` sets `plan: free`, so the Render service sleeps when idle. The first request
after a sleep is slow. The app degrades correctly rather than breaking — levels and laws come
from the bundle with no network call (`frontend/src/services/contentApi.js:22-29`) and every
score/progress call is `silent: true` — but the learner's first *score submission* after a sleep
can be dropped without any visible feedback.

### 5.4 The engine has no variable ceiling of its own

`SANDBOX.maxVariables = 4` (`frontend/src/config/gameRules.js:112`) is a **config default passed
per call**, not an engine limit. A caller that omits the option inherits the default; the solver
budgets (`SOLVER_BUDGET`, `SANDBOX.budget`) are likewise per-call. The search is exponential in
the variable count, so raising the ceiling without re-measuring the budgets would make the
sandbox appear to hang. `gameRules.js:121-132` records the measured worst cases (26.8k states
over 8 moves for one reference input) — those measurements, not the engine, are what constrain
the ceiling.

## 6. Security limitations

### 6.1 RLS is enabled but permissive for every role

`database/init.sql:56-58` creates one policy per table, named `"Service role full access"` and
defined `FOR ALL USING (true)`. That is permissive for **every** role, including `anon`, and
there is no `auth.uid() = user_id` predicate anywhere. RLS is *on* but it is not *protecting*
anything. **D20**

The shipped app is not exposed by this, because the browser never queries a table — it uses the
Supabase client for `auth` only (`frontend/src/services/supabaseClient.js:10`) and sends all data
requests to the backend, which uses the service-role key. The exposure would require calling
PostgREST directly with the publishable key. See [SAD.md](../02-architecture/SAD.md) §7.2 for the
full argument and what tightening it would involve.

### 6.2 Progress and score values are accepted from the client without validation

`POST /api/progress/save` stores the submitted snapshot verbatim (no validators, no bounds, no
referential checks — **D25**), and `POST /api/score` computes from submitted numbers (**D24**).
A learner can therefore set arbitrary points, arbitrary best scores and arbitrary stars, and can
unlock Level 3 on the first day. `score_history` will contain the inflated figures as though they
were earned.

### 6.3 Three defence-in-depth measures are absent

None of these is a vulnerability on its own; together they mean a single mistake has no safety
net.

| Absent | Consequence |
|---|---|
| **Rate limiting** on `POST /api/score` | The endpoint is unauthenticated and computes on every call; nothing throttles a loop. |
| **CORS is not the protection it looks like** | `allow_credentials=True` with `allow_methods=["*"]` and `allow_headers=["*"]` (`backend/main.py:30-36`). It is correctly restricted to a fixed origin list, but CORS is a browser control only — it does not stop a direct client. |
| **No request-size limit** | `POST /api/progress/save` accepts `stageProgress` and `stageScores` as arbitrary maps; a large body is parsed and forwarded to Supabase. |
| **No integrity check on bundled content** | A tampered `content/levels.json` in a build changes the puzzles and the scoring inputs. Content is trusted as code, which is defensible, but it is a trust assumption worth naming. |

### 6.4 The tutorial gate is a UX gate, not an access control

`TutorialGate` reads client-side progress and states the limitation itself: "this is a UX gate,
not a security boundary. It reads client-side progress; it is not meant to stop a determined
user" (`frontend/src/components/TutorialGate.jsx:31-32`). Likewise `ProtectedRoute` is a
navigation guard — the real authentication boundary is the bearer token check on the two
progress routes.

## 7. Operability and deployment limitations

### 7.1 The API cannot boot without Supabase credentials

```python
settings = Settings.from_env()      # backend/config/settings.py:75 — at import time
```

`Settings.from_env()` calls `require_env("SUPABASE_URL")` and `require_env("SUPABASE_SERVICE_KEY")`
(`:60-61`), which raise `RuntimeError` naming the missing variable. The consequence is
deliberate — a misconfigured deploy fails immediately and loudly — but it is also surprising: the
process cannot start **even to serve `GET /api/levels`**, which needs no Supabase at all. Any
future content-only or health-only deployment would need this changed.

### 7.2 No Docker, no IaC beyond `render.yaml`, no CI

There is no `Dockerfile`, no compose file, no Terraform, and **no CI configuration in the
repository**. `render.yaml` is a 16-line platform manifest for one service. Consequences:

- Local setup is a manual sequence of two servers and a hand-run SQL script
  (`README.md:36-117`).
- Nothing verifies a change before it ships: not the 76 engine tests, not the browser suites,
  not lint.
- Environments cannot be reproduced from the repository alone.

A `run-locally-with-docker.md` guide exists in the suite's scope precisely because this is a
known gap; it must document the absence rather than invent a container that does not exist.

### 7.3 The schema has no migration path

See §4.3. The single hand-run `init.sql` cannot evolve an existing deployment, and no record of
applied changes exists outside git history.

### 7.4 Two deployment targets must be updated in step

The API and the SPA are deployed independently (`render.yaml`, `frontend/vercel.json`). The client
tolerates the pre-envelope response shape (`frontend/src/services/apiClient.js:33-45`), so a
mismatched pair degrades rather than breaks — but there is nothing that *pins* the two, and a
content-vs-API mismatch is possible between a deploy and a rebuild.

### 7.5 `requirements.txt` is unpinned

`backend/requirements.txt` lists five packages with no version constraints (`fastapi`,
`uvicorn[standard]`, `python-multipart`, `python-dotenv`, `httpx`); the root file is a one-line
shim. A clean install therefore resolves to whatever is current, so a breaking upstream release
can break a build with no code change. The engine's `package.json` is pinned more tightly, but
with caret ranges rather than exact versions.

### 7.6 Logs go to stdout only

One JSON object per line on stdout (`backend/core/logging.py:61`) with no file sink, no rotation
and no shipping. On Render that means the platform's log retention is the only retention, and
there is no way to query history beyond it. There is also no request-id propagation to Supabase
calls, so a slow query cannot be correlated from a request id.

## 8. Process and tooling gaps

| Gap | Impact | Evidence |
|---|---|---|
| **No automated backend tests** | Every backend requirement is verified by hand. A regression in scoring, the envelope or the 401 path is silent. **D27** | `find backend -name 'test_*.py'` → nothing; no `pytest` in `backend/requirements.txt` |
| **Nothing verifies the two scoring implementations agree** | The D21 rounding defect survives because no test compares them on reachable totals | 7 engine test files never mention `estimateScore`/`earnedPoints`; `.e2e/acceptance-features.mjs:900` only checks a `+N Points` pill |
| **The engine layer rule is review-enforced only** | Nothing fails the build if `engine/` imports React or `services/` imports a component | `frontend/src/engine/index.js:8-10` states the rule as a convention |
| **2 of 19 `.e2e` suites are not wired into the runner** | `gate-fresh-user-check.mjs` and `lead-engine-fingerprint.mjs` are never run by `run-all-suites.sh`, so they only run when someone remembers | `.e2e/run-all-suites.sh` lists 16 |
| **Lint findings are left visible** | 16 problems across 8 files (11 errors, 5 warnings): `react-hooks/set-state-in-effect` 9, `react-hooks/exhaustive-deps` 5, `no-unused-vars` 2. All pre-existing, in DOM-measurement effects | Ran `npx eslint .` |
| **One layering exception exists** | `frontend/src/services/contentApi.js:10` imports `../content/gameContent.js`, while the stated rule is "services imports config only" | Recorded in [SRS.md](../01-product/SRS.md) §9 |
| **17 files exceed the ~250-line target** | Down from one 2,631-line file, but the guidance is aspirational rather than enforced | Largest: `state/useGameState.js` 620, `pages/ProblemPage.jsx` 521, `pages/LevelSelectPage.jsx` 440 |
| **A dangling doc comment survives a deletion** | `engine/laws/definitions.js:67` documents `definitionsForId`, which no longer exists | Cosmetic, but it reads as if a symbol is missing |

## 9. Limitations inherited from the proposal

The proposal's own Limitations section
([`Software Proposal Writing Guide (LAWS) v2.0.docx.md:139`](../Software%20Proposal%20Writing%20Guide%20%28LAWS%29%20v2.0.docx.md))
makes claims about the product. Here is each one, with its current status.

| The proposal says | Status | Current truth |
|---|---|---|
| Accuracy gains measured in Praxis "cannot be directly equated to performance on institutional examinations". | **Still true.** | No external-validity study exists. The success metrics in [PRD.md](../01-product/PRD.md) §7 are all in-system, and no analytics SDK is installed, so none of them are currently being collected. |
| "The effectiveness of the practice cycle depends on genuine student engagement… students who click randomly without reasoning will not develop meaningful simplification skills." | **Still true, and partly mitigated.** | The forced step sequence makes random clicking unproductive rather than rewarding: a law that changes nothing is refused with no step recorded (`useGameState.js:363-373`), and dead ends are detected (`:53-68`). |
| "The four-variable constraint in Level 3 limits the cognitive complexity of expressions compared to real-world Boolean problems." | **Still true, with a correction.** | Level 3 is four-variable and **fully playable** with 12 puzzles. The sandbox allows learner-typed expressions up to 4 variables (`gameRules.js:112`), configurable in one line. |
| "The usability evaluation will be limited by the number of first-year CCS student participants the team can realistically recruit." | **Still true.** | No usability data is stored in the system. |
| "The platform intentionally excludes Karnaugh maps, truth table construction, combinational circuit design, sequential logic, and hardware description languages." | **Still true, and enforced by the engine contract.** | The engine's move set is the ten taught laws. Note the nuance: `isEquivalent` *can* build a truth table internally, but it is not exposed as a learner feature. |
| "The curriculum covers ten interactive law cards applied across **three difficulty levels**", "**Six problems per level**". | **Superseded by the code.** | **4 levels; the Tutorial has 4 stages and Levels 1–3 have 12 each → 40 puzzles.** Also note the law cards number 10 but the engine's definition table has **15 entries** (SOP and POS forms of the same law share a reference-card id) plus one internal id (`distributive-expand`) that is not a card. **D10** |
| "Level 1 uses two-variable expressions, Level 2 uses three-variable, Level 3 uses four-variable"; "80% accuracy threshold for level unlock"; "spend 20 points on the Guide". | **Confirmed by the code.** | `content/levels.json` varCounts `2, 2, 3, 4` (Tutorial is also 2); `UNLOCK_AVERAGE_SCORE = 80` (`gameRules.js:49`); `GUIDE_COST_POINTS = 20` (`:35`). Notably, this rubric says **80 %** while `context.md` §7 says 70 % — the proposal contradicts itself, and the code agrees with the rubric. |
| "Step-locking requires explicit law application at every intermediate stage before the expression advances." | **Confirmed.** | The history array advances only through `applyLaw` (`useGameState.js:425`); reordering is explicitly not a step (`:522`). |

## 10. Things that look wrong but are correct

Recording these saves the next reader from "fixing" a deliberate decision. Each is also an ADR.

| Looks like a bug | Why it is correct | Reference |
|---|---|---|
| The same component appears on two routes (`ProblemPage` at `/level/…` and `/sandbox/play`). | Sandbox mode is the **absence of route params**, so the mode cannot desynchronise from the URL, and the sandbox plays the real workspace instead of a copy. | [ADR-007](design-decisions.md#adr-007--one-parameterized-workspace-for-graded-and-sandbox-play) |
| `POST /api/score` answers `200` for a signed-out caller. | It is a calculator, not a state change; persistence is conditional on `user` being present. The auth boundary follows the data boundary. | [ADR-002](design-decisions.md#adr-002--scoring-is-backend-authoritative-and-client-mirrored) |
| A solution **shorter** than `optimalSteps` still scores 40/40. | `min(optimal, steps_used)` means a better-than-authored solution cannot be penalised for beating the recorded optimum. | `scoring_service.py:88` |
| A puzzle with no `targetLaws` gets the full 30 for that band. | Otherwise such a puzzle would be unwinnable at full marks. | `scoring_service.py:102` |
| `stageScores` never contains a `0`. | `build_progress` guards with `best_score > 0`, so an unsolved stage is simply absent. | `progress_service.py:41` |
| `saveScore` can decline to write. | `update` returns early when the new score is not better, so the state object is identical and no `localStorage` write or server save happens. | `progressStore.js:61-62`, `:209-215` |
| The `not` law family is offered from a **single** click. | De Morgan and Double Negation act on one node, so a second selection would be meaningless. | `useGameState.js:172-179` |
| The tutorial's first stage cannot be reached through the gate. | The gate exempts the tutorial level deliberately; without the exemption the redirect target would equal the current URL, which is a React Router no-op that renders a blank page. | `TutorialGate.jsx:21-25`, `:41-43` |
| The law reference drawer shows `associative`, which the engine never emits. | The drawer is a **reference** for the curriculum, not a list of automated moves. | `REFACTOR_REPORT.md` §5b |
| `services/soundEffects.js` makes sound with no audio files. | Cues are synthesised from `SOUND.cues` (oscillator, notes, envelope) in `config/gameRules.js:148-170`. | [SDD.md](../02-architecture/SDD.md) §5.3 |

## 11. Unverified items

Stated rather than guessed, as the conventions require.

| Item | Why unverified |
|---|---|
| **Whether any learner has actually hit the D21 rounding divergence in production** | Requires telemetry that does not exist. The divergence is proven reachable (three of nineteen totals, enumerated) but not observed. |
| **Supabase project configuration** | The project's own dashboard settings (email confirmation on/off, password policy, JWT expiry) are not in the repository. `RegisterPage` navigates on session creation, which implies email confirmation is **off** in the deployed project, but that is an inference from behaviour, not a verified setting. |
| **The live deployed API's behaviour** | All API verification was against `backend/main.py` in-process with `fastapi.testclient`. The Render URL in `frontend/vercel.json:5` was read, not called. |
| **Whether Supabase enforces the `UNIQUE(user_id, level_id, stage_idx)` constraint as the upsert conflict target expects** | The schema declares it (`init.sql:24`) and `STAGE_CONFLICT_COLUMNS` names it (`progress_repository.py:18`), but no live upsert was performed during documentation (deliberately — this pass wrote nothing to the database). |
| **PostgREST behaviour for an invalid `laws_used` array element** | `laws_used TEXT[] NOT NULL` accepts any strings; no constraint narrows it. Not exercised. |
| **`.e2e/` suite results on this commit** | The suites require a running dev server and a browser. `REFACTOR_REPORT.md` §5 records their results at the refactor's frozen tree; they were not re-run for this documentation pass. |
| **Whether the two unwired `.e2e` suites still pass** | `gate-fresh-user-check.mjs` and `lead-engine-fingerprint.mjs` are not in `run-all-suites.sh` and were not run. |
| **Repository growth and contributor statistics** | 115 commits on branch `refactor/ui/ux` at `3838343`; `main` was never checked out. Not a product property. |

## 12. Severity summary

**The register contains 28 rows, D0–D27.** 23 of them correct a written claim — in `context.md`,
the original task brief, or the LAWS rubric — and the other 5 (D22, D24, D25, D26, D27) are
defects found by executing or reading the system rather than by reading a document. Severity is
assigned per row.

| Sev | Register rows | IDs | Plus, outside the register |
|---|---|---|---|
| **High** | **17** | D0, D1, D2, D3, D4, D5, D6, D7, D9, D10, D17, D19, D20, D21, D23, D24, D25 | §5.1 blocking I/O on the event loop; §6.2 client-supplied progress accepted verbatim |
| **Medium** | **8** | D8, D12, D14, D15, D18, D22, D26, D27 | §3.3 canonical-text completion; §7.1 the API cannot boot without Supabase |
| **Low** | **3** | D11, D13, D16 | §8 cosmetic process gaps |
| | **28 total** | | |

### The five things to fix first

If someone is deciding what to work on, this is the order the evidence suggests:

1. **Make the balance and the ledger agree at `.5` totals** (§3.1). Small, contained, and it is
   the only item that corrupts data the learner can see. Align the rounding function *and* make
   the server's `earnedPoints` the only figure credited to the balance.
2. **Add a pytest suite for the API** (§8, D27). The envelope, the 404/422/401 paths and the
   scoring boundary cases — including a test that the client mirror and the server agree on all
   19 reachable totals. Nothing currently protects the highest-value logic on the server.
3. **Tighten the RLS policies** (§6.1, D20). Replace `USING (true)` with
   `auth.uid() = user_id` predicates and verify the service-role path still bypasses RLS. The
   schema already has the foreign key the predicate needs.
4. **Add validation to `POST /api/progress/save`** (§6.2, D25). Bounds on `points`, `streak`,
   `best_score`, and range checks on level and stage — the pydantic models are the natural place.
5. **Fix the unlock gate's rounding** (§3.5, D26). One line: compare the unrounded average, or
   state the intended `>= 79.5` explicitly.

### What is genuinely fine

Not everything here is a problem. The engine is pure, exhaustively tested and property-tested;
the engine contract removes an entire class of drift; the layered backend is small and honest
about its boundaries; the shared workspace means there is one place to fix an interaction bug;
progress survives a device switch without ever losing a local best; and every limitation in this
document is *known* rather than latent. The system's weaknesses are mostly consequences of two
deliberate bets — the client owns the algebra, and the client owns the progression rules — and
both are documented with the conditions under which they should be revisited
([why-this-architecture.md](why-this-architecture.md) §12).
