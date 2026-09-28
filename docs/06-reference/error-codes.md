# Error Codes and Failure Handling

**What this is.** The complete catalogue of every machine-readable error code Praxis can
produce — the 7 codes the backend emits from `ErrorCode` (`backend/core/errors.py:11-20`) and
the 3 codes that exist only in the browser client
(`frontend/src/services/apiClient.js`) — plus what each one means, how to trigger it, what the
learner experiences, and the first thing to check when you see it in a log.

**Who it is for.** A developer or QA engineer staring at a failed request, a `502` from
production, or a `console` entry that says `network_error`. Every example body below was
produced by executing the code, not by reading a design document.

> **Read this first if you are debugging right now:** jump to
> [§7 Triage playbook](#7-triage-playbook). Everything before that is reference.

---

## Contents

- [1. How an error reaches you](#1-how-an-error-reaches-you)
- [2. The complete code table](#2-the-complete-code-table)
- [3. Backend codes](#3-backend-codes)
  - [3.1 `not_found` — 404](#31-not_found--404)
  - [3.2 `content_unavailable` — 503](#32-content_unavailable--503)
  - [3.3 `upstream_error` — 502](#33-upstream_error--502)
  - [3.4 `unauthorized` — 401](#34-unauthorized--401)
  - [3.5 `validation_error` — 422](#35-validation_error--422)
  - [3.6 `http_error` — 404 / 405 / any framework status](#36-http_error--404--405--any-framework-status)
  - [3.7 `internal_error` — 500](#37-internal_error--500)
- [4. Frontend-only codes](#4-frontend-only-codes)
  - [4.1 `network_error`](#41-network_error)
  - [4.2 `invalid_response`](#42-invalid_response)
  - [4.3 `http_<status>`](#43-http_status)
  - [4.4 `api_error`](#44-api_error)
  - [4.5 The `ApiError` object](#45-the-apierror-object)
- [5. Status-code and code mapping tables](#5-status-code-and-code-mapping-tables)
- [6. The one non-envelope failure: CORS preflight 400](#6-the-one-non-envelope-failure-cors-preflight-400)
- [7. Triage playbook](#7-triage-playbook)
- [8. Traps and things that do not exist](#8-traps-and-things-that-do-not-exist)
- [9. Related reading](#9-related-reading)

---

## 1. How an error reaches you

There are exactly **two** producers of error information in Praxis, and they use different
vocabularies.

```mermaid
flowchart TD
    A["Something fails"] --> B{"Where?"}
    B -->|"inside the API"| C["AppError subclass raised<br/>or framework error"]
    C --> D["Exception handler in main.py<br/>or last-resort middleware"]
    D --> E["JSON envelope<br/>success:false, error:{code,message,detail}<br/>HTTP status = the real status"]
    E --> F["apiClient.js apiRequest()"]
    F -->|"response not ok"| G{"body has error.code?"}
    G -->|"yes -> backend code"| H["ApiError{status, code='unauthorized'}<br/>for example"]
    G -->|"no"| I["ApiError{status, code='http_502'}<br/>for example"]
    F -->|"response ok but body unreadable"| J["ApiError{code:'invalid_response'}"]
    B -->|"before any response arrives"| K["fetch() rejects<br/>DNS / offline / CORS / refused"]
    K --> L["ApiError{status:0, code:'network_error'}"]
    H --> M{"caller passed silent:true?"}
    I --> M
    J --> M
    L --> M
    M -->|"yes"| N["return null - learner sees nothing"]
    M -->|"no"| O["throw ApiError - caller must catch"]
```

Three rules follow from that picture:

1. **The HTTP status is authoritative.** The `error.code` refines it; it never contradicts it.
   `not_found` is always `404`, `validation_error` is always `422`, and so on.
2. **Backend codes are stable strings** declared once in `ErrorCode`
   (`backend/core/errors.py:11-20`) and reused by the frontend as opaque values. The frontend
   never branches on them today — it only propagates them.
3. **Client-only codes are synthetic.** `network_error`, `invalid_response`, `http_<status>`
   and `api_error` never appear in a server response body; they are invented by
   `apiClient.js` when there is no usable server code to pass through.

The full envelope and header contract is in
[API-REFERENCE.md](../04-api/API-REFERENCE.md#21-the-success-data-error-envelope).

---

## 2. The complete code table

Eleven values in total: 7 from the backend, 3 client-only, 1 constructor fallback.

| `code` | Producer | HTTP status | One-line meaning | Full entry |
|---|---|---|---|---|
| `not_found` | backend | `404` | the named level or stage does not exist | [§3.1](#31-not_found--404) |
| `content_unavailable` | backend | `503` | `content/*.json` is missing or unreadable on the server | [§3.2](#32-content_unavailable--503) |
| `upstream_error` | backend | `502` | Supabase (Auth or PostgREST) could not be reached or refused the call | [§3.3](#33-upstream_error--502) |
| `unauthorized` | backend | `401` | no usable session on the request | [§3.4](#34-unauthorized--401) |
| `validation_error` | backend | `422` | the request body or a path parameter did not match the schema | [§3.5](#35-validation_error--422) |
| `http_error` | backend | `404`, `405`, … | the framework rejected the request before any handler ran | [§3.6](#36-http_error--404--405--any-framework-status) |
| `internal_error` | backend | `500` | an unhandled exception escaped a route | [§3.7](#37-internal_error--500) |
| `network_error` | frontend only | `0` (no response) | `fetch` never got a response | [§4.1](#41-network_error) |
| `invalid_response` | frontend only | the real status | the response was not JSON, or the envelope was unreadable | [§4.2](#42-invalid_response) |
| `http_<status>` | frontend only | the real status | non-2xx **and** the body carried no `error.code` | [§4.3](#43-http_status) |
| `api_error` | frontend only | whatever was passed | constructor default; effectively unreachable from the API | [§4.4](#44-api_error) |

Every one of the seven backend codes maps to exactly one `AppError` subclass, and every
application error in the codebase is one of **seven literal `raise` statements** (verified by
grepping `raise (NotFoundError|ContentUnavailableError|UpstreamError|UnauthorizedError|AppError)`):

| Raise site | Code | Message |
|---|---|---|
| `backend/core/security.py:22` | `unauthorized` | `Not authenticated` |
| `backend/core/security.py:29` | `upstream_error` | `Authentication service is unavailable` |
| `backend/core/security.py:32` | `unauthorized` | `Invalid session` |
| `backend/repositories/content_repository.py:25` | `content_unavailable` | `Game content is unavailable` |
| `backend/repositories/progress_repository.py:26` | `upstream_error` | `Progress storage is unavailable` |
| `backend/services/content_service.py:28` | `not_found` | `Level {level_id} not found` |
| `backend/services/content_service.py:41` | `not_found` | `Stage {stage_idx} not found` |

If a failure is not on that list, it is either a framework error (`http_error`), a validation
error (`validation_error`), or a bug (`internal_error`).

---

## 3. Backend codes

### 3.1 `not_found` — 404

**Means:** the request was well-formed and authenticated as required, but the level or stage it
names does not exist in `content/levels.json`.

| | |
|---|---|
| **Class** | `NotFoundError` (`backend/core/errors.py:52-57`) |
| **Status** | `404` |
| **Default message** | `Resource not found` (never used — both raise sites pass a message) |
| **Raised at** | `backend/services/content_service.py:28`, `:41` |
| **`detail`** | always `null` |
| **Endpoints** | `GET /api/levels/{level_id}`, `POST /api/score` |

**Triggers**

| Request | Message | Cause |
|---|---|---|
| `GET /api/levels/999` | `Level 999 not found` | `get_level` is an equality search (`backend/repositories/content_repository.py:60-62`) |
| `GET /api/levels/-1` | `Level -1 not found` | negative ids are not special-cased |
| `POST /api/score` with `levelId: 999` | `Level 999 not found` | scoring loads the puzzle first (`backend/services/scoring_service.py:43`) |
| `POST /api/score` with `stageIdx: 99` | `Stage 99 not found` | only `stage_idx >= len(puzzles)` is rejected (`backend/services/content_service.py:40-41`) |

**Exact observed envelope** (`GET /api/levels/999`):

```json
{"success":false,"data":null,"error":{"code":"not_found","message":"Level 999 not found","detail":null}}
```

Observed for a bad stage index in `POST /api/score`:

```json
{"success":false,"data":null,"error":{"code":"not_found","message":"Stage 99 not found","detail":null}}
```

**Reproduce**

```bash
curl -s http://127.0.0.1:8000/api/levels/999
curl -s -X POST http://127.0.0.1:8000/api/score -H 'Content-Type: application/json' \
  -d '{"levelId":1,"stageIdx":99,"stepsUsed":1,"lawsUsed":[],"hintsUsed":0}'
```

**What the learner sees:** nothing. On the gameplay path this never fires for real content:
`fetchLevel` is bundled-first (`frontend/src/services/contentApi.js:36-45`) and `submitScore`
is `silent: true` (`frontend/src/services/scoreApi.js:34`), so a `404` is swallowed and the
puzzle simply carries on with the local score.

**Check first:** is the id in `content/levels.json`? Level ids are **0-based with 0 =
Tutorial** — an off-by-one from a 1-based UI label produces exactly this error. See
[API-REFERENCE.md §2.8](../04-api/API-REFERENCE.md#28-level-and-stage-numbering).

**Related trap:** a **negative** `stageIdx` does *not* produce this code — it is accepted and
scores a different puzzle. `stageIdx: -1` returns `200`; `stageIdx: -13` (beyond the start of
the list) is an unhandled `IndexError` and returns `internal_error`. Only an index `>=
puzzleCount` is caught here.

---

### 3.2 `content_unavailable` — 503

**Means:** the static game content could not be read from disk. This is a **deployment fault**,
never a client mistake: the `content/` directory is missing or the JSON is corrupt in the
running container.

| | |
|---|---|
| **Class** | `ContentUnavailableError` (`backend/core/errors.py:60-65`) |
| **Status** | `503` |
| **Message** | `Game content is unavailable` |
| **Raised at** | `backend/repositories/content_repository.py:25` (inside `_load`, `:19-31`) |
| **`detail`** | a human sentence naming the absolute path it tried to open |
| **Endpoints** | all four content routes: `GET /api/levels`, `GET /api/levels/{id}`, `GET /api/laws`, and `POST /api/score` (which needs the puzzle) |

**Triggers:** `FileNotFoundError` or `json.JSONDecodeError` while opening
`<repo>/content/levels.json` or `<repo>/content/laws.json`. `CONTENT_DIR` is computed as
`Path(__file__).resolve().parents[2] / "content"` (`backend/repositories/content_repository.py:16`),
i.e. `<repo>/content`, which must be shipped beside `backend/`.

**Exact observed envelope** (verified by pointing the loader at a missing directory):

```json
{"success":false,"data":null,"error":{"code":"content_unavailable","message":"Game content is unavailable","detail":"Game content is missing or unreadable: /home/xris/Documents/GitHub/Praxis/content/definitely-missing/levels.json. The content/ directory must be shipped alongside the backend."}}
```

For `/api/laws` the observed detail names `laws.json` instead. All four routes returned `503`
with this code in the same probe.

**Reproduce safely** (never do this against production):

```bash
# from backend/, temporarily hide the content directory and call the API
mv ../content ../content.bak
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/api/levels   # 503
mv ../content.bak ../content
```

**What the learner sees:** nothing. Again, the content routes are bundled-first in the browser,
so the SPA keeps working from its build-time copy of the same JSON; only API clients see the
`503`.

**Check first**

1. Does `content/levels.json` exist **in the deployed image/container**? On Render the service
   builds from `rootDir: backend` with the repo root as build context, so a build that copies
   only `backend/` breaks content while the API still boots.
2. Is the JSON valid? `python -m json.tool content/levels.json > /dev/null`.
3. Both loaders are `functools.lru_cache`d (`:34-43`), but **exceptions are not cached**.
   Verified with the cache counters:

   | Step | `GET /api/levels` | `list_levels.cache_info()` |
   |---|---|---|
   | content present | `200` | `misses=1, currsize=1` |
   | content missing, attempt 1 | `503` | `misses=1, currsize=0` |
   | content missing, attempt 2 | `503` | `misses=2, currsize=0` — every request **retries** |
   | file restored, cache untouched | `200` | `misses=3, currsize=1` — **self-heals, no restart** |
   | file missing again, cache warm | `200` | `hits=1` — the stale cached list is still served |

   So a `503` clears itself the moment the file is readable again. The opposite is also true
   and more surprising: once a load has **succeeded**, edits to (or deletion of)
   `content/*.json` have **no effect until the process restarts**.

---

### 3.3 `upstream_error` — 502

**Means:** a dependency of the API — Supabase Auth or Supabase PostgREST — could not be
reached, timed out, or answered with a non-2xx status. The API itself is healthy; its
dependency is not.

| | |
|---|---|
| **Class** | `UpstreamError` (`backend/core/errors.py:68-73`) |
| **Status** | `502` |
| **`detail`** | the stringified underlying `httpx` exception, or the PostgREST status line |
| **Endpoints** | `GET /api/progress`, `POST /api/progress/save`, and `POST /api/score` when a bearer token is present |

**Two raise sites, two messages**

| Raise site | Message | Boundary |
|---|---|---|
| `backend/core/security.py:29` | `Authentication service is unavailable` | `GET {SUPABASE_URL}/auth/v1/user` (`backend/supabase_client.py:87-98`) |
| `backend/repositories/progress_repository.py:26` | `Progress storage is unavailable` | any `.execute()` against `user_progress` / `stage_progress` / `score_history` (`:21-26`) |

The auth boundary is reached from all three bearer-aware routes, so this code is not limited to
the progress routes: `POST /api/score` with a token returns `502` when Auth is down, while the
same request **without** a token returns `200` (verified — `optional_user` never calls Supabase
when there is no header).

Both catch `httpx.HTTPError`, which **includes `httpx.HTTPStatusError` raised by
`response.raise_for_status()`** (`backend/supabase_client.py:80`). That has an important
consequence: a PostgREST rejection — a foreign-key violation, a constraint failure, an RLS
rejection — surfaces to the client as `502 upstream_error`, **not** as a `409`/`400` and not as
`internal_error`. Observed while probing with a non-existent user id:

```json
{"success":false,"data":null,"error":{"code":"upstream_error","message":"Progress storage is unavailable","detail":"Client error '409 Conflict' for url 'https://<project-ref>.supabase.co/rest/v1/user_progress'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/409"}}
```

**Exact observed envelopes**

Transport failure injected at the auth boundary (both progress routes):

```json
{"success":false,"data":null,"error":{"code":"upstream_error","message":"Authentication service is unavailable","detail":"simulated transport failure"}}
```

Empty bearer token (`Authorization: Bearer ` with nothing after it) — a parsing artefact, not
an outage:

```json
{"success":false,"data":null,"error":{"code":"upstream_error","message":"Authentication service is unavailable","detail":"Illegal header value b'Bearer '"}}
```

**Reproduce**

```bash
# a token Supabase rejects gives 401; a malformed header gives 502
curl -s http://127.0.0.1:8000/api/progress -H 'Authorization: Bearer ' | python -m json.tool
```

**What the learner sees:** nothing. `loadProgress` and `saveProgress` are `silent: true`
(`frontend/src/services/progressApi.js:12,20`), so a `502` becomes `null`; local progress
continues from `localStorage` and is retried on the next debounced save.

**Check first**

1. Is `SUPABASE_URL` reachable from the Render instance? Auth calls time out after **5 s**
   (`backend/supabase_client.py:95`); PostgREST calls use `httpx`'s default timeout
   (`backend/supabase_client.py:69`).
2. Is `SUPABASE_SERVICE_KEY` still valid? A rotated service-role key makes every PostgREST call
   fail while `/api/levels` stays perfectly healthy — a useful discriminating signal.
3. Read the `detail` in the server log, not on the client: it is the only place the real cause
   (DNS name, TLS error, HTTP status from Supabase) appears.
4. **`detail` is developer-facing and can leak infrastructure.** The observed 409 example above
   contains the Supabase project hostname. Never render `detail` to a learner.

---

### 3.4 `unauthorized` — 401

**Means:** a route that requires a session did not get a usable one. It is the **only** error
on the two `/api/progress*` routes that a correctly-shaped request can hit.

| | |
|---|---|
| **Class** | `UnauthorizedError` (`backend/core/errors.py:76-81`) |
| **Status** | `401` |
| **`detail`** | always `null` |
| **Raised at** | `backend/core/security.py:22` and `:32` |
| **Endpoints** | `GET /api/progress`, `POST /api/progress/save` (required); `POST /api/score` never returns it — its dependency is `optional_user`, which swallows this error and returns `None` |

**Two messages, two causes**

| Message | Raise site | Cause |
|---|---|---|
| `Not authenticated` | `backend/core/security.py:22` | the header is absent, does not start with the exact string `"Bearer "`, or has a leading space |
| `Invalid session` | `backend/core/security.py:32` | the header is well-formed but `supabase.get_user(token)` returned `None` — Supabase answered anything other than `200` (observed `403` for a bogus token, i.e. expired, revoked, or simply wrong) |

**Exact observed envelopes**

```json
{"success":false,"data":null,"error":{"code":"unauthorized","message":"Not authenticated","detail":null}}
```

```json
{"success":false,"data":null,"error":{"code":"unauthorized","message":"Invalid session","detail":null}}
```

**Header-parsing matrix (all observed on `GET /api/progress`)**

| `Authorization` value | Status | Message |
|---|---|---|
| *(absent)* | `401` | `Not authenticated` |
| `token abc` | `401` | `Not authenticated` |
| `bearer <token>` (lowercase) | `401` | `Not authenticated` |
| `Bearer` (no space) | `401` | `Not authenticated` |
| ` Bearer <token>` (leading space) | `401` | `Not authenticated` |
| `Bearer ` (empty token) | **`502`** | `Authentication service is unavailable` — see [§3.3](#33-upstream_error--502) |
| `Bearer  <token>` (two spaces) | **`502`** | same, because `split(" ")[1]` is the empty string |
| `Bearer <expired-or-wrong>` | `401` | `Invalid session` |
| `Bearer <valid>` | `200` | — |

**Reproduce**

```bash
curl -s -i http://127.0.0.1:8000/api/progress | head -20
curl -s http://127.0.0.1:8000/api/progress -H 'Authorization: Bearer definitely-not-a-real-token'
```

**What the learner sees:** the route is only called for a signed-in learner
(`progressStore.setUser` skips guests — `frontend/src/state/progressStore.js:85`), and both
calls are silent, so an expired session degrades to "progress stops syncing" with no message.
The user-visible symptom is "my points did not move to my other device", never a login prompt.

**Check first**

1. Is the token actually being attached? `apiClient.authHeaders()` only adds the header when
   `supabase.auth.getSession()` returns a session (`frontend/src/services/apiClient.js:27-31`).
2. Has the access token expired? supabase-js refreshes it automatically, but a client that
   captured a token string once and stored it will hold a dead one. There is no server-side
   refresh — the API never re-issues tokens.
3. Is this the **empty** token case (which returns `502`, not `401`)? Check for a trailing
   `Bearer ` with no value.
4. Are you calling through the Vercel rewrite with a **relative** path? A request to the frontend
   host without the `/api/` prefix never reaches this service.

**Note on the trust model:** a `401` also means the API never looked at the request body. On
`POST /api/progress/save`, auth is resolved before validation, so an unauthenticated request
with a malformed body still returns `401`, not `422` (verified for `{}`,
`{"progress":{}}` and `{"progress":{"points":"many"}}`).

---

### 3.5 `validation_error` — 422

**Means:** FastAPI/pydantic rejected the request before the handler body ran — a missing field,
a wrong type, a non-integer path parameter, or a body that is not JSON at all.

| | |
|---|---|
| **Class** | not an `AppError`; rendered by the `RequestValidationError` handler at `backend/main.py:60-66` |
| **Status** | `422` (deliberately kept, so the status does not change from FastAPI's default) |
| **Message** | always the literal `Request validation failed` |
| **`detail`** | an array of pydantic error objects: `type`, `loc`, `msg`, `input` (plus `ctx` for some types) |
| **Endpoints** | `GET /api/levels/{level_id}`, `POST /api/score`, `POST /api/progress/save` (the latter only with a valid token) |

**`loc` shapes**

| `loc` | Meaning |
|---|---|
| `["path", "level_id"]` | the URL path parameter failed to parse |
| `["body", "<field>"]` | a top-level body field is missing or the wrong type |
| `["body", 0]` | the body itself is not valid JSON (`json_invalid`) |
| `["body"]` | no body at all (`missing`), or the body is not an object (`model_attributes_type`) |
| `["body", "progress", "points"]` | a nested field — `loc` walks into nested models |

**Exact observed envelopes** — one per distinct failure mode:

Missing required fields (`POST /api/score` with `{}`):

```json
{"success":false,"data":null,"error":{"code":"validation_error","message":"Request validation failed","detail":[{"type":"missing","loc":["body","levelId"],"msg":"Field required","input":{}},{"type":"missing","loc":["body","stageIdx"],"msg":"Field required","input":{}},{"type":"missing","loc":["body","stepsUsed"],"msg":"Field required","input":{}},{"type":"missing","loc":["body","lawsUsed"],"msg":"Field required","input":{}},{"type":"missing","loc":["body","hintsUsed"],"msg":"Field required","input":{}}]}}
```

Wrong scalar type (`stepsUsed: "one"`):

```json
{"success":false,"data":null,"error":{"code":"validation_error","message":"Request validation failed","detail":[{"type":"int_parsing","loc":["body","stepsUsed"],"msg":"Input should be a valid integer, unable to parse string as an integer","input":"one"}]}}
```

Wrong collection type (`lawsUsed: "absorption"`):

```json
{"success":false,"data":null,"error":{"code":"validation_error","message":"Request validation failed","detail":[{"type":"list_type","loc":["body","lawsUsed"],"msg":"Input should be a valid list","input":"absorption"}]}}
```

Body is not JSON at all:

```json
{"success":false,"data":null,"error":{"code":"validation_error","message":"Request validation failed","detail":[{"type":"json_invalid","loc":["body",0],"msg":"JSON decode error","input":{},"ctx":{"error":"Expecting value"}}]}}
```

No body sent:

```json
{"success":false,"data":null,"error":{"code":"validation_error","message":"Request validation failed","detail":[{"type":"missing","loc":["body"],"msg":"Field required","input":null}]}}
```

Non-integer path parameter (`GET /api/levels/abc`):

```json
{"success":false,"data":null,"error":{"code":"validation_error","message":"Request validation failed","detail":[{"type":"int_parsing","loc":["path","level_id"],"msg":"Input should be a valid integer, unable to parse string as an integer","input":"abc"}]}}
```

Nested field wrong type (`POST /api/progress/save`, valid token, `{"progress":{"points":"many"}}`):

```json
{"success":false,"data":null,"error":{"code":"validation_error","message":"Request validation failed","detail":[{"type":"int_parsing","loc":["body","progress","points"],"msg":"Input should be a valid integer, unable to parse string as an integer","input":"many"}]}}
```

**Reproduce**

```bash
curl -s -X POST http://127.0.0.1:8000/api/score \
  -H 'Content-Type: application/json' -d '{"levelId":1,"stageIdx":0}'
curl -s http://127.0.0.1:8000/api/levels/abc
```

**What the learner sees:** nothing — `submitScore` is silent. Because the request never reaches
the handler, a `422` on `POST /api/score` also means **nothing was persisted**, even for a
signed-in learner. A silently missing score in `score_history` is often a `422` that nobody
looked at.

**Check first**

1. Read `detail[].loc` and `detail[].msg` — they name the exact field and reason.
2. **Is `Content-Type: application/json` set?** Sending a JSON body without it does not parse:
   the observed code is `model_attributes_type` with the raw string echoed in `input`. This is
   the single most common integration mistake against this API.
3. Are you sending `lawsUsed` as an **array** of law ids, not a string?
4. On `POST /api/progress/save`, is the whole snapshot nested under `progress`? The top-level
   key is required; a bare `{"points":10}` is a `422` with `loc: ["body","progress"]`.

**Known gap:** `error.detail` is a *pydantic* structure, not a stable API of ours. Its `type`
strings (`int_parsing`, `list_type`, `json_invalid`, `model_attributes_type`) come from pydantic
v2 and can change on upgrade. Parse `loc` and `msg` if you must, but treat `type` as diagnostic
only.

**Known gap — no value bounds, so no range errors:** `422` fires for *shape* problems only
(missing, wrong type, unparseable). No `ScoreRequest` or `ProgressData` field carries `ge=`/`le=`
(`backend/api/schemas/score.py:13-20`, `backend/api/schemas/progress.py:11-18`), so an
out-of-range number is **accepted**, not rejected:

```bash
# accepted with 200, and the score is inflated — no 422, no error code
curl -s -X POST http://127.0.0.1:8000/api/score -H 'Content-Type: application/json' \
  -d '{"levelId":1,"stageIdx":0,"stepsUsed":1,"lawsUsed":[],"hintsUsed":-99}'
# -> {"success":true,"data":{"hintIndependence":1020.0,"total":1060.0,"earnedPoints":53,...}}
```

So "the API validated my request" never means "my numbers were sane". See
[API-REFERENCE.md §8.11](../04-api/API-REFERENCE.md#811-score-fields-have-no-lower-bound-so-the-documented-ranges-are-conditional).

---

### 3.6 `http_error` — 404 / 405 / any framework status

**Means:** Starlette rejected the request before any route handler ran — the path does not
exist, or the method is not allowed on that path.

| | |
|---|---|
| **Class** | not an `AppError`; rendered by the `StarletteHTTPException` handler at `backend/main.py:50-57` |
| **Status** | the framework's own: `404`, `405`, or anything else Starlette raises |
| **Message** | the framework's `detail` string, e.g. `Not Found`, `Method Not Allowed` |
| **`detail`** | always `null` (the message already carries the framework text) |

**Exact observed envelopes**

Unknown route (`GET /api/does-not-exist`):

```json
{"success":false,"data":null,"error":{"code":"http_error","message":"Not Found","detail":null}}
```

Wrong method (`GET /api/score`, `DELETE /api/levels`, `OPTIONS /api/levels` with no `Origin`):

```json
{"success":false,"data":null,"error":{"code":"http_error","message":"Method Not Allowed","detail":null}}
```

**Reproduce**

```bash
curl -s http://127.0.0.1:8000/api/does-not-exist
curl -s -X GET http://127.0.0.1:8000/api/score
```

**What the learner sees:** nothing; the SPA only calls the seven real paths.

**Check first**

1. **`http_error` + 404 is not the same as `not_found` + 404.** `http_error` means the *route*
   does not exist (typo, missing `/api` prefix, wrong base URL — very common behind the Vercel
   rewrite). `not_found` means the route exists but the *resource* does not.
2. A `405` from a browser is often a CORS artefact: `OPTIONS` without an `Origin` header is not
   treated as a preflight and falls through to the router, which has no `OPTIONS` handler.
3. `HEAD /` is a `405` too — FastAPI registers only the methods you declare, and
   `backend/api/routes/health.py:15` declares `GET` only. Render's health check uses `GET`, so
   this is harmless.

---

### 3.7 `internal_error` — 500

**Means:** an unhandled exception escaped a route handler. This is always a bug or an
unmodelled input, never something a client can fix by changing its request body.

| | |
|---|---|
| **Class** | not a raised `AppError`; produced by `internal_error_response()` (`backend/core/responses.py:55-59`) |
| **Status** | `500` |
| **Message** | `Internal server error` |
| **`detail`** | always `null` — internals are never leaked to the client |

**Exact observed envelope** (verified by raising a `RuntimeError` inside the level service):

```json
{"success":false,"data":null,"error":{"code":"internal_error","message":"Internal server error","detail":null}}
```

**Where it is produced.** `RequestContextMiddleware` wraps the whole route call, catches
`Exception`, logs `unhandled exception` at `ERROR` level **with the full traceback**
(`backend/core/middleware.py:33-45`) and answers with the envelope above. The
`@app.exception_handler(Exception)` at `backend/main.py:69-76` is a second line of defence for
exceptions raised outside the middleware; its message would be `Unexpected error` (the
`AppError` default, `backend/core/errors.py:32`).

> **Trap:** if you ever see `{"code":"internal_error","message":"Unexpected error"}` in the
> wild, the failure happened *outside* the request middleware — a genuinely different code path
> from the `"Internal server error"` you get from a route bug. Do not grep for the string
> `Unexpected error` in logs expecting it to be common; the observed production shape is
> `Internal server error`.

**Known triggers found by inspection and confirmed by execution**

| Trigger | Observed result |
|---|---|
| `POST /api/score` with `stageIdx: -13` (or `-100`) on a 12-puzzle level | `500` `internal_error`, `message: "Internal server error"` — verified |
| `stageIdx: -12` on the same level | `200` — the first puzzle; a negative index inside the list is *accepted*, and only `-13` overflows it |
| malformed JSON in `content/levels.json` that still parses as a list of the wrong shape | content loading raises `ContentUnavailableError` only for `FileNotFoundError`/`JSONDecodeError` (`:24`); a structurally wrong but syntactically valid file fails later with `KeyError`/`TypeError` |

The `-13` case is the documented signature: the upper bound is guarded, the lower bound is not
(`backend/services/content_service.py:40-41`), so `IndexError` escapes to the middleware.

**Reproduce**

```bash
curl -s -X POST http://127.0.0.1:8000/api/score -H 'Content-Type: application/json' \
  -d '{"levelId":1,"stageIdx":-13,"stepsUsed":1,"lawsUsed":[],"hintsUsed":0}'
```

**What the learner sees:** nothing. `submitScore` is silent. The server log is the only trace.

**Check first**

1. Find the log line with `"message":"unhandled exception"` and read its `exception` field —
   the full traceback is there, joined by `request_id` to the access line
   (`"message":"request completed"`, same `request_id`).
2. There is no error tracker, no Sentry, no alerting: these lines go to **stdout only** and are
   only visible in the Render log stream.
3. Check whether the body is one the API does not model (a negative stage index is the known
   one).

---

## 4. Frontend-only codes

These live entirely in `frontend/src/services/apiClient.js` and are never returned by the
server. They are the `code` on the thrown `ApiError` (`:16-24`).

### 4.1 `network_error`

**Trigger:** `fetch` itself rejected — DNS failure, no connectivity, connection refused, TLS
error, or a response blocked by the browser's CORS policy. There is **no HTTP status**; the
client sets `status: 0` and puts the underlying `TypeError` message in `detail`.

```js
throw new ApiError('Could not reach the Praxis server.', {
  code: 'network_error',
  detail: networkError?.message || String(networkError),
})
```

(`frontend/src/services/apiClient.js:68-74`)

| Property | Value |
|---|---|
| `code` | `network_error` |
| `status` | `0` |
| `message` | `Could not reach the Praxis server.` |
| `detail` | e.g. `Failed to fetch`, `NetworkError when attempting to fetch resource.` |

**What the learner sees:** nothing (all silent callers) — the visible effect is that a score is
not persisted or progress stops syncing.

**Check first**

1. Is the backend running? In dev, `curl http://127.0.0.1:8000/`; the Vite proxy target is
   `VITE_API_TARGET` or `http://127.0.0.1:8000` (`frontend/vite.config.js:8,29-34`).
2. Did the browser block the response for CORS? A blocked response surfaces to `fetch` as a
   `TypeError`, i.e. **as `network_error`, not as a `400`**. The server-side preflight `400` is
   invisible to the page. Compare the browser's Network tab against the server log: if the
   server logged a `400 Disallowed CORS origin`, it is a CORS problem wearing a
   `network_error` costume.
3. In production, is the Vercel rewrite in place? `frontend/vercel.json:3-6` forwards
   `/api/(.*)` to the Render host; without it, `/api/...` hits the SPA fallback and returns
   HTML with status `200`, which would instead produce `invalid_response`.

### 4.2 `invalid_response`

**Trigger:** the response had an OK status but its body was not JSON, or JSON parsing failed
before an envelope could be read. `status` carries the real HTTP status.

```js
throw new ApiError('The server returned an unreadable response.', {
  status: response.status,
  code: 'invalid_response',
  detail: parseError?.message || String(parseError),
})
```

(`frontend/src/services/apiClient.js:100-104`)

| Property | Value |
|---|---|
| `code` | `invalid_response` |
| `status` | the real status, e.g. `200` |
| `message` | `The server returned an unreadable response.` |
| `detail` | the `SyntaxError` message, e.g. `Unexpected token '<', "<!DOCTYPE "...` |

Two important details in the surrounding code:

- `response.status === 204` returns `null` **before** parsing, so an empty response is not an
  error (`:91`).
- If the parsed body *is* an envelope with `success: false`, `unwrap()` throws an `ApiError`
  carrying the **server's** code (`:38-41`); that error is re-thrown unchanged rather than
  being converted to `invalid_response` (`:95-98`). So `invalid_response` means "no envelope at
  all", never "the envelope said no".

**What the learner sees:** nothing, on the silent paths. This is the classic signature of a
request that hit a **static host** instead of the API — an HTML `<!DOCTYPE html>` body with
status `200`. It is exactly what you get if the Vercel rewrite is missing or if you point the
client at the Vite dev server instead of the proxy.

**Check first**

1. Read `detail` — if it mentions `<!DOCTYPE`, you received HTML, not JSON.
2. Verify the request URL is exactly `/api/...` and that a proxy or rewrite is configured for it
   (`frontend/vite.config.js:29-34`, `frontend/vercel.json:3-6`).
3. Check `content-type` in the Network tab: it should be `application/json`.

### 4.3 `http_<status>`

**Trigger:** the response status was not OK **and** its body contained no `error.code` — a
non-JSON body, a JSON body without the envelope, or a gateway/proxy error page. The code is
built by string interpolation, so you will see `http_400`, `http_404`, `http_500`, `http_502`,
`http_503`, and so on.

```js
throw new ApiError(detail?.error?.message || detail?.detail || `Request failed (${response.status})`, {
  status: response.status,
  code: detail?.error?.code || `http_${response.status}`,
  detail,
})
```

(`frontend/src/services/apiClient.js:84-88`)

| Property | Value |
|---|---|
| `code` | `` `http_${response.status}` `` |
| `status` | the real status |
| `message` | the envelope message, else the body's `detail`, else `` `Request failed (${status})` `` |
| `detail` | the parsed body, or `null` if it was not JSON |

**When you get `http_<status>` rather than a server code**

| Server response | Client code |
|---|---|
| `{"success":false,"error":{"code":"not_found",...}}` | `not_found` (the server code always wins) |
| `{"detail":"Not Found"}` (FastAPI's default shape, not ours) | `http_404`, message `Not Found` |
| `Disallowed CORS origin` (`text/plain`) | `http_400`, message `Request failed (400)`, `detail: null` |
| an HTML error page from a proxy or load balancer | `http_502`, message `Request failed (502)`, `detail: null` |

**What the learner sees:** nothing, on the silent paths.

**Check first:** a `http_*` code means the response did **not** come from this API's exception
handlers. Look for a proxy, a rewrite, a gateway, or a route that is not one of the seven. If
the body is `Disallowed CORS origin`, see [§6](#6-the-one-non-envelope-failure-cors-preflight-400).

### 4.4 `api_error`

**Trigger:** the constructor default (`frontend/src/services/apiClient.js:17`) and the fallback
used by `unwrap()` when an envelope has `success: false` but no `error.code`:

```js
throw new ApiError(error.message || 'Request failed', {
  code: error.code || 'api_error',
  detail: error.detail || null,
})
```

(`frontend/src/services/apiClient.js:38-41`)

It is **effectively unreachable from this API** — every backend failure path sets `code`
(`backend/core/responses.py:37-43`). Treat seeing `api_error` in practice as a sign that
something other than the Praxis backend answered (or that a mock/stub returned a bare
`{"success":false}`). `status` stays at its default `0` in that path, because `unwrap()` does
not know the HTTP status.

### 4.5 The `ApiError` object

```js
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'api_error', detail = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}
```

(`frontend/src/services/apiClient.js:16-24`)

| Field | Meaning | Safe to show a user? |
|---|---|---|
| `name` | always `'ApiError'` | — |
| `message` | short, human-readable | **yes** for the server's `error.message`; for `invalid_response` and `network_error` it is a fixed English sentence from the client |
| `status` | HTTP status, `0` when no response arrived | diagnostic |
| `code` | server code, or one of the four client codes | branch on this, not on `message` |
| `detail` | parsed body or underlying error string | **no** — may contain upstream URLs |

**Where `ApiError` is caught:** nowhere. Verified by grepping `frontend/src` — the only
references to `ApiError` are inside `apiClient.js` itself. Of the four real call sites,
`contentApi.fetchLevel`'s network fallback throws (nothing catches it), while the other three —
`scoreApi.submitScore`, `progressApi.loadProgress`, `progressApi.saveProgress` — pass
`silent: true` and return `null` on every failure. **Consequence: no API error is ever displayed
to a learner in the current UI.** `useGameContent` hard-codes `error: null`
(`frontend/src/state/useGameContent.js:20`), and no component renders an API error message.

---

## 5. Status-code and code mapping tables

### 5.1 Every status this API can return

| Status | `error.code` | Typical trigger | Retryable? |
|---|---|---|---|
| `200` | — | success | — |
| `400` | *(none — `text/plain`)* | CORS preflight from a disallowed origin | no |
| `401` | `unauthorized` | missing/invalid bearer token | after signing in |
| `404` | `not_found` | unknown level or stage | no |
| `404` | `http_error` | unknown route | no |
| `405` | `http_error` | wrong method on a real route | no |
| `422` | `validation_error` | malformed body or path parameter | after fixing the request |
| `500` | `internal_error` | unhandled exception | maybe — but it is a bug |
| `502` | `upstream_error` | Supabase unreachable or rejecting | yes, with backoff |
| `503` | `content_unavailable` | `content/*.json` missing on the server | no — needs a deploy fix |

### 5.2 Which codes each endpoint can produce

| Endpoint | Possible `error.code` values |
|---|---|
| `GET /` | `http_error` (405), `internal_error` |
| `GET /api/levels` | `content_unavailable`, `http_error`, `internal_error` |
| `GET /api/levels/{level_id}` | `not_found`, `validation_error`, `content_unavailable`, `http_error`, `internal_error` |
| `GET /api/laws` | `content_unavailable`, `http_error`, `internal_error` |
| `POST /api/score` | `not_found`, `validation_error`, `content_unavailable`, `upstream_error` (**only** when a bearer token is sent and Supabase Auth is unreachable), `http_error`, `internal_error` |
| `GET /api/progress` | `unauthorized`, `upstream_error`, `http_error`, `internal_error` |
| `POST /api/progress/save` | `unauthorized`, `validation_error` (valid token only), `upstream_error`, `http_error`, `internal_error` |

### 5.3 Which client code each failure becomes

| Server response | `ApiError.status` | `ApiError.code` |
|---|---|---|
| any envelope with `success: false` and `error.code` | the HTTP status | the server code, unchanged |
| envelope with `success: false` and no `error.code` | `0` (unwrap does not know the status) | `api_error` |
| non-2xx with a non-envelope JSON body | the HTTP status | `http_<status>` |
| non-2xx with a non-JSON body | the HTTP status | `http_<status>` |
| 2xx with an unparseable body | `200` | `invalid_response` |
| `fetch` rejection (no response at all) | `0` | `network_error` |

---

## 6. The one non-envelope failure: CORS preflight 400

Exactly one failure path bypasses the envelope entirely, and it is worth calling out because it
looks nothing like the rest of the API.

```text
OPTIONS /api/levels
Origin: https://evil.example
Access-Control-Request-Method: GET

HTTP/1.1 400 Bad Request
content-type: text/plain; charset=utf-8

Disallowed CORS origin
```

Starlette's `CORSMiddleware` — added outermost at `backend/main.py:30-36` — short-circuits
before the router, so this response has:

- **no** `{success,data,error}` envelope;
- **no** `X-Request-ID` header (the only response that lacks it);
- **no** JSON at all: `content-type: text/plain; charset=utf-8`.

A browser never sees this body; it only sees the request fail, which `apiClient.js` reports as
`network_error` (see [§4.1](#41-network_error)). The `400` is visible only to a non-browser
client (curl, an integration test, the server log).

**Fix:** add the origin to `DEFAULT_CORS_ORIGINS` or set `FRONTEND_URL`
(`backend/config/settings.py:23-27,66-71`), then restart — CORS origins are read once at import
time into the `settings` singleton.

---

## 7. Triage playbook

### 7.1 Start from the symptom

| Symptom | Most likely code | First check |
|---|---|---|
| "My score did not save" | any of `unauthorized`, `upstream_error`, `validation_error` — all swallowed by `silent: true` | server log for `failed to save score to database`; then confirm the token was valid and the body had `Content-Type: application/json` |
| "Progress does not sync between devices" | `unauthorized` (`Invalid session`) or `upstream_error` | token freshness; then the empty-`Bearer` `502` trap |
| "The API returns 404 for a level I can see in the UI" | `not_found` | level ids are 0-based; the Tutorial is id `0` |
| "The API returns 502 but `/api/levels` works" | `upstream_error` (`Progress storage is unavailable`) | the service-role key and PostgREST reachability — content routes never touch Supabase |
| "Every request fails from the browser, but curl works" | `network_error` (client-side) | CORS origin allowlist, or a missing Vercel rewrite |
| "The client says `invalid_response`" | `invalid_response` (client-side) | you are receiving HTML — the request hit a static host, not the API |
| "Everything 503s right after deploy" | `content_unavailable` | `content/` was not included in the deployed build |
| "A level id I know is right returns 404" | `not_found` vs `http_error` | check whether the *route* exists (`http_error`) or the *level* does (`not_found`) |

### 7.2 Start from a `request_id`

Every non-preflight response carries `X-Request-ID`, and every log line for that request carries
the same value (`backend/core/middleware.py:27-61`). That makes one grep enough to reconstruct
a request:

```bash
# the access line: status and duration
grep '"request_id": "abc123deadbeef"' render.log | grep '"message": "request completed"'

# the failure line, if any, with the traceback
grep '"request_id": "abc123deadbeef"' render.log | grep '"message": "unhandled exception"'

# an upstream dependency failure
grep '"request_id": "abc123deadbeef"' render.log | grep '"message": "application error"'
```

Log lines are one JSON object per line on stdout with keys
`ts, level, logger, message, request_id` plus merged `fields` and an optional `exception`
(`backend/core/logging.py:34-50`). Observed lines:

```json
{"ts":"2026-09-28T05:39:52.152Z","level":"INFO","logger":"praxis.request","message":"request completed","request_id":"100aa492f2c24f8290d44a0e25a39079","method":"GET","path":"/api/levels","status":200,"duration_ms":2.75}
```

```json
{"ts":"2026-09-28T05:39:53.041Z","level":"ERROR","logger":"praxis.api","message":"application error","request_id":"8eb98da396274048a7ae4e826b681d4a","code":"upstream_error","status":502,"path":"/api/progress"}
```

```json
{"ts":"2026-09-28T05:39:53.755Z","level":"ERROR","logger":"praxis.api","message":"application error","request_id":"de2c264af090472e9e93730f7b066808","code":"content_unavailable","status":503,"path":"/api/levels"}
```

Note that `logger":"praxis.api"` with `"message":"application error"` is emitted for every
`AppError` whose status is `>= 500` (`backend/main.py:42-46`) — that is your signal for
`upstream_error` and `content_unavailable`. `4xx` `AppError`s are not logged as errors at all;
only their access line exists.

### 7.3 A minimal end-to-end check

```bash
BASE=http://127.0.0.1:8000

curl -s -o /dev/null -w 'health %{http_code}\n'            $BASE/
curl -s -o /dev/null -w 'levels %{http_code}\n'            $BASE/api/levels
curl -s -o /dev/null -w 'laws %{http_code}\n'              $BASE/api/laws
curl -s -o /dev/null -w 'unknown level %{http_code}\n'     $BASE/api/levels/999
curl -s -o /dev/null -w 'progress no auth %{http_code}\n'  $BASE/api/progress
curl -s -o /dev/null -w 'score %{http_code}\n' -X POST $BASE/api/score \
  -H 'Content-Type: application/json' \
  -d '{"levelId":1,"stageIdx":0,"stepsUsed":1,"lawsUsed":["absorption"],"hintsUsed":0}'
```

Expected: `200`, `200`, `200`, `404`, `401`, `200`. Anything else localises the fault to one
layer immediately.

---

## 8. Traps and things that do not exist

| Trap / non-existent code | Reality |
|---|---|
| `rate_limited` / `429` | **No rate limiting exists.** No limiter middleware, no `429` anywhere. A busy client will simply saturate the single Render instance. |
| `out_of_range` / any bound-violation code | **None exists, and no field is bounded.** `ScoreRequest` has no `ge=`/`le=` constraint (`backend/api/schemas/score.py:13-20`), so a negative `hintsUsed`/`guidesUsed` is accepted and inflates the score instead of erroring — verified: `hintsUsed:-99` → `200`, `total 1060.0`, `earnedPoints 53`. There is no `422` for it because the pydantic schema has no bounds to violate. See [API-REFERENCE.md §8.11](../04-api/API-REFERENCE.md#811-score-fields-have-no-lower-bound-so-the-documented-ranges-are-conditional). |
| `forbidden` / `403` | **No authorization beyond authentication.** Any valid token can read and write only *its own* rows, by `user_id` filter — but no code path returns `403`. |
| `conflict` / `409` | PostgREST conflicts are converted to `502 upstream_error` by `raise_for_status()` inside `_execute` (`backend/repositories/progress_repository.py:21-26`). |
| `not_implemented` / `501` | Not used anywhere. |
| `timeout` / `408` | Not used. Upstream timeouts surface as `502`. |
| A `401` "reason" field | There is none. Distinguish `Not authenticated` from `Invalid session` by `error.message`. |
| `WWW-Authenticate` header on `401` | Not sent — the `401` is a plain envelope raised by our dependency, not by an HTTP auth scheme. |
| An `error.id` or correlation field inside the envelope | Not present. Correlation lives only in the `X-Request-ID` **header**. |
| `internal_error` message `Unexpected error` | That string exists in `AppError.default_message` (`backend/core/errors.py:32`) but the observed `500` says `Internal server error` (`backend/core/responses.py:59`). |
| Error codes in `/openapi.json` | Only `200` (and `422` for validated routes) are documented per operation; `401`/`404`/`500`/`502`/`503` are **not** in the spec. This file is the reference. |
| An Authorize button in `/docs` | Absent — no OpenAPI security scheme is emitted. See [API-REFERENCE.md §2.4](../04-api/API-REFERENCE.md#24-authentication-supabase-bearer-tokens). |

---

## 9. Related reading

| Document | Why |
|---|---|
| [API-REFERENCE.md](../04-api/API-REFERENCE.md) | endpoint-by-endpoint requests, responses and curl examples |
| [SCHEMA.md](../03-database/SCHEMA.md) | the tables behind `upstream_error` on the progress routes |
| [known-limitations.md](../07-explanation/known-limitations.md) | the canonical discrepancy register, including the permissive RLS policies that make `upstream_error` less protective than it sounds |
| [runbooks.md](../08-devops/runbooks.md) | step-by-step recovery for a `502`/`503` in production |
| [monitoring.md](../08-devops/monitoring.md) | which log lines to alert on (`application error`, `unhandled exception`, `failed to save score to database`) |
| [configuration-guide.md](../08-devops/configuration-guide.md) | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `FRONTEND_URL` — the root cause of most `502`s |
| [glossary.md](../10-project/glossary.md) | envelope, engine contract, law id, learner |
