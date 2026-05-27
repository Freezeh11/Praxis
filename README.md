# Praxis

Praxis is an interactive web application designed to help users master Boolean Expression Simplification through step-by-step logic puzzles. The application features a clean, interactive UI, robust authentication, and server-side progress persistence.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS v3, Framer Motion, Sonner |
| **Backend** | Python 3, FastAPI, Uvicorn, httpx |
| **Database & Auth** | Supabase (PostgreSQL + Auth) |

---

## Prerequisites

Make sure you have these installed before starting:
- **Node.js** v18 or higher
- **Python** 3.9 or higher

---

## Setup & Running Locally

The application uses a **two-server architecture** in development. You will need to open two separate terminal windows and run the servers simultaneously.

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
```

*(Note: Make sure to replace the placeholder values with your actual Supabase project credentials.)*

---

### 2. Start the Backend API (Terminal 1)

This FastAPI server handles the game logic, scoring algorithms, and persists progress securely to the database by verifying sessions against Supabase.

```bash
cd backend
# Create and activate virtual environment (recommended)
python -m venv venv
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

# Install dependencies (you can also use the requirements.txt in the root directory)
pip install -r requirements.txt
python -m uvicorn main:app --reload
```
> Runs on **http://localhost:8000**

---

### 3. Start the Frontend UI (Terminal 2)

The Vite React application communicates with the Backend API and directly with Supabase for authentication.

```bash
cd frontend
npm install
npm run dev
```
> Runs on **http://localhost:5173**

---

## Testing the Application

Once both servers are running:
1. Open your browser and navigate to `http://localhost:5173`.
2. You will be greeted by the Landing Page.
3. Click **Start Learning Free** to create an account.
4. After successful registration, you will be redirected to the Level Selector.
5. Your progress is now persisted to the database automatically!
