# Praxis

Praxis is an interactive web application designed to help users master **Boolean Expression Simplification** through step-by-step logic puzzles. The application features a clean interactive UI, robust authentication, and server-side progress persistence.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS v3, Framer Motion, Sonner |
| **Backend** | Python 3, FastAPI, Uvicorn, httpx |
| **Database & Auth** | Supabase (PostgreSQL + Auth) |

---

## Prerequisites

Ensure you have the following installed on your machine:
- **Node.js** v18 or higher (`node -v` and `npm -v`)
- **Python** 3.9 or higher (`python --version`)
- A [Supabase](https://supabase.com) account (free tier works great)

---

## Setup & Installation Guide

The application uses a **two-server architecture** in development (FastAPI backend + Vite React frontend).

### 1. Database & Authentication Setup (Supabase)

1. Create a new project on [Supabase](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard (Left menu $\rightarrow$ **SQL Editor** $\rightarrow$ **New query**).
3. Copy and run the contents of [`database/init.sql`](database/init.sql) to initialize the database tables (`user_progress`, `stage_progress`, and `score_history`) and configure Row Level Security.
4. Retrieve your API credentials from **Project Settings $\rightarrow$ API**:
   - **Project URL**
   - **anon / public** API key
   - **service_role** secret key

---

### 2. Environment Variables Configuration

Create the corresponding `.env` files in the `backend` and `frontend` directories:

#### **`backend/.env`**
```env
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<your-supabase-service-role-key>
```

#### **`frontend/.env`**
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

## Verifying & Testing

1. Open your browser and navigate to `http://localhost:5173`.
2. Click **Start Learning Free** or **Sign Up** to create an account.
3. Once logged in, select any level from the Level Selector.
4. Complete puzzle steps — your progress, streaks, and score breakdown will automatically sync with Supabase!

