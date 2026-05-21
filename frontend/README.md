# Praxis — Boolean Algebra Simplification Trainer

An interactive, pedagogical web app that teaches Boolean algebra simplification through guided drag-and-drop expression solving. Apply laws like Absorption, De Morgan's, Distributive, and more — with real-time animations that show exactly what each law does.

---

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 19, Vite, Tailwind CSS v3, Framer Motion |
| Backend  | Python, FastAPI, Uvicorn            |

---

## Getting Started

### Prerequisites

- **Node.js** v18+ (for the frontend)
- **Python** 3.9+ (for the backend)

---

### 1. Clone the Repository

```bash
git clone https://github.com/Freezeh11/Praxis.git
cd Praxis
```

---

### 2. Run the Backend (FastAPI)

```bash
cd backend
```

*(Optional but recommended)* Create and activate a virtual environment:

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the server:

```bash
uvicorn main:app --reload
```

The API will be live at: **http://localhost:8000**
Interactive API docs: **http://localhost:8000/docs**

---

### 3. Run the Frontend (React + Vite)

Open a **new terminal window**, then:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

The app will be live at: **http://localhost:5173**

---

## Project Structure

```
Praxis/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── requirements.txt     # Python dependencies
│   ├── routers/
│   │   ├── levels.py        # /api/levels endpoints
│   │   └── laws.py          # /api/laws endpoints
│   └── data/
│       └── levels_data.py   # Puzzle definitions
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── components/
        │   ├── ExpressionDisplay.jsx  # Interactive expression tree
        │   ├── AnimationOverlay.jsx   # Law animations
        │   └── ExprText.jsx           # Overline bar renderer
        ├── hooks/
        │   ├── useGameState.js        # Core puzzle logic
        │   ├── useApi.js              # API calls
        │   └── useProgress.js         # Points & progress
        ├── lib/
        │   ├── expr.js               # AST utilities
        │   └── laws.js               # Boolean law engine
        └── pages/
            ├── LevelSelectPage.jsx
            ├── StageSelectorPage.jsx
            └── ProblemPage.jsx
```

---

## Features

- 🎯 **Step-by-step simplification** with drag-and-drop term reordering
- 🎬 **Pedagogical animations** — each law has a unique visual (slide-merge, arc, burst)
- 💡 **Guide system** — auto-selects the next move and shows applicable laws
- 🏆 **Points & progress** tracking across levels and stages
- 📖 **Law Reference drawer** with formulas and descriptions
- ↩️ **Undo / Reset** support
