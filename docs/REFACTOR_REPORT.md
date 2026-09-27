# Praxis Refactor — Final Report

Branch: **`refactor/ui/ux`**, branched from the working `sandbox` branch.
**Not merged into `main`** — `main` was never checked out, merged or pushed to.
Commits: **35** — 14 commit the pre-existing uncommitted feature work first (one
feature per commit, as asked), then 21 restructure commits, each with a body
explaining what moved and why.

---

## 1. What the codebase looked like

| Symptom | Evidence before |
|---|---|
| Files doing several jobs | `ProblemPage.jsx` 2,631 · `InteractiveTutorial.jsx` 1,594 · `AnimationOverlay.jsx` 1,086 · `lib/laws.js` 844 |
| Content duplicated across languages | `frontend/src/lib/gameData.js` (743 lines) was a byte-identical copy of `backend/data/levels_data.py` (620 lines) |
| Business logic in HTTP handlers | `routers/score.py` computed scores; `routers/progress.py` issued Supabase queries |
| No service layer | components called `fetch` directly through a 139-line hook |
| State copied per component | every `useProgress()` call kept its own `useState` copy of points/scores |
| Constants scattered | 40/30/30 in two files, 90/75 in two, the 80% gate in three, 10/20/5 points in four, five storage keys inline |
| Dead weight | 8 unreferenced keyframes, 17 unused CSS variables, a 184-line `App.css` nobody imported, 10 scratch e2e scripts, images under `.e2e/` |

## 2. Final structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full map and the
"where does X live?" index. The shape:

```
content/                 laws.json + levels.json — ONE source, served by the API and bundled by the app
backend/                 main.py (assembly) · config/ · core/ · api/{routes,schemas}/ · services/ · repositories/
frontend/src/engine/     pure algebra: node, tree, parser, render, normalize, equivalence, validate,
                         laws/{definitions,helpers,sum,product,not,const,scanHints}, solver, scoring,
                         sandbox/{input,generator,pool}, index, __tests__/
frontend/src/state/      progressStore (single source of truth) · useProgress · useGameState · useGameContent
frontend/src/services/   apiClient · contentApi · scoreApi · progressApi · authActions · supabaseClient
frontend/src/config/     gameRules.js (every tunable) · storageKeys.js
frontend/src/components/ animations/ puzzle/ tutorial/ laws/ layout/ ui/ + the tree renderers
frontend/src/pages/      one file per route screen
frontend/src/styles/     index (Tailwind entry) · tokens · utilities · orientation · animations
```

Layering rule enforced by review: `engine/` imports only `config/` and itself;
`state/` imports engine + services + config; screens import all three; components
never call `fetch` and never touch the engine's internals.

## 3. Duplications eliminated

| Duplication | Resolution |
|---|---|
| Levels + laws stored twice (Python and JS, 1,363 lines total) | `content/*.json`, read by `backend/repositories/content_repository.py` and imported by `frontend/src/content/gameContent.js` through the `@content` alias |
| Law identity retyped in builders, reference cards, hints, scoring | `engine/laws/definitions.js` — one table; the name→id map is derived from it |
| The scoring formula in two places (server + client) | `backend/services/scoring_service.py` (authoritative) and `engine/scoring.js` (instant estimate), both reading their numbers from config |
| `nameToId` map duplicated inside the puzzle screen, plus the scoring arithmetic inline | deleted; the screen calls `engine/scoring.js` |
| Law drawer / law card / tutorial-replay modal / popup anchoring / star rating / gate bar / points chip / spinner / header copied between the level and stage screens | shared components (`components/laws/`, `components/ui/`, `components/layout/`, `hooks/usePopupPlacement.js`, `hooks/useTutorialReplay.js`) — the two pages went 597+618 → 400+396 with 419 shared lines, exactly conserved |
| `fetch` + auth headers + error handling re-derived per call site | `services/apiClient.js` |
| Every `useProgress()` call holding its own copy of progress | `state/progressStore.js` with `useSyncExternalStore` |
| Root and backend `requirements.txt` byte-identical | root uses `-r backend/requirements.txt` |
| Two READMEs restating the same setup guide | one root README; `frontend/README.md` is frontend-only |
| Dead code | see §4 |

