# Praxis — Project Rules and Conventions

**What this is:** the house rules for changing this codebase — the layering, naming, content,
testing and documentation conventions the project actually follows.

**Who it's for:** anyone about to open a pull request, and any reviewer deciding whether a change
belongs where it was put. Every rule below cites the `file:line` that evidences it, so you can check
a rule rather than trust it.

> **Every rule here is derived from the code, not invented.** Each one has an **Evidence** line
> with real `file:line` citations and an **Enforced by** line saying honestly whether a tool checks
> it or a human must. Where a convention is *not* machine-enforced that is stated plainly — several
> of the most important rules here are review-enforced only.

---

## Contents

- [Reading a rule](#reading-a-rule)
- [A. Backend layering](#a-backend-layering)
- [B. Frontend layering](#b-frontend-layering)
- [C. The engine contract](#c-the-engine-contract)
- [D. Content authoring](#d-content-authoring)
- [E. Naming conventions](#e-naming-conventions)
- [F. Testing](#f-testing)
- [G. Documentation](#g-documentation)
- [H. What is actually enforced, and by what](#h-what-is-actually-enforced-and-by-what)
- [I. Adding or changing a rule](#i-adding-or-changing-a-rule)

---

## Reading a rule

Every rule is written the same way:

- **Rule** — the imperative, in one sentence.
- **Why** — the reason, usually a failure mode the code's own comments describe.
- **Evidence** — `file:line` citations proving the rule describes reality.
- **Enforced by** — `tool` (something fails automatically), `review` (a human must catch it), or
  both. This line is not decoration: **most of the layering rules here are review-enforced**.

Rules are numbered `A1`, `B2`, `C3` … so a review comment can point at one.

---

## A. Backend layering

The backend is `backend/` — **there is no `backend/app/` package**. Its layers, in dependency
order, are `api/routes` → `services` → `repositories` → `supabase_client`, with `core/` and
`config/` cross-cutting beneath them.

### A1. Imports point down the layers, never up

**Rule.** `api/routes/*` may import `services`, `core`, `config` and its own `api/schemas`. It must
not import `repositories` or `supabase_client`. `services/*` may import `repositories`, `core` and
`config`, and must not import `api`. `repositories/*` may import `core` and `supabase_client`, and
must not import `services` or `api`.

**Why.** A route that reaches around its service into a repository cannot be tested without a
database, and a repository that knows about HTTP cannot be reused. The layer packages state the
order in their own docstrings.

**Evidence.** Layer docstrings: [`backend/api/routes/__init__.py:1`](../../backend/api/routes/__init__.py#L1)
("thin adapters: parse, call a service, return the envelope"),
[`backend/services/__init__.py:1`](../../backend/services/__init__.py#L1),
[`backend/repositories/__init__.py:1`](../../backend/repositories/__init__.py#L1) ("the only modules
that know where data lives"). Actual imports: [`backend/api/routes/levels.py:13`](../../backend/api/routes/levels.py#L13)
(`services`), [`backend/services/content_service.py:11`](../../backend/services/content_service.py#L11)
(`repositories`), [`backend/repositories/progress_repository.py:13`](../../backend/repositories/progress_repository.py#L13)
(`supabase_client`). A full inversion of the backend import graph shows no upward edge.

**Enforced by.** review. Nothing fails a build if you import a repository from a route.

### A2. Repositories are the only modules that touch the database

**Rule.** All Supabase data access lives in `backend/repositories/`. No other module calls
`supabase.table(...)`.

**Why.** One place to change a query, add a filter or find out what a table is called. The table
names themselves are constants in the repository, not string literals at call sites.

**Evidence.** The table-name constants and every query are in
[`backend/repositories/progress_repository.py:15-18`](../../backend/repositories/progress_repository.py#L15-L18)
and [`:29-73`](../../backend/repositories/progress_repository.py#L29-L73). The inventory:
`grep -rn "supabase.table(" backend/` matches `progress_repository.py` only.
The single exception is **not** data access: `backend/core/security.py:27` calls
`supabase.get_user(token)` to verify a bearer token against Supabase Auth.

**Enforced by.** review. The grep above is the check; re-run it after any auth or data change.

### A3. `main.py` is wiring only — no business logic

**Rule.** `backend/main.py` creates the app, registers middleware and exception handlers, and
includes routers. It holds no rules, no computation and no query.

**Why.** Anything in the assembly file is reachable only through a running app, so it cannot be unit
tested, and it tends to grow because it is the path of least resistance.

**Evidence.** `main.py` is 83 lines and imports `api.routes`, `config.settings` and `core.*` — no
`services`, no `repositories`, no `supabase_client` ([`backend/main.py:15-20`](../../backend/main.py#L15-L20)).
Its own docstring says "wiring only, no business logic"
([`backend/main.py:1`](../../backend/main.py#L1)).

**Enforced by.** review.

### A4. Routes stay thin: parse, delegate, wrap

**Rule.** A route handler parses the request, calls **one** service function, and returns
`success(...)` or lets an `AppError` propagate. It contains no branching on business data.

**Why.** The route is the only layer that knows about HTTP; keeping it thin is what lets the same
logic be called from a background task or a test.

**Evidence.** `score.py` is 49 lines and its handler body is a single `scoring_service.compute_score`
call plus a `BackgroundTasks` enqueue ([`backend/api/routes/score.py:27-49`](../../backend/api/routes/score.py#L27-L49)).
`laws.py` is 21 lines and returns `success(content_service.list_laws())`
([`backend/api/routes/laws.py:18-21`](../../backend/api/routes/laws.py#L18-L21)).

**Enforced by.** review.

### A5. Errors are raised as `AppError` subclasses with a stable code

**Rule.** Raise `NotFoundError`, `ContentUnavailableError`, `UpstreamError` or `UnauthorizedError`
(or a new `AppError` subclass). Never return an ad-hoc error dict and never let an unexpected
exception reach the client raw. Error codes come from `ErrorCode` and are part of the public
contract.

**Why.** One handler in `main.py` turns any `AppError` into the correct status plus the
`{ code, message, detail }` envelope. Codes are consumed by the frontend, so adding one is an API
change.

**Evidence.** Seven codes at [`backend/core/errors.py:11-20`](../../backend/core/errors.py#L11-L20);
four subclasses with pinned statuses at [`:52-81`](../../backend/core/errors.py#L52-L81); the
handlers at [`backend/main.py:39-76`](../../backend/main.py#L39-L76). Example raise:
[`backend/services/content_service.py:28`](../../backend/services/content_service.py#L28).

**Enforced by.** review.

### A6. Every `/api/*` response uses the envelope; `GET /` is the one exception

**Rule.** Return the `{ success, data, error }` envelope from every `/api/*` route, and declare
`response_model=Envelope`. Do **not** change `GET /` to use it.

**Why.** A single shape means the client unwraps in one place. `GET /` is plain because Render's
health check reads that body.

**Evidence.** [`backend/core/responses.py:24-43`](../../backend/core/responses.py#L24-L43) defines
the envelope and its builders; all four `/api` route modules declare it
(e.g. [`backend/api/routes/levels.py:18`](../../backend/api/routes/levels.py#L18)). The deliberate
exception is documented at [`backend/api/routes/health.py:1-3`](../../backend/api/routes/health.py#L1-L3).

**Enforced by.** review.

### A7. Settings are read once, from the environment — never hardcoded

**Rule.** Read configuration through `config.settings.settings` or `config.constants`. Never inline
a credential, a CORS origin or a table name.

**Why.** `Settings.from_env()` runs at **import time** and fails fast naming the missing variable,
so a misconfigured deploy dies at boot rather than at the first request. Render supplies
`SUPABASE_URL`/`SUPABASE_SERVICE_KEY` from its dashboard (`sync: false`), so no value may be
committed.

**Evidence.** [`backend/config/settings.py:30-38`](../../backend/config/settings.py#L30-L38)
(`require_env`), [`:56-63`](../../backend/config/settings.py#L56-L63) (`from_env`),
[`:74-75`](../../backend/config/settings.py#L74-L75) (the import-time singleton);
[`render.yaml:12-15`](../../render.yaml#L12-L15) (`sync: false`).

**Enforced by.** review. See also [G3](#g3-never-commit-a-secret-value).

---

## B. Frontend layering

### B1. Components must never call `fetch` directly

**Rule.** All HTTP goes through `frontend/src/services/*Api.js`, which all go through
`apiRequest` in `frontend/src/services/apiClient.js`. A component, page, hook or state module must
not contain a `fetch` call.

**Why.** Headers, the auth token, JSON handling and the error shape are then decided in exactly one
place — which is why swapping the transport is a one-file change.

**Evidence.** The rule is written in the code itself:
[`frontend/src/services/apiClient.js:5-6`](../../frontend/src/services/apiClient.js#L5-L6) — "Components
must never call fetch directly — they go through services/\*Api.js". The inventory confirms it:
`grep -rn "fetch(" frontend/src/` returns **exactly one** match,
[`frontend/src/services/apiClient.js:63`](../../frontend/src/services/apiClient.js#L63). The three
`*Api.js` modules that consume it are `contentApi.js:11`, `progressApi.js:8` and `scoreApi.js:9`.

**Enforced by.** review, verifiable in one command:
`grep -rn "fetch(" frontend/src/` must return one line.

### B2. The engine must stay pure, framework-free and network-free

**Rule.** Nothing in `frontend/src/engine/` may import React, the router, Supabase, a hook, a
component, a service or a state module; may not touch `window`, `document` or `localStorage`; and
may not call `fetch`. Its only external import is plain data/constants from `config/gameRules.js`.

**Why.** Purity is what makes the algebra testable with `node --test` in milliseconds, with no
browser and no server. If the engine imported React, `npm test` could not run it.

**Evidence.** The rule is stated at
[`frontend/src/engine/index.js:8-13`](../../frontend/src/engine/index.js#L8-L13) — including the
candid note that it is "enforced by review, not by the bundler". The inventory: the grep in that
same comment returns nothing, and the only non-relative imports anywhere in `engine/` are
`config/gameRules.js` (`engine/solver.js:1`, `engine/scoring.js:14-18`,
`engine/sandbox/generator.js:11`, `engine/sandbox/validate.js:26`, `engine/sandbox/input.js:36`) and
`node:test` in the test files.

**Enforced by.** review.

### B3. Consumers import the engine barrel, not deep modules

**Rule.** Import from `frontend/src/engine/index.js` (or `../engine/index.js`). Do not import
`engine/solver.js`, `engine/laws/sumLaws.js` and so on from outside `engine/`.

**Why.** The barrel is the published surface; internals stay free to move. The barrel's own comment
says so.

**Evidence.** [`frontend/src/engine/index.js:12-13`](../../frontend/src/engine/index.js#L12-L13)
("Consumers should import from this barrel, not from the deep modules, so the internals stay free to
move"). All seven in-app consumers do exactly that: `components/AnimationOverlay.jsx`,
`components/animations/DeMorganSplitAnimation.jsx`, `components/puzzle/sandboxPuzzle.js`,
`components/puzzle/usePuzzleSession.js`, `pages/SandboxPage.jsx`, `state/hintText.js`,
`state/useGameState.js`.

**Enforced by.** review.

### B4. Every tunable number lives in `frontend/src/config/`

**Rule.** A game rule, a threshold, a timing, a drag tolerance, a sound cue or a search budget goes
in `frontend/src/config/gameRules.js` (or `storageKeys.js` for a storage key, `appLinks.js` for a
URL). Never inline it at a call site.

**Why.** The file's own comment records the failure this fixed: the same figures were repeated in
four places ("40/30/30 in two files, 90/75 in two, 80 % in three, 10/20/5 points in four"), so
changing a rule meant finding every copy.

**Evidence.** [`frontend/src/config/gameRules.js:1-11`](../../frontend/src/config/gameRules.js#L1-L11)
(the rule and its history), [`:13-181`](../../frontend/src/config/gameRules.js#L13-L181) (the
constants). Compliance: **21** modules import it (20 excluding tests), including every engine module
that needs a budget and every screen — `grep -rlE "from '[^']*config/gameRules(\.js)?'" frontend/src`
returns 21 files. (`22` files *mention* it; the 22nd, `frontend/src/engine/index.js:10`, does so in a
comment only.) `storageKeys.js:1-5` states the same rule for keys ("never inline a key at a call
site"); `appLinks.js:1-5` for URLs.

**Enforced by.** review.

### B5. Components render; they do not implement logic or talk to the network

**Rule.** A component receives data and callbacks as props. Loading, scoring, persistence and
algebra belong to a hook, a service or the engine.

**Why.** It keeps the workspace's many presentational pieces testable and swappable, and it is why
`ProblemPage` can compose 17 components without any of them knowing the API exists.

**Evidence.** The rule shows up as a consistent design: the level screens delegate overlay state to
`hooks/usePageOverlays.js:1-6`, the workspace delegates its session to
`components/puzzle/usePuzzleSession.js:1-8`, `ZoomControls` is documented as "Presentational: `zoom`
comes in, `onZoom` receives a state updater"
([`frontend/src/components/puzzle/ZoomControls.jsx:1-5`](../../frontend/src/components/puzzle/ZoomControls.jsx#L1-L5)),
and `LawCard` as "Presentational — the caller owns the law data"
([`frontend/src/components/laws/LawCard.jsx:1-4`](../../frontend/src/components/laws/LawCard.jsx#L1-L4)).

**Enforced by.** review.

### B6. Keep component and hook exports in separate files

**Rule.** A file exports **either** a component **or** hooks/helpers — never both. Put the shared
context object in its own module for the same reason.

**Why.** React Fast Refresh silently stops working when a module mixes component and non-component
exports. Two files in this repo document that they exist *because* of it.

**Evidence.** [`frontend/src/state/authContext.js:1-6`](../../frontend/src/state/authContext.js#L1-L6)
("kept in its own module … so that AuthProvider.jsx exports only a component and useSession.js
exports only a hook — React Fast Refresh stops working when one file mixes them");
[`frontend/src/components/ui/authInputStyles.js:1-5`](../../frontend/src/components/ui/authInputStyles.js#L1-L5)
(same reason for a class-name helper).

**Enforced by.** tool — partially. `react-refresh` is enabled at
[`frontend/eslint.config.js:14`](../../frontend/eslint.config.js#L14), so `npm run lint` warns on
the pattern.

---

## C. The engine contract

### C1. The backend never re-implements algebra

**Rule.** Boolean simplification exists in exactly one place: `frontend/src/engine/`. The backend
serves content and scores numbers the client submits; it must never parse, rewrite or verify a
Boolean expression.

**Why.** Two implementations of the same algebra drift, and the drift is invisible until a learner's
legal step is rejected. The frontend/backend split is deliberate: the engine is the authority on
*what a legal simplification is*, the backend is the authority on *what a completed puzzle scores*.

**Evidence.** There is no algebra code in `backend/`: no parser, no AST, no law. Its content layer
reads the JSON and returns it verbatim
([`backend/repositories/content_repository.py:19-43`](../../backend/repositories/content_repository.py#L19-L43)),
and its scoring layer reads `stepsUsed`, `lawsUsed` and `hintsUsed` as **already-computed numbers**
([`backend/api/schemas/score.py:13-21`](../../backend/api/schemas/score.py#L13-L21)). The contract is
named at [`frontend/src/engine/index.js:1-14`](../../frontend/src/engine/index.js#L1-L14);
`frontend/src/engine/scoring.js:2-12` spells out the split ("The backend is authoritative … this
module exists only so the UI can render the breakdown instantly").

**Enforced by.** review. This is the single most important rule on this page and nothing checks it.

### C2. `content/*.json` is the single source for laws and levels

**Rule.** Add a law or a puzzle to `content/laws.json` / `content/levels.json`. Never hardcode one
in a component, a service, the engine or the backend.

**Why.** The same files are consumed by both sides — the API reads them from disk, the SPA bundles
them through the Vite `@content` alias — so hardcoding a copy on one side makes the two disagree.

**Evidence.** [`frontend/src/content/gameContent.js:2-6`](../../frontend/src/content/gameContent.js#L2-L6)
("read by BOTH this app … and the FastAPI backend … Nothing here may hardcode a law or a puzzle: add
it to the JSON"); [`frontend/vite.config.js:14-16`](../../frontend/vite.config.js#L14-L16) (the
alias, "One source of truth, two consumers"); the backend side at
[`backend/repositories/content_repository.py:16`](../../backend/repositories/content_repository.py#L16).

**Enforced by.** review.

### C3. Law ids are the join key between content, engine and storage

**Rule.** A law's `id` in `content/laws.json` must equal the `id` in the engine's
`LAW_DEFINITIONS`. Introducing a new law means adding it in **both** places, with the same kebab-case
id.

**Why.** Content ids flow into `targetLaws`, into the submitted `lawsUsed`, into scoring and into
the `score_history` table. A mismatch silently scores a law the learner used as unused.

**Evidence.** The rule is stated as the design intent at
[`frontend/src/engine/laws/definitions.js:10-11`](../../frontend/src/engine/laws/definitions.js#L10-L11)
("`content/laws.json`, whose `id` matches the `id` used here (that is the join key between engine and
content)"). Ids are mapped from display names by `LAW_NAME_TO_ID`
([`:63-65`](../../frontend/src/engine/laws/definitions.js#L63-L65)) and consumed by
[`frontend/src/engine/scoring.js:25-28`](../../frontend/src/engine/scoring.js#L25-L28).
The ten content ids and the ten engine ids currently agree (verified by extracting `id` from both
sources and diffing).

> ⚠️ **Not machine-enforced.** There is **no test that reads `content/laws.json` and compares it to
> `LAW_DEFINITIONS`**, and no CI configuration is tracked in this repository. Until such a test
> exists this rule is caught only by review or by a puzzle that behaves oddly.

**Enforced by.** review.

### C4. The engine is the sole authority on whether a step is legal

**Rule.** Do not add a special case to the UI that lets a step through that the engine would not
offer. If the engine will not produce a transition, the UI must not either.

**Why.** The solver, the hint scanner, the law arms and the UI must all agree on the move set,
otherwise the optimal step count, the score and the learner's experience diverge. The sandbox
enforces this explicitly by replaying a proposed solution through the same transitions the UI offers.

**Evidence.** [`frontend/src/engine/sandbox/input.js:60-70`](../../frontend/src/engine/sandbox/input.js#L60-L70)
(`replaysThroughUi`, "one of the moves the workspace itself will offer"); the single move-set source
is `getLegalTransitions` at [`frontend/src/engine/solver.js`](../../frontend/src/engine/solver.js),
used by both the solver and the sandbox validation.

**Enforced by.** tool — partially. `npm test` includes the soundness property test
([`frontend/src/engine/__tests__/law-soundness.property.test.js`](../../frontend/src/engine/__tests__/law-soundness.property.test.js)),
which fails if a law stops preserving semantics.

---

## D. Content authoring

### D1. A puzzle's keys are exactly `expr`, `goal`, `targetLaws`, `hints`, `optimalSteps`, `optimalHint`

**Rule.** Use those six key names, spelled exactly like that, in that camelCase. Do not rename,
abbreviate or add a key to an authored puzzle.

**Why.** Both sides read these keys by name with **no schema validation** — the backend uses
`puzzle.get("targetLaws", [])` and the frontend reads `puzzle.hints`. A typo therefore does not
error; it silently yields an empty list, and the puzzle scores wrongly.

**Evidence.** All 40 puzzles in `content/levels.json` use exactly this key set (verified: the set of
key-tuples across all puzzles has exactly **one** distinct member). Consumers:
`optimalSteps` and `optimalSteps` in [`backend/services/scoring_service.py:46,85`](../../backend/services/scoring_service.py#L46-L85),
`targetLaws` at [`backend/services/scoring_service.py:46`](../../backend/services/scoring_service.py#L46),
`hints` at [`frontend/src/state/useGameState.js:558-559`](../../frontend/src/state/useGameState.js#L558-L559),
`optimalHint` at [`frontend/src/components/puzzle/ScoreModal.jsx:154-156`](../../frontend/src/components/puzzle/ScoreModal.jsx#L154-L156).
The generator deliberately emits the **same** key set for invented puzzles, which is the clearest
statement of the contract: [`frontend/src/engine/sandbox/generator.js:137`](../../frontend/src/engine/sandbox/generator.js#L137).

**Enforced by.** review. No schema file validates `levels.json`.

### D2. `targetLaws` entries must be real law ids

**Rule.** Every string in a puzzle's `targetLaws` must be an id that exists in `content/laws.json`.

**Why.** The target-law band is `30 × |targetLaws ∩ lawsUsed| / |targetLaws|`. An id that no law can
ever produce makes that share unreachable, capping the puzzle below 100 and silently breaking the
"3 stars" path.

**Evidence.** The scoring formula at
[`backend/services/scoring_service.py:99-107`](../../backend/services/scoring_service.py#L99-L107);
the valid id set at [`content/laws.json`](../../content/laws.json). The union of `targetLaws` values
actually used across the 40 puzzles is a subset of the content ids — verified by extracting both.
Note that the engine-internal [`distributive-expand`](../06-reference/boolean-laws.md) is **not** a
valid target law: it has no reference card, so it must never appear in `targetLaws`.

**Enforced by.** review.

### D3. `levels.json` ids are 0-based, and `0` is the Tutorial

**Rule.** Level `id: 0` is the Tutorial; `id: 1` is "Level 1"; `id: 2` is "Level 2"; `id: 3` is
"Level 3 — Boss". `stage_idx` is likewise 0-based into the level's `puzzles` array. Never renumber.

**Why.** These ids are not display labels — they are persisted. `stage_progress.level_id` and
`stage_progress.stage_idx` store them, the API path parameter is one, the route param is one, and
`TUTORIAL.levelId = 0` is a hardcoded constant. Shifting the scheme orphans every existing row.

**Evidence.** [`content/levels.json`](../../content/levels.json) (the four ids);
[`frontend/src/config/gameRules.js:82-85`](../../frontend/src/config/gameRules.js#L82-L85)
(`TUTORIAL = { levelId: 0, stageIndexes: [0,1,2,3] }`);
[`frontend/src/components/TutorialGate.jsx:4-5`](../../frontend/src/components/TutorialGate.jsx#L4-L5)
(`TUTORIAL_LEVEL_ID = 0`, "Tutorial lives at level 0 (see content/levels.json)");
[`database/init.sql:24`](../../database/init.sql#L24) (`UNIQUE(user_id, level_id, stage_idx)`).

**Enforced by.** review.

### D4. A level has 12 stages — except the Tutorial, which has 4

**Rule.** Authored levels carry 12 puzzles; the Tutorial carries 4. The current totals are
**4 levels and 40 puzzles** (`[4, 12, 12, 12]`).

**Why.** The stage selector, the average-score unlock gate and the star totals all derive from the
per-level puzzle count, and the five `SANDBOX`/`SOLVER_BUDGET` numbers in `gameRules.js` are
**measured** against the real expressions — changing puzzle volume invalidates them.

**Evidence.** `content/levels.json` puzzle counts are `[4, 12, 12, 12]`
(`sum(len(l['puzzles']))` → 40, `grep -c '"expr"' content/levels.json` → 40). The measured-budget
note is at [`frontend/src/config/gameRules.js:115-132`](../../frontend/src/config/gameRules.js#L115-L132).

**Enforced by.** review.

### D5. A puzzle must actually be solvable, and `optimalSteps` must be the scoring optimum

**Rule.** Before committing a puzzle, confirm the `goal` is reachable from `expr` through the law
engine and that `optimalSteps` matches the **scoring optimum** — the shortest derivation that reaches
the goal *and* applies every law id in `targetLaws` (`findOptimalPathWithLaws`,
[`frontend/src/engine/solver.js:271`](../../frontend/src/engine/solver.js#L271-L346)) — not the raw
shortest path. In addition, **every declared `targetLaw` must be appliable on at least one derivation
that reaches the goal.** A law no goal-route can apply makes its share of the 30-point target-law band
unreachable for every learner: `findOptimalPathWithLaws` returns `found: false`, the workspace falls
back to the plain optimum, and the puzzle can never score 100.

**Why.** `optimalSteps` sets the efficiency bar, and the scoring service deliberately lets a
*shorter* solution lower that bar (`min(declared, stepsUsed)`), so an overstated optimum makes the
puzzle unwinnable at full marks; an understated one makes it trivially perfect. The bar has to be the
objective-aware optimum because `targetLaws` names the laws the puzzle exists to teach, and applying
them often costs a step: scoring against the raw shortest path left a perfect 100 unreachable on 25 of
the 40 shipped puzzles, and punished a learner for following the taught route. The reachability half
of the rule is the trap four shipped stages actually fell into: `2:2` and `2:3` declared
`["absorption"]`, and `2:6` and `2:7` declared `["distributive","complement","absorption"]`, but the
absorption step those puzzles relied on was the **semantic** collapse of a clause that is a constant
(`y(x + x') → y` in one step; `y + x·x' → y`). Structure-preserving normalization — the proposal's
Module 4 — forbids exactly that step, so no route to those goals can apply absorption at all. Their
`targetLaws` were re-authored to `["distributive","complement","identity"]`, which is what their
solutions use. A declared law earns points only if a goal-route can reach a state that offers it.

**Evidence.** The bar-lowering behaviour at
[`backend/services/scoring_service.py:80-88`](../../backend/services/scoring_service.py#L80-L88)
("A solution shorter than the recorded optimum lowers the bar to what was used"), mirrored at
[`frontend/src/engine/scoring.js:39-42`](../../frontend/src/engine/scoring.js#L39-L42). The
verification tooling already in the repo: the random generator refuses to return a puzzle the
solver cannot confirm
([`frontend/src/engine/sandbox/generator.js`](../../frontend/src/engine/sandbox/generator.js)),
the fingerprint baseline records every graded puzzle's optimal path
([`.e2e/lead-engine-fingerprint.mjs`](../../.e2e/lead-engine-fingerprint.mjs)), and
[`frontend/src/engine/__tests__/solver.test.js:162-201`](../../frontend/src/engine/__tests__/solver.test.js#L162-L201)
asserts that every authored puzzle has a reachable objective route and that its authored
`optimalSteps` matches the computed optimum — so a `targetLaw` that no goal-route can apply fails the
suite as well.

**Enforced by.** tool — partially. Generated puzzles get the solver check automatically
(`.e2e/generator-stress.mjs`); authored puzzles are covered by the per-puzzle assertion in
`solver.test.js`, which is automatic but only runs when the suite is run — there is no CI, so a human
still has to remember.

### D6. Tutorial content is authored separately from graded content

**Rule.** The tutorial's welcome slides and guided steps go in
`frontend/src/content/tutorialContent.js`, **not** in `content/*.json`. Only the tutorial's
*puzzles* (level 0) live in `levels.json`.

**Why.** The tutorial copy is UI narration with anchors, placements and slide ordering — it is not
shared with the backend and there is no reason to serve it over the API.

**Evidence.** [`frontend/src/content/tutorialContent.js:1-5`](../../frontend/src/content/tutorialContent.js#L1-L5)
(curated tutorial definitions) with consumers `components/tutorial/WelcomeModal.jsx` and
`components/tutorial/useTutorialProgress.js`; the tutorial's *level* is still data at
[`content/levels.json`](../../content/levels.json) (`id: 0`).

**Enforced by.** review.

---

## E. Naming conventions

These are the conventions the repository already follows, verified mechanically.

### E1. Backend — `snake_case` everywhere except classes and constants

**Rule.** Modules, functions and variables are `snake_case`. Classes are `PascalCase`. Module-level
constants are `SCREAMING_SNAKE_CASE`. Module-private helpers are prefixed with a single underscore.
Module names are short lower-case nouns; packages are lower-case with no underscores.

**Evidence.** Every `def` in the 28 tracked backend modules is `snake_case` (the only non-conforming
names are Python's own dunders `__init__` and `__repr__`). All 17 classes are `PascalCase`:
`AppError`, `ContentUnavailableError`, `Envelope`, `ErrorBody`, `ErrorCode`, `JsonFormatter`,
`NotFoundError`, `ProgressData`, `RequestContextMiddleware`, `SaveProgressRequest`, `ScoreOutcome`,
`ScoreRequest`, `ScoreResponse`, `Settings`, `SupabaseRESTClient`, `UnauthorizedError`,
`UpstreamError`. All 18 module constants are `SCREAMING_SNAKE_CASE`, e.g.
[`backend/config/constants.py:9-26`](../../backend/config/constants.py#L9-L26). Private helpers:
`_load`, `_execute`, `_resolve_optimal`, `_efficiency`, `_target_law`, `_hint_independence`.

**Enforced by.** review.

### E2. Backend — the module docstring names who imports it

**Rule.** Open each module with a docstring that says what it does and who imports it, in the form
"Imported by `path/*` only."

**Why.** In a layered backend, the fastest way to know whether a module may be imported somewhere
new is to read the contract it declares about itself.

**Evidence.** Nine modules carry an explicit "Imported by …" line, e.g.
[`backend/core/responses.py:1-4`](../../backend/core/responses.py#L1-L4),
[`backend/supabase_client.py:1-4`](../../backend/supabase_client.py#L1-L4),
[`backend/services/content_service.py:1-4`](../../backend/services/content_service.py#L1-L4). All
seven package markers carry a one-line layer description instead
([`backend/repositories/__init__.py:1`](../../backend/repositories/__init__.py#L1)).

**Enforced by.** review. Note this is a *documented* convention, not a complete one — 9 of 28
modules carry the line.

### E3. Frontend — `PascalCase.jsx` components, `use*` hooks, `*Api.js` transport

**Rule.**
- A React component or page is `PascalCase.jsx` (one component per file, exported `default`).
- A hook is `useSomething.js` (`camelCase` after the `use` prefix).
- An HTTP service is `somethingApi.js`; the transport itself is `apiClient.js`.
- Directories are lowercase and plural (`pages/`, `hooks/`, `services/`).
- Static data/constants modules are `camelCase.js` (`gameRules.js`).
- A test is `something.test.js`.

**Evidence.** All 7 pages are `PascalCase.jsx`; all 8 hooks begin with `use`
(`useBandedOverlay.js`, `useCollisionPlacement.js`, `useDeviceTier.js`, `usePageOverlays.js`,
`usePopupPlacement.js`, `useSoundEnabled.js`, `useTermDrag.js`, `useTutorialReplay.js`); the HTTP
services are `contentApi.js`, `progressApi.js`, `scoreApi.js` plus the transport `apiClient.js`; all
7 engine test files match `*.test.js`.

**Enforced by.** review, partially by `npm run lint`.

### E4. Engine modules are lowercase; `laws/` and `sandbox/` are lowerCamelCase

**Rule.** Top-level engine modules are single lowercase words (`solver.js`, `parser.js`,
`normalize.js`). Files inside `engine/laws/` name their law family in lowerCamelCase
(`sumLaws.js`, `productLaws.js`, `notLaws.js`, `constLaws.js`, `scanHints.js`).

**Evidence.** The 10 top-level engine modules are all lowercase; `engine/laws/` holds 8 files
following that pattern; `engine/sandbox/` holds `validate.js`, `generator.js`, `input.js`,
`expand.js`, `pool.js`.

**Enforced by.** review.

### E5. Law ids are kebab-case and match the display-independent slug

**Rule.** A law id is lowercase with hyphens: `double-neg`, `demorgan-and`, `demorgan-or`,
`distributive-expand`. Use `and`/`or`/`neg`, not `&&`/`||`/`not`.

**Evidence.** All ten content ids and the eleventh engine id follow it
([`content/laws.json`](../../content/laws.json),
[`frontend/src/engine/laws/definitions.js:31-54`](../../frontend/src/engine/laws/definitions.js#L31-L54)).

**Enforced by.** review.

### E6. Browser storage keys are namespaced `praxis_`

**Rule.** Every `localStorage`/`sessionStorage` key starts with `praxis_` (progress keys use
`praxis_v1_` for versioning). Define it in `frontend/src/config/storageKeys.js`; never inline it.

**Evidence.** All seven keys at
[`frontend/src/config/storageKeys.js:10-28`](../../frontend/src/config/storageKeys.js#L10-L28);
the rule at [`:1-6`](../../frontend/src/config/storageKeys.js#L1-L6); the e2e harness re-exports the
same constants rather than re-typing them
([`.e2e/_harness.mjs:54-60`](../../.e2e/_harness.mjs#L54-L60)).

**Enforced by.** review.

### E7. CSS utilities are prefixed `praxis-`; design tokens live in the Tailwind config

**Rule.** A shared layout utility is a `praxis-*` class. A value reachable through a class name
(colour, radius, shadow, font) belongs in `frontend/tailwind.config.js`; only values that must be
inline (the rotate chrome) become custom properties in `styles/tokens.css`.

**Evidence.** [`frontend/src/styles/utilities.css:1-6`](../../frontend/src/styles/utilities.css#L1-L6)
("the `praxis-*` class contract"); [`frontend/src/styles/tokens.css:1-9`](../../frontend/src/styles/tokens.css#L1-L9)
("tailwind.config.js is the source of truth for anything reached through a class name").

**Enforced by.** review.

### E8. Environment variables are `SCREAMING_SNAKE`; client-exposed ones are `VITE_`-prefixed

**Rule.** Backend vars are read with `os.getenv`/`require_env` and named `SUPABASE_URL`,
`SUPABASE_SERVICE_KEY`, `FRONTEND_URL`. A variable the browser needs must be `VITE_`-prefixed
because that is the only prefix Vite inlines.

**Evidence.** [`backend/config/settings.py:60-62`](../../backend/config/settings.py#L60-L62);
[`frontend/src/services/supabaseClient.js:6-7`](../../frontend/src/services/supabaseClient.js#L6-L7)
(`import.meta.env.VITE_SUPABASE_URL`, `…_PUBLISHABLE_KEY`); `VITE_API_TARGET` is read in
[`frontend/vite.config.js:8`](../../frontend/vite.config.js#L8).

**Enforced by.** review.

---

## F. Testing

### F1. Engine changes are verified with `npm test`

**Rule.** Run `npm test` from `frontend/`. Any change under `frontend/src/engine/` must keep the
suite green, and new engine behaviour should add a case to the relevant file (or a new
`*.test.js`).

**Why.** The suite is the only automated guard on the algebra. It runs in node with no browser and
no server, so there is no excuse for skipping it.

**Evidence.** The script is `node --test src/engine/__tests__/*.test.js`
([`frontend/package.json:11`](../../frontend/package.json#L11)); the suite is 7 files under
[`frontend/src/engine/__tests__/`](../../frontend/src/engine/__tests__/). **Verified: `npm test`
reports 81 tests, 81 pass, 0 fail.**

**Enforced by.** tool — when you run it. There is **no CI configuration tracked in this repository**,
so nothing runs the suite for you.

### F2. The law-soundness property test is the algebra's safety net

**Rule.** Do not weaken, skip or delete
`frontend/src/engine/__tests__/law-soundness.property.test.js`. If a law starts failing it, the law
is wrong, not the test.

**Why.** It is the only check that asserts *every* law preserves semantics — by evaluating both
sides over all variable assignments — rather than checking a handful of hand-written examples. The
current engine's baselines were re-authored after a soundness fix landed, so this test is load-bearing.

**Evidence.** [`frontend/src/engine/__tests__/law-soundness.property.test.js:28-36`](../../frontend/src/engine/__tests__/law-soundness.property.test.js#L28-L36)
(the harness) using `isEquivalent` from
[`frontend/src/engine/equivalence.js:45`](../../frontend/src/engine/equivalence.js#L45).

**Enforced by.** tool (when run).

### F3. Browser-level behaviour is verified with `.e2e/run-all-suites.sh`

**Rule.** Run `bash .e2e/run-all-suites.sh` from the repository root for anything that touches the
UI, layout, device tiers, the tutorial or gameplay. Read the per-suite logs under
`.e2e/_results/`.

**Why.** The engine suite cannot see the DOM. Layout and tutorial-overlap defects are only visible
to a browser, and several of these suites exist because a specific reported defect regressed.

**Evidence.** The runner is [`.e2e/run-all-suites.sh`](../../.e2e/run-all-suites.sh), which `cd`s to
the repo root from its own location, runs **16** suites under a 1800 s timeout, and writes
`.e2e/_results/<name>.log`. Two of the 16 take an environment override
([`.e2e/run-all-suites.sh:26`](../../.e2e/run-all-suites.sh#L26) passes `SKIP_TIP=1`).

**Enforced by.** tool (when run). The runner does **not** exit non-zero when a suite fails — it
prints `exit=N` per suite and continues to `ALL DONE`, so **read the log**, do not just check the
script's exit code.

### F4. A new browser suite must be wired into the runner

**Rule.** If you add an `.e2e/*.mjs` suite that should run with the others, add a `run <name> node
.e2e/<file>.mjs` line to `.e2e/run-all-suites.sh`. A suite that is not wired will silently never run.

**Why.** The directory and the runner are separate lists, and they have already drifted: of **19**
`.mjs` files, only **16** are wired.

**Evidence.** `.e2e/` has 19 `.mjs` files and `run-all-suites.sh` has 16 `run` lines. The three not
wired are [`.e2e/_harness.mjs`](../../.e2e/_harness.mjs) (a shared helper, not a suite),
[`.e2e/gate-fresh-user-check.mjs`](../../.e2e/gate-fresh-user-check.mjs) and
[`.e2e/lead-engine-fingerprint.mjs`](../../.e2e/lead-engine-fingerprint.mjs) — the latter two are
deliberate standalone diagnostics, but the pattern is exactly how a suite gets forgotten.

**Enforced by.** review.

### F5. Test data must not assume a fresh learner

**Rule.** A browser suite that asserts first-time behaviour must call `resetE2eProgress()` first, and
must skip — not fail — when the credentials are unavailable.

**Why.** The suites share one seeded e2e account whose progress persists between runs, so
"completing a stage awards points" is only meaningful for a stage the learner has not already
finished. The helper returns `null` when it cannot reach the credentials, so callers degrade
gracefully.

**Evidence.** [`.e2e/_harness.mjs:86-115`](../../.e2e/_harness.mjs#L86-L115) (`resetE2eProgress`,
including the "callers should then skip … rather than fail" instruction),
[`.e2e/_harness.mjs:126-156`](../../.e2e/_harness.mjs#L126-L156) (`seededState`).

**Enforced by.** review.

---

## G. Documentation

### G1. Links are relative, and every link must resolve on disk

**Rule.** Cross-link with a path relative to the file containing the link. Before you finish, check
that the target exists. Never link to a file you have not confirmed.

**Why.** These docs are read on GitHub and in an editor, from the repository — an absolute `/docs/…`
link or a wrong `../` count breaks both. A broken cross-link is worse than no link, because it looks
authoritative.

**Evidence.** The suite's own link checker resolves every relative markdown link and every intra-doc
anchor: [`docs/_staging/tools/check-docs.mjs:161-193`](../../docs/_staging/tools/check-docs.mjs#L161-L193).

**Enforced by.** tool — `node docs/_staging/tools/check-docs.mjs` reports `BROKEN` per link.

### G2. Cite evidence as `path/to/file.ext:line`

**Rule.** For any non-obvious claim, add the source inline as a repo-relative `file:line` citation
in inline code, e.g. `backend/services/scoring_service.py:80`. Prefer a specific line over a whole
file.

**Why.** A citation is what lets a reviewer verify or falsify a claim in seconds instead of
re-reading the codebase. This suite is audited by spot-checking citations.

**Evidence.** The convention is applied throughout, and the checker counts citations per document
([`docs/_staging/tools/check-docs.mjs:129`](../../docs/_staging/tools/check-docs.mjs#L129)).

**Enforced by.** tool — the checker counts citations; whether they are *correct* is verified by
review.

### G3. Never commit a secret value

**Rule.** Do not commit `backend/.env`, `frontend/.env.local`, or any real key, token or password —
including a publishable/anon key. Documentation shows placeholders such as
`https://<project-ref>.supabase.co` and `<service-role-key>`, and names the *variable*, never its
value.

**Why.** The service-role key bypasses Row Level Security entirely. Even a genuinely public
publishable key must not be reproduced, because the suite cannot tell at a glance which key it is
looking at.

**Evidence.** `.env` files are ignored by [`.gitignore:3`](../../.gitignore#L3) and
[`frontend/.gitignore:12-13`](../../frontend/.gitignore#L12-L13), and the `SUPABASE_SERVICE_KEY` on
Render is declared `sync: false` so it is set in the dashboard
([`render.yaml:14-15`](../../render.yaml#L14-L15)). The checker enforces five secret patterns,
including Supabase JWTs and `sb_publishable_`/`sb_secret_` keys
([`docs/_staging/tools/check-docs.mjs:70-77`](../../docs/_staging/tools/check-docs.mjs#L70-L77)).

> ⚠️ **Known exception in the repo.** A hardcoded **e2e test-account password** is committed in
> [`.e2e/_harness.mjs:47`](../../.e2e/_harness.mjs#L47). It is a test-only account and is listed
> here so it is not mistaken for an approved pattern — do not add more credentials to tracked files,
> and never reproduce the value outside that file.

**Enforced by.** tool for `docs/` (the checker's secret scan); review everywhere else. `git status`
before committing is the practical check.

### G4. One term per concept — the glossary is the authority

**Rule.** Use the exact canonical term, and never a synonym. Every domain term is defined once in
[`docs/10-project/glossary.md`](../10-project/glossary.md), which is the authority the rest of the suite points at.
The canonical choices are: **literal** (not "variable"), **term**/**clause** (not "factor group"),
**product**/**sum** (not "AND-block"), **SOP**/**POS**, **dual** (not "mirror"), **law id** (not
"law name"), **step** (not "move"), **intermediate state** (not "mid-state"), **AST** (not "parse
tree"), **step-locking** (not "locking"), **engine contract**, **tutor**/**learner**.

**Why.** Eight people wrote this suite in parallel, and a concept with two names reads as two
concepts. The UI's own strings are the one exception: quote them verbatim and use the canonical term
in the surrounding prose.

**Evidence.** The canonical table and its rationale are in
[glossary.md](../10-project/glossary.md#canonical-terminology-use-this-not-that); the term authority is stated at
[`docs/README.md:228-229`](../../docs/README.md).

**Enforced by.** review.

### G5. Every document opens with "What this is / Who it's for"

**Rule.** Start a document with a two-to-four line preamble naming what it is and who should read
it, and give anything longer than ~200 lines a `## Contents` list.

**Why.** Each document may be someone's first — a reader should not have to infer the audience, and
a long reference needs to be navigable without scrolling.

**Evidence.** The convention is followed by this suite's documents, e.g.
[`docs/README.md:14-20`](../../docs/README.md), [`file-map.md`](../10-project/file-map.md),
[`glossary.md`](../10-project/glossary.md).

**Enforced by.** review.

### G6. Tag every code fence with its language

**Rule.** Use `python`, `js`, `jsx`, `bash`, `sql`, `json`, `text` or `mermaid` on every fence.
PowerShell and POSIX shell get separate fences.

**Why.** Untagged fences lose syntax highlighting and cannot be validated — in particular, the
checker reads the first line of every `mermaid` fence to confirm it opens with a real diagram
keyword.

**Evidence.** [`docs/_staging/tools/check-docs.mjs:228-249`](../../docs/_staging/tools/check-docs.mjs#L228-L249)
validates mermaid fence heads and reports unclosed fences.

**Enforced by.** tool for mermaid fences; review for the rest.

### G7. Document the code, not the proposal

**Rule.** When `docs/context.md` (or any legacy document) disagrees with the code, document the
**code** and record the disagreement in the discrepancy register. Never copy a stale claim forward
because it is written down.

**Why.** `docs/context.md` is a proposal written before most of the application existed; large parts
of it are false (it describes an unintegrated database, no auth, missing pages, 3 levels with 6
puzzles, and an unplayable Level 3). The legacy files are kept as historical inputs, not as truth.

**Evidence.** The register of proposal-vs-code discrepancies lives in
[`docs/07-explanation/known-limitations.md`](../../docs/07-explanation/known-limitations.md), and the
"read the new suite, not the legacy files" note is at
[`docs/README.md:186-197`](../../docs/README.md).

**Enforced by.** review.

### G8. Mark what you could not verify

**Rule.** If you cannot confirm something in code, write
`> ⚠️ Unverified — could not confirm in code.` and say so. Never guess and never present an
inference as a fact.

**Why.** In this suite, an explicit gap is cheap; a confident wrong number propagates into every
document that cites it. (During the writing of this suite, an unchecked "48 puzzles" figure had to be
corrected to the real 40 in four places.)

**Enforced by.** review. This page uses the same marker for its own gaps — see
[C3](#c3-law-ids-are-the-join-key-between-content-engine-and-storage) and
[G3](#g3-never-commit-a-secret-value).

---

## H. What is actually enforced, and by what

This table exists so nobody assumes a safety net that is not there.

| Rule | Enforced by | Check |
|---|---|---|
| B1 no `fetch` outside `apiClient.js` | review, one-command verifiable | `grep -rn "fetch(" frontend/src/` → 1 line |
| B2 engine purity | review | `grep -rnE "fetch\(\|window\.\|document\.\|localStorage" frontend/src/engine/` → nothing, and `grep -rnE "^import .* from '[^.]" frontend/src/engine/` (excluding `__tests__`) → nothing |
| B6 component/hook file split | tool (warning) | `npm run lint` (react-refresh) |
| C4 engine is the sole authority on legality | tool (partial) | `npm test` — soundness property test |
| D5 authored puzzles are solvable and optimal | tool (partial, generated puzzles only) | `node .e2e/generator-stress.mjs` |
| F1 engine tests pass | tool, when run | `npm test` → 81/81 |
| F3 browser suites pass | tool, when run | `bash .e2e/run-all-suites.sh`, then read `.e2e/_results/*.log` |
| G1 links resolve | tool | `node docs/_staging/tools/check-docs.mjs` |
| G3 no secrets in `docs/` | tool | same checker, secret scan |
| G6 mermaid fences valid | tool | same checker |
| **A1–A7 backend layering** | **review only** | — |
| **C1 backend never re-implements algebra** | **review only** | — |
| **C2 `content/*.json` is the single source** | **review only** | — |
| **C3 law ids match between content and engine** | **review only** | no parity test exists |
| **D1–D4, D6 content shape rules** | **review only** | no schema validation exists |
| **E1–E8 naming conventions** | **review only** | — |
| **G2, G4, G5, G7, G8 documentation rules** | **review only** | — |

### Two facts you should know before relying on the rules above

1. **There is no CI.** `git ls-files` contains no `.github/`, no workflow file, no pipeline config.
   Every check in the "tool" rows is something a human must remember to run.
2. **The layering rules are not lint-enforced.** `frontend/eslint.config.js` enables
   `js.configs.recommended`, `react-hooks` and `react-refresh` only — there is no
   `no-restricted-imports` and no boundary plugin. The engine's own comment is candid about this:
   the layering rule is "enforced by review, not by the bundler"
   ([`frontend/src/engine/index.js:9`](../../frontend/src/engine/index.js#L9)).

---

## I. Adding or changing a rule

1. **Find the evidence first.** A rule without a `file:line` is a preference. If you cannot point at
   the code that already does it, either the rule describes a change you have not made yet (say so),
   or it does not belong here.
2. **Give it a number** in the right section, and state the **Enforced by** line honestly. Marking
   something as tool-enforced when it is not is the most damaging error you can make on this page.
3. **If it is review-only and matters, consider making it cheap to check** — a one-line `grep`, or a
   test. `C3` (law-id parity) and `D1` (puzzle key shape) are the two highest-value candidates:
   both are currently unverified and both fail silently.
4. **Update the term in [glossary.md](../10-project/glossary.md)** if the rule introduces a new concept, and add
   the new rule to [H](#h-what-is-actually-enforced-and-by-what).
5. **Log it** in [changelog.md](../10-project/changelog.md) so the rule's arrival is traceable.

---

**Related:** [glossary.md](../10-project/glossary.md) for every term used here ·
[file-map.md](../10-project/file-map.md) for where each rule's evidence lives ·
[boolean-laws.md](../06-reference/boolean-laws.md) for the law ids referenced throughout.
