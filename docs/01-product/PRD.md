# PRD — Praxis Product Requirements

**What this is.** The product requirements for Praxis, an interactive Boolean-algebra
trainer, written against the **code as it exists today** — not against
[`context.md`](../context.md), which is a stale proposal (see
[known-limitations.md](../07-explanation/known-limitations.md) for the full
proposal-vs-code register). Every requirement below traces to a route, screen, module or
endpoint that a reader can open.

**Who it's for.** A new teammate (including a student) who needs to know *what the product
is supposed to do* before touching code, and anyone reviewing whether the shipped product
matches its intent.

---

## Contents

1. [Problem statement](#1-problem-statement)
2. [Goal and non-goals](#2-goal-and-non-goals)
3. [Personas](#3-personas)
4. [The real user journey](#4-the-real-user-journey)
5. [Functional requirements](#5-functional-requirements)
6. [Non-functional requirements](#6-non-functional-requirements)
7. [Success metrics](#7-success-metrics)
8. [Out of scope](#8-out-of-scope)
9. [Requirement index](#9-requirement-index)
10. [Known discrepancies affecting this document](#10-known-discrepancies-affecting-this-document)

---

## 1. Problem statement

Boolean algebra is taught as a list of laws to memorise. Learners can recite
`A + AB = A` and still fail to *see* which law applies to the expression in front of them.
The gap is not knowledge of the law; it is **(a) recognising an applicable law in a
concrete expression, (b) knowing when a derivation is finished, and (c) knowing whether the
derivation was efficient**. Pen-and-paper practice gives no feedback on any of the three,
and a textbook answer key only reveals the final form, never the path.

Praxis closes that gap by making the derivation itself the unit of play:

- the learner **selects parts of an expression** and the engine reports which laws apply to
  that selection (`frontend/src/engine/laws/index.js:33`),
- applying a law produces an **animation, then a recorded step**, so the rewrite is seen
  rather than asserted (`frontend/src/state/useGameState.js:398`),
- completion is decided by **order-independent canonical-text equality** between the current
  expression and the goal — `canonText(current) === canonText(goal)`
  (`frontend/src/state/useGameState.js:481`) — not by raw string equality, and **not** by a
  semantic check. FR-23 states what that does and does not guarantee,
- the finished derivation is **scored on three independent metrics** — efficiency, target
  laws, independence from assistance (`backend/services/scoring_service.py:32`) — and the
  result is persisted per learner.

## 2. Goal and non-goals

### Goal

Give a learner a **graded practice loop** — pick a puzzle, derive the simplified form, get a
score that rewards the *shortest route that applies the intended laws* — the efficiency bar, which is
deliberately not the raw shortest path — plus an **unscored sandbox** where they can bring their own
expression or roll a random one. The scoring model is
[scoring-and-rewards.md](../06-reference/scoring-and-rewards.md); worked example W9 shows why the two
routes differ.

### Non-goals (deliberately not built)

| Non-goal | Why not |
|---|---|
| Teaching the laws from first principles (proofs, truth-table tutorials) | Praxis drills *application*; the law cards in `content/laws.json` are a reference, not a lesson. |
| Verifying algebra on the server | There is exactly one Boolean engine, in JavaScript; the backend never re-implements it [D-Note]. See [why-this-architecture.md](../07-explanation/why-this-architecture.md). |
| Multiplayer, classrooms, teacher dashboards | No group model exists in `database/init.sql`; progress is per `auth.users` row. |
| A general Boolean CAS (arbitrary variable counts, CNF minimisation) | The engine's move set is the 10 taught laws; the sandbox caps input at 4 variables (`frontend/src/config/gameRules.js:110`). |
| Content authoring UI | Content is static JSON: `content/laws.json`, `content/levels.json`. |

> **D-Note (D1/D23).** The original task brief asked for a `POST /sandbox/validate`
> endpoint. **No such endpoint exists** and none is planned: sandbox validation is 100 %
> client-side (`frontend/src/engine/sandbox/validate.js:155`,
> `frontend/src/engine/sandbox/input.js:109`).

## 3. Personas

### P1 — "First-year CS student" (primary)

Has been taught the laws once. Can follow a worked example but freezes on a blank problem.
Needs: a **guided first run** (the tutorial), a **law reference always one tap away**, and
permission to be wrong cheaply (undo, reset, hints).
Relevant requirements: FR-4, FR-8, FR-10, FR-11, FR-12, FR-18, FR-19.

### P2 — "Returning learner" (primary)

Has partial progress. Cares that progress **survives a refresh and a device switch**, and
wants to replay a stage to beat their own score.
Relevant requirements: FR-7, FR-8, FR-14, FR-15, FR-19.

Reality check: progress is durable in two places — `localStorage` immediately
(`frontend/src/state/progressStore.js:69`) and Supabase for a signed-in learner via a
debounced `POST /api/progress/save` (`frontend/src/state/progressStore.js:87`), merged
server-into-local on load (`frontend/src/state/progressStore.js:97`).

### P3 — "Explorer" (secondary)

Finished the levels and wants to test an idea: "is `A(B + A')` simplifiable?" — the sandbox
answers it in the browser, with no account-gated content and no score at stake.
Relevant requirements: FR-16, FR-17.

### P4 — "Course instructor / evaluator" (secondary)

Wants to know whether the tool is sound: does it only ever offer valid rewrites, and does it
define "done" correctly?
Relevant requirements: NFR-1, NFR-2, NFR-3.

## 4. The real user journey

This is the journey the code actually implements. Compare with
[`context.md`](../context.md) §4/§10, which describes a 4-route app with no login —
wrong on both counts (register rows **D4** and **D5**).

```
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ 1. LANDING            /                     LandingPage                 │
   │    public. Hero + "Start Learning Free" / "I already have an account",  │
   │    or "Go to Level Selection" when a session already exists.            │
   │    App.jsx:32 · LandingPage.jsx:94                                       │
   └───────────────────────────────┬─────────────────────────────────────────┘
                                   │ no session → /register or /login
   ┌───────────────────────────────▼─────────────────────────────────────────┐
   │ 2. REGISTER / LOGIN   /register  /login     RegisterPage / LoginPage     │
   │    Supabase Auth signUp/signIn → authActions.js:19,9                     │
   │    On session: register → /levels (RegisterPage.jsx:24),                 │
   │               login    → /       (LoginPage.jsx:22)                      │
   └───────────────────────────────┬─────────────────────────────────────────┘
                                   │ every protected route
   ┌───────────────────────────────▼─────────────────────────────────────────┐
   │ 3. SESSION GATE       ProtectedRoute   no session → /login               │
   │                       ProtectedRoute.jsx:27                               │
   └───────────────────────────────┬─────────────────────────────────────────┘
                                   │
   ┌───────────────────────────────▼─────────────────────────────────────────┐
   │ 4. TUTORIAL GATE      TutorialGate                                       │
   │    Holds until progress hydrates, then:                                  │
   │      /levels   → tutorial if never started                               │
   │      levels 1-3, /sandbox → tutorial until ALL 4 tutorial stages done    │
   │    TutorialGate.jsx:47,56,62 · carries returnTo so the learner lands     │
   │    where they were heading.                                              │
   └───────────────────────────────┬─────────────────────────────────────────┘
                                   │
   ┌───────────────────────────────▼─────────────────────────────────────────┐
   │ 5. TUTORIAL (level 0)  /level/0/stage/0?tutorial=true                    │
   │    4 stages, on-rails: coach cards, spotlight, forced law choice.        │
   │    content/levels.json id 0 (4 puzzles) · InteractiveTutorial.jsx        │
   └───────────────────────────────┬─────────────────────────────────────────┘
                                   │ tutorial complete
   ┌───────────────────────────────▼─────────────────────────────────────────┐
   │ 6. LEVEL CAROUSEL     /levels                  LevelSelectPage           │
   │    4 real cards + a synthetic Sandbox card, one list:                    │
   │      Tutorial (0)  always open                                           │
   │      Level 1 (1)   needs the full tutorial                               │
   │      Level 2 (2)   needs Level 1 all stages done AND avg ≥ 80            │
   │      Level 3 (3)   needs Level 2 all stages done AND avg ≥ 80            │
   │      Sandbox       needs the full tutorial                               │
   │    LevelSelectPage.jsx:60-123                                            │
   └───────────────────────────────┬─────────────────────────────────────────┘
                                   │ "VIEW STAGES" → /level/:id/stages
   ┌───────────────────────────────▼─────────────────────────────────────────┐
   │ 7. STAGE MATRIX       /level/:id/stages        StageSelectorPage         │
   │    Stage N available iff N-1 completed (stage 0 always) —               │
   │    StageSelectorPage.jsx:55-62. Stars per stage, 80 % gate bar,          │
   │    mastery badge on Level 3.                                            │
   └───────────────────────────────┬─────────────────────────────────────────┘
                                   │ "Play" / "Review" → /level/:id/stage/:idx
   ┌───────────────────────────────▼─────────────────────────────────────────┐
   │ 8. PUZZLE WORKSPACE   /level/:levelId/stage/:stageIdx   ProblemPage      │
   │    select → law → animate → step recorded → repeat.                     │
   │    Hint (free, costs score), Guide (20 points), Undo, Reset, Reorder.    │
   │    ProblemPage.jsx · usePuzzleSession.js · useGameState.js               │
   └───────────────────────────────┬─────────────────────────────────────────┘
                                   │ expression ≡ goal
   ┌───────────────────────────────▼─────────────────────────────────────────┐
   │ 9. COMPLETION         ScoreModal                                         │
   │    Local estimate renders at 0 ms; POST /api/score returns the           │
   │    authoritative score and overwrites it. +10 base XP and the bonus      │
   │    are added once, on first completion only (usePuzzleSession.js:190).   │
   │    → Next Stage | Try Again | Review Completed Derivation                │
   └─────────────────────────────────────────────────────────────────────────┘
```

**Sandbox branch (off step 7):**

```
   /sandbox (SandboxPage)                      /sandbox/play (ProblemPage, sandbox mode)
   type an expression → live syntax verdict     the SAME workspace, no route params
   → "Validate & Play"                          → no score, no points, no persistence
   → buildSandboxPuzzle() decides solvability   → "New Problem" / "New expression"
   SandboxPage.jsx:163-187 · sandboxPuzzle.js:81
```

### Why step 8 serves two modes

There is **one** workspace component for graded play and the sandbox, and the mode is
decided by the *absence of route params*:
`const isSandbox = !levelId && !stageIdx`
(`frontend/src/components/puzzle/usePuzzleSession.js:40`). That single decision is what makes
`/sandbox/play` free and is the subject of an architectural decision record — see
[design-decisions.md](../07-explanation/design-decisions.md).

## 5. Functional requirements

IDs are stable and are reused verbatim in
[SRS.md](SRS.md) (which maps each one to an implementing file and a verifying test) and
[SDD.md](../02-architecture/SDD.md) (which describes the modules that satisfy them).

### Authentication and entry

| ID | Requirement | Primary evidence |
|---|---|---|
| **FR-1** | A visitor can register with name, email and password. The client rejects passwords shorter than 6 characters and mismatched confirmations before any network call. | `frontend/src/pages/RegisterPage.jsx:32`, `:44` |
| **FR-2** | A registered learner can sign in with email and password; on success the app navigates to the landing route, which then offers level selection. | `frontend/src/pages/LoginPage.jsx:20`, `frontend/src/services/authActions.js:9` |
| **FR-3** | A signed-in learner can sign out from the landing page and the level carousel. | `frontend/src/pages/LandingPage.jsx:17`, `frontend/src/pages/LevelSelectPage.jsx:138` |
| **FR-4** | A public landing page states the product's purpose and offers register / sign-in, or level selection when already signed in. | `frontend/src/pages/LandingPage.jsx:83`, `:94` |

### Gating

| ID | Requirement | Primary evidence |
|---|---|---|
| **FR-5** | Every level, stage, puzzle and sandbox route requires a session; an unauthenticated visit redirects to `/login`. | `frontend/src/components/ProtectedRoute.jsx:27`, `frontend/src/App.jsx:40-53` |
| **FR-6** | Levels 1–3 and the sandbox are blocked until **all 4** tutorial stages are complete. The gate waits for progress hydration before deciding, and carries the intended destination so the learner resumes there. | `frontend/src/components/TutorialGate.jsx:47`, `:62`, `:68` |
| **FR-7** | The tutorial level (id 0) is always reachable, in both route shapes, so the gate can never produce a blank page. | `frontend/src/components/TutorialGate.jsx:41-43` |

### Content

| ID | Requirement | Primary evidence |
|---|---|---|
| **FR-8** | The app can list all levels as metadata and retrieve one level with its full puzzle data. | `backend/api/routes/levels.py:18`, `:24` |
| **FR-9** | The app can list all Boolean law reference cards in authoring order. | `backend/api/routes/laws.py:18` |
| **FR-10** | Level and law content is one artefact consumed by both the API and the SPA bundle, so the two can never disagree. | `backend/repositories/content_repository.py:16`, `frontend/vite.config.js:16`, `frontend/src/content/gameContent.js:14` |

### Progression

| ID | Requirement | Primary evidence |
|---|---|---|
| **FR-11** | The level selector renders the Tutorial, Levels 1–3 and a Sandbox entry as one carousel, each card showing its lock state and the reason for it. | `frontend/src/pages/LevelSelectPage.jsx:51`, `:293`, `:300-327` |
| **FR-12** | Level 2 unlocks only when every Level 1 stage is done **and** the Level 1 average score reaches 80; Level 3 likewise from Level 2. Tutorial and Level 1 both require the full tutorial. | `frontend/src/state/progressStore.js:309`, `frontend/src/pages/LevelSelectPage.jsx:94-120` |
| **FR-13** | Within a level, stage *N* is playable only after stage *N−1* is completed (stage 0 always). | `frontend/src/pages/StageSelectorPage.jsx:56` |
| **FR-14** | A stage shows its best score and a 0–3 star rating derived from that score (90 / 75 / any completion). | `frontend/src/state/progressStore.js:281`, `frontend/src/pages/StageSelectorPage.jsx:68` |

### The workspace

| ID | Requirement | Primary evidence |
|---|---|---|
| **FR-15** | The workspace renders the current expression as a tree and lets the learner select two literals, two clauses, or a single negated node; it reports which laws apply to that selection and refuses selections with no law. | `frontend/src/state/useGameState.js:240`, `:314`, `:351`, `frontend/src/engine/laws/index.js:33` |
| **FR-16** | Applying a law plays the law's animation and only then commits the new tree as a derivation step; an application that does not change the expression is rejected with a message and no step. | `frontend/src/state/useGameState.js:407`, `:467` |
| **FR-17** | Every applied step is recorded in a history the learner can undo, and each past step can be inspected to show the law it applied. | `frontend/src/state/useGameState.js:505`, `frontend/src/components/puzzle/StepHistoryPanel.jsx` |
| **FR-18** | Terms and factors can be reordered by drag **without** consuming a step or a score penalty. | `frontend/src/state/useGameState.js:567`, `frontend/src/hooks/useTermDrag.js:235` |
| **FR-19** | The workspace can be reset to the puzzle's initial expression; when the stage is already complete a confirmation modal appears unless the learner has opted out for the session. | `frontend/src/state/useGameState.js:531`, `frontend/src/pages/ProblemPage.jsx:275` |
| **FR-20** | A dead end — a non-goal expression from which no further legal move exists — is detected and explained, and the UI stops offering laws. | `frontend/src/state/useGameState.js:54`, `frontend/src/state/hintText.js:10` |

### Assistance

| ID | Requirement | Primary evidence |
|---|---|---|
| **FR-21** | The Hint button returns a contextual suggestion derived from the **current** expression, falling back to the puzzle's authored hints; taking a hint decrements the independence metric and is counted. | `frontend/src/state/useGameState.js:545`, `frontend/src/state/hintText.js:18` |
| **FR-22** | The Guide highlights the next productive move and either pre-selects the two items or highlights the single node to click; on a graded level it costs 20 points and a learner with insufficient points is told so. | `frontend/src/state/useGameState.js:604`, `frontend/src/pages/ProblemPage.jsx:263-273` |

### Completion and scoring

| ID | Requirement | Primary evidence |
|---|---|---|
| **FR-23** | A puzzle is complete exactly when the current expression and the goal render to the same **canonical text** — order-independent, but textual rather than semantic. A logically equivalent terminal form with different canonical text does not complete the puzzle. | `frontend/src/state/useGameState.js:481`, `:84`; `frontend/src/engine/render.js:28` |
| **FR-24** | Completion is scored on three independent bands — efficiency (40), target laws (30), independence (30) — and returns a per-metric breakdown. | `backend/services/scoring_service.py:49`, `backend/config/constants.py:9` |
| **FR-25** | The server score is authoritative; the client renders an immediate local estimate and replaces it when `POST /api/score` answers. | `frontend/src/components/puzzle/usePuzzleSession.js:173`, `:200-213` |
| **FR-26** | Completion awards a fixed 10 XP plus a bonus of up to 5 points proportional to the total score, **once** per stage, only on first completion. | `frontend/src/config/gameRules.js:32`, `frontend/src/components/puzzle/usePuzzleSession.js:190` |
| **FR-27** | The completion modal shows the three metric bars, the total, the XP awarded, the optimal-path tip when efficiency was imperfect, and next-step actions. | `frontend/src/components/puzzle/ScoreModal.jsx:106-160` |
| **FR-28** | A signed-in learner's score is persisted: one `score_history` row per attempt and a raised `stage_progress.best_score`, in a background task that cannot fail the response. | `backend/services/progress_service.py:87`, `backend/api/routes/score.py:39` |

### Persistence

| ID | Requirement | Primary evidence |
|---|---|---|
| **FR-29** | Progress is written to `localStorage` on every change and pushed to the server, debounced, for a signed-in learner. | `frontend/src/state/progressStore.js:69`, `:87` |
| **FR-30** | On load, a signed-in learner's server progress is **merged** into local progress, never overwriting it — best score wins, points take the maximum, completed stages union. | `frontend/src/state/progressStore.js:97-130` |
| **FR-31** | A completed derivation is stored locally so that revisiting a stage restores the solved state instead of an empty workspace. | `frontend/src/state/progressStore.js:217`, `frontend/src/state/useGameState.js:119` |
| **FR-32** | A signed-in learner can load and save a full progress snapshot through two bearer-authenticated endpoints. | `backend/api/routes/progress.py:20`, `:26` |

### Sandbox

| ID | Requirement | Primary evidence |
|---|---|---|
| **FR-33** | A learner can type a Boolean expression and receive a **live, debounced** syntax verdict; an untouched empty field shows a neutral helper, not an error. | `frontend/src/pages/SandboxPage.jsx:117`, `:130` |
| **FR-34** | Submitting runs a stricter **solvability** verdict: an expression that is already simplest, or that the engine cannot fully simplify within budget, is refused with a specific message instead of being played. | `frontend/src/engine/sandbox/input.js:153-182` |
| **FR-35** | An accepted expression is handed to the same workspace used by graded levels; the sandbox awards no points, no stars and writes no progress. | `frontend/src/pages/SandboxPage.jsx:178`, `frontend/src/components/puzzle/usePuzzleSession.js:185` |
| **FR-36** | A learner can instead roll a solver-verified random problem, and re-roll inside the workspace. | `frontend/src/engine/sandbox/generator.js:234`, `frontend/src/components/puzzle/usePuzzleSession.js:262` |
| **FR-37** | A typed sandbox expression survives a page refresh. | `frontend/src/components/puzzle/sandboxPuzzle.js:46` |

### Tutorial, feedback, ergonomics

| ID | Requirement | Primary evidence |
|---|---|---|
| **FR-38** | The tutorial is a 4-stage guided walkthrough on the real workspace: coach cards, a spotlight on the control under discussion, and a welcome deck before the first stage. | `frontend/src/content/tutorialContent.js`, `frontend/src/components/InteractiveTutorial.jsx:194` |
| **FR-39** | The tutorial pauses 1500 ms on the law about to be applied before running its 1350 ms animation, so the learner can see what is about to happen. | `frontend/src/config/gameRules.js:60-62`, `frontend/src/state/useGameState.js:494` |
| **FR-40** | Sound cues exist for step, hint, guide, correct, wrong, reset and completion, with a persisted on/off preference defaulting to on. | `frontend/src/config/gameRules.js:148`, `frontend/src/services/soundEffects.js:43` |
| **FR-41** | Phones in portrait see a blocking rotate overlay; small tablets in portrait see a dismissible banner; pointer-fine windows are never reclassified as phones. | `frontend/src/hooks/useDeviceTier.js:57-94`, `frontend/src/components/OrientationGate.jsx:16` |
| **FR-42** | The workspace re-homes its panels per device tier so the canvas keeps usable width and every control stays reachable, while the desktop three-column layout is unchanged. | `frontend/src/pages/ProblemPage.jsx:64-99`, `:363-424` |
| **FR-43** | A feedback survey link is reachable from the landing page, the level carousel, the stage matrix and the workspace header. | `frontend/src/config/appLinks.js:9`, `frontend/src/components/layout/SurveyButton.jsx:13` |

## 6. Non-functional requirements

| ID | Requirement | Target / evidence |
|---|---|---|
| **NFR-1** | **Single source of algebraic truth.** Exactly one Boolean engine exists, in JS. The backend serves content and scores numbers; it never parses or rewrites algebra. | `frontend/src/engine/index.js` is the only engine; no algebra in `backend/`. See [why-this-architecture.md](../07-explanation/why-this-architecture.md). |
| **NFR-2** | **Engine purity.** `frontend/src/engine/**` imports only `config/` and itself — no React, no DOM, no network, no `fetch`. | Verified by import analysis: the only cross-folder imports in `engine/` are `../../config/gameRules.js` (`frontend/src/engine/scoring.js:18`, `frontend/src/engine/sandbox/input.js:36`). |
| **NFR-3** | **Evidence for correctness.** Every rewrite is accepted only if it preserves semantics under exhaustive truth-table equivalence, and the law table is property-tested. | `frontend/src/engine/equivalence.js:45`, `frontend/src/engine/__tests__/law-soundness.property.test.js` |
| **NFR-4** | **Engine test suite passes.** 81 tests, 0 failures, no browser and no backend required. | Ran `cd frontend && npm test` → `# tests 81 / # pass 81 / # fail 0`. |
| **NFR-5** | **Uniform API contract.** Every `/api/*` response is `{success, data, error}`, including framework 404 and validation 422. `GET /` is deliberately the one exception. | `backend/core/responses.py:24`, `backend/main.py:50-66`, `backend/api/routes/health.py:15` |
| **NFR-6** | **Honest auth boundary.** Progress routes require a valid Supabase bearer token and answer `401 unauthorized` without one. | `backend/core/security.py:17`, live-verified: `GET /api/progress` → `401 {"code":"unauthorized","message":"Not authenticated"}`. |
| **NFR-7** | **No secret in the repository or in documentation.** Credentials come from gitignored env files; docs use placeholders only. | `.gitignore:3` (`backend/.env`), `frontend/.gitignore:15` (`frontend/.env.local`), `backend/config/settings.py:19`, `frontend/src/services/supabaseClient.js:7` |
| **NFR-8** | **Interactive latency.** The law animation is 1350 ms; the local score breakdown renders before the network answers; content is bundled so levels and laws need no round trip. | `frontend/src/config/gameRules.js:60`, `frontend/src/services/contentApi.js:14` |
| **NFR-9** | **Graceful degradation.** A failed score submission, progress sync or content fetch must never block gameplay; such calls pass `silent: true`. | `frontend/src/services/apiClient.js:53`, `frontend/src/services/scoreApi.js:31`, `frontend/src/services/progressApi.js:12` |
| **NFR-10** | **Observability.** Every response carries `X-Request-ID`; every request emits one JSON log line including that id, status and duration. | `backend/core/middleware.py:27`, `:48`, `backend/core/logging.py:34` |
| **NFR-11** | **Maintainability.** Layer boundaries hold by review; tunable numbers live in exactly two config modules. | `docs/ARCHITECTURE.md` §4; `frontend/src/config/gameRules.js`, `backend/config/constants.py` |
| **NFR-12** | **Device compatibility.** The workspace is usable across phone landscape, tablet portrait/landscape and desktop, decided by width/touch capability with no User-Agent sniffing. | `frontend/src/hooks/useDeviceTier.js:5-9`, `.e2e/responsive-tiers.mjs` |
| **NFR-13** | **Accessibility of interaction.** Touch tiers get ≥44 px hit targets; popups are collision-placed and clamped inside the viewport; the sandbox verdict is announced via `role="status"`/`role="alert"`. | `frontend/src/pages/ProblemPage.jsx:356`, `frontend/src/pages/SandboxPage.jsx:286`, `frontend/src/hooks/useCollisionPlacement.js:164` |
| **NFR-14** | **Deployability.** Backend on Render from `render.yaml` as a single web service; SPA on Vercel with `/api/*` rewritten to the Render host. | `render.yaml:1-16`, `frontend/vercel.json:1-12` |
| **NFR-15** | **Content operability.** Adding a level or a puzzle is a data edit only; adding a law also requires an entry in the engine's law table. | `docs/ARCHITECTURE.md` §3, `content/levels.json`, `frontend/src/engine/laws/definitions.js:29` |

## 7. Success metrics

These are the metrics the shipped product can actually be measured against today. No
analytics SDK is installed, so each one names its measurement source.

| Metric | Definition | Source that can measure it |
|---|---|---|
| **M1 Completion rate** | Share of started stages that reach `isComplete`. | `score_history` row count vs `stage_progress` rows per user (`database/init.sql:28`) |
| **M2 Score distribution** | Histogram of `score_history.total`. | `score_history.total` (`database/init.sql:39`) |
| **M3 Assistance rate** | Share of attempts with `hints_used > 0`. | `score_history.hints_used` — note this column stores hints **+ guides** as one figure (`backend/services/progress_service.py:101`; the sum is computed at `backend/services/scoring_service.py:51`) |
| **M4 Derivation efficiency** | `steps_used` vs the puzzle's `optimalSteps`. | `score_history.steps_used` vs `content/levels.json` |
| **M5 Mastery reach** | Share of learners who unlock Level 3, i.e. reach an 80 average on Levels 1 and 2. | `stage_progress.best_score` per user, aggregated as `frontend/src/state/progressStore.js:291` does |
| **M6 Tutorial funnel** | Share of learners who finish all 4 tutorial stages. | `stage_progress` rows with `level_id = 0` per user |
| **M7 Content health** | No level or puzzle ever reaches `503 content_unavailable` or a 404 for a bundled id. | `backend/core/errors.py:60`, backend logs (`backend/core/logging.py:34`) |

Targets are intentionally unset: there is no baseline yet. The first job of any future
instrumentation is to capture M1, M3 and M6 before setting thresholds.

## 8. Out of scope

- **Server-side algebra or server-side validity checking.** The server scores submitted
  numbers and never checks that the derivation was legal. This is a deliberate boundary with
  a named consequence: a malicious client could submit a fabricated score. See
  [known-limitations.md](../07-explanation/known-limitations.md).
- **Password reset, email verification, OAuth providers, MFA.** Auth is delegated to
  Supabase Auth with the two flows the UI implements (FR-1, FR-2).
- **Per-user row security.** The RLS policies are `USING (true)` for all roles [D20];
  tightening them is future work, not a shipped feature.
- **Level 4+.** The carousel has a `COMING_SOON` list and it is **empty** —
  the four content levels are all playable (`frontend/src/pages/LevelSelectPage.jsx:20`).
- **Offline-first sync conflict resolution.** The merge is
  best-value-wins (`frontend/src/state/progressStore.js:97`) rather than a CRDT or a
  version vector.
- **Server-side progress validation.** `POST /api/progress/save` stores whatever snapshot
  the client sends (`backend/api/schemas/progress.py:11`).
- **Content authoring/validation tooling.** A malformed `levels.json` fails at read time as
  a `503` (`backend/repositories/content_repository.py:24`); there is no schema check.

## 9. Requirement index

| Group | IDs |
|---|---|
| Authentication and entry | FR-1 – FR-4 |
| Gating | FR-5 – FR-7 |
| Content | FR-8 – FR-10 |
| Progression | FR-11 – FR-14 |
| Workspace | FR-15 – FR-20 |
| Assistance | FR-21 – FR-22 |
| Completion and scoring | FR-23 – FR-28 |
| Persistence | FR-29 – FR-32 |
| Sandbox | FR-33 – FR-37 |
| Tutorial, feedback, ergonomics | FR-38 – FR-43 |
| Quality attributes | NFR-1 – NFR-15 |

**43 functional requirements, 15 non-functional requirements.** [SRS.md](SRS.md) carries the
same 58 ids with acceptance criteria and a traceability table; nothing here is renumbered
there.

## 10. Known discrepancies affecting this document

Each row is a place where the stale proposal in [`context.md`](../context.md) (or the original
task brief) describes something this PRD does not, because the code disagrees. The full
D0–D23 register lives in
[known-limitations.md](../07-explanation/known-limitations.md).

| ID | This PRD says | `context.md` says | Resolution here |
|---|---|---|---|
| D0 | The product description is taken from the code. | `context.md` presents itself as the project context. | `context.md` is an historical proposal; it is stale in §2, §5, §10, §11 and §12. |
| D4 | Landing, login and register pages exist (FR-1 – FR-4). | "Landing page ❌ MISSING", "Login page ❌ MISSING", "Register page ❌ MISSING", "Protected routes ❌ MISSING". | The pages and `ProtectedRoute` all exist; the proposal is wrong. |
| D5 | Nine routes, `/` is the landing page, level selection is `/levels`. | Four routes, `/` is the carousel, "no landing page exists". | Route table in §4 above reflects `frontend/src/App.jsx:30-57`. |
| D9 | 80 % average unlock, and Level 3 is fully playable. | "≥ 70 %", Level 3 "permanently Coming Soon". | `frontend/src/config/gameRules.js:49`, `backend/config/constants.py:26`; Level 3 has 12 puzzles in `content/levels.json`. |
| D10 | **4 levels; the Tutorial (id 0) has 4 stages and Levels 1–3 have 12 each → 40 puzzles total.** | "3 levels… 6 puzzles each", Level 3 empty. | Counted from `content/levels.json` (`[4,12,12,12]`) and live-verified via `GET /api/levels` → `puzzleCount` `[4,12,12,12]`. |
| D11 | 81 engine tests (NFR-4). | 46 unit tests. | Ran `npm test`: 81/81 pass. |
| D12 | 1350 ms law animation (FR-39). | 2.5 s animation. | `frontend/src/config/gameRules.js:60`. |
| D20 | RLS is permissive, not per-user (out of scope). | RLS described as a safety feature. | `database/init.sql:56-58` is `FOR ALL USING (true)`. |
