# Praxis Functional and Reliability Test Report

**What this is:** the results of the expanded test pass on 9 November 2026, after the approved requirements pilot.
**Who it is for:** the capstone team and instructor reviewing implementation readiness and remaining defects.

The approved pilot passes the exercised correctness and workflow checks. The whole application cannot be declared fully correct, reliable, or performant: backend input-integrity gaps, progression enforcement gaps, a long synchronous sandbox operation, and existing lint failures remain. This testing pass adds regression coverage and documentation without changing production behavior.

## Results

| Area | Result | Scope |
|---|---|---|
| Engine unit and property suite | 87 passed, zero failures | Parsing, laws, soundness, sandbox, authored objectives, pilot policy, and guidance |
| Sandbox audit | 335 checks passed, zero failures | Strict input cases, reference examples, and 200 grammar-generated expressions |
| Generator stress | 40 easy, 40 medium, and 40 hard cases passed | Scope, parse/render round trips, solvability, optimal counts, difficulty minima, plus consecutive-repeat checks |
| Backend tests | 8 passed; 3 expected failures exposing known defects | Real FastAPI routes/services with isolated Auth and repository replacements; reward arithmetic |
| Routed application browser suite | 18 checks passed | Actual SPA, Supabase client, router, pages, and state; Auth/API HTTP responses mocked |
| Isolated pilot browser suite | Passed | Same-tick duplicate application, cancellation during tutorial delay, guided compatibility, assistance state, overflow, and no penalty for unverified guidance |
| Configured Supabase schema connectivity | All 3 probes returned HTTP 200 | Read-only requests selecting expected columns with limit zero; no student rows retrieved or modified |
| Production build | Passed | Existing bundle-size and outdated Browserslist notices remain |
| Repository lint | Failed: 12 errors, 4 warnings | Existing hook/effect and unused-variable findings; no lint remediation included |
| Diff whitespace check | Passed | `git diff --check` |

The three backend expected failures are not successful behavior. They make existing integrity defects executable and visible without falsely describing the entire backend suite as passing its intended constraints.

## Browser workflow coverage

The full-application browser test uses an isolated learner and in-memory HTTP responses. It does not substitute a simplified React workspace for the application. It checks:

1. Protected-route redirection before sign-in.
2. Invalid-password feedback.
3. Successful sign-in and protected-session restoration.
4. Nine stable choices in an independent stage.
5. Wrong-law feedback without changing the expression.
6. Successful transformations and submitted law history.
7. Completed-derivation restoration after refresh.
8. Review of a legacy `{law, from, to}` derivation.
9. Guided behavior in an earlier unsolved stage.
10. Sandbox syntax rejection and custom-expression completion.
11. Local completion during an API outage.
12. Completion of a complex four-variable input for timing measurement.
13. Sign-out cancellation and confirmed session removal.
14. Fresh-account redirection into tutorial onboarding.
15. Independent-choice reachability on an 844 by 390 touch viewport.
16. Portrait phone gate and recovery after rotation.
17. Absence of uncaught page errors in the main desktop and phone sessions.
18. Absence of unexpected external origins in those sessions. Known font requests and a locally injected antivirus script are blocked by the test.

Source: `.e2e/application-regression.mjs`. Machine-readable results are generated at `.e2e/_results/application-regression.json` and are intentionally git-ignored.

The separate `.e2e/requirements-pilot.mjs` additionally checks desktop/phone horizontal and vertical scrolling, same-tick action locking, reset cancellation, and an unsupported-state hint/guide that leaves assistance counters unchanged.

## Confirmed remaining defects

### Backend input integrity

**Negative score inputs are not rejected.** A score request with negative stage and step values receives HTTP 200 in the isolated API test. Request schemas contain no non-negative bounds, and negative stage indices use Python indexing. Evidence: `backend/api/schemas/score.py:13` and `backend/services/content_service.py:40`.

**Invalid progress values reach persistence.** A snapshot containing negative points, an unknown level, a negative stage, and a score of 999 is accepted by the application and handed to the isolated repository. This test does not establish which additional constraints the deployed database might impose. Evidence: `backend/api/schemas/progress.py:11` and `backend/tests/test_api.py`.

