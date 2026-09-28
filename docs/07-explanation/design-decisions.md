# Design Decisions (ADR log)

**What this is.** The architectural decisions behind Praxis, in Architecture Decision Record
form: each entry states the context, the decision, the alternatives that were rejected, and the
consequences — including the bad ones. [why-this-architecture.md](why-this-architecture.md)
argues *why* the shape is right; this document records *what was decided and when*.

**Who it's for.** Anyone about to reverse a decision. Read the entry first: several decisions
here look like mistakes until you see the alternative they replaced.

---

## Contents

- [ADR-001 — The engine contract: the frontend owns all Boolean algebra](#adr-001--the-engine-contract-the-frontend-owns-all-boolean-algebra)
- [ADR-002 — Scoring is backend-authoritative and client-mirrored](#adr-002--scoring-is-backend-authoritative-and-client-mirrored)
- [ADR-003 — Completion is canonical-text equality, not semantic equivalence](#adr-003--completion-is-canonical-text-equality-not-semantic-equivalence)
- [ADR-004 — State management: a module-level store, not Redux](#adr-004--state-management-a-module-level-store-not-redux)
- [ADR-005 — Progress persistence: local fast path, debounced server save, merge on hydrate](#adr-005--progress-persistence-local-fast-path-debounced-server-save-merge-on-hydrate)
- [ADR-006 — Step-locking: an append-only history array](#adr-006--step-locking-an-append-only-history-array)
- [ADR-007 — One parameterized workspace for graded and sandbox play](#adr-007--one-parameterized-workspace-for-graded-and-sandbox-play)
- [ADR-008 — Orientation enforcement by device tier, with no User-Agent sniffing](#adr-008--orientation-enforcement-by-device-tier-with-no-user-agent-sniffing)
- [ADR-009 — A hand-rolled Supabase REST client instead of the official SDK](#adr-009--a-hand-rolled-supabase-rest-client-instead-of-the-official-sdk)
- [ADR-010 — One JSON content source, read by two consumers](#adr-010--one-json-content-source-read-by-two-consumers)
- [ADR-011 — Two mirrored tuning surfaces instead of one shared one](#adr-011--two-mirrored-tuning-surfaces-instead-of-one-shared-one)
- [ADR-012 — The tutorial is a real level, gated by a route guard](#adr-012--the-tutorial-is-a-real-level-gated-by-a-route-guard)
- [ADR-013 — Verification without a backend test suite](#adr-013--verification-without-a-backend-test-suite)
- [How to add an ADR](#how-to-add-an-adr)

---

## ADR-001 — The engine contract: the frontend owns all Boolean algebra

| | |
|---|---|
| **Date** | 2026-09-27 (from git history: `665efca` "refactor(engine): split the Boolean core into pure single-purpose modules") |
| **Status** | **Accepted** — load-bearing; reversing it changes the product |
| **Supersedes** | Nothing. Superseded by nothing. |

**Context.** Boolean algebra has to run somewhere. The learner's loop is click → *which laws
apply?* → pick → animate → new expression. The sandbox validates as the learner types, on a
300 ms debounce. The solver computes an optimal path when a puzzle loads. Meanwhile the backend
also needs to know the expression's *intended* laws in order to score.

Before the refactor, the algebra lived in `frontend/src/lib/laws.js` (844 lines) mixed with UI
concerns, and the same content existed twice — `frontend/src/lib/gameData.js` (743 lines) and
`backend/data/levels_data.py` (620), byte-identical.

**Decision.** Extract the algebra into `frontend/src/engine/` as 23 pure, framework-free
modules with a barrel export. The backend never parses, rewrites, validates or solves an
expression: it serves content, scores submitted numbers and persists progress. Content stores
expressions as **strings** (`content/levels.json`), and the only parser is
`frontend/src/engine/parser.js`.

**Alternatives considered.**

| Alternative | Rejected because |
|---|---|
| Port the engine to Python and keep both in sync | Two implementations of the same rules drift; the drift is invisible until a learner hits it. This is the decision's whole point. |
| Extract the engine into a shared package (npm workspace, WASM) used by both | One consumer language. A package boundary adds build machinery and an interface to version for no isolation benefit. Revisit only if a third consumer appears. |
| Server-side validation of each step | Turns a sub-frame operation into a network round trip, and makes the sandbox online-only. |
| A general-purpose Boolean CAS dependency | The product teaches ten specific laws and their move set; a general CAS solves puzzles the learner cannot and its labels would not match the reference cards. |

**Consequences — good.**

- One place to add a law (`engine/laws/definitions.js` + a builder); content declares law **ids**.
- The engine is testable in plain Node: 81 tests, no browser, no server, ~13 s.
- Levels and laws render with zero network calls, so gameplay survives a sleeping backend.
- The sandbox can validate, generate and self-check puzzles entirely in the browser.

**Consequences — bad.**

- The backend cannot verify a derivation or a solve. `POST /api/score` trusts its inputs, and a
  modified client scores 100 on an unsolved puzzle [D24]. This is a **trust boundary, not a
  verification boundary**.
- The backend cannot detect an illegal step, so `score_history` is only as honest as the client.
- Verification must be duplicated in shape if not in logic: engine tests in Node, browser suites
  in `.e2e/`, and no test at all for the API ([ADR-013](#adr-013--verification-without-a-backend-test-suite)).

**Revisit if.** Praxis ever grants credit, certification or a grade for progress — then the
derivation must be signed or replayed, or the engine shared rather than ported.

---

## ADR-002 — Scoring is backend-authoritative and client-mirrored

| | |
|---|---|
| **Date** | 2026-09-27 (from git history: `c16410c` "refactor(services): one HTTP client, one module per backend call") |
| **Status** | **Accepted**, with a known rounding defect [D21] |

**Context.** The learner must see a score breakdown the moment they solve a puzzle. The score
is also the durable record of the attempt, drives stars and the 80 % unlock rule, and must not
be a number the client can simply declare.

**Decision.** Two implementations of one formula, on purpose:

- **Authoritative:** `backend/services/scoring_service.py:32` computes the score that is
  displayed finally, stored in `score_history`, and used to raise `stage_progress.best_score`.
- **Mirror:** `frontend/src/engine/scoring.js:54` computes an instant local estimate so the
  completion modal has something to render at 0 ms and keeps working offline.
- Constants live in `backend/config/constants.py` and `frontend/src/config/gameRules.js`.

The mirror's file comment states the lockstep requirement explicitly
(`engine/scoring.js:1-13`).

**Alternatives considered.**

| Alternative | Rejected because |
|---|---|
| Server-only scoring, no local estimate | The modal would have to wait for the network. On a free-tier host that sleeps, that is seconds of blank overlay. |
| Client-only scoring | No durable record, no server-side best score, and a trivially editable ledger. |
| Share one constants file between JS and Python | No build step exists to generate it; a generated file is another artefact to keep current. Mirroring two small modules is cheaper. |

**Consequences — good.**

- Instant feedback, and a solve is never lost to a network failure (`silent: true`).
- One authoritative number for progression: the server can raise a best score but never lower it.
- A weight change is a one-line edit per side, and both sides are named in one place.

**Consequences — bad.**

- **The two disagree at exact `.5` boundaries.** `earned_points` uses Python `round()`
  (banker's rounding); the mirror uses JS `Math.round` (half-up). Of the 19 reachable totals,
  exactly three diverge: **10.0, 50.0 and 90.0** → server 0/2/4 vs client 1/3/5 [D21].
- Because the browser credits its own bonus at solve time while the server's value only replaces
  the *displayed* result, the divergence is not cosmetic: the learner's `user_progress.points`
  gains the client figure while `score_history.earned_points` records the server figure. The
  balance and the ledger permanently disagree.
- Two implementations to keep in step; nothing automated checks that they agree ([ADR-013](#adr-013--verification-without-a-backend-test-suite)).

**Revisit if.** A rounding regression is observed, or the bonus is ever paid out of something
scarce. The cheap fix is to make the server's `earned_points` the only one that is ever added
to the balance.

---

## ADR-003 — Completion is canonical-text equality, not semantic equivalence

| | |
|---|---|
| **Date** | 2026-09-28 (behaviour present at `3838343`; the neighbouring soundness fix is `1c7f932` "fix(engine): decide absorption semantically so a law can never change meaning") |
| **Status** | **Accepted**, documented as a limitation |

**Context.** The engine can prove equivalence: `isEquivalent` compares two trees over every
assignment of their combined variables (`frontend/src/engine/equivalence.js:45`). It is exact
and it is always available. "Is the puzzle solved?" could therefore have been a semantic
question.

**Decision.** It is a **textual** question instead:

```js
const gCanon = canonText(parseExpr(puzzle.goal))   // useGameState.js:84 — once, at load
if (canonText(newExpr) === goalCanonRef.current)   // useGameState.js:481 — the win test
```

`canonText` is order-independent, so reordering terms does not affect the verdict. It is not a
truth-table check. `isEquivalent` is used where *soundness* is at stake — as the deciding
fallback in absorption detection (`engine/laws/helpers.js:82`, `:112`, each behind the Module 4
constant guard) and in the sandbox
builders' pre-flight checks (`engine/sandbox/generator.js:94`,
`engine/sandbox/input.js:161`) — and never in `useGameState`.

**Alternatives considered.**

| Alternative | Rejected because |
|---|---|
| `isEquivalent(newExpr, goal)` as the win test | Correct but slower (2ⁿ evaluations per step) and, more importantly, it would accept a terminal form the learner did not drive the puzzle toward: `x + xy` reaching `x + xy + 0` or some other equivalent oddity would complete. Authored content assumes one target form. |
| Compare `nodeText` (display text) | Not order-independent: reordering a term would un-solve a solved puzzle. |
| Ask the server | A network round trip per step for the single most latency-sensitive check in the app. |

**Consequences — good.**

- Deterministic, cheap, order-independent, and testable without a truth table.
- Authoring stays simple: each puzzle has exactly one intended canonical form.
- It composes with the solver: `findOptimalPath` targets the same canonical form.

**Consequences — bad.**

- **A logically correct but canonically different terminal form does not complete the puzzle.**
  This is a real pedagogical edge case and is asymmetric with the 80 % unlock rule, which does
  not care how the learner got there.
- A step is accepted because a law implementation produced it, not because the rewrite was
  re-proved. Soundness rests on the builders plus the property test
  (`engine/__tests__/law-soundness.property.test.js`).
- Dead-end detection inherits the same character: it is an empty `scanHints` result
  (`useGameState.js:62`, `:548`, `:606`), a statement about the implemented law registry rather
  than a proof of unsolvability.

**Revisit if.** A learner reports a puzzle that will not complete despite a correct answer. The
fix is either to widen the test to `isEquivalent` or to constrain content to one terminal form
per puzzle — both are content-and-engine changes, not a rewrite.

---

## ADR-004 — State management: a module-level store, not Redux

| | |
|---|---|
| **Date** | 2026-09-27 (from git history: `8e3e257` "refactor(state): one progress store shared by every screen") |
| **Status** | **Accepted** |

**Context.** Progress existed in four places at once. The store's own header records the
user-visible consequence: "earning points on the puzzle screen did not update the points chip
behind it until a reload" (`frontend/src/state/progressStore.js:8-9`). Each `useProgress()` call
kept its own `useState` copy and wrote `localStorage` on change without ever re-reading it.

**Decision.** One module-level object, outside React:

```js
export function subscribe(listener)   // :134
export function getSnapshot()         // :139
export function setUser(nextUserId)   // :147 — re-points the store at a learner
export const addPoints / deductPoints / completeStage / completeLevel /
             saveScore / saveSolution / resetStreak / markTutorialSeen / resetLevelProgress
export function getLevelProgress / isStageCompleted / hasSeenTutorial / …   // pure selectors
```

bound to React with `useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)`
(`frontend/src/state/useProgress.js:24`).

**Alternatives considered.**

| Alternative | Rejected because |
|---|---|
| Redux (+ Toolkit) | Store, provider, action types, reducers and middleware to satisfy three properties already satisfied in 337 lines: one shared instance, React can subscribe, mutations are enumerable. |
| Zustand / MobX / Jotai | Smaller than Redux, but the same category of dependency for eight actions. |
| A React Context with `useReducer` | Context re-renders every consumer on any change, and the store must be readable outside React for the gate components. |
| Server state as the source of truth (React Query) | There is exactly one authoritative client snapshot; a query cache would add a second source of truth for the same data. |

**Consequences — good.**

- One instance; the points chip, the stage grid and the gate bars cannot disagree.
- `update` returns early when the updater returns the identical object (`:61-62`), so a worse
  score causes no write.
- Hydration merges instead of overwriting (max/union/local-wins, `:97-130`), so offline play is
  never lost and a new device does not bounce the learner to the tutorial.
- No dependency; the whole store is readable in one sitting.

**Consequences — bad.**

- No devtools, no time-travel, no middleware.
- The store is a **module-level singleton**, so test isolation requires care: a test that mutates
  it affects the next test. Nothing resets it today.
- The action list is exhaustive by convention, not by type: nothing prevents a component from
  writing `localStorage` directly.

---

## ADR-005 — Progress persistence: local fast path, debounced server save, merge on hydrate

| | |
|---|---|
| **Date** | 2026-09-27 (`8e3e257`) with the server sync added around `bbf70f6` "refactor(backend): layer the API into routes, services, repositories, core, config" |
| **Status** | **Accepted** |

**Context.** Progress must survive a refresh (so it cannot be memory-only) and a device switch
(so it cannot be local-only). But it must never block gameplay, and the app must work for a
signed-out visitor.

**Decision.** Two tiers with a merge, not a last-writer-wins sync:

1. **Fast path** — every mutation writes `localStorage` synchronously under
   `praxis_v1_<userId>` (`progressStore.js:69-75`).
2. **Durable path** — for a signed-in, already-hydrated learner, one save is scheduled 500 ms
   after the last change (`:87-94`), coalescing bursts into a single `POST /api/progress/save`.
3. **Hydration** — `setUser(id)` reads local, publishes immediately (so screens paint), then
   loads the server snapshot and **merges** it (`:97-130`, `:158-165`): max for points, best
   streak and best scores; union for completed stages; local wins for solutions.

**Alternatives considered.**

| Alternative | Rejected because |
|---|---|
| Server as the only store | Offline play and first paint would both need the network. |
| Local as the only store | Nothing survives a device switch, which is the reason the API exists. |
| Last-writer-wins sync | A stale device would silently destroy progress made elsewhere. |
| Per-action server writes | Chatty, and a burst of actions would race. |
| A server-side write queue with conflict resolution (CRDT/version vectors) | Far more machinery than a single-user, single-snapshot model needs. |

**Consequences — good.**

- Progress survives a refresh instantly and a device switch eventually.
- A network failure is invisible to gameplay: every call is `silent: true`.
- The merge is monotonic — it can raise a value but never lower it, so playing offline cannot
  regress a server best.
- The race guard discards a response belonging to a previous user (`:159`).

**Consequences — bad.**

- **No integrity checking anywhere.** `POST /api/progress/save` stores whatever the client sends:
  `points: -5`, `stage_idx: -4`, `level_id: 99` and `best_score: 999.9` all parse and are written
  verbatim. The pydantic models have no validators and the schema has no `CHECK` constraints
  [D25].
- `stageScores` is never reconciled against `score_history`, so a fabricated best score persists.
- Two writers of the same concept (client `saveScore`, server `persist_score`) with no shared
  transaction; correctness depends on the merge being monotonic.
- `user_progress.updated_at` is **never refreshed** — no trigger exists and no writer sends the
  column, so it holds the insert time despite its name.

---

## ADR-006 — Step-locking: an append-only history array

| | |
|---|---|
| **Date** | 2026-09-27 (present before the refactor; moved into `state/` by `8e3e257` and split by `25b9bd5` "refactor(puzzle): split the 2.6k-line workspace into one module per concern") |
| **Status** | **Accepted** |

**Context.** A derivation is a sequence of states. The learner needs to undo, to inspect a past
step, and to reorder terms *without* that counting as a step. Allowing edits to a middle step
would create a branch — and a branch has no single derivable "current expression".

**Decision.** The session state *is* the history, and everything else is derived:

```js
const [history, setHistory] = useState([])          // useGameState.js:16  [{expr, step}]
const expr  = history[history.length - 1].expr      // :16  the current state
const steps = history.slice(1).map(h => h.step)     // :17  the derivation
```

Steps are appended only at the end of `applyLaw`, after the animation completes (`:469`). The
only mutations are:

| Operation | Effect |
|---|---|
| apply a law | push one entry |
| `undoAction` | pop one entry and re-evaluate the dead end for the restored expression (`:505-529`) |
| `swapTerms` | replace the **last** entry's expression in place — no new entry, no step (`:567-602`) |
| `loadPuzzle` / `resetPuzzle` | replace the whole history |

Reordering is explicitly not a derivation step: "Drag-and-drop term or factor reorder - no law
applied, no step recorded" (`:566`).

**Alternatives considered.**

| Alternative | Rejected because |
|---|---|
| A separate `currentExpr` plus a `steps` array | Two sources of truth that can desynchronise, and the undo bug is exactly that desync. |
| A tree with parent pointers | Equivalent information, more machinery. |
| Immutable persistent data structures | Unnecessary: histories are short (single digits to low tens) and copied cheaply. |
| Allowing mid-history edits | Creates branches, breaks "the derivation", and makes scoring ambiguous. |

**Consequences — good.**

- Undo is `slice(0, -1)` — impossible to get wrong.
- The step count used for scoring is `steps.length`, so reordering can never inflate it.
- Step inspection indexes straight into the array.
- The dead-end state can be recomputed from any restored expression (`:526`).

**Consequences — bad.**

- A long derivation means an O(n) array copy per step. Irrelevant at these sizes, but it is the
  reason not to allow arbitrary-length practice sessions.
- `swapTerms` mutating the last entry in place depends on `cloneN` preserving node ids, so a
  reorder keeps nodes recognisable to the UI (`engine/node.js:25-35`). A future change to id
  handling would break drag-and-drop subtly.
- History is in memory only; the *saved solution* (`stageSolutions`) is what survives, and it is
  replayed by re-parsing each step's `to` text (`:101-118`).

---

## ADR-007 — One parameterized workspace for graded and sandbox play

| | |
|---|---|
| **Date** | 2026-09-27 (from git history: `82c9077` "feat(puzzle): responsive workspace, collision-aware popups, sandbox wiring"; sandbox entry screens `4dc8627`, `94bf112`) |
| **Status** | **Accepted** |

**Context.** The sandbox needs the same interaction surface as a graded level: select, apply a
law, see the animation, inspect a step, undo, reorder, read the law panel. It differs in five
ways only: where the puzzle comes from, whether the score is submitted, whether progress is
written, whether the Guide costs points, and what the completion modal says.

**Decision.** One component serves both routes, and the mode is the **absence of route params**:

```js
const isSandbox = !levelId && !stageIdx     // usePuzzleSession.js:40
```

`/level/:levelId/stage/:stageIdx` and `/sandbox/play` both render `ProblemPage`. The sandbox
contract lives in one 86-line module, `components/puzzle/sandboxPuzzle.js`: how a typed
expression is resolved from route state or `sessionStorage` (`:81`), the synthetic level stub
(`:17`), and that random mode clears the stored slot (`:46-56`).

**Alternatives considered.**

| Alternative | Rejected because |
|---|---|
| A separate `SandboxWorkspace` component | Duplicates ~1,500 lines of interaction surface and guarantees divergence on the details that matter for consistency. |
| An `isSandbox` prop on the route element | Route params are already the source of truth; a prop could disagree with the URL. |
| `?sandbox=true` on one route | Two routes are clearer in the browser, in the router table and in test selectors. |
| A second route with a wrapper that patches behaviour | Same duplication problem, one layer up. |

**Consequences — good.**

- The sandbox *is* the graded workspace, so a workspace fix fixes both modes.
- The mode cannot desynchronise from the URL.
- The five differences are each one branch, and all sandbox-specific logic is quarantined in
  `sandboxPuzzle.js`.

**Consequences — bad.**

- `ProblemPage` and `usePuzzleSession` must each reason about both modes, so both carry branches
  a single-mode design would not need.
- Sandbox progress *must* be actively suppressed, not merely absent: the completion branch
  returns before any progress write (`usePuzzleSession.js:185-188`). Forgetting that in a new
  effect would silently award points for sandbox play.

---

## ADR-008 — Orientation enforcement by device tier, with no User-Agent sniffing

| | |
|---|---|
| **Date** | 2026-09-27 (from git history: `e33d7b2` "feat(mobile): device tiers, orientation gate and touch-target scale") |
| **Status** | **Accepted** |

**Context.** The workspace is a three-column layout that cannot work on a phone in portrait: the
canvas would be unusably narrow. Two policies were needed — block a phone in portrait, warn on a
small tablet in portrait — and they had to be correct on devices that misreport themselves.

**Decision.** A pure decision function, `detectDeviceTier({width, height, isTouch, orientation,
bannerDismissed})` (`frontend/src/hooks/useDeviceTier.js:57-94`), whose inputs come from
capability probes rather than the User-Agent string:

- **touch** from `matchMedia('(pointer: coarse)')`, `navigator.maxTouchPoints`, and the legacy
  `'ontouchstart' in window` (`:97-108`);
- **orientation** from `screen.orientation.type`, then `.angle`, then legacy
  `window.orientation`, then the viewport aspect ratio (`:115-140`);
- **tier** from width, and *only* for touch devices: a pointer-fine device is `desktop` at any
  width, so a narrow desktop window is never handed a phone layout (`:71-82`).

Enforcement is a single global `OrientationGate` mounted inside `BrowserRouter` so it also covers
public routes (`frontend/src/App.jsx:25`): a blocking overlay for a phone in portrait, a
dismissible banner for a small tablet in portrait, nothing otherwise.

**Alternatives considered.**

| Alternative | Rejected because |
|---|---|
| User-Agent sniffing | Unreliable and increasingly meaningless; a small window on a desktop would be misclassified as a phone. |
| CSS media queries only | A query can restyle but cannot *block* with an explanation, and cannot express the phone/tablet distinction cleanly. |
| Blocking portrait everywhere | A small tablet in portrait is usable with a warning; blocking it would lose users. |
| Asking the user to rotate via a toast | Too easy to miss for a screen that is genuinely unusable. |

**Consequences — good.**

- Testable without a DOM: the decision is a pure function of five inputs; only the probing is
  imperative.
- No misclassification of narrow desktop windows — the tier contract explicitly protects the
  desktop layout at any width.
- The dismissal persists for the browser session only, so the warning returns in a new session
  rather than being silenced forever.

**Consequences — bad.**

- Device *label* and effective layout can disagree: a phone rotated to landscape has a long edge
  over 767 px and is labelled `tablet-sm` by width. `ProblemPage` compensates with an explicit
  `isPhoneLandscape` rule based on the **short** edge (`ProblemPage.jsx:64-69`) — correct, but it
  means the tier label alone is not sufficient for layout decisions.
- The hook throttles through `requestAnimationFrame` with a timer fallback and listens on four
  event sources (`:237-259`), so it is the most intricate hook in the codebase for what is
  conceptually a simple rule.

---

## ADR-009 — A hand-rolled Supabase REST client instead of the official SDK

| | |
|---|---|
| **Date** | 2026-09-27 (`bbf70f6` "refactor(backend): layer the API into routes, services, repositories, core, config"; auth moved to Supabase on 2026-05-24 in `004e0f9` "Migrate to Supabase Auth") |
| **Status** | **Accepted** |

**Context.** The backend needs `SELECT` and `UPSERT` against three tables, and one call to
Supabase Auth to verify a JWT. The official `supabase` Python package "can pull complex
compilation dependencies (pyiceberg / C++ build tools)" (`backend/supabase_client.py:18-19`),
which makes a clean install fragile — precisely the kind of thing that breaks a deploy.

**Decision.** A 102-line adapter over `httpx` implementing exactly what the project uses: `eq`
equality filters and `select`/`insert`/`upsert` with `on_conflict`
(`backend/supabase_client.py:44-65`), plus an async `get_user(token)` against
`/auth/v1/user` with a 5-second timeout (`:87-98`).

**Alternatives considered.**

| Alternative | Rejected because |
|---|---|
| Official `supabase` SDK | Heavy transitive dependency for six queries. |
| `postgrest-py` | The same problem, smaller. |
| Direct `psycopg` and SQL | Needs a database password and a connection pool; loses the platform's token model and adds connection-lifecycle handling to a free-tier service. |
| Generate a client from the OpenAPI schema | New build artefact to keep current for six queries. |

**Consequences — good.**

- `pip install -r backend/requirements.txt` is five unpinned packages and always resolves.
- The repository layer is legible: a query reads as `table(...).select(...).eq(...).eq(...)`.
- The adapter's result object exposes only `.data`, which is all any caller needs.

**Consequences — bad.**

- **Only two verbs.** No `order`, `limit`, `range`, `neq`, `in`, or nested select. Adding one
  means extending the builder by hand.
- **Synchronous by design.** `execute()` uses `with httpx.Client()` (`:69`) inside `async def`
  FastAPI routes, so every progress request blocks the event loop and concurrent requests
  serialise. This is the most consequential accepted tradeoff in the backend.
- A hand-rolled shim is not covered by upstream updates or security fixes.
- The ad-hoc response object (`type('Response', (), {'data': …})()`, `:81`) is deliberately
  minimal, so nothing can accidentally depend on HTTP response metadata.

---

## ADR-010 — One JSON content source, read by two consumers

| | |
|---|---|
| **Date** | 2026-09-27 (from git history: `2934bd1` "refactor(content): one JSON source for laws and levels", followed by `2654243` "chore(backend): delete the data package superseded by content/*.json") |
| **Status** | **Accepted** |

**Context.** Game content existed twice in two languages and was byte-identical: 743 lines of
JavaScript and 620 lines of Python. Two copies guarantee that a puzzle fix lands on one side
only, with a subtle symptom — the API serves the old puzzle while the bundled client plays the
new one.

**Decision.** `content/laws.json` and `content/levels.json`, read by both consumers:

- **API** at runtime: `CONTENT_DIR = Path(__file__).resolve().parents[2] / "content"`
  (`backend/repositories/content_repository.py:16`), cached with `lru_cache`.
- **SPA** at build time: the `@content` Vite alias (`frontend/vite.config.js:16`), imported by
  `frontend/src/content/gameContent.js:14`.

`contentApi.fetchLevel` prefers the bundled level and only calls the API for an id it does not
bundle (`frontend/src/services/contentApi.js:36-60`).

**Alternatives considered.**

| Alternative | Rejected because |
|---|---|
| Keep both copies and add a test that diffs them | A test would catch drift after the fact; deleting one copy prevents it. |
| Content in the database | Content is versioned with the code, reviewed in a diff, and needs no admin UI. |
| Content only in the bundle, served by the SPA | The API needs `targetLaws` to score, and a new level should be reachable without a client rebuild. |
| Fetch content from the API at runtime only | Levels would not render until the network answered — visible on a sleeping free-tier backend. |

**Consequences — good.**

- One edit point for levels, puzzles, hints and law cards.
- Levels and laws render on first paint with no network call, and the app works offline.
- The API remains the fallback for unbundled content, so content can ship ahead of a client.

**Consequences — bad.**

- **`content/` must ship beside `backend/` at runtime**, because the repository resolves
  `parents[2]`. A missing directory makes every content route answer `503 content_unavailable`
  with a message naming the path (`:24-31`) — loud, but a deployment fault nonetheless.
- `lru_cache` means **a content edit needs a process restart**; there is no cache invalidation.
- Two resolution paths to keep aligned: a Vite alias and a relative `Path` walk.
- `@content` sits outside the Vite root, so `server.fs.allow` had to be widened to the repo root
  (`vite.config.js:22`) — a dev-server detail that surprises people.
- Vite inlines content at build time, so a content change still needs a frontend rebuild to reach
  the bundle.

---

## ADR-011 — Two mirrored tuning surfaces instead of one shared one

| | |
|---|---|
| **Date** | 2026-09-27 (from git history: `8da7c1f` "feat(config): one module for game rules and storage keys") |
| **Status** | **Accepted** |

**Context.** Before the refactor the same figures were repeated: "40/30/30 in two files, 90/75 in
two, the 80% gate in three, 10/20/5 points in four, five storage keys inline"
(`frontend/src/config/gameRules.js:3-6`). A scattered threshold is how a UI ends up displaying
70 % while enforcing 80 % — which is exactly what the stale proposal does [D9].

**Decision.** One config module per side, and a explicit mirrored subset that must agree:

| Frontend (`gameRules.js`) | Backend (`constants.py`) |
|---|---|
| `SCORE_WEIGHTS {40,30,30}` `:14` | three weight constants `:9-11` |
| `SCORE_PENALTY {10,10}` `:21` | `STEP_PENALTY`, `ASSISTANCE_PENALTY` `:15-16` |
| `SCORE_BONUS_MAX_POINTS` `:29` | `MAX_BONUS_POINTS` `:19` |
| `STAR_THRESHOLDS` `:38` | `STAR_THRESHOLDS` `:25` (unused server-side) |
| `UNLOCK_AVERAGE_SCORE = 80` `:49` | `UNLOCK_AVERAGE = 80.0` `:26` (unused server-side) |

Everything else is frontend-only: `TIMING`, `TUTORIAL`, `DRAG`, `SANDBOX`, `SOUND`,
`SOLVER_BUDGET` (`:58-181`).

**Alternatives considered.**

| Alternative | Rejected because |
|---|---|
| Generate one constants file from a shared JSON/YAML at build time | A third artefact plus a build step, for ~10 numbers. |
| Have the frontend fetch the weights from the API | Adds a network dependency to the first paint of the score modal, for numbers that change once a year. |
| Duplicate the values with no rule about which pair must agree | This is what caused the original scatter. The mirror is now explicit and documented. |

**Consequences — good.**

- A designer-facing change is one line in one file per side.
- `backend/config/constants.py` documents the progression contract even though it does not read
  it, so the mirrored pair is visible in one screen.
- The 80 % figure now has exactly two homes, both named 80.

**Consequences — bad.**

- **Nothing enforces that the mirrored pair agrees.** There is no test comparing
  `STAR_THRESHOLDS` in Python with `STAR_THRESHOLDS` in JS. A change to one side alone is silent
  until a learner notices a star that should not be there.
- Two of the backend constants (`STAR_THRESHOLDS`, `UNLOCK_AVERAGE`) are **read by nothing**
  server-side, which makes them look authoritative when they are documentation. The unlock gate
  is frontend-only [D26].
- The frontend half is one 181-line module holding unrelated concerns (scoring, timings, audio,
  solver budgets), which is convenient for "where do I change a number?" and awkward for
  anything else.

---

## ADR-012 — The tutorial is a real level, gated by a route guard

| | |
|---|---|
| **Date** | 2026-09-28 (from git history: `54ed140` "feat(progression): gate Level 1 and Sandbox behind full 4-stage tutorial completion") |
| **Status** | **Accepted** |

**Context.** A first-time learner arrives at Level 1 with no idea that a term can be selected as
a whole, that literals can be dragged to reorder, or that a negation is a clickable capsule. The
walkthrough must teach those mechanics — and the cheapest way to teach an interface is to let the
learner use the real interface, on a puzzle that cannot fail.

**Decision.** The tutorial is **level 0** in the same content file — 4 authored puzzles with
normal `expr`/`goal`/`hints` (`content/levels.json`), played on the same workspace. A route guard
enforces it:

- `TutorialGate` sends a learner who has not started the tutorial from `/levels` to
  `/level/0/stage/0?tutorial=true&returnTo=%2Flevels` (`TutorialGate.jsx:56`).
- Levels 1–3 and `/sandbox` require **all four** tutorial stages (`:62-72`).
- The tutorial level itself is exempt, in both route shapes (`:41-43`), so the redirect target is
  always reachable — a deliberate fix for the blank-page bug where navigating to the current URL
  is a React Router no-op.
- The decision waits for `progressHydrated` (`:47`), because deciding on a half-loaded snapshot
  would bounce a returning learner to the tutorial on every new device.

**Alternatives considered.**

| Alternative | Rejected because |
|---|---|
| A separate tutorial UI with its own components | The mechanics being taught *are* the workspace's. A mock UI teaches the mock. |
| An overlay-only tour (spotlight, no puzzle) | Does not teach selection or law application, which are the actual difficulties. |
| A video or a static help page | Not interactive, not trackable, and drifts from the UI. |
| No gate; let learners skip | The report's UI evidence is the reason the gate exists: without it a first-time learner hits Level 1 with no idea how the interface reacts. |
| A hard gate at the router level (redirect before render) | Would make the tutorial URL itself unreachable and re-create the blank-page failure. |

**Consequences — good.**

- The tutorial is authored with the same content schema as every other puzzle, so the content
  tooling (and the engine's optimal-path solver) applies to it unchanged.
- Completion is stored in the ordinary progress snapshot, so it syncs across devices and
  survives a reinstall.
- The tutorial can be replayed from the level and stage screens, and skipped.

**Consequences — bad.**

- **The gate is a UX gate, not a security boundary**: it reads client-side progress and a
  determined learner can bypass it (`TutorialGate.jsx:31-32`). Accepted, because nothing is
  protected but the learner's own experience.
- The return-path logic is genuinely fiddly: it must not loop back to the tutorial itself
  (`:69`).
- The gate's correctness depends on hydration ordering — a subtle coupling between
  `progressStore`'s `hydrated` flag and a route guard, in two different files.
- Level 0 is exempt from the gate, so a learner can always reach the tutorial — which also means
  the tutorial cannot be hidden by configuration.

---

## ADR-013 — Verification without a backend test suite

| | |
|---|---|
| **Date** | 2026-09-27 – 2026-09-28 (engine tests `df6f35d` "test(engine): 46 unit tests for parser, validator, laws, solver and sandbox"; browser suites `bfd2106`) |
| **Status** | **Accepted for the engine and the browser; an acknowledged gap for the API** |

**Context.** `npm test` runs `node --test src/engine/__tests__/*.test.js`. `.e2e/` holds 19
`.mjs` files (16 wired suites, 2 unwired, 1 shared harness) driving a real browser. There is **no
backend test suite**: no `tests/`, no `conftest.py`, no `pytest` dependency.

**Decision.** Verify where the risk is and where it is cheapest:

1. **Engine:** `node:test` unit tests plus a property test for law soundness — 81 tests, no
   browser, no server, ~13 s. This is where the product's actual complexity lives (3,303 lines of
   pure logic), and where a bug is a *wrong answer*, not a broken screen.
2. **Browser:** `.e2e/` suites for the things a unit test cannot see — tutorial gating,
   responsive tiers, popup collision, sandbox writing nothing, real solves on Levels 1–3.
3. **API:** verified by hand. Not automated.

**Alternatives considered.**

| Alternative | Rejected because |
|---|---|
| pytest + `TestClient` for the API | Not rejected on merit — simply not done. This is the gap. |
| Jest/Vitest instead of `node:test` | The engine is pure ESM with no DOM needs; Node's built-in runner needs no dependency and no config. |
| Playwright as a dependency | The suites run against any dev server through a small harness, keeping the app's dependency tree clean. |
| Snapshot tests for the engine | The engine's correctness is semantic, not textual. The fingerprint script (`lead-engine-fingerprint.mjs`) covers "did behaviour change" far better than snapshots. |
| CI to run all of it | No CI configuration exists in the repository. |

**Consequences — good.**

- The engine suite is fast enough to run on every save and needs no environment.
- The property test is the strongest evidence in the repository: it asserts that *no* law changes
  meaning, which is the one invariant a Boolean trainer must never violate.
- The fingerprint baselines let an engine change be diffed for behavioural drift rather than
  merely passing tests.

**Consequences — bad.**

- **Nothing tests the scoring arithmetic.** The 7 engine test files never mention `estimateScore`
  or `earnedPoints`, and the browser suites only assert that a `+N Points` pill renders
  (`.e2e/acceptance-features.mjs:900`). Nothing would catch the D21 rounding regression, and
  nothing verifies the client mirror against the server at all [D27].
- Every backend requirement is verified manually. A change to `scoring_service`, the envelope or
  the 401 path can regress silently.
- The browser suites require a running dev server and a browser, so they are not part of
  `npm test` and are easy to skip.
- Layer rules are review-enforced only: nothing fails the build if `engine/` starts importing
  React.

**Revisit if.** Any of the following happens: the scoring formula changes, a progress-persistence
bug reaches a learner, or the backend grows past a size where manual verification is credible.
The first fix is small and high-value — a pytest suite covering the envelope, the 404/422/401
paths, and the scoring boundary cases, including a test asserting that the client mirror and the
server agree on all reachable totals.

---

## How to add an ADR

Copy the table-and-sections shape above. Keep the entries that matter:

1. **Number and title** — immutable once published; renumbering breaks references.
2. **Date and status** — `Accepted`, `Superseded by ADR-0NN`, or `Rejected`. A rejected ADR is
   still worth keeping, because the alternative will be proposed again.
3. **Context** — the forces, with `file:line` evidence for anything non-obvious.
4. **Decision** — what was done, in the imperative.
5. **Alternatives considered** — at least two, with the reason each lost. This is the part that
   makes an ADR useful; an ADR without alternatives is just documentation.
6. **Consequences** — **both** columns. Every decision here has a real cost, and naming it is
   what stops the next person from "simplifying" it back into the original bug.

The existing decisions are cross-referenced from
[why-this-architecture.md](why-this-architecture.md), [SAD.md](../02-architecture/SAD.md) and
[SDD.md](../02-architecture/SDD.md).
