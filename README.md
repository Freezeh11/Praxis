# Praxis


## Tech Stack

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Frontend | React 19, Vite, Tailwind CSS v3, Framer Motion  |
| Backend  | Python 3, FastAPI, Uvicorn                      |


## Prerequisites

Make sure you have these installed before starting:

- **Node.js** v18 or higher → https://nodejs.org
- **Python** 3.9 or higher → https://www.python.org

## Setup & Running

### Step 1 — Clone the repository

```bash
git clone https://github.com/Freezeh11/Praxis.git
cd Praxis
```

---

### Step 2 — Start the Backend

```bash
cd backend
```

Create a virtual environment (recommended):

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python -m venv venv
source venv/bin/activate
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Run the FastAPI server:

```bash
uvicorn main:app --reload
```

> The API is now running at **http://localhost:8000**
> Interactive API docs: **http://localhost:8000/docs**

---

### Step 3 — Start the Frontend

Open a **new terminal**, then navigate to the frontend folder:

```bash
cd Praxis/frontend
```

Install Node dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

> The app is now running at **http://localhost:5173**

---

## Running Both at the Same Time

You need **two terminals open** — one for the backend and one for the frontend.

| Terminal | Command |
|----------|---------|
| Terminal 1 (backend) | `cd backend && uvicorn main:app --reload` |
| Terminal 2 (frontend) | `cd frontend && npm run dev` |