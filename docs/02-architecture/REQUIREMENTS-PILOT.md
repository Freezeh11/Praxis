# Praxis Requirements Refactoring Pilot

**What this is:** the implementation record and validation plan for the approved requirements refactoring pilot.
**Who it is for:** the capstone team, instructor, and reviewers evaluating the relationship between educational requirements and code changes.

The pilot introduces independent law selection in Level 1 stages 7–12, explanatory feedback after unsuccessful choices, and guidance consistent with the scored objective. The tutorial, earlier stages, other levels, sandbox rewards, and level unlock rules retain their existing policies. The stage allocation is a reversible team-approved pilot choice, not a student-validated difficulty boundary.

## Evidence and interpretation

The supplied team document, *MVP Validation and Findings and Refactoring Priorities*, reports criticism of passive law selection, Q26 difficulty at 3.97/5, Q27 progression at 3.94/5, and SUS averaging 71.94 with substantial variation. Those are reported validation findings; the underlying respondent data and referenced Highlights document were not inspected. Q26/Q27 measure perceptions, not directly demonstrated law-application accuracy. No learning improvement is claimed from this implementation.

The repository audit found that Level 1 stage 12 has a four-step objective-aware route, while repeatedly following the previous first-scanner guide produced six steps in an engine simulation. This confirms a guidance consistency problem without claiming to reproduce the respondent's exact five-step browser session. Level 2 stage 12 separately contained a stale authored optimum of 11 instead of 10.

## Requirements and implementation

| Requirement | Revised behavior | Implementation |
|---|---|---|
| R7 independent selection | All nine supported graded law choices remain available in a stable order throughout the six pilot stages. Selection does not reveal applicability. Tutorial and earlier stages remain guided. | `frontend/src/config/gameRules.js` function `usesIndependentSelection`; `frontend/src/components/puzzle/LawPanel.jsx` |
| R4 correction | The chosen law is resolved using the existing engine. An unmatched choice preserves the AST and derivation count, explains the selected operands and law condition, and permits retry. No-selection prompts are separate from pattern mismatches. | `frontend/src/engine/practice.js` functions `selectionLaws` and `evaluateLawChoice`; `frontend/src/state/useGameState.js` |
| R5 guidance | Hints and guides plan toward the configured goal, accounting for target laws already used. Exact operand paths replay the planned next transition. Repeated hints progress from a pattern cue to operands and then the next expression. | `frontend/src/engine/practice.js` function `planGuidance`; selection metadata in `frontend/src/engine/solver.js`; `frontend/src/state/useGameState.js` |
| R5 uncertainty | If no continuation is verified within the budget, assistance reports uncertainty and adds no hint/guide penalty or guide charge. A goal-reaching fallback that omits target laws is identified explicitly. | `planGuidance`, `requestHint`, `activateGuide`; guide charge remains conditional on successful activation in `frontend/src/pages/ProblemPage.jsx` |
| R1 measurement clarity | The score is described as a practice score. Assistance use is not labelled demonstrated independence. Session choice observations distinguish valid choices, unmatched patterns, selection prompts, and decisions after assistance. | `frontend/src/components/puzzle/ScoreModal.jsx` |
| R3 supporting records | New steps retain law IDs, selection paths, and contextual builder descriptions. Old `{law, from, to}` records remain readable through the existing fallback explanation. | `useGameState`; `frontend/src/components/puzzle/LawExplanationCard.jsx` |

Reference-only associativity and sandbox-only expansion are excluded from independent graded choices. The existing algebra builders remain the authority; there is no second implementation in the UI or Python backend. See `frontend/src/engine/practice.js` and `frontend/src/engine/laws/definitions.js`.

Guidance uses the same objective-aware shortest-path definition as scoring, within the existing move set and search budgets. It does not prove global Boolean minimality. Additional steps selected by the student can still reduce efficiency, and hint/guide usage retains its existing separate score penalty and guide price.

Session observations are kept in memory and cleared on puzzle load/reset. They are not synchronized to PostgreSQL and are not a durable assessment dataset. Once assistance is requested, later choices in that puzzle visit remain marked assisted, including after undo/reset. Existing assistance counters also remain in effect on same-puzzle reset. Reopening a saved derivation does not manufacture choice observations.

