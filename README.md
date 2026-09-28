# Praxis

Praxis is an interactive web application designed to help users master **Boolean Expression Simplification** through step-by-step logic puzzles. The application features a clean interactive UI, robust authentication, and server-side progress persistence.

---

## Contents

1. [Documentation](#documentation)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Prerequisites](#prerequisites)
5. [Setup & installation](#setup--installation-guide)
6. [Verifying the installation](#verifying-the-installation)
7. [Testing](#testing)
8. [Deployment](#deployment)

---

## Documentation

The full technical documentation suite lives in **[`docs/`](docs/README.md)**. Start at the hub, which lays out three reading paths — new developer, new teammate (non-coder) and DevOps — plus a doc-to-audience matrix.

### Most-used documents

| If you want to… | Read |
|---|---|
| Run Praxis for the first time | [`docs/05-guides/tutorials/getting-started.md`](docs/05-guides/tutorials/getting-started.md) |
| Understand how the system fits together | [`docs/02-architecture/SAD.md`](docs/02-architecture/SAD.md) |
| Find where a piece of code lives | [`docs/10-project/file-map.md`](docs/10-project/file-map.md) |
| Look up a domain term | [`docs/10-project/glossary.md`](docs/10-project/glossary.md) |
| Call the API | [`docs/04-api/API-REFERENCE.md`](docs/04-api/API-REFERENCE.md) |
| Understand the scoring maths | [`docs/06-reference/scoring-and-rewards.md`](docs/06-reference/scoring-and-rewards.md) |
| Learn the conventions | [`docs/rules/RULES.md`](docs/rules/RULES.md) |
| See every flow as a diagram | [`docs/09-diagrams/DIAGRAMS.md`](docs/09-diagrams/DIAGRAMS.md) |
| Know what is broken or missing | [`docs/07-explanation/known-limitations.md`](docs/07-explanation/known-limitations.md) |

### Historical documents

These predate the documentation suite and are kept as historical inputs. **Read them with care:** [`docs/context.md`](docs/context.md) is a proposal written before most of the application existed, and the code contradicts it in **28 recorded places** — it describes a four-route app with no authentication, three levels and an unplayable final level, none of which is true today. The suite above supersedes it.

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — folder map, data flow, "where does X live?"
- [`docs/REFACTOR_REPORT.md`](docs/REFACTOR_REPORT.md) — the refactor's before/after, deletions, verification
- [`docs/context.md`](docs/context.md) — product context and setup notes
- [`docs/SKILLS.md`](docs/SKILLS.md) — engineering skills demonstrated + common recipes
- [`docs/Software Proposal Writing Guide (LAWS) v2.0.docx.md`](docs/Software%20Proposal%20Writing%20Guide%20%28LAWS%29%20v2.0.docx.md) — the original proposal guide

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS v3, Framer Motion, Sonner |
| **Backend** | Python 3, FastAPI, Uvicorn, httpx |
| **Database & Auth** | Supabase (PostgreSQL + Auth) |

---

## Project Structure

```
Praxis/
├── backend/       FastAPI service — layered: api/routes → services → repositories
├── frontend/      React SPA — pages, state, services, and a pure Boolean engine
├── content/       laws.json + levels.json — one source, served by the API and bundled by the app
├── database/      init.sql — Supabase schema
├── docs/          the documentation suite (start at docs/README.md)
└── .e2e/          browser test suites and the engine fingerprints
```

---

## Prerequisites

Ensure you have the following installed on your machine:

- **Node.js** `^20.19.0 || ^22.13.0 || >=24` — the floor required by Vite 8 and ESLint 10 (`node -v` and `npm -v`). Node 18 is **not** sufficient.
- **Python** 3.10 or higher — required by FastAPI, Uvicorn, Starlette and python-dotenv (`python --version`).
- A [Supabase](https://supabase.com) account (free tier works great)

---

## Setup & Installation Guide

The application uses a **two-server architecture** in development (FastAPI backend + Vite React frontend).

### 1. Database & Authentication Setup (Supabase)

1. Create a new project on [Supabase](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard (Left menu → **SQL Editor** → **New query**).
3. Copy and run the contents of [`database/init.sql`](database/init.sql) to initialize the database tables (`user_progress`, `stage_progress`, and `score_history`) and configure Row Level Security.
4. Retrieve your API credentials from **Project Settings → API**:
   - **Project URL**
   - **anon / public** API key
   - **service_role** secret key

> **Note on Row Level Security:** `init.sql` enables RLS on all three tables but installs permissive `FOR ALL USING (true)` policies. They are not scoped per user. This is a known limitation, documented in [`docs/03-database/SCHEMA.md`](docs/03-database/SCHEMA.md) and [`docs/07-explanation/known-limitations.md`](docs/07-explanation/known-limitations.md).

---

### 2. Environment Variables Configuration

Create the corresponding environment files in the `backend` and `frontend` directories. Both are git-ignored and must never be committed.

#### **`backend/.env`**

```env
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<your-supabase-service-role-key>

# Optional. Adds the deployed frontend origin to the CORS allow-list.
FRONTEND_URL=http://localhost:5173
```

> The backend **cannot start** without `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` — configuration is read at import time and a missing value stops the process.

#### **`frontend/.env.local`**

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-anon-key>
```

---

### 3. Start the Backend API (Terminal 1)

The FastAPI server handles logic evaluation, scoring algorithms, and progress persistence.

```bash
# Navigate to backend directory
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment:
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Windows (CMD):
.\venv\Scripts\activate.bat
# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the API server
uvicorn main:app --reload --port 8000
```

- **Backend URL:** [http://localhost:8000](http://localhost:8000)
- **Interactive API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 4. Start the Frontend UI (Terminal 2)

The React client interacts with the FastAPI backend via Vite proxy and directly connects to Supabase for authentication.

```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start the development server
npm run dev
```

- **Frontend URL:** [http://localhost:5173](http://localhost:5173)

---

## Verifying the Installation

1. Open your browser and navigate to `http://localhost:5173`.
2. Click **Start Learning Free** or **Sign Up** to create an account.
3. Once logged in, select any level from the Level Selector.
4. Complete puzzle steps — your progress, streaks, and score breakdown will automatically sync with Supabase!

> A brand-new account must first complete the four-stage interactive tutorial before the levels and the sandbox unlock; that gate is intentional.

---

## Testing

The Boolean engine is covered by a unit-test suite that needs no server or database:

```bash
cd frontend
npm test
```

Browser-level suites live in [`.e2e/`](.e2e/) and are driven by `./.e2e/run-all-suites.sh`. They require both servers to be running and a Chromium-based browser. See [`docs/rules/RULES.md`](docs/rules/RULES.md) for the full testing conventions.

---

## Deployment

The two halves deploy separately:

- **Backend** → Render, defined by [`render.yaml`](render.yaml) (one web service, `rootDir: backend`).
- **Frontend** → Vercel (a static build of the Vite SPA).

Both are covered step by step, including environment variables and a post-deploy verification checklist, in [`docs/08-devops/deployment.md`](docs/08-devops/deployment.md).