**A zero-step completion claim can receive 100.** The score endpoint trusts submitted counts and law IDs without a derivation. The regression demonstrates a perfect score for a zero-step claim. Evidence: `backend/tests/test_api.py` and `backend/services/scoring_service.py:82`.

These gaps existed before the pilot. They are especially relevant if stored scores will be used as educational evidence. They were not repaired during this testing request.

### Progression boundaries

**An actual average of 79.5 unlocks the next level.** The selector rounds before comparing against 80. This was reproduced through the running application's progress selector, using a synthetic twelve-stage snapshot. Evidence: `frontend/src/state/progressStore.js:303` and `:309`.

**Direct URLs bypass higher-level prerequisites.** The routed browser test opened Level 2 directly while Level 1 was incomplete. The tutorial requirement still applies, but higher-level carousel locks are not enforced at the puzzle route. Evidence: `.e2e/application-regression.mjs` and `frontend/src/components/TutorialGate.jsx:34`.

### Synchronous sandbox work

The following supported four-variable input completed successfully but caused a long browser stall:

```text
A'BC'D' + A'BC'D + ABC'D' + ABC'D + ABCD + AB'CD
```

In the final local Chrome run, loading the new custom expression took **7,449 ms**, and the largest gap between scheduled 20 ms heartbeat callbacks was **6,741 ms**. The test waited for the specific new expression, not an already visible custom-expression label. An independent Node engine measurement took approximately **8,935 ms** for construction of this input.

This is an observed responsiveness problem, not a mathematical failure. The input builder and solver execute synchronously on the browser thread. A short timeout allows the busy indicator to paint but does not make computation asynchronous. Evidence: `frontend/src/components/puzzle/SidePanel.jsx:95` and `frontend/src/components/puzzle/usePuzzleSession.js:287`.

For comparison, one local measurement of initial guidance across the 40 authored puzzles found a median near 3 ms and a maximum near 310 ms. These are exploratory observations from one Windows machine, not representative-device benchmarks, production percentiles, or proof of a speed improvement.

### Lint and remaining verification limits

Lint still reports 12 errors and 4 warnings, primarily effect-driven state updates, hook dependencies, and unused variables. The production build passing does not resolve these findings.

The test pass does not establish successful production signup/email confirmation, real authenticated PostgreSQL writes, multi-device merge correctness, concurrent-write integrity, deployed RLS isolation, all four tutorial walkthroughs, full accessibility conformance, or performance on older physical phones. The live Supabase probe verifies connectivity and expected columns only; it deliberately requests zero rows.

No student learning effectiveness, confidence improvement, retention, or SMART outcome achievement was measured. Those require the agreed stakeholder evaluation protocol.

## Reproduction

From the repository root:

```powershell
Set-Location frontend
npm test
npm run build
npm run lint
Set-Location ..
node .e2e/sandbox-engine-audit.mjs
node .e2e/generator-stress.mjs
Set-Location backend
python -m unittest discover -s tests -v
Set-Location ..
node .e2e/requirements-pilot.mjs
node .e2e/application-regression.mjs
```

The browser scripts require installed Playwright and a browser. Set `PRAXIS_PLAYWRIGHT_MODULE` to its installed package path if it is outside normal module resolution, and set `PRAXIS_BROWSER_CHANNEL=chrome` to use installed Chrome. The browser scripts start and close their own Vite servers; run them sequentially. Backend tests require the project's Python dependencies and use placeholder credentials with Auth/storage doubles. They never write to the configured Supabase project.

## Follow-up priority

1. Define and enforce score/progress input bounds and content identifiers; decide how server-trusted learning evidence will be established.
2. Move long custom-expression computation off the interactive thread or otherwise make it cancellable and bounded in elapsed time, preserving algebra results.
3. Apply prerequisite checks consistently and compare the true average against the approved threshold.
4. Resolve lint findings, then test authenticated persistence and conflict cases against a disposable database.
5. Conduct instructor/student validation before claiming educational improvement or expanding independent selection.

These are follow-up recommendations based on testing, not additional implementation completed in this pass.