## 4. Deleted

| File / item | Lines |
|---|---|
| `backend/data/levels_data.py` + `data/__init__.py` | 621 |
| `frontend/src/lib/gameData.js` | 743 |
| `frontend/src/lib/{expr,laws,solver,sandboxInput,randomPuzzle,sandboxPool}.js` | 2,525 → split into `engine/` modules |
| `frontend/src/hooks/{useApi,useProgress}.js` | 447 |
| `frontend/src/utils/supabase.js` | 6 |
| `frontend/src/App.css` (imported by nothing, referenced undefined variables) | 184 |
| `frontend/src/index.css` (split into `styles/`) | 444 |
| `backend/routers/*` + `auth_middleware.py` (moved into the layered structure) | 300 |
| 8 unreferenced `@keyframes` + 17 unused `:root` variables | ~48 |
| 10 scratch e2e scripts (probe2, mini, test, debug-complement, measure, shots, landscape, mobile-play, audit-responsive, verify) | ~1,300 |
| 4 tracked screenshots + 233 generated screenshots + 23 run logs (untracked/gitignored) | 15 MB |
| `.idea/` IDE metadata (untracked; files kept on disk) | 6 files |
| Dead declarations (`tokenBaseStyle`, `MIN_TAP`, `shockColor`, unused `earliest`/slice, write-only `earnedPoints`/`toastMessage`, dead tutorial data) | ~60 |

Moved rather than deleted: `lib/tutorialData.js` → `content/tutorialContent.js`,
`lib/auth-client.js` → `state/AuthProvider.jsx` + `state/useSession.js` +
`services/authActions.js` (split again after the move),
`hooks/useGameState.js` → `state/useGameState.js` (all `git mv`, history intact).

## 5. Verification

Every number below was produced on the frozen final tree. The "before" column is
the branch tip immediately before the restructure (`c57b0bd`), served from a git
worktree on its own port, running the same suite with the same command — so
"pre-existing" is measured, not assumed.

| Suite | Before | After | Reading |
|---|---|---|---|
| engine unit tests (`npm test`) | 0 (none existed) | **46/46** | new |
| engine fingerprint, default mode | baseline | **byte-identical** | every graded puzzle, every state on its optimal path, all transitions, all hints, 24 sandbox-pool expressions |
| engine fingerprint, `--expand` | baseline | **byte-identical** | the sandbox-only law did not leak into graded behaviour |
| `verify-sandbox` | 0 failures | 0 failures | engine helpers + pool + generator |
| `verify-sandbox-input` | — | 206/206 | sandbox input contract |
| `sandbox-engine-audit` | — | 335/335 | engine strictness |
| `generator-stress` | 0 failures | 0 failures | random puzzle generation |
| `sandbox-ui` | — | 27/27 | sandbox writes nothing, level play unaffected |
| `sandbox-input-ui` | — | 89/89 | input screen incl. mobile |
| `responsive-tiers` | — | 43/43 | phone/tablet/desktop matrix |
| `popup-overlap` | — | 148/148 | every popup stays inside the viewport |
| `tutorial-gate` | 15/15 | 15/15 | the tutorial gate still gates |
| `gameplay` (levels 1-3 + sandbox) | 13/13 | 13/13 | absorption, POS, 4-variable, randomizer, tutorial |
| `law-comments` | — | 7/7 | derivation comments |
| `acceptance-features` | **125/127** | **125/127** | same two failures before and after |
| `mobile-pages-verify` | 7 failures | 7 failures | same seven |
| `mobile-landscape-workspace` | 43/47 | 43/47 | same four |
| `mobile-ux-verify` | **44/49** | **48/49** | the refactor fixed 4 (sandbox success popup checks) |
| `tutorial-overlap-verify` | 139/144 | 139/144 | same five |

