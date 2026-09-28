# Getting started — from zero to your first solved puzzle

**What this is:** a guided walkthrough that takes you from an empty terminal to a solved Level 1
puzzle with progress saved in Supabase. Every command is copy-pasteable and every step ends with the
exact output you should see.

**Who it's for:** a brand-new teammate who is a student, has never run Praxis, and wants to
understand what is happening — not just which button to click. If you only need the reference
procedure, use [installation-manual.md](../../08-devops/installation-manual.md); this tutorial is the
narrative version of it plus your first play session.

**Time:** about 30 minutes, most of it waiting for Supabase and `npm install`.

> **Terminology used below.** A *literal* is a single variable or its complement (`x`, `x'`). A *term*
> is a product of literals (`xy`). A *law* is an algebraic identity you apply to move from one
> *intermediate state* of the expression to the next — each such move is a *step*. The *AST*
> (abstract syntax tree) is how the engine represents the expression internally. SOP means
> sum-of-products form. See the [glossary](../../10-project/glossary.md) for the rest.

## Contents

1. [What you will have when you finish](#1-what-you-will-have-when-you-finish)
2. [Step 1 — clone the repository](#step-1-clone-the-repository)
3. [Step 2 — create the Supabase project and schema](#step-2-create-the-supabase-project-and-schema)
4. [Step 3 — configure and start the backend](#step-3-configure-and-start-the-backend)
5. [Step 4 — configure and start the frontend](#step-4-configure-and-start-the-frontend)
6. [Step 5 — create your account](#step-5-create-your-account)
7. [Step 6 — finish the tutorial gate](#step-6-finish-the-tutorial-gate)
8. [Step 7 — solve Level 1, stage 1](#step-7-solve-level-1-stage-1)
9. [Step 8 — see what the servers did](#step-8-see-what-the-servers-did)
10. [Step 9 — confirm your progress reached the database](#step-9-confirm-your-progress-reached-the-database)
11. [Troubleshooting](#11-troubleshooting)
12. [Where to go next](#12-where-to-go-next)

---

## 1. What you will have when you finish

```
Terminal 1:  uvicorn main:app        → http://127.0.0.1:8000   (FastAPI backend)
Terminal 2:  npm run dev             → http://localhost:5173   (React SPA)
Browser:     a signed-in learner who has solved Level 1 / stage 1
Supabase:    one row in user_progress, one in stage_progress, one or two in score_history
```

Registered prerequisites — Python 3.10+, Node 20.19+ (22.13+ for lint), a Supabase account. The full
version table with evidence is in
[installation-manual.md §2](../../08-devops/installation-manual.md#2-prerequisites-verified-versions).

---

## Step 1: clone the repository

**macOS / Linux:**

```bash
git clone <repository-url> Praxis
cd Praxis
ls backend frontend content database
```

**Windows (PowerShell):**

```powershell
git clone <repository-url> Praxis
Set-Location Praxis
Get-ChildItem backend, frontend, content, database -Name
```

Expected (any order): `content`, `database`, `backend`, `frontend`.

**✅ Verify:** `content/levels.json` exists. If it does not, the backend will answer every content
request with `503 content_unavailable` — the backend resolves content from the repository root
(`backend/repositories/content_repository.py:16`).

---

## Step 2: create the Supabase project and schema

1. Sign in at <https://supabase.com> and create a project (free tier is fine).
2. Open **SQL Editor → New query**, paste the whole of [`database/init.sql`](../../../database/init.sql),
   and click **Run**.
3. Open **Project Settings → API** and copy three values into a scratch place you will delete later:
   the **Project URL**, the **`service_role`** key, and the **anon/publishable** key.

> 🔐 Never paste those values into a document, a commit or a chat. This tutorial uses
> `https://<project-ref>.supabase.co`, `<service-role-key>` and `<anon-key>`.

**✅ Verify** — run this in the SQL editor:

```sql
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;
```

Expected exactly three rows:

```text
score_history
stage_progress
user_progress
```

---

## Step 3: configure and start the backend

### 3.1 Create `backend/.env` first

This is the step that trips up almost everyone: `backend/config/settings.py:74-75` builds the
settings singleton **at import time**, so a missing credential stops the app from importing at all —
you cannot even fetch `/api/levels`, which needs no database.

Create `backend/.env`:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
FRONTEND_URL=http://localhost:5173
```

**macOS / Linux:**

```bash
cat > backend/.env <<'EOF'
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
FRONTEND_URL=http://localhost:5173
EOF
```

**Windows (PowerShell 7+):**

```powershell
@'
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
FRONTEND_URL=http://localhost:5173
'@ | Set-Content -Path backend\.env -Encoding utf8NoBOM
```

On Windows PowerShell 5.1 use `-Encoding ascii` instead, or create the file in Notepad/VS Code.

### 3.2 Create the virtual environment and install

**macOS / Linux:**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
```

**Windows (PowerShell):**

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

If PowerShell blocks the script: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` and try
again (this affects only the current shell).

**Windows (CMD):**

```bat
cd backend
python -m venv venv
venv\Scripts\activate.bat
python -m pip install -r requirements.txt
```

The real dependency list is the five-line `backend/requirements.txt`
(`fastapi`, `uvicorn[standard]`, `python-multipart`, `python-dotenv`, `httpx`).

**✅ Verify:** the prompt shows `(venv)` and:

```bash
python -c "import fastapi, uvicorn, httpx, dotenv; print('ok')"
```

prints `ok`.

### 3.3 Start the server

With `backend/` as the working directory and the venv active:

```bash
uvicorn main:app --reload --port 8000
```

Expected (the first four lines):

```text
INFO:     Will watch for changes in these directories: ['/…/Praxis/backend']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using WatchFiles
INFO:     Application startup complete.
```

**✅ Verify Stage 3** — in a second terminal:

**macOS / Linux:**

```bash
curl -s http://127.0.0.1:8000/
curl -s http://127.0.0.1:8000/api/levels | head -c 120
```

**Windows (PowerShell):** use `curl.exe`, because plain `curl` is an alias for `Invoke-WebRequest`:

```powershell
curl.exe -s http://127.0.0.1:8000/
curl.exe -s http://127.0.0.1:8000/api/levels
```

Expected first response — exactly this, no envelope:

```json
{"message":"Praxis API is running","docs":"/docs"}
```

Expected second response begins:

```json
{"success":true,"data":[{"id":0,"name":"Tutorial","desc":"Interactive Fundamentals & System Orientation","varCount":2,"puzzleCount":4},
```

If instead you see `RuntimeError: Missing required environment variable: SUPABASE_URL`, the `.env`
file is missing or in the wrong directory: it must be `Praxis/backend/.env`
([runbooks.md RB-01](../../08-devops/runbooks.md#rb-01-the-backend-will-not-start)).

---

## Step 4: configure and start the frontend

### 4.1 Create `frontend/.env.local`

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
```

**macOS / Linux:**

```bash
cat > frontend/.env.local <<'EOF'
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
EOF
```

**Windows (PowerShell 7+):**

```powershell
@'
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
'@ | Set-Content -Path frontend\.env.local -Encoding utf8NoBOM
```

Use the **anon/publishable** key here — never the `service_role` key, which must never enter a browser
bundle. Only `VITE_`-prefixed variables reach the browser, and their values are baked in at build
time, so a change requires a dev-server restart.

### 4.2 Install and start

**All platforms (from the repository root):**

```bash
cd frontend
npm install
npm run dev
```

Expected:

```text
  VITE v8.2.2  ready in 300 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**✅ Verify Stage 4** — with both servers running, check the path the browser actually uses (the Vite
dev server proxies `/api` to the backend, `frontend/vite.config.js:30-33`):

```bash
curl -s http://localhost:5173/api/levels | head -c 80
```

Expected: the same envelope as Step 3. Then open <http://localhost:5173> — the Praxis landing page
renders with **Start Learning Free** and **Log In** in the header.

---

## Step 5: create your account

1. On the landing page click **Start Learning Free** (or go to
   <http://localhost:5173/register>).
2. Fill in Full Name, Email, Password (at least 6 characters, confirmed twice) and submit.
3. What happens next depends on your Supabase project's **Confirm email** setting:
   - **Confirmation disabled:** Supabase returns a session immediately and the app routes you to
     `/levels` (`frontend/src/pages/RegisterPage.jsx:22-26` watches for the session).
   - **Confirmation enabled (Supabase's default):** you see the toast
     "Account created successfully! Welcome to Praxis." but stay on the register page. Open the
     confirmation email, click the link, then sign in at `/login`.

**✅ Verify:** after signing in, the header shows your account and the route is `/levels`.

---

## Step 6: finish the tutorial gate

Praxis gates Levels 1–3 and the Sandbox behind the four-stage interactive tutorial
(`frontend/src/components/TutorialGate.jsx:61-73`). New learners are redirected to
`/level/0/stage/0?tutorial=true`, and the app keeps a `returnTo` so you land on `/levels` when you
finish.

The tutorial is a real level — content level **0** (`frontend/src/config/gameRules.js:83`) — and it
teaches the interface: selecting a term versus a literal, dragging to reorder, and the negation
capsules (`frontend/src/components/TutorialGate.jsx:15-18`).

Worked through, in order:

| Tutorial stage | Expression | Goal | Target laws | Optimal steps |
|---|---|---|---|---|
| 0 | `x + xy` | `x` | `absorption` | 1 |
| 1 | `x'y + z + xy` | `y + z` | `distributive`, `complement`, `identity` | 2 |
| 2 | `(x + y)' + x'y'` | `x'y'` | `demorgan-or`, `idempotent` | 1 |
| 3 | `x + x'y + xy` | `x + y` | `distributive`, `complement`, `identity` | 2 |

*(These four puzzles are `content/levels.json`, level `0`. The rest of the 40 puzzles are Levels 1–3.)*

How to solve any stage — the loop the tutorial teaches:

1. Read the expression and the goal shown in the workspace.
2. **Select the parts you want to transform.** Click a term to select the whole term; click a literal
   to select just that literal. Selection is what tells the engine which law to offer.
3. The **law panel** now lists the laws that apply to your selection. Click a law to apply it — the
   AST updates after a short animation (`TIMING.lawAnimationMs = 1350`,
   `frontend/src/config/gameRules.js:60`).
4. Repeat until the expression matches the goal. Every application is one *step*, and the step history
   panel lets you inspect an earlier intermediate state.
5. Stuck? **💡 Hint** explains the next move. **🎯 Guide (20p)** highlights the terms for the next move
   and costs 20 points (`GUIDE_COST_POINTS`, `frontend/src/config/gameRules.js:35`); it is disabled
   until you have enough points. Both reduce your *hint independence* score component, not your
   ability to finish.

Try the tutorial stage 0 yourself: expression `x + xy`, goal `x`. Select the two terms `x` and `xy`,
apply **absorption** (`A + AB = A`) once, and the expression becomes `x`.

**✅ Verify:** after stage 3, the app returns you to `/levels`, and Level 1 is no longer locked. The
gate checks `hasCompletedTutorial`, which requires all four stage indexes
(`frontend/src/state/progressStore.js:330-335`).

---

## Step 7: solve Level 1, stage 1

1. On `/levels`, choose **Level 1** (`varCount 2`, 12 puzzles).
2. Open stage 1. Its data (`content/levels.json`, level 1, stage 0) is:

   | Property | Value |
   |---|---|
   | expression | `x + xy` |
   | goal | `x` |
   | target laws | `absorption` |
   | optimal steps | `1` |
   | hints | 3 available |

3. Select `x` and `xy`, then apply the **absorption** law: `A + AB = A`.
4. The expression becomes `x` — the goal. The success modal opens after
   `TIMING.successModalDelayMs = 200` (`frontend/src/config/gameRules.js:64`).

You should see a perfect breakdown: efficiency `40.0`, target law `30.0`, hint independence `30.0`,
total `100.0`.

**✅ Verify:** the level map marks stage 1 complete, and the points chip increased by **15** — 10 XP
for completing the stage (`STAGE_COMPLETION_XP`, `frontend/src/config/gameRules.js:32`) plus 5 bonus
points from the perfect score (`SCORE_BONUS_MAX_POINTS`, `frontend/src/config/gameRules.js:29`;
awarded at `frontend/src/components/puzzle/usePuzzleSession.js:191`). Your streak goes up by one.

---

## Step 8: see what the servers did

Watch **Terminal 1** (the backend). Each request produced one JSON log line
(`backend/core/logging.py:34-50`). Look for four paths in order:

```json
{"ts":"…","level":"INFO","logger":"praxis.request","message":"request completed","request_id":"…","method":"POST","path":"/api/score","status":200,"duration_ms":1.2}
{"ts":"…","level":"INFO","logger":"praxis.request","message":"request completed","request_id":"…","method":"POST","path":"/api/progress/save","status":200,"duration_ms":1.5}
```

What happened, in code terms:

1. The engine scored your derivation in the browser
   (`frontend/src/engine/scoring.js`) and showed you the result immediately.
2. The SPA sent the derivation to the backend with your Supabase token:
   `POST /api/score` (`frontend/src/services/scoreApi.js:22-36`). Because you are signed in, the
   backend also queued a **background** persistence task
   (`backend/api/routes/score.py:38-39`) that inserts into `score_history` and raises the stage's best
   score.
3. The progress store debounced 500 ms (`TIMING.progressSaveDebounceMs`) and pushed the snapshot with
   `POST /api/progress/save` (`frontend/src/services/progressApi.js:19-25`), which upserts
   `user_progress` plus one row per completed stage
   (`backend/services/progress_service.py:63-84`).

Both writes are best-effort: if Supabase were unreachable, your score would still display, and the
failure would appear only in the backend log
(`backend/services/progress_service.py:123-127`). That is why
[monitoring.md](../../08-devops/monitoring.md) alerts on that log line.

**✅ Verify:** the two `200` lines above appear in the backend terminal after you solve the puzzle.

---

## Step 9: confirm your progress reached the database

In the Supabase dashboard, open **SQL Editor** and run:

```sql
select u.email, p.points, p.streak, p.best_streak, p.updated_at
from user_progress p
join auth.users u on u.id = p.user_id
order by p.updated_at desc;

select level_id, stage_idx, best_score, completed
from stage_progress
order by level_id, stage_idx;
```

Expected after this walkthrough: one `user_progress` row with `points >= 15`, `streak = 1`, and five
`stage_progress` rows — four for the tutorial (`level_id = 0`, stages 0–3) and one for
`level_id = 1, stage_idx = 0` with `best_score = 100` and `completed = true`.

> The tutorial's rows use `level_id = 0` because the tutorial is content level 0 — not
> `level_id = 1`. Mixing those two numbering schemes is the most common mistake in this project.

Then reload the SPA and confirm the points chip still shows your total: that proves the round trip
`Supabase → GET /api/progress → progressStore` works
(`frontend/src/state/progressStore.js:147-166`).

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `RuntimeError: Missing required environment variable: SUPABASE_URL` | `backend/.env` missing or misplaced | Step 3.1; [runbooks.md RB-01](../../08-devops/runbooks.md#rb-01-the-backend-will-not-start) |
| `[Errno 98] Address already in use` | port 8000 or 5173 busy | stop the other process, or `--port 8001` plus `VITE_API_TARGET` |
| "Could not reach the Praxis server." | backend not running, or proxy target wrong | Steps 3.3/4.2; [runbooks.md RB-02](../../08-devops/runbooks.md#rb-02-backend-is-up-but-the-frontends-api-calls-fail) |
| Sign-up succeeds but you stay on `/register` | Supabase email confirmation is on | confirm via email, then sign in — Step 5 |
| `supabaseUrl is required` in the browser console | `frontend/.env.local` missing/typo | Step 4.1, then restart `npm run dev` |
| Level 1 stays locked | tutorial stages 0–3 not all complete | Step 6; the gate needs all four |
| `503 content_unavailable` | `content/` missing beside `backend/` | restore it from git, restart the backend |
| Points reset unexpectedly | local and server snapshots differ, or your browser storage was cleared | [reset-user-progress.md](../how-to/reset-user-progress.md) explains the merge rule |

---

## 12. Where to go next

- **Understand the engine** — [understanding-the-engine.md](understanding-the-engine.md) and
  [boolean-laws.md](../../06-reference/boolean-laws.md).
- **Understand the API** — [API-REFERENCE.md](../../04-api/API-REFERENCE.md).
- **Change a rule or a colour** — [config-reference.md](../../06-reference/config-reference.md).
- **Run it without a backend, or with Docker** — there is no Docker setup in this repo; see
  [run-locally-with-docker.md](../how-to/run-locally-with-docker.md) for the honest options.
- **Make your first change** — [first-contribution.md](first-contribution.md).
- **Run the test suites** — `npm test` in `frontend/` runs the 76 engine tests
  (`frontend/package.json:11`).

Related reading: [installation-manual.md](../../08-devops/installation-manual.md) ·
[configuration-guide.md](../../08-devops/configuration-guide.md) ·
[deployment.md](../../08-devops/deployment.md) · [runbooks.md](../../08-devops/runbooks.md).