## Supporting defect corrections

- Corrected Level 2 stage 12's authored optimum to 10 in `content/levels.json`.
- Aligned Python reward rounding with the browser's half-up convention at totals 10, 50, and 90 in `backend/services/scoring_service.py`.
- Added a synchronous interaction lock covering rapid input and the tutorial pre-animation delay. Reset, navigation-driven load, undo, and unmount cancel pending timers.
- Made long derivations scrollable on both axes on desktop and mobile, with a keyboard-focusable workspace and visible scroll instruction.
- Bound hint visibility to the expression it describes, cancelled superseded dismissal timers, and hid hints during transformations and completion.
- Corrected the legacy De Morgan explanation-name match.

These corrections support dependable practice; they are not counted as evidence of educational requirements improvement.

## Architecture and compatibility

React/Vite, FastAPI, and PostgreSQL/Supabase remain unchanged. No new API, database table, credential, dependency, or server-side algebra implementation is introduced. Existing score fields and progress payloads remain compatible. The backend rounding fix applies to future submissions; historical reward balances are not rewritten.

The pilot does not change target-goal acceptance, unlock rules, guide pricing, or the supported algebra. Full R2 alternative-form acceptance and full R3 atomic justification remain deferred. In particular, existing normalization can still combine multiple semantic changes; the added step description does not claim to constitute a complete proof of every such change.

## Verification

| Check | Result |
|---|---|
| Frontend engine suite | 87 passed, including the previously failing authored-optimum check |
| Objective guidance regression | All 40 authored puzzles replay through actual guide selections within the recorded objective-aware step counts |
| Backend reward regression | One unittest with four score cases passed, without a database or authentication service |
| Isolated browser regression | Passed independent choices, unchanged expression on rejection, same-tick application lock, assistance labelling, guided-mode compatibility, reset cancellation, and desktop/phone overflow checks |
| Production build | Passed; existing bundle-size and Browserslist notices remain |
| Lint | Existing repository errors remain. Comparison against HEAD found no introduced findings in changed frontend files; new engine/test modules are clean. |

Commands:

```powershell
Set-Location frontend
npm test
npm run build
npm run lint
Set-Location ../backend
python -m unittest discover -s tests -v
Set-Location ..
node .e2e/requirements-pilot.mjs
```

The isolated browser test uses installed Playwright and a temporary Vite fixture. If Playwright is outside normal package resolution, set `PRAXIS_PLAYWRIGHT_MODULE` to its installed package path. `PRAXIS_BROWSER_CHANNEL=chrome` uses installed Chrome; the default is Playwright Chromium. Optional `PRAXIS_PILOT_SCREENSHOTS` selects an output directory. The fixture does not sign in, call application APIs, or mutate a database. It exercises the real game hook, law panel, expression display, and derivation canvas, but does not replace authenticated full-application testing or student validation.

## Stakeholder validation before expansion

1. Have the instructor review the six-stage transition, law choices, and explanations, especially Distributive, Identity/Annulment, and De Morgan.
2. Compare guided and independent practice using comparable unfamiliar expressions, counterbalanced where feasible. Do not interpret a rise in errors after removing cues as proof that learning worsened.
3. Define a law-choice opportunity and distinguish no-selection errors, pattern errors, repeated guesses, and choices after assistance. Do not equate session matched-choice counts with first-choice accuracy.
4. Measure unaided first-choice accuracy, correction after feedback, recurrence on a new expression, and independent simplification accuracy. Include an instructor-reviewed explanation rubric.
5. Repeat Q26/Q27 as perception measures alongside performance, and examine low-usability cases on actual participant devices. Do not attribute individual SUS scores to a defect without linked evidence.
6. Agree targets, task exposure, evaluation timing, and participant scope before collecting results. Expand the pilot or change unlock rules only when the evidence supports it.

No new stakeholder responses, assessment results, improved SUS scores, or learning gains were generated by these engineering checks.