Build: `✓ built in 1.27s`. Lint: **22 findings across `src/`**, down from 29 at
the last pre-split measurement and from more at `HEAD`; the remaining findings are
all pre-existing categories (`react-hooks/set-state-in-effect` 9,
`exhaustive-deps` 5, `react-refresh/only-export-components` 4,
`no-unused-vars` 4) and every one of them exists in the pre-refactor tree
(evidence: `ProblemPage.jsx` alone linted to 15 findings at HEAD, including the
`rules-of-hooks` error this refactor removed).

**End-to-end confirmation for the brief:** Levels 1-3 + sandbox still play
through: `gameplay` solves a Level 1 absorption puzzle, a POS puzzle, a
4-variable Level 3 puzzle and a generated sandbox problem in a real browser;
`tutorial-gate` walks a brand-new learner through the gate into `/levels` and
`/sandbox`; `sandbox-ui` proves sandbox play awards no points and POSTs no score;
`acceptance-features` covers the workspace on desktop, phone landscape, small
landscape and a 420px window with no uncaught page errors.

The 2 acceptance failures and the 4 tap-target failures that remain are **not**
introduced here — they reproduce on the pre-refactor tree, and the tap-target one
is a sizing decision in the pre-existing mobile pass (`min-w-[32px]` on literals,
`24x14` on drag grips vs a 44x44 assertion). The stale `['START LEVEL','ENTER
SANDBOX']` label contract in `mobile-pages-verify.mjs` is likewise pre-existing:
the page has said `🚀 VIEW LEVEL STAGES` since the carousel redesign commit, which
predates this branch's restructure.

## 6. Known issues, deviations and things to know

1. **Restart the dev server.** `frontend/vite.config.js` gained the `@content`
   alias and `server.fs.allow`, and `main.jsx` imports the split stylesheets. A
   Vite instance started before this branch will not pick that up.
2. **Deploy the frontend and backend together.** The API now answers
   `{ success, data, error }`; the client unwraps it but still tolerates the old
   plain shape, so a mismatched pair degrades rather than breaks.
3. **Two backend failure paths changed**, both deliberate: upstream Supabase
   transport errors answer `502 upstream_error`, and missing/corrupt content
   answers `503 content_unavailable`, instead of a bare `500`.
4. **The database schema is untouched.** Guide usage is folded into the existing
   `hints_used` column rather than adding a column.
5. **The sandbox suite's progress assertion was updated** to the contract the
   shared store makes true: progress is written when it changes, not on every
   page mount. Same intent (sandbox must not write), new baseline, documented in
   the test.
6. **Pre-existing lint findings remain**, unchanged in count and rule:
   `react-hooks/set-state-in-effect` (measurement/tracking effects) and
   `exhaustive-deps`. They existed at `HEAD` in the original files; silencing
   them would have required restructuring effects and risking behaviour, so they
   were left visible instead (evidence: `ProblemPage.jsx` at HEAD linted to 15
   findings, including these).
7. **One staging-order artifact:** the shared level-screen components were
   committed after the pages that import them (the pages had already been staged
   with their import rewrites in the preceding commits). Each commit's message
   says so. The history is honest but those intermediate commits are not
   individually buildable; the final tree is.
8. **No Boolean engine on the backend, on purpose** — see "The engine contract"
   in ARCHITECTURE.md. If a third consumer ever needs the algebra, extract a
   shared package instead of porting it.
9. **`WelcomeSlide.badge`/`icon` were deleted** as dead, but two welcome-modal
   strings stay hardcoded because the data fields differ in case
   (`'WELCOME TO PRAXIS'` vs `'Welcome to'`) and the rendered text is produced by
   an `uppercase` class.
