# Configuration guide — environment variables and runtime knobs

**What this is:** every environment variable Praxis reads, where each value comes from, which process
reads it, what breaks when it is missing or wrong, and how to change it locally and in production.

**Who it's for:** anyone setting up a machine (start with
[installation-manual.md](installation-manual.md)), deploying ([deployment.md](deployment.md)) or
debugging a connection problem ([runbooks.md](runbooks.md)).

**Hard rule:** this document never reproduces a real credential. Values appear only as placeholders —
`https://<project-ref>.supabase.co`, `<service-role-key>`, `<anon-key>`. When you copy a command from
here, substitute from your password manager or the Supabase dashboard.

The complete list of *constants* (scoring weights, design tokens, storage keys, and so on) lives in
[the configuration reference](../06-reference/config-reference.md). This guide covers the
environment.

## Contents

1. [The three configuration surfaces](#1-the-three-configuration-surfaces)
2. [How environment variables are loaded](#2-how-environment-variables-are-loaded)
3. [Backend variables](#3-backend-variables)
4. [Frontend variables](#4-frontend-variables)
5. [Dev-server-only variables](#5-dev-server-only-variables)
6. [All variables at a glance](#6-all-variables-at-a-glance)
7. [Security notes](#7-security-notes)
8. [Recipes](#8-recipes)
9. [Dead configuration you should ignore](#9-dead-configuration-you-should-ignore)
10. [Verifying your configuration](#10-verifying-your-configuration)

---

## 1. The three configuration surfaces

| Surface | File(s) | Governs | Committed to git? |
|---|---|---|---|
| Backend environment | `backend/.env` (local), Render dashboard (production) | Supabase credentials + CORS origin | **No** — ignored by `.gitignore:3` |
| Frontend build environment | `frontend/.env.local` (local), Vercel dashboard (production) | Supabase URL + anon key baked into the bundle | **No** — ignored by `frontend/.gitignore:15` |
| Code constants | `backend/config/constants.py`, `frontend/src/config/*.js`, `frontend/tailwind.config.js`, `frontend/src/styles/tokens.css` | scoring, progression, timing, storage keys, design tokens | **Yes** — these are code |

Only the first two are environment variables. Everything in the third row is a deliberately committed
tuning constant — see [the configuration reference](../06-reference/config-reference.md).

There is **no** secrets manager, no config server and no `.env.example` in this repository. Two files
to create by hand, six variables in total, two of them secret.

---

## 2. How environment variables are loaded

### 2.1 Backend: `python-dotenv`, real environment wins

`backend/config/settings.py:14-20`:

```python
# backend/config/settings.py -> backend/
BACKEND_DIR = Path(__file__).resolve().parents[1]

# Load backend/.env explicitly first so the app works from any working
# directory, then fall back to python-dotenv's own cwd-relative search (the
# original behaviour). Existing environment variables always win.
load_dotenv(BACKEND_DIR / ".env", override=False)
load_dotenv(override=False)
```

Consequences:

1. `backend/.env` is loaded by **absolute path**, so `uvicorn main:app` behaves identically whether
   you launch it from the repository root or from `backend/`.
2. A cwd-relative `.env` is loaded second, as a convenience. If both exist, `backend/.env` wins for
   keys it defines, because `python-dotenv` does not overwrite a key already present in
   `os.environ` when `override=False`.
3. **A real environment variable always beats both files.** This is what makes Render work: the
   dashboard values are injected into the process environment, so no file has to exist in the build.
4. This module is imported by `backend/supabase_client.py:12`, which means the environment is read
   at **import time** — see §3.1 for why that matters so much.

### 2.2 Frontend: Vite env files, `VITE_` prefix only

Vite loads `.env`, `.env.local`, `.env.[mode]` and `.env.[mode].local` from the Vite root
(`frontend/`, since `vite.config.js` sets no `envDir`). Precedence follows Vite's documented rules:
mode-specific beats generic, and `.local` beats non-`.local`.

Two rules decide almost every mistake:

- **Only `VITE_`-prefixed variables exist in the browser.** `import.meta.env.VITE_SUPABASE_URL`
  works; `import.meta.env.SUPABASE_URL` is `undefined`. A stray `SUPABASE_URL` in
  `frontend/.env.local` is silently invisible.
- **Values are inlined at build time.** Changing a `VITE_*` value requires a dev-server restart
  locally and a redeploy on Vercel. There is no runtime lookup.

The *Vite config file itself* runs in Node, not in the browser, and reads `process.env` directly
(`frontend/vite.config.js:8`). Vite does **not** copy `.env` file contents into `process.env`, so a
variable consumed by the config must come from the shell. Verified on this checkout: with
`VITE_API_TARGET=http://from-env-file:9999` in a `.env.local` next to a config that logs
`process.env.VITE_API_TARGET`, the logged value was `undefined`; with
`VITE_API_TARGET=http://from-shell:8001` exported in the shell, it logged
`"http://from-shell:8001"`. That is why §5 tells you to set it as a shell prefix.

---

## 3. Backend variables

### 3.1 `SUPABASE_URL` — required

| Property | Value |
|---|---|
| Placeholder | `https://<project-ref>.supabase.co` |
| Required? | **Yes** — `require_env("SUPABASE_URL")`, `backend/config/settings.py:60` |
| Read by | `backend/config/settings.py` → `settings.supabase_url` → `backend/supabase_client.py:102` |
| Where to get it | Supabase dashboard → **Project Settings → API → Project URL** |
| Local file | `backend/.env` |
| Production | Render dashboard, `SUPABASE_URL`, declared `sync: false` (`render.yaml:12-13`) |

**What it is used for:** every backend call to Supabase builds a URL from it —
`{url}/rest/v1/{table}` for PostgREST (`backend/supabase_client.py:24`) and `{url}/auth/v1/user`
to validate a bearer token (`backend/supabase_client.py:89`). The trailing slash is stripped
defensively (`backend/supabase_client.py:23`).

**If it is missing:** the process cannot import. `backend/config/settings.py:74-75` constructs the
cache object at module scope:

```python
settings = Settings.from_env()
```

so a missing value raises before any route is registered:

```text
RuntimeError: Missing required environment variable: SUPABASE_URL.
Set it in backend/.env (local) or in the deployment environment.
```

Reproduced by copying `backend/` without its `.env` and running `python -c "import main"`. Every
route fails, including `GET /api/levels`, which does not touch the database at all.

**If it is wrong:** the app boots (the variable is non-empty) but every Supabase call fails. Auth
checks return `502 upstream_error` ("Authentication service is unavailable") when httpx raises
(`backend/core/security.py:28-29`), and progress calls do the same
(`backend/repositories/progress_repository.py:21-26`). If the URL resolves to a host that answers but
has no such project, you typically get a `401`/`404` from Supabase and therefore a `401 unauthorized`
"Invalid session" for the learner.

**If it has a trailing path or whitespace:** `https://<project-ref>.supabase.co/` is fine; a trailing
space or a copied `…/rest/v1` suffix is not — the client appends `/rest/v1` itself.

### 3.2 `SUPABASE_SERVICE_KEY` — required, secret

| Property | Value |
|---|---|
| Placeholder | `<service-role-key>` |
| Required? | **Yes** — `require_env("SUPABASE_SERVICE_KEY")`, `backend/config/settings.py:61` |
| Read by | `backend/config/settings.py` → `backend/supabase_client.py:22-31` (sent as both `apikey` and `Authorization: Bearer`) |
| Where to get it | Supabase dashboard → **Project Settings → API → Project API keys → `service_role`** |
| Local file | `backend/.env` |
| Production | Render dashboard, `SUPABASE_SERVICE_KEY`, declared `sync: false` (`render.yaml:14-15`) |

**What it can do:** this key bypasses Row Level Security. It is used for two things:

1. **Reading and writing progress.** The repository layer sends it on every PostgREST call
   (`backend/repositories/progress_repository.py:31-73`).
2. **Validating learner tokens.** `get_user()` calls `/auth/v1/user` with the *learner's* JWT in
   `Authorization` and the service key in `apikey` (`backend/supabase_client.py:87-98`).

**If it is missing:** identical boot failure to §3.1, naming `SUPABASE_SERVICE_KEY`.

**If it is wrong or revoked:** the app boots and unauthenticated routes work; authenticated requests
return `401 unauthorized` with `"Invalid session"` (a non-200 from Supabase yields `None`,
`backend/supabase_client.py:96-98`, which `get_current_user` turns into 401,
`backend/core/security.py:31-32`).

**Rotation:** replace the value in both places (`backend/.env`, Render dashboard) and redeploy.
Rotating Supabase keys invalidates the old one immediately, so there is a short window where the
deployed service returns 401s. See [runbooks.md](runbooks.md) RB-12.

> 🔐 This key must never appear in `frontend/`, in any `VITE_*` variable, in `render.yaml`, in a
> commit, in a screenshot, or in a document. If it leaks, rotate it in the Supabase dashboard.

### 3.3 `FRONTEND_URL` — optional

| Property | Value |
|---|---|
| Placeholder | `http://localhost:5173` (local) / `https://<your-spa-domain>` (production) |
| Required? | **No** — `os.getenv("FRONTEND_URL")`, `backend/config/settings.py:62` |
| Read by | `build_cors_origins(frontend_url)`, `backend/config/settings.py:54`, `:66-71` |
| Where to get it | the origin your SPA is served from |
| Local file | `backend/.env` (optional) |
| Production | `render.yaml:10-11`, committed literal `https://praxis-seven-puce.vercel.app` |

**What it does:** appends one origin to the CORS allow-list. The list always starts with the three
development defaults (`backend/config/settings.py:23-27`):

```python
DEFAULT_CORS_ORIGINS: tuple[str, ...] = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3001",
)
```

and `build_cors_origins` appends `FRONTEND_URL` only if it is not already present
(`backend/config/settings.py:69`). The resulting list is passed to `CORSMiddleware`
(`backend/main.py:30-36`).

**If it is missing:** the app boots and local development works (the Vite proxy makes calls
same-origin anyway). Only cross-origin browser calls from the deployed SPA domain fail — and in
production those go through the Vercel rewrite instead
([deployment.md](deployment.md) §7), so the practical impact is small.

**If it is wrong:** you get a browser CORS error mentioning an origin that is not in the list. The
error appears only in the browser console; the backend logs a normal `200` or nothing at all, because
the preflight never reaches the route. Diagnose with [runbooks.md](runbooks.md) RB-02.

**Exact-match rule:** `https://praxis-seven-puce.vercel.app` and
`https://praxis-seven-puce.vercel.app/` are different strings to CORS. Omit the trailing slash.

Observed on the working checkout: `backend/.env` sets `FRONTEND_URL=http://localhost:5173/`, so
`settings.cors_origins` builds **four** entries — the three defaults plus
`http://localhost:5173/`, which never matches the browser's `http://localhost:5173`. It is harmless
locally because the Vite proxy makes the call same-origin, but the identical typo against a deployed
origin is a real CORS failure. Verify what the process actually built with:

```bash
cd backend
python3 -c "from config.settings import settings; print('origins:', settings.cors_origins)"
```

---

## 4. Frontend variables

### 4.1 `VITE_SUPABASE_URL` — required to sign in

| Property | Value |
|---|---|
| Placeholder | `https://<project-ref>.supabase.co` |
| Required? | Required for Auth to work; the app builds without it and fails at runtime |
| Read by | `frontend/src/services/supabaseClient.js:7` |
| Where to get it | Supabase dashboard → **Project Settings → API → Project URL** |
| Local file | `frontend/.env.local` |
| Production | Vercel project environment variables (build-time) |

Must be the **same project** as the backend's `SUPABASE_URL`: the JWT the SPA obtains is validated by
the backend against that project (`backend/supabase_client.py:87-98`). Pointing the two at different
projects produces `401 unauthorized` on every progress call while sign-in appears to succeed.

### 4.2 `VITE_SUPABASE_PUBLISHABLE_KEY` — required to sign in

| Property | Value |
|---|---|
| Placeholder | `<anon-key>` |
| Required? | Required for Auth to work |
| Read by | `frontend/src/services/supabaseClient.js:8` |
| Where to get it | Supabase dashboard → **Project Settings → API → Project API keys → `anon` / publishable** |
| Local file | `frontend/.env.local` |
| Production | Vercel project environment variables (build-time) |

This key is **designed** to be public: it ships inside the JavaScript bundle. It is not a secret in
the "do not publish" sense — but see §7, because in *this* project the anon key is more powerful than
it should be.

**If either variable is missing at runtime:** `createClient(undefined, undefined)` throws
`supabaseUrl is required`; `AuthProvider` catches the resulting error
(`frontend/src/state/AuthProvider.jsx:28-32`) and sets an error state, so the UI shows a stuck/empty
session rather than a clear message. Check the browser console first.

### 4.3 `VITE_AUTH_URL` — vestigial, does nothing

| Property | Value |
|---|---|
| Placeholder | `http://localhost:3001` |
| Required? | **No — it is unused** |
| Read by | nothing (verified by searching `frontend/src` for `VITE_AUTH_URL`: no matches) |
| Where to get it | nowhere; there is no service behind it |

It is a leftover from a Better Auth plan that was never implemented. See §9. Leave it out of your
`.env.local`; copying the line from an old machine is harmless but misleading.

---

## 5. Dev-server-only variables

### 5.1 `VITE_API_TARGET`

| Property | Value |
|---|---|
| Default | `http://127.0.0.1:8000` (`frontend/vite.config.js:8`) |
| Read by | `frontend/vite.config.js:8` via `process.env`, used by the `/api` proxy at `frontend/vite.config.js:30-33` |
| Set where | the **shell** that starts the dev server — not in `.env.local` (see §2.2) |
| Production | irrelevant: Vercel routing is decided by `frontend/vercel.json` |

If it points at the wrong port or host, every `/api/*` call from the SPA returns Vite's HTML
fallback or a 502 from the proxy ([runbooks.md](runbooks.md) RB-02).

### 5.2 `PORT`

| Property | Value |
|---|---|
| Placeholder | injected by the platform |
| Read by | `$PORT` in the Render start command, `render.yaml:7` |
| Local | not used — pass `--port 8000` to uvicorn yourself |

Do not set `PORT` by hand on Render; the interpolation in `render.yaml:7` expects the platform's
value.

---

## 6. All variables at a glance

| Variable | Process | Required | Secret? | Local file | Production source |
|---|---|---|---|---|---|
| `SUPABASE_URL` | backend | yes | no (project URL) | `backend/.env` | Render dashboard (`sync: false`) |
| `SUPABASE_SERVICE_KEY` | backend | yes | **yes** | `backend/.env` | Render dashboard (`sync: false`) |
| `FRONTEND_URL` | backend | no | no | `backend/.env` | `render.yaml:11` literal |
| `VITE_SUPABASE_URL` | frontend build | yes (runtime) | no | `frontend/.env.local` | Vercel env vars |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | frontend build | yes (runtime) | no (public by design) | `frontend/.env.local` | Vercel env vars |
| `VITE_AUTH_URL` | — | no | no | (vestigial) | — |
| `VITE_API_TARGET` | Vite dev server | no (has a default) | no | shell only | — |
| `PORT` | backend | platform-provided | no | — | Render |
| `PYTHON_VERSION` | backend build | no | no | — | Render dashboard (only if pinning) |

---

## 7. Security notes

**The service key is the whole security boundary.** With `SUPABASE_SERVICE_KEY` you can read and
write every row of the three application tables. It lives only in `backend/.env` and the Render
dashboard.

**The anon key plus the current RLS policies is an open door.** `database/init.sql:50-58` enables RLS
on all three tables and then creates one policy per table:

```sql
CREATE POLICY "Service role full access" ON user_progress FOR ALL USING (true);
```

Despite the name, the policy is not scoped to `service_role` — it applies `FOR ALL USING (true)` to
every role, and there is no `auth.uid() = user_id` predicate anywhere. Consequence: an attacker who
extracts the anon key from the bundle (it is public by design) can call Supabase's REST API directly
and read or write `user_progress`, `stage_progress` and `score_history`.

Two mitigating facts, both verified:

1. The frontend **never** queries those tables directly — every Supabase call in `frontend/src` is
   `supabase.auth.*` (session, sign-in, sign-up, sign-out). Progress goes through the backend.
2. Progress data is low-stakes game state: points, streaks, per-stage best scores.

Neither fact makes the policy correct. Tightening it means replacing
`USING (true)` with `USING (auth.uid() = user_id)` (and `WITH CHECK` equivalents) and confirming the
backend still works, since the backend's service key bypasses RLS either way. Tracked as finding D20
in [known-limitations.md](../07-explanation/known-limitations.md).

**Never put a real value in a document.** `docs/context.md` §11 commits an actual
`VITE_SUPABASE_PUBLISHABLE_KEY` value in a tracked file. Do not copy it; use `<anon-key>`. The
documentation gate greps for `sb_publishable_*`, JWT-shaped strings and assigned
`SUPABASE_*`/`VITE_SUPABASE_*` values, so a leak fails the build.

**Environment files are correctly ignored.** `backend/.env` matches `.env` in `.gitignore:3`;
`frontend/.env.local` matches `*.local` in `frontend/.gitignore:15`. `git ls-files` lists no env file.
The stale proposal claim that "no `.env` file exists yet" refers to an earlier state of the project.

---

## 8. Recipes

### 8.1 Add a new allowed origin (for example a Vercel preview URL)

**Local:** append to `backend/.env`:

```env
FRONTEND_URL=https://your-preview-abc123.vercel.app
```

Restart uvicorn (`Ctrl+C`, then `uvicorn main:app --reload --port 8000`).

**Production:** edit `render.yaml:10-11`, commit, push, let Render redeploy. Then verify:

```bash
curl -s -D - -o /dev/null -H 'Origin: https://your-preview-abc123.vercel.app' \
  https://praxis-backend-5302.onrender.com/api/levels | grep -i access-control-allow-origin
```

Expected: `access-control-allow-origin: https://your-preview-abc123.vercel.app`. A missing header
means the value is not in the allow-list (check for a trailing slash).

### 8.2 Point the dev SPA at a different backend

**macOS / Linux:**

```bash
VITE_API_TARGET=http://127.0.0.1:8001 npm run dev
```

**Windows (PowerShell):**

```powershell
$env:VITE_API_TARGET = 'http://127.0.0.1:8001'; npm run dev
```

**Windows (CMD):**

```bat
set VITE_API_TARGET=http://127.0.0.1:8001 && npm run dev
```

### 8.3 Rotate the Supabase service key

1. Supabase dashboard → **Project Settings → API** → rotate/regenerate the `service_role` key.
2. Update `backend/.env` locally and the `SUPABASE_SERVICE_KEY` value in the Render dashboard.
3. Redeploy the backend. Expect a few seconds of `401 unauthorized` responses during the switch.
4. Verify with a signed-in request ([runbooks.md](runbooks.md) RB-03).

Do **not** rotate the anon key at the same time unless you also redeploy the frontend: the anon key is
inlined into the bundle at build time, so a rotation without a rebuild breaks sign-in for everyone
until the SPA is rebuilt and redeployed.

---

## 9. Dead configuration you should ignore

Three leftovers from an abandoned Better Auth integration. None of them corresponds to a service that
exists:

| Artifact | Location | Status |
|---|---|---|
| `npx auth migrate` instruction | `database/init.sql:4` | Comment only. The four "Better Auth tables" it mentions are never created; Supabase Auth owns `auth.users`, and `database/init.sql:8,18,30` reference it as a foreign key. |
| `/api/auth` dev proxy → `127.0.0.1:3001` | `frontend/vite.config.js:24-28` | Dead. Nothing listens on 3001. Because this key precedes `/api` (`frontend/vite.config.js:30`), any future route starting with `/api/auth` would be routed into the void. |
| `VITE_AUTH_URL` | `frontend/.env.local` | Read by no code (grep-verified). |

Auth is **Supabase Auth**: `frontend/src/services/authActions.js:9-33` calls
`supabase.auth.signInWithPassword` / `signUp` / `signOut`, and `AuthProvider` subscribes to
`onAuthStateChange` (`frontend/src/state/AuthProvider.jsx:37-42`).

Related: `.gitignore:4` still lists `auth-server/node_modules/`, for a directory that does not exist.

---

## 10. Verifying your configuration

### 10.1 Backend

```bash
cd backend
python -c "from config.settings import settings; print('origins:', settings.cors_origins)"
```

Expected (with `FRONTEND_URL` unset or equal to an existing default):

```text
origins: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001']
```

This prints no secret. To confirm both required variables are non-empty without printing them:

```bash
python -c "from config.settings import settings; print('url set:', bool(settings.supabase_url), '| key set:', bool(settings.supabase_service_key))"
```

Expected: `url set: True | key set: True`.

### 10.2 Frontend

Start the dev server and open the browser console on <http://localhost:5173>. If
`VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` are missing you will see an error from
`createClient`; a successful configuration is silent.

A stronger check is to sign up and reload: a learner who stays signed in after F5 has a working
Supabase configuration.

### 10.3 Both together

```bash
curl -s http://localhost:5173/api/levels | head -c 60   # SPA proxy → backend
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/api/progress   # expect 401
```

Expected: the envelope JSON for the first command, and `401` for the second. Anything else means the
proxy or the backend environment is wrong — [runbooks.md](runbooks.md) RB-01/RB-02.

Related reading: [installation-manual.md](installation-manual.md) · [deployment.md](deployment.md) ·
[runbooks.md](runbooks.md) · [monitoring.md](monitoring.md) ·
[configuration reference](../06-reference/config-reference.md) ·
[known limitations](../07-explanation/known-limitations.md).
