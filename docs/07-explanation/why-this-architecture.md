# Why This Architecture

**What this is.** The argument behind Praxis's shape. [SAD.md](../02-architecture/SAD.md)
describes *what* the architecture is and [design-decisions.md](design-decisions.md) records
*what was decided*; this document explains **why each choice is the right one for this product**
— and, just as importantly, what each choice costs.

**Who it's for.** A developer who is about to change something structural and wants to know
what they would be breaking. Every section states the claim, the reasoning, the alternatives
that were rejected, and the price paid.

---

## Contents

1. [The shape, in one picture](#1-the-shape-in-one-picture)
2. [Why a layered FastAPI](#2-why-a-layered-fastapi)
3. [Why the engine is pure JavaScript — and why the backend must not re-implement it](#3-why-the-engine-is-pure-javascript--and-why-the-backend-must-not-re-implement-it)
4. [Why repositories](#4-why-repositories)
5. [Why one parameterized ProblemPage](#5-why-one-parameterized-problempage)
6. [Why scoring is backend-authoritative — and what that does not mean](#6-why-scoring-is-backend-authoritative--and-what-that-does-not-mean)
7. [Why Supabase, and the honest state of RLS](#7-why-supabase-and-the-honest-state-of-rls)
8. [Why progression lives on the client](#8-why-progression-lives-on-the-client)
9. [Why a module-level store instead of Redux](#9-why-a-module-level-store-instead-of-redux)
10. [Why one JSON content source read twice](#10-why-one-json-content-source-read-twice)
11. [Tradeoffs accepted, in one table](#11-tradeoffs-accepted-in-one-table)
12. [What would change our mind](#12-what-would-change-our-mind)

---

## 1. The shape, in one picture

```
                    ┌──────────────── the learner's browser ────────────────┐
                    │                                                       │
   selects a node ──►  pages/ProblemPage  ──►  state/useGameState            │
                    │        ▲                      │                       │
                    │        │                      ▼                       │
                    │   components/            engine/  ← ALL the algebra   │
                    │        ▲                      │                       │
                    │        └──── state/progressStore ◄── services/*Api    │
                    └───────────────────────────────────┬───────────────────┘
                                                        │ numbers + strings only
                    ┌───────────────────────────────────▼───────────────────┐
                    │ backend/  routes → services → repositories            │
                    │           content · score · progress                  │
                    └───────────────────────────────────┬───────────────────┘
                                                        │
                                                   Supabase (data + identity)
```

Three separations do all the work: **algebra from presentation** (engine vs components),
**rules from transport** (services vs routes), and **storage from rules** (repositories vs
services). Everything below is an argument for one of those, or for a consequence of them.

## 2. Why a layered FastAPI

**The claim.** The backend must expose three thin capabilities — serve content, score a
puzzle, store progress — and nothing else. A five-layer stack is not over-engineering here; it
is the minimum needed to keep the *rules* out of the *transport*.

**The reasoning.** The pre-refactor backend had the exact failure that layering prevents:
`REFACTOR_REPORT.md` §1 records "Business logic in HTTP handlers — `routers/score.py` computed
scores; `routers/progress.py` issued Supabase queries", and "No service layer — components
called `fetch` directly through a 139-line hook". When a route both parses a request and
computes a score, three things become impossible:

1. **Testing a rule without HTTP.** Today `scoring_service.compute_score` is a pure function of
   six arguments; you can call it from a REPL (this documentation pass did, for eleven cases)
   without a server, a database or a request object.
2. **Changing the storage without changing the rule.** `progress_repository` is the only module
   that names a table (`backend/repositories/progress_repository.py:15-18`). Six queries is
   what "Supabase" means to the rest of the backend.
3. **Changing the transport without changing either.** `POST /api/score` was once the only
   place a score could be produced. Now the route is 29 lines of mapping
   (`backend/api/routes/score.py:27-48`).

**Alternatives rejected.**

| Alternative | Why not |
|---|---|
| Flat `routers/` with helpers | This *was* the code. It is the defect being fixed. |
| Django-style fat models / ORM | There is no model layer to hang behaviour on: the data is two JSON files and three tables with no relations beyond a foreign key. |
| A DDD-style domain package per aggregate | Two aggregates (content, progress) and one pure calculator. The ceremony would exceed the code. |
| GraphQL | Three fixed queries and two mutations, consumed by one first-party client. |

**The price.** Pass-through code. `api/routes/levels.py` is 27 lines that could be 5; a change
to level projection must be made in `content_repository`, not in the route. That is the
intended tax, and it is affordable precisely because the backend is small — 28 modules /
1,241 lines.

**Why `main.py` is assembly and only assembly.** Error handling is the one thing that must be
uniform across every route, so it lives in one place: four exception handlers
(`backend/main.py:39-76`) turn any failure into the same envelope. A route that raises
`NotFoundError` does not decide its status code; `backend/core/errors.py:52-57` does.

## 3. Why the engine is pure JavaScript — and why the backend must not re-implement it

**The claim.** The frontend owns all Boolean algebra. The backend never parses, rewrites,
validates or solves an expression.

**The reasoning, part one: the engine must be local.** The learner's interaction loop is
click → "which laws apply?" → pick → animate → new expression. `analyzeSelection` runs on every
selection; the sandbox validator runs on a 300 ms debounce; the solver computes the optimal path
when a puzzle loads. These are sub-frame operations on plain objects
(`frontend/src/engine/index.js:1-14`). Moving any of them server-side would make the product a
laggy approximation of itself — and in the sandbox's case, impossible, because validation exists
specifically to tell the learner something *while they type*
(`frontend/src/pages/SandboxPage.jsx:117-124`).

**The reasoning, part two: two implementations must drift.** Once the algebra is in the
browser, a Python copy is not redundancy — it is a second source of truth. Two implementations
of `absorption` will eventually disagree on an edge case, and the disagreement is invisible
until a learner hits it. The report's verification regime shows the project treats this as a
hard constraint, not a preference: the engine fingerprint had to be **byte-identical** before
and after the refactor in both default and `--expand` modes, "because algebra correctness is
the thing that cannot be allowed to move".

**What this buys.**

- One place to add a law: `engine/laws/definitions.js` plus its builder. Content declares law
  **ids** in `content/levels.json`; nothing downstream re-derives identity.
- Testable in plain Node. 81 tests, no browser, no server, ~13 s
  (`frontend/package.json:11`).
- The content bundle makes levels and laws render with zero network calls, which is also what
  makes the app usable offline (`frontend/src/services/contentApi.js:22-29`).

**What this costs, stated plainly.** The backend cannot tell whether a submitted derivation was
legal. It also cannot tell whether the learner actually solved the puzzle. Both follow directly
from the decision and are discussed in §6 — they are the *point* of the trust boundary, not an
oversight.

**And the trap in the other direction.** Because the engine is pure and complete, it is tempting
to reach for the most powerful thing in it — `isEquivalent`, an exhaustive truth-table
check — wherever "are these the same?" is asked. The code does **not** do that for the win
condition: completion is `canonText(newExpr) === goalCanonRef.current`
(`frontend/src/state/useGameState.js:481`). `isEquivalent` is used where *soundness* is at
stake — law detection as the deciding fallback (`engine/laws/helpers.js:82`, `:112`, each behind the
Module 4 constant guard) and the
sandbox's pre-flight checks (`engine/sandbox/generator.js:94`, `engine/sandbox/input.js:161`).
The consequence of that split is a real edge case: a terminal form that is logically equivalent
to the goal but renders to different canonical text does not complete the puzzle.

**Alternatives rejected.**

| Alternative | Why not |
|---|---|
| Port the engine to Python and keep both | Two sources of truth for the hardest logic. Rejected on principle. |
| Extract the engine into a shared WASM/JS package used by both | One consumer language. A package boundary adds build machinery and an interface to version for an isolation benefit nobody needs yet. The report's own instruction is to do this *only* if a third consumer appears. |
| Server-side validation of every step | Turns a 0 ms interaction into a network round trip, and the sandbox into an online-only feature. |
| A general Boolean CAS library | The product teaches ten specific laws and their move set; a general CAS would solve puzzles the learner cannot, and its law labels would not match the reference cards. |

## 4. Why repositories

**The claim.** All data access — the two JSON files and the three Supabase tables — lives behind
two repository modules, and nowhere else.

**The reasoning.** There are exactly two storage mechanisms, each with a sharp edge:

| Mechanism | Sharp edge | Where the edge is contained |
|---|---|---|
| `content/*.json` | Must be found relative to the source tree, may be missing at deploy time, and is cached process-globally | `content_repository.py:16` (`parents[2]/"content"`), `:24-31` (503 with a message naming the path), `:34`/`:40` (`lru_cache`) |
| Supabase PostgREST | Transport errors must become a *named* application error, not a 500 | `progress_repository._execute` (`:21-26`) converts `httpx.HTTPError` into `UpstreamError` → 502 |

Both edges are deployment faults, and both are the kind of thing that otherwise leaks into
business logic as defensive `try/except` sprinkled across services. Containing them in one
module per mechanism is what lets `scoring_service` be a pure function of its arguments.

**Why the Supabase client is hand-rolled.** `backend/supabase_client.py:18-19` states it: the
official Python SDK "can pull complex compilation dependencies (pyiceberg / C++ build tools)".
The trade is a 102-line adapter that implements exactly what the project uses — `eq` filters
and `select`/`insert`/`upsert` with `on_conflict` (`:44-65`) — against a dependency that would
complicate every clean install. For six queries, that is the right trade.

**The price.** The adapter cannot express a query it has not implemented: no `order`, `limit`,
`range`, `neq` or nested select. Adding one means extending the builder *and* its tests (of
which there are none — see §11). And because `execute()` uses a synchronous `httpx.Client`
(`:69`) inside `async def` routes, every progress request blocks the event loop. That is the
most consequential accepted tradeoff in the backend.

## 5. Why one parameterized ProblemPage

**The claim.** Graded levels and the sandbox share exactly one workspace component, and the
mode is determined by the **absence of route params**, not by a prop, a flag or a separate
component.

```js
const isSandbox = !levelId && !stageIdx      // frontend/src/components/puzzle/usePuzzleSession.js:40
```

```
/level/:levelId/stage/:stageIdx   →  ProblemPage   (graded: fetch, score, persist)
/sandbox/play                     →  ProblemPage   (sandbox: generated or typed, never scored)
```

**The reasoning.** Everything the learner learns in the levels — select a literal, select a
clause, drag to reorder, click a negation capsule, read the law panel, inspect a past step — is
the same in both modes. A separate sandbox screen would be a second copy of the most
interaction-dense surface in the product, and the two copies would diverge on exactly the
details that matter for consistency: keyboard focus, popup placement, device tiers, undo
semantics, animation sequencing.

The sandbox is instead a *contract* in one 86-line module
(`frontend/src/components/puzzle/sandboxPuzzle.js`): how a typed expression is resolved from
route state or `sessionStorage` (`:81`), what synthetic level metadata the workspace needs
(`:17`), and that a random mode clears the stored slot (`:46-56`). The differences that do
exist are few and explicit:

| Concern | Graded | Sandbox |
|---|---|---|
| Puzzle source | `fetchLevel(levelId)` | generated, or the learner's validated expression |
| Score submission | `POST /api/score` | never — the completion branch returns before it (`usePuzzleSession.js:185-188`) |
| Progress writes | `addPoints`, `completeStage`, `saveScore`, `saveSolution` | none |
| Guide cost | 20 points | 0 (`ProblemPage.jsx:261`) |
| Completion modal | three-metric breakdown | unscored attempt summary (`ScoreModal.jsx:62-104`) |

Five differences, all in one branch each. That is the whole payoff: the sandbox *is* the graded
workspace, so a fix to the workspace is a fix to both.

**Alternatives rejected.**

| Alternative | Why not |
|---|---|
| A separate `SandboxWorkspace` component | Duplicates ~1,500 lines of interaction surface and guarantees divergence. |
| An `isSandbox` prop on the route element | Route params are already the source of truth for identity; a prop could disagree with the URL. Deriving from the URL makes the two impossible to desynchronise. |
| A query parameter (`?sandbox=true`) | Two routes are clearer in a browser, in the router table and in test selectors than one route with a mode flag. |

**The price.** `ProblemPage` and `usePuzzleSession` must reason about both modes, so both carry
branches that a single-mode design would not need. The mitigation is that the sandbox-specific
logic is quarantined: `sandboxPuzzle.js` owns the contract, and `usePuzzleSession` has one
`isSandbox` branch per concern. The alternative — a shared component with a hidden flag — would
be *harder* to reason about, not easier.

## 6. Why scoring is backend-authoritative — and what that does not mean

**The claim.** The **score** is computed and owned by the backend. The score is *not* a
verification of the solve, and the backend is not authoritative for algebra.

This distinction is easy to lose and expensive to lose. Stated exactly:

| The backend IS authoritative for | The backend is NOT authoritative for |
|---|---|
| The final `total`, the three metric bands and `earnedPoints` | Whether the derivation was legal |
| What gets stored in `score_history` | Whether the puzzle was actually solved |
| Raising a stage's `best_score` | The meaning of a law, an expression or equivalence |
| Identity, via bearer-token verification | How many steps a correct solution needs |

**Why the score must be server-side.** Three reasons, in order of weight:

1. **Consistency of the record.** `score_history` is the only durable evidence of what happened.
   If the client computed it, the ledger would contain whatever the client chose, with no
   server-side notion of "the score" to compare against.
2. **One authoritative number for progression.** Stars and the 80 % unlock rule read
   `stageScores`, which the server can raise (`progress_service.persist_score:113-122`). Two
   authors of a best score is already a smell; three would be worse.
3. **The formula changes centrally.** `backend/config/constants.py` is where a weight changes,
   and the client mirror exists only to render instantly.

**Why the client also computes it.** Latency. The completion modal opens 200 ms after the solve
(`TIMING.successModalDelayMs`), and the local estimate fills it immediately
(`usePuzzleSession.js:173`). If the request fails — offline, Render cold start — the learner
still sees a breakdown, and the attempt simply is not persisted. Every score-related call is
`silent: true` for this reason.

**What the trust boundary means in practice.** `POST /api/score` takes
`stepsUsed`, `lawsUsed`, `hintsUsed` and `optimalSteps` as submitted
(`backend/api/schemas/score.py:13-20`). It looks up the puzzle only to read `targetLaws`
(`scoring_service.py:43`, `:46`). It does not replay the derivation, and it cannot: it has no
engine. A modified client can therefore submit `stepsUsed: 1, lawsUsed: ["absorption"]` for an
unsolved puzzle and receive 100.

That is a deliberate position, and the reasoning is: this is a **learning tool, not a
credential**. The cost of defending the score (a server-side engine, or a signed step log) is
much higher than the value of falsifying it to oneself. The consequence is documented, not
hidden — and it is one of the first things to revisit if Praxis ever grants credit for
progress.

**Why `POST /api/score` can be unauthenticated at all.** Because it is a *calculator*, not a
state change. `optional_user` (`core/security.py:38-42`) means a signed-out visitor gets a
score; only a signed-in one gets it persisted (`api/routes/score.py:38-39`). Contrast the two
progress routes, which require a bearer token because they read and write a specific learner's
record. The auth boundary follows the data boundary — which is exactly what you want.

## 7. Why Supabase, and the honest state of RLS

### 7.1 Why Supabase

**The claim.** Supabase is the right fit because it supplies the two things this product needs
that are expensive to build — PostgreSQL and authentication — and nothing else.

**The reasoning.** The data model is three tables with a single foreign key to `auth.users`
(`database/init.sql:7-42`). The auth requirement is email/password with a session. Both are
commodity; building either would be pure cost. Supabase gives them through a REST interface that
`httpx` can call in 60 lines, which also avoids the heavy official SDK (§4).

**Why the SPA talks to Supabase Auth directly but to the API for everything else.** Signing in
is a browser-to-identity-provider exchange; proxying it through the backend would add a hop and
a failure mode with no benefit. Data, however, must go through the backend, because the backend
holds the service key that the browser must never see.

### 7.2 The honest state of RLS

**What the code does.** RLS is **enabled** on all three tables, and each has exactly one policy:

```sql
CREATE POLICY "Service role full access" ON user_progress FOR ALL USING (true);
CREATE POLICY "Service role full access" ON stage_progress FOR ALL USING (true);
CREATE POLICY "Service role full access" ON score_history  FOR ALL USING (true);
```
`database/init.sql:56-58`

**What that actually means.** `FOR ALL USING (true)` is permissive for **every** role,
including `anon`, and there is **no `auth.uid() = user_id` predicate anywhere** in the schema.
The policy is not scoped to `service_role` despite its name. So RLS is *on* but it is not
*protecting* anything [D20].

**Why it is nevertheless not a live vulnerability.** Every data path goes through the backend,
which authenticates the learner and then uses the **service-role key**
(`backend/config/settings.py:61`, `backend/supabase_client.py:26-31`). The browser holds only
the publishable/anon key and never queries a table — `frontend/src/services/supabaseClient.js`
uses the client for `auth` only. The exposure would require someone to call PostgREST directly
with the publishable key, which the shipped app never does.

**Why document it this way.** The original proposal describes RLS as a safety feature. That is
the kind of claim that stops people looking. The truthful statement — "enabled, permissive, and
redundant with the service-key path; not a control" — is what lets a future maintainer decide
correctly whether tightening it is necessary. The `init.sql` comment ("permissive for now —
tighten when auth RLS is set up") shows the intent was always provisional; the intent just never
became a policy.

**What tightening it would look like**, when the time comes: replace each policy with
per-role predicates, e.g. `FOR SELECT USING (auth.uid() = user_id)` plus an insert policy
carrying `WITH CHECK (auth.uid() = user_id)`, and verify that the service-role path still
bypasses RLS as intended. That is a database change only — no application code should need to
move, provided the backend keeps using the service key.

## 8. Why progression lives on the client

**The claim.** Stars, locks, the 80 % threshold and the tutorial gate are computed in the
browser from the progress snapshot. The server stores the snapshot; it does not enforce the
rules.

**The reasoning.** Every one of these decisions is needed *synchronously to render a screen*:
the carousel must know which cards are locked before it paints; the stage grid must know which
stage is available; `TutorialGate` must decide whether to redirect. Making them server calls
would mean either a round trip per screen or a cached duplicate — and a cached duplicate is
what the client-side computation already is.

The rules are also **cheap and total**: `getLevelProgress` is a loop over stage indices
(`frontend/src/state/progressStore.js:291-313`). The whole unlock rule is one expression:

```js
unlocked: allDone && avgScore >= UNLOCK_AVERAGE_SCORE
```

**What keeps server and client honest.** Two things. First, the server *can* raise the truth:
`persist_score` writes `best_score` when the new total is higher
(`progress_service.py:110-122`), and hydration merges server values with max/union semantics
(`progressStore.js:97-130`) — so a learner cannot lower their own best score by clearing local
storage. Second, the constants are duplicated deliberately and mirrored in two config modules
with the same values (80, 90/75, 40/30/30).

**The price, stated honestly.** A client can inflate its own stars and unlock Level 3 early by
editing `localStorage` or POSTing a fabricated snapshot — `POST /api/progress/save` stores what
it is given (`api/schemas/progress.py:11`). This is the same trust boundary as §6 and the same
justification: no credential is at stake. It is recorded as a limitation, not defended as a
feature.

## 9. Why a module-level store instead of Redux

**The claim.** One module-level object with `subscribe`/`getSnapshot` and a set of action
functions, bound to React with `useSyncExternalStore`, is the correct amount of state
management for this product.

**The reasoning.** The bug that motivated it was not "state is hard to manage" — it was
"state exists in four places at once". `progressStore.js` records it: "the level screen, the
stage screen, the puzzle screen and the tutorial gate each had a private copy of points, streak,
scores and completed stages. They only agreed with each other by accident … which meant earning
points on the puzzle screen did not update the points chip behind it until a reload"
(`:1-23`).

The fix needs exactly three properties:

1. **One instance, shared.** A module-level object, not a provider tree.
2. **React can subscribe.** `useSyncExternalStore` is built for this and requires only
   `subscribe` and `getSnapshot` — both three lines.
3. **Changes are enumerable.** Eight actions (`progressStore.js:170-255`) are the entire
   mutation surface, and each is a small pure function of the previous snapshot.

Redux would add a store, a provider, action types, reducers and a middleware chain to satisfy
three properties that are already satisfied in 337 lines. So would Zustand or MobX, with less
ceremony but the same category of dependency.

**What the design gets right that a naive store would not.**

- **Identity changes are explicit.** `setUser(id)` re-reads `localStorage` per learner and
  hydrates from the server once (`:147-166`), with a race guard: a response from a previous
  user is discarded (`:159`).
- **Hydration merges, never overwrites.** Max for points and best streak and best scores, union
  for completed stages, local-wins for solutions (`:97-130`). A learner who played offline does
  not lose progress, and a learner on a new device does not get bounced to the tutorial
  (`frontend/src/components/TutorialGate.jsx:26-29`).
- **No-op updates are free.** `update` returns early when the updater returns the identical
  object (`:61-62`), which is how a worse score avoids a pointless write.
- **Server writes are debounced and gated.** 500 ms coalescing, and nothing at all for a guest
  or before the first server load (`:87-94`).

**The price.** No devtools time-travel, no middleware, no persistence plugin, and the store is
a module-level singleton, which makes test isolation require care (a test that mutates it
affects the next one). For a single-user, single-store, eight-action product, that is the right
trade.

## 10. Why one JSON content source read twice

**The claim.** Levels and laws live in `content/*.json` — once — and are read by the API at
runtime and bundled into the SPA at build time.

**The reasoning.** The alternative was the defect. Before the refactor,
`frontend/src/lib/gameData.js` (743 lines) was a byte-identical copy of
`backend/data/levels_data.py` (620). Two copies of game content is a guarantee that a puzzle fix
lands on one side only, and the symptom is subtle: the API serves the old puzzle while the
bundled client plays the new one, and the score is computed against whichever the server has.

The single source is wired twice, deliberately:

```js
'@content': fileURLToPath(new URL('../content', import.meta.url))   // frontend/vite.config.js:16
CONTENT_DIR = Path(__file__).resolve().parents[2] / "content"        // backend/repositories/content_repository.py:16
```

**Why the SPA prefers the bundle.** `contentApi.fetchLevel` returns the bundled level when it
has one and only calls the API for an id it does not bundle
(`frontend/src/services/contentApi.js:36-60`). This is what makes levels render on first paint
with no network call, and it is also the reason a sleeping Render instance does not block
gameplay.

**Why that is safe.** The API is the fallback, so a newly added level is still reachable without
a client rebuild — the bundled copy is a performance optimisation, not a source of truth the
server lacks. The same files back both.

**The price.** `content/` must ship beside `backend/` at runtime, because the repository
resolves `parents[2]`. That is why `render.yaml`'s `rootDir: backend` works only because the
repo root is the build context. If the directory is missing, every content route answers
`503 content_unavailable` with a message naming the path (`content_repository.py:24-31`) — a
loud, diagnosable failure rather than an empty list. Second price: `lru_cache` means a content
edit needs a process restart to take effect.

## 11. Tradeoffs accepted, in one table

Each row is a decision that buys something real and costs something real. None of them is an
accident.

| Decision | Buys | Costs |
|---|---|---|
| Engine in JS only, never in Python | One source of algebra truth; instant interaction; testable in Node | The backend cannot verify a derivation or a solve; `POST /api/score` trusts its inputs |
| Score computed on both sides | Instant breakdown; works offline | Two implementations of the formula, and they disagree at exact `.5` totals (Python banker's rounding vs JS half-up) [D21] |
| Win condition = canonical text | Cheap, deterministic, order-independent | A logically equivalent but canonically different terminal form does not complete |
| Five-layer backend | Rules testable without HTTP; storage swappable | Pass-through code; an empty route can be 5 lines' worth of intent in 27 |
| Hand-rolled Supabase client | No pyiceberg / C++ build toolchain in a clean install | Only two verbs; no `order`/`limit`/`range`; API surface grows by hand |
| Synchronous repository calls in async routes | Simple code, no async plumbing | Blocking I/O on the event loop; concurrent progress requests serialise |
| `lru_cache` on content | Zero-cost repeat reads | A content edit needs a process restart |
| Import-time settings singleton | A misconfigured deploy fails immediately and visibly | The API cannot boot without Supabase credentials — not even to serve `GET /api/levels` |
| Progression rules on the client | Screens render without round trips | A client can inflate its own stars and unlock early |
| Permissive RLS (`USING (true)`) | Nothing blocks the service-key path | No row-level protection at all; the policy name implies a guarantee it does not provide [D20] |
| Content read twice (runtime + build) | Offline-capable first paint; server remains the fallback | `content/` must ship beside `backend/`; two resolution paths to keep aligned |
| No Docker, no CI, no migration tooling | Nothing to maintain for a two-service deployment | Local setup is manual; nothing verifies a change before it ships; schema changes are hand-run SQL |
| No backend test suite | Nothing to keep green that is not already covered | Every backend requirement is verified manually; a regression there is silent |
| Client `silent: true` on score/progress | A network failure never breaks gameplay | A failed save is invisible to the learner; only the server log records it |
| Server never validates the progress snapshot | `POST /api/progress/save` stays a trivial write | Fabricated points and stars persist |

## 12. What would change our mind

An architecture is a set of bets. These are the conditions under which each bet should be
re-examined — the list exists so the decisions can be revisited on evidence rather than on
taste.

| If this becomes true | Then revisit |
|---|---|
| Praxis grants credit, certification or a grade for progress | Server-side score verification: sign or replay the derivation, or move the engine to a shared package (not a port). The trust boundary in §6 stops being acceptable. |
| Concurrent users become non-trivial, or progress latency is measurable | Make the Supabase client async, or move repository calls to a thread pool. §4's synchronous `httpx.Client` is the bottleneck. |
| Content changes need to ship without a redeploy | Replace `lru_cache` with a TTL cache or a content version, and give the SPA a version check. |
| A third consumer of the algebra appears (a Python batch validator, an LMS import) | Extract the engine into a shared package rather than porting it — the report's own instruction. |
| More than one developer regularly touches `useGameState.js` | Split the session machine: history/undo, assistance, and animation sequencing are three seams already visible in the file. |
| The backend grows past ~2,000 lines | The layer tax starts to dominate. Re-examine whether two bounded contexts would be clearer than five layers. |
| Learners report puzzles that will not complete despite a correct terminal form | Widen the win condition to `isEquivalent`, or constrain content so each puzzle has one terminal canonical form. |
| A real security requirement appears (multi-tenant, sensitive data) | Tighten RLS with `auth.uid() = user_id` predicates, stop using the service key for user-scoped reads, and add an auth integration test. |
