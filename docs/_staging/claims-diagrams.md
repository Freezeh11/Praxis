# Claims ledger — `diagrams` (task-7)

**Deliverable:** `docs/09-diagrams/DIAGRAMS.md` — 12 Mermaid diagrams, each with a title, a
one-line "How to read this", a "What it shows" account and a "Source of truth" citation line.

**Assembly rule applied:** where a writer's input conflicted with the code, the **code won**, and the
conflict is recorded in §3 below.

| # | Diagram | Source of writer input | Key evidence (file:line) | Verification I performed |
|---|---|---|---|---|
| D1 | System context (C4 Level 1) | `devops-ops` §1 (adopted facts; flowchart form instead of `C4Context`) | `backend/main.py:25`; `backend/supabase_client.py:22-31,87-98`; `backend/core/security.py:17-35`; `database/init.sql:8,18,30`; `frontend/src/services/authActions.js:9-31`; `frontend/src/config/appLinks.js:8-9` | read every cited file; adopted the writer's two-actor model (learner + tutor) and their C4-pure decision to defer hosting to the deployment figure; added the Google Forms external system after verifying `SURVEY_URL` is really referenced (`components/layout/SurveyButton.jsx:17`) |
| D2 | Container diagram (C4 Level 2) | `devops-ops` §2 (adopted facts; flowchart form instead of `C4Container`) | `backend/main.py:25-36,79-83`; `frontend/vercel.json:2-11`; `frontend/vite.config.js:13-17`; `backend/repositories/content_repository.py:16,34-43`; `backend/repositories/progress_repository.py:29-73`; `backend/supabase_client.py:87-98` | read all cited sources; kept the writer's "engine is inside the SPA, not a container" scope decision; added the `lru_cache` self-heal note after the Lead's correction #2 |
| D3 | Entity-relationship diagram | `data-scoring` §1 — **fence adopted verbatim** | `database/init.sql:7-13,16-25,24,28-42,45-47,50-58` | re-read `init.sql` in full (58 lines); confirmed 3 tables, all FKs to `auth.users(id)` ON DELETE CASCADE, the `UNIQUE(user_id, level_id, stage_idx)` at `:24`, and the permissive `FOR ALL USING (true)` policies at `:56-58`; ran the fence through the real Mermaid parser |
| D4 | Boolean engine component diagram | `engine-guides` §1 — structure and `classDef` theme adopted | `frontend/src/engine/index.js:8-13`; `parser.js:75,160-166`; `normalize.js:14-69`; `validate.js:16`; `sandbox/validate.js:155`; `sandbox/generator.js:84`; `laws/definitions.js:29-54`; `laws/helpers.js:73,94,127`; `solver.js:37,175,258` | read every engine module; **counted 23 modules / 3,182 lines excluding tests (4,428 including)** to settle the LOC discrepancy; verified `LAW_DEFINITIONS` is 16 rows mapping to 10 distinct ids; verified `validateExpr` is called only by `sandbox/generator.js:84` and the barrel |
| D5 | Sequence: one derivation step | `engine-guides` §2 (merged with my own draft) | `components/ExpressionDisplay.jsx:59-60`; `components/puzzle/DerivationCanvas.jsx:194-199`; `pages/ProblemPage.jsx:307,315,321`; `state/useGameState.js:147,199,308,354,363-373,423-425,437,53-68`; `config/gameRules.js:60,62` | verified the click chain end to end and **added the `DerivationCanvas.jsx` hop**, which the writer's version collapsed; confirmed `lawAnimationMs` is 1,350 at `:60` and `preLawHighlightMs` 1,500 at `:62`; confirmed the win test is `canonText` equality, not equivalence |
| D6 | Sequence: the sandbox, corrected | my draft + `backend-api` §2 (correction content) + `engine-guides` §3 (two-gates split) | `pages/SandboxPage.jsx:117-124,163-187,178-181`; `engine/sandbox/input.js:109,113,161,190`; `engine/sandbox/validate.js:155`; `components/puzzle/sandboxPuzzle.js:46-56,81-86`; `components/puzzle/usePuzzleSession.js:40,185-188`; `config/storageKeys.js:22`; `config/gameRules.js:70,72` | confirmed by live `openapi()` enumeration that **no `/api/sandbox/*` route exists**; read `SandboxPage.jsx` in full; verified the `sessionStorage` key name and the route-state-first resolution order; confirmed sandbox mode is the absence of route params |
| D7 | Sequence: authentication and the bearer token | `backend-api` §1 (adopted, restructured) | `services/authActions.js:9-31`; `state/AuthProvider.jsx:21-42`; `services/apiClient.js:27-31,56-93`; `backend/core/security.py:17-43`; `backend/api/routes/progress.py:20-30`; `backend/api/routes/score.py:24,38-39` | read every cited source; **live-verified the three lanes with `fastapi.testclient`** — 401 `Not authenticated` with no header, 401 on both progress routes, and a **200** on `POST /api/score` signed out with `earnedPoints: 5`; added a dedicated `apiClient` participant because the writer's version routed `apiRequest` through supabase-js |
| D8 | State: puzzle session lifecycle | `product-arch` §1 — content adopted, **fence repaired** | `state/useGameState.js:29,53-68,147-197,354-459,437,461-499,501-520,560-603`; `components/puzzle/usePuzzleSession.js:118,123,150-221,185-188`; `config/gameRules.js:60,62,66`; `state/hintText.js:10` | **found and fixed a real syntax defect** — see §3-C1; verified the composite-state sub-cycle, the three exits from `ScoreShown`, and both redirect exits |
| D9 | Flowchart: level unlock | `data-scoring` §2 — adopted and extended | `state/progressStore.js:281-285,291-313`; `config/gameRules.js:38-46,48-49`; `pages/LevelSelectPage.jsx:78,80-92,94-120`; `pages/StageSelectorPage.jsx:55-62`; `components/TutorialGate.jsx:64-75` | read the predicate line by line and confirmed **`Math.round` happens at `:301-303` before the `>= 80` compare at `:309`**, so a true 79.5 passes (Lead correction #4); confirmed the divisor is total stages, not stages played; confirmed the gate is frontend-only and `GET /api/levels/{id}` has no auth dependency |
| D10 | Flowchart: scoring breakdown | `data-scoring` §3 — adopted and extended | `backend/services/scoring_service.py:32-77,80-88,91-96,99-107,110-115`; `backend/config/constants.py:9-25`; `backend/api/routes/score.py:20-48`; `backend/services/progress_service.py:87`; `frontend/src/engine/scoring.js:54-98` | read the whole scorer; **re-ran the endpoint live** and reproduced the verified `total 100.0` response; added the explicit client-trust note (Lead correction #5) stating `stepsUsed = 0` with claimed law ids scores 100 and `optimalSteps = 999` still yields full efficiency via the clamp |
| D11 | Deployment diagram | `devops-ops` §3 (merged with my own draft) | `render.yaml:1-15`; `frontend/vercel.json:1-11`; `backend/config/settings.py:23-27,59-63,66-71,75`; `backend/main.py:30-36`; `backend/repositories/content_repository.py:16`; `backend/api/routes/health.py:15-18` | read both config files in full; confirmed **one** Render service and no frontend service; confirmed the hardcoded rewrite target `praxis-backend-5302.onrender.com`; added the same-origin proxy explanation so the quiet production CORS story makes sense; verified no secret values are reproduced |
| D12 | Frontend data flow | `product-arch` §2 — adopted with my notes | `pages/ProblemPage.jsx:134-135`; `components/puzzle/usePuzzleSession.js:34-35,86-100`; `state/useProgress.js:20-24`; `state/progressStore.js:49-57,69-94,97-130,147-166`; `services/apiClient.js:27-31,33-45,63`; `services/scoreApi.js:31`; `services/progressApi.js:12`; `services/contentApi.js:49`; `state/AuthProvider.jsx:37-42` | read every cited source; **verified with `grep` that `frontend/src/services/apiClient.js:63` is the only `fetch` call site in `frontend/src`**; confirmed the engine has exactly two inbound edges; added the balance-versus-ledger note |

## 2. Cross-cutting claims

| Claim | Where | Evidence | How verified |
|---|---|---|---|
| There are exactly 7 application endpoints | D2, D6, D7, D11, D12 | `backend/main.py:79-83` | **ran** — enumerated `main.app.openapi()["paths"]` with `fastapi.testclient` and counted 7 |
| The API route list contains no `/sandbox` path | D6 | `backend/main.py:79-83` | **ran** — same enumeration; no `/api/sandbox/*` entry exists |
| Content is 4 levels / 40 puzzles `[4,12,12,12]` and 10 laws | D2, D9, D10, D11 | `content/levels.json`; `content/laws.json` | **ran** — `GET /api/levels` returned `puzzleCount` `[4,12,12,12]`, sum 40; `GET /api/laws` returned 10 |
| Levels are 0-based with 0 = Tutorial | D3, D8, D9, D11 | `content/levels.json`; `frontend/src/config/gameRules.js:83`; `database/init.sql:19` | read + confirmed via the live API's level `id` values 0–3 |
| Completion is canonical-text equality | D4, D5, D8 | `frontend/src/state/useGameState.js:437`, goal canonicalised at `:83-84` | read; independently re-verified by the Lead |
| `isEquivalent` is not on the per-step path | D4 | consumers are `laws/helpers.js:77,98`, `sandbox/generator.js:94`, `sandbox/input.js:161` | **ran** — repo-wide grep for `isEquivalent`, excluding tests; no `useGameState` consumer |
| Every API response carries `X-Request-ID` | D7 | `backend/core/middleware.py:18,27,61` | **ran** — TestClient response headers contained `x-request-id` |
| The SPA is on Vercel, the API on Render, Supabase third | D1, D11 | `render.yaml:2-11`; `frontend/vercel.json:2-11` | read both files in full |
| No secret values are reproduced anywhere in `DIAGRAMS.md` | all | `render.yaml:12-15` uses `sync: false` | **ran** the suite checker — `09-diagrams/DIAGRAMS.md` reports 0 secret findings |
| All 12 fences are valid Mermaid | all | — | **ran** the real parser (Mermaid 12.0.0 `mermaid.parse()` in jsdom): **12/12 PASS** |

## 3. Conflicts and corrections found during reconciliation

### C1 — `product-arch`'s state diagram did not parse (fixed)

The writer's `stateDiagram-v2` fence (`docs/_staging/diagram-input-product-arch.md:44`) **fails the real
Mermaid parser**:

```
Parse error on line 38:
...tate GradedProgress as "Graded: progress
-----------------------^
Expecting ... 'STATE_DESCR', 'ID', ... got 'AS'
```

Mermaid requires the description **first**: `state "label" as ID`, not `state ID as "label"`. I rewrote
that one line in D8 as
`state "Graded: progress written once, on first completion" as GradedProgress` and the fence now parses.
**The suite checker cannot catch this** — `check-docs.mjs` section 4 only checks that the first body line
is a known diagram keyword — which is exactly why the parser gate exists.

### C2 — two off-by-one citations in `product-arch`'s evidence table (corrected)

The table gives `frontend/src/config/gameRules.js:59` for `lawAnimationMs` and `:61` for
`preLawHighlightMs`. The real lines are `:60` and `:62` (`:59` and `:61` are the comment lines above
them). D5/D8 use the corrected numbers.

### C3 — `backend-api`'s optional sandbox flowchart misattributes step legality (not used)

`docs/_staging/diagram-input-backend-api.md` §2.2 draws `engine/sandbox/validate.js` as
"is the chosen step legal?". That module is the **raw-input syntax scanner** (`scanTokens`,
`validateSandboxInput`); step legality during play comes from `engine/solver.js getLegalTransitions`
and `engine/laws/index.js analyzeSelection`. I did not use that optional flowchart; D6 draws the real
`/sandbox` → `/sandbox/play` flow instead, and D5 covers in-workspace step legality.

### C4 — C4 keyword choice (deliberate deviation, permitted by the task)

`devops-ops` supplied `C4Context` and `C4Container` fences. Both **parse** (I verified them), but the
task instruction for this domain is to prefer `flowchart` "if it renders more reliably, but keep the C4
level semantics in the titles and prose". D1 and D2 are therefore `flowchart` figures with
"(C4 Level 1)" and "(C4 Level 2)" in their titles; every fact, actor and relationship from the writer's
C4 fences was adopted.

### C5 — hosting platforms moved out of D1 (deliberate, follows the writer)

`devops-ops` deliberately excluded hosting from the C4 Level 1 context and placed it in the deployment
figure. I followed that: D1 carries actors, Supabase and the survey; Vercel and Render appear in D11,
with a note in D1 saying so.

### C6 — engine size quoted from two different bases (both correct)

`product-arch` says the engine is "23 modules / 3,182 lines"; `GROUND-TRUTH` says 4,428 lines. Both are
right on different bases: 3,182 lines of engine source excluding `__tests__`, 4,428 including them
(measured with `wc -l`). D4 states both to avoid a contradiction between sibling docs.

### C7 — false score ranges in the erDiagram (post-assembly correction)

`data-scoring` corrected its input **after** `DIAGRAMS.md` was first assembled, so the first published
version carried four wrong range claims in the D3 attribute comments and one in the D10 prose. They are
false because `hintsUsed`/`guidesUsed` reach the formula unvalidated: a **negative** assistance count
*buys* score through `max(0, 30 - assistance × 10)` instead of costing it.

| Was | Now | Why |
|---|---|---|
| `best_score "best total 0..100, raised never lowered"` | `best_score "best total, raised never lowered - unclamped"` | `total` is unclamped, so no range guarantee |
| `hint_independence "0..30 component"` | `hint_independence "0..30 for non-negative inputs - unclamped"` | a negative counter inflates it without limit |
| `total "0..100, rounded to 1 decimal"` | `total "unclamped sum, rounded to 1 decimal"` | only floor is 0; no upper cap |
| `earned_points "bonus 0..5, NOT the 10-point base XP"` | `earned_points "bonus for non-negative inputs - scales with total, not the base 10 XP"` | scales with the unclamped total |
| D10 prose: "`earnedPoints` is a 0–5 bonus" | "is **not capped** at 100 … 0–5 for non-negative inputs only" | same reason |
| `target_law "0..30 component"` | **unchanged — correct** | a genuine ratio, bounded for all inputs |

**Independently reproduced, not taken on trust.** I re-ran the live endpoint
(`fastapi.testclient`) with `{levelId: 1, stageIdx: 0, stepsUsed: 1, lawsUsed: ["absorption"], hintsUsed: -99}`:
`hintIndependence 1020.0`, `total 1090.0`, `earnedPoints 54`. The same request with `hintsUsed: 0` returns
`30.0 / 100.0 / 5`. Note the exact total also depends on whether the puzzle's target law is claimed —
`SCHEMA.md` records `1060.0` for a run without the target-law credit, mine returned `1090.0` with it —
so D10 quotes the invariant `hintIndependence 1020.0` and says the total exceeds 1000 with no upper cap,
rather than asserting one magic number. Wording aligned to `docs/03-database/SCHEMA.md:242-244` and
`docs/06-reference/scoring-and-rewards.md:120`.

A D3 note and a D10 note were added so the diagram cannot be read as implying bounds that the schema does
not enforce (`backend/services/scoring_service.py:51,99-115`; `database/init.sql:28-42` has no `CHECK`).

## 4. Acceptance evidence

| Requirement | Result |
|---|---|
| 12 diagrams present, each with a title | yes — D1–D12, each a `##` heading |
| each has a one-line "How to read this" | yes — 12/12 |
| each has a "What it shows" | yes — 12/12 |
| each has a "Source of truth" `file:line` line | yes — 12/12 |
| every Mermaid fence syntactically valid | **12/12 PASS** with Mermaid 12.0.0 — re-run after the C7 correction |
| every diagram consistent with the code | verified per the rows above; 7 conflicts/corrections recorded in §3 |
| the sandbox diagram corrects the non-existent endpoint | yes — inline `Note over` in D6 plus a "The brief was wrong" note |
| `check-docs.mjs` findings against this file | **0** (995 lines, 216 citations; suite run ends `BLOCKER 0` / `RESULT: PASS`) |
| frozen revision | 995 lines, sha256 `422ec86a94ef09b837ffdd493aeb7869a3b214e9e3cf30d062c00706e3b97004` |

**Gate command used (run from the repository root):**

```bash
node docs/_staging/tools/.mermaid-check/validate-mermaid.mjs docs/09-diagrams/DIAGRAMS.md
```

Expected terminal line: `ALL 12 MERMAID FENCES PARSE OK`, exit code `0`.
