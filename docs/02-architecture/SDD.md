# SDD — Praxis Software Design Description

**What this is.** The module-by-module design of Praxis: every backend module and every
frontend folder, the key functions with their signatures, the shared data structures, the
design patterns in use and the runtime flows they produce. Where [SAD.md](SAD.md) explains
*how the system is shaped*, this document explains *how each piece is built*.

**Who it's for.** A developer about to change code. Read the [SAD](SAD.md) first for the
mental model, then use this as the index into the parts. Every claim carries `file:line`;
signatures are quoted from the source.

---

## Contents

1. [How to read this document](#1-how-to-read-this-document)
2. [Backend module inventory](#2-backend-module-inventory)
3. [Backend design, layer by layer](#3-backend-design-layer-by-layer)
4. [Frontend folder inventory](#4-frontend-folder-inventory)
5. [Frontend design, folder by folder](#5-frontend-design-folder-by-folder)
6. [Key data structures](#6-key-data-structures)
7. [Design patterns in use](#7-design-patterns-in-use)
8. [Main runtime flows](#8-main-runtime-flows)
9. [Known discrepancies affecting this document](#9-known-discrepancies-affecting-this-document)

---

## 1. How to read this document

Three facts keep this document short enough to use:

- **The backend is small.** 28 Python modules / 1,241 lines — including seven one-line
  `__init__.py` files. Every module is listed in §2 and every one is described in §3.
- **The engine is where the difficulty is.** 23 modules / 3,182 lines of pure JavaScript
  (30 files / 4,428 lines including its 7 test files). §5.1 covers it module by module.
- **Two numbers are conventions, not mistakes.** `hooks/` holds 8 files;
  `components/` holds 10 top-level modules plus 6 feature folders.

A reader who wants *one* entry point: read `frontend/src/engine/index.js:1-84` (the engine
barrel) and `frontend/src/components/puzzle/usePuzzleSession.js:1-30` (the workspace
orchestrator). Together they describe the shape of the whole product.

## 2. Backend module inventory

Complete: all 28 modules, with lines and responsibility.

| Module | Lines | Responsibility | Key public names |
|---|---|---|---|
| `backend/main.py` | 83 | Application assembly only: logging, CORS, middleware, exception handlers, routers | `app` (`:25`) |
| `backend/supabase_client.py` | 102 | Hand-rolled Supabase REST/Auth adapter over `httpx` | `SupabaseRESTClient`, `supabase` (`:102`) |
| `backend/config/__init__.py` | 1 | Package marker | — |
| `backend/config/settings.py` | 75 | Env loading, CORS origin construction, `Settings` singleton | `settings`, `Settings`, `build_cors_origins`, `require_env` |
| `backend/config/constants.py` | 26 | Every scoring weight, penalty, bonus, rounding rule and progression threshold | 9 constants |
| `backend/core/__init__.py` | 1 | Package marker | — |
| `backend/core/errors.py` | 81 | Error-code vocabulary and the `AppError` hierarchy | `ErrorCode`, `AppError`, 4 subclasses |
| `backend/core/responses.py` | 60 | The `{success, data, error}` envelope | `Envelope`, `ErrorBody`, `success`, `failure`, `error_response`, `internal_error_response` |
| `backend/core/security.py` | 43 | Bearer-token auth as FastAPI dependencies | `get_current_user` (`:17`), `optional_user` (`:38`) |
| `backend/core/middleware.py` | 62 | Request-id correlation and one access-log line per request | `RequestContextMiddleware` (`:23`), `REQUEST_ID_HEADER` (`:18`) |
| `backend/core/logging.py` | 76 | One-JSON-object-per-line formatter and the request-id `ContextVar` | `JsonFormatter`, `configure_logging`, `get_logger`, `log_fields`, `set_request_id`, `reset_request_id` |
| `backend/api/__init__.py` | 1 | Package marker | — |
| `backend/api/routes/__init__.py` | 1 | Package marker | — |
| `backend/api/routes/health.py` | 18 | `GET /` liveness probe, deliberately outside the envelope | `router`, `read_health` (`:16`) |
| `backend/api/routes/laws.py` | 21 | `GET /api/laws` | `read_laws` (`:19`) |
| `backend/api/routes/levels.py` | 27 | `GET /api/levels`, `GET /api/levels/{level_id}` | `read_levels` (`:19`), `read_level` (`:25`) |
| `backend/api/routes/score.py` | 49 | `POST /api/score`; scores, then persists in the background | `compute_score` (`:21`) |
| `backend/api/routes/progress.py` | 41 | `GET /api/progress`, `POST /api/progress/save` | `get_progress` (`:21`), `save_progress` (`:27`) |
| `backend/api/schemas/__init__.py` | 1 | Package marker | — |
| `backend/api/schemas/score.py` | 29 | Transport models for scoring; field names are a frozen contract | `ScoreRequest` (`:13`), `ScoreResponse` (`:23`) |
| `backend/api/schemas/progress.py` | 22 | Transport models for the progress snapshot | `ProgressData` (`:11`), `SaveProgressRequest` (`:21`) |
| `backend/repositories/__init__.py` | 1 | Package marker | — |
| `backend/repositories/content_repository.py` | 62 | The only module that knows where content lives; `lru_cache`d reads | `CONTENT_DIR` (`:16`), `list_laws` (`:35`), `list_levels` (`:41`), `list_level_summaries` (`:46`), `get_level` (`:60`) |
| `backend/repositories/progress_repository.py` | 73 | Every Supabase statement; transport failures become `UpstreamError` | `get_user_progress_row` (`:29`), `list_stage_progress_rows` (`:37`), `get_best_score` (`:45`), `insert_score_history` (`:57`), `upsert_stage_progress` (`:62`), `upsert_user_progress` (`:71`), `_execute` (`:21`) |
| `backend/services/__init__.py` | 1 | Package marker | — |
| `backend/services/content_service.py` | 42 | Content plus its not-found semantics | `list_level_summaries` (`:14`), `list_laws` (`:19`), `get_level` (`:24`), `get_puzzle` (`:32`) |
| `backend/services/scoring_service.py` | 115 | The authoritative scoring algorithm | `ScoreOutcome` (`:16`), `compute_score` (`:32`) |
| `backend/services/progress_service.py` | 127 | Merge stored rows, write snapshots, record finished scores | `load_progress` (`:18`), `build_progress` (`:25`), `save_progress` (`:53`), `persist_score` (`:87`) |

**Verification surface for the backend: there is no automated test suite, no `conftest.py`
and no `pytest` dependency.** Everything below is therefore described from source, not from
tests — see [SRS.md](../01-product/SRS.md) §9.

## 3. Backend design, layer by layer

### 3.1 `main.py` — assembly

```python
app = FastAPI(title="Praxis API", version="1.0.0")     # backend/main.py:25
```

`main.py` holds no business logic. In order it:

1. installs JSON logging and creates the module logger (`:22-23`),
2. adds `RequestContextMiddleware` **then** `CORSMiddleware` — added inner-first so CORS
   stays outermost and its headers land on every response including the middleware's 500
   (`:27-36`),
3. registers four exception handlers — `AppError` (`:39`), Starlette `HTTPException` (`:50`),
   `RequestValidationError` (`:60`), and a bare `Exception` last resort (`:69`),
4. includes five routers: `health` unprefixed, the other four under `/api` (`:79-83`).

The handler order matters: a named `AppError` renders with **its own** HTTP status
(`backend/core/responses.py:46-52`); a framework error is re-wrapped as `http_error`; a body
validation failure stays `422` but moves inside the envelope with the pydantic error list as
`detail` (`:65`).

### 3.2 `config/`

```python
def require_env(name: str) -> str: ...                        # backend/config/settings.py:30
def build_cors_origins(frontend_url: str | None) -> list[str] # backend/config/settings.py:66
settings = Settings.from_env()                                # backend/config/settings.py:75
```

- `load_dotenv(BACKEND_DIR / ".env", override=False)` runs first so the app works from any
  working directory, then python-dotenv's own cwd search as a fallback; real environment
  variables always win (`:19-20`).
- `DEFAULT_CORS_ORIGINS` is a 3-tuple of dev origins; `build_cors_origins` appends
  `FRONTEND_URL` when set and de-duplicates in order (`:23-27`, `:66-71`).
- **`settings` is an import-time singleton.** A missing `SUPABASE_URL` or
  `SUPABASE_SERVICE_KEY` raises `RuntimeError` while the module is imported, so the process
  cannot boot at all — including to serve `GET /api/levels`, which needs no Supabase
  (`:30-38`, `:74-75`).

`constants.py` is a flat namespace of numbers, deliberately not a class:

| Constant | Value | Line | Consumed by |
|---|---|---|---|
| `EFFICIENCY_WEIGHT` | 40.0 | `:9` | `_efficiency` |
| `TARGET_LAW_WEIGHT` | 30.0 | `:10` | `_target_law` |
| `HINT_INDEPENDENCE_WEIGHT` | 30.0 | `:11` | `_hint_independence` |
| `MAX_SCORE` | 100.0 (derived) | `:12` | `earned_points` |
| `STEP_PENALTY` | 10.0 | `:15` | `_efficiency` |
| `ASSISTANCE_PENALTY` | 10.0 | `:16` | `_hint_independence` |
| `MAX_BONUS_POINTS` | 5 | `:19` | `earned_points` |
| `SCORE_ROUNDING_DP` | 1 | `:22` | `total`, `target_law` |
| `STAR_THRESHOLDS` | `(90.0, 75.0)` | `:25` | frontend contract only — no server code reads it |
| `UNLOCK_AVERAGE` | `80.0` | `:26` | frontend contract only — no server code reads it |

### 3.3 `core/`

**`errors.py`** — a two-level design: a string vocabulary (`ErrorCode`, `:11-21`) plus one
`AppError` base whose subclasses supply defaults and whose instances may override any field
per raise site (`:23-46`).

| Class | `default_code` / `status` |
|---|---|
| `NotFoundError` | `not_found` / 404 |
| `ContentUnavailableError` | `content_unavailable` / 503 |
| `UpstreamError` | `upstream_error` / 502 |
| `UnauthorizedError` | `unauthorized` / 401 |

**`responses.py`** — one envelope, four helpers: `success(data)` (`:32`), `failure(code,
message, detail)` (`:37`), `error_response(exc, headers=None)` (`:46`) and
`internal_error_response()` (`:55`), which exists so the middleware's last-resort 500 never
leaks internals.

**`security.py`** — two dependencies over one implementation:

```python
async def get_current_user(request: Request) -> dict[str, Any]   # :17
async def optional_user(request: Request) -> dict[str, Any] | None  # :38
```

`get_current_user` reads `authorization`, requires the literal `Bearer ` prefix, calls
`supabase.get_user(token)`, and maps outcomes: `httpx.HTTPError` → `UpstreamError` (502);
falsy user → `UnauthorizedError` (401); otherwise the user dict is returned whole (`:19-35`).
`optional_user` catches **only** `UnauthorizedError`, which is precisely why
`POST /api/score` works signed-out (`:38-42`).

**`middleware.py`** — `RequestContextMiddleware.dispatch` (`:26`) implements the five-step
sequence described in [SAD.md](SAD.md) §8.2. Two details are load-bearing:

- the request id is echoed from `X-Request-ID` when present, else minted with
  `uuid.uuid4().hex` (`:27`);
- the header is set **after** the `finally` block, on the way out, so it is present on
  success, on the framework's error responses and on the middleware's own 500 (`:61`).

**`logging.py`** — `JsonFormatter.format` (`:37`) builds the payload
`{ts, level, logger, message, request_id}`, merges `record.fields`, and appends `exception`
when there is a traceback. `configure_logging` (`:56`) is idempotent via a module-global flag
so repeated imports do not stack handlers. `log_fields(**fields)` (`:74`) drops `None` values
so log lines stay compact.

### 3.4 `api/schemas/`

Pydantic models whose **field names are a frozen contract with the SPA**
(`backend/api/schemas/score.py:1`, `backend/api/schemas/progress.py:1`). Nothing else in the
backend uses camelCase; these do, because renaming a field breaks the client.

| Model | Fields |
|---|---|
| `ScoreRequest` | `levelId:int`, `stageIdx:int`, `stepsUsed:int`, `lawsUsed:list[str]`, `hintsUsed:int`, `guidesUsed:int|None=0`, `optimalSteps:int|None=None` |
| `ScoreResponse` | `efficiency:float`, `targetLaw:float`, `hintIndependence:float`, `total:float`, `earnedPoints:int`, `breakdown:dict[str,Any]` |
| `ProgressData` | `points:int=0`, `streak:int=0`, `bestStreak:int=0`, `stageProgress:dict[str,list[int]]={}`, `stageScores:dict[str,int|float]={}` |
| `SaveProgressRequest` | `progress: ProgressData` |

`stageScores` uses `int | float` deliberately: "the `int \| float` union keeps whole scores as
ints so the value written to Supabase is byte-identical to the request"
(`backend/api/schemas/progress.py:15-18`).

### 3.5 `api/routes/`

Every route is a thin transport: validate → call one service → wrap in `success()`.

| Route | Signature | Behaviour |
|---|---|---|
| `read_health` | `() -> dict[str, Any]` `health.py:16` | Returns the plain payload; **not** wrapped, because Render reads the body verbatim (`:1-3`) |
| `read_laws` | `() -> dict[str, Any]` `laws.py:19` | `success(content_service.list_laws())` |
| `read_levels` | `() -> dict[str, Any]` `levels.py:19` | `success(content_service.list_level_summaries())` |
| `read_level` | `(level_id: int) -> dict[str, Any]` `levels.py:25` | Delegates; the service raises `NotFoundError` → 404 |
| `compute_score` | `(req: ScoreRequest, background_tasks: BackgroundTasks, user = Depends(optional_user)) -> dict[str, Any]` `score.py:21` | Calls `scoring_service.compute_score(...)`, and **only when `user` is truthy** adds `progress_service.persist_score` as a background task; then maps the frozen `ScoreOutcome` onto `ScoreResponse` and returns `payload.model_dump()` (`:27-48`) |
| `get_progress` | `(user = Depends(get_current_user)) -> dict[str, Any]` `progress.py:21` | `success(progress_service.load_progress(user["id"]))` |
| `save_progress` | `(req: SaveProgressRequest, user = Depends(get_current_user)) -> dict[str, Any]` `progress.py:27` | Unpacks the camelCase body into snake_case service arguments and returns `{"status":"ok"}` |

The `score` route is the most interesting design decision in the backend: **persistence is a
side effect that cannot fail the response.** `background_tasks.add_task(...)` runs after the
response is sent, and `persist_score` swallows every exception (`progress_service.py:123-127`).

### 3.6 `services/`

**`content_service.py`** — adds exactly one thing over the repository: not-found semantics.
`get_level` raises `NotFoundError(f"Level {level_id} not found")` when the repository returns
`None` (`:24-29`); `get_puzzle` raises for `stage_idx >= len(puzzles)` and documents that a
negative index keeps resolving Python-style, so `-1` is the last stage (`:32-42`).

**`scoring_service.py`** — the authoritative implementation, written as a small pipeline of
private helpers over one frozen value object.

```python
@dataclass(frozen=True)
class ScoreOutcome:                       # scoring_service.py:16
    level_id: int; stage_idx: int; steps_used: int
    laws_used: tuple[str, ...]            # as submitted, duplicates included
    assistance_used: int                  # hints + guides — the figure stored as hints_used
    efficiency: float; target_law: float; hint_independence: float
    total: float; earned_points: int; breakdown: dict[str, Any]

def compute_score(*, level_id, stage_idx, steps_used, laws_used,
                  hints_used, guides_used, optimal_steps) -> ScoreOutcome   # :32
```

The pipeline: resolve the puzzle (raising 404 for an unknown level/stage) → resolve the
optimal step count → parse the target laws and the applied laws into sets → compute three
bands → sum and round → build the breakdown dict (`:43-77`).

Three subtleties are worth naming because each has been a source of confusion:

```python
def _resolve_optimal(optimal_steps, puzzle, steps_used) -> int:   # :80
    optimal = optimal_steps if (optimal_steps is not None and optimal_steps > 0) \
              else puzzle.get("optimalSteps", steps_used)
    return min(optimal, steps_used)          # a shorter solution lowers the bar
```

```python
def _target_law(target_laws, applied_laws) -> float:              # :99
    if not target_laws:
        return constants.TARGET_LAW_WEIGHT    # no target laws declared -> full marks
    matched = len(target_laws & applied_laws)
    return round((matched / len(target_laws)) * constants.TARGET_LAW_WEIGHT,
                 constants.SCORE_ROUNDING_DP)
```

```python
assistance_used = (hints_used or 0) + (guides_used or 0)          # :51
earned_points = round((total / constants.MAX_SCORE) * constants.MAX_BONUS_POINTS)  # :55
```

The last line is Python's `round()`, i.e. **banker's rounding**, while the client mirror uses
JS `Math.round` (half-up) — they disagree at exact `.5` totals [D21].

**`progress_service.py`** — three responsibilities in one module, each a pure-ish function:

```python
def load_progress(user_id: str) -> dict[str, Any]                 # :18
def build_progress(user_progress, stages) -> dict[str, Any]       # :25
def save_progress(*, user_id, points, streak, best_streak,
                  stage_progress, stage_scores) -> None           # :53
def persist_score(user_id: str, outcome: ScoreOutcome) -> None    # :87
```

`build_progress` is a pure merge: it groups `stage_progress` rows into
`{level_key: [stage_idx, …]}` (de-duplicating, `:33-39`), collects strictly-positive
`best_score` values into `{"level:stage": score}` (`:41-42`), and falls back to `0` for every
total when no `user_progress` row exists (`:44-50`). Note the deliberate `> 0` guard: a stored
`best_score` of `0` does **not** appear in `stageScores`.

`save_progress` writes the totals row once, then one row per completed stage, reading the
score from `stageScores` with a default of `0` (`:72-84`).

`persist_score` is the transactional core of the score flow: insert one `score_history` row,
read the current best, and raise `stage_progress.best_score` only when the new total is
strictly greater (`:93-122`). The whole body is wrapped in `except Exception` that logs and
returns (`:123-127`) — hence "best-effort persistence".

### 3.7 `repositories/`

**`content_repository.py`** — the only module that knows where content lives.

```python
CONTENT_DIR = Path(__file__).resolve().parents[2] / "content"   # :16 — <repo>/content
```

`_load(filename)` opens and parses, converting `FileNotFoundError` and `json.JSONDecodeError`
into `ContentUnavailableError` (503) whose `detail` names the path and explains that `content/`
must ship beside the backend (`:19-31`). `list_laws` and `list_levels` are decorated
`@lru_cache(maxsize=None)` (`:34`, `:40`) — the cache is process-global, so **a content edit
needs a restart** and tests that mutate content must clear the cache.
`list_level_summaries` projects each level down to `{id, name, desc, varCount, puzzleCount}`
(`:46-57`), a shape the frontend duplicates deliberately at
`frontend/src/content/gameContent.js:22`.

**`progress_repository.py`** — six functions, all built from the same two-line shape:

```python
def _execute(builder: Any) -> Any:                     # :21
    try:
        return builder.execute()
    except httpx.HTTPError as exc:
        raise UpstreamError("Progress storage is unavailable", detail=str(exc)) from exc
```

Table names and the conflict target are module constants (`:15-18`), so a table rename is a
one-line change. Queries are expressed in the client's chainable DSL:

```python
supabase.table(STAGE_PROGRESS_TABLE).select("best_score") \
        .eq("user_id", user_id).eq("level_id", level_id).eq("stage_idx", stage_idx)  # :48-53
supabase.table(STAGE_PROGRESS_TABLE).upsert(record).on_conflict(STAGE_CONFLICT_COLUMNS)  # :65-67
```

`get_best_score` returns `0` — not `None` — when no row exists (`:54`), which the service
relies on for its `>` comparison.

### 3.8 `supabase_client.py` — the adapter

`SupabaseRESTClient` exists to avoid the official Python SDK: "This avoids the official
'supabase' Python package, which can pull complex compilation dependencies (pyiceberg / C++
build tools)" (`:17-20`). Design consequences:

- **Two verbs only.** `eq` equality filters and `select`/`insert`/`upsert` with `on_conflict`
  (`:44-65`). There is no `order`, `limit`, `range`, `neq` or nested select — adding one means
  extending the builder.
- **A hand-rolled result object.** `execute()` returns
  `type('Response', (), {'data': ...})()` (`:81`) — an ad-hoc stand-in exposing only `.data`,
  which is all the repositories use.
- **Synchronous by default.** Data calls use `with httpx.Client() as c:` inside `execute()`
  (`:69`) — blocking I/O, called from `async def` routes (see the limitations register).
- **Auth verification is the one async call**, with a 5-second timeout, returning `None` for
  any non-200 so `get_current_user` can raise a clean 401 (`:87-98`).
- **Module-level singleton.** `supabase = SupabaseRESTClient(settings.supabase_url,
  settings.supabase_service_key)` (`:102`), which is why importing this module requires
  configuration.

## 4. Frontend folder inventory

`frontend/src/` holds ten top-level entries. Counts verified from the tree.

| Folder | Files | Lines | Role |
|---|---|---|---|
| `engine/` | 23 modules + 7 test files (30 total) | 3,182 + 1,246 = 4,428 | Pure Boolean algebra |
| `state/` | 8 | 1,217 | Single source of truth: progress store, puzzle session, auth context |
| `services/` | 7 | 426 | The only network boundary |
| `hooks/` | 8 | 1,276 | UI mechanics: device tier, popup placement, drag, overlays |
| `components/` | 10 top-level + 46 in 6 folders | 1,134 + 5,288 | Presentation, grouped by feature |
| `pages/` | 7 | 2,103 | One file per route screen |
| `config/` | 3 | 218 | Every tunable, every storage key, every outbound link |
| `content/` | 2 | 400 | Bundled-content loader + tutorial copy |
| `styles/` | 5 | 450 | Tailwind entry, tokens, utilities, orientation, keyframes |
| `assets/` | 1 | — | `logo-full.png` |
| `main.jsx` | 1 | 16 | Entry; stylesheet import order is load-bearing (`:3-9`) |

Component folder detail: `animations/` 10 files / 907 lines · `laws/` 2 / 96 ·
`layout/` 4 / 154 · `puzzle/` 16 / 2,015 · `tutorial/` 12 / 1,812 · `ui/` 11 / 304.

## 5. Frontend design, folder by folder

### 5.1 `engine/` — the pure core

23 modules. Grouped by concern; line counts are from the tree.

**AST substrate**

| Module | Lines | Key exports |
|---|---|---|
| `node.js` | 49 | `nextNodeId`, `lit`, `con`, `prod`, `sum`, `neg`, `cloneN`, `ensureNodeId` |
| `tree.js` | 150 | `getNode` (`:14`), `setNode` (`:29`), `findCommonSum` (`:47`), `findCommonProd` (`:66`), `removeLitFromNode` (`:85`), `removeLitFromSumNode` (`:105`), `termContainsLit` (`:124`), `sumContainsLit` (`:130`), `getSumLits` (`:137`), `isSubSum` (`:145`) |
| `render.js` | 46 | `nodeText` (`:12`) display form; `canonText` (`:28`) order-independent comparison form |

**Text ↔ tree**

| Module | Lines | Key exports |
|---|---|---|
| `parser.js` | 166 | `parseExpr` (`:160`) — tokenizer + recursive descent |
| `normalize.js` | 69 | `normalize` (`:14`), `normalizeFlat` (`:47`) — flatten nesting, drop identity elements, fold constants |
| `validate.js` | 78 | `validateExpr` (`:16`) — the string gate only; returns a verdict, never throws |

**Semantics**

| Module | Lines | Key exports |
|---|---|---|
| `equivalence.js` | 58 | `extractVariables` (`:11`), `evalAST` (`:25`), `isEquivalent` (`:45`) — exhaustive 2ⁿ truth table |

**Law detection**

| Module | Lines | Key exports |
|---|---|---|
| `laws/definitions.js` | 85 | `LAW_MODE`, `LAW_FORM`, `LAW_DEFINITIONS` (15 entries), `LAW_NAME_TO_ID`, `defineLaw(name, form)` (`:79`) |
| `laws/helpers.js` | 152 | `absorbsInSum` (`:73`), `absorbsInProduct` (`:95`) and the shared predicates |
| `laws/sumLaws.js` | 259 | SOP-level builders (distributive-factor, complement, identity, annulment, idempotent, absorption) |
| `laws/productLaws.js` | 224 | POS-level duals, plus the gated `distributive-expand` |
| `laws/notLaws.js` | 105 | `double-neg`, `demorgan-and`, `demorgan-or` |
| `laws/constLaws.js` | 100 | Constants inside products/sums |
| `laws/scanHints.js` | 135 | `scanHints(node, path, options)` (`:22`) — whole-tree suggestion scan |
| `laws/index.js` | 70 | `analyzeSelection(expr, sel, options)` (`:33`), `analyzeNot` (`:60`), `analyzeSumConst` (`:64`), `analyzeProductConst` (`:68`) |

**Search**

| Module | Lines | Key exports |
|---|---|---|
| `solver.js` | 323 | `getLegalTransitions(tree, options)` (`:37`), `findOptimalPath(startExpr, targetCanon, options)` (`:175`), `findSimplestForm(startExpr, options)` (`:258`) |

**Scoring mirror**

| Module | Lines | Key exports |
|---|---|---|
| `scoring.js` | 98 | `lawIdOf` (`:25`), `lawsUsedFromSteps` (`:31`), `effectiveOptimalSteps` (`:39`), `estimateScore` (`:54`) |

**Sandbox**

| Module | Lines | Key exports |
|---|---|---|
| `sandbox/validate.js` | 251 | `resolveMaxVariables` (`:89`), `scanTokens` (`:100`), `canonicalTokenText` (`:126`), `validateSandboxInput` (`:155`), `normalizeSandboxExpr` (`:244`) |
| `sandbox/input.js` | 206 | `MAX_SANDBOX_VARS` (`:48`), `buildSandboxPuzzle(raw, options)` (`:109`) |
| `sandbox/generator.js` | 245 | `VAR_POOL`, `VAR_POOL_COMPLEX`, `DIFFICULTIES`, `makeRng` (`:48`), `randomSeed` (`:59`), `generateRandomPuzzle` (`:139`), `generatePuzzlePair` (`:234`) |
| `sandbox/pool.js` | 47 | `SANDBOX_POOL` (`:11`), `randomPoolEquation` (`:43`) |
| `sandbox/expand.js` | 182 | `isSopRoot` (`:86`), `isPosRoot` (`:87`), `expandOnce` (`:108`), `coverVariables` (`:170`) |

**Facade**

| Module | Lines | Key exports |
|---|---|---|
| `index.js` | 84 | The barrel. Consumers import from here, "so the internals stay free to move" (`:12-13`) |

The layout convention is a documented layering rule: "nothing in `engine/` may import from
`components/`, `screens/`, `state/`, `services/` or `hooks/`. The only external imports are
plain data/constants (`config/gameRules.js`)" (`index.js:8-10`). Verified: the only
cross-folder imports in the whole folder are `../../config/gameRules.js` from `scoring.js:18`
and `sandbox/input.js:36`.

Note the tight coupling the helper naming reveals: `absorbsInSum` and `absorbsInProduct` use
syntactic fast-accept predicates, then fall back to `isEquivalent` as the decider
(`laws/helpers.js:77`, `:98`). Absorption detection is therefore truth-table-backed; the
*window* into the puzzle still uses canonical text (§8.3 and the limitations register).

**Tests** — 7 files / 1,246 lines, run by `node --test` with no browser and no backend:

| File | Lines | Covers |
|---|---|---|
| `__tests__/absorption.test.js` | 283 | Absorption in both forms, incl. truth-table agreement |
| `__tests__/law-soundness.property.test.js` | 348 | Property test: every law preserves semantics |
| `__tests__/laws.test.js` | 151 | Law table and detection API |
| `__tests__/parser.test.js` | 91 | Notation and round-trips |
| `__tests__/sandbox.test.js` | 198 | The sandbox input/puzzle contract |
| `__tests__/solver.test.js` | 86 | Transitions, optimal path, simplest form |
| `__tests__/validate.test.js` | 89 | The string gate's messages |

Ran: **76 tests, 76 pass, 0 fail** (`cd frontend && npm test`).

### 5.2 `state/` — one source of truth

| Module | Lines | Design |
|---|---|---|
| `progressStore.js` | 337 | A module-level external store: `subscribe` (`:134`), `getSnapshot` (`:139`), `setUser` (`:147`), imperative actions (`:170-255`) and pure selectors (`:259-335`), plus private `publish`/`update`/`persistLocal`/`scheduleServerSave`/`mergeServerProgress` |
| `useProgress.js` | 79 | The React binding: `useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)` (`:24`) plus `useCallback`-wrapped selectors and a memoised return (`:48-78`) |
| `useGameState.js` | 620 | The puzzle-session state machine: history, selection, status, hints, guides, optimal path, animation |
| `hintText.js` | 78 | Pure hint wording: `DEAD_END_MSG` (`:10`), `buildHintText(law, paths, expr)` (`:18`) |
| `useGameContent.js` | 25 | Levels/laws/score submission, shaped the way screens consume them |
| `AuthProvider.jsx` | 55 | Subscribes to Supabase auth once, publishes `{data, isPending, error}` |
| `authContext.js` | 14 | The context object alone, so `AuthProvider.jsx` exports only a component and `useSession.js` only a hook — required for React Fast Refresh (`:1-7`) |
| `useSession.js` | 9 | `useContext(AuthContext)` |

`progressStore` is the single most consequential module in the frontend. Its header comment
records the defect it was built to fix: "Before this module `useProgress()` was a hook holding
its own `useState`, so the level screen, the stage screen, the puzzle screen and the tutorial
gate each had a private copy of points, streak, scores and completed stages. They only agreed
with each other by accident … which meant earning points on the puzzle screen did not update
the points chip behind it until a reload" (`:1-23`).

Its internal contract, in order:

```js
let userId, progress, serverLoaded, snapshot, saveTimer   // :41-45
function publish()  { snapshot = {userId, progress, serverLoaded,
                                  hydrated: serverLoaded && userId !== GUEST_USER_ID}; … }  // :49
function update(updater) { const next = updater(progress); if (next === progress) return
                           progress = next; persistLocal(); scheduleServerSave(); publish() }  // :60
function scheduleServerSave() { if (!serverLoaded || userId === GUEST_USER_ID) return
                                … setTimeout(…, TIMING.progressSaveDebounceMs) }  // :87
function mergeServerProgress(local, server) { … }   // :97
```

`update` returns early when the updater returns the identical object — which is how
`saveScore` avoids a pointless write when the new score is not better
(`:209-215`). `scheduleServerSave` is guarded twice: no server save for a guest, and none
before the first server load has completed, so a fresh sign-in cannot overwrite server state
with an empty local profile.

`useGameState` is the machine that drives the workspace. Its state is a **history array**, and
everything else is derived:

```js
const [history, setHistory] = useState([])   // :15   Array of { expr, step }
const expr  = history.length > 0 ? history[history.length - 1].expr : null      // :16
const steps = history.length > 1 ? history.slice(1).map(h => h.step) : []       // :17
const exprHistory = history.length > 1 ? history.slice(0, -1).map(h => h.expr) : []  // :18
```

Status is a four-value union; `isDeadEnd` is tracked in both state and a ref so the cue fires
once per transition:

```js
const [status, setStatus] = useState('select')   // :29  'select' | 'laws' | 'success' | 'error'
const isDeadEndRef = useRef(false)               // :44
const markDeadEnd = useCallback((next, {silent=false} = {}) => {
  if (next && !isDeadEndRef.current && !silent) playSound('wrong')
  isDeadEndRef.current = next; setIsDeadEnd(next)
}, [])                                            // :47
```

Public API: `loadPuzzle` (`:76`), `handleClickLit` (`:199`), `handleClickNot` (`:272`),
`handleClickTerm` (`:308`), `applyLaw` (`:354`), `undoAction` (`:461`), `resetPuzzle`
(`:487`), `requestHint` (`:501`), `swapTerms` (`:523`), `activateGuide` (`:560`); returned as
one object at `:605-619`.

Two timing details live here, both from `config/gameRules.js`:

- `applyLaw` runs a two-phase animation — a 1500 ms pre-law highlight when tutorial mode is
  on, then a 1350 ms animation, and only **then** appends the step (`:450-458`, `:423-447`).
- A law whose `before === after` is refused before any animation starts, with a message and no
  step (`:363-373`).

### 5.3 `services/` — the only network boundary

| Module | Lines | Exports | Design notes |
|---|---|---|---|
| `supabaseClient.js` | 10 | `supabase` | `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)`; the app's only auth connection |
| `authActions.js` | 33 | `signIn.email`, `signUp.email`, `signOut` | The only module that calls `supabase.auth` mutations; normalises both providers' errors to `{message}` so screens stay provider-agnostic (`:1-6`) |
| `apiClient.js` | 106 | `ApiError`, `apiRequest(path, {method, body, auth, silent})` (`:56`) | The only `fetch` in the app. Attaches the bearer via `supabase.auth.getSession()` (`:27`), unwraps the envelope (`:33`), tolerates the legacy plain shape, returns `null` instead of throwing when `silent` |
| `contentApi.js` | 61 | `getLevelSummaries`, `getLaws`, `fetchLevel` | Prefers the bundled JSON; falls back to `GET /api/levels/{id}` for an unbundled id; de-duplicates concurrent requests with `pendingLevelRequests` (`:47-58`) |
| `scoreApi.js` | 36 | `submitScore({levelId, stageIdx, stepsUsed, lawsUsed, hintsUsed, guidesUsed, optimalSteps})` | `POST /api/score` with `silent: true` — a solve must never break on a network error |
| `progressApi.js` | 25 | `loadProgress`, `saveProgress` | `GET /api/progress` and `POST /api/progress/save`, both silent |
| `soundEffects.js` | 155 | `isSoundEnabled` (`:43`), `setSoundEnabled` (`:47`), `primeAudio` (`:80`), `playSound` (`:132`) | Web Audio only: one oscillator per note, no assets, no network. Every frequency and duration comes from `gameRules.SOUND` |

The three-layer call discipline — component → hook/state → one service module → `apiClient` —
is what makes `apiRequest`'s options (`auth`, `silent`) meaningful in exactly one place.

### 5.4 `hooks/` — UI mechanics (8 files)

| Hook | Lines | Signature | Purpose |
|---|---|---|---|
| `useDeviceTier` | 311 | `detectDeviceTier({width, height, isTouch, orientation, bannerDismissed})` (`:57`), default `useDeviceTier()` (`:196`) | Device class + orientation from width and pointer capability, **no User-Agent sniffing**. Re-evaluates on resize, `orientationchange`, pointer-coarseness change and `screen.orientation`, throttled through rAF with a timer fallback (`:217-235`) |
| `useCollisionPlacement` | 407 | `useCollisionPlacement({anchorSelector, candidates, fullWidthOnNarrow, enabled, hardAvoidSelector, softAvoidSelector})` (`:164`) | Places a fixed popup near an anchor, avoiding other elements, clamped to the viewport. Exports `CANVAS_SELECTOR`, `POPUP_MARGIN = 8`, `POPUP_GAP = 8`, `viewportBox()`, `INSPECT_POPUP_CANDIDATES`, `HINT_POPUP_CANDIDATES` |
| `useBandedOverlay` | 80 | `useBandedOverlay(triggerSelectors, enabled)` (`:23`) | Anchors a panel in a horizontal band under whichever trigger opened it |
| `usePopupPlacement` | 81 | `usePopupPlacement(anchorSelector, active)` (`:7`) | The simpler single-popup placement used by the level screens |
| `useTermDrag` | 289 | `useTermDrag({group, index, onSwapTerms})` (`:235`) | Press/drag/release for term reordering; `DRAG_THRESHOLD_PX` from config (`:46`) |
| `usePageOverlays` | 37 | `usePageOverlays({navigate, hasSeenTutorial, resetLevelProgress})` (`:9`) | Composes the tutorial-replay prompt and laws drawer shared by both level screens |
| `useTutorialReplay` | 46 | `useTutorialReplay({navigate, hasSeenTutorial, resetLevelProgress})` (`:12`) | The replay prompt's state and the `sessionStorage` dismiss flag |
| `useSoundEnabled` | 25 | default `useSoundEnabled()` (`:11`) | `{enabled, toggle}` backed by `storageKeys.SOUND_ENABLED` |

`useDeviceTier` embeds a pure decision function so the tier rule is testable without a DOM,
and its contract is declared frozen by a comment block (`:17-19`). The rule: pointer-fine ⇒
always `desktop` regardless of width; touch ≤767 px ⇒ `phone`; ≤1023 px ⇒ `tablet-sm`; else
`tablet`. Overlay for a phone in portrait, dismissible banner for a small tablet in portrait
(`:71-93`).

### 5.5 `components/` — presentation

Ten top-level modules (1,134 lines) and six feature folders (5,288 lines).

**Top level**

| Module | Lines | Role |
|---|---|---|
| `ExpressionDisplay.jsx` | 381 | Renders the tree; emits selection events; owns no game state |
| `InteractiveTutorial.jsx` | 194 | The tutorial overlay driver, stage by stage |
| `AnimationOverlay.jsx` | 81 | Hosts the law animation selected by the registry |
| `ExprText.jsx` | 126 | Renders an expression **string** with typographic substitution |
| `TutorialGate.jsx` | 94 | Route gate in front of levels 1–3 and the sandbox |
| `RotateOverlay.jsx` | 83 | Blocking portrait overlay for phones |
| `ErrorBoundary.jsx` | 60 | Last-resort render fallback |
| `RotateBanner.jsx` | 57 | Dismissible portrait banner for small tablets |
| `ProtectedRoute.jsx` | 33 | Session gate; loading shell while the session is pending |
| `OrientationGate.jsx` | 25 | Chooses overlay vs banner vs nothing, mounted above the routes |

**`components/puzzle/`** — 16 files / 2,015 lines. The workspace, split by surface:

| Module | Lines | Role |
|---|---|---|
| `usePuzzleSession.js` | 301 | The orchestrator: route identity, puzzle loading, completion + scoring |
| `SidePanel.jsx` | 245 | Right column (or folded-away variant per tier) |
| `ScoreModal.jsx` | 243 | Completion overlay: graded breakdown or unscored summary |
| `DerivationCanvas.jsx` | 228 | The expression workspace and its interactions |
| `WorkspaceHeader.jsx` | 200 | Title, progress, controls; compact variant per tier |
| `LawPanel.jsx` | 183 | Applicable laws / completion panel |
| `StepHistoryPanel.jsx` | 128 | The derivation list; overlay drawer on compact tiers |
| `LawsReferenceSheet.jsx` | 95 | The laws drawer/bottom sheet |
| `sandboxPuzzle.js` | 86 | The whole sandbox contract (no React state, no rendering) |
| `LawExplanationCard.jsx` | 72 | "Which law was this step?" popup |
| `ResetConfirmModal.jsx` | 67 | Reset confirmation with a session opt-out |
| `ZoomControls.jsx` | 40 | Canvas zoom |
| `HintBubble.jsx` | 38 | Hint popup |
| `AssistanceControls.jsx` | 36 | Hint/Guide cluster for the compact tiers |
| `StepInspectionTip.jsx` | 34 | First-run tip that a past step can be tapped |
| `TutorialToggle.jsx` | 19 | Turning the guided overlay on/off |

**`components/tutorial/`** — 12 files / 1,812 lines: `Spotlight.jsx` (216),
`useTutorialProgress.js` (211), `coachCardPlacement.js` (205), `coachCardFallbackStyle.js`
(193), `useSpotlightRects.js` (177), `WelcomeModal.jsx` (162), `spotlightRects.js` (158),
`useCoachCardPlacement.js` (142), `coachCardGeometry.js` (132), `CoachCard.jsx` (101),
`TutorialReplayModal.jsx` (72), `tutorialTargets.js` (43 — exports
`TUTORIAL_OBSTACLE_SELECTORS` and `CARD_ANCHOR_ZONES`).

**`components/animations/`** — 10 files / 907 lines: one module per law plus
`animationStyles.js` (45) and `index.js` (33), whose `resolveLawAnimation(lawId)` (`:30`) is
the dispatcher that maps a law id to its component.

**`components/ui/`** — 11 files / 304 lines: `SurveyBillboard.jsx` (57), `PasswordField.jsx`
(39), `AuthCard.jsx` (38), `ScoreGateBar.jsx` (38), `SoundToggle.jsx` (28), `AuthTextField.jsx`
(25), `PointsChip.jsx` (22), `StarRating.jsx` (19), `SubmitButton.jsx` (18),
`authInputStyles.js` (11), `LoadingSpinner.jsx` (9).

**`components/layout/`** — 4 files / 154 lines: `BackNav.jsx` (61), `PageOverlays.jsx` (41),
`SurveyButton.jsx` (36), `AppHeader.jsx` (16).

**`components/laws/`** — 2 files / 96 lines: `LawsDrawer.jsx` (79), `LawCard.jsx` (17).

### 5.6 `pages/` — seven route screens

| Page | Lines | Design |
|---|---|---|
| `ProblemPage.jsx` | 521 | Composition root of the workspace. Owns the device tier and all transient UI state (hint bubble, zoom, inspected step, drawers, modals, tutorial active flag); everything else comes from `usePuzzleSession` (`:128-137`) |
| `LevelSelectPage.jsx` | 440 | Carousel over `[...levels, SANDBOX_LEVEL]` (`:51`) with `getLockState` (`:60`) and row recentring measured with `offsetLeft` (`:172`) |
| `StageSelectorPage.jsx` | 387 | Stage grid, sequential availability (`:56`), star derivation (`:68`), 80 % gate bar and mastery badge (`:87-90`) |
| `SandboxPage.jsx` | 359 | The sandbox entry screen: debounced live verdict, build-on-submit, example chips |
| `RegisterPage.jsx` | 155 | Client-side validation and Supabase signup |
| `LandingPage.jsx` | 126 | Public hero; session-aware CTAs |
| `LoginPage.jsx` | 115 | Sign-in form; navigates on session |

`ProblemPage` is the best example in the repo of a **pure-presentational separation**: it
computes ~15 tier booleans from one hook (`:64-99`) and then renders, while every rule lives
below it in `usePuzzleSession` and `useGameState`.

### 5.7 `config/`, `content/`, `styles/`

**`config/`** (3 files / 218 lines) — the single tuning surface:

| Constraint group | Members |
|---|---|
| Scoring | `SCORE_WEIGHTS` (`:14`), `SCORE_PENALTY` (`:21`), `SCORE_BONUS_MAX_POINTS` (`:29`), `STAGE_COMPLETION_XP` (`:32`), `GUIDE_COST_POINTS` (`:35`) |
| Progression | `STAR_THRESHOLDS` (`:38`), `MAX_STARS_PER_STAGE` (`:46`), `UNLOCK_AVERAGE_SCORE` (`:49`), `SCORE_RAMP` (`:52`) |
| Timing | `TIMING` — 10 named values (`:58-79`) |
| Identity | `TUTORIAL {levelId: 0, stageIndexes: [0,1,2,3]}` (`:82`) |
| Interaction | `DRAG` (`:88`), `SANDBOX` (`:110`), `SOLVER_BUDGET` (`:173`) |
| Audio | `SOUND` (`:148`) |

`storageKeys.js` (28) centralises six keys; `appLinks.js` (9) holds the single survey URL.
Header comments record the motivation: "Before this module the same figures were repeated
across the scoring endpoint, the puzzle screen, the progress store and the level screens
(40/30/30 in two files, 90/75 in two, 80% in three, 10/20/5 points in four)"
(`gameRules.js:3-6`).

**`content/`** (2 files / 400 lines) — `gameContent.js` (33) imports the JSON through the
`@content` alias and derives `LEVEL_SUMMARIES`; `tutorialContent.js` (367) holds the tutorial
script as data.

**`styles/`** (5 files / 450 lines) — `index.css` (19, the Tailwind entry), `animations.css`
(224), `utilities.css` (129), `orientation.css` (48), `tokens.css` (30). Import order in
`main.jsx:3-9` is load-bearing and explained in `styles/index.css`.

## 6. Key data structures

### 6.1 The expression AST

Five node shapes, all carrying a stable monotonic `_id` so the UI can track a node across
edits and target it in an animation (`frontend/src/engine/node.js:1-13`):

```js
lit   { _id:number, type:'lit',   v:'x',      n:false }   // n = complemented
const { _id:number, type:'const', val:0|1 }
prod  { _id:number, type:'prod',  factors:[node,…] }       // AND
sum   { _id:number, type:'sum',   terms:[node,…] }         // OR
not   { _id:number, type:'not',   child:node }             // NOT
```

Constructors are `lit(v, n)`, `con(val)`, `prod(...factors)`, `sum(...terms)`, `neg(child)`
(`node.js:19-23`). `cloneN` deep-copies **preserving** `_id` deliberately, "so copied nodes
stay recognisable to the UI" (`:25-35`); `ensureNodeId` retro-fits ids onto a hand-built tree
(`:38-48`).

**Addressing.** A node is addressed by a **path string** rooted at `R`: `"R"` is the root,
`"R.0"` the first child, `"R.0.1"` its second child. `getNode(root, path)` and
`setNode(root, path, newNode)` are the accessors (`tree.js:14`, `:29`). The path is what the
UI emits on click and what a selection carries.

**Rendering.** Two functions, deliberately different: `nodeText(n)` produces the display form
(`render.js:12`); `canonText(n)` produces an order-independent comparison form (`:28`). The
difference is load-bearing rather than cosmetic — `canonText` decides whether a reordering
counts as a change, and it is the win condition (§8.3).

### 6.2 Selection and step (client)

```js
// A selection item — what the learner has selected.
{ path: 'R.0', isTermSel: true }        // a whole term/clause
{ path: 'R.0.1', isTermSel: false }     // a single literal
// state: const [sel, setSel] = useState([])   useGameState.js:20

// A committed derivation step.
{ law: 'Absorption Law', from: 'x + xy', to: 'x' }    // useGameState.js:425

// The history entry that holds both.
{ expr: <AST>, step: <Step|null> }                    // useGameState.js:15
```

The history's first entry has `step: null` — that is the puzzle's starting state — which is
why `steps` is `history.slice(1)` (`:17`).

### 6.3 `ScoreOutcome` and the score payload

Service-side value object:

```python
@dataclass(frozen=True)
class ScoreOutcome:                       # backend/services/scoring_service.py:16
    level_id: int
    stage_idx: int
    steps_used: int
    laws_used: tuple[str, ...]            # as submitted, duplicates included
    assistance_used: int                  # hints + guides → stored in hints_used
    efficiency: float
    target_law: float
    hint_independence: float
    total: float
    earned_points: int
    breakdown: dict[str, Any]
```

Wire payload (`ScoreResponse`, camelCase, `backend/api/schemas/score.py:23`) —
**live-verified**:

```json
{ "efficiency": 40.0, "targetLaw": 30.0, "hintIndependence": 30.0,
  "total": 100.0, "earnedPoints": 5,
  "breakdown": { "stepsUsed": 1, "optimalSteps": 1,
                 "targetLawsRequired": ["absorption"], "targetLawsUsed": ["absorption"],
                 "hintsUsed": 0, "guidesUsed": 0, "totalAssistance": 0 } }
```

Client-side the same shape is produced by `estimateScore`
(`frontend/src/engine/scoring.js:54-97`) and consumed directly by `ScoreModal`
(`frontend/src/components/puzzle/ScoreModal.jsx:118-151`). The client also derives
`lawIdOf(lawName)` from `LAW_NAME_TO_ID` so a display name recorded in a step becomes a law id
for scoring (`scoring.js:25-28`), and `effectiveOptimalSteps` picks the solver's answer, else
the authored one, else what was used (`:39-42`).

### 6.4 Progress: transport model and client snapshot

Transport (`backend/api/schemas/progress.py:11-22`), camelCase:

```python
class ProgressData(BaseModel):
    points: int = 0
    streak: int = 0
    bestStreak: int = 0
    stageProgress: dict[str, list[int]] = {}    # { "1": [0, 1, 2] }
    stageScores: dict[str, int | float] = {}    # { "1:0": 87.5 }
```

Client snapshot (`frontend/src/state/progressStore.js:30-39`) — a superset, because the client
also remembers derivations and tutorial flags that never go to the server:

```js
{ points, streak, bestStreak,
  levelsCompleted: [],   // numeric content ids, 0 = Tutorial
  stageProgress: {},     // { "1": [0,1,2] }
  stageScores: {},       // { "1:0": 87.5 }  ← best total per stage
  stageSolutions: {},    // { "1:0": [{ law, from, to }] }  ← replayable derivation
  hasSeenTutorial: false }
```

`build_progress` (server) produces the first five; `mergeServerProgress` (client, `:97-130`)
folds the server's five into the local eight with max/union semantics and keeps local
`stageSolutions` as the winner (`:118-119`).

### 6.5 The law definition and a law instance

Two different objects share the word "law", and conflating them is a common mistake.

**Definition** — the identity table entry (`frontend/src/engine/laws/definitions.js:29-54`):

```js
{ id: 'absorption', name: 'Absorption Law', formula: 'A + AB = A',
  mode: 'term', form: 'sum' }      // 15 entries: SOP + POS duals + single-node laws
```

`mode` records which selection opens it (`'literal'` needs two literals, `'term'` works on
whole terms); `form` distinguishes SOP from POS, which matters because `Identity Law` has two
different formulas under one display name (`:46-48`). `defineLaw(name, form)` throws on an
unknown pair "so a typo fails loudly in the test suite instead of silently producing a law
with a missing id" (`:79-85`).

**Instance** — what a detector returns to the UI and what `applyLaw` consumes
(`frontend/src/state/useGameState.js:354-459`): `{ id, name, formula, apply(), animPaths,
measurePaths, survivorPath, absorbedPath, deMorganTerms, isAndToOr, … }`. The extra fields
exist so the animation layer can name the exact nodes to highlight, without re-deriving them.

### 6.6 The response envelope

```python
class ErrorBody(BaseModel): code: str; message: str; detail: Any | None = None   # core/responses.py:16
class Envelope(BaseModel):  success: bool; data: Any | None; error: ErrorBody|None # core/responses.py:24
```

Every `/api/*` route declares `response_model=Envelope` (`backend/api/routes/laws.py:18`,
`levels.py:18`, `:24`, `score.py:20`, `progress.py:20`, `:26`) even though the handler returns
a plain `dict` from `success(...)`/`failure(...)`. The model is the contract; the helper is the
implementation.

### 6.7 Device tier

```js
{ tier: 'phone'|'tablet-sm'|'tablet'|'desktop',
  isPortrait, isLandscape, isTouch, width, height, orientation,
  isPhone, isSmallTablet, isTablet, isDesktop,
  isPhonePortrait, isSmallTabletPortrait,
  showRotateOverlay, showRotateBanner, dismissRotateBanner }
```
`frontend/src/hooks/useDeviceTier.js:57-94` (pure decision, 5 fields) and `:293-310` (hook
return, 15 fields).

## 7. Design patterns in use

| Pattern | Where | Why it is the right shape here |
|---|---|---|
| **Strict layering** | `backend/main.py → api/routes → services → repositories → supabase_client`; `engine ← state ← pages/components` | Each layer has one reason to change. A transport change stops at the route; a query change stops at the repository. The cost is pass-through code, accepted because the backend is small |
| **Repository** | `repositories/content_repository.py`, `progress_repository.py` | The only modules that know a storage detail. Swapping Supabase for anything else touches one file plus `supabase_client.py` |
| **Service layer** | `services/*` | Holds the rules that are neither transport nor storage: not-found semantics, the score algorithm, the merge |
| **Dependency injection** | `Depends(get_current_user)` / `Depends(optional_user)` | The route declares what it needs; the auth mechanism is swapped in one module. This is also why `/docs` shows no security scheme [D22] |
| **Adapter** | `supabase_client.SupabaseRESTClient`, `services/apiClient.apiRequest` | Both hide a wire protocol behind a tiny surface: PostgREST verbs, and fetch-plus-envelope |
| **Middleware / chain of responsibility** | `RequestContextMiddleware` → `CORSMiddleware` → router | Correlation and logging are orthogonal to every route and must survive a 500 |
| **Result object, not exceptions, at the boundary** | `validateExpr` returns `{valid, error}`; `buildSandboxPuzzle` returns `{ok, errorCode, error}` | Callers render the message verbatim; a thrown exception would lose the message's identity |
| **Frozen value object** | `@dataclass(frozen=True) ScoreOutcome` | One evaluation, immutable, safe to hand to a background task |
| **Facade / barrel** | `frontend/src/engine/index.js` | Internals are numerous and move; consumers get one import path |
| **Pure core, imperative shell** | `engine/**` vs `state/**`, `services/**` | The algebra is testable in plain Node with no browser; only the shell knows about React, timers and the network |
| **External store + `useSyncExternalStore`** | `state/progressStore.js` + `useProgress.js` | One instance shared by every screen, without a state-management library or a provider tree |
| **Reducer-style immutable update** | `progressStore.update(updater)` (`:60`) and every action (`:170-255`) | Each action is a small pure function of the previous snapshot; returning the same object is a no-op, which prevents redundant writes |
| **Observer / pub-sub** | `subscribe(listener)` + `publish()` (`:134`, `:49`) | Framework-free change notification; React is one subscriber among possible others |
| **Provider + consumer hook** | `AuthProvider` + `authContext.js` + `useSession.js` | The session is read in exactly one place; the three-file split exists to keep React Fast Refresh working |
| **Guard / wrapper component** | `ProtectedRoute`, `TutorialGate`, `OrientationGate`, `ErrorBoundary` | Cross-cutting route policy without repeating it in seven pages |
| **Strategy / registry** | `LAW_DEFINITIONS` + `defineLaw`; `animations/index.js:30 resolveLawAnimation`; `HINT_POPUP_CANDIDATES` / `INSPECT_POPUP_CANDIDATES` | Adding a law or a popup placement is a table entry, not a new branch |
| **Composition root** | `ProblemPage` composes; `usePuzzleSession` decides | One file owns wiring, another owns rules — the only way 521 lines of page stay readable |
| **Mode by absence** | `isSandbox = !levelId && !stageIdx` (`usePuzzleSession.js:40`) | The sandbox reuses the graded workspace byte-for-byte instead of forking it |

**Patterns deliberately *not* used**, and why:

| Not used | Reason |
|---|---|
| Redux / Zustand / MobX | One store with eight actions; `useSyncExternalStore` plus a module-level object is the whole requirement |
| An ORM or query builder | Two verbs and six queries; `httpx` plus a 60-line builder is smaller than the dependency |
| Server-side rendering | The app is behind auth, has no SEO requirement and reads its content from a bundle |
| A shared TS/JS monorepo package for the engine | One consumer language, one engine; a package boundary would add build machinery for no isolation benefit. Extract only if a third consumer appears |
| Event sourcing | The derivation *is* already an event log (`history`), but nothing outside the session needs it |

## 8. Main runtime flows

### 8.1 A request through the backend

```
HTTP request
  → CORSMiddleware                (added last ⇒ outermost)
  → RequestContextMiddleware      request id, timer, ContextVar bind
      → router match
          → Depends(get_current_user | optional_user)   [only where declared]
              → SupabaseRESTClient.get_user(token)      async httpx, 5 s timeout
          → pydantic validation of the body             (422 on failure → envelope)
          → service call                                (404 / 503 / 502 → AppError)
              → repository
                  → SupabaseRESTClient.query.execute()  sync httpx.Client → PostgREST
      → response
  → middleware logs one JSON line, sets X-Request-ID, returns
  → on any exception: handler renders the envelope, or the middleware renders the 500
```

### 8.2 `POST /api/score`

```
ScoreRequest {levelId, stageIdx, stepsUsed, lawsUsed[], hintsUsed, guidesUsed?, optimalSteps?}
  → optional_user            → user dict, or None (no 401 — the route works signed-out)
  → scoring_service.compute_score(...)
        content_service.get_puzzle(level_id, stage_idx)      NotFoundError → 404
        _resolve_optimal(optimal_steps, puzzle, steps_used)  min(declared, used)
        _efficiency(steps_used, optimal)                     40 or −10/step, floored at 0
        _target_law(set(targetLaws), set(lawsUsed))          full 30 when none declared
        _hint_independence(hints + guides)                   30 − 10 per unit, floored at 0
        total = round(sum, 1) · earned_points = round(total/100 × 5)
  → if user: BackgroundTasks.add_task(progress_service.persist_score, user["id"], outcome)
  → ScoreResponse(...).model_dump() → success(...) → 200 envelope
  ── after the response is sent ──────────────────────────────────────────────
     persist_score: insert score_history
                    get_best_score → if outcome.total > best: upsert stage_progress
                    any failure: log and swallow
```

### 8.3 A step through the engine (the decision path in the client)

```
learner clicks a node
  useGameState.handleClickLit / handleClickNot / handleClickTerm
      primeAudio()                                  unlock audio on the first gesture
      if isAnimating: return                        no input during an animation
      if isDeadEnd: selection only, no law lookup
      special case: a const inside a prod/sum → analyzeProductConst / analyzeSumConst
      otherwise: update the selection (max 2)
          → updateLaws(nextSel, expr)
              len == 2 → analyzeSelection(expr, sel, {allowExpand})   → laws | 'error'
              len == 1 and node.type === 'not' → analyzeNot(expr, path)
              len == 1 otherwise → prompt for a second item
      → status ∈ {'select','laws','error'} and applicableLaws

learner picks a law
  applyLaw(law, expr, steps, hintsUsed, isTutorial)
      const newExpr = law.apply()
      if nodeText(before) === nodeText(after): refuse — no step, no animation
      tutorial? → 1500 ms pre-highlight → then animation
      animation: 1350 ms, then:
          history.push({ expr: newExpr, step: { law: law.name, from: before, to: after } })
          playSound('step')
          if canonText(newExpr) === goalCanonRef.current     ← THE WIN TEST
              earnedXp = STAGE_COMPLETION_XP; isComplete = true; playSound('correct')
          else syncDeadEndStatus(newExpr, …)
                  canonText(expr) === goal                → not a dead end
                  scanHints(expr, 'R', {allowExpand}).length === 0 → DEAD END
                  otherwise clear the dead-end state
```

The win test is **canonical-text equality**, not `isEquivalent`. That is deliberate in the
implementation and is documented as a limitation: a logically equivalent but canonically
different terminal form does not complete the puzzle. `isEquivalent`'s consumers are law
detection (`engine/laws/helpers.js:77`, `:98`) and the sandbox builders
(`engine/sandbox/generator.js:94`, `engine/sandbox/input.js:161`) — never `useGameState`.

### 8.4 Completion → score → persistence (client side)

```
usePuzzleSession effect on isComplete                 usePuzzleSession.js:150-221
  if loadedAsSavedRef.current: return                 a restored solution is not news
  playSound('complete')
  lawsUsed          = lawsUsedFromSteps(steps)        display names → law ids
  effectiveOptimal  = effectiveOptimalSteps({…})
  immediateScore    = estimateScore({…})              instant local breakdown
  sandbox? → show the modal after 200 ms, write nothing, return
  isFirstTime = !completedSet.has(stageNum)
  if isFirstTime: addPoints(earnedXp + immediateScore.earnedPoints)
  completeStage(levelId, stageNum)
  saveSolution(levelId, stageNum, steps)
  setScoreResult(immediateScore); saveScore(levelId, stageNum, immediateScore.total)
  submitScore({…}).then(result => { if (result) { saveScore(…, result.total)
                                                  setScoreResult(result) } })
  setTimeout(() => setShowSuccess(true), TIMING.successModalDelayMs)
```

Every write goes through `progressStore`, which persists to `localStorage` synchronously and
schedules one debounced server save (`progressStore.js:60-94`).

### 8.5 Progress hydration

```
useProgress mount → store.setUser(userId)
    guest            → serverLoaded = true, publish, done
    signed in        → progress = readLocal(userId)   (synchronous, from localStorage)
                       publish()                      screens render immediately
                       progressApi.loadProgress()     GET /api/progress (silent)
                          → mergeServerProgress(local, server)
                          → serverLoaded = true; persistLocal(); publish()
                          → hydrated = true           TutorialGate stops holding
```

While `hydrated` is false the gate holds its loading screen — the specific bug this prevents
is a returning learner being bounced to the tutorial on every fresh device
(`frontend/src/components/TutorialGate.jsx:26-29`).

## 9. Known discrepancies affecting this document

The full register is D0–D23 in
[known-limitations.md](../07-explanation/known-limitations.md).

| ID | This SDD describes | Proposal / brief claims | Resolution |
|---|---|---|---|
| D1 / D23 | The sandbox is a module (`engine/sandbox/*`) plus a page plus the shared workspace; **no `POST /sandbox/validate` exists**. | A sandbox validation endpoint. | `engine/sandbox/validate.js:155`, `engine/sandbox/input.js:109`. |
| D7 | `compute_score` schedules `persist_score` for a signed-in learner (§8.2, §3.5). | `POST /api/score` "does NOT save to DB". | `backend/api/routes/score.py:38-39`. |
| D8 | The exact pipeline including `min(declared, used)`, hints+guides assistance, 1-dp rounding, and full 30 with no target laws. | A simpler formula. | `backend/services/scoring_service.py:45-115`. |
| D17 | Backend modules are `backend/{main.py,config,core,api/routes,api/schemas,services,repositories}` — 28 files. | `app/core`, `app/services`, `app/routers`, `app/schemas`. | No `backend/app/` exists. |
| D18 | Frontend folders are `services/` and `pages/`; `hooks/` holds 8 files, `components/` 10 top-level modules plus 6 folders. | `src/api`, `src/screens`, "9 hooks", "8 top-level components". | Counted from the tree. |
| D21 | `earned_points` uses Python `round()`; the client mirror uses `Math.round`. | — | `backend/services/scoring_service.py:55` vs `frontend/src/engine/scoring.js:80`. |
| D22 | Auth arrives as `Depends(...)`, so the OpenAPI document carries no security scheme. | — | Live-verified: `security=None` on all seven paths. |
