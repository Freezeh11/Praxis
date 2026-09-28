# SRS — Praxis Software Requirements Specification

**What this is.** The testable specification of Praxis: every functional and non-functional
requirement with its acceptance criteria, the external interfaces it depends on, the data it
stores, and a traceability matrix from requirement id to implementing file to verifying
test. Requirement ids are the ones defined in [PRD.md](PRD.md) — nothing is renumbered
here.

**Who it's for.** Whoever has to decide whether a change is *allowed*: a reviewer checking a
pull request, a tester writing a case, or a new teammate asking "is this behaviour required
or accidental?". A requirement here is a promise; a missing row is not a promise.

---

## Contents

1. [Scope and system boundary](#1-scope-and-system-boundary)
2. [Definitions used in the criteria](#2-definitions-used-in-the-criteria)
3. [Functional requirements and acceptance criteria](#3-functional-requirements-and-acceptance-criteria)
4. [Non-functional requirements and acceptance criteria](#4-non-functional-requirements-and-acceptance-criteria)
5. [External interface requirements](#5-external-interface-requirements)
6. [Data requirements](#6-data-requirements)
7. [Constraints](#7-constraints)
8. [Traceability matrix](#8-traceability-matrix)
9. [Verification gaps](#9-verification-gaps)
10. [Known discrepancies affecting this document](#10-known-discrepancies-affecting-this-document)

---

## 1. Scope and system boundary

Praxis is a **client-heavy** system. The SPA performs every algebraic operation, every
selection, every animation and every progression decision. The backend performs three
jobs only:

1. serve static game content (`GET /api/{levels,levels/{id},laws}`),
2. compute the authoritative score for one finished puzzle (`POST /api/score`),
3. store and return a learner's progress snapshot (`GET /api/progress`,
   `POST /api/progress/save`),
4. answer a plain liveness probe (`GET /`).

Authentication is **delegated to Supabase Auth** and never passes through the backend during
sign-in: the SPA talks to Supabase directly to obtain an access token, and the backend only
*verifies* that token (`backend/core/security.py:27` calls Supabase's `/auth/v1/user`).

```
   browser (SPA)                     backend (FastAPI)                Supabase
   ─────────────                     ─────────────────                ────────
   engine/  all algebra              api/routes  thin transport       Auth  (JWT issue/verify)
   state/   all game state           services    scoring + progress    PostgREST (3 tables)
   services/ the only network hop →  repositories the only data hop →
   services/supabaseClient.js ──────────── auth + session ────────────────►
   services/apiClient.js ─────────────► /api/*  bearer token ──────────► /auth/v1/user
                                                                        /rest/v1/{table}
```

**In scope for this SRS:** the 7 application endpoints, the 9 client routes, the 3 database
tables, the 2 content JSON documents, the browser-storage contracts, and the quality
attributes in NFR-1 – NFR-15.

**Out of scope:** Supabase's own service behaviour, the `.e2e/` harness internals, and
anything in the frozen legacy documents ([`context.md`](../context.md),
[`ARCHITECTURE.md`](../ARCHITECTURE.md)).

## 2. Definitions used in the criteria

Terminology follows the project glossary convention; the terms used in acceptance criteria
below are:

| Term | Meaning |
|---|---|
| **literal** | A single variable, optionally complemented: `x`, `x'`. |
| **term** (product) / **clause** (sum) | A product of literals / a sum of literals. |
| **product / sum** | AND / OR combination. |
| **SOP / POS** | Sum of products / product of sums. |
| **dual** | The product-level form of a sum-level law (`A(A+B) = A`). |
| **law id** | The stable identifier in `frontend/src/engine/laws/definitions.js:29`, e.g. `absorption`, `demorgan-and`. |
| **step** | One committed law application in the derivation. |
| **intermediate state** | The expression after a step. |
| **AST** | The expression tree built by `frontend/src/engine/node.js`. |
| **step-locking** | A step, once committed, is immutable; the learner may only add, undo, or reset. |
| **engine contract** | The frontend owns all Boolean algebra; the backend never re-implements it. |
| **tutor / learner** | The person using the product / the person it teaches. |
| **envelope** | `{success, data, error}` (`backend/core/responses.py:24`). |

## 3. Functional requirements and acceptance criteria

Each requirement below states **the promise**, then **how a tester can falsify it**.

### 3.1 Authentication and entry (FR-1 – FR-4)

| ID | Acceptance criteria | Implementation |
|---|---|---|
| **FR-1** | ① Submitting the register form with `password.length < 6` shows "Password must be at least 6 characters" and issues no network request. ② Mismatched confirmation shows "Passwords do not match" and the submit button is disabled while the fields disagree. ③ A successful signup stores `name` in Supabase user metadata and routes to `/levels` once the session appears. | `frontend/src/pages/RegisterPage.jsx:32`, `:36`, `:144`, `:24`; `frontend/src/services/authActions.js:19` |
| **FR-2** | ① Signing in with valid credentials ends with the landing route rendered and the header showing "Sign Out". ② Invalid credentials surface the provider's message as a toast and leave the learner on `/login`. ③ The password field never echoes its value in plain text unless the reveal toggle is used. | `frontend/src/pages/LoginPage.jsx:20`, `:37`; `frontend/src/components/ui/PasswordField.jsx` |
| **FR-3** | Signing out from the landing page or the level carousel clears the session, shows a confirmation toast, and routes to `/` after 100 ms so the auth state settles first. | `frontend/src/pages/LandingPage.jsx:17-26`; `frontend/src/config/gameRules.js:73` |
| **FR-4** | ① With no session, `/` renders "Master Boolean Algebra Without the Headache" plus "Start Learning Free" and "I already have an account". ② With a session it renders "Go to Level Selection" instead. ③ The page is reachable without authentication. | `frontend/src/pages/LandingPage.jsx:83`, `:94-116`; `frontend/src/App.jsx:32` |

### 3.2 Gating (FR-5 – FR-7)

| ID | Acceptance criteria | Implementation |
|---|---|---|
| **FR-5** | ① Visiting `/levels`, `/level/:id/stages`, `/level/:id/stage/:idx`, `/sandbox` or `/sandbox/play` with no session redirects to `/login` with a `replace` navigation. ② While the session is undetermined the route renders a loading shell rather than the page or a redirect. ③ `/`, `/login`, `/register` never redirect. | `frontend/src/components/ProtectedRoute.jsx:9`, `:27`; `frontend/src/App.jsx:32-53` |
| **FR-6** | ① On a fresh account, visiting `/level/1/stages` lands on `/level/0/stage/0?tutorial=true&returnTo=…`. ② After all 4 tutorial stages are complete the same URL renders the stage matrix. ③ A learner who completed the tutorial on another device passes the gate after hydration — the gate must not decide before `progressHydrated`. ④ Finishing the tutorial lands on the carried `returnTo` destination. | `frontend/src/components/TutorialGate.jsx:47`, `:62-72`; `frontend/src/state/useProgress.js:69` |
| **FR-7** | ① `/level/0/stage/2` renders even for a learner who has never started the tutorial. ② `/level/0/stages` likewise. ③ No gate state can produce an empty page: the redirect target is never the current URL. | `frontend/src/components/TutorialGate.jsx:41-43` |

### 3.3 Content (FR-8 – FR-10)

| ID | Acceptance criteria | Implementation |
|---|---|---|
| **FR-8** | ① `GET /api/levels` returns 4 summaries with keys `id, name, desc, varCount, puzzleCount`. ② `GET /api/levels/1` returns that level with a 12-element `puzzles` array. ③ `GET /api/levels/999` returns `404` with `error.code = "not_found"` and message `"Level 999 not found"`. ④ `GET /api/levels/1` for a stage index beyond the array is a `404`, not an `IndexError`. | `backend/api/routes/levels.py:18`, `:24`; `backend/services/content_service.py:24`, `:32` |
| **FR-9** | `GET /api/laws` returns 10 cards in authoring order, each with `id, name, formulas[], desc`. | `backend/api/routes/laws.py:18`; `content/laws.json` |
| **FR-10** | ① The bytes the API serves are the bytes the SPA bundles: both read `<repo>/content/*.json`. ② Deleting `content/` makes every content route answer `503 content_unavailable` with a message naming the missing path. ③ `LEVEL_SUMMARIES`' shape equals the API's `list_level_summaries()` shape key-for-key. | `backend/repositories/content_repository.py:16`, `:19-31`, `:46-57`; `frontend/src/content/gameContent.js:22`; `frontend/vite.config.js:16` |

### 3.4 Progression (FR-11 – FR-14)

| ID | Acceptance criteria | Implementation |
|---|---|---|
| **FR-11** | ① The carousel renders 5 entries: Tutorial, Level 1, Level 2, Level 3 — Boss, Sandbox. ② A locked card is not clickable and shows the reason: "Complete Tutorial", "🔒 80% avg required" or "Coming Soon". ③ The active locked card shows a gate bar with completed/total stages. ④ The row is translated so the selected card is centred on a narrow viewport, and does not move when the row fits. | `frontend/src/pages/LevelSelectPage.jsx:51`, `:60-123`, `:293-390`, `:172-181` |
| **FR-12** | ① Level 2 is locked while any Level 1 stage is incomplete, even if the average is 100. ② Level 2 is locked while the Level 1 average is below 80, even if all stages are done. ③ Both conditions true ⇒ unlocked. ④ The same rule applies Level 2 → Level 3. ⑤ The threshold is 80, not 70. | `frontend/src/state/progressStore.js:291-313` (`allDone && avgScore >= UNLOCK_AVERAGE_SCORE`); `frontend/src/config/gameRules.js:49`; `backend/config/constants.py:26` |
| **FR-13** | ① Stage 0 is always playable. ② Stage *N* is `locked` until stage *N−1* is in the completed set. ③ Locked cards are `disabled` and render a lock glyph. | `frontend/src/pages/StageSelectorPage.jsx:56`, `:58-62`, `:294` |
| **FR-14** | ① A stored score ≥ 90 shows 3 stars, ≥ 75 shows 2, any completion shows 1. ② A completed stage with no stored score still shows 1 star. ③ A stage that is neither completed nor scored shows 0 stars. ④ Levels 1–3 additionally require re-entering the tutorial check only for level 1. | `frontend/src/pages/StageSelectorPage.jsx:68-78`; `frontend/src/state/progressStore.js:281-285` |

### 3.5 The workspace (FR-15 – FR-20)

| ID | Acceptance criteria | Implementation |
|---|---|---|
| **FR-15** | ① Clicking a literal toggles it into the selection; a third click replaces the oldest selection (max 2). ② Clicking a clause grip replaces any of its literals already selected. ③ Selecting a `not` node focuses it alone and offers De Morgan / Double Negation immediately. ④ Selecting two items with no applicable law shows "No simplification for these selected items" and plays the wrong cue. ⑤ Clicking a constant (0/1) directly inside a product or sum offers Identity/Annulment for that node. ⑥ Input during an animation is ignored. | `frontend/src/state/useGameState.js:199-348`, `:231-246`; `frontend/src/engine/laws/index.js:33`, `:60`, `:64`, `:68` |
| **FR-16** | ① Clicking a law plays its animation for 1350 ms, then appends one step whose `from`/`to` are the rendered expressions before and after. ② A law whose application leaves the rendered text unchanged appends **no** step and reports "That law didn't change the expression." ③ During the animation, selection and law input are locked. ④ On the tutorial path an extra 1500 ms highlight precedes the animation. | `frontend/src/state/useGameState.js:363-373`, `:423-447`, `:450-458`; `frontend/src/config/gameRules.js:60-62` |
| **FR-17** | ① Undo removes exactly the last step and re-evaluates the dead-end state of the expression it returns to. ② The step history shows one entry per applied law. ③ Clicking a past step opens a card naming the law; clicking elsewhere dismisses it. ④ Inspecting a step never mutates the derivation. | `frontend/src/state/useGameState.js:461-485`; `frontend/src/components/puzzle/StepHistoryPanel.jsx:1`; `frontend/src/pages/ProblemPage.jsx:208-226`, `:467-472` |
| **FR-18** | ① Dragging a clause past its neighbour reorders the AST. ② The rendered expression may change order but the derivation step count does **not** increase. ③ The undo affordance is unaffected (reorder does not push a history entry). ④ A press shorter than 6 px is treated as a click, not a drag. | `frontend/src/state/useGameState.js:523-558`; `frontend/src/hooks/useTermDrag.js:46`, `:235`; `frontend/src/config/gameRules.js:88-95` |
| **FR-19** | ① Reset restores the puzzle's initial expression and clears hint, inspection and success state. ② If the stage is complete **and** the session has not opted out, a confirmation modal appears first. ③ Confirming with "don't ask again" sets a session flag that suppresses the prompt for the rest of the session. ④ Reset discards the "loaded from saved solution" flag. | `frontend/src/pages/ProblemPage.jsx:275-296`, `:442-446`; `frontend/src/state/useGameState.js:487-499` |
| **FR-20** | ① An expression that is not the goal and has zero applicable moves sets `status = 'error'` with the dead-end message and clears the law list. ② The dead-end cue fires on the *transition* into the state, not on every re-render. ③ Loading a puzzle that starts at a dead end is silent. ④ Any subsequent legal move clears the dead-end state. | `frontend/src/state/useGameState.js:47-74`, `:53-68`; `frontend/src/state/hintText.js:10` |

### 3.6 Assistance (FR-21 – FR-22)

| ID | Acceptance criteria | Implementation |
|---|---|---|
| **FR-21** | ① Hint text is derived from the **current** expression via `scanHints`, not from the authored list, whenever a suggestion exists. ② The fallback is the puzzle's `hints[n]`, advancing one index per use, clamped at the last entry. ③ Each use increments `hintsUsed`, which costs 10 points of the independence band. ④ The bubble auto-dismisses after 6000 ms. ⑤ Hint returns `null` (and changes nothing) when there is no suggestion and no authored hint. | `frontend/src/state/useGameState.js:501-520`; `frontend/src/state/hintText.js:18`; `frontend/src/pages/ProblemPage.jsx:228-236`; `frontend/src/config/gameRules.js:66` |
| **FR-22** | ① With no legal move, the Guide refuses and marks the dead end instead of consuming a point. ② With a single-path suggestion it highlights that node and instructs the learner to click it. ③ With a two-path suggestion it pre-selects both and computes applicable laws immediately. ④ On a graded level it deducts exactly 20 points; the sandbox deducts 0. ⑤ A learner below 20 points sees an error toast and no highlight. | `frontend/src/state/useGameState.js:560-603`; `frontend/src/pages/ProblemPage.jsx:261-273`; `frontend/src/config/gameRules.js:35` |

### 3.7 Completion and scoring (FR-23 – FR-28)

| ID | Acceptance criteria | Implementation |
|---|---|---|
| **FR-23** | ① Completion is decided by **canonical-text equality** of the current tree against the parsed goal: `canonText(newExpr) === goalCanonRef.current`, where the goal was canonicalised once at load. ② It is order-independent, so reordering terms does not change the verdict. ③ It is **not** a semantic test: a terminal form that is logically equivalent to the goal but renders to different canonical text does **not** complete the puzzle. ④ The truth-table checker `isEquivalent` must **not** be described as the completion test — its consumers are law detection (`frontend/src/engine/laws/helpers.js:77`, `:98`) and the sandbox builders (`frontend/src/engine/sandbox/generator.js:94`, `frontend/src/engine/sandbox/input.js:161`), never `useGameState`. ⑤ The same canonical test, evaluated on the current expression, also decides whether the goal has been reached during dead-end synchronisation. | `frontend/src/state/useGameState.js:83`, `:437`, `:56`; `frontend/src/engine/render.js:28`; non-consumers verified by grep over `isEquivalent` |
| **FR-24** | ① `efficiency` = 40 when `steps_used ≤ optimal`, else `max(0, 40 − (steps_used − optimal) × 10)`. ② `targetLaw` = `30 × |required ∩ used| / |required|`, and **exactly 30** when the puzzle declares no target laws. ③ `hintIndependence` = `max(0, 30 − (hintsUsed + guidesUsed) × 10)`. ④ `total` is their sum rounded to 1 decimal. ⑤ `breakdown` echoes `stepsUsed, optimalSteps, targetLawsRequired[], targetLawsUsed[], hintsUsed, guidesUsed, totalAssistance`. ⑥ A solution shorter than the recorded optimum does not penalise the learner: `optimal = min(declared, stepsUsed)`. | `backend/services/scoring_service.py:49-77`, `:80-88`, `:91-115`; `backend/config/constants.py:9-22` |
| **FR-25** | ① The completion modal opens within 200 ms of the solve, before any network answer. ② When `POST /api/score` answers, `scoreResult` is replaced by the server payload and the stored best score is updated with `result.total`. ③ If the request fails, the local estimate remains displayed and play continues. ④ The sandbox never calls the endpoint at all. | `frontend/src/components/puzzle/usePuzzleSession.js:173-216`, `:223-255`; `frontend/src/services/scoreApi.js:31` |
| **FR-26** | ① First completion of a stage awards `10 + earnedPoints`. ② Re-opening a stage from its saved solution shows no modal and awards nothing. ③ Re-completing an already-completed stage awards no points a second time but still records a better score if one is achieved. | `frontend/src/components/puzzle/usePuzzleSession.js:154-158`, `:190-197`; `frontend/src/state/progressStore.js:209-215` |
| **FR-27** | ① The modal shows three labelled metric rows with value/max, a progress bar and a human sub-line. ② The total is colour-coded at ≥ 80 / ≥ 50. ③ `optimalHint` appears only when `efficiency < 40`. ④ The points badge equals `earnedXp + earnedPoints`. ⑤ The action row offers Next Stage (when one exists), Try Again and Review Completed Derivation. | `frontend/src/components/puzzle/ScoreModal.jsx:110-166`, `:154-158`, `:191-236` |
| **FR-28** | ① With a valid bearer token, `POST /api/score` both answers the score **and** inserts one `score_history` row plus raises `stage_progress.best_score` when the new total is higher. ② Without a token the route still answers `200` and persists nothing. ③ A storage failure is logged and swallowed — the response is unaffected. ④ The stored `hints_used` equals hints **+ guides**. | `backend/api/routes/score.py:38-39`; `backend/services/progress_service.py:87-127` |

### 3.8 Persistence (FR-29 – FR-32)

| ID | Acceptance criteria | Implementation |
|---|---|---|
| **FR-29** | ① Every store mutation writes `localStorage` synchronously under `praxis_v1_<userId>`. ② For a signed-in learner with a loaded server snapshot, a mutation schedules a save 500 ms later, coalescing bursts into one request. ③ A guest or a not-yet-hydrated learner schedules nothing. ④ A storage exception (private mode, quota) does not lose in-memory progress. | `frontend/src/state/progressStore.js:60-94`; `frontend/src/config/storageKeys.js:10`; `frontend/src/config/gameRules.js:68` |
| **FR-30** | ① `points` takes the maximum of local and server. ② `bestStreak` takes the maximum; `streak` prefers the server value. ③ `stageScores` keeps the higher score per key. ④ `stageProgress` unions the stage lists and de-duplicates. ⑤ Local `stageSolutions` win over server ones. ⑥ Hydration never overwrites a local best with a lower server value. ⑦ A `setUser` that loses a race discards its stale response. | `frontend/src/state/progressStore.js:97-130`, `:158-165` |
| **FR-31** | ① Revisiting a completed stage restores its derivation, marks the stage complete and shows the review message. ② The restored state does **not** auto-open the completion modal. ③ A stored derivation that fails to parse falls back to the initial expression with a warning instead of crashing. ④ Sandbox problems are never loaded from storage. | `frontend/src/state/useGameState.js:101-118`; `frontend/src/components/puzzle/usePuzzleSession.js:134-147`, `:154` |
| **FR-32** | ① `GET /api/progress` with a valid bearer returns `{points, streak, bestStreak, stageProgress, stageScores}`. ② Without a bearer it returns `401 unauthorized`. ③ `POST /api/progress/save` writes one totals row and one row per completed stage, each upserted on `(user_id, level_id, stage_idx)`. ④ A body that is not a valid snapshot is rejected `422 validation_error` inside the envelope. ⑤ Stage scores round-trip without type coercion (a whole score stays an integer). | `backend/api/routes/progress.py:20`, `:26`; `backend/api/schemas/progress.py:11`; `backend/services/progress_service.py:53-84` |

### 3.9 Sandbox (FR-33 – FR-37)

| ID | Acceptance criteria | Implementation |
|---|---|---|
| **FR-33** | ① An untouched empty field shows the neutral helper naming the accepted notation, not an error. ② The empty-input error becomes reachable only after the learner edits the field or attempts a submit. ③ The verdict updates ~300 ms after typing stops, not on every keystroke. ④ The submit button follows the **raw** text, so a valid expression is playable immediately. ⑤ The verdict is exposed to assistive tech as `role="status"` when neutral/valid and `role="alert"` when invalid. | `frontend/src/pages/SandboxPage.jsx:110-148`, `:117-124`; `frontend/src/engine/sandbox/validate.js:155` |
| **FR-34** | ① `A` (valid but terminal) is refused with "This expression is already in its simplest form. Try a more complex one!". ② An expression the engine cannot fully simplify within budget is refused with the not-simplifiable message. ③ An accepted input is checked to lose no character during tokenisation. ④ An accepted goal is verified terminal and equivalent to its start. ⑤ Every shipped derivation step replays through the move set the workspace itself offers. | `frontend/src/engine/sandbox/input.js:126-149`, `:153-182`; messages at `:53-54` |
| **FR-35** | ① Submitting a valid expression navigates to `/sandbox/play` with route state `{customPuzzle, exprText}`. ② The workspace renders it with the same components as a graded stage. ③ `addPoints`, `completeStage`, `saveScore` and `submitScore` are all unreachable on the sandbox completion path. ④ The sandbox score modal says no points, stars or progress were recorded. | `frontend/src/pages/SandboxPage.jsx:178`; `frontend/src/components/puzzle/usePuzzleSession.js:185-188`; `frontend/src/components/puzzle/ScoreModal.jsx:100-102` |
| **FR-36** | ① "Random problem" navigates to `/sandbox/play` with `{random: true}` and produces a solver-verified puzzle. ② "New Problem" inside the workspace replaces the problem and resets selection, history, hint and animation state. ③ A generator failure keeps the current problem and shows an error toast rather than a broken workspace. | `frontend/src/engine/sandbox/generator.js:234`; `frontend/src/components/puzzle/usePuzzleSession.js:262-275`; `frontend/src/components/puzzle/sandboxPuzzle.js:59-74` |
| **FR-37** | ① A typed expression is written to `sessionStorage` so a refresh on `/sandbox/play` restores it. ② An explicit random visit clears the stored expression so a later bare `/sandbox/play` does not resurrect a stale one. ③ A corrupt or unplayable stored value is ignored with a warning rather than crashing. | `frontend/src/components/puzzle/sandboxPuzzle.js:29-56`, `:81-86` |

### 3.10 Tutorial, feedback, ergonomics (FR-38 – FR-43)

| ID | Acceptance criteria | Implementation |
|---|---|---|
| **FR-38** | ① The tutorial runs on the real workspace at level 0, stage by stage, over 4 stages. ② A welcome deck precedes stage 0. ③ Each stage shows a coach card anchored to the control under discussion, with a spotlight. ④ The tutorial can be skipped, and replaying it is offered from the level and stage screens. ⑤ The tutorial overlay never runs on a sandbox route. | `frontend/src/content/tutorialContent.js`; `frontend/src/components/InteractiveTutorial.jsx:194`; `frontend/src/pages/ProblemPage.jsx:198-206`, `:486-518` |
| **FR-39** | On a tutorial stage below stage 3, a law click first shows a 1500 ms pre-highlight, then the 1350 ms law animation, then the step. Outside the tutorial the animation starts immediately. | `frontend/src/state/useGameState.js:450-458`; `frontend/src/pages/ProblemPage.jsx:320`; `frontend/src/config/gameRules.js:60-62` |
| **FR-40** | ① Cues exist for `step, hint, guide, correct, wrong, reset, complete`. ② The preference persists in `localStorage` and defaults to on. ③ Audio is primed by the learner's first gesture so a cue is not silently dropped by autoplay policy. ④ With sound off, no `AudioContext` is created and no cue plays. | `frontend/src/services/soundEffects.js:43`, `:80`, `:132`; `frontend/src/state/useGameState.js:203`, `:357`; `frontend/src/config/storageKeys.js:28` |
| **FR-41** | ① A touch device ≤ 767 px wide in portrait shows the blocking rotate overlay and nothing else interactive. ② A touch device 768–1023 px in portrait shows a dismissible banner and remains usable. ③ A pointer-fine window of any width is classed desktop and shows neither. ④ Dismissing the banner persists for the browser session. ⑤ No User-Agent string is read anywhere in the decision. | `frontend/src/hooks/useDeviceTier.js:57-94`, `:97-108`; `frontend/src/components/OrientationGate.jsx:16-24` |
| **FR-42** | ① Width ≥ 1024 px on a pointer-fine device renders the three-column desktop layout. ② A phone landscape, tablet portrait or narrow window moves step history into an overlay drawer, assistance into the header and laws into a bottom dock, without changing desktop markup. ③ Touch tiers get ≥ 44 px targets. ④ No tier ever renders two copies of the same panel. | `frontend/src/pages/ProblemPage.jsx:69-99`, `:363-424`; `frontend/src/config/gameRules.js` (`TIMING`) |
| **FR-43** | The survey link opens the configured form in a new tab and is reachable from the landing page, carousel, stage matrix and workspace header; the URL exists in exactly one module. | `frontend/src/config/appLinks.js:9`; `frontend/src/components/layout/SurveyButton.jsx:13` |

## 4. Non-functional requirements and acceptance criteria

| ID | Acceptance criteria | Evidence / measurement |
|---|---|---|
| **NFR-1** | ① No module under `backend/` parses or rewrites a Boolean expression. ② `content/levels.json` stores expressions as **strings**, and the only parser is `frontend/src/engine/parser.js`. ③ Adding a Python-side algebra implementation would violate the engine contract. | Import and grep analysis over `backend/`; engine barrel `frontend/src/engine/index.js:32`. |
| **NFR-2** | No file under `frontend/src/engine/` imports React, a DOM global, `fetch`, or any folder other than `engine/` and `config/`. | Verified: the only cross-folder imports are `../../config/gameRules.js` in `scoring.js:18` and `sandbox/input.js:36`. |
| **NFR-3** | Every law builder result is accepted only after an equivalence check, and the property test asserts soundness across generated expressions. | `frontend/src/engine/laws/helpers.js:11`; `frontend/src/engine/__tests__/law-soundness.property.test.js` |
| **NFR-4** | `cd frontend && npm test` exits 0 with `# fail 0` and `# tests 76`. | Ran: `# tests 76 / # pass 76 / # fail 0 / # duration_ms ~10680`. |
| **NFR-5** | ① Success is `{success:true, data, error:null}`. ② Failure is `{success:false, data:null, error:{code,message,detail}}`. ③ A framework 404 and a validation 422 are wrapped too. ④ `GET /` is plain and documented as the exception. | `backend/core/responses.py:32-59`; `backend/main.py:50-66`; live-verified: unknown path → `404 {"code":"http_error"}`, missing `stepsUsed` → `422 {"code":"validation_error"}`. |
| **NFR-6** | ① Both progress routes answer `401 {"code":"unauthorized","message":"Not authenticated"}` with no bearer. ② A bearer that Supabase rejects also answers 401. ③ A Supabase transport failure answers `502 upstream_error`, not 500. | `backend/core/security.py:17-29`; live-verified 401 bodies. |
| **NFR-7** | No credential value appears in any tracked file or document. Env vars are named, never valued. `backend/.env` and `frontend/.env.local` are gitignored and untracked. | `.gitignore:3` (`.env` → `backend/.env`); `frontend/.gitignore:15` (`*.local` → `frontend/.env.local`); `backend/config/settings.py:19-20`; `frontend/src/services/supabaseClient.js:7-8`. |
| **NFR-8** | ① Law animation = 1350 ms. ② Local score breakdown renders before the network answer (0 ms). ③ Levels and laws render on first paint with no network call. ④ Level content download is one JSON document. | `frontend/src/config/gameRules.js:60`; `frontend/src/services/contentApi.js:14-29`; `frontend/src/components/puzzle/usePuzzleSession.js:173`. |
| **NFR-9** | ① `submitScore`, `loadProgress` and `saveProgress` pass `silent: true`. ② A network failure therefore returns `null` instead of throwing into a component. ③ A failed content fetch for a *bundled* id cannot happen, because the bundle is consulted first. | `frontend/src/services/scoreApi.js:34`; `frontend/src/services/progressApi.js:12`, `:23`; `frontend/src/services/apiClient.js:53`. |
| **NFR-10** | ① Every response carries `X-Request-ID`, echoing the request header when supplied. ② Exactly one JSON access-log line per request with `ts, level, logger, message, request_id` plus `method, path, status, duration_ms`. ③ An unhandled exception is logged with a stack and answered `500` inside the envelope. | `backend/core/middleware.py:27`, `:48-57`, `:33-45`; `backend/core/logging.py:34-50`. |
| **NFR-11** | ① `engine/` imports only `config/` and itself. ② `state/` imports `engine/`, `services/`, `config/`. ③ `components/` and `pages/` import all three. ④ Every tunable number lives in `frontend/src/config/gameRules.js` or `backend/config/constants.py`. | Import analysis; one documented exception noted in §9. |
| **NFR-12** | The tier decision is a pure function testable without a DOM; the responsive matrix is exercised by a browser suite. | `frontend/src/hooks/useDeviceTier.js:57`; `.e2e/responsive-tiers.mjs`. |
| **NFR-13** | ① Touch tiers apply a ≥ 44 px minimum to interactive elements. ② Popups are placed by a collision solver and clamped to the viewport with an 8 px margin. ③ The sandbox verdict uses live-region roles. | `frontend/src/pages/ProblemPage.jsx:356`; `frontend/src/hooks/useCollisionPlacement.js:38`, `:164`; `.e2e/popup-overlap-verify.mjs`. |
| **NFR-14** | `render.yaml` declares exactly one Render web service, Python, `rootDir: backend`, start command `uvicorn main:app`. The SPA is deployed separately and rewrites `/api/*` to that service. | `render.yaml:1-16`; `frontend/vercel.json:3-6` (the `/api/(.*)` rewrite). |
| **NFR-15** | Adding a level or puzzle requires editing `content/levels.json` only. Adding a law requires `content/laws.json` **plus** an entry in the engine table. | `docs/ARCHITECTURE.md` §3; `frontend/src/engine/laws/definitions.js:29`. |

## 5. External interface requirements

### 5.1 REST interface — the 7 application endpoints

All paths are relative to the API origin. Every `/api/*` response uses the envelope;
`GET /` deliberately does not. Live-verified against `backend/main.py` with
`fastapi.testclient`.

| # | Method | Path | Auth | Success | Failure modes |
|---|---|---|---|---|---|
| 1 | GET | `/` | none | `200 {"message":"Praxis API is running","docs":"/docs"}` — plain, outside the envelope | — |
| 2 | GET | `/api/levels` | none | `200` envelope, `data` = array of `{id,name,desc,varCount,puzzleCount}` | — |
| 3 | GET | `/api/levels/{level_id}` | none | `200` envelope with the full level incl. `puzzles` | `404 not_found` |
| 4 | GET | `/api/laws` | none | `200` envelope, 10 law cards `{id,name,formulas[],desc}` | — |
| 5 | POST | `/api/score` | optional bearer | `200` envelope with `{efficiency,targetLaw,hintIndependence,total,earnedPoints,breakdown}` | `404 not_found`, `422 validation_error`, `502 upstream_error` (persistence is backgrounded and never fails the response) |
| 6 | GET | `/api/progress` | **required** bearer | `200` envelope with `{points,streak,bestStreak,stageProgress,stageScores}` | `401 unauthorized`, `502 upstream_error` |
| 7 | POST | `/api/progress/save` | **required** bearer | `200` envelope `{"status":"ok"}` | `401 unauthorized`, `422 validation_error`, `502 upstream_error` |

Plus FastAPI's own `/docs`, `/redoc`, `/openapi.json`, `/docs/oauth2-redirect`.

**Verified request/response examples.**

```http
POST /api/score
Content-Type: application/json

{"levelId":1,"stageIdx":0,"stepsUsed":1,"lawsUsed":["absorption"],"hintsUsed":0}
```
```json
{"success":true,"data":{"efficiency":40.0,"targetLaw":30.0,"hintIndependence":30.0,
"total":100.0,"earnedPoints":5,"breakdown":{"stepsUsed":1,"optimalSteps":1,
"targetLawsRequired":["absorption"],"targetLawsUsed":["absorption"],"hintsUsed":0,
"guidesUsed":0,"totalAssistance":0}},"error":null}
```

```http
GET /api/levels/999
```
```json
{"success":false,"data":null,"error":{"code":"not_found","message":"Level 999 not found","detail":null}}
```

```http
GET /api/progress
Authorization: (absent)
```
```json
{"success":false,"data":null,"error":{"code":"unauthorized","message":"Not authenticated","detail":null}}
```

**Request headers.** `Authorization: Bearer <supabase-access-token>` on
`/api/progress*` (required) and optionally on `/api/score`.
`Content-Type: application/json` on POSTs.
**Response headers.** `X-Request-ID` on every response.

**Error codes** (`backend/core/errors.py:11-21`) — a closed set:
`not_found`, `content_unavailable`, `upstream_error`, `unauthorized`, `validation_error`,
`http_error`, `internal_error`.

> **Known limitation (D22).** The generated OpenAPI spec declares **no security scheme**,
> because auth is applied through `Depends(...)` rather than a `Security` requirement. The
> bearer requirement on endpoints 6 and 7 therefore does not appear in `/docs` and the
> Swagger "Authorize" button is absent. Swagger UI cannot exercise those two routes without
> a manually added header.

### 5.2 Supabase interfaces

| Interface | Direction | Contract |
|---|---|---|
| Auth — password sign-in / sign-up | SPA → Supabase | `supabase.auth.signInWithPassword`, `supabase.auth.signUp` via `@supabase/supabase-js`; credentials from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. `frontend/src/services/authActions.js:11`, `:21` |
| Auth — session | SPA ← Supabase | `supabase.auth.getSession()` and `onAuthStateChange`; the access token is attached as a bearer header on every authenticated API call. `frontend/src/state/AuthProvider.jsx:23`, `:37`; `frontend/src/services/apiClient.js:28` |
| Auth — token verification | backend → Supabase | `GET {SUPABASE_URL}/auth/v1/user` with the learner's JWT; non-200 ⇒ `None` ⇒ 401. An `httpx.HTTPError` ⇒ `502 upstream_error`. `backend/supabase_client.py:87-98` |
| PostgREST — read/write | backend → Supabase | `{SUPABASE_URL}/rest/v1/{table}` with the service-role key as both `apikey` and bearer. Only two verbs are implemented: equality filters (`eq`) and `select`/`insert`/`upsert` with `on_conflict`. `backend/supabase_client.py:22-85` |
| Required env vars | backend | `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are **required at import time**; `FRONTEND_URL` is optional. `backend/config/settings.py:57-63`, `:75` |

### 5.3 Browser storage interfaces

| Key | Store | Written by | Purpose |
|---|---|---|---|
| `praxis_v1_<userId>` | `localStorage` | `progressStore.persistLocal` | The whole progress snapshot per learner. `frontend/src/config/storageKeys.js:10` |
| `praxis_sound_enabled` | `localStorage` | `soundEffects.setSoundEnabled` | `'true'` / `'false'` sound preference. `:28` |
| `praxis_skip_tutorial_replay_prompt` | `sessionStorage` | tutorial replay prompt | Suppresses the prompt for the session. `:16` |
| `praxis_skip_reset_confirm` | `sessionStorage` | reset confirmation modal | Suppresses the reset prompt for the session. `:19` |
| `praxis_sandbox_custom_puzzle` | `sessionStorage` | `useStoredCustomPuzzleSlot` | Carries a typed sandbox puzzle across a refresh. `:22` |
| `praxis_hide_rotate_banner` | `sessionStorage` | `useDeviceTier.dismissRotateBanner` | Rotate banner dismissed for the session. `:25` |

All storage access is wrapped so an exception (private mode, quota, sandboxed iframe) degrades
to in-memory behaviour rather than a broken screen
(`frontend/src/state/progressStore.js:70-84`, `frontend/src/hooks/useDeviceTier.js:152-160`).

### 5.4 Build-time and dev-server interfaces

| Interface | Contract |
|---|---|
| `@content` alias | `@content` → `<repo>/content`, so the SPA bundles the same JSON the API serves. `frontend/vite.config.js:16` |
| Dev proxy `/api` | `/api/*` → `VITE_API_TARGET` (default `http://127.0.0.1:8000`). `frontend/vite.config.js:8`, `:30-33` |
| Dev proxy `/api/auth` | Still present, targeting `http://127.0.0.1:3001` for a **Better Auth server that does not exist** [D3]. Dead remnant. `frontend/vite.config.js:24-28` |
| `server.fs.allow` | Widened to the repo root because `content/` sits outside the Vite root. `frontend/vite.config.js:22` |
| Frontend env vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (and a vestigial `VITE_AUTH_URL`). `frontend/src/services/supabaseClient.js:7-8` |
| Production SPA routing | `/api/*` rewritten to the Render service; everything else to `/index.html`. `frontend/vercel.json:1-12` |

## 6. Data requirements

### 6.1 Persistent data — 3 tables in `public`

| Table | Key | Columns | Cardinality |
|---|---|---|---|
| `user_progress` | `user_id UUID PK → auth.users(id) ON DELETE CASCADE` | `points INTEGER DEFAULT 0`, `streak INTEGER DEFAULT 0`, `best_streak INTEGER DEFAULT 0`, `updated_at TIMESTAMPTZ DEFAULT now()` | one row per learner |
| `stage_progress` | `id UUID PK DEFAULT gen_random_uuid()`; `UNIQUE(user_id, level_id, stage_idx)` | `user_id UUID NOT NULL FK`, `level_id INTEGER NOT NULL`, `stage_idx INTEGER NOT NULL`, `best_score REAL DEFAULT 0`, `completed BOOLEAN DEFAULT FALSE`, `completed_at TIMESTAMPTZ DEFAULT now()` | one row per (learner, level, stage) |
| `score_history` | `id UUID PK DEFAULT gen_random_uuid()` | `user_id UUID NOT NULL FK`, `level_id`, `stage_idx`, `steps_used INTEGER NOT NULL`, `laws_used TEXT[] NOT NULL`, `hints_used INTEGER NOT NULL`, `efficiency REAL NOT NULL`, `target_law REAL NOT NULL`, `hint_independence REAL NOT NULL`, `total REAL NOT NULL`, `earned_points INTEGER NOT NULL`, `created_at TIMESTAMPTZ DEFAULT now()` | one row per completed attempt |

Indexes: `idx_stage_progress_user(user_id)`, `idx_score_history_user(user_id)`,
`idx_score_history_level(user_id, level_id, stage_idx)`. `database/init.sql:45-47`

**Requirements on this data.**

| ID | Requirement |
|---|---|
| DR-1 | `stage_progress.level_id` stores the **content id**, which is 0-based; Tutorial rows therefore carry `level_id = 0`. Mixing this with the UI's "Level 1/2/3" labels is the most likely defect in any new query. |
| DR-2 | `score_history.hints_used` stores **hints + guides** as one figure, because guide usage was folded into the existing column rather than adding one. `backend/services/progress_service.py:101` writes the summed figure; `backend/services/scoring_service.py:51` computes it. |
| DR-3 | There is **no schema-migration tooling**: `database/init.sql` is a hand-run script whose `CREATE TABLE IF NOT EXISTS` statements are safe to re-run but which cannot evolve an existing schema. |
| DR-4 | RLS is enabled on all three tables with one policy each named `"Service role full access"`, defined `FOR ALL USING (true)`. This is **fully permissive for every role, including `anon`**, and there is no `auth.uid() = user_id` predicate anywhere [D20]. |
| DR-5 | The `init.sql` header comment references Better Auth tables created by `npx auth migrate`. **No Better Auth installation exists in this repository** [D3]. |

### 6.2 Content data — 2 JSON documents

`content/laws.json` — 10 law cards:

```json
{ "id": "absorption", "name": "Absorption Law", "formulas": ["A + AB = A"], "desc": "…" }
```

`content/levels.json` — **4 levels; the Tutorial (id 0) has 4 stages and Levels 1–3 have 12
each → 40 puzzles total.**

| `id` | `name` | `varCount` | puzzles |
|---|---|---|---|
| 0 | Tutorial | 2 | 4 |
| 1 | Level 1 | 2 | 12 |
| 2 | Level 2 | 3 | 12 |
| 3 | Level 3 — Boss | 4 | 12 |

Per-puzzle keys, exactly: `expr` (string), `goal` (string), `targetLaws` (law-id array),
`hints` (string array), `optimalSteps` (integer), `optimalHint` (string).

| ID | Requirement |
|---|---|
| DR-6 | `content/` must ship **beside** `backend/`: the repository resolves it as `parents[2] / "content"`. If it is absent every content route answers `503 content_unavailable`. `backend/repositories/content_repository.py:16`, `:24-31` |
| DR-7 | Both documents are cached with `functools.lru_cache`, so editing content requires a process restart before the API serves the change. `backend/repositories/content_repository.py:34`, `:40` |
| DR-8 | The engine knows an internal law id `distributive-expand` that is **not** one of the 10 reference cards; it is the reverse of `distributive` and is gated to the sandbox. `frontend/src/engine/laws/definitions.js:44` |
| DR-9 | Only 8 of the 10 law ids appear in any puzzle's `targetLaws`: `absorption, annulment, complement, demorgan-and, demorgan-or, distributive, idempotent, identity`. `double-neg` and `associative` are reference-only. |

### 6.3 Client state — the progress snapshot

```js
{
  points: 0,            // integer; +10 per first completion, + bonus, −20 per Guide
  streak: 0,            // incremented on every points award
  bestStreak: 0,
  levelsCompleted: [],  // numeric content ids
  stageProgress: {},    // { "1": [0, 1, 2] } → level 1, stages 0,1,2 done
  stageScores: {},      // { "1:0": 87.5 } → best total per stage
  stageSolutions: {},   // { "1:0": [{ law, from, to }] } → replayable derivation
  hasSeenTutorial: false,
}
```
`frontend/src/state/progressStore.js:30-39`

Sibling fields the server may return and the merge accepts: `hasCompletedTutorial`
(`frontend/src/state/progressStore.js:123`). `stageProgress` and `stageScores` are the only
two fields written back to the server:

```json
{ "progress": { "points": 0, "streak": 0, "bestStreak": 0,
                "stageProgress": { "1": [0,1] }, "stageScores": { "1:0": 87.5 } } }
```
`backend/api/schemas/progress.py:11-22` — field names are a frozen contract with two clients.

`stageScores` uses `int | float` deliberately, "so the value written to Supabase is
byte-identical to the request" (`backend/api/schemas/progress.py:16-18`).

## 7. Constraints

| ID | Constraint | Consequence |
|---|---|---|
| C-1 | Python 3 with FastAPI + Uvicorn; no ORM, no SQL driver. Data access is hand-rolled PostgREST over `httpx`. | Only `eq` filters and `select`/`insert`/`upsert` are available; any richer query needs new code in `backend/supabase_client.py`. |
| C-2 | `backend/requirements.txt` is 5 unpinned packages: `fastapi`, `uvicorn[standard]`, `python-multipart`, `python-dotenv`, `httpx`. Root `requirements.txt` is a one-line shim. | Builds are not reproducible; a breaking upstream release can break a clean install. |
| C-3 | Settings are an **import-time singleton**: `settings = Settings.from_env()` raises if `SUPABASE_URL` or `SUPABASE_SERVICE_KEY` is missing. | The process cannot boot without Supabase credentials, **even to serve `GET /api/levels`**. `backend/config/settings.py:75` |
| C-4 | All repository HTTP uses **synchronous** `httpx.Client` inside `async def` routes. | Blocking I/O on the event loop; concurrent progress requests serialise. `backend/supabase_client.py:69` |
| C-5 | Content is read through `lru_cache` and resolved relative to the source tree. | A content change needs a restart; the `content/` directory must be present at runtime. |
| C-6 | No container image, no IaC beyond `render.yaml`, no CI configuration in the repository. | Deployment is a platform build from `render.yaml` + a static SPA build; nothing verifies a change before it ships. |
| C-7 | Render free tier: the service sleeps when idle. | The first request after a sleep is slow; the SPA must tolerate it, which it does by rendering bundled content immediately (`frontend/src/services/contentApi.js:22`). |
| C-8 | Exactly one Boolean engine, in JavaScript. | Any server-side algebra would be a second implementation and is forbidden by the engine contract. |
| C-9 | The tutorial gate is a UX gate, not a security boundary; it reads client state. | A determined learner can bypass it. Documented at `frontend/src/components/TutorialGate.jsx:31-32`. |
| C-10 | Server-side scoring trusts the submitted `stepsUsed`, `lawsUsed`, `hintsUsed` and `optimalSteps`. | No verification that the derivation was legal; a fabricated submission scores. See §9. |

## 8. Traceability matrix

`npm test` = `cd frontend && npm test` (76 engine tests, 7 files).
`live` = verified against a running `backend/main.py` via `fastapi.testclient` during this
documentation pass — see §9 for why the backend has no automated suite.

### Functional requirements

| Req | Implementing file(s) | Verifying test |
|---|---|---|
| FR-1 | `frontend/src/pages/RegisterPage.jsx:28`, `frontend/src/services/authActions.js:19` | `.e2e/gate-fresh-user-check.mjs`, `.e2e/tutorial-gate.mjs` |
| FR-2 | `frontend/src/pages/LoginPage.jsx:26`, `frontend/src/services/authActions.js:9` | `.e2e/gate-fresh-user-check.mjs` |
| FR-3 | `frontend/src/pages/LandingPage.jsx:17`, `frontend/src/pages/LevelSelectPage.jsx:138` | `.e2e/acceptance-features.mjs` |
| FR-4 | `frontend/src/pages/LandingPage.jsx:42` | `.e2e/responsive-tiers.mjs` |
| FR-5 | `frontend/src/components/ProtectedRoute.jsx:27` | `.e2e/tutorial-gate.mjs` |
| FR-6 | `frontend/src/components/TutorialGate.jsx:62` | `.e2e/tutorial-gate.mjs`, `.e2e/gate-fresh-user-check.mjs` |
| FR-7 | `frontend/src/components/TutorialGate.jsx:41` | `.e2e/tutorial-gate.mjs` |
| FR-8 | `backend/api/routes/levels.py:18`, `backend/services/content_service.py:24` | `live` |
| FR-9 | `backend/api/routes/laws.py:18` | `live` |
| FR-10 | `backend/repositories/content_repository.py:16`, `frontend/vite.config.js:16` | `.e2e/verify-sandbox.mjs`; `live` |
| FR-11 | `frontend/src/pages/LevelSelectPage.jsx:60` | `.e2e/gameplay.mjs`, `.e2e/acceptance-features.mjs` |
| FR-12 | `frontend/src/state/progressStore.js:291`, `frontend/src/pages/LevelSelectPage.jsx:94` | `.e2e/gameplay.mjs` |
| FR-13 | `frontend/src/pages/StageSelectorPage.jsx:56` | `.e2e/gameplay.mjs` |
| FR-14 | `frontend/src/pages/StageSelectorPage.jsx:68`, `frontend/src/state/progressStore.js:281` | `.e2e/gameplay.mjs` |
| FR-15 | `frontend/src/state/useGameState.js:199`, `frontend/src/engine/laws/index.js:33` | `npm test` → `laws.test.js`, `absorption.test.js` |
| FR-16 | `frontend/src/state/useGameState.js:354` | `.e2e/law-comments.mjs`, `.e2e/gameplay.mjs` |
| FR-17 | `frontend/src/state/useGameState.js:461`, `frontend/src/components/puzzle/StepHistoryPanel.jsx` | `.e2e/law-comments.mjs` |
| FR-18 | `frontend/src/state/useGameState.js:523`, `frontend/src/hooks/useTermDrag.js:235` | `.e2e/acceptance-features.mjs` |
| FR-19 | `frontend/src/pages/ProblemPage.jsx:275`, `frontend/src/state/useGameState.js:487` | `.e2e/gameplay.mjs` |
| FR-20 | `frontend/src/state/useGameState.js:53` | `npm test` → `solver.test.js`; `.e2e/gameplay.mjs` |
| FR-21 | `frontend/src/state/useGameState.js:501`, `frontend/src/state/hintText.js:18` | `.e2e/gameplay.mjs` |
| FR-22 | `frontend/src/state/useGameState.js:560`, `frontend/src/pages/ProblemPage.jsx:263` | `.e2e/gameplay.mjs` |
| FR-23 | `frontend/src/state/useGameState.js:437` (win test), `:83` (goal canonicalisation), `frontend/src/engine/render.js:28` (`canonText`) | `npm test` → `solver.test.js`; `.e2e/gameplay.mjs` (a real solve reaches the win state) |
| FR-24 | `backend/services/scoring_service.py:32`, `backend/config/constants.py:9` | `live` (11 cases incl. edge cases) |
| FR-25 | `frontend/src/components/puzzle/usePuzzleSession.js:173`, `:200` | `.e2e/gameplay.mjs`; `npm test` → `solver.test.js` (`estimateScore` parity) |
| FR-26 | `frontend/src/components/puzzle/usePuzzleSession.js:190` | `.e2e/sandbox-ui.mjs`, `.e2e/gameplay.mjs` |
| FR-27 | `frontend/src/components/puzzle/ScoreModal.jsx:106` | `.e2e/mobile-ux-verify.mjs` |
| FR-28 | `backend/api/routes/score.py:39`, `backend/services/progress_service.py:87` | `live` |
| FR-29 | `frontend/src/state/progressStore.js:69` | `.e2e/sandbox-ui.mjs` |
| FR-30 | `frontend/src/state/progressStore.js:97` | `.e2e/tutorial-gate.mjs` (cross-device tutorial completion) |
| FR-31 | `frontend/src/state/useGameState.js:101` | `.e2e/gameplay.mjs` |
| FR-32 | `backend/api/routes/progress.py:20`, `:26` | `live` |
| FR-33 | `frontend/src/pages/SandboxPage.jsx:117`, `frontend/src/engine/sandbox/validate.js:155` | `npm test` → `validate.test.js`; `.e2e/sandbox-input-ui.mjs` |
| FR-34 | `frontend/src/engine/sandbox/input.js:109` | `npm test` → `sandbox.test.js`; `.e2e/verify-sandbox-input.mjs`, `.e2e/sandbox-engine-audit.mjs` |
| FR-35 | `frontend/src/pages/SandboxPage.jsx:178` | `.e2e/sandbox-ui.mjs` |
| FR-36 | `frontend/src/engine/sandbox/generator.js:234` | `npm test` → `sandbox.test.js`; `.e2e/generator-stress.mjs` |
| FR-37 | `frontend/src/components/puzzle/sandboxPuzzle.js:46` | `.e2e/sandbox-ui.mjs` |
| FR-38 | `frontend/src/components/InteractiveTutorial.jsx:194` | `.e2e/tutorial-gate.mjs`, `.e2e/tutorial-overlap-verify.mjs` |
| FR-39 | `frontend/src/state/useGameState.js:450` | `.e2e/tutorial-gate.mjs` |
| FR-40 | `frontend/src/services/soundEffects.js:132` | `.e2e/acceptance-features.mjs` |
| FR-41 | `frontend/src/hooks/useDeviceTier.js:57` | `.e2e/responsive-tiers.mjs`, `.e2e/mobile-landscape-workspace.mjs` |
| FR-42 | `frontend/src/pages/ProblemPage.jsx:64` | `.e2e/responsive-tiers.mjs`, `.e2e/acceptance-features.mjs`, `.e2e/popup-overlap-verify.mjs` |
| FR-43 | `frontend/src/config/appLinks.js:9` | `.e2e/acceptance-features.mjs` |

### Non-functional requirements

| Req | Implementing file(s) | Verifying evidence |
|---|---|---|
| NFR-1 | `frontend/src/engine/index.js` (the only engine); no algebra under `backend/` | Import + grep analysis over `backend/` |
| NFR-2 | `frontend/src/engine/**` | Import analysis: only `config/gameRules.js` crosses the boundary |
| NFR-3 | `frontend/src/engine/equivalence.js:45`, `frontend/src/engine/laws/helpers.js:11` | `npm test` → `law-soundness.property.test.js` (5 property tests) |
| NFR-4 | `frontend/package.json:11` | Ran `npm test` → 76/76 pass |
| NFR-5 | `backend/core/responses.py:32`, `backend/main.py:50` | `live` (success, 404, 422, 401, unknown path) |
| NFR-6 | `backend/core/security.py:17` | `live` (401 bodies) |
| NFR-7 | `.gitignore:3`, `frontend/.gitignore:15`, `backend/config/settings.py:19` | `git check-ignore`; no value reproduced in any doc |
| NFR-8 | `frontend/src/config/gameRules.js:58`, `frontend/src/services/contentApi.js:22` | `.e2e/sandbox-ui.mjs` |
| NFR-9 | `frontend/src/services/apiClient.js:53` | `.e2e/gameplay.mjs` (offline solve still shows a breakdown) |
| NFR-10 | `backend/core/middleware.py:26`, `backend/core/logging.py:34` | `live` (X-Request-ID present; one JSON line per request) |
| NFR-11 | `frontend/src/config/gameRules.js`, `backend/config/constants.py` | Import analysis (one documented exception, §9) |
| NFR-12 | `frontend/src/hooks/useDeviceTier.js:57` | `.e2e/responsive-tiers.mjs` (43 checks per the refactor report) |
| NFR-13 | `frontend/src/hooks/useCollisionPlacement.js:164`, `frontend/src/pages/SandboxPage.jsx:286` | `.e2e/popup-overlap-verify.mjs` |
| NFR-14 | `render.yaml:1-16`, `frontend/vercel.json:3-6` (the `/api/(.*)` rewrite) and `frontend/vercel.json:5` (the deployed host it targets) | Read |
| NFR-15 | `frontend/src/engine/laws/definitions.js:29` | `npm test` → `laws.test.js` (the table throws on an unknown name/form pair) |

## 9. Verification gaps

These are honest gaps, stated so that nobody mistakes coverage for completeness.

1. **The backend has no automated test suite.** There is no `tests/` directory, no
   `conftest.py` and no `pytest` in `backend/requirements.txt`. Every backend requirement in
   §8 is marked `live`, meaning it was verified by running
   `fastapi.testclient` against `backend/main.py` while writing this document — a manual,
   non-repeatable check. Adding a pytest suite that covers the envelope, the 404/422/401
   paths and the scoring boundary cases is the single highest-value testing improvement
   available.
2. **The `.e2e/` suites need a running dev server and a browser**; they are not part of
   `npm test` and there is no CI configuration in the repository to run them.
3. **The engine layer rule is enforced by review, not by tooling.** Nothing fails the build
   if `engine/` starts importing React.
4. **One layering exception exists and is deliberate.**
   `frontend/src/services/contentApi.js:10` imports `../content/gameContent.js`. The layer
   rule in `docs/ARCHITECTURE.md` says "services/ imports config/ only", so this is a real
   deviation; it is defensible because `content/` is static bundled data rather than a
   component or a stateful module, but it is a deviation and is recorded as such.
5. **Server-side scoring trusts the client.** `stepsUsed`, `lawsUsed`, `hintsUsed` and
   `optimalSteps` are taken as submitted, and the derivation itself is never re-checked. A
   learner who modifies the request can score 100 on an unsolved puzzle. See C-10.
6. **The client and server compute the bonus differently at exact `.5` boundaries** [D21].
   Python `round()` is banker's rounding; JS `Math.round` is half-up. Verified:
   `total = 90.0` gives `earnedPoints = 4` server-side and `5` client-side; totals of 10 and
   50 diverge the same way. The server value is authoritative and overwrites the client
   estimate, so the learner can briefly see one number and end with another.
7. **Progress values are not validated server-side.** `POST /api/progress/save` stores
   whatever snapshot the client sends, including arbitrary point totals.
8. **`stageScores` is round-tripped but never re-verified against `score_history`**, so a
   client that reports an inflated best score keeps it.
9. **The win condition is canonical-text equality, not semantic equivalence.** FR-23 ③ is a
   real behavioural edge case: a learner can reach a terminal form that is logically
   equivalent to the goal but renders differently, and the puzzle will not complete. The
   exhaustive truth-table checker exists and is sound, but it is used for *law detection* and
   *sandbox verification*, never for completion. This asymmetry is worth a deliberate product
   decision — either widen the win test to `isEquivalent`, or constrain the content so every
   puzzle has exactly one terminal canonical form.
10. **No per-step proof exists.** A step is accepted because a law implementation produced it,
    not because the rewrite was re-proved. Soundness rests on those implementations plus the
    property test in `frontend/src/engine/__tests__/law-soundness.property.test.js`.
11. **Dead-end detection is a heuristic.** It reports "no move available" from an empty
    `scanHints` result (`frontend/src/state/useGameState.js:61`), which is a statement about
    the implemented law registry, not a proof that no derivation exists.

## 10. Known discrepancies affecting this document

The requirement set above describes the code. Where the stale proposal in
[`context.md`](../context.md) or the original task brief says otherwise, this is the
resolution. The full register is D0–D23 in
[known-limitations.md](../07-explanation/known-limitations.md).

| ID | This SRS requires | Proposal claims | Resolution |
|---|---|---|---|
| D0 | Everything here is derived from the tree. | `context.md` is the project context. | It is stale in §2, §5, §10, §11, §12. |
| D1 / D23 | Sandbox validation is client-side only; **no `POST /sandbox/validate` exists** and §5.1 lists 7 endpoints. | The brief implies such an endpoint. | Implemented in `frontend/src/engine/sandbox/validate.js:155` and `frontend/src/engine/sandbox/input.js:109`. |
| D2 | Supabase is integrated: 3 tables, bearer auth, 2 progress endpoints (FR-29 – FR-32, §5.2). | "NOT integrated yet"; "Auth: None". | `backend/supabase_client.py`, `backend/api/routes/progress.py`, `frontend/src/services/supabaseClient.js`. |
| D3 | Auth is Supabase Auth. | Better Auth tables via `npx auth migrate`. | Four dead Better Auth remnants remain: the `init.sql:4` header, `vite.config.js:24-28`, `LandingPage.jsx:21`, `LevelSelectPage.jsx:142`. |
| D6 | **7** application endpoints. | 5 endpoints. | §5.1 is the live-verified list. |
| D7 | `POST /api/score` **does** persist for a signed-in learner (FR-28). | "does NOT save to DB". | `backend/api/routes/score.py:38-39`. |
| D8 | The scoring formula as specified in FR-24, including `min(declared, stepsUsed)`, the hints+guides assistance total, 1-dp rounding, and full 30 for a puzzle with no target laws. | A simpler formula. | `backend/services/scoring_service.py:80-115`. |
| D10 | 4 levels, Tutorial 4 + 12 + 12 + 12 = **40** puzzles. | 3 levels × 6 puzzles. | Counted from `content/levels.json`; `GET /api/levels` returns `puzzleCount [4,12,12,12]`. |
| D13 | CORS origins are the three dev origins plus `FRONTEND_URL` when set. | Only `localhost:5173` and `127.0.0.1:5173`. | `backend/config/settings.py:23-27`, `:66-71`. |
| D14 | Env files exist locally and are gitignored and untracked. | "No `.env` file exists yet". | `.gitignore:3` (`backend/.env`); `frontend/.gitignore:15` (`frontend/.env.local`); `backend/config/settings.py:19`. |
| D17 | Backend paths are `backend/{config,core,api/routes,api/schemas,services,repositories}`. | `app/core`, `app/services`, `app/routers`… | There is no `backend/app/`. |
| D18 | Frontend paths are `src/services` and `src/pages`. | `src/api`, `src/screens`. | Neither directory exists. |
| D19 | Backend on Render, SPA on Vercel (NFR-14). | Render for the whole app. | `render.yaml:1-16`, `frontend/vercel.json:1-12`. |
| D20 | RLS is permissive and is a known limitation, not a control (DR-4). | RLS as a safety feature. | `database/init.sql:56-58`. |
| D21 | The client estimate mirrors the server formula; the two diverge at exact `.5` boundaries (§9.6). | — | Python `round` vs JS `Math.round`. |
| D22 | The OpenAPI spec declares no security scheme (§5.1). | — | `Depends`-based auth emits `security=None`. |
