# Praxis documentation suite — independent verification report

**What this is.** An adversarial, execution-based audit of the 35-document Praxis documentation
suite at `3838343`. Every endpoint was re-run, every scoring example re-derived, the engine driven
from `node`, every cross-link resolved, and 135 substantive claims re-checked against the source.
Nothing here is taken on trust from the suite, from `docs/_staging/GROUND-TRUTH.md`, or from the
seven claim ledgers.

**Who it's for.** Whoever owns the next edit to these docs. Every finding names the file, the line,
what is wrong, and the exact replacement text, so remediation needs no re-reading of the code.

**Verifier's independence.** The author of this report wrote none of the documents under audit and
did not edit any of them. Defects are reported, never repaired. The only file created inside the
suite is this one.

> **Note on the brief's section numbering.** The assignment asks for "Sections 1–9", but its method
> list enumerates ten audits (secret and terminology are steps 9 and 10). All ten are covered below
> as §1–§10 so that nothing is dropped.

## Contents

- [Headline numbers](#headline-numbers)
- [1. API audit](#1-api-audit)
- [2. Numeric audit](#2-numeric-audit)
- [3. Engine audit](#3-engine-audit)
- [4. Content audit](#4-content-audit)
- [5. Cross-link test](#5-cross-link-test)
- [6. Code-claim spot-check](#6-code-claim-spot-check)
- [7. Consistency audit](#7-consistency-audit)
- [8. Register audit](#8-register-audit)
- [9. Secret audit](#9-secret-audit)
- [10. Terminology audit](#10-terminology-audit)
- [Verdict](#verdict)
- [Findings, severity-tagged](#findings-severity-tagged)
- [Appendix A — all 56 broken anchors](#appendix-a--all-56-broken-anchors)
- [Appendix B — reproduction artifacts](#appendix-b--reproduction-artifacts)

---

## Headline numbers

| Metric | Value |
|---|---|
| Documents parsed and audited | **40** Markdown files under `docs/` (35 required + 5 legacy), **22,749** lines (`wc -l`) |
| Required-suite lines | **21,705** (`wc -l`) / 21,740 (the gate's counter, which adds 1 per file — see N1) |
| Staging files also read | 16 (`GROUND-TRUTH.md`, 8 claim ledgers, 5 diagram-input files, `prep-diagrams.md`, 2 tools) |
| Relative links resolved on disk | **1,538** (plus 167 GitHub `#Lnn` line anchors into source files) |
| Anchor-bearing links tested | **740** (528 same-page + 212 cross-file) |
| Broken links | **5** at the start of the audit — all five to `docs/verification-report.md`; **0** now that this file exists |
| Broken heading anchors | **56** across 6 files (54 same-page, 2 cross-file) |
| Substantive claims checked | **301** (135 machine-checked `file:line` claims, 8 scoring examples, 5 API-REFERENCE score examples, 47 endpoint/route observations, 24 engine probes, 11 content facts, 43 register sub-facts, 28 link/anchor-tool reconciliations) |
| Claims found WRONG | **12** |
| Claims UNVERIFIABLE | **4** (listed in the verdict) |
| `file:line` citations audited for target existence + line range | **3,984** citations / **2,361** with a line number |
| Citations out of range | **4** (all `frontend/vite.config.js:34-38`, a 36-line file) |
| Citations pointing at a blank line | **3** (2 distinct root causes) |
| Suite gate after this file exists | `BLOCKER 0 / MAJOR 0 / MINOR 56 / NIT 0` — the 56 are exactly the anchors in Appendix A |
| Defects by severity | **BLOCKER 1** (resolved by this file) · **MAJOR 7** (6 outstanding, M7 remediated mid-audit) · **MINOR 10** · **NIT 4** |

---

## 1. API audit

Method: `fastapi.testclient.TestClient(main.app, raise_server_exceptions=False)` against the real
app with `backend/.env` present. 47 observations recorded. Raw dump:
`docs/_staging/verification/api_audit.json`.

### 1.1 The route table is exactly the documented seven

`main.app.routes` yields `/`, `/api/levels`, `/api/levels/{level_id}`, `/api/laws`, `/api/score`,
`/api/progress`, `/api/progress/save` plus FastAPI's four built-ins (`/openapi.json`, `/docs`,
`/docs/oauth2-redirect`, `/redoc`). `GET /openapi.json` `paths` contains exactly those seven.
**VERIFIED** — `docs/04-api/API-REFERENCE.md:68` and `docs/09-diagrams/DIAGRAMS.md:925` both claim
"7 endpoints" and both are right.

### 1.2 Status codes, envelopes and payloads — every documented example reproduced

| Probe | Observed | Doc claim | Verdict |
|---|---|---|---|
| `GET /` | `200` `{"message":"Praxis API is running","docs":"/docs"}` (no envelope) | `API-REFERENCE.md:145-150` | VERIFIED |
| `GET /api/levels` | `200` envelope, 4 summaries, keys `desc,id,name,puzzleCount,varCount`, `puzzleCount [4,12,12,12]` | `:583-600` | VERIFIED |
| `GET /api/levels/{0,1,2,3}` | `200`, `varCount 2,2,3,4`; `name` `Level 3 — Boss` with a real U+2014 | `:596-604` | VERIFIED |
| `GET /api/levels/{4,999,-1}` | `404` `not_found` `Level N not found`, `detail:null` | `:606`, `:776-778` | VERIFIED |
| `GET /api/levels/abc`, `/1.5` | `422` `validation_error`, `loc ["path","level_id"]`, `int_parsing` | `:733-736` | VERIFIED byte-for-byte |
| `GET /api/laws` | `200`, 10 cards, keys `desc,formulas,id,name` | `:865-880` | VERIFIED |
| `POST /api/score` (ground-truth body) | `200` `efficiency 40.0, targetLaw 30.0, hintIndependence 30.0, total 100.0, earnedPoints 5` | `:956-959` | VERIFIED byte-for-byte |
| `POST /api/score` missing `stepsUsed` | `422`, `loc ["body","stepsUsed"]`, `missing`, `input {levelId:1,stageIdx:0}` | `:1044` | VERIFIED byte-for-byte |
| `POST /api/score` `stepsUsed:"one"` | `422` `int_parsing` `input "one"` | `:1050` | VERIFIED byte-for-byte |
| `POST /api/score` `lawsUsed:"absorption"` | `422` `list_type`, `Input should be a valid list` | `:1053-1055` | VERIFIED byte-for-byte |
| `POST /api/score` body `not json` | `422` `json_invalid`, `loc ["body",0]`, `ctx.error "Expecting value"` | `:1059-1061` | VERIFIED byte-for-byte |
| `POST /api/score` no body | `422` `missing`, `loc ["body"]`, `input null` | `:1065-1067` | VERIFIED byte-for-byte |
| `POST /api/score` unknown level / stage ≥ n | `404` `Level 999 not found` / `Stage 12 not found` | `:1034`, `:1071` | VERIFIED |
| `GET /api/progress` no token | `401` `{"code":"unauthorized","message":"Not authenticated"}` | `:1371-1380` | VERIFIED |
| `GET /api/progress` `Bearer garbage` | `401` `"Invalid session"` | (distinct message, documented) | VERIFIED |
| `POST /api/progress/save` no token | `401` identical | `:1371-1380` | VERIFIED |
| `DELETE /api/levels` | `405` `http_error` `Method Not Allowed` | `:606-608` | VERIFIED |
| `GET /api/nope` | `404` `http_error` `Not Found` | `§2.5` | VERIFIED |
| `X-Request-ID` | present on **all 40** responses; echoed verbatim when supplied, else a fresh 32-hex id | `:153` | VERIFIED |
| CORS `Origin: http://localhost:5173` | `ACAO` echoed | `:324` | VERIFIED |

### 1.3 The negative-`stageIdx` trap — documented, and reproduced exactly

| Request | Observed | `API-REFERENCE.md` claim |
|---|---|---|
| `stageIdx: -1` on Level 1 (12 puzzles) | `200`, scores stage 11 (`targetLawsRequired ["annulment","demorgan-or","complement"]`), `total 70.0`, `earnedPoints 4` | `:408`, `:983` — exact match |
| `stageIdx: -12` on Level 1 | `200`, scores stage 0 | `:409` — exact match |
| `stageIdx: -4` on Tutorial (4 puzzles) | `200`, scores stage 0 | consistent with `:409` |
| `stageIdx: -13` on Level 1 / `-5` on Tutorial | `500` `internal_error` `{"code":"internal_error","message":"Internal server error","detail":null}` (`IndexError`) | `:410-416`, `:1038` — exact match |
| `stageIdx: 99` on Level 1 | `404` `Stage 99 not found` | `:406` — exact match |

This is the single best piece of documentation in the suite: an undocumented code behaviour was
found, reproduced, its exact envelope quoted, and the consequence spelled out. **VERIFIED.**

### 1.4 Content-unavailable path (503) — reproduced with the loader pointed at a missing directory

Two consecutive `GET /api/levels` returned `503` with
`detail: "Game content is missing or unreadable: /home/xris/Documents/GitHub/Praxis/content/definitely-missing/levels.json. The content/ directory must be shipped alongside the backend."`
— byte-identical to `API-REFERENCE.md:613`; `GET /api/laws` matched `:880`. `lru_cache.cache_info()`
after the two failures was `CacheInfo(hits=0, misses=2, currsize=0)`, exactly the "a failed load is
not cached" claim at `:641-644`. **VERIFIED.**

### 1.5 Defects found by the API audit

- **M2** — `total` and `earnedPoints` ranges are documented as bounded and are not (§2.4 below).
- **m5** — four citations to `frontend/vite.config.js:34-38` / `:35-38` run past EOF.
- **m6** — `API-REFERENCE.md:93` cites the wrong range for the `/api/auth` proxy block.
- **M5** — the OpenAPI component-schema list at `API-REFERENCE.md:436-437` names a schema that does
  not exist.

Everything else in §1 of the reference — 47 observations — matched. The OpenAPI claims about "no
`securitySchemes`", "no tags" and "only 200/422 declared" are all **VERIFIED**:
`components.securitySchemes` is absent, `tags` is absent, and every operation declares only
`200` (plus `422` where a parameter is validated) — there is no `Authorize` button.

---

## 2. Numeric audit

Method: the real `services.scoring_service.compute_score` executed against the real content, and the
real JS mirror `frontend/src/engine/scoring.js` executed under `node`. Raw dumps:
`numeric_audit.json`, `api_audit.json`.

### 2.1 Constants

All twelve constants named in `docs/06-reference/scoring-and-rewards.md:34-47` were read from
`backend/config/constants.py` and `frontend/src/config/gameRules.js` at the cited lines:
`EFFICIENCY_WEIGHT 40.0` (`:9`), `TARGET_LAW_WEIGHT 30.0` (`:10`), `HINT_INDEPENDENCE_WEIGHT 30.0`
(`:11`), `MAX_SCORE` (`:12`), `STEP_PENALTY 10.0` (`:15`), `ASSISTANCE_PENALTY 10.0` (`:16`),
`MAX_BONUS_POINTS 5` (`:19`), `SCORE_ROUNDING_DP 1` (`:22`), `STAR_THRESHOLDS (90.0, 75.0)` (`:25`),
`UNLOCK_AVERAGE 80.0` (`:26`); frontend `SCORE_WEIGHTS` 40/30/30 (`:15-17`), `SCORE_PENALTY` 10/10
(`:23`,`:25`), `STAGE_COMPLETION_XP 10` (`:32`), `GUIDE_COST_POINTS 20` (`:35`), `MAX_STARS_PER_STAGE 3`
(`:46`), `UNLOCK_AVERAGE_SCORE 80` (`:49`), `SCORE_RAMP {80,50}` (`:52-55`). **All VERIFIED.**

### 2.2 Every worked example in `scoring-and-rewards.md` reproduced

| Example | Documented | Measured | Verdict |
|---|---|---|---|
| W1 perfect one-step | `40.0 / 30.0 / 30.0 / 100.0 / 5` | identical | VERIFIED |
| W2 clamp (`optimal min(3,2)`) | `100.0 / 5`, `breakdown.optimalSteps 2` | identical | VERIFIED |
| W3 over optimum + 1 hint + 1 Guide | `20.0 / 10.0 / 10.0 / 40.0 / 2` | identical | VERIFIED |
| W4 the 90.0 case | server `90.0 / 4`; browser `90 / 5` | Python `90.0, 4`; JS `90, 5` | VERIFIED |
| W5 the 50.0 case | server `50.0 / 2`; browser `50 / 3` | Python `50.0, 2`; JS `50, 3` | VERIFIED |
| W6 all bands floored | `0.0 / 0.0 / 0.0 / 0.0 / 0` | identical | VERIFIED |
| W7 half credit + 1 hint | `30.0 / 15.0 / 20.0 / 65.0 / 3` | identical | VERIFIED |
| W8 empty `targetLaws` stub | `100.0 / 5`; `_target_law(set(), set()) → 30.0` | identical | VERIFIED |

The supporting claims also hold: exactly **19** reachable totals
`{0,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,100}`; exactly **three** divergent totals
(`10.0 → 0/1`, `50.0 → 2/3`, `90.0 → 4/5`); the six-row divergence table at `:407-414` is correct
row for row. **VERIFIED.**

### 2.3 Every worked example in `API-REFERENCE.md` §3.6 reproduced

All five rows of the table at `docs/04-api/API-REFERENCE.md:979-985` reproduce exactly, including
the quoted `total: 60.0, earnedPoints: 3` response body at `:989`. The three-step `optimalSteps`
resolution order at `:993-1000` matches `scoring_service.py:80-88`. **VERIFIED.**

### 2.4 Defect: the documented `0–100` / `0–5` ranges are false (MAJOR — M2)

No field of `ScoreRequest` carries a lower bound (`backend/api/schemas/score.py:13-20` has no
`ge=` constraint), and `_hint_independence` only clamps at the bottom. Measured, reproducibly:

```
POST /api/score {"levelId":1,"stageIdx":0,"stepsUsed":1,"lawsUsed":[],"hintsUsed":-99}
→ 200 {"efficiency":40.0,"targetLaw":0.0,"hintIndependence":1020.0,"total":1060.0,"earnedPoints":53}
```

`total` is **1060.0**, not `0–100`; `earnedPoints` is **53**, not `0–5`. Documented as bounded in
three places, all wrong:

- `docs/04-api/API-REFERENCE.md:967` — `` | `total` | number | 0–100 | ``
- `docs/04-api/API-REFERENCE.md:968` — `` | `earnedPoints` | integer | 0–5 | ``
- `docs/03-database/SCHEMA.md:152` — "The **best total** (`0–100`) ever earned on that stage."
- `docs/03-database/SCHEMA.md:243` — `` | `total` | 0–100 sum, rounded to 1 decimal. | ``

The suite's own limitations list knows the bounds are missing but never states the consequence:
`docs/06-reference/scoring-and-rewards.md:585` says only "`stepsUsed`, `hintsUsed` and `guidesUsed`
are plain `int` with no `ge=0`; only their positive behaviour was tested above." A reader therefore
gets an affirmative false claim in the reference and no counter-claim in the limitations.

**Exact fix.** In `04-api/API-REFERENCE.md`, change the two range cells to
`` 0–100 for every non-negative input; unvalidated — a negative `hintsUsed`/`guidesUsed` inflates
`hintIndependence` without limit (verified: `hintsUsed:-99` → `total 1060.0, earnedPoints 53`) ``
and `` 0–5 for every non-negative input; scales with the unclamped `total` ``. In `SCHEMA.md:152`
drop "(`0–100`)" and add the same one-line note; in `SCHEMA.md:243` replace `0–100 sum` with
`unclamped sum`. Replace row 5 of `scoring-and-rewards.md:585` with: "**No field-level bounds.**
… Verified consequence: `hintsUsed: -99` returns `total 1060.0` and `earnedPoints 53`, i.e. the
score is not capped at `MAX_SCORE` in either direction." (Alternative code fix, not a doc fix:
add `Field(ge=0)` to `stepsUsed`/`hintsUsed`/`guidesUsed` in `backend/api/schemas/score.py`.)

### 2.5 Client-trust (D24) re-verified

`stepsUsed: 0` + the puzzle's target law → `total 100.0, earnedPoints 5`. `optimalSteps: 999` with
`stepsUsed: 1` → `breakdown.optimalSteps 1`, full 40 efficiency. `optimalSteps: 0` and `-3` both fall
back to content. **VERIFIED**, exactly as `scoring-and-rewards.md:581-583` and register D24 state.

---

## 3. Engine audit

Method: the real engine imported from `node --input-type=module`; `npm test` executed. Raw dumps:
`engine_audit_clean.json`, `engine_audit2.json`.

### 3.1 Law-id topology — one documented claim is wrong

| Fact | Measured | Doc |
|---|---|---|
| `content/laws.json` card ids, authoring order | `complement, idempotent, absorption, identity, annulment, distributive, double-neg, demorgan-and, demorgan-or, associative` (10) | `boolean-laws.md:148` VERIFIED |
| `LAW_DEFINITIONS` | 16 rows → 10 distinct ids | `boolean-laws.md:125`, `:150` VERIFIED |
| distinct `(form, name)` keys | **16** | `boolean-laws.md:125` says **15** — **WRONG (M4)** |
| distinct display `name`s | **15** (`Identity Law` appears in `sum` and `product`) | — |
| engine-only id | `distributive-expand` only | `boolean-laws.md:127`, `:151` VERIFIED |
| card-only id | `associative` only | `boolean-laws.md:128`, `:152` VERIFIED |
| `defineLaw('Associative Law','node')` | throws `Unknown law: "Associative Law" (node) — add it to LAW_DEFINITIONS.` | `boolean-laws.md:114-116` VERIFIED |

**M4 — exact fix.** `docs/06-reference/boolean-laws.md:125`, cell 3: replace
"**16 rows → 10 distinct ids** (15 distinct `name`+`form` keys)" with
"**16 rows → 10 distinct ids** (16 distinct `name`+`form` keys; 15 distinct display names, because
`Identity Law` is declared once for `sum` and once for `product`)". The same wrong count is repeated
in the staging ledgers at `docs/_staging/claims-engine-guides.md:19` and
`docs/_staging/diagram-input-engine-guides.md:144` and should be corrected there too.

### 3.2 The `A(B + A')` gate — verified line by line

```
graded  analyzeSelection(A(B + A'), [A, A']): []
sandbox analyzeSelection(A(B + A'), [A, A']): [["distributive-expand","Distribute A over B + A' → AB + AA'"]]
graded  scanHints(A(B + A'), 'R'):            []
sandbox scanHints(A(B + A'), 'R'):            [{"law":"distributive-expand","paths":["R.0","R.1"]}]
graded  getLegalTransitions(A(B + A')):        []
```

Byte-identical to `boolean-laws.md:811-815`. The complement guard is at
`frontend/src/engine/laws/helpers.js:148-149`, inside the cited `:119-152`. **VERIFIED.**

### 3.3 Solver statistics over the 40 authored puzzles

| Check | Documented | Measured |
|---|---|---|
| solver finds the authored goal | 40 / 40 | 40 / 40 |
| solver step count differs from authored `optimalSteps` | 0 | 0 |
| law names on the shortest path | `Absorption Law 23, Distributive (Factor) 24, Absorption Law (Product) 23, Distributive (POS) 22, De Morgan's (AND→OR) 5, De Morgan's (OR→AND) 5, Complement Law 2, Complement Law (Product) 2`, five names at 0 | identical (the doc's table at `:851-866` is correct, though it lists `Absorption Law` before `Distributive (Factor)` while the reproduction command prints `Distributive` first — cosmetic only) |

The `§8` reproduction command at `:921-934` prints
`absorption | Absorption Law | A + AB = A | x absorbs xy → x | x` — exactly as documented.
**VERIFIED.**

### 3.4 Engine-only token not covered by any document

`frontend/src/engine/laws/scanHints.js:38` emits the bare token `'demorgan'`:

```js
else if (n.child.type === 'prod' || n.child.type === 'sum') add('demorgan', [p])
```

`'demorgan'` is neither a card id nor a `LAW_DEFINITIONS` id — it is a *third* engine-only token,
distinct from `distributive-expand`. Measured across all 40 puzzles, the hint scanner emits
`{absorption, demorgan, distributive, idempotent}` — `demorgan` is the **only** De Morgan hint token
ever produced, for **15** puzzles *(corrected after remediation — the original text of this section
said 16; the correct figure is 15, see [R1](#r1--correction-the-demorgan-hint-token-is-emitted-for-15-puzzles-not-16))*.
`boolean-laws.md:127` asserts "engine-only id: `distributive-expand`"
and `:151` prints `engine-only : [ 'distributive-expand' ]`; both are true of `LAW_DEFINITIONS` but
the document does not say so, and a reader will reasonably conclude the engine has exactly one
non-card id. See **m9** for the fix.

### 3.5 Completion semantics — verified in the direction that matters

`frontend/src/state/useGameState.js:437` is the win test and `:56` the dead-end resync; both compare
`canonText(...)` against `goalCanonRef.current`, canonicalised once at `:83` from `render.js:28`.
Measured: `canonText(parseExpr('x + y')) === canonText(parseExpr('y + x'))` → `true` (order
independent), while `canonText(parseExpr('x + xy')) !== canonText(parseExpr('x'))` even though
`isEquivalent(...)` → `true`. So the suite's repeated statement that completion is **canonical-text
equality, not semantic equivalence** is correct, and the citations for the non-consumers of
`isEquivalent` (`laws/helpers.js:77`, `:98`; `sandbox/generator.js:94`; `sandbox/input.js:161`) are
exact. **VERIFIED.** This is a genuinely valuable, non-obvious fact that the suite gets right.

### 3.6 Test suite

`cd frontend && npm test` → `# tests 76 / # suites 0 / # pass 76 / # fail 0 / duration_ms 9916`.
Engine tree: **30 files / 4,428 lines**, of which **23 non-test modules / 3,182 lines** and
**7 test files / 1,246 lines**. Every module line count matches `GROUND-TRUTH.md §4` and
`SDD.md:379-410`. **VERIFIED.**

---

## 4. Content audit

Method: `GET /api/levels`, `GET /api/laws`, and direct reads of `content/*.json`.

| Assertion | Measured | Verdict |
|---|---|---|
| exactly 10 laws with exact ids, in authoring order | `complement, idempotent, absorption, identity, annulment, distributive, double-neg, demorgan-and, demorgan-or, associative` | VERIFIED |
| 4 levels, ids `0,1,2,3`, `id 0` = Tutorial | `0 Tutorial, 1 Level 1, 2 Level 2, 3 Level 3 — Boss` | VERIFIED |
| `varCount` per level | `2, 2, 3, 4` | VERIFIED |
| `puzzleCount` per level | `4, 12, 12, 12` | VERIFIED |
| 40 puzzles total | `sum(len(puzzles)) == 40`; `grep -c '"expr"' == 40` | VERIFIED |
| exact 6-key puzzle shape | one key set only: `expr, goal, hints, optimalHint, optimalSteps, targetLaws` (in that document order) | VERIFIED |
| law-card keys | exactly `desc, formulas, id, name` | VERIFIED |
| every puzzle declares ≥ 1 target law | 40 / 40 | VERIFIED |
| **every puzzle ships 3 hints** | **37 / 40** — Tutorial stages 0, 2 and 3 ship **2** | **WRONG (M3)** |

**M3 — exact fix.** `docs/04-api/API-REFERENCE.md:1460`, cell 4: replace
"the hint texts, revealed one at a time by the UI; all 40 puzzles ship 3 hints" with
"the hint texts, revealed one at a time by the UI; 37 of the 40 puzzles ship 3 hints — Tutorial
stages 0, 2 and 3 ship 2." (Reproduce with
`python3 -c "import json;L=json.load(open('content/levels.json'));print([(l['id'],i,len(p['hints'])) for l in L for i,p in enumerate(l['puzzles']) if len(p['hints'])!=3])"`
→ `[(0, 0, 2), (0, 2, 2), (0, 3, 2)]`.)

Also verified: every puzzle's `optimalSteps` is reachable (`{1:10, 2:10, 3:10, 4:8, 7:2}`), the
authored `expr`/`goal` pairs are all semantically equivalent (40/40 via `isEquivalent`), and the
5-value `optimalSteps` set is consistent with the `§7` usage table.

---

## 5. Cross-link test

Method: an independent checker, `docs/_staging/verification/check-links.mjs`, using the **real
`github-slugger@2.0.0`** package (GitHub's own extracted implementation) with per-file state so that
duplicate headings are numbered the way GitHub numbers them. Raw output: `links.json`,
`anchor_classified.json`, `anchor_appendix.md`.

### 5.1 Results

| Metric | Value |
|---|---|
| Markdown files scanned | 40 (35 required + 5 legacy) |
| Relative links extracted | 1,538 |
| Links whose target does not exist | **5** — all to `verification-report.md` (see B1) |
| Links carrying a fragment | 740 |
| — GitHub `#Lnn` / `#Lnn-Lmm` line anchors into source files | 167 — **valid** GitHub blob anchors, not defects |
| — heading anchors | 573 |
| Heading anchors that do not resolve | **56** (54 same-page, 2 cross-file) |

### 5.2 Reconciliation with the suite's own gate

`node docs/_staging/tools/check-docs.mjs` reported **58** `BADANCH` findings when this audit began.
Set-differencing its list against the authoritative one:

| | Count (gate at audit start) |
|---|---|
| Gate findings | 58 |
| Authoritative findings | 56 |
| Intersection | **56** |
| Gate false positives | **2** |
| Gate false negatives | **0** |

So the gate found every genuine break — and two that are not breaks. The two false positives were
`docs/06-reference/error-codes.md:33` and `:101`, both linking to `#43-http_status`. The heading is
`### 4.3 \`http_<status>\``. GitHub's algorithm removes the angle brackets but keeps the word:
`github-slugger('4.3 \`http_<status>\`') === '43-http_status'`. The gate's old `slug()` at
`docs/_staging/tools/check-docs.mjs:118-125` added a non-GitHub step,
`.replace(/<[!/a-z].*?>/gi, '')`, which deleted the whole tag and yielded `43-http_`. **The documents
were right and the checker was wrong (M7).**

> **The tool changed while this audit was running.** `docs/_staging/tools/check-docs.mjs` was
> modified at `2026-09-28 14:09:29` and the `<[!/a-z].*?>` line is no longer present in `slug()`. The
> gate now reports **56** `BADANCH` — identical to the authoritative count, with zero false positives
> and zero false negatives. This is the only file that changed during the audit; **no document under
> audit changed** (the newest suite document, `docs/09-diagrams/DIAGRAMS.md`, was last written at
> `13:55:04`, before this audit began). The verifier did not edit the gate — see M7 for the
> before/after evidence.

### 5.3 Root cause of the 56 breaks

Every one is the same mistake: a heading containing ` — ` (space, U+2014, space) slugs to a **double**
hyphen, because GitHub deletes the dash and turns each surrounding space into a hyphen. The authors
used a single-hyphen slugger. Examples:

- `### 3.1 \`not_found\` — 404` → GitHub `#31-not_found--404`; written `#31-not_found-404`
  (14 occurrences in `error-codes.md` alone)
- `### 5.3 \`absorption\` — Absorption Law` → `#53-absorption--absorption-law`; written
  `#53-absorption-absorption-law`
- A second, rarer variant: a heading ending in removed punctuation keeps a **trailing** hyphen.
  `### 3.1 \`GET /\`` → `#31-get-`; written `#31-get`.
  `### 2.2 The one route outside the envelope: \`GET /\`` → `#22-the-one-route-outside-the-envelope-get-`;
  written `#22-the-one-route-outside-the-envelope-get`.

Two of the breaks are cross-file Contents links, so they break navigation from a *different* page:

- `docs/05-guides/tutorials/understanding-the-engine.md:528` → `../../06-reference/boolean-laws.md#53-absorption-absorption-law`
- `docs/05-guides/how-to/debug-a-failing-step.md:200` → `../tutorials/understanding-the-engine.md#13-stage-10-terminal-form-dead-ends-and-the-canonical-text-limitation`

All 56 are listed with their exact replacements in [Appendix A](#appendix-a--all-56-broken-anchors).

### 5.4 Citation targets (a second, independent mechanical test)

Every `` `path.ext:NN` `` / `:NN-MM` citation in the 35 required docs was resolved and range-checked:
**3,984** citations, **2,361** carrying a line number, **3,905** paths resolved on disk.

| Result | Count | Detail |
|---|---|---|
| Line numbers past EOF | **4** | all of them `frontend/vite.config.js:34-38` / `:35-38` (m5) |
| Citations whose entire target range is blank | **3** | two distinct root causes (m3, m4) |
| Paths that resolve only as historical/deleted files | 30 | all correctly labelled as deleted — see below |
| Paths that do not resolve at all | 49 | placeholders (`PascalCase.jsx`, `path/to/file.py`), URLs, or `verification-report.md` |

The 30 "historical path" citations (`frontend/src/lib/gameData.js`,
`backend/data/levels_data.py`, `lib/laws.js`, `frontend/src/utils/supabase.js`, `App.css`,
`auth_middleware.py`, `routers/score.py`) are **not** defects: `REFACTOR-NOTES.md` §6 introduces them
with "Deleted (verified absent now)" and `why-this-architecture.md:418-419` uses them in a
before/after table. Verified absent on disk, exactly as claimed.

---

## 6. Code-claim spot-check

Method: a curated, machine-checked claim table
(`docs/_staging/verification/claim_checks.sh`, 135 rows) plus the executed batches in §1–§4. Every
row records claim → doc + line → cited file → the exact expected token at the exact expected line.
**Result: 135 / 135 PASS** after correcting three of my own line guesses (which the table records so
the check is reproducible).

Claims were drawn from all seven ledgers and from every required document. A representative sample
of the 135, with the verdict on the ledger claims I re-derived independently:

| # | Claim | Doc + line | Evidence | Verdict |
|---|---|---|---|---|
| C01 | `EFFICIENCY_WEIGHT = 40.0` at `constants.py:9` | `06-reference/scoring-and-rewards.md:34` | `backend/config/constants.py:9` | VERIFIED |
| C15 | `MAX_STARS_PER_STAGE = 3` at `gameRules.js:46` | `scoring-and-rewards.md:43` | `frontend/src/config/gameRules.js:46` | VERIFIED |
| C20 | `return min(optimal, steps_used)` at `:88` | `scoring-and-rewards.md:88` | `backend/services/scoring_service.py:88` | VERIFIED |
| C21 | `Math.round((total / 100) * SCORE_BONUS_MAX_POINTS)` at `:80` | `scoring-and-rewards.md:397` | `frontend/src/engine/scoring.js:80` | VERIFIED |
| L01 | `distributive-expand` declared at `definitions.js:44` | `boolean-laws.md:821` | `frontend/src/engine/laws/definitions.js:44` | VERIFIED |
| L11 | `scanHints` emits bare `'demorgan'` at `:38` | — (claimed nowhere) | `frontend/src/engine/laws/scanHints.js:38` | gap → m9 |
| A12 | `X-Request-ID` set on every response at `middleware.py:61` | `API-REFERENCE.md:153` | `backend/core/middleware.py:61` | VERIFIED |
| A15 | `optional_user` at `security.py:38` | `API-REFERENCE.md:276` | `backend/core/security.py:38` | VERIFIED |
| D05 | `auth.uid()` appears nowhere in the schema | `SCHEMA.md:313-318` | `database/init.sql` — 0 matches | VERIFIED |
| D07 | `UNIQUE(user_id, level_id, stage_idx)` | `SCHEMA.md` (§stage_progress) | `database/init.sql:24` | VERIFIED |
| V02 | `render.yaml` declares no `healthCheckPath` | `monitoring.md:84` | `render.yaml:1-16` — key absent | VERIFIED |
| G27 | `preLawHighlightMs: 1500` at `gameRules.js:62` | `config-reference.md:159` | `frontend/src/config/gameRules.js:62` | VERIFIED |
| G38 | `bestStreak: Math.max(p.bestStreak, p.streak + 1)` at `:175` | `SCHEMA.md:101` cites `:173` | `progressStore.js:175` | line ref wrong → m8 |
| G52 | `content/laws.json` has an `associative` card | `boolean-laws.md:732` | `content/laws.json:81` | VERIFIED |
| G53 | `associative` appears nowhere in `definitions.js` | `boolean-laws.md:738` | 0 matches | VERIFIED |
| G20 | engine→config edges are exactly `scoring.js` and `sandbox/input.js` | `SAD.md:273` | both files, exact line hits | VERIFIED |

**Independent re-checks of the seven ledgers** (I did not trust their verdicts):

| Ledger | Sample re-derived | Outcome |
|---|---|---|
| `claims-backend-api.md` | 7 endpoints; `/openapi.json` path list; `main.py:79-83` router registration; all five 422 bodies; the 503 bodies | **All VERIFIED** |
| `claims-data-scoring.md` | `init.sql` is 58 lines with `CREATE TABLE` at `:7,16,28`; exactly 3 hits repo-wide; no `CREATE SCHEMA`; scoring constants | **All VERIFIED** |
| `claims-engine-guides.md` | `defineLaw` throw; card/engine id sets; the `A(B+A')` gate; 76 tests | **1 WRONG** — "15 name+form keys" (M4) |
| `claims-devops-ops.md` | `render.yaml` is one service, `sync: false` on two keys, no `healthCheckPath`; `vercel.json:3-6` / `:7-10` rewrites | **All VERIFIED** |
| `claims-diagrams.md` | `apiClient.js:63` is the only `fetch` in `frontend/src`; `validateExpr` called only from `sandbox/generator.js:84` and the barrel; `init.sql:24`, `:56-58`; 12/12 Mermaid | **All VERIFIED** |
| `claims-product-arch.md` | layered import direction; engine purity (only two outbound config edges) | **All VERIFIED** |
| `claims-project-ref.md` | file counts, `.e2e` inventory, backend/engine LOC, `gameRules.js` importer count | **1 WRONG** — row 4.9 says 22 importers; the count is 21 (m10) |

Independent facts I derived that the suite also states correctly and that I had not expected to
survive scrutiny: the live Render host really does serve the **pre-envelope** shapes
(`GET /api/levels` → bare array, `GET /api/progress` → `{"detail":"Not authenticated"}`, `GET /` →
the plain body) while exposing the same seven paths, so `deployment.md:380-400`'s "behind, not
ancient" characterisation is exactly right; `render.yaml` really has no `healthCheckPath`; there
really are **zero** backend test files and no `pytest` dependency; and the OpenAPI document really
has no `securitySchemes`.

---

## 7. Consistency audit

Method: every constant in the brief's list was grepped across the whole suite and every occurrence
compared; then every count-like figure was re-derived from the tree.

| Constant | Occurrences | Distinct values found | Verdict |
|---|---|---|---|
| 40 / 30 / 30 | 12 | `40/30/30` ×10, `40 / 30 / 30` ×2 — same numbers | consistent |
| 10 / 10 penalties | 1 + prose | `SCORE_PENALTY` 10/10 everywhere | consistent |
| bonus 5 | 14 | always `5` | consistent |
| stars 90 / 75 | 12 | 90 and 75 everywhere; `one: 1` | consistent |
| unlock 80 | 39 | `80`, `80.0`, `80 %`, `80%` — same number | consistent |
| guide cost 20 vs penalty 10 | 11 | never conflated; `scoring-and-rewards.md:537-544` explicitly separates them | consistent |
| 1350 ms / 1500 ms / 300 ms | 24 | 1350 and 1500 and 300 everywhere; the "2.5 s" figure appears only as a D12 quote | consistent |
| `maxVariables` 4 | 9 | `4` everywhere | consistent |
| backend 28 modules / 1,241 lines | 13 | `28` / `1,241` everywhere; changelog records the earlier "30" correction | consistent |
| engine 23 modules / 3,182 lines / 30 files / 4,428 lines / 7 tests / 1,246 lines | 21 | one consistent pair of figures, with the 22/4,428 trap explicitly warned against | consistent |
| 76 tests | 11 | `76`; the stale "46" appears only inside D11 tables | consistent |
| 19 `.e2e` / 16 wired | 6 | `19` and `16` everywhere | consistent |
| 9 routes / 7 endpoints / 3 tables | 15 | `9`, `7`, `3` everywhere | consistent |
| 40 puzzles / 10 laws | 21 | `40`, `10` everywhere | consistent |
| **`total` / `earnedPoints` range** | 4 | **`0–100` and `0–5` (and `0-100` in the legacy file) — contradicted by the code** | **INCONSISTENT → M2** |

**External truth checks behind those figures** (all re-derived, not copied): `git ls-files 'backend/*.py'`
→ 28; `wc -l` over those → 1,241; engine tree → 30 files / 4,428 lines, 23 non-test / 3,182,
7 tests / 1,246; `npm test` → 76/76; `ls .e2e/*.mjs` → 19; `grep -cE '^run ' .e2e/run-all-suites.sh`
→ 16; `App.jsx` route table → 9; `openapi()["paths"]` → 7; `grep -c 'CREATE TABLE' database/init.sql`
→ 3; puzzle sum → 40; `content/laws.json` → 10.

**Count defects found by this audit** (all MINOR, all in the file-map/RULES/ledger "who imports what"
tables):

- `file-map.md:545` — "These three modules are imported by **22** other frontend files, including
  6 engine modules." Measured: **24** files import one of the three (23 excluding the one test file);
  the "6 engine modules" half is correct (5 modules + 1 test file). **m1**
- `file-map.md:550` — "**22 modules**" for `gameRules.js`. Measured: **21** files import it (20
  excluding tests). **m2**
- `rules/RULES.md:242` — "Compliance: **22** modules import it". Same measurement, same error. **m2**
- The origin is the ledger's evidence command, `grep -rln "gameRules" frontend/src` → 22, which also
  matches a *comment* in `frontend/src/engine/index.js:10` ("external imports are plain data/constants
  (`config/gameRules.js`)"). The import-shaped count is 21. **m10**

---

## 8. Register audit

### 8.1 Coverage

`docs/07-explanation/known-limitations.md` carries **all 28 rows, D0–D27**, as 28 table rows
(`grep -c '^| \*\*D[0-9]'` → 28), introduced as "the **D0–D27** register" at `:4`, `:22` and `:54`,
and counted correctly at `:471` ("The register contains 28 rows, D0–D27"). Verified against
`GROUND-TRUTH.md` §7, which also has 28 rows. **VERIFIED.**

### 8.2 Spot-checks of register rows against the code

| Row | Claim | Verdict |
|---|---|---|
| D1 / D23 | no `/api/sandbox/*` endpoint; validation is client-side | VERIFIED — `openapi()["paths"]` has no sandbox path; `sandbox/validate.js:155`, `sandbox/input.js:109` exist |
| D3 | four dead Better Auth remnants | VERIFIED at `init.sql:4`, `vite.config.js:24-28`, `LandingPage.jsx:21`, `LevelSelectPage.jsx:142`; **but the `.gitignore` line number is wrong (m7)** |
| D7 | `POST /api/score` persists in the background | VERIFIED — `score.py:39` `background_tasks.add_task(progress_service.persist_score, …)` |
| D13 | CORS adds `http://localhost:3001` plus `FRONTEND_URL` | VERIFIED — `settings.py:23-27`, `:66-71` |
| D20 | RLS `FOR ALL USING (true)` on all three tables, no `auth.uid()` predicate | VERIFIED — `init.sql:56-58`; 0 matches for `auth.uid()` |
| D21 | Python `round()` vs JS `Math.round` | VERIFIED by execution (§2.2) |
| D22 | no OpenAPI security scheme | VERIFIED — `components.securitySchemes` absent; `security` absent on all seven operations |
| D24 | score is client-trusted and trivially maxable | VERIFIED by execution (§2.5) |
| D25 | `POST /api/progress/save` has no bounds validation | VERIFIED — `api/schemas/progress.py:11-22` has no validators; `init.sql` has no `CHECK` |
| D26 | unlock gate is frontend-only; `Math.round` before the compare | VERIFIED — `progressStore.js:301-303` rounds, `:309` compares; `UNLOCK_AVERAGE`/`STAR_THRESHOLDS` appear in `backend/` on their definition lines only |
| D27 | zero backend tests | VERIFIED — `find backend -name 'test_*.py'` → none; no `pytest` in `backend/requirements.txt` |

### 8.3 The late findings the brief called out — all correctly reflected

| Late finding | Where the suite states it | Verdict |
|---|---|---|
| deployed Render backend is stale (pre-envelope bodies) | `deployment.md:380-400`, `installation-manual.md:888` | VERIFIED by live probe (§6) |
| `render.yaml` declares no `healthCheckPath`, so `GET /` is intent not wiring | `monitoring.md:84-91`, `deployment.md:103-110` | VERIFIED |
| unlock gate is frontend-only and rounds before comparing, so 79.5 passes | `known-limitations.md:107`, `:211-212`; `scoring-and-rewards.md:519-520`; `DIAGRAMS.md:696`, `:742` | VERIFIED |
| `POST /api/score` is client-trusted; `stepsUsed: 0` → `total 100.0` | `scoring-and-rewards.md:581`; `known-limitations.md:94`; `DIAGRAMS.md` (D10 note) | VERIFIED |
| zero backend test files | `known-limitations.md:91`, `:585-590` | VERIFIED |
| no OpenAPI security scheme | `known-limitations.md:105`, `API-REFERENCE.md:435-445` | VERIFIED |

### 8.4 Silent contradictions of a register row

None found. Every appearance of a superseded value (`≥ 70 %`, "6 puzzles each", "3 levels",
"Coming Soon", "NOT integrated yet", "Auth: None", `app/core`, `src/screens`,
`POST /sandbox/validate`, `npx auth migrate`, port 3001, "2.5 s", "46 tests") is inside a D-row
table, a "Known discrepancy" callout, or a legacy file that `README.md:180-196` explicitly labels
`⚠️ LEGACY`. **This is the suite's strongest structural property.**

One arithmetic slip in the hub, however:

**M6 — exact fix.** `docs/README.md:209` reads "and a register of 20 proposal-vs-code discrepancies
— was established before writing began." The register has **28** rows (D0–D27). Replace `20` with
`28`.

---

## 9. Secret audit

Method: every value in `backend/.env` and `frontend/.env.local` was harvested in-memory and searched
for in all 35 suite docs, both in full and as distinctive 20-character head/tail slices. The three
legacy hits in `docs/context.md` were re-checked separately.

| Value | Length | Suite-doc hits |
|---|---|---|
| `SUPABASE_SERVICE_KEY` | 219 | **0** (full value, head slice, tail slice, payload slice) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 208 | **0** (full value, head slice, tail slice) |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` (project URL, `<project-ref>.supabase.co`) | 41 | **0** |
| `FRONTEND_URL`, `VITE_AUTH_URL` | 22 | matches, but both are public URLs (`https://praxis-seven-puce.vercel.app`, `http://localhost:3001`), already committed in `render.yaml:11` — not secrets |

**Result: no suite document reproduces a real credential value. CLEAN.**

The legacy `docs/context.md:232-233` still prints a `VITE_SUPABASE_URL`
(`https://<project-ref>.supabase.co`) and a `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…`
value — a **different** Supabase project from the one in `backend/.env` (I compared them in
memory and did not transcribe either). That is pre-existing (D15) and correctly described by
`known-limitations.md:70`, which also claims the values are "not repeated here or anywhere else in
the suite". I confirmed that claim: the two `context.md` §11 values (and any JWT-shaped token in
`context.md`) appear in **zero** suite documents. `docs/context.md` is tracked by git
(`git ls-files docs/context.md` confirms), so D15's "committed in a tracked file" wording is
accurate. No BLOCKER here.

---

## 10. Terminology audit

Method: `GROUND-TRUTH.md` §8's forbidden-synonym table was turned into greps over all 35 suite docs.

| Forbidden | Hits in suite docs | Verdict |
|---|---|---|
| parse tree | 0 (only in `glossary.md:60` and `RULES.md:751` as the *prohibited* term) | clean |
| AND-block / OR-block | 0 outside the prohibition tables | clean |
| factor group / chunk | 0 as a Boolean term (the 3 `chunk` hits are Vite bundle chunks) | clean |
| mid-state | 0 outside the prohibition table | clean |
| inverse form / mirror (as a synonym for *dual*) | **1** — see below | **1 defect (m11)** |
| "sum-of-products form" when abbreviating | used only on first use, then `SOP` (`boolean-laws.md:47`, `glossary.md:55`) | clean |
| student / user for tutor / learner | 0 in suite docs — the ~40 hits are all in the frozen rubric file | clean |
| "move" / "action" for *step* | 0 | clean |
| `app/`, `src/api`, `src/screens` | appear only as the *wrong* side of D17/D18 rows | clean |

**m11 — the one violation.** `docs/06-reference/boolean-laws.md:435`:

> "If the learner selects the long term first, the panel offers the **mirror** entry and the
> `survivorPath`/`absorbedPath` animation metadata point the other way."

Here "mirror" is used in the Boolean-algebra sense that `glossary.md:56` forbids. Replace `the mirror
entry` with `the reversed-order entry (the same law, emitted for the swapped selection)`. Note that
the other ~18 uses of "mirror" in the suite mean "the client-side copy of the scoring rules"
(`scoring.js`), which is standard English and not covered by the rule.

**Level-id 0-based/1-based confusion: none found.** All 25 occurrences of "0-based" / "1-based"
state the rule consistently, and four documents carry an explicit worked warning
(`API-REFERENCE.md:394-398`, `SCHEMA.md:150-151`, `ERD.md:165`, `add-a-new-problem.md:133`). The
`stage_idx` vs "Stage 1" distinction is called out in `ERD.md:172-173` and
`SCHEMA.md:151`. This was the highest-risk terminology item in the project and it is handled well.

---

## Verdict

**The suite is trustworthy for a new team member, with three caveats.**

What I could not break: the API reference is the best document in the set — 47 executed
observations, every one of the ~15 quoted JSON bodies reproduced byte-for-byte, including the
undocumented negative-`stageIdx` trap and the `503` content-unavailable path. Every scoring worked
example in two reference documents re-derives exactly, including the D21 rounding divergence and its
enumeration of the only three reachable totals that diverge. The engine documentation survives a
line-by-line re-run of its own reproduction commands, including the complement-gated
`distributive-expand` law, the 40/40 solver result and the law-usage histogram. All 28 register rows
exist, and no superseded value leaks out of a D-row into a normative statement anywhere in 21,705
lines.

Where it fails: navigation. **56 in-page anchors are dead** — 8 of them the entire Contents list of
`add-a-new-law.md`, 14 the code tables of `error-codes.md`, 11 the stage list of the engine
tutorial. A reader who clicks the Contents of the error-code reference gets nothing, six times over.
The cause is mechanical and the fixes are listed one by one in Appendix A. The second failure class
is a small set of affirmative false statements — the `0–100` score range, "all 40 puzzles ship 3
hints", "15 name+form keys", `ScoreResponse` as an OpenAPI component, "20 discrepancies" — each of
which a reader would have no reason to doubt.

**Four claims I could not verify** (not defects, but not evidence either):

1. Whether GitHub's *live* renderer produces `#31-get-` (trailing hyphen) for a heading ending in
   `GET /`. I verified it against `github-slugger@2.0.0`, the package extracted from GitHub's own
   implementation, and against cmark-gfm's documented anchor algorithm; I could not render a real
   GitHub page to confirm end to end.
2. The three `.e2e` suites that are *not* wired into `run-all-suites.sh` were not executed — they
   need a browser. Their existence is verified; their passing is not.
3. The five E2E-derived behaviours that need a live browser (`sandbox` typing debounce, mobile
   layout, tutorial gate) were verified only by reading the source, not by running the suites.
4. Whether `frontend/package-lock.json` is intentionally committed. `file-map.md` already records
   this as undeterminable, and I agree.

**Severity counts: BLOCKER 1 (resolved by this report) · MAJOR 7 (6 outstanding; M7 was remediated
in the gate while this audit was running) · MINOR 10 · NIT 4 = 22 findings.**

The one-line summary for a maintainer: **fix the 56 anchors in Appendix A first** — that is the whole
of the suite's broken navigation — then correct the five affirmative false statements (M2–M6), then
sweep the twelve line-reference errors (m1–m8, m10, m11). Nothing found requires re-reading code to
act on; each finding carries the replacement text.

---

## Findings, severity-tagged

### BLOCKER

**B1 — Five links pointed at a file that did not exist.**
`docs/README.md:20`, `docs/README.md:122`, `docs/README.md:220`,
`docs/10-project/changelog.md:65`, `docs/10-project/changelog.md:284` — all to
`verification-report.md`, the hub's "How do we know these docs are accurate?" destination.
*Fix:* resolved by creating `docs/verification-report.md` (this file). Re-run
`node docs/_staging/tools/check-docs.mjs` to confirm the link section is now clean.

### MAJOR

**M1 — 56 dead in-page anchors across 6 documents.**
Every one is a Contents entry, a cross-reference or a table-of-contents jump. Counts by file:
`06-reference/boolean-laws.md` 16, `06-reference/error-codes.md` 15,
`05-guides/tutorials/understanding-the-engine.md` 12, `05-guides/how-to/add-a-new-law.md` 8,
`04-api/API-REFERENCE.md` 3, `05-guides/how-to/debug-a-failing-step.md` 2.
Two of them are cross-file Contents links
(`understanding-the-engine.md:528`, `debug-a-failing-step.md:200`).
*Fix:* apply the exact anchor replacement for each row of [Appendix A](#appendix-a--all-56-broken-anchors).
Root cause to record for future writers: any heading containing ` — ` yields a **double** hyphen in
the anchor, and a heading ending in removed punctuation keeps a **trailing** hyphen. Add one line to
`docs/rules/RULES.md` §G (docs rules): "Anchor links must be generated with GitHub's algorithm —
punctuation is deleted, then every space becomes a hyphen, so ` — ` produces `--` and a trailing `:`
or `/` produces a trailing `-`. Generate anchors, never type them."

**M2 — The documented `total` (`0–100`) and `earnedPoints` (`0–5`) ranges are false.**
`docs/04-api/API-REFERENCE.md:967`, `:968`; `docs/03-database/SCHEMA.md:152`, `:243`.
Verified: `POST /api/score {"levelId":1,"stageIdx":0,"stepsUsed":1,"lawsUsed":[],"hintsUsed":-99}`
→ `200 {"hintIndependence":1020.0,"total":1060.0,"earnedPoints":53}`.
*Fix:* see §2.4 for the exact replacement text for all four cells and the missing limitation row.
The same false range is asserted in the code comment `backend/api/schemas/score.py:27`
(`total: float  # 0–100`) — worth correcting there too, though that is a code, not a doc, change.

**M3 — "all 40 puzzles ship 3 hints" is false.**
`docs/04-api/API-REFERENCE.md:1460`. Measured: 37/40; Tutorial stages 0, 2 and 3 ship 2 hints.
*Fix:* replace the cell with "the hint texts, revealed one at a time by the UI; 37 of the 40 puzzles
ship 3 hints — Tutorial stages 0, 2 and 3 ship 2."

**M4 — "15 distinct `name`+`form` keys" is false; the count is 16.**
`docs/06-reference/boolean-laws.md:125`. `LAW_DEFINITIONS` has 16 rows, 10 distinct ids, **16**
distinct `(form, name)` pairs and 15 distinct display names (`Identity Law` is declared for both
`sum` and `product`, which is exactly why `BY_NAME_AND_FORM` has 16 entries).
*Fix:* "**16 rows → 10 distinct ids** (16 distinct `name`+`form` keys; 15 distinct display names)".
Same correction needed in `docs/_staging/claims-engine-guides.md:19` and
`docs/_staging/diagram-input-engine-guides.md:144`.

**M5 — `ScoreResponse` is listed as an OpenAPI component schema but is not declared.**
`docs/04-api/API-REFERENCE.md:436-437` names eight schemas. Measured
`components.schemas` = `Envelope, ErrorBody, ProgressData, SaveProgressRequest, ScoreRequest,
ValidationError, HTTPValidationError` — **seven**. `ScoreResponse` never appears because
`backend/api/routes/score.py:20` declares `response_model=Envelope` and the route builds the
`ScoreResponse` object internally.
*Fix:* replace `ScoreRequest`, `ScoreResponse`, `HTTPValidationError` with
`` `ScoreRequest`, `ValidationError` and `HTTPValidationError` ``, and append: "`ScoreResponse`
(`backend/api/schemas/score.py:23-29`) exists as a Pydantic model but is **not** in the document,
because the route declares `response_model=Envelope` and dumps the model into `data`."

**M6 — "a register of 20 proposal-vs-code discrepancies" is false; the register has 28 rows.**
`docs/README.md:209`. `known-limitations.md:471` says "The register contains 28 rows, D0–D27".
*Fix:* change `20` to `28`.

**M7 — The suite's own gate was wrong about GitHub's slug algorithm, producing 2 false failures and
an untrustworthy PASS/FAIL signal. `STATUS: OBSERVED AND REMEDIATED DURING THIS AUDIT.`**
At the start of the audit, `docs/_staging/tools/check-docs.mjs:118-125` added
`.replace(/<[!/a-z].*?>/gi, '')` before the punctuation strip. GitHub's `github-slugger` does not
delete tag *contents* — it deletes only the angle brackets, which are ordinary punctuation.
Verified: `github-slugger('4.3 \`http_<status>\`') === '43-http_status'`, while the gate computed
`43-http_`. The gate therefore reported `docs/06-reference/error-codes.md:33` and `:101` as broken
when both links were correct — a delta of exactly 2 against the authoritative count of 56.
*Evidence of the before state:* `docs/_staging/verification/gate-output.txt` (captured at 14:00)
contains both `BADANCH … error-codes.md:33 -> #43-http_status` and `:101`, and a
`MINOR 58` summary. *Current state:* the file was modified at `2026-09-28 14:09:29`; the tag-strip
line is gone and the gate now reports **56** `BADANCH`, matching the `github-slugger` result exactly.
*Fix (already applied, retained here for the record):* keep the tag-strip deleted. Accepting only
`github-slugger` itself would be more robust than the hand-rolled character class.
*(Counted below under MAJOR because it was a live defect in the project's stated verification gate
for the whole time the suite was being written; it is no longer outstanding.)*

### MINOR

**m1 — `docs/10-project/file-map.md:545` — "These three modules are imported by 22 other frontend
files".** Measured: **24** files import one of `gameRules.js` / `storageKeys.js` / `appLinks.js`
(23 excluding the one test file). The "including 6 engine modules" half is correct.
*Fix:* change `22` to `24` and add "(23 excluding test files)".

**m2 — `docs/10-project/file-map.md:550` and `docs/rules/RULES.md:242` — "22 modules
import `gameRules.js`".** Measured: **21** files import it (20 excluding tests). The 22nd file,
`frontend/src/engine/index.js`, only *mentions* the path in a comment at `:10`.
*Fix:* in both places change `22` to `21` and, in `RULES.md`, add "(`22` files mention it; the 22nd,
`frontend/src/engine/index.js:10`, does so in a comment only)".

**m3 — `docs/02-architecture/REFACTOR-NOTES.md:269` and `:291` cite two line numbers that do not
contain the quoted code.** `backend/services/progress_service.py:51` is a **blank line**; `:102` is a
closing parenthesis. `persist_score` is defined at `:87` and writes
`"hints_used": outcome.assistance_used,` at `:101`.
*Fix:* both occurrences: replace `` `progress_service.py:51`, `:102` `` with
`` `progress_service.py:87`, `:101` `` (the `:116-121` citation at `:291` is correct as written).

**m4 — `docs/06-reference/scoring-and-rewards.md:608` cites `docs/context.md:143`, which is blank.**
The quoted sentence "Level 3: Permanently Coming Soon (no puzzles yet)" is at `docs/context.md:140`
(the `:139` citation on the same line is correct).
*Fix:* change `docs/context.md:143` to `docs/context.md:140`.

**m5 — Four citations run past the end of `frontend/vite.config.js`.** The file is **36** lines.
`docs/04-api/API-REFERENCE.md:57` (`:34-38`), `docs/04-api/API-REFERENCE.md:525` (`:35-38`),
`docs/06-reference/error-codes.md:640` (`:8,34-38`), `docs/06-reference/error-codes.md:690`
(`:34-38`).
*Fix:* the `/api` proxy block is `frontend/vite.config.js:29-34` (comment at `:29`, block `:30-33`,
closing brace `:34`). Replace `:34-38` and `:35-38` with `:29-34` in all four places.

**m6 — `docs/04-api/API-REFERENCE.md:93` cites the wrong range for the `/api/auth` Vite proxy.**
`frontend/vite.config.js:28-33` starts at the closing brace of `/api/auth` and ends inside the
unrelated `/api` block; the Better Auth proxy entry is `:24-28` (which is how nine other citations in
the suite render it).
*Fix:* change `frontend/vite.config.js:28-33` to `frontend/vite.config.js:24-28`.

**m7 — `docs/07-explanation/known-limitations.md:67` cites the wrong `.gitignore` line.**
`.gitignore:5` is blank; the orphaned `auth-server/node_modules/` entry is `.gitignore:4`.
*Fix:* change `.gitignore:5` to `.gitignore:4`.

**m8 — `docs/03-database/SCHEMA.md:101` cites `frontend/src/state/progressStore.js:173` for
`best_streak`.** Line 173 is `points: p.points + amount,`. The `bestStreak` high-water mark is
computed at `:175` (`bestStreak: Math.max(p.bestStreak, p.streak + 1),`), inside the `addPoints`
action that spans `:170-176`.
*Fix:* change `:173` to `:175`.

**m9 — The engine's third law token, `'demorgan'`, is undocumented, and its hint behaviour is
therefore unstated.** `frontend/src/engine/laws/scanHints.js:38` emits a bare `'demorgan'` token that
is neither a reference-card id nor a `LAW_DEFINITIONS` id — it is not `demorgan-and` or
`demorgan-or`. Measured across all 40 authored puzzles, the hint scanner emits
`{absorption, demorgan, distributive, idempotent}` and `demorgan` is the only De Morgan hint token
it ever produces (**15** puzzles — corrected; this finding's original text said 16, see
[R1](#r1--correction-the-demorgan-hint-token-is-emitted-for-15-puzzles-not-16)). `docs/06-reference/boolean-laws.md:127` and `:151` assert
"engine-only id: `distributive-expand`" without qualifying that the statement is about
`LAW_DEFINITIONS`; a reader will conclude the engine has exactly one non-card id.
*Fix:* in `docs/06-reference/boolean-laws.md:127`, change the cell to
"**`distributive-expand`** (in `LAW_DEFINITIONS`); the hint scanner additionally emits an un-suffixed
`demorgan` token (`laws/scanHints.js:38`) that matches neither card id — it is resolved to display
text by `state/hintText.js`, not by `LAW_NAME_TO_ID`". Add the same one-line note under the table at
`:151` and a row to `§5.8`/`§5.9`. (Alternatively, change `scanHints.js:38` to emit the correct
suffixed id — but then verify `hintText.js` still resolves it.)

**m10 — `docs/_staging/claims-project-ref.md:123` records a wrong verdict and a wrong method.**
Row 4.9 claims `gameRules.js` "is imported by **22** modules" with evidence
`grep -rln "gameRules" frontend/src` → 22 files. That pattern also matches a comment in
`frontend/src/engine/index.js:10`; the import-shaped count is **21** (20 excluding tests).
*Fix:* rewrite the row's claim to `21` and its evidence to
`` grep -rlE "from '[^']*config/gameRules(\.js)?'" frontend/src | wc -l `` → 21.

**m11 — `docs/06-reference/boolean-laws.md:435` uses the forbidden synonym "mirror" for *dual*.**
*Fix:* replace "the panel offers the mirror entry" with "the panel offers the reversed-order entry
(the same law, emitted for the swapped selection)".

### NIT

**N1 — Every "N lines" figure produced by the gate is one higher than `wc -l`.**
`docs/_staging/tools/check-docs.mjs:155` uses `text.split('\n').length`, which counts the empty
string after a trailing newline. `docs/09-diagrams/DIAGRAMS.md` is reported as 983 lines and
`RECREATE.md` records 983, but the file has **982** lines (`wc -l`); the required-suite total is
reported as 21,740 and is **21,705**.
*Fix:* in `check-docs.mjs`, use `text.replace(/\n$/, '').split('\n').length`; then correct the
`lines` field in `RECREATE.md`'s frozen-artifact table from 983 to 982. (The frozen hash
`sha256 8e27cee9da3e39e5cc2f4ef09b8073b8c085bcd10130ce9ee193d3156d81b4f4` **still matches the file on
disk today**, so that part of the claim is current, not stale.)

**N2 — `docs/10-project/file-map.md:89` calls all 19 `.mjs` files "suites".**
`:246` correctly splits them into "16 wired + 2 unwired suites + 1 shared harness". `_harness.mjs`
is a library, not a suite.
*Fix:* change `:89` to "18 `.mjs` suites + 1 shared harness + 1 runner shell script + 2 JSON
baselines".

**N3 — Five `vercel.json` citations use ranges that overshoot the rewrite they describe.**
`frontend/vercel.json` is 12 lines; the `/api` rewrite is `:3-6` and the SPA fallback is `:7-10`.
`frontend/vercel.json:2-7` (`04-api/API-REFERENCE.md:59`, `06-reference/error-codes.md:646`,
`:690`) and `frontend/vercel.json:3-8` (`01-product/SRS.md:200`, `02-architecture/SAD.md:85`,
`:458`) each include a line belonging to the other rule.
*Fix:* use `:3-6` for the `/api` rewrite and `:7-10` for the SPA fallback.

**N4 — `docs/06-reference/boolean-laws.md:112-116` shows the `defineLaw` failure as a single
`Error: …` line.** Running the quoted command verbatim also prints the module URL, the throwing
source line and a caret before the message. The message text itself is exact.
*Fix:* either append `  (the run also prints the module URL and source line first)` or change the
fence language from `text` to `text` with the leading lines elided as `…`.

---

## Appendix A — all 56 broken anchors

Generated with `github-slugger@2.0.0` against the headings actually present in each target file.
"Correct anchor" is the exact `#fragment` GitHub resolves for the heading in the next column.

| # | Source (doc:line) | Anchor as written | Heading it targets | Correct anchor |
|---|---|---|---|---|
| 1 | `04-api/API-REFERENCE.md:25` | `22-the-one-route-outside-the-envelope-get` | 2.2 The one route outside the envelope: `GET /` | `#22-the-one-route-outside-the-envelope-get-` |
| 2 | `04-api/API-REFERENCE.md:35` | `31-get` | 3.1 `GET /` | `#31-get-` |
| 3 | `04-api/API-REFERENCE.md:1700` | `22-the-one-route-outside-the-envelope-get` | 2.2 The one route outside the envelope: `GET /` | `#22-the-one-route-outside-the-envelope-get-` |
| 4 | `05-guides/how-to/add-a-new-law.md:12` | `1-step-0-pick-the-shape-then-the-module` | 1. Step 0 — pick the shape, then the module | `#1-step-0--pick-the-shape-then-the-module` |
| 5 | `05-guides/how-to/add-a-new-law.md:13` | `2-step-1-the-six-fields-of-a-law-identity` | 2. Step 1 — the six fields of a law identity | `#2-step-1--the-six-fields-of-a-law-identity` |
| 6 | `05-guides/how-to/add-a-new-law.md:14` | `3-step-2-prove-the-law-before-you-code-it` | 3. Step 2 — prove the law before you code it | `#3-step-2--prove-the-law-before-you-code-it` |
| 7 | `05-guides/how-to/add-a-new-law.md:15` | `4-step-3-wire-the-builders` | 4. Step 3 — wire the builders | `#4-step-3--wire-the-builders` |
| 8 | `05-guides/how-to/add-a-new-law.md:16` | `5-step-4-make-it-reachable-by-the-solver` | 5. Step 4 — make it reachable by the solver | `#5-step-4--make-it-reachable-by-the-solver` |
| 9 | `05-guides/how-to/add-a-new-law.md:17` | `6-step-5-hints-guide-and-hint-copy` | 6. Step 5 — hints, Guide and hint copy | `#6-step-5--hints-guide-and-hint-copy` |
| 10 | `05-guides/how-to/add-a-new-law.md:18` | `7-step-6-tests-that-actually-protect-the-law` | 7. Step 6 — tests that actually protect the law | `#7-step-6--tests-that-actually-protect-the-law` |
| 11 | `05-guides/how-to/add-a-new-law.md:19` | `8-step-7-content-animation-docs` | 8. Step 7 — content, animation, docs | `#8-step-7--content-animation-docs` |
| 12 | `05-guides/how-to/debug-a-failing-step.md:25` | `6-decision-tree-symptom-cause-fix` | 6. Decision tree: symptom → cause → fix | `#6-decision-tree-symptom--cause--fix` |
| 13 | `05-guides/how-to/debug-a-failing-step.md:200` | `13-stage-10-terminal-form-dead-ends-and-the-canonical-text-limitation` | 13. Stage 10 — terminal form, dead ends, and the canonical-text limitation | `#13-stage-10--terminal-form-dead-ends-and-the-canonical-text-limitation` |
| 14 | `05-guides/tutorials/understanding-the-engine.md:20` | `4-stage-1-tokenizing` | 4. Stage 1 — tokenizing | `#4-stage-1--tokenizing` |
| 15 | `05-guides/tutorials/understanding-the-engine.md:21` | `5-stage-2-parsing-into-an-ast` | 5. Stage 2 — parsing into an AST | `#5-stage-2--parsing-into-an-ast` |
| 16 | `05-guides/tutorials/understanding-the-engine.md:22` | `6-stage-3-rendering-nodetext-vs-canontext` | 6. Stage 3 — rendering: `nodeText` vs `canonText` | `#6-stage-3--rendering-nodetext-vs-canontext` |
| 17 | `05-guides/tutorials/understanding-the-engine.md:23` | `7-stage-4-normalising-normalize-vs-normalizeflat` | 7. Stage 4 — normalising: `normalize` vs `normalizeFlat` | `#7-stage-4--normalising-normalize-vs-normalizeflat` |
| 18 | `05-guides/tutorials/understanding-the-engine.md:24` | `8-stage-5-validation-and-what-is-not-validated` | 8. Stage 5 — validation, and what is *not* validated | `#8-stage-5--validation-and-what-is-not-validated` |
| 19 | `05-guides/tutorials/understanding-the-engine.md:25` | `9-stage-6-semantics-the-truth-table` | 9. Stage 6 — semantics: the truth table | `#9-stage-6--semantics-the-truth-table` |
| 20 | `05-guides/tutorials/understanding-the-engine.md:26` | `10-stage-7-discovering-the-applicable-laws` | 10. Stage 7 — discovering the applicable laws | `#10-stage-7--discovering-the-applicable-laws` |
| 21 | `05-guides/tutorials/understanding-the-engine.md:27` | `11-stage-8-choosing-and-applying-a-law` | 11. Stage 8 — choosing and applying a law | `#11-stage-8--choosing-and-applying-a-law` |
| 22 | `05-guides/tutorials/understanding-the-engine.md:28` | `12-stage-9-the-derivation-to-a-terminal-form` | 12. Stage 9 — the derivation to a terminal form | `#12-stage-9--the-derivation-to-a-terminal-form` |
| 23 | `05-guides/tutorials/understanding-the-engine.md:29` | `13-stage-10-terminal-form-dead-ends-and-the-canonical-text-limitation` | 13. Stage 10 — terminal form, dead ends, and the canonical-text limitation | `#13-stage-10--terminal-form-dead-ends-and-the-canonical-text-limitation` |
| 24 | `05-guides/tutorials/understanding-the-engine.md:374` | `13-stage-10-terminal-form-dead-ends-and-the-canonical-text-limitation` | 13. Stage 10 — terminal form, dead ends, and the canonical-text limitation | `#13-stage-10--terminal-form-dead-ends-and-the-canonical-text-limitation` |
| 25 | `05-guides/tutorials/understanding-the-engine.md:528` | `53-absorption-absorption-law` | 5.3 `absorption` — Absorption Law | `#53-absorption--absorption-law` |
| 26 | `06-reference/boolean-laws.md:18` | `3-the-cardengine-mismatch-read-this-before-adding-a-law` | 3. The card/engine mismatch — read this before adding a law | `#3-the-cardengine-mismatch--read-this-before-adding-a-law` |
| 27 | `06-reference/boolean-laws.md:21` | `51-complement-complement-law` | 5.1 `complement` — Complement Law | `#51-complement--complement-law` |
| 28 | `06-reference/boolean-laws.md:22` | `52-idempotent-idempotent-law` | 5.2 `idempotent` — Idempotent Law | `#52-idempotent--idempotent-law` |
| 29 | `06-reference/boolean-laws.md:23` | `53-absorption-absorption-law` | 5.3 `absorption` — Absorption Law | `#53-absorption--absorption-law` |
| 30 | `06-reference/boolean-laws.md:24` | `54-identity-identity-law` | 5.4 `identity` — Identity Law | `#54-identity--identity-law` |
| 31 | `06-reference/boolean-laws.md:25` | `55-annulment-annulment-law` | 5.5 `annulment` — Annulment Law | `#55-annulment--annulment-law` |
| 32 | `06-reference/boolean-laws.md:26` | `56-distributive-distributive-factor-distributive-pos` | 5.6 `distributive` — Distributive (Factor) & Distributive (POS) | `#56-distributive--distributive-factor--distributive-pos` |
| 33 | `06-reference/boolean-laws.md:27` | `57-double-neg-double-negation` | 5.7 `double-neg` — Double Negation | `#57-double-neg--double-negation` |
| 34 | `06-reference/boolean-laws.md:28` | `58-demorgan-and-de-morgans-andor` | 5.8 `demorgan-and` — De Morgan's (AND→OR) | `#58-demorgan-and--de-morgans-andor` |
| 35 | `06-reference/boolean-laws.md:29` | `59-demorgan-or-de-morgans-orand` | 5.9 `demorgan-or` — De Morgan's (OR→AND) | `#59-demorgan-or--de-morgans-orand` |
| 36 | `06-reference/boolean-laws.md:30` | `510-associative-associative-law-the-card-the-engine-does-not-implement` | 5.10 `associative` — Associative Law (the card the engine does not implement) | `#510-associative--associative-law-the-card-the-engine-does-not-implement` |
| 37 | `06-reference/boolean-laws.md:31` | `6-distributive-expand-the-internal-law-that-is-not-a-card` | 6. `distributive-expand` — the internal law that is not a card | `#6-distributive-expand--the-internal-law-that-is-not-a-card` |
| 38 | `06-reference/boolean-laws.md:158` | `6-distributive-expand-the-internal-law-that-is-not-a-card` | 6. `distributive-expand` — the internal law that is not a card | `#6-distributive-expand--the-internal-law-that-is-not-a-card` |
| 39 | `06-reference/boolean-laws.md:161` | `510-associative-associative-law-the-card-the-engine-does-not-implement` | 5.10 `associative` — Associative Law (the card the engine does not implement) | `#510-associative--associative-law-the-card-the-engine-does-not-implement` |
| 40 | `06-reference/boolean-laws.md:953` | `510-associative-associative-law-the-card-the-engine-does-not-implement` | 5.10 `associative` — Associative Law (the card the engine does not implement) | `#510-associative--associative-law-the-card-the-engine-does-not-implement` |
| 41 | `06-reference/boolean-laws.md:954` | `6-distributive-expand-the-internal-law-that-is-not-a-card` | 6. `distributive-expand` — the internal law that is not a card | `#6-distributive-expand--the-internal-law-that-is-not-a-card` |
| 42 | `06-reference/error-codes.md:23` | `31-not_found-404` | 3.1 `not_found` — 404 | `#31-not_found--404` |
| 43 | `06-reference/error-codes.md:24` | `32-content_unavailable-503` | 3.2 `content_unavailable` — 503 | `#32-content_unavailable--503` |
| 44 | `06-reference/error-codes.md:25` | `33-upstream_error-502` | 3.3 `upstream_error` — 502 | `#33-upstream_error--502` |
| 45 | `06-reference/error-codes.md:26` | `34-unauthorized-401` | 3.4 `unauthorized` — 401 | `#34-unauthorized--401` |
| 46 | `06-reference/error-codes.md:27` | `35-validation_error-422` | 3.5 `validation_error` — 422 | `#35-validation_error--422` |
| 47 | `06-reference/error-codes.md:28` | `36-http_error-404-405-any-framework-status` | 3.6 `http_error` — 404 / 405 / any framework status | `#36-http_error--404--405--any-framework-status` |
| 48 | `06-reference/error-codes.md:29` | `37-internal_error-500` | 3.7 `internal_error` — 500 | `#37-internal_error--500` |
| 49 | `06-reference/error-codes.md:92` | `31-not_found-404` | 3.1 `not_found` — 404 | `#31-not_found--404` |
| 50 | `06-reference/error-codes.md:93` | `32-content_unavailable-503` | 3.2 `content_unavailable` — 503 | `#32-content_unavailable--503` |
| 51 | `06-reference/error-codes.md:94` | `33-upstream_error-502` | 3.3 `upstream_error` — 502 | `#33-upstream_error--502` |
| 52 | `06-reference/error-codes.md:95` | `34-unauthorized-401` | 3.4 `unauthorized` — 401 | `#34-unauthorized--401` |
| 53 | `06-reference/error-codes.md:96` | `35-validation_error-422` | 3.5 `validation_error` — 422 | `#35-validation_error--422` |
| 54 | `06-reference/error-codes.md:97` | `36-http_error-404-405-any-framework-status` | 3.6 `http_error` — 404 / 405 / any framework status | `#36-http_error--404--405--any-framework-status` |
| 55 | `06-reference/error-codes.md:98` | `37-internal_error-500` | 3.7 `internal_error` — 500 | `#37-internal_error--500` |
| 56 | `06-reference/error-codes.md:363` | `33-upstream_error-502` | 3.3 `upstream_error` — 502 | `#33-upstream_error--502` |

---

## Appendix B — reproduction artifacts

All verifier scratch lives under `docs/_staging/verification/`. Nothing outside that directory and
this report was created or modified.

| Artifact | What it is | Re-run with |
|---|---|---|
| `api_audit.py` / `api_audit.json` / `api_audit_clean.json` | 47 TestClient observations, including all error paths | `cd backend && ./venv/bin/python ../docs/_staging/verification/api_audit.py` |
| `numeric_audit.py` / `numeric_audit.json` | Every scoring example re-derived, plus the negative-input probes and the reachable-total enumeration | `cd backend && ./venv/bin/python ../docs/_staging/verification/numeric_audit.py` |
| `engine_audit.mjs` / `engine_audit2.mjs` (+ `_clean.json`) | Engine exports, law-id sets, hint tokens across all 40 puzzles, completion semantics | `node docs/_staging/verification/engine_audit.mjs` |
| `check-citations.mjs` / `citations.json` | 3,984 `file:line` citations resolved and range-checked | `node docs/_staging/verification/check-citations.mjs` |
| `check-links.mjs` / `links.json` / `anchor_classified.json` / `anchor_appendix.md` | Authoritative link + anchor checker using `github-slugger@2.0.0` | `cd docs/_staging/verification && node check-links.mjs` |
| `claim_checks.sh` | 135 machine-checked claims (`PASS=135 FAIL=0`) | `bash docs/_staging/verification/claim_checks.sh` |
| `gate-output.txt` | The suite gate's output as captured at the start of the audit, including the two `#43-http_status` false positives and the `MINOR 58` summary — the before-state evidence for M7 | `node docs/_staging/tools/check-docs.mjs` (now reports 56) |
| `heading_slugs.txt` | Every heading and its GitHub slug for the 6 affected files | see §5.2 |
| `verify_docs.sh` | One-shot re-run of the whole battery | `bash docs/_staging/verification/verify_docs.sh` |

Two artifacts were rebuilt and re-run rather than trusted: the Mermaid parser gate
(`docs/_staging/tools/.mermaid-check/`, whose `node_modules` had been deleted — rebuilt with
`--cache ./.npm-cache` because the default `~/.npm` cache is read-only in this environment) and the
suite gate itself. The Mermaid gate reports **`ALL 12 MERMAID FENCES PARSE OK`** with the expected
tail (`PASS #12 (line 897) flowchart TB -> flowchart-v2`) and exit code 0, and the frozen hash
`sha256 8e27cee9da3e39e5cc2f4ef09b8073b8c085bcd10130ce9ee193d3156d81b4f4` **matches
`docs/09-diagrams/DIAGRAMS.md` today**, so the "12/12 PASS" claim is current, not stale.
**⚠️ Both figures in this paragraph are superseded — see the note immediately below.**

> **Superseded after remediation.** That hash and the `(line 897)` tail were true when written. The
> diagrams writer corrected the score ranges in its `erDiagram` input afterwards, so `DIAGRAMS.md`
> is now **995** lines with `sha256 422ec86a94ef09b837ffdd493aeb7869a3b214e9e3cf30d062c00706e3b97004`
> and its 12th fence at line **910**. See R6/ND-5.

---

# Post-remediation re-verification — 2026-09-28

**What this is.** An independent second-pass audit of the remediation round that followed this
report. The 22 findings above were re-opened one by one, the two open writer disputes were
adjudicated by execution, and the whole suite was swept again for regressions. Nothing was taken
from the writers, from the Lead, or from this report's own text.

**Independence.** The re-verifier wrote none of the 35 documents, none of the 7 claim ledgers, none
of `GROUND-TRUTH.md`, and none of the findings above. Every probe was re-implemented from scratch
and executed from `/tmp`; the only file this pass edited is this one — the addendum below, plus the
inline correction in §3.4 and m9 carried in **R1**.

**What changed since the original audit.** The remediation touched ~15 documents; the required
suite grew from 21,705 to **21,830** lines (`wc -l`, 35 files) and `DIAGRAMS.md` from 982 to 995.
Fresh numbers in R5.

---

## R1 — Correction: the `demorgan` hint token is emitted for 15 puzzles, not 16

§3.4 and finding **m9** claimed the bare `demorgan` token from
`frontend/src/engine/laws/scanHints.js:38` is produced "for 16 puzzles". engine-guides disputed it
and measured 15 of 40. **engine-guides is right and the original text of this report was wrong.**
The two places have been corrected inline; this section is the evidence.

**Method (independent).** `parseExpr(p.expr)` → `scanHints(ast, 'R', { allowExpand: false })` over
all 40 puzzles in `content/levels.json`, collecting `hint.law` per puzzle. Re-implemented, not
copied from the Lead's command or from the prior verifier's scripts.

| Measurement | Result |
|---|---|
| Puzzles whose hint scan emits a `demorgan` token | **15** |
| Total `demorgan` hint occurrences across the 40 puzzles | **19** |
| Distinct tokens over all 40 puzzles | `absorption`, `demorgan`, `distributive`, `idempotent` |
| Per-token **puzzle** counts | `absorption` 27, `distributive` 22, **`demorgan` 15**, `idempotent` 2 |
| `demorgan-and` / `demorgan-or` emitted by `scanHints` | **0 / 0** |
| Puzzles reaching a De Morgan law via `analyzeNot` | 15 (the same 15) |
| Puzzles whose `targetLaws` name a `demorgan-*` id | 15 (the same 15) |

The 15 are `0:2, 1:4, 1:5, 1:6, 1:7, 1:10, 1:11, 2:4, 2:5, 2:8, 2:9, 3:4, 3:5, 3:8, 3:9`
(`level:stage`) — i.e. exactly the puzzles whose start expression contains a negated group.

### Where "16" came from

Three candidate causes were tested; the third is decisive.

1. **Counting `demorgan-and` / `demorgan-or` as well — excluded.** `scanHints` emits neither, ever
   (0 occurrences, measured above), so no union of hint tokens can reach 16. The card ids are also
   reached by `analyzeNot` on exactly the same 15 puzzles, so even a union across *both* code paths
   stays at 15.
2. **A `lawIdOf` fallthrough — excluded as a counting cause.** The fallthrough is real and was
   reproduced: `LAW_NAME_TO_ID` is keyed by display name and has no `demorgan` entry, so
   `lawIdOf('demorgan')` returns `'demorgan'` (`frontend/src/engine/scoring.js:25-28`), while
   `lawIdOf("De Morgan's (AND→OR)")` correctly returns `demorgan-and`. But the fallthrough maps a
   token to *itself*; it cannot add a 16th puzzle. It is documented correctly at
   `boolean-laws.md:158-166`.
3. **The decisive evidence — the original measurement was 15 and the prose said 16.**
   `docs/_staging/verification/engine_audit2.json` is the artifact this report cites for §3.4. Its
   `perPuzzle` object has 40 entries, **15** of them carrying `demorgan` in `hintTokens`, and its
   own aggregate is `{"absorption":27,"distributive":22,"demorgan":15,"idempotent":2}` — identical
   to the numbers above. The measurement was never wrong; "16" was a transcription slip in the
   report prose that then propagated into m9.

A related artefact worth recording: the *first* audit script, `engine_audit.mjs:66`, reads `h.id`
from `scanHints` results, which expose `{ law, paths }` — its `hintLawIds` therefore came out
`[null]` in `engine_audit_clean.json`. That broken first pass produced no puzzle count at all, so it
is not the source of 16 either; it explains why `engine_audit2.mjs` was written.

**No fourth number.** Eight different methods — expression scan, goal scan, per-sub-node scan,
`allowExpand: true`, `analyzeNot`, `analyzeSelection` over all node pairs, authored-hint text search,
and `targetLaws` union — were each run; **every one returns 15**.

**Conclusion.** The suite's current figure (**15**, at `docs/06-reference/boolean-laws.md:164`) is
correct. This report was wrong; m9's finding (the token is undocumented) stands and is now fixed in
the document.

---

## R2 — Adjudication: "not capped at `MAX_SCORE` in either direction" was misleading; data-scoring is right

§2.4 (M2's fix text) ended: *"the score is not capped at `MAX_SCORE` in either direction."*
data-scoring refused that wording, arguing it implies `total` can go negative, which it cannot. The
scorer was executed at both extremes, through the service and through the HTTP route.

| Probe | `efficiency` | `targetLaw` | `hintIndependence` | `total` | `earnedPoints` |
|---|---|---|---|---|---|
| A — all-negative (`stepsUsed −100`, `hintsUsed −99`, `guidesUsed −99`, `lawsUsed []`) | 40.0 | 0.0 | 2010.0 | **2050.0** | 102 |
| A′ — extreme (`hintsUsed −9999`, `guidesUsed −9999`) | 40.0 | 0.0 | 200010.0 | **200050.0** | 10002 |
| B — floored (`stepsUsed 100000`, `hintsUsed 100000`, `guidesUsed 100000`) | 0.0 | 0.0 | 0.0 | **0.0** | 0 |
| C — baseline ground-truth body | 40.0 | 30.0 | 30.0 | 100.0 | 5 |
| D — `stepsUsed: 0` (D24) | 40.0 | 30.0 | 30.0 | 100.0 | 5 |

`total < 0` was **never** reachable; `total == 0.0` is reachable and is the exact floor.
`earnedPoints < 0` likewise never. The clamp sites are exactly as data-scoring cited them:

- `backend/services/scoring_service.py:96` — `max(0.0, EFFICIENCY_WEIGHT − over × STEP_PENALTY)`
- `backend/services/scoring_service.py:112-115` — `max(0.0, HINT_INDEPENDENCE_WEIGHT − assistance × ASSISTANCE_PENALTY)`
- `backend/services/scoring_service.py:103-107` — `matched / len(target_laws) × TARGET_LAW_WEIGHT`, a
  ratio on `[0, 1]` (and a flat 30.0 when the puzzle declares no target laws)

So `efficiency ∈ [0, 40]`, `target_law ∈ [0, 30]`, `hint_independence ∈ [0, ∞)`, and therefore
**`total ≥ 0` unconditionally and unbounded above**.

**Verdict: data-scoring's wording is correct and this report's original replacement sentence was
wrong.** The documents now say "no upper cap; the only lower floor is 0"
(`SCHEMA.md:243`, `scoring-and-rewards.md` limitation row 5, `API-REFERENCE.md:971-972`), which is
the accurate formulation. The rest of M2 — that the documented `0–100` / `0–5` ranges were
affirmatively false — stands unchanged.

---

## R3 — Adjudication: `known-limitations.md` register arithmetic (product-arch's reworded line)

The reworded `docs/07-explanation/known-limitations.md:10-12` claims *"28 rows — 23 places where a
written claim (in `context.md`, the original task brief or the LAWS rubric) is contradicted by the
code, plus 5 defects found by executing the system — split 17 High, 9 Medium and 2 Low."*

### R3.1 The 23 + 5 = 28 split — **CONFIRMED**

28 rows parse from the register (D0–D27, IDs unique and complete). Exactly **5** rows carry
"Not claimed anywhere" in the "Proposal says" cell — **D22, D24, D25, D26, D27** — and those are
precisely the five the sentence calls "defects found by executing the system". The remaining 23
include the two brief-vs-code rows **D1** and **D23**, which the sentence explicitly covers by
naming "the original task brief". The wording of the split is accurate.

### R3.2 The 17 / 9 / 2 severity split — **REFUTED**

Reading the severity cell of every row:

| Severity | Count | IDs |
|---|---|---|
| High | **17** | D0, D1, D2, D3, D4, D5, D6, D7, D9, D10, D17, D19, D20, D21, D23, D24, D25 |
| Medium | **8** | D8, D12, D14, D15, D18, D22, D26, D27 |
| Low | **3** | D11, **D13**, D16 |

The claim "17 High, 9 Medium and 2 Low" is self-consistent only because §12's summary table also
lists **D13 under Medium** — while D13's own row (`known-limitations.md:70`) marks it **Low**, as
does `GROUND-TRUTH.md` §7. The summary and the register therefore contradict each other on one
cell. **New defect ND-1.**

---

## R4 — Status of all 22 findings

Every finding was re-opened and re-measured. "Evidence" names what *this* pass executed or read.

| # | Sev | Status | Evidence re-checked in this pass |
|---|---|---|---|
| **B1** | BLOCKER | **RESOLVED** | `docs/verification-report.md` exists (956 lines after this addendum). Independent link scan of all 57 Markdown files under `docs/`: 1,612 relative links, **0 broken file targets** — including the five `README.md` / `changelog.md` links to this file. |
| **M1** | MAJOR | **RESOLVED** | Real `github-slugger@2.0.0`: 777 anchor-bearing links (561 same-page, 49 cross-file, 167 GitHub `#Lnn`), **0 broken anchors**. All 56 Appendix A rows machine-checked: **56/56 corrected anchors present, 0 lingering wrong anchors**. The three the Lead's tool flagged are **false positives** — `slug()` returns exactly `6-decision-tree-symptom--cause--fix`, `58-demorgan-and--de-morgans-andor`, `59-demorgan-or--de-morgans-orand`. |
| **M2** | MAJOR | **RESOLVED** | `API-REFERENCE.md:971-972` now qualify the ranges ("for every non-negative input"); `SCHEMA.md:152`, `:243`, `:244` corrected; **also fixed beyond the ask** and disclosed: `ERD.md:53`, `:68-69`, `:150-151` erDiagram comments and `docs/_staging/diagram-input-data-scoring.md:45`, `:60-61`. No unqualified `0–100` / `0–5` assertion remains in any required doc. Scorer executed at both extremes (R2). |
| **M3** | MAJOR | **RESOLVED** | `API-REFERENCE.md:1470` now reads "37 of the 40 puzzles ship 3 hints — Tutorial stages 0, 2 and 3 ship 2". Independently measured: 40 puzzles, the only non-3-hint entries are `(level 0, stages 0, 2, 3)` with 2 each → 37/40. |
| **M4** | MAJOR | **RESOLVED** | `boolean-laws.md:125` now "16 rows → 10 distinct ids (16 distinct `name`+`form` keys; 15 distinct display names…)". Both ledgers fixed too: `claims-engine-guides.md:19`, `diagram-input-engine-guides.md:144`. |
| **M5** | MAJOR | **RESOLVED** | Live `GET /openapi.json`: **7** components.schemas (`Envelope, ErrorBody, HTTPValidationError, ProgressData, SaveProgressRequest, ScoreRequest, ValidationError`), no `securitySchemes`, 7 paths. `API-REFERENCE.md:438-439` lists exactly those seven and explains why `ScoreResponse` (`backend/api/schemas/score.py:23-29`) is absent. |
| **M6** | MAJOR | **RESOLVED** | `README.md:220` now "a register of 28 proposal-vs-code discrepancies (D0–D27, 17 of them serious)"; `known-limitations.md:473` says 28 rows. Register re-counted: 28. |
| **M7** | MAJOR | **RESOLVED** | The `<[!/a-z].*?>` tag-strip is **gone** from `check-docs.mjs`'s `slug()`; the tool loads the real `github-slugger` named `slug` export (`:124-148`). `slug('4.3 \`http_<status>\`') === '43-http_status'` reproduced; the two formerly-false `error-codes.md:33`, `:101` links resolve; gate reports **0 MINOR**. |
| **m1** | MINOR | **RESOLVED** | `file-map.md:545` now **24** (23 excluding tests). Measured independently: 24 files import one of the three config modules, 23 excluding `__tests__`, 6 under `engine/`. |
| **m2** | MINOR | **RESOLVED** | `file-map.md:550` and `rules/RULES.md:242` now **21** (20 excluding tests), with the "22nd file mentions it in a comment" note. Measured: import-shaped regex → 21/20; the old text-match method → 22. |
| **m3** | MINOR | **RESOLVED** | `REFACTOR-NOTES.md:269` and `:291` now cite `progress_service.py:87`, `:101`. Verified: `:87` is `def persist_score(...)`, `:101` is `"hints_used": outcome.assistance_used,`. |
| **m4** | MINOR | **RESOLVED** | `scoring-and-rewards.md:608` now cites `docs/context.md:140`. Verified: line 140 is `**Level 3:** Permanently "Coming Soon" (no puzzles yet)`. |
| **m5** | MINOR | **RESOLVED** | No `vite.config.js:34-38` / `:35-38` citation remains in any required doc; the four sites now read `:29-34` (`API-REFERENCE.md:57`, `:529`; `error-codes.md:655`, `:705`). |
| **m6** | MINOR | **RESOLVED** | `API-REFERENCE.md:93` now cites `frontend/vite.config.js:24-28` (the `/api/auth` block). |
| **m7** | MINOR | **RESOLVED** | `known-limitations.md:69` (was `:67`) now cites `.gitignore:4`. Verified: `.gitignore:4` is `auth-server/node_modules/`, `:5` is blank. |
| **m8** | MINOR | **RESOLVED** | `SCHEMA.md:101` now cites `frontend/src/state/progressStore.js:175`. Verified: `:175` is `bestStreak: Math.max(p.bestStreak, p.streak + 1),`. |
| **m9** | MINOR | **RESOLVED** | `boolean-laws.md:127` now scopes the engine-only claim to `LAW_DEFINITIONS` and names the `demorgan` token; `:151-166` carries the scope note, the `lawIdOf` fallthrough and the measured counts — now correctly **15** (R1). |
| **m10** | MINOR | **RESOLVED** | `claims-project-ref.md:123` claims **21** (20 excluding tests) and records the corrected evidence command plus the original error. Re-measured: 21/20. |
| **m11** | MINOR | **RESOLVED** | `boolean-laws.md:435` (now `:449`) reads "the reversed-order entry (the same law, emitted for the swapped selection)". No Boolean-sense "mirror" remains; the surviving `mirrors` at `:579` is the ordinary verb. |
| **N1** | NIT | **RESOLVED** | `check-docs.mjs:188` now uses `text.replace(/\n$/, '').split('\n').length`. Gate reports `DIAGRAMS.md` **995** = `wc -l` 995; required-suite total **21,830** = my independent sum 21,830. `RECREATE.md` updated to `lines 995`. |
| **N2** | NIT | **RESOLVED** | `file-map.md:89` now "18 `.mjs` suites + 1 shared harness + 1 runner shell script + 2 JSON baselines". Measured: 19 `.mjs`, `_harness.mjs` the only library, 16 wired. |
| **N3** | NIT | **RESOLVED** | All six named required-doc citations now use `vercel.json:3-6` / `:7-10` (`API-REFERENCE.md:59`; `error-codes.md:661`, `:705`; `SRS.md:200`; `SAD.md:85`, `:458`). No `:2-7` or `:3-8` remains in a required doc. (Two stale rows survive in a staging ledger — ND-4.) |
| **N4** | NIT | **NOT RESOLVED** | `boolean-laws.md:113-116` still presents the quoted command's output as a single `Error: …` line. Re-ran it verbatim: Node prints the module URL, the throwing source line and a caret **before** the message (4 extra lines). The message text itself is byte-exact. Fix in ND-6. |

**Tally: 21 RESOLVED · 0 PARTIALLY RESOLVED · 1 NOT RESOLVED (N4, a cosmetic NIT).**

---

## R5 — Fresh gate results

### R5.1 Links and anchors — 0 broken

Independent checker, `github-slugger@2.0.0`, per-file slugger state, code fences skipped:

| Metric | Value |
|---|---|
| Markdown files under `docs/` scanned | 57 (35 required + 5 legacy + this report + 16 staging) |
| Relative links extracted | **1,612** |
| — broken file targets | **0** |
| Anchor-bearing links | **777** |
| — same-page anchors | 561 |
| — cross-file heading anchors | 49 |
| — GitHub `#Lnn` / `#Lnn-Lmm` line anchors (valid by construction) | 167 |
| — broken heading anchors | **0** |
| Files containing duplicate headings (which would make the gate's stateless `slug` unsafe) | **0** |

The gate itself agrees: `node docs/_staging/tools/check-docs.mjs` → `BLOCKER 0 / MAJOR 0 / MINOR 0 /
NIT 0`, `RESULT: PASS`, exit code 0.

*Counts are for the suite as remediated, before this addendum. Re-run after appending it (the
addendum adds 2 links and 2 same-page anchors): **1,614 links / 779 anchor links, still 0 broken**.*

### R5.2 Citation range-check — 0 out-of-range, 0 blank in the required suite

Every resolvable `` `path:NN` `` / `` `path:NN-MM` `` / continuation `` `:NN` `` citation in all 57
files was resolved on disk and range-checked against the real file length.

| Metric | Value |
|---|---|
| Resolvable `file:line` citations checked | **3,441** |
| Out of range (line past EOF) — **required docs** | **0** |
| Citations whose entire target range is blank — **required docs** | **0** |
| Out of range — staging/report | 7 (5 are this report's own historical descriptions of m5; 2 are ND-3) |
| Blank target — staging/report | 13 (11 are this report's / the anchor appendix's historical descriptions of m3, m4, m7, M3; 1 describes the m4 fix; 1 is ND-2) |

*(Re-run after appending this addendum: **3,492** resolvable citations; required-doc out-of-range
still **0**, required-doc blank still **0**. The report file itself now also carries this
addendum's own quotations of the defective values, which is why its own residuals grow.)*

The five extra blank-line citations product-arch claimed to have fixed beyond m3/m4 were verified
line by line: `why-this-architecture.md:168` and `design-decisions.md:476` now cite
`backend/supabase_client.py:18-19` (non-blank); `PRD.md:331` cites `init.sql:39`,
`progress_service.py:101`, `scoring_service.py:51`; `SRS.md:322` cites `progress_service.py:101`,
`scoring_service.py:51`; `SRS.md:470` cites `render.yaml:1-16`, `vercel.json:3-6`, `:5`. All five
targets are non-blank and on-topic. **The document half of that claim is true; the "plus ledger
rows" half is not — see ND-2.**

### R5.3 Mermaid parser gate — 12/12 PASS

```
node docs/_staging/tools/.mermaid-check/validate-mermaid.mjs docs/09-diagrams/DIAGRAMS.md
→ Mermaid fences found: 12 · PASS #1…#12 · ALL 12 MERMAID FENCES PARSE OK · exit 0
```

Last fence now at line **910** (not the 897 recorded in Appendix B above).
`sha256sum docs/09-diagrams/DIAGRAMS.md` →
`422ec86a94ef09b837ffdd493aeb7869a3b214e9e3cf30d062c00706e3b97004`, matching the frozen hash in
`RECREATE.md`. The `node_modules` tree RECREATE.md says was deleted is present again (229 MB).

### R5.4 Secrets — CLEAN

Every value in `backend/.env` and `frontend/.env.local` was harvested in memory and searched across
all 57 `docs/**/*.md` as the full value and as 20-character head and tail slices:

| Value | Length | Full | Head-20 | Tail-20 |
|---|---|---|---|---|
| `SUPABASE_SERVICE_KEY` | 219 | 0 | 0 | 0 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 208 | 0 | 0 | 0 |
| `SUPABASE_URL` | 41 | 0 | 0 | 0 |
| `VITE_SUPABASE_URL` | 41 | 0 | 0 | 0 |

No JWT-shaped token appears in any suite document. The only env-value hits anywhere are
`FRONTEND_URL` / `VITE_AUTH_URL` = `http://localhost:5173/` — public URLs, not credentials — and the
three pre-existing `docs/context.md:232-233` legacy values, which remain a different project's
publishable key and are correctly described by D15.

### R5.5 Terminology and consistency spot-checks — no regressions

Forbidden synonyms (parse tree, AND-block, OR-block, mid-state, factor group, Boolean-sense
"mirror") → **0** hits outside the prohibition tables. All seven corrected counts re-derived
independently: 16 `name`+`form` keys / 15 display names; 7 OpenAPI schemas; 28 register rows;
24/23 config importers; 21/20 `gameRules.js` importers; 18 `.mjs` suites + 1 harness; 56/56 anchors.
No numeric regression was introduced by the remediation.

---

## R6 — New defects found by this pass

None is a BLOCKER or MAJOR. ND-1 and ND-2 sit inside the files the remediation edited; ND-3,
ND-4 and ND-5 are pre-existing defects the original audit's tests could not see (it audited the 35
required docs for citations and treated any partially-blank range as acceptable).

**ND-1 — MINOR — the register's severity split contradicts its own D13 row.**
`docs/07-explanation/known-limitations.md:12` and the §12 table (`:480-483`) both classify **D13**
as *Medium*, giving "17 High, 9 Medium and 2 Low". D13's own row at `:70` — and `GROUND-TRUTH.md` §7
— mark it **Low**. The register's rows are **17 High / 8 Medium / 3 Low**.
*Fix (make the summary match the rows, which GROUND-TRUTH supports):* in `:12` change
"split 17 High, 9 Medium and 2 Low" to "split 17 High, 8 Medium and 3 Low"; in §12's table remove
`D13` from the **Medium** row (leaving `D8, D12, D14, D15, D18, D22, D26, D27` and the count `8`)
and add it to the **Low** row (`D11, D13, D16`, count `3`).

**ND-2 — MINOR — a ledger row product-arch reported as fixed still cites a blank line.**
`docs/_staging/claims-product-arch.md:180` still reads "…plus `.gitignore:5` and a vestigial
`VITE_AUTH_URL`". `.gitignore:5` is blank; the Better Auth remnant is `.gitignore:4`.
*Fix:* change `.gitignore:5` to `.gitignore:4` in that row.

**ND-3 — MINOR — two staging-ledger citations run past EOF.**
`docs/_staging/claims-devops-ops.md:122` and `:123` cite
`frontend/src/components/puzzle/AssistanceControls.jsx:15-40`; the file is **36** lines. The hint
button is at `:13`, the Guide button at `:25` and the `(20p)`/`(Free)` cost label at `:32`.
*Fix:* in both rows change `AssistanceControls.jsx:15-40` to `AssistanceControls.jsx:13-32`.

**ND-4 — NIT — two stale `vercel.json` ranges survive in a staging ledger.**
`docs/_staging/claims-backend-api.md:198` and `:199` cite `frontend/vercel.json:2-7`, the range N3
replaced everywhere else (it straddles both rewrites).
*Fix:* change both to `frontend/vercel.json:3-6`.

**ND-5 — NIT — Appendix B's frozen-artifact paragraph is now stale.**
The closing paragraph of Appendix B (and `RECREATE.md`'s "Expected tail" block) still give
`sha256 8e27cee9…` and `PASS #12 (line 897)`. After the score-range correction `DIAGRAMS.md` is
995 lines, `sha256 422ec86a…`, 12th fence at line **910**. `RECREATE.md`'s frozen-artifact table was
updated; its expected-tail block and this report's Appendix B were not.
*Fix:* in `docs/_staging/tools/.mermaid-check/RECREATE.md` change `PASS #12 (line 897)` to
`PASS #12 (line 910)`; in Appendix B above, replace the two hash/line values with `422ec86a…` and
`(line 910)`. (Left unedited here on purpose: this pass may only append, not rewrite the record.)
Also note: `RECREATE.md` says the 229 MB `node_modules` tree "was removed after the gate ran" — it
is present on disk again.

**ND-6 — NIT — N4's fix was never applied.**
`docs/06-reference/boolean-laws.md:113-116` still shows the `defineLaw` failure as one line.
*Fix:* append to the fence a line
`    at Module.defineLaw (…/definitions.js:82:11)   (Node also prints the module URL and source line first)`
or elide with `…` before the `Error:` line and add "(leading module URL and source line elided)".

**ND-7 — NIT — four required-doc `NFR-7` rows cite the wrong `.gitignore` rule.**
`docs/01-product/PRD.md:312` and `docs/01-product/SRS.md:193`, `:537` cite `.gitignore:4-5` and
`SRS.md:463` cites `.gitignore:4` as the evidence that env files are ignored. Root `.gitignore:4` is
the Better Auth remnant and `:5` is blank; `backend/.env` is ignored by `.gitignore:3` (`.env`) and
`frontend/.env.local` by `frontend/.gitignore:15` (`*.local`) — which is exactly how
`installation-manual.md:222-223` and `configuration-guide.md:358-359` render it.
*Fix:* change the `NFR-7` citations to `.gitignore:3` and `frontend/.gitignore:15`
(`SRS.md:463`, which also covers D14, to `.gitignore:3`; `SRS.md:537` likewise).

**Advisory (not a defect).** `docs/10-project/glossary.md:760` says "the bonus range is only 0–5
points". True for the non-negative totals the surrounding D21 rounding discussion is about, but it
is the one place in the suite where the `0–5` range appears without the "for non-negative inputs"
qualifier the remediation added elsewhere. Optional: append "for non-negative inputs".
`backend/api/schemas/score.py:27` still carries the false `total: float  # 0–100` comment; that is a
code change, already disclosed at `API-REFERENCE.md:1772`.

---

## R7 — Revised verdict

**The remediation is real, and the suite is now trustworthy without the caveats the original verdict
carried.**

Of the 22 original findings, **21 are RESOLVED** and the single outstanding item is **N4 — a NIT
about the shape of a quoted error message**, not a false statement. Both regression classes that
made the original verdict conditional are gone:

- **Navigation is fixed.** 777 anchor-bearing links, **0 broken**, confirmed with the real
  `github-slugger@2.0.0` and with all 56 Appendix A rows checked individually. The dead Contents
  lists in `add-a-new-law.md`, `error-codes.md` and the engine tutorial now resolve. The gate is
  trustworthy: it loads the real slugger and its line counts are `wc -l`-accurate, and it reports
  `RESULT: PASS`.
- **The affirmative false statements are gone.** `0–100`/`0–5` is now qualified in the reference,
  the schema, the ERD comments and the diagram input; "all 40 puzzles ship 3 hints" is now "37 of
  40"; "15 `name`+`form` keys" is now 16; `ScoreResponse` is correctly described as absent from the
  OpenAPI document; "a register of 20 discrepancies" is now 28. The one figure the *report itself*
  got wrong — the `demorgan` hint token, 16 vs **15** — is corrected in R1, and the documents were
  right.

**What is still wrong is small and enumerated.** Seven new items, all MINOR or NIT: one real
internal contradiction in the register's own severity summary (ND-1, D13 counted as Medium while
its row says Low), one ledger row the remediation claimed to have fixed but did not (ND-2), two
staging-ledger line-range errors (ND-3, ND-4), two stale frozen-artifact figures (ND-5), the
unapplied N4 cosmetic fix (ND-6), and four mis-targeted `.gitignore` citations for NFR-7 (ND-7).
Each carries exact replacement text; none requires re-reading code.

**Trust assessment for a new team member:** *trust the suite, verify the staging ledgers.* The 35
deliverable documents now survive an execution-based audit — 1,612 links, 3,441 `file:line`
citations, 777 anchors, 40 engine puzzles, both scoring extremes, 12 Mermaid fences, 28 register
rows and a full secret sweep all re-derived from scratch with **zero broken links, zero
out-of-range citations, zero blank-line citations and zero leaked credentials**. The claim ledgers
under `docs/_staging/` are the only files where residue remains, and they are working notes rather
than deliverables.

*Re-verification performed 2026-09-28. No file other than this report was edited.*
