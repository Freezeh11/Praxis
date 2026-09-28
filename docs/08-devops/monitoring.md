# Monitoring and observability — what to watch, and what "normal" looks like

**What this is:** the observability reference for Praxis — the health probe, the Render and Supabase
dashboards, the backend's structured log schema, how to correlate a learner's failing request with a
log line, and concrete alert thresholds you can copy into a monitor.

**Who it's for:** whoever is on call or setting up alerting. It assumes the deployment in
[deployment.md](deployment.md) and uses the procedures in [runbooks.md](runbooks.md) as the "what to
do next" layer.

**Scope note:** there is no metrics endpoint, no tracing and no alerting configuration in this
repository. Everything below is built from the pieces the code *does* provide: one JSON log line per
request, an `X-Request-ID` correlation header, and a deliberately plain health endpoint.

## Contents

1. [The three things to watch](#1-the-three-things-to-watch)
2. [The health probe: `GET /`](#2-the-health-probe)
3. [Render: metrics, logs, deploys](#3-render-metrics-logs-deploys)
4. [The structured log schema](#4-the-structured-log-schema)
5. [Correlating a request by `request_id`](#5-correlating-a-request-by-request_id)
6. [Supabase dashboard signals](#6-supabase-dashboard-signals)
7. [Alert criteria and thresholds](#7-alert-criteria-and-thresholds)
8. [What not to alert on](#8-what-not-to-alert-on)
9. [Monitoring gaps in this project](#9-monitoring-gaps-in-this-project)

---

## 1. The three things to watch

| Layer | Tool | Primary signals | Where the detail is |
|---|---|---|---|
| Backend service | Render dashboard | health probe, 5xx rate, latency, restarts, deploy status | §3, §4 |
| Data + auth | Supabase dashboard | database size, table growth, API/PostgREST logs, Auth logs, project state | §6 |
| Frontend | Vercel dashboard + browser | build status, deployment aliasing, console errors, rewrite health | §3.4 |

There is exactly **one** endpoint that should ever be used as a liveness probe: `GET /` (§2).

---

## 2. The health probe

```python
@router.get("/")
def read_health() -> dict[str, Any]:
    """Liveness probe: plain payload, no envelope."""
    return {"message": "Praxis API is running", "docs": "/docs"}
```

`backend/api/routes/health.py:15-18`. The module docstring above it is explicit about the
contract — "The `/` health probe — plain JSON, deliberately outside the envelope. Render reads this
body verbatim" (`backend/api/routes/health.py:1-3`).

Verified live:

```text
HTTP/1.1 200 OK
server: uvicorn
content-length: 50
content-type: application/json
x-request-id: e15778ac9dd946f5b44d85d6197b9d4c

{"message":"Praxis API is running","docs":"/docs"}
```

### 2.1 Why it must stay plain JSON

1. **It is the only route outside the `{success,data,error}` envelope.** Everything under `/api/*`
   wraps its payload (`backend/core/responses.py:32-43`). A monitor, a load balancer or a human
   reading the body should see a stable two-key object, not a nested envelope that can change shape
   with the API.
2. **It is cheap and dependency-free.** It touches no database, no Supabase call, no log-side effect
   beyond the access line. Verified: with `content/` deleted, `/api/levels` returned `503
   content_unavailable` while `GET /` still returned `200` with the same body.
3. **It answers even when the Supabase credentials are wrong** — as long as the process booted. It is
   a *liveness* probe, not a readiness probe: it tells you the ASGI app is serving, not that the
   database is reachable.
4. **Changing it breaks monitoring silently.** If someone "improves" it by adding an envelope, a
   monotonic check on the exact body fails while the service is perfectly healthy — a false alarm, and
   the kind that erodes trust in alerting.

### 2.2 What `render.yaml` does and does not configure

`render.yaml` declares **no `healthCheckPath`**. The code above documents `/` as the intended probe,
but nothing in the repository wires Render's zero-downtime health check to it. Recommendations:

- Add `healthCheckPath: /` to `render.yaml` (after `render.yaml:8`) if you want Render to gate
  deploys on the endpoint, then confirm the setting in the dashboard. See Render's
  [health-check documentation](https://render.com/docs/health-checks) for the platform semantics.
- Keep an **external** uptime monitor on `GET /` regardless — it catches the free-plan sleep/wake cycle
  that an internal health check does not, and it doubles as a warm-up
  ([runbooks.md](runbooks.md) RB-09).

### 2.3 A probe you can run from anywhere

**macOS / Linux:**

```bash
URL=https://praxis-backend-5302.onrender.com/
code=$(curl -s -m 60 -o /tmp/probe.json -w '%{http_code}' "$URL")
echo "status=$code body=$(cat /tmp/probe.json)"
```

**Windows (PowerShell):**

```powershell
$r = Invoke-WebRequest -Uri 'https://praxis-backend-5302.onrender.com/' -TimeoutSec 60
"status=$($r.StatusCode) body=$($r.Content)"
```

Alert when the status is not `200` **or** the body is not
`{"message":"Praxis API is running","docs":"/docs"}`. Allow one slow attempt per idle period; see §7.

---

## 3. Render: metrics, logs, deploys

### 3.1 Metrics worth looking at

Dashboard → your service → **Metrics**. The signals that map onto this application:

| Metric | Why it matters here | Normal-ish |
|---|---|---|
| Response time | rises first when Supabase is slow, because the sync Supabase calls block the event loop (`backend/supabase_client.py:69`, routes are `async def`) | tens to hundreds of ms once awake |
| Request rate (RPS) | a flat zero line for a long period precedes a cold start | low, bursty |
| 5xx rate | the signal for `content_unavailable`, `upstream_error`, unhandled exceptions | 0 |
| CPU / memory | Python + uvicorn is small; there is no cache to grow — `lru_cache` holds only the two JSON files (`backend/repositories/content_repository.py:34-43`) | low and flat |
| Bandwidth/egress | the SPA's `880 kB` JS bundle is served by Vercel, not Render; Render egress is JSON only | small |
| Instance events | restarts and sleep/wake transitions explain latency spikes | — |

There is no per-route breakdown in the dashboard. For that, use the logs (§4) — every completed
request carries `method`, `path`, `status` and `duration_ms`.

### 3.2 Logs

Dashboard → your service → **Logs** shows the same JSON lines the app writes to stdout. Two important
properties:

- The app writes **one JSON object per line** (`backend/core/logging.py:50`), so dashboard search works
  on any key name or value, including `request_id`.
- The platform's own messages (build output, "Your service is live") are interleaved as plain text.
  Filter by `"logger": "praxis.` to isolate application lines.

### 3.3 Deploys

Every push to the tracked branch triggers a build. Watch for:

- `Successfully installed …` — because the backend has **no pinned dependency versions**, this line is
  the record of what actually got installed. Capture it when investigating "it changed by itself".
- `Application startup complete.` — proves the credential check passed
  (`backend/config/settings.py:74-75`).
- `==> Your service is live 🎉` — the deploy is serving traffic.

A deploy that exits during import produces no `Application startup complete.`; the reason is in the
log as a Python traceback, usually `RuntimeError: Missing required environment variable: …`.

### 3.4 Vercel

Dashboard → project → **Deployments**: build status, promoted production deployment, and the domain
alias. Two checks belong in any monitoring routine:

```bash
curl -s -o /dev/null -w 'SPA %{http_code}\n' https://praxis-seven-puce.vercel.app/
curl -s -o /dev/null -w 'rewrite %{http_code} %{content_type}\n' https://praxis-seven-puce.vercel.app/api/levels
```

Expected: `200` and `200 application/json`. The second line is the one that breaks when
`frontend/vercel.json:3-6` stops matching the backend host.

---

## 4. The structured log schema

`backend/core/logging.py:34-50` defines one formatter for the whole application:

```python
payload: dict[str, object] = {
    "ts": datetime.fromtimestamp(record.created, tz=timezone.utc)
    .isoformat(timespec="milliseconds")
    .replace("+00:00", "Z"),
    "level": record.levelname,
    "logger": record.name,
    "message": record.getMessage(),
    "request_id": current_request_id(),
}
payload.update(getattr(record, "fields", None) or {})
if record.exc_info:
    payload["exception"] = self.formatException(record.exc_info)
```

| Key | Always present? | Type | Meaning |
|---|---|---|---|
| `ts` | yes | string | UTC timestamp, millisecond precision, `Z` suffix |
| `level` | yes | string | `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `logger` | yes | string | module logger name: `praxis.api`, `praxis.request`, `services.progress_service`, … |
| `message` | yes | string | human summary, e.g. `request completed` |
| `request_id` | yes | string | the correlation id; `-` outside a request (`backend/core/logging.py:14`) |
| `method`, `path`, `status`, `duration_ms` | on access lines | mixed | merged from `log_fields(...)` at `backend/core/middleware.py:48-57` |
| `code`, `status`, `path` | on application errors ≥ 500 | mixed | merged at `backend/main.py:42-46` |
| `exception` | only on errors with a traceback | string | full formatted traceback |
| `user_id`, `level_id` | on persistence failures | mixed | merged at `backend/services/progress_service.py:124-127` |

### 4.1 The three log lines that matter

**1. Every completed request** — `logger: praxis.request`, `message: request completed`
(`backend/core/middleware.py:48-57`). Verified output:

```json
{"ts": "2026-09-28T05:39:53.501Z", "level": "INFO", "logger": "praxis.request", "message": "request completed", "request_id": "b923a6d9ddfa4ef887b28e12486ecad4", "method": "GET", "path": "/", "status": 200, "duration_ms": 0.75}
```

**2. A handled application error ≥ 500** — `logger: praxis.api`, `message: application error`, with
`code` and `status` (`backend/main.py:39-47`). Verified output for a `503`:

```json
{"ts": "2026-09-28T05:39:53.504Z", "level": "ERROR", "logger": "praxis.api", "message": "application error", "request_id": "b2d7ef5a130e48c88c18ce2b6c4465d2", "code": "content_unavailable", "status": 503, "path": "/api/levels"}
```

Note that only errors with `status >= 500` are logged here: a `404` or `401` is expected traffic and
stays quiet.

**3. The swallowed persistence failure** — `logger: services.progress_service`,
`message: failed to save score to database`, with the full traceback in `exception`
(`backend/services/progress_service.py:87-127`). This one is easy to miss and important:

- Score persistence runs as a FastAPI background task (`backend/api/routes/score.py:38-39`) and is
  deliberately best-effort: a storage failure is logged and swallowed so it can never break gameplay.
- The learner therefore sees a normal score, while `score_history` silently stops growing.
- **This log line is the only outward signal.** Alert on it (§7).

Error codes you will see in the `code` field are enumerated in `backend/core/errors.py:11-20`:
`not_found`, `content_unavailable`, `upstream_error`, `unauthorized`, `validation_error`,
`http_error`, `internal_error`.

---

## 5. Correlating a request by `request_id`

`RequestContextMiddleware` reads `X-Request-ID` from the incoming request or generates a fresh
`uuid4().hex`, binds it to the request's context so every line the request logs carries it, and echoes
it back in the response (`backend/core/middleware.py:26-62`).

### 5.1 From a learner report to a log line

1. Get the request id from the response headers (browser DevTools → Network → the failing request →
   Response Headers → `x-request-id`).
2. Search the backend logs for that value.
3. If the request never produced a log line at all, it never reached the app — check the platform
   (Render asleep? Vercel rewrite broken?) and the client (CORS preflight, DNS).

### 5.2 Commands

**Capture an id and search a local log:**

```bash
curl -s -D - -o /dev/null http://127.0.0.1:8000/api/levels | grep -i x-request-id
grep 'paste-the-id-here' backend.log
```

**Windows (PowerShell):**

```powershell
curl.exe -s -D - -o NUL http://127.0.0.1:8000/api/levels | Select-String 'x-request-id'
Select-String -Path backend.log -Pattern 'paste-the-id-here'
```

**Useful aggregations (`jq`):**

```bash
jq -c 'select(.status >= 500)'                 backend.log   # all server errors
jq -c 'select(.duration_ms > 1000) | {path, duration_ms}' backend.log
jq -r 'select(.code != null) | .code'           backend.log | sort | uniq -c | sort -rn
jq -c 'select(.message == "failed to save score to database")' backend.log
```

**Without `jq`:**

```bash
python -c "
import json, collections
codes = collections.Counter(); slow = []
for line in open('backend.log'):
    try: r = json.loads(line)
    except Exception: continue
    if r.get('code'): codes[r['code']] += 1
    if r.get('duration_ms', 0) > 1000: slow.append((r.get('path'), r['duration_ms']))
print('codes:', codes.most_common())
print('slow:', slow[:10])
"
```

**Render dashboard:** paste the id into the log search box. Because the id is on every line of the
request, one search returns the whole story — access line plus any application error.

### 5.3 Proactive correlation in the browser

The SPA does not surface `x-request-id` in the UI. When a learner reports "it failed", ask them for
the **Network tab** entry, or reproduce it yourself and read the header. If you add client-side
logging later, capture
`response.headers.get('x-request-id')` — the backend already sends it on every response
(`backend/core/middleware.py:61`).

---

## 6. Supabase dashboard signals

### 6.1 Project health

| Where | What to look for |
|---|---|
| Project home | **Project status** — a paused project serves nothing and produces `502 upstream_error` from the backend |
| **Reports / Database** | database size, table sizes, index sizes |
| **Reports / API** | request counts and latency for PostgREST and Auth — this is the traffic the backend generates |
| **Logs / PostgREST** | the actual REST calls; `4xx` bursts usually mean a bad/rotated key |
| **Logs / Auth** | sign-ups, sign-ins, confirmations, token rejections |
| **Auth / Users** | learner accounts; use it to tie a `user_id` in a log line to an email address |
| **Advisors / Security** | flags tables with RLS enabled but permissive policies — expect the three application tables to be listed; that is finding D20, not news |

### 6.2 Database size

The three application tables are tiny by construction:

| Table | Growth driver | Notes |
|---|---|---|
| `user_progress` | one row per learner | dominates by row count |
| `stage_progress` | ≤ 40 rows per learner (4 levels, 4+12+12+12 stages) | `UNIQUE(user_id, level_id, stage_idx)` |
| `score_history` | **one row per scored attempt, forever** | the only table with unbounded growth |

`score_history` is append-only — `insert_score_history` (`backend/repositories/progress_repository.py:57-59`)
is called on every authenticated `POST /api/score` (`backend/services/progress_service.py:94-108`), and
nothing ever deletes from it. That is the table to watch on a long-lived project.

Check the counts directly (Supabase SQL editor):

```sql
select
  (select count(*) from user_progress)  as learners,
  (select count(*) from stage_progress) as stage_rows,
  (select count(*) from score_history)  as attempts,
  pg_size_pretty(pg_total_relation_size('user_progress'))  as user_progress_size,
  pg_size_pretty(pg_total_relation_size('stage_progress')) as stage_progress_size,
  pg_size_pretty(pg_total_relation_size('score_history'))  as score_history_size;
```

Verify the tables' shape at any time with the definition in
[SCHEMA.md](../03-database/SCHEMA.md); the DDL is [`database/init.sql`](../../database/init.sql).

### 6.3 Auth

Watch **Auth → Users** and the Auth logs for:

- a spike in failed sign-ins (usually a configuration problem, not an attack, in a teaching app);
- users created but never confirmed (if email confirmation is enabled —
  [installation-manual.md](installation-manual.md) §1.4);
- token-related `4xx` responses that line up with `401 unauthorized` bursts in the backend logs
  ([runbooks.md](runbooks.md) RB-03).

RLS does **not** protect these tables usefully today: the policies are `FOR ALL USING (true)` for all
roles ([configuration-guide.md](configuration-guide.md) §7). Do not treat a quiet security advisor as
proof of safety.

---

## 7. Alert criteria and thresholds

Copy-pasteable starting points. Every threshold is expressed so it can be evaluated from the probes and
logs above; tune them once you have a week of real traffic.

| # | Signal | Condition | Severity | First response |
|---|---|---|---|---|
| 1 | Liveness | `GET /` not `200`, or body ≠ the plain two-key JSON, on **2 consecutive** checks | page | [RB-01](runbooks.md#rb-01-the-backend-will-not-start) / [RB-07](runbooks.md#rb-07-roll-back-a-render-deploy) |
| 2 | Cold start | first `GET /` after an idle period > 60 s, and the immediate retry succeeds | info | none — [RB-09](runbooks.md#rb-09-the-deployed-api-is-slow-on-the-first-request) |
| 3 | Server-error rate | any `5xx` from `/api/*` for more than **2 %** of requests in a 5-minute window (with ≥ 20 requests) | page | match `code` in the log → [RB-04](runbooks.md#rb-04-503-content_unavailable) / [RB-05](runbooks.md#rb-05-502-upstream_error-from-supabase) |
| 4 | `content_unavailable` | ≥ 1 occurrence, immediately | page | [RB-04](runbooks.md#rb-04-503-content_unavailable) — content is missing from the deploy |
| 5 | `upstream_error` | ≥ 3 occurrences in 5 minutes | page | [RB-05](runbooks.md#rb-05-502-upstream_error-from-supabase) — Supabase unreachable or key invalid |
| 6 | Persistence failures | `"failed to save score to database"` ≥ 1 occurrence in 15 minutes | ticket, same day | silent data loss; [RB-10](runbooks.md#rb-10-find-the-cause-with-structured-logs) then [RB-05](runbooks.md#rb-05-502-upstream_error-from-supabase) |
| 7 | Latency | median `duration_ms` for `/api/progress/save` > **2000 ms** over 15 minutes | ticket | [RB-06](runbooks.md#rb-06-database-connection-pressure-and-slow-saves) |
| 8 | Any other request latency | p95 `duration_ms` > 3000 ms over 15 minutes, excluding the first request after idle | ticket | look for Supabase latency; then RB-06 |
| 9 | 401 rate | `401` on `/api/progress*` above 10 % of authenticated calls | ticket | [RB-03](runbooks.md#rb-03-401-unauthorized-on-progress-routes) — often a key rotation or a paused project |
| 10 | Deploy | no `Application startup complete.` within 5 minutes of a deploy | page | [RB-07](runbooks.md#rb-07-roll-back-a-render-deploy) |
| 11 | Database size | `score_history` row count or total database size above 80 % of your Supabase plan quota | ticket | review retention; the table is append-only |
| 12 | Frontend rewrite | `GET /api/levels` on the Vercel domain returns non-JSON | page | [RB-02](runbooks.md#rb-02-backend-is-up-but-the-frontends-api-calls-fail) |
| 13 | Production drift | `GET /api/levels` on the Render host does not start with `{"success":true` | ticket | [deployment.md](deployment.md) §8 — production is behind the repo |

Notes that keep these thresholds honest:

- **Threshold 1 vs 2.** A free-plan instance answers slowly when it wakes. Do not page on a single slow
  response; require the retry to fail before treating it as down.
- **Threshold 3 requires volume.** With a handful of requests per hour, percentage thresholds are
  noise. Prefer the absolute conditions (4, 5, 6) at low volume.
- **Threshold 6 is the one that has no other symptom.** The learner's UI shows a correct score because
  persistence is best-effort by design (`backend/services/progress_service.py:123-127`).

---

## 8. What not to alert on

| Signal | Why it is not an incident |
|---|---|
| `404 not_found` on `/api/levels/{id}` | expected for unknown ids; there is an explicit test 404 envelope |
| `401 unauthorized` on `/api/progress` without a token | that is the route's designed answer for anonymous callers |
| `422 validation_error` | the frontend contracts are frozen; a 422 means a caller sent a bad body |
| `RequestValidationError` bodies in the log | caught and rendered by `backend/main.py:60-66`; not a crash |
| 405 on the wrong method | `backend/main.py:50-57` renders it in the envelope on purpose |
| Missing `Authorize` button in `/docs` | no OpenAPI security scheme is declared; not a deploy failure ([deployment.md](deployment.md) §6.1) |
| A single slow first request after idle | free-plan cold start |
| Supabase security-advisor listing the three tables | the permissive RLS policies are known (D20) |

---

## 9. Monitoring gaps in this project

Stated plainly so nobody assumes coverage that does not exist:

- **No `/metrics` endpoint** and no OpenTelemetry/Prometheus integration.
- **No tracing.** Correlation beyond one request relies on `request_id`.
- **No frontend error reporting.** A React error is caught by `ErrorBoundary`, but nothing reports it
  to a server.
- **No alerting configuration is stored in this repository.** Everything in §7 must be created in the
  Render/Vercel/Supabase dashboards or in an external monitor.
- **No heartbeat for score persistence.** A `score_history` insert failure is only visible in the log
  (threshold 6), never in the UI.
- **Response bodies are not logged**, only status, path, duration and the error `code`
  (`backend/core/middleware.py:48-57`, `backend/main.py:42-46`). That is a deliberate privacy choice —
  do not "fix" it by logging payloads, which would put learner identifiers in the log stream.

Track these as known limitations rather than assuming they are monitored. See
[known-limitations.md](../07-explanation/known-limitations.md).

Related reading: [runbooks.md](runbooks.md) · [deployment.md](deployment.md) ·
[configuration-guide.md](configuration-guide.md) · [installation-manual.md](installation-manual.md) ·
[error codes](../06-reference/error-codes.md) · [database schema](../03-database/SCHEMA.md).
