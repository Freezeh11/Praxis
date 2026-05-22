# Praxis — Full Project Context for AI

> Feed this entire file to any AI agent when you want it to work on this project.

---

## 1. Project Identity

| Field | Value |
|---|---|
| **Name** | Praxis |
| **Description** | Interactive Boolean algebra learning tool — users select terms, discover laws, and simplify expressions step-by-step |
| **GitHub** | `https://github.com/Freezeh11/Praxis.git` |
| **Latest Commit** | `c73ff036faa746a1851c8a3506132851d27ca9a9` |

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, Tailwind CSS v3, Framer Motion v12, React Router DOM v7 |
| **Backend** | Python 3, FastAPI, Uvicorn, Pydantic |
| **Database** | **Supabase (PostgreSQL)** — credentials provided, NOT integrated yet |
| **Auth** | **None** — no login, no register, no JWT, no sessions |
| **State** | Client-side only (React state + `localStorage` for progress) |
| **Styling** | Tailwind utility classes with custom design tokens |

---

## 3. Complete Folder Structure

```
Praxis/
├── .gitignore
├── README.md
├── context.md                          ← THIS FILE
├── backend/
│   ├── main.py                         ← FastAPI app entry point
│   ├── requirements.txt                ← fastapi, uvicorn[standard], python-multipart
│   ├── data/
│   │   ├── __init__.py
│   │   └── levels_data.py             ← Hardcoded LAWS array + LEVELS array (all puzzle data lives here)
│   └── routers/
│       ├── __init__.py                 ← Package marker
│       ├── levels.py                   ← GET /api/levels, GET /api/levels/{level_id}
│       ├── laws.py                     ← GET /api/laws
│       └── score.py                    ← POST /api/score (computes score, does NOT save to DB)
├── frontend/
│   ├── .gitignore
│   ├── index.html                      ← Entry HTML, loads Inter + JetBrains Mono fonts
│   ├── package.json                    ← Dependencies (React 19, Vite, Tailwind, Framer Motion, React Router)
│   ├── package-lock.json
│   ├── postcss.config.js
│   ├── tailwind.config.js              ← Custom colors (bg, text-1/2/3, accent, teal, amber, green, red), shadows, fonts
│   ├── vite.config.js                  ← Proxies /api → http://localhost:8000
│   ├── eslint.config.js
│   ├── public/
│   └── src/
│       ├── main.jsx                    ← React entry, renders <App /> inside StrictMode
│       ├── App.jsx                     ← BrowserRouter with 4 routes
│       ├── App.css
│       ├── index.css                   ← Tailwind directives + custom CSS tokens + animations
│       ├── assets/
│       │   ├── hero.png
│       │   ├── react.svg
│       │   └── vite.svg
│       ├── components/
│       │   ├── AnimationOverlay.jsx    ← Visual animation when a law is applied
│       │   ├── ExpressionDisplay.jsx   ← Renders the Boolean expression tree
│       │   └── ExprText.jsx            ← Handles symbol rendering in expressions
│       ├── hooks/
│       │   ├── useApi.js               ← Fetches levels/laws from API, submits scores
│       │   ├── useGameState.js         ← Core game logic (selection, law application, hints, undo, animations)
│       │   └── useProgress.js          ← Client-side progress tracking (points, streak, localStorage)
│       ├── lib/
│       │   ├── expr.js                 ← Expression tree: parse, normalize, navigate, manipulate
│       │   └── laws.js                 ← Law analysis engine: detect applicable laws, scan for hints
│       └── pages/
│           ├── LevelSelectPage.jsx     ← ROOT ROUTE `/` — Level carousel (NO landing page)
│           ├── StageSelectorPage.jsx   ← `/level/:levelId/stages`
│           └── ProblemPage.jsx         ← `/level/:levelId/stage/:stageIdx`
```

---

## 4. Current Routes (Frontend — React Router)

| Path | Component | Purpose |
|---|---|---|
| `/` | `LevelSelectPage` | Level carousel with lock/score-gate logic (acts as "home" page — no landing page exists) |
| `/level/:levelId/stages` | `StageSelectorPage` | Stage/puzzle selection within a level |
| `/level/:levelId/stage/:stageIdx` | `ProblemPage` | Main game screen |
| `*` | Redirect → `/` | Catch-all |

---

## 5. Current API Endpoints (Backend — FastAPI)

| Method | Path | Router File | Purpose |
|---|---|---|---|
| `GET` | `/` | `main.py` | Health check — returns `{"message": "Praxis API is running", "docs": "/docs"}` |
| `GET` | `/api/levels` | `routers/levels.py` | Returns all level metadata (id, name, desc, varCount, puzzleCount) — no puzzle details |
| `GET` | `/api/levels/{level_id}` | `routers/levels.py` | Returns full level with all puzzle data (expr, goal, targetLaws, hints, optimalSteps) |
| `GET` | `/api/laws` | `routers/laws.py` | Returns all 10 Boolean law reference cards |
| `POST` | `/api/score` | `routers/score.py` | Computes score (efficiency 40% + target law 30% + hint independence 30%), returns earnedPoints — **does NOT save to DB** |

