# Praxis

Praxis is an interactive web application designed to help users master Boolean Algebra through step-by-step logic puzzles. The application features a clean, game-like UI, robust authentication, and server-side progress persistence.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS v3, Framer Motion, Sonner |
| **Backend** | Python 3, FastAPI, Uvicorn, httpx |
| **Auth Server** | Node.js, Express, Better Auth |
| **Database** | PostgreSQL (Supabase) |

---

## Prerequisites

Make sure you have these installed before starting:
- **Node.js** v18 or higher
- **Python** 3.9 or higher

---

## Setup & Running Locally

The application uses a **three-server architecture** in development. You will need to open three separate terminal windows and run the servers simultaneously.

### 1. Environment Variables (`.env`)

Before starting, ensure you have the required `.env` files in each directory:

**`frontend/.env`**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

**`backend/.env`**
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
AUTH_SERVER_URL=http://localhost:3001
```

**`auth-server/.env`**
```env
BETTER_AUTH_SECRET=your_random_32_character_secret
BETTER_AUTH_URL=http://localhost:3001
DATABASE_URL=your_postgresql_connection_string
```

---

### 2. Start the Auth Server (Terminal 1)

This Node.js server handles authentication flows, login/register logic, and manages the session cookies using Better Auth.

```bash
cd auth-server
npm install
npm run dev
```
> Runs on **http://localhost:3001**

---

### 3. Start the Backend API (Terminal 2)

This FastAPI server handles the game logic, scoring algorithms, and persists progress securely to the database by verifying sessions against the Auth Server.

```bash
cd backend
# Create and activate virtual environment (recommended)
python -m venv venv
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn main:app --reload
```
> Runs on **http://localhost:8000**

---

### 4. Start the Frontend UI (Terminal 3)

The Vite React application proxies API requests cleanly to both the Auth Server and the Backend.

```bash
cd frontend
npm install
npm run dev
```
> Runs on **http://localhost:5173**

---

## Testing the Application

Once all three servers are running:
1. Open your browser and navigate to `http://localhost:5173`.
2. You will be greeted by the Landing Page.
3. Click **Start Learning Free** to create an account.
4. After successful registration, you will be redirected to the Level Selector.
5. Your progress is now persisted to the database automatically!