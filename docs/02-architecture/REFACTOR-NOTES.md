# REFACTOR-NOTES — Why the Architecture Is Shaped This Way

**What this is.** The reconciliation between the repository's pre-existing refactor write-up
([`REFACTOR_REPORT.md`](../REFACTOR_REPORT.md), a frozen historical input) and the tree as it
exists **now**. It explains the layer rationale, the engine contract, what the refactor
consolidated, and — importantly — where the report and the current code have drifted apart
since it was written.

**Who it's for.** A developer who has read [SAD.md](SAD.md) and is about to move code around.
Knowing *why* a boundary exists is the difference between refactoring around it and
accidentally deleting it.

> **Read this with one eye on the drift.** [`REFACTOR_REPORT.md`](../REFACTOR_REPORT.md) was
> written at the end of the restructure, before several later passes. Its structure section is
> still accurate; its **counts are stale**. §7 is the itemised reconciliation. Where the two
> disagree, this document and the code win.

---

## Contents

1. [The refactor in one paragraph](#1-the-refactor-in-one-paragraph)
2. [Layer rationale — backend](#2-layer-rationale--backend)
3. [Layer rationale — frontend](#3-layer-rationale--frontend)
4. [The engine contract](#4-the-engine-contract)
5. [What was consolidated](#5-what-was-consolidated)
6. [What was deleted, and what came back](#6-what-was-deleted-and-what-came-back)
7. [Reconciliation: report claims vs the current tree](#7-reconciliation-report-claims-vs-the-current-tree)
8. [What the refactor did not fix](#8-what-the-refactor-did-not-fix)
9. [Keeping the shape](#9-keeping-the-shape)
10. [Known discrepancies affecting this document](#10-known-discrepancies-affecting-this-document)

---

## 1. The refactor in one paragraph

[`REFACTOR_REPORT.md`](../REFACTOR_REPORT.md) §1 records the problem: four files doing several
jobs (`ProblemPage.jsx` at 2,631 lines, `InteractiveTutorial.jsx` at 1,594,
`AnimationOverlay.jsx` at 1,086, `lib/laws.js` at 844), the same content stored twice in two
languages (`frontend/src/lib/gameData.js` 743 lines byte-identical to
`backend/data/levels_data.py` 620), business logic inside HTTP handlers, components calling
`fetch` directly, every `useProgress()` call holding a private copy of state, and the same
constants retyped in two to four places each.

The response was a **five-layer split on each side** with a documented, review-enforced import
rule, both content copies deleted in favour of one JSON source, and every tunable number moved
into one config module per side. The report's own framing is the right one: "the shape" is what
matters, and the shape is still intact. The numbers around it are not (§7).

## 2. Layer rationale — backend

```
main.py → api/routes → services → repositories → supabase_client
                ↘ core/ (errors, responses, security, middleware, logging)
                ↘ config/ (settings, constants)   ← available to every layer
```

**Why five layers instead of a flat `routers/`.** The report's §1 symptom —
"Business logic in HTTP handlers: `routers/score.py` computed scores; `routers/progress.py`
issued Supabase queries" — is the specific defect the split removes. Each layer now answers
exactly one question:

| Layer | The one question it answers | It is a bug if it… |
|---|---|---|
| `main.py` | What is the application made of? | contains an `if` about data |
| `api/routes/` | What does the wire look like? | computes a score or writes a query |
| `services/` | What are the rules? | imports `Request`, `Depends`, or `HTTPException` |
| `repositories/` | Where does the data live? | decides an HTTP status |
| `supabase_client.py` | How do I speak PostgREST? | knows a table name or a rule |
| `core/` | What is true of every request? | imports a service |
| `config/` | What is configurable? | imports anything project-specific |

**Why the direction is strictly downward.** A cycle would make the layers decorative. Today
the only upward reference in the stack is unavoidable and isolated:
`core/security.py:14` imports `supabase_client` because verifying a bearer token *is* a
Supabase call. Routing that through a service and a repository would add two pass-through
layers to move one function call.

**Why `core/` and `config/` are cross-cutting rather than layers.** Errors, the response
envelope, the request-id middleware and the logging formatter must be reachable from every
layer without a layer being able to change their meaning. `core/errors.py` defines the closed
code vocabulary (`:11-21`); `core/responses.py` renders it (`:24-59`). A route never builds a
JSON body by hand.

**Why the order of the two `add_middleware` calls is load-bearing.**
`backend/main.py:27-36` adds `RequestContextMiddleware` first and `CORSMiddleware` second, so
Starlette's last-added-is-outermost rule puts CORS on the outside. The comment in the source
states the reason: CORS headers must land on **every** response, including the 500 envelope
that the request middleware produces. Reordering those two lines silently breaks CORS on
error responses.

**What the backend deliberately does *not* have.** No `app/` package (the task brief calls it
`app/core`, `app/services`, `app/routers`, `app/schemas` — none exist [D17]); no ORM; no
`dependencies.py`; no `models/`; no database layer beyond the adapter, because there are two
verbs and six queries.

## 3. Layer rationale — frontend

```
config/  ←  engine/  ←  state/  ←  pages/ & components/
              ↑            ↑
           content/     services/  → config/
        hooks/ → config/   (UI mechanics, imported by components)
```

**Why `engine/` is pure and separate.** The report's §1 records `lib/laws.js` at 844 lines
with the algebra mixed into UI concerns. Extracting it turned the hardest part of the product
into 23 modules whose only external import is a constants object, which is what makes 76 tests
run in plain Node with no browser and no backend. The rule is stated in the barrel itself:
"nothing in `engine/` may import from `components/`, `screens/`, `state/`, `services/` or
`hooks/`" (`frontend/src/engine/index.js:8-10`).

**Why `state/` is its own layer instead of living in components.** The report's §1 symptom —
"State copied per component: every `useProgress()` call kept its own `useState` copy of
points/scores" — is fixed by `state/progressStore.js`. The store's header comment records the
user-visible bug precisely: "earning points on the puzzle screen did not update the points chip
behind it until a reload" (`frontend/src/state/progressStore.js:8-9`). A module-level store
plus `useSyncExternalStore` gives every screen the same instance without introducing a state
library.

**Why `services/` is the only network boundary.** Before the split, "`fetch` + auth headers +
error handling [were] re-derived per call site". Now every request goes through
`apiRequest` (`frontend/src/services/apiClient.js:56`), so `auth` and `silent` are decided in
one place. Components never call `fetch`; they call one service module or a `state/` hook that
wraps it.

**Why `hooks/` is separate from `state/`.** `state/` holds *what is true* (progress, the
session, the current derivation). `hooks/` holds *how it is presented mechanically* (device
tier, popup collision placement, drag gestures, overlay composition). The 8 hooks import only
`config/` and React — no algebra, no network.

**Why `pages/` holds composition roots rather than rules.** `ProblemPage` computes ~15 tier
booleans from one hook and renders; the rules it used to contain now live in
`components/puzzle/usePuzzleSession.js` and `state/useGameState.js`. That is why a 521-line
page is still readable — it composes, it does not decide.

**One documented deviation from the layer rule.** `docs/ARCHITECTURE.md` §4 states
"`services/` imports `config/` only", but `frontend/src/services/contentApi.js:10` imports
`../content/gameContent.js`. The deviation is real and defensible: `content/` is static data
that the API also serves, not a component or a stateful module. It is recorded in
[SRS.md](../01-product/SRS.md) §9 as a known gap rather than quietly tolerated.

## 4. The engine contract

[`ARCHITECTURE.md`](../ARCHITECTURE.md) §5 names it and
[`REFACTOR_REPORT.md`](../REFACTOR_REPORT.md) §6.8 restates it ("No Boolean engine on the
backend, on purpose … If a third consumer ever needs the algebra, extract a shared package
instead of porting it"). The full statement is in [SAD.md](SAD.md) §6; the *reasoning* is here.

**The decision.** There is exactly one Boolean engine, in JavaScript, at
`frontend/src/engine/`.

**Why it had to be JavaScript.** The learner interacts with the expression: every click runs
selection analysis, every law application runs a rewrite plus a completion check, and the
sandbox validates input on a 300 ms debounce. Those operations must be local to be
interactive. A server round trip per click is not a slower version of this design; it is a
different product.

**Why the backend therefore has no algebra.** Once the engine is in the browser, a Python
implementation would be a *second* implementation of the same rules. Two implementations of
Boolean algebra drift, and the drift is invisible until a learner finds a puzzle where the two
disagree. The report's test evidence shows how seriously this is taken: the engine
fingerprint was required to be **byte-identical** across the refactor in both default and
`--expand` modes, precisely because algebra correctness is the thing that cannot be allowed to
move.

**What the backend needs instead is arithmetic, not algebra.** The one rule duplicated on
purpose is the score formula:

| Side | Module | Role |
|---|---|---|
| Authoritative | `backend/services/scoring_service.py:32` | Produces the score that is displayed finally and persisted |
| Instant mirror | `frontend/src/engine/scoring.js:54` | Renders a breakdown at 0 ms, and keeps working offline |

Their constants live in `backend/config/constants.py` and
`frontend/src/config/gameRules.js` respectively, and `frontend/src/engine/scoring.js:1-13`
states the lockstep requirement explicitly. The mirror is not drift-free: Python's `round()` is
banker's rounding and JS `Math.round` is half-up, so at exact `.5` totals the two disagree
[D21].

**Where the boundary actually sits.** It is a **trust boundary, not a verification boundary**.
The backend is authoritative for *scoring*; it is not authoritative for *algebra*. It accepts
`stepsUsed`, `lawsUsed`, `hintsUsed` and `optimalSteps` as submitted and never re-derives the
derivation. That is the reason `POST /api/score` can be left unauthenticated — it computes a
number from content plus inputs — while the two progress routes require a bearer token. It is
also why a modified client can score 100 on an unsolved puzzle. See
[known-limitations.md](../07-explanation/known-limitations.md).

## 5. What was consolidated

Each row is a "one X" the refactor created, with the current evidence that it still holds.

| Consolidated into | Replaced | Evidence now |
|---|---|---|
| **One content source**: `content/laws.json` + `content/levels.json` | `frontend/src/lib/gameData.js` (743 lines) and `backend/data/levels_data.py` (620), byte-identical | Read by the API at `backend/repositories/content_repository.py:16` and bundled by Vite via the alias at `frontend/vite.config.js:16`, imported at `frontend/src/content/gameContent.js:14` |
| **One law identity table**: `engine/laws/definitions.js` | law names/formulas retyped in builders, reference cards, hints, and two copies of a `nameToId` map inside the puzzle screen | `LAW_DEFINITIONS` (`:29-54`) is the single list; `LAW_NAME_TO_ID` is derived from it (`:63`); `defineLaw(name, form)` throws on an unknown pair (`:79`) |
| **One scoring constants module per side** | 40/30/30 in two files, 90/75 in two, the 80 % gate in three, 10/20/5 points in four | `frontend/src/config/gameRules.js:14-49`; `backend/config/constants.py:9-26` |
| **One API client**: `services/apiClient.js` | `fetch` + auth headers + error handling re-derived per call site | `apiRequest` (`:56`) is the only `fetch` in `frontend/src/` |
| **One progress store**: `state/progressStore.js` | every `useProgress()` call holding its own `useState` copy | The module-level store plus `useSyncExternalStore` (`frontend/src/state/useProgress.js:24`); the only writer is `update` (`progressStore.js:60`) |
| **One tuning surface per side**: `config/gameRules.js` | literals inline at call sites | Now holds scoring, progression, `TIMING`, `TUTORIAL`, `DRAG`, `SANDBOX`, `SOUND`, `SOLVER_BUDGET` (`:14-181`) |
| **One storage-key module**: `config/storageKeys.js` | five keys inline across five files | Six keys now, all in one file (`:10-28`) |
| **One outbound-link module**: `config/appLinks.js` | the survey URL inline | `:9` is the only place the URL exists |
| **Shared UI components** | law drawer / law card / replay modal / star rating / gate bar / points chip / spinner / header copied between the two level screens | `components/laws/`, `components/ui/`, `components/layout/`, `hooks/usePageOverlays.js`, `hooks/useTutorialReplay.js` |
| **Shared auth form components** | auth card, email/password field, reveal toggle, submit button copied between login and register | `components/ui/AuthCard|AuthTextField|PasswordField|SubmitButton.jsx` |
| **One animation style module** | ghost-text and shockwave inline styles repeated across 8 law animations | `components/animations/animationStyles.js`, with one module per law plus a dispatcher (`animations/index.js:30`) |
| **One requirement file** | root and backend `requirements.txt` byte-identical | root is a one-line shim: `-r backend/requirements.txt` |
| **One README** | two READMEs restating the same setup | root `README.md`; the setup guide is not duplicated |

**A consolidation that matters for correctness, not just tidiness.** Scattering the 80 %
unlock threshold across three files is how a product ends up with a UI that says 70 in one
place and enforces 80 in another. The proposal did exactly that: `context.md` §7 says 70 %
while `gameRules.js:49` and `constants.py:26` both say 80 [D9].

## 6. What was deleted, and what came back

Deleted (verified absent now): `backend/data/levels_data.py` + `data/__init__.py` (621),
`frontend/src/lib/gameData.js` (743), `frontend/src/lib/{expr,laws,solver,sandboxInput,randomPuzzle,sandboxPool}.js`
(2,525, split into `engine/`), `frontend/src/hooks/{useApi,useProgress}.js` (447),
`frontend/src/utils/supabase.js` (6), `App.css` (184), the old `index.css` (444),
`backend/routers/*` + `auth_middleware.py` (300), 8 unreferenced keyframes and 17 unused CSS
variables, 10 scratch e2e scripts, screenshots and run logs, plus the dead declarations
`tokenBaseStyle`, `MIN_TAP`, `shockColor`, unused `earliest`/slice and write-only
`earnedPoints`/`toastMessage`.

**One deletion needs a warning.** The report lists `frontend/src/hooks/{useApi,useProgress}.js`
(447 lines) as deleted. A file called `state/useProgress.js` **exists today** — 79 lines — and
it is a *different thing*: the React binding for the shared store rather than a
self-contained hook with its own state. Do not read the deletion entry as "this was reverted".

**The cleanliness pass left one cosmetic residue.** `REFACTOR_REPORT.md` §5b records deleting
the dead export `definitionsForId`. It is gone (0 occurrences), but its doc comment survived
and now dangles at `frontend/src/engine/laws/definitions.js:67`:

```js
/** Definitions grouped by reference-card id, in declaration order. */
/**
 * Looks up the identity of a law by the name the engine emits and the form it
 * was found in.
```

The first line documents a function that no longer exists. Harmless, but it is the kind of
thing that makes a reader think a symbol is missing.

## 7. Reconciliation: report claims vs the current tree

Every row was checked against the working tree. **Status** is `agrees` (the report still
describes the code), `stale` (true when written, false now — the report simply predates later
passes) or `wrong` (the report was inaccurate when written and still is).

| # | `REFACTOR_REPORT.md` claim | Current tree | Status |
|---|---|---|---|
| 1 | §2: `engine/` module list, layering rule, `index` barrel | Matches: 23 modules / 3,182 lines, barrel at `engine/index.js`, layering rule stated at `index.js:8-10` | agrees |
| 2 | §2: `content/` is "ONE source, served by the API and bundled by the app" | Matches (`content_repository.py:16`, `vite.config.js:16`) | agrees |
| 3 | §2: backend shape `main.py · config/ · core/ · api/{routes,schemas}/ · services/ · repositories/` | Matches exactly — 28 modules / 1,241 lines | agrees |
| 4 | §2: `frontend/src/state/` = progressStore, useProgress, useGameState, useGameContent | 8 files: those four plus `AuthProvider.jsx`, `authContext.js`, `useSession.js`, `hintText.js` (1,217 lines) | stale — the report's list is incomplete |
| 5 | §2: `frontend/src/services/` = apiClient, contentApi, scoreApi, progressApi, authActions, supabaseClient | 7 files: those six plus `soundEffects.js` (155 lines, Web Audio cues) | stale — missing `soundEffects.js` (which `ARCHITECTURE.md` §"services/" does list) |
| 6 | §2: `frontend/src/config/` = `gameRules.js · storageKeys.js` | 3 files: those two plus `appLinks.js`; `gameRules.js` also carries `SOUND`, `DRAG`, `SANDBOX`, `SOLVER_BUDGET` (181 lines) | stale |
| 7 | §2: `hooks/` not listed in the shape block at all | 8 files / 1,276 lines — device tier, collision placement, drag, overlays | stale — omitted |
| 8 | §2: `pages/` = "one file per route screen" | 7 pages / 2,103 lines for 9 routes (ProblemPage serves two) | agrees |
| 9 | §5: "engine unit tests … **46/46**" | **76/76 pass** (`npm test`, 7 files / 1,246 lines, ~10.7 s) | stale — this is the origin of the "46 tests" figure in `context.md` §3 [D11] |
| 10 | §3: the two level screens reached "400+396 … for 381+376" | `LevelSelectPage.jsx` **440**, `StageSelectorPage.jsx` **387** | stale — both grew again after the report |
| 11 | §5b: "largest: `state/useGameState.js` 589, `pages/ProblemPage.jsx` 509" | `useGameState.js` **620**, `ProblemPage.jsx` **521**; `useCollisionPlacement.js` still **407** | stale for two, agrees for one |
| 12 | §5b: "Six files still over 250 lines" | **17** `.js`/`.jsx` files over 250 lines in `frontend/src/` | stale — the count tripled, partly because 7 test files and `tutorialContent.js` are new |
| 13 | §5: "Lint: **22 findings** across `src/`" with `react-refresh/only-export-components` 4 and `no-unused-vars` 4 | **16 findings (11 errors, 5 warnings) across 8 files**: `react-hooks/set-state-in-effect` 9, `react-hooks/exhaustive-deps` 5, `no-unused-vars` 2. **Zero** `react-refresh` findings | improved — the `authContext.js` split removed the react-refresh class of finding entirely |
| 14 | §3: "the `nameToId` map duplicated inside the puzzle screen … deleted" | Absent; `LAW_NAME_TO_ID` is derived at `definitions.js:63` | agrees |
| 15 | §5b: dead exports `definitionsForId`, `isHydrated`, `HIDE_SURVEY`, and an `export { useDeviceTier }` alias — "Deleted" | All three names have 0 occurrences; `useDeviceTier` has exactly one `export default` | agrees (with the dangling comment noted in §6) |
| 16 | §5b: "the last two kebab-case modules became camelCase" | `config/gameRules.js` and `content/gameContent.js`; no kebab-case module remains in `src/` | agrees |
| 17 | §6.2: "The API now answers `{success, data, error}`; the client unwraps it but still tolerates the old plain shape" | Both paths live: `unwrap` handles the envelope and falls through to the raw body (`apiClient.js:33-45`) | agrees |
| 18 | §6.4: "The database schema is untouched. Guide usage is folded into the existing `hints_used` column" | `persist_score` writes `"hints_used": outcome.assistance_used` where `assistance_used = hints + guides` (`progress_service.py:87`, `:101`; the sum itself is computed at `scoring_service.py:51`) | agrees |
| 19 | §6.8: "No Boolean engine on the backend, on purpose" | No algebra under `backend/`; the engine contract holds | agrees |
| 20 | §5: verification suites named (`verify-sandbox`, `sandbox-ui`, `gameplay`, `tutorial-gate`, …) | All still present in `.e2e/`; the folder now holds 19 `.mjs` — **16 wired + 2 unwired suites + 1 shared harness** (`_harness.mjs`, `gate-fresh-user-check.mjs` and `lead-engine-fingerprint.mjs` are not in `run-all-suites.sh`) | stale in detail |
| 21 | §6.1: Vite `@content` alias, `server.fs.allow`, restart needed | `vite.config.js:16`, `:22`; still true | agrees |
| 22 | §6.3: "upstream Supabase transport errors answer `502 upstream_error`, and missing/corrupt content answers `503 content_unavailable`" | `errors.py:60-73`, `:24-31`; both live | agrees |
| 23 | §6.9: `WelcomeSlide.badge`/`icon` deleted, two welcome-modal strings stay hardcoded | `components/tutorial/WelcomeModal.jsx` (162 lines) still carries literal copy | agrees |
| 24 | §5b: "Six files still over 250 lines … the audit's seams are listed in the review notes" | Superseded by row 12; the "one job per file" principle still holds, the count does not | stale |

### Where the report disagrees with the code — summary

The report's **structural** claims all still hold. Its **quantitative** claims are stale in
five places (rows 9, 10, 11, 12, 13) and its **file inventories** are incomplete in four
(rows 4, 5, 6, 7). Nothing in it is wrong about how the system is shaped.

Two further stale-count sites live outside the report:

- [`ARCHITECTURE.md`](../ARCHITECTURE.md) §1 says `__tests__/` holds "46 node:test unit tests"
  (line 94) and §4 gives `useGameState.js` 589 / `ProblemPage.jsx` 509 — same drift, same
  cause. Both files are frozen historical inputs and were not edited.
- [`ARCHITECTURE.md`](../ARCHITECTURE.md) §5 describes the score endpoint as "persists via
  background task for signed-in learners, **ignoring guides in the assistance total** instead
  of hints only". The code does the opposite: it **folds** guides into the total
  (`scoring_service.py:51` computes the sum; `progress_service.py:101` writes it, and `:116-121` raises the best score). The sentence reads like a typo for "folding
  guides into the assistance total", but as written it contradicts the code and should not be
  quoted. Reported to the documentation Lead rather than edited, because the file is frozen.

## 8. What the refactor did not fix

Carried forward deliberately (the report's §5b "findings reviewed and deliberately left") or
discovered during this documentation pass:

| Item | Why it is still there |
|---|---|
| 9 × `react-hooks/set-state-in-effect`, 5 × `exhaustive-deps` | All pre-existing and all in DOM-measurement or tracking effects. Silencing them would mean restructuring effects, which is a behaviour risk the refactor was not allowed to take |
| `content/laws.json` has an `associative` card the engine never emits | The drawer is a **reference**: it documents laws the tool does not automate. Deleting content is not a code fix |
| Law-id strings inline in `components/animations/index.js` and `LawExplanationCard.jsx` | Deriving them from the table would add indirection for seven literals the definition table already documents |
| Six files over 250 lines (now 17, including tests) | `useGameState.js` is one job — the puzzle session machine — that is simply long; `ProblemPage.jsx` is a composition root; `useCollisionPlacement.js` is mostly verbatim geometry |
| No automated backend test suite | Never existed. `npm test` covers the engine; `.e2e/` covers the browser; nothing covers the API. The single highest-value testing gap in the repository |
| Synchronous PostgREST calls inside `async def` routes | A deliberate consequence of the httpx shim (`supabase_client.py:69`); fixing it means an async client, not a refactor |
| Permissive RLS, no migration tooling, no Docker, no CI | Out of the refactor's scope; each is recorded in [known-limitations.md](../07-explanation/known-limitations.md) |
| One layering exception (`services/contentApi.js` → `content/gameContent.js`) | Defensible as static data, but it is a deviation from the stated rule and is documented as such |
| The win condition is canonical-text equality, not `isEquivalent` | A behaviour, not a refactor defect — but worth knowing before "fixing" a puzzle that will not complete |

## 9. Keeping the shape

The rules are short enough to check by hand in a review:

1. **Backend:** a route never computes; a service never sees `Request`; a repository never
   picks a status code; a query never leaves `repositories/`.
2. **Frontend:** `engine/` imports only `config/` and itself; components never call `fetch`;
   components import the engine only through `engine/index.js`; only `progressStore.js`
   writes progress.
3. **Numbers:** a tunable belongs in `frontend/src/config/gameRules.js` or
   `backend/config/constants.py`, never inline.
4. **Content:** a new level or puzzle is a JSON edit; a new law is JSON **plus**
   `engine/laws/definitions.js` plus the builder that detects it.
5. **Contract:** anything crossing the wire is a number or a string. Never an expression tree.

Cheap verification, no tooling required:

```bash
# engine purity: the only imports outside engine/ should be config/gameRules.js
grep -rn "from '\.\./\.\./" frontend/src/engine --include=*.js | grep -v __tests__

# components bypassing the engine barrel (should print nothing)
grep -rn "from '\.\./engine/[a-z]" frontend/src/components frontend/src/pages

# fetch outside the single API client (should print nothing)
grep -rn "\bfetch(" frontend/src --include=*.js --include=*.jsx | grep -v services/apiClient.js

# a repository that grew a status code (should print nothing)
grep -rn "status_code\|HTTPException" backend/repositories backend/services

# tunables leaking inline (spot check)
grep -rn "90\b\|75\b\|80\b" frontend/src/components/puzzle/ScoreModal.jsx
```

There is no lint rule or CI job enforcing any of the above — it is review-enforced, and the
next section of the report's own list of unresolved items is the evidence that review is
sometimes the only gate.

## 10. Known discrepancies affecting this document

The full register is D0–D23 in
[known-limitations.md](../07-explanation/known-limitations.md). This document's own subject —
the refactor write-up — is one of them.

| ID | This document | The proposal / report says | Resolution |
|---|---|---|---|
| D0 | The tree is the truth; the report is an historical input. | `context.md` presents itself as context. | `context.md` §2, §5, §10, §11, §12 are contradicted by the code. |
| D11 | 76 engine tests. | Report §5: 46/46; `ARCHITECTURE.md:94`: 46; `context.md` §3: 46. | Ran `npm test`: 76/76 pass. §7 row 9. |
| D12 | The law animation is 1350 ms with a 1500 ms tutorial pre-highlight. | `context.md` §8.8: a 2.5-second animation. | `frontend/src/config/gameRules.js:60-62`, consumed at `state/useGameState.js:447`, `:455`. |
| D17 | Backend modules are `backend/{main.py,config,core,api/routes,api/schemas,services,repositories}`. | The brief says `app/core`, `app/services`, `app/routers`, `app/schemas`. | No `backend/app/` exists. |
| D18 | Frontend folders are `services/` and `pages/`; `hooks/` has 8 files. | The brief says `src/api`, `src/screens`, and 9 hooks. | Counted from the tree. |
| D19 | One Render service (backend) plus a Vercel SPA. | `context.md` §12 implies one deployment. | `render.yaml:1-16`, `frontend/vercel.json:1-12`. |
| D21 | The client mirror and the server disagree at exact `.5` totals. | The report §3 says both "read their numbers from config". | True for the numbers, false for the rounding function: Python `round()` vs JS `Math.round`. |