**CORS:** Backend allows `http://localhost:5173` and `http://127.0.0.1:5173`

---

## 6. Score Calculation Logic (from `backend/routers/score.py`)

```
ScoreRequest: { levelId, stageIdx, stepsUsed, lawsUsed[], hintsUsed }
ScoreResponse: { efficiency (0-40), targetLaw (0-30), hintIndependence (0-30), total (0-100), earnedPoints, breakdown }

Efficiency:      40 - (stepsOverOptimal × 10), min 0
Target Law:      (matchedTargetLaws / totalTargetLaws) × 30
Hint Independence: 30 - (hintsUsed × 10), min 0
Earned Points:   (total / 100) × 5  (bonus on top of base 10)
```

---

## 7. Level/Law Data Structure (from `backend/data/levels_data.py`)

### LAWS Array (10 laws)
```python
{
  "id": str,          # e.g. "complement", "absorption", "demorgan-and", "distributive"
  "name": str,
  "formulas": [str],  # e.g. ["A + A' = 1"]
  "desc": str
}
```

### LEVELS Array (3 levels, Level 3 is empty "Coming Soon")
```python
{
  "id": int,           # 1, 2, 3
  "name": str,
  "desc": str,
  "varCount": int,     # 2, 3, 4
  "puzzles": [
    {
      "expr": str,          # e.g. "x + xy"
      "goal": str,          # e.g. "x"
      "targetLaws": [str],  # e.g. ["absorption"]
      "hints": [str],       # 3 static hints
      "optimalSteps": int,  # minimum steps to solve
      "optimalHint": str    # shown if user takes more than optimal steps
    }
  ]
}
```

### Level Locking Rules (from `LevelSelectPage.jsx`)
- **Level 1:** Always unlocked
- **Level 2:** Requires Level 1 average score ≥ 70% across all 6 stages
- **Level 3:** Permanently "Coming Soon" (no puzzles yet)

---

## 8. Frontend Architecture — Expression Engine

### Expression Tree (from `lib/expr.js`)
The entire game runs on an **AST (Abstract Syntax Tree)** representation of Boolean expressions:

- **Node Types:** `lit` (literal: `{type:'lit', v:'x', n:false}`), `const` (0 or 1), `prod` (product/AND), `sum` (sum/OR), `not` (negation/NOT)
- **Parsing:** `parseExpr("x + xy")` → tree — supports SOP (Sum of Products) notation, `'` for complement
- **Normalization:** `normalize()` flattens nested sums/products, removes identity elements, simplifies constants
- **Navigation:** `getNode(root, "R.0.1")` navigates tree by path (R = root, numbers are indices)
- **Canonical Text:** `canonText()` for order-independent comparison

