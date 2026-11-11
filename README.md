# Praxis

Praxis is an interactive desktop web application designed to help first-year computing students improve their proficiency in **Boolean Expression Simplification** through step-by-step algebraic derivation puzzles. Built around a deterministic client-side Boolean AST engine and a FastAPI + Supabase persistence layer, Praxis guides learners from guided practice to independent problem-solving.

---

## Contents

1. [Key features](#key-features)
2. [Documentation](#documentation)
3. [Tech stack](#tech-stack)
4. [Project structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Setup & installation](#setup--installation-guide)
7. [Verifying the installation](#verifying-the-installation)
8. [Testing](#testing)
9. [Deployment](#deployment)

---

## Key Features

- **40 Progressive Stages:** Includes a 4-stage interactive **Level 0 Tutorial** (required onboarding gate) followed by **Levels 1-3** (12 authored stages per level, scaling from 2 to 4 variables) with an **80% average score unlock threshold**.
- **Dual-Mode Expression Selection:** Learners interact directly with the live Boolean expression via **Literal selection**, **Term selection**, and **Negated Compound selection** (`(expr)'`) for De Morgan's Law.
- **9-Law Challenge Palette & Explanatory Feedback:** Earlier stages (Stages 1-6) scaffold learners with focused law sets, while harder stages (Stages 7-12) present all **9 simplification laws** and provide specific explanatory feedback when a chosen law's preconditions do not match the selected sub-expression.
- **Custom Expression Sandbox Mode:** Allows learners to enter and simplify custom Boolean expressions up to 4 variables, automatically validating syntax and generating an equivalent simplified target and replayable reference solution.
- **Tiered Scaffolding & Reference Tools:** Features point-redeemable **Guide highlights** (free in Tutorial and Sandbox), **3-tier progressive worded hints**, a collapsible **Law Reference Drawer**, and a chronological **Step History** log with animated state transitions.
- **Composite Scoring & Learner Profile:** Evaluates completed stages on a 100-point composite rubric (**40% Step Efficiency**, **30% Target Law Application**, **30% Hint Independence**) and tracks cumulative points, daily streaks, and per-level completion badges on the **Learner Profile** page.
- **Desktop Target Environment:** Optimized for desktop and laptop browsers (`>= 1366 px` viewport width).

---

## Documentation

The full technical documentation suite lives in **[`docs/`](docs/README.md)**. Start at the hub, which lays out three reading paths (new developer, new teammate, and DevOps) plus a doc-to-audience matrix.

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
| Review system scope & design notes | [`docs/07-explanation/known-limitations.md`](docs/07-explanation/known-limitations.md) |

### Historical documents

These early planning notes predate the refactored documentation suite above and are retained for historical reference:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): folder map, data flow, and "where does X live?"
- [`docs/REFACTOR_REPORT.md`](docs/REFACTOR_REPORT.md): the refactor's before/after, deletions, and verification
- [`docs/context.md`](docs/context.md): early proposal context and initial setup notes
- [`docs/SKILLS.md`](docs/SKILLS.md): engineering skills demonstrated and common recipes
- [`docs/Software Proposal Writing Guide (LAWS) v2.0.docx.md`](docs/Software%20Proposal%20Writing%20Guide%20%28LAWS%29%20v2.0.docx.md): the original proposal guide

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend & Boolean Engine** | React 19, Vite 8, Tailwind CSS v3, Framer Motion, Sonner, Pure JS AST Engine (`frontend/src/engine/`) |
| **Backend API** | Python 3, FastAPI, Uvicorn, httpx |
| **Database & Auth** | Supabase (PostgreSQL + Auth) |

---

## Project Structure

```
Praxis/
├── backend/       FastAPI service (layered: api/routes -> services -> repositories)
├── frontend/      React SPA (pages, state, services, and the client-side Boolean AST engine)
├── content/       laws.json + levels.json (single source of truth served by API and bundled by client)
├── database/      init.sql (Supabase PostgreSQL schema: user_progress, stage_progress, score_history)
├── docs/          the documentation suite (start at docs/README.md)
└── .e2e/          automated verification and browser test suites
```

---

## Prerequisites

Ensure you have the following installed on your machine:

- **Node.js** `^20.19.0 || ^22.13.0 || >=24`: required by Vite 8 and ESLint 10 (`node -v` and `npm -v`). Node 18 is **not** sufficient.
- **Python** 3.10 or higher: required by FastAPI, Uvicorn, Starlette, and python-dotenv (`python --version`).
- A [Supabase](https://supabase.com) account (free tier works great).

---

## Setup & Installation Guide

The application uses a **two-server architecture** in development (FastAPI backend + Vite React frontend).

### 1. Database & Authentication Setup (Supabase)

1. Create a new project on [Supabase](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard (Left menu -> **SQL Editor** -> **New query**).
3. Copy and run the contents of [`database/init.sql`](database/init.sql) to initialize the database tables (`user_progress`, `stage_progress`, and `score_history`) and configure Row Level Security.
4. Retrieve your API credentials from **Project Settings -> API**:
   - **Project URL**
   - **anon / public** API key
   - **service_role** secret key

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

> The backend **cannot start** without `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`. Configuration is read at import time and a missing value stops the process.

#### **`frontend/.env.local`**

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-anon-key>
```

---

### 3. Start the Backend API (Terminal 1)

The FastAPI server serves canonical law and level content (`/api/laws`, `/api/levels`), computes composite stage scores (`/api/score`), and persists learner progress and streaks (`/api/progress`).

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

The React client runs the interactive Boolean simplification workspace, communicates with the FastAPI backend via Vite proxy, and connects to Supabase Auth for session management.

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

1. Open a desktop/laptop browser (`>= 1366 px` width) and navigate to `http://localhost:5173`.
2. Click **Start Learning Free** or **Sign Up** to create an account.
3. Complete the **4-stage interactive Tutorial** (brand-new accounts must finish the tutorial before Graded Levels 1-3 and Sandbox Mode unlock).
4. Select any unlocked level or open **Sandbox Mode**. Your completed stages, streaks, and composite score breakdowns will automatically sync with Supabase.

---

## Testing

The client-side Boolean AST engine is covered by **95 automated unit and property tests** (parsing, law application, equivalence soundness, sandbox validation, authored puzzle objectives, and guidance planning) that require no running server or database:

```bash
cd frontend
npm test
```

Additional standalone verification and browser-level test suites live in [`.e2e/`](.e2e/):

```bash
# Run the 335-check Sandbox engine & grammar audit
node .e2e/sandbox-engine-audit.mjs

# Run the 120-check generative level & puzzle solver audit
node .e2e/generative-level-audit.mjs

# Run all end-to-end browser suites (requires backend + frontend running)
./.e2e/run-all-suites.sh
```

See [`docs/rules/RULES.md`](docs/rules/RULES.md) and [`docs/verification-report.md`](docs/verification-report.md) for full testing conventions and verification summaries.

---

## Deployment

The two halves deploy separately:

- **Backend** -> Render, defined by [`render.yaml`](render.yaml) (one web service, `rootDir: backend`).
- **Frontend** -> Vercel (a static build of the Vite SPA).

Both are covered step by step, including environment variables and a post-deploy verification checklist, in [`docs/08-devops/deployment.md`](docs/08-devops/deployment.md).