### Law Engine (from `lib/laws.js`)
- **analyzeSelection(expr, sel):** Given two selected nodes, returns array of applicable laws
- **analyzeNot(expr, path):** For single negated-group clicks (De Morgan's, double negation)
- **analyzeProductConst(expr, path, val, prodPath):** For constants inside products (Identity, Annulment)
- **scanHints(node, path):** Scans entire expression tree for all possible simplifications
- **Supported laws:** Absorption, Idempotent, Complement, Identity, Annulment, Distributive, Double Negation, De Morgan's AND, De Morgan's OR

### Game State (from `hooks/useGameState.js`)
- Manages: expression tree, selection, step history, hints, applicable laws, animations
- Selection modes: click literal, click NOT group, click whole term
- **Animation pipeline:** When law is applied → triggers 2.5s animation → then updates AST
- **Guide system:** `activateGuide()` uses `scanHints()` to pre-select items and auto-highlight

### Progress Tracking (from `hooks/useProgress.js`)
- **Client-side only** — stored in `localStorage`
- Tracks: points, streak, per-level scores, completed stages

---

## 9. Design System (from `tailwind.config.js` + `index.css`)

### Colors
| Token | Hex | Usage |
|---|---|---|
| `bg` | `#f0f2f7` | Page background |
| `bg-card` | `#ffffff` | Card backgrounds |
| `border` | `#e2e5ed` | Default borders |
| `border-dark` | `#c8ccd6` | Darker borders |
| `text-1` | `#1a2035` | Primary text (near-black) |
| `text-2` | `#4b5468` | Secondary text |
| `text-3` | `#9aa0b0` | Muted text |
| `accent` | `#1a2035` | Buttons, headers |
| `teal` | `#0ea5e9` | Highlights |
| `amber` | `#f59e0b` | Warnings |
| `green` | `#10b981` | Success |
| `red` | `#ef4444` | Errors |

### Fonts
- **Sans:** Inter (body, UI)
- **Mono:** JetBrains Mono (expressions, code)

### Custom CSS Animations
- `guidePulse` — pulse animation for guide highlights
- `fadeIn` — fade + slide up
- `slideMerge` — terms sliding together (Annulment, Identity, Idempotent)
- `complementSlide1/2` + `complementBurst` — Complement law animation
- `svgDraw`, `svgFadeIn` — arc animations for Distributive, Absorption, De Morgan's

---

## 10. What EXISTS vs What NEEDS TO BE BUILT

| Feature | Status | Notes |
|---|---|---|
| Boolean expression game | ✅ Complete | Levels 1-2 with 6 puzzles each |
| Level carousel (home page) | ✅ Complete | Acts as root route `/` |
| Stage selection | ✅ Complete | `/level/:id/stages` |
| Puzzle gameplay | ✅ Complete | `/level/:id/stage/:idx` |
| Score computation | ✅ Complete | POST /api/score (not persisted) |
| Law reference | ✅ Complete | GET /api/laws + UI button |
| **Landing page** | ❌ MISSING | Root `/` goes straight to carousel |
| **Login page** | ❌ MISSING | No auth UI or routes |
| **Register page** | ❌ MISSING | No auth UI or routes |
| **User model (DB)** | ❌ MISSING | No users table, no profiles |
| **Auth middleware** | ❌ MISSING | No JWT, no sessions, no protected routes |
| **Database integration** | ❌ MISSING | No ORM, no DB driver, all data hardcoded |
| **Persistent progress** | ❌ MISSING | Only localStorage, no server-side user progress |
| **Supabase client** | ❌ MISSING | Credentials exist but not wired up |
| **Protected routes** | ❌ MISSING | All pages are publicly accessible |

---

## 11. Supabase Credentials (NOT YET INTEGRATED)

These credentials exist but the Supabase client is NOT installed or configured in the project:

```
VITE_SUPABASE_URL=https://qenanvfgjqriphitvppg.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_DtbzoDFThVfMSYyKfDYbEw_IykQKa_l
```

**To integrate Supabase:**
1. Install: `cd frontend && npm install @supabase/supabase-js`
2. Create `frontend/.env` with the two variables above
3. Create `frontend/src/utils/supabase.ts` (or `.js`) with the Supabase client
4. The Supabase project URL suggests tables may already exist — explore via Supabase dashboard

---

## 12. How to Run Locally

### Prerequisites
- **Node.js** v18+
- **Python** 3.9+

### Terminal 1 — Backend (port 8000)
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# OR: source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload
```
→ API at `http://localhost:8000`
→ Interactive docs at `http://localhost:8000/docs`

### Terminal 2 — Frontend (port 5173)
```bash
cd frontend
npm install
npm run dev
```
→ App at `http://localhost:5173`
→ Vite proxies `/api/*` → `http://localhost:8000`

---

## 13. Key Technical Notes for AI Agents

1. **The frontend never calls the backend directly** — Vite's dev server proxies all `/api/*` requests to `localhost:8000`. In production, you'd need a reverse proxy or CORS config.

2. **Progress is entirely client-side** — `useProgress.js` uses `localStorage`. There's no backend endpoint for saving/loading user progress. This means refreshing or switching browsers loses all progress.

3. **Scores are computed but discarded** — `POST /api/score` returns a score response but does NOT save anything. The response is used for display only.

4. **All data is hardcoded** — Levels, laws, and puzzles are all in `backend/data/levels_data.py`. There's no database reads or writes anywhere.

5. **The root route IS the level select** — `App.jsx` routes `/` directly to `<LevelSelectPage />`. To add a landing page, you'll need to either:
   - Change the root route to a new LandingPage component and move LevelSelectPage to `/play` or `/levels`
   - Or add auth gating (redirect to landing if not logged in)

6. **The expression engine is self-contained** — `lib/expr.js` and `lib/laws.js` have no React dependencies. They're pure JavaScript that could be reused server-side if needed.

7. **Custom Tailwind tokens** — The project uses custom color names like `bg-bg`, `bg-bg-card`, `text-text-1`, `text-text-2`, `text-text-3`, `border-border`, `bg-accent`. Don't use standard Tailwind colors without checking if a custom token exists.

8. **Animation pipeline** — When a law is applied, `useGameState.js` triggers a 2.5-second animation via `AnimationOverlay.jsx` before actually updating the AST. This is important for UX flow.

9. **No `.env` file exists yet** — The project currently has no environment variables. The Supabase `.env` file needs to be created from scratch.

10. **Python virtual environment not tracked** — `backend/venv/` is in `.gitignore`. Each developer creates their own.