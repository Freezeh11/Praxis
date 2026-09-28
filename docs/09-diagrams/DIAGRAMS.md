# Praxis — Diagram Set

**What this is:** every diagram of the Praxis architecture in one place — 12 Mermaid figures covering
system context, containers, the data model, the Boolean engine, the three user-facing flows, the
puzzle session, unlocking, scoring, deployment and the frontend data path.
**Who it's for:** a new teammate who learns faster from a picture than from prose. Every figure is
paired with a source citation so you can go read the code it draws.

> **A broken diagram is worse than no diagram.** Every fence in this file was parsed with the real
> Mermaid parser before publication, and each one carries a `Source of truth` line. Where a diagram
> corrects an earlier brief or a stale proposal, the correction is stated in the figure's notes.

---

## Contents

1. [D1 — System context (C4 Level 1)](#d1--system-context-c4-level-1)
2. [D2 — Container diagram (C4 Level 2)](#d2--container-diagram-c4-level-2)
3. [D3 — Entity-relationship diagram](#d3--entity-relationship-diagram)
4. [D4 — Boolean engine component diagram](#d4--boolean-engine-component-diagram)
5. [D5 — Sequence: one derivation step, end to end](#d5--sequence-one-derivation-step-end-to-end)
6. [D6 — Sequence: the sandbox, corrected](#d6--sequence-the-sandbox-corrected)
7. [D7 — Sequence: authentication and the bearer token](#d7--sequence-authentication-and-the-bearer-token)
8. [D8 — State: puzzle session lifecycle](#d8--state-puzzle-session-lifecycle)
9. [D9 — Flowchart: level unlock](#d9--flowchart-level-unlock)
10. [D10 — Flowchart: scoring breakdown](#d10--flowchart-scoring-breakdown)
11. [D11 — Deployment diagram](#d11--deployment-diagram)
12. [D12 — Frontend data flow](#d12--frontend-data-flow)

---

## How to read this file

Each entry has the same four parts, in the same order:

| Part | What it gives you |
|---|---|
| **Title** | the heading, with the C4 level or Mermaid diagram type in it |
| **How to read this** | one line of orientation before you look at the picture |
| **What it shows** | a short prose account of the flow, including the details that are easy to miss |
| **Source of truth** | the `file:line` citations the figure was verified against |
| the fence | a complete, copy-pasteable `mermaid` block |

Two terminology notes that apply to every figure. **Level ids are 0-based**: content level `0` is the
Tutorial and Levels 1–3 are ids `1`, `2`, `3` (`content/levels.json`, `frontend/src/config/gameRules.js:83`).
A **step** is one law application; it is committed to the derivation only after its animation, never
before (`frontend/src/state/useGameState.js:467-469`).

---

## D1 — System context (C4 Level 1)

**How to read this:** read it outward from the middle — Praxis is the one box you are building, and
everything else is something it depends on or someone who uses it.

**What it shows:** two kinds of human actor (a **learner** who solves puzzles and a **tutor** who walks
the same flow to verify gates and scores), the single Praxis system, the external Supabase project
that supplies both identity and storage, and one outbound-only hyperlink to a feedback survey.
Hosting platforms are deliberately **not** here: they are infrastructure rather than a system in
context, and they appear in [D11 — Deployment diagram](#d11--deployment-diagram) instead.

**Source of truth:** `backend/main.py:25`, `backend/supabase_client.py:22-31`, `backend/supabase_client.py:87-98`, `backend/core/security.py:17-35`, `database/init.sql:8`, `database/init.sql:18`, `database/init.sql:30`, `frontend/src/services/authActions.js:9-31`, `frontend/src/config/appLinks.js:8-9`, `frontend/src/components/TutorialGate.jsx:10-33`.

```mermaid
flowchart TD
  Learner["Learner<br/>practises Boolean simplification in a browser"]
  Tutor["Tutor<br/>previews the puzzle flow, gates and scores"]
  Praxis["Praxis<br/>interactive Boolean-simplification tutor<br/>40 puzzles across 4 levels plus a free sandbox"]
  Supabase["Supabase<br/>hosted Postgres plus Auth<br/>accounts, progress rows, score history"]
  Forms["Google Forms<br/>learner feedback survey<br/>outbound link only"]

  Learner -->|"signs up, solves puzzles, reviews progress over HTTPS"| Praxis
  Tutor -->|"walks the same flows, inspects gates and scores"| Praxis
  Praxis -->|"signs learners in and stores progress and scores"| Supabase
  Praxis -.->|"opens the survey in a new tab, nothing returns"| Forms
```

**Notes.**

- The learner talks to Supabase **directly** for sign-in; the Praxis API only ever *validates* the
  resulting token (`frontend/src/services/authActions.js:11,21`, `backend/core/security.py:27`).
- There is no better-auth server and no `POST /sandbox/validate` in this picture, because neither
  exists in the repository. The `vite.config.js` comment about a port-3001 auth server is a dead
  remnant (`frontend/vite.config.js:24-28`).
- The survey link is defined once at `frontend/src/config/appLinks.js:9` and opened from
  `frontend/src/components/layout/SurveyButton.jsx:17`.

---

## D2 — Container diagram (C4 Level 2)

**How to read this:** each solid box is something separately deployed or built; the two arrows leaving
`content/` are the point of the figure — one directory with two independent consumers.

**What it shows:** the React SPA, the FastAPI service and the shared JSON content, plus the two
Supabase capabilities the system uses (Auth and PostgREST). The Boolean engine is **not** drawn as a
container: it is framework-free JavaScript compiled into the SPA bundle, and drawing it as a service
would misstate the architecture — it has its own figure in
[D4 — Boolean engine component diagram](#d4--boolean-engine-component-diagram). Note that `content/`
must ship beside `backend/`, because the repository resolves it as `parents[2] / "content"`; if it is
missing, the content routes fail rather than returning empty data.

**Source of truth:** `backend/main.py:25-36`, `backend/main.py:79-83`, `frontend/vercel.json:2-11`, `frontend/vite.config.js:13-17`, `backend/repositories/content_repository.py:16`, `backend/repositories/content_repository.py:34-43`, `backend/repositories/progress_repository.py:29-73`, `backend/supabase_client.py:87-98`, `backend/config/settings.py:59-63`.

```mermaid
flowchart TD
  Learner["Learner<br/>browser session"]
  subgraph Vercel["Vercel - static host"]
    SPA["Single-page application<br/>React plus Vite<br/>pages, hooks, services, and the Boolean engine"]
  end
  subgraph Render["Render web service praxis-backend"]
    API["REST API<br/>Python FastAPI on uvicorn<br/>7 routes, thin transport only"]
  end
  subgraph SupabaseProject["Supabase project"]
    AuthSvc["Supabase Auth<br/>sign-up, sign-in, JWT issuance"]
    REST["PostgREST /rest/v1<br/>user_progress, stage_progress, score_history"]
  end
  Content["Game content<br/>content/laws.json and content/levels.json<br/>10 laws, 4 levels, 40 puzzles"]

  Learner -->|"HTTPS in a browser"| SPA
  SPA -->|"signs up and signs in with the publishable key"| AuthSvc
  SPA -->|"GET levels and laws, POST score, GET and POST progress"| API
  API -->|"verifies the bearer token"| AuthSvc
  API -->|"reads and writes progress and score history"| REST
  Content -->|"bundled at build time through the @content alias"| SPA
  Content -->|"read at runtime, cached per process with lru_cache"| API
```

**Notes.**

- The API holds no algebra. It serves content and scores numbers that the browser computed
  (`backend/services/scoring_service.py:32-77`).
- Repository HTTP is **synchronous httpx inside `async def` routes** — a real known limitation, not a
  diagram error (`backend/repositories/progress_repository.py:10`).
- `lru_cache` does not cache exceptions: a failed content load retries on the next request and can
  self-heal without a restart, while a successful load is cached for the life of the process, so later
  edits to `content/*.json` are ignored until it restarts
  (`backend/repositories/content_repository.py:34-43`).

---

## D3 — Entity-relationship diagram

**How to read this:** crow's foot marks the many side, `PK` and `FK` mark the keys, and `AUTH_USERS` is
owned by Supabase rather than created by this repository.

**What it shows:** one learner owns at most one totals row, many stage rows and many score-history
rows, and every foreign key cascades on delete. Three details are load-bearing: `STAGE_PROGRESS` is
unique on `(user_id, level_id, stage_idx)` even though Mermaid has nowhere to attach a table-level
constraint (`database/init.sql:24`); `level_id` stores the **content id**, so Tutorial rows carry
`level_id = 0`; and `hints_used` in `score_history` stores hints **plus** guides as one assistance
figure (`backend/services/scoring_service.py:51`). The visual type `text_array` stands for the real
PostgreSQL `TEXT[]` column — brackets are not safe inside a Mermaid attribute type.

There is deliberately **no** relationship drawn between `STAGE_PROGRESS` and `SCORE_HISTORY`: they
correlate on `(user_id, level_id, stage_idx)` and are written by the same function, but no foreign key
exists between them (`backend/services/progress_service.py:110-122`). Content entities (level, puzzle,
law) are also absent by design — they are JSON, not tables.

**Source of truth:** `database/init.sql:7-13`, `database/init.sql:16-25`, `database/init.sql:24`, `database/init.sql:28-42`, `database/init.sql:45-47`, `database/init.sql:50-58`.

```mermaid
erDiagram
    %% auth.users is created and owned by Supabase Auth (auth schema).
    %% The other three entities are the only tables this repository creates.
    AUTH_USERS ||--o| USER_PROGRESS : "has at most one totals row"
    AUTH_USERS ||--o{ STAGE_PROGRESS : "completes stages"
    AUTH_USERS ||--o{ SCORE_HISTORY : "logs every attempt"

    AUTH_USERS {
        uuid id PK "Supabase Auth identity - not created by this repo"
    }

    USER_PROGRESS {
        uuid user_id PK "FK -> auth.users(id) ON DELETE CASCADE"
        integer points "client-authoritative running total"
        integer streak "current streak, client-computed"
        integer best_streak "high-water mark of streak"
        timestamptz updated_at "insert time only - no trigger refreshes it"
    }

    STAGE_PROGRESS {
        uuid id PK "surrogate key, never read by the app"
        uuid user_id FK "NOT NULL -> auth.users(id) ON DELETE CASCADE"
        integer level_id "content id: 0 Tutorial, 1..3 Levels"
        integer stage_idx "0-based index into the level's puzzles"
        real best_score "best total, raised never lowered - unclamped"
        boolean completed "always written true"
        timestamptz completed_at "first completion time"
    }

    SCORE_HISTORY {
        uuid id PK "one row per scored attempt"
        uuid user_id FK "NOT NULL -> auth.users(id) ON DELETE CASCADE"
        integer level_id "content id, same convention as stage_progress"
        integer stage_idx "0-based stage index"
        integer steps_used "steps the client submitted"
        text_array laws_used "law ids as submitted, duplicates kept"
        integer hints_used "hints PLUS guides - one assistance figure"
        real efficiency "0..40 component"
        real target_law "0..30 component"
        real hint_independence "0..30 for non-negative inputs - unclamped"
        real total "unclamped sum, rounded to 1 decimal"
        integer earned_points "bonus for non-negative inputs - scales with total, not the base 10 XP"
        timestamptz created_at "time the attempt was logged"
    }
```

**Notes.**

- `indexes`: `idx_stage_progress_user(user_id)`, `idx_score_history_user(user_id)` and
  `idx_score_history_level(user_id, level_id, stage_idx)` (`database/init.sql:45-47`).
- **The score columns carry no range guarantee.** `hints_used` and `guides_used` reach the formula
  unvalidated, and `hint_independence = max(0, 30 - assistance × 10)` means a **negative** assistance
  count *raises* the score instead of lowering it. So `best_score`, `hint_independence`, `total` and
  `earned_points` are visual-type hints, not constraints: only `target_law` is genuinely bounded (it is
  a ratio). The diagram says `0..30 for non-negative inputs` and `unclamped` deliberately
  (`backend/services/scoring_service.py:51,99-115`).
- **Known discrepancy (RLS).** RLS is enabled on all three tables, but each policy is literally named
  `"Service role full access"` and is `FOR ALL USING (true)` for every role, with no
  `auth.uid() = user_id` predicate anywhere (`database/init.sql:56-58`). These are not per-learner
  policies; do not read the diagram as implying row ownership enforcement.
- **Known discrepancy (auth).** The `init.sql` header comment claims Better Auth tables are created by
  `npx auth migrate` (`database/init.sql:4`). There is no Better Auth installation in this repository;
  auth is Supabase Auth.

---

## D4 — Boolean engine component diagram

**How to read this:** start at the top with the UI; everything inside the engine boundary is pure
JavaScript with no React, no DOM and no network, and every module returns new trees instead of
mutating them.

**What it shows:** the engine's real shape — and three things that a naive "parser → validator →
normalizer → laws → solver" pipeline would get wrong.

1. **The parser normalises internally.** `parseExpr` calls `normalizeFlat` before returning
   (`frontend/src/engine/parser.js:75`), so there is no separate normalizer stage sitting after the
   parser. Full `normalize` exists but is called from the law `apply()` bodies.
2. **There are two string gates, not one.** `validateExpr` (`frontend/src/engine/validate.js:16`) guards
   *generated* sandbox expressions from `sandbox/generator.js:84`; `validateSandboxInput`
   (`frontend/src/engine/sandbox/validate.js:155`) is what the sandbox screen actually calls, at
   `SandboxPage.jsx:122` for the debounced verdict and `:124` for the button, and it is re-run inside
   `buildSandboxPuzzle` (`frontend/src/engine/sandbox/input.js:113`). Merging them into one "validator"
   box is the most likely error in this figure.
3. **Truth-table equivalence is not on the play path.** `isEquivalent` is used by the law helpers for
   absorption decisions — each behind the Module 4 constant guard — and by the sandbox builders to
   verify generated puzzles — never to validate a
   learner's step. See [D5](#d5--sequence-one-derivation-step-end-to-end).

The engine is 23 modules and 3,303 lines of source (4,664 including its tests) and is the only Boolean
algebra implementation in the repository; the backend never re-implements it.

**Source of truth:** `frontend/src/engine/index.js:8-13`, `frontend/src/engine/parser.js:75`, `frontend/src/engine/parser.js:160-166`, `frontend/src/engine/normalize.js:14-69`, `frontend/src/engine/validate.js:16`, `frontend/src/engine/sandbox/validate.js:155`, `frontend/src/engine/sandbox/generator.js:84`, `frontend/src/engine/laws/definitions.js:29-54`, `frontend/src/engine/laws/helpers.js:73`, `frontend/src/engine/laws/helpers.js:100`, `frontend/src/engine/laws/helpers.js:142`, `frontend/src/engine/solver.js:38`, `frontend/src/engine/solver.js:176`, `frontend/src/engine/solver.js:271`, `frontend/src/engine/solver.js:364`.

```mermaid
flowchart TB
    subgraph UI["UI layer - React, has DOM and network"]
        PAGES["Pages<br/>ProblemPage.jsx, SandboxPage.jsx"]
        HOOKS["state/useGameState.js<br/>state/usePuzzleSession.js"]
        CANVAS["components/ExpressionDisplay.jsx<br/>components/puzzle/LawPanel.jsx"]
    end

    subgraph ENGINE["frontend/src/engine - pure JS: no React, no DOM, no network"]
        IDX["index.js - public barrel"]

        subgraph TEXT["text to AST and back"]
            PARSE["parser.js:160 parseExpr"]
            TOK["parser.js:18 tokenize<br/>module-private"]
            NF["normalize.js:47 normalizeFlat"]
            RENDER["render.js:12 nodeText and :28 canonText"]
        end

        subgraph GATES["string gates - separate callers"]
            V1["validate.js:16 validateExpr<br/>called by sandbox/generator.js:84"]
            V2["sandbox/validate.js:155 validateSandboxInput<br/>called by SandboxPage.jsx:122,124"]
        end

        subgraph SEM["semantics"]
            EQ["equivalence.js:45 isEquivalent<br/>exhaustive truth table"]
        end

        subgraph LAWS["law registry"]
            LIDX["laws/index.js:33 analyzeSelection<br/>:60 analyzeNot, :64 analyzeSumConst, :68 analyzeProductConst"]
            LDEF["laws/definitions.js:29 LAW_DEFINITIONS<br/>16 rows mapping to 10 distinct ids"]
            SUM["laws/sumLaws.js:32 - 6 SOP laws"]
            PROD["laws/productLaws.js:63 - 5 POS laws plus the gated expand"]
            NOT["laws/notLaws.js:21"]
            CONST["laws/constLaws.js:19,61"]
            SCAN["laws/scanHints.js:22"]
            HELP["laws/helpers.js:73,100 absorbsInSum and absorbsInProduct<br/>:142 findExpandablePair"]
        end

        SOLVER["solver.js:38 getLegalTransitions<br/>:176 findOptimalPath, :271 findOptimalPathWithLaws<br/>:364 findSimplestForm"]
        SCORE["scoring.js:54 estimateScore - client mirror"]
        SB["sandbox/input.js:109 buildSandboxPuzzle<br/>sandbox/generator.js:139 generateRandomPuzzle<br/>sandbox/expand.js, sandbox/pool.js"]
    end

    subgraph BACKEND["backend - serves content and scores numbers, holds no algebra"]
        API["FastAPI<br/>GET /api/levels, GET /api/laws<br/>POST /api/score"]
    end

    PAGES --> HOOKS
    CANVAS --> HOOKS
    HOOKS --> IDX
    HOOKS --> RENDER
    IDX --> PARSE
    IDX --> V1
    IDX --> LIDX
    IDX --> SOLVER
    IDX --> SCORE
    IDX --> SB

    PARSE --> TOK
    PARSE --> NF

    LIDX --> SUM
    LIDX --> PROD
    LIDX --> NOT
    LIDX --> CONST
    LIDX --> SCAN
    SUM --> LDEF
    PROD --> LDEF
    NOT --> LDEF
    CONST --> LDEF
    SUM --> HELP
    PROD --> HELP
    SCAN --> HELP
    HELP --> EQ
    PROD --> RENDER
    SUM --> RENDER
    NOT --> RENDER
    SCAN --> RENDER
    SOLVER --> LIDX
    SOLVER --> RENDER
    SB --> V2
    SB --> SOLVER
    SB --> EQ
    V1 --> PARSE
    PAGES -.->|"GET /api/levels/:id on load only"| API
    SCORE -.->|"POST /api/score on completion only"| API

    classDef pure fill:#e0f4fd,stroke:#0ea5e9,color:#1a2035
    classDef ui fill:#fef3c7,stroke:#f59e0b,color:#1a2035
    classDef srv fill:#f0f2f7,stroke:#9aa0b0,color:#1a2035
    class ENGINE,IDX,TEXT,GATES,SEM,LAWS,SOLVER,SCORE,SB,PARSE,TOK,NF,RENDER,V1,V2,EQ,LIDX,LDEF,SUM,PROD,NOT,CONST,SCAN,HELP pure
    class UI,PAGES,HOOKS,CANVAS ui
    class BACKEND,API srv
```

**Notes.**

- The only imports that leave `engine/` are two data modules: `config/gameRules.js` from `scoring.js`
  and `sandbox/input.js`. That is what keeps the engine testable in plain Node
  (`frontend/src/engine/index.js:8-13`).
- `estimateScore` is advisory. The dashed edge to `POST /api/score` is a comparison, not a call: the
  server's returned total overwrites the displayed one
  (`frontend/src/components/puzzle/usePuzzleSession.js:208-213`).
- `LAW_DEFINITIONS` has 16 rows but only **10 distinct law ids**; `identity` legitimately appears twice
  because its sum and product statements differ while the display name does not
  (`frontend/src/engine/laws/definitions.js:29-54`). The engine also knows one id,
  `distributive-expand`, that is not among the 10 reference cards and is enabled only when
  `allowExpand` is set.

---

## D5 — Sequence: one derivation step, end to end

**How to read this:** time runs downward; the numbered messages are one learner step, and the only
wait in the middle is the law animation, which is what commits the step.

**What it shows:** a click carries a node path, the selection machine caps at two items, the law
registry answers with law objects that each carry an `apply()`, and the chosen law produces a new AST
without mutating the old one. The step is appended to the derivation **only after**
`TIMING.lawAnimationMs` (1,350 ms) elapses, and on a tutorial stage there is an extra
`preLawHighlightMs` (1,500 ms) pause first. Completion is then decided by comparing the new
expression's **canonical text** with the goal's canonical text — the truth-table checker is not on
this path. A dead end is an empty `scanHints`.

There is no network hop anywhere in this figure. The only API calls in the puzzle flow are
`GET /api/levels/{id}` when the puzzle loads and `POST /api/score` at completion.

**Source of truth:** `frontend/src/components/ExpressionDisplay.jsx:59-60`, `frontend/src/components/puzzle/DerivationCanvas.jsx:194-199`, `frontend/src/pages/ProblemPage.jsx:307`, `frontend/src/pages/ProblemPage.jsx:315`, `frontend/src/pages/ProblemPage.jsx:321`, `frontend/src/state/useGameState.js:165`, `frontend/src/state/useGameState.js:240`, `frontend/src/state/useGameState.js:351`, `frontend/src/state/useGameState.js:398`, `frontend/src/state/useGameState.js:407-417`, `frontend/src/state/useGameState.js:467-469`, `frontend/src/state/useGameState.js:481`, `frontend/src/state/useGameState.js:54-69`, `frontend/src/config/gameRules.js:60`, `frontend/src/config/gameRules.js:62`.

```mermaid
sequenceDiagram
    autonumber
    actor L as Learner
    participant ED as ExpressionDisplay.jsx
    participant DC as DerivationCanvas.jsx
    participant P as ProblemPage.jsx
    participant G as useGameState.js
    participant E as engine laws index
    participant LP as LawPanel.jsx
    participant SH as StepHistoryPanel.jsx

    L->>ED: click a literal or a term grip
    ED->>DC: onClickLit(path) from data-path
    DC->>P: forward the path with the current expression
    P->>G: handleClickLit or handleClickTerm
    Note over G: selection machine<br/>at most two items, parent and literal collapse
    G->>E: analyzeSelection(expr, sel, allowExpand)
    E-->>G: law objects each carrying apply()

    alt at least one law applies
        G-->>LP: applicableLaws renders the law buttons
        L->>LP: click a law
        LP->>P: onApplyLaw(law)
        P->>G: applyLaw(law, expr, steps, hintsUsed, isTutorial)
        G->>G: no-op guard - before equals after, no step recorded
        Note over G: tutorial only: preLawHighlightMs 1500 ms first
        G->>E: law.apply() clones the tree and returns the next AST
        E-->>G: nextExpr
        G->>G: wait lawAnimationMs 1350 ms
        G->>SH: append the step to history
        alt canonText(nextExpr) equals the goal canon
            G-->>L: solved - status success, base XP awarded
        else scanHints(nextExpr) is empty
            G-->>L: dead-end message, recoverable by undo or reset
        else moves remain
            G-->>L: step applied, select the next terms
        end
    else no law applies
        E-->>G: empty array
        G-->>LP: cleared, status error
        G-->>L: no simplification for these selected items
    end
```

**Notes.**

- **Correction to the original brief.** The brief asked for a sequence containing
  "step submitted → `POST /sandbox/validate`". **That endpoint does not exist**; a step never leaves the
  browser. Validity is structural rather than provational: the learner picks a law and that law's own
  `apply()` produces the next AST, with soundness resting on the law implementations and their property
  tests (`frontend/src/engine/__tests__/law-soundness.property.test.js`).
- A law that changes nothing is rejected before the animation (`frontend/src/state/useGameState.js:407-417`).
- The dead-end message states a fact about the implemented law registry, not a proof of unsolvability
  (`frontend/src/state/hintText.js:10`).

---

## D6 — Sequence: the sandbox, corrected

**How to read this:** everything happens inside one browser tab — no message in this figure crosses a
network boundary, and that is the whole point of the diagram.

**What it shows:** the learner types an expression and gets a live verdict after a 300 ms debounce;
pressing *Validate & Play* runs `buildSandboxPuzzle`, which enforces **solvability** on top of syntax and
whose verdict outranks the live one; on success the puzzle is handed to `/sandbox/play` as route state
with a `sessionStorage` fallback so a refresh keeps the same expression. `/sandbox/play` renders the
same workspace as a graded stage — sandbox mode is detected by the **absence** of route params — and its
completion branch awards no points and persists nothing.

**Source of truth:** `frontend/src/pages/SandboxPage.jsx:117-124`, `frontend/src/pages/SandboxPage.jsx:163-187`, `frontend/src/pages/SandboxPage.jsx:178-181`, `frontend/src/engine/sandbox/validate.js:155`, `frontend/src/engine/sandbox/input.js:109`, `frontend/src/engine/sandbox/input.js:113`, `frontend/src/engine/sandbox/input.js:161`, `frontend/src/engine/sandbox/generator.js:84`, `frontend/src/components/puzzle/sandboxPuzzle.js:46-56`, `frontend/src/components/puzzle/sandboxPuzzle.js:81-86`, `frontend/src/components/puzzle/usePuzzleSession.js:40`, `frontend/src/components/puzzle/usePuzzleSession.js:185-188`, `frontend/src/config/storageKeys.js:22`, `frontend/src/config/gameRules.js:70`, `frontend/src/config/gameRules.js:72`.

```mermaid
sequenceDiagram
    autonumber
    actor L as Learner
    participant SP as SandboxPage.jsx
    participant SV as engine sandbox validate.js
    participant SI as engine sandbox input.js
    participant SS as sessionStorage
    participant PP as ProblemPage.jsx in sandbox mode

    Note over SP,PP: Correction to the original brief - there is no POST /api/sandbox/validate endpoint.<br/>Validation and puzzle building are 100 percent client-side.

    L->>SP: types a Boolean expression
    SP->>SP: debounce sandboxValidationDebounceMs 300 ms
    SP->>SV: validateSandboxInput(debouncedRaw)
    SV-->>SP: valid, or a user-facing error message
    SP-->>L: live verdict under the input
    L->>SP: press Validate and Play
    SP->>SI: buildSandboxPuzzle(raw)
    SI->>SV: validateSandboxInput again with the product rules
    Note over SI: syntax is not enough - the shippable goal must be equivalent to the start,<br/>terminal under the workspace move set, and every step must replay
    alt the built puzzle is solvable and not already simplest
        SI-->>SP: ok with puzzle and exprText
        SP->>PP: navigate to /sandbox/play with route state
        PP->>PP: resolveCustomPuzzle prefers route state over storage
        PP->>SS: persist under the key praxis_sandbox_custom_puzzle
        PP-->>L: same workspace as a graded stage, unscored
    else not solvable, or already in its simplest form
        SI-->>SP: failure with a message
        SP-->>L: the build verdict outranks the live verdict
    end
    Note over L,PP: Random problem mode navigates with random true and clears the stored slot
```

**Notes.**

- **The brief was wrong.** `POST /sandbox/validate` appears nowhere in the 7 application endpoints
  (`backend/main.py:79-83`), and no first-party backend file mentions the sandbox. There is no
  `/api/sandbox/*` route of any kind.
- The two string gates are distinct and both appear here: `validateSandboxInput` is the learner-facing
  gate, while `validateExpr` guards *generated* expressions inside the generator
  (`frontend/src/engine/sandbox/generator.js:84`).
- Sandbox puzzles carry `targetLaws: []` and are not stages of any level, so even the completion branch
  has nothing to score (`frontend/src/engine/sandbox/input.js:190`,
  `frontend/src/engine/sandbox/generator.js:102`).
- The acceptance invariants `buildSandboxPuzzle` enforces are documented at
  `frontend/src/engine/sandbox/input.js:25-31`.

---

## D7 — Sequence: authentication and the bearer token

**How to read this:** there is no Praxis login endpoint — the token is issued by Supabase and only
*validated* by the Praxis API, and the two error lanes at the end are the ones that surprise people.

**What it shows:** sign-up and sign-in go straight from the browser to Supabase Auth; `AuthProvider`
subscribes once and publishes the session to the whole app; `apiClient.authHeaders` awaits
`getSession()` on every call and attaches `Authorization: Bearer <token>` when a session exists. The two
progress routes then **hard-401** without a valid token, whereas `POST /api/score` uses `optional_user`,
answers 200 signed-out and simply skips persistence — an intentional asymmetry, not an oversight.

**Source of truth:** `frontend/src/services/authActions.js:9-31`, `frontend/src/state/AuthProvider.jsx:21-42`, `frontend/src/services/apiClient.js:27-31`, `frontend/src/services/apiClient.js:56-93`, `frontend/src/services/progressApi.js:11-24`, `backend/core/security.py:17-43`, `backend/api/routes/progress.py:20-30`, `backend/api/routes/score.py:24`, `backend/api/routes/score.py:38-39`, `backend/supabase_client.py:87-98`.

```mermaid
sequenceDiagram
    autonumber
    actor Learner
    participant Page as LoginPage or RegisterPage
    participant Act as services/authActions.js
    participant SBC as services/supabaseClient.js
    participant SUPA as Supabase Auth
    participant AC as services/apiClient.js
    participant API as Praxis API (FastAPI)
    participant SEC as core/security.py

    Note over Learner,SEC: Sign up or sign in - the Praxis API is not involved
    Learner->>Page: submit email and password
    Page->>Act: signUp.email or signIn.email
    Act->>SBC: supabase.auth.signUp or signInWithPassword
    SBC->>SUPA: POST /auth/v1/signup or /token
    alt credentials accepted
        SUPA-->>SBC: session with access_token and user
        SBC-->>Page: data with session, error null
        Note over SBC: supabase-js persists the session,<br/>AuthProvider publishes it through AuthContext
    else credentials rejected
        SUPA-->>SBC: an error
        SBC-->>Page: error message
        Page-->>Learner: inline error text
    end

    Note over Learner,SEC: Any authenticated API call
    Page->>AC: apiRequest("/api/progress")
    AC->>SBC: supabase.auth.getSession()
    SBC-->>AC: access_token
    AC->>API: GET /api/progress with Authorization Bearer token
    API->>SEC: Depends(get_current_user)
    SEC->>SUPA: GET /auth/v1/user with the service key as apikey
    alt token valid
        SUPA-->>SEC: user object
        SEC-->>API: user dict
        API-->>AC: 200 envelope with data
        AC-->>Page: unwrapped data
    else header missing or malformed
        SEC-->>API: UnauthorizedError Not authenticated
        API-->>AC: 401 unauthorized envelope
        Note over AC: progress calls are silent, so the learner sees nothing
    else Supabase rejects the token
        SUPA-->>SEC: non-200, expired or revoked
        SEC-->>API: UnauthorizedError Invalid session
        API-->>AC: 401 unauthorized envelope
    else Supabase Auth unreachable
        SEC-->>API: UpstreamError
        API-->>AC: 502 upstream_error envelope
    end

    Note over AC,API: POST /api/score differs - auth is OPTIONAL
    AC->>API: POST /api/score, token present or absent
    API->>SEC: Depends(optional_user)
    SEC-->>API: a user dict, or None when unauthenticated
    API->>API: scoring_service.compute_score
    alt a valid token was present
        API->>API: BackgroundTasks.add_task(persist_score, user_id, outcome)
        API-->>AC: 200 envelope with the score
        API->>SUPA: after the response, insert score_history<br/>and raise stage_progress best_score when higher
    else no token, or an invalid one
        API-->>AC: 200 envelope with the score
        Note over API: nothing is persisted
    end
```

**Notes.**

- **No OpenAPI security scheme is declared**, so `/docs` shows no Authorize button even though two
  routes require a bearer token. The requirement is enforced by a dependency, not by the schema.
- An **invalid** token on `POST /api/score` degrades to unauthenticated rather than 401, because
  `optional_user` swallows only `UnauthorizedError` (`backend/core/security.py:38-43`). A token-bearing
  score call can still return 502 when Supabase Auth is unreachable, because `UpstreamError` is *not*
  swallowed.
- Every response carries `X-Request-ID`, echoed from the request header when supplied
  (`backend/core/middleware.py:18,27,61`). That header is how a client-visible failure is joined to a
  server log line.
- Do not draw a Praxis login route or a port-3001 auth server: neither exists.

---

## D8 — State: puzzle session lifecycle

**How to read this:** each state is a real `status` value or completion flag in `useGameState`; the
sandbox runs the same machine but its completion branch exits before scoring.

**What it shows:** one attempt at one puzzle. `Active` is a composite state because selecting → being
offered laws → being rejected is a sub-cycle that repeats many times without leaving it. `Animating` is
the only state that can reach `Complete` or `DeadEnd`; that is what *step-locking* means here — a step is
committed only after its animation, and only as an append. Two exits from the workspace exist for
failures: an out-of-range stage returns to the stage list, and a fetch failure returns to the level
carousel.

**Source of truth:** `frontend/src/state/useGameState.js:30`, `frontend/src/state/useGameState.js:54-69`, `frontend/src/state/useGameState.js:165-215`, `frontend/src/state/useGameState.js:354-459`, `frontend/src/state/useGameState.js:481`, `frontend/src/state/useGameState.js:505-543`, `frontend/src/state/useGameState.js:545-564`, `frontend/src/state/useGameState.js:604-647`, `frontend/src/components/puzzle/usePuzzleSession.js:118`, `frontend/src/components/puzzle/usePuzzleSession.js:123`, `frontend/src/components/puzzle/usePuzzleSession.js:150-221`, `frontend/src/components/puzzle/usePuzzleSession.js:185-188`, `frontend/src/state/hintText.js:10`, `frontend/src/config/gameRules.js:60`, `frontend/src/config/gameRules.js:62`, `frontend/src/config/gameRules.js:66`.

```mermaid
stateDiagram-v2
    [*] --> Loading

    Loading --> Active : puzzle parsed, goal canonicalised, optimal path solved
    Loading --> Redirected : level or stage does not exist

    state Active {
        [*] --> Selecting
        Selecting --> LawsOffered : two items selected and a law applies
        Selecting --> Rejected : two items selected and no law applies
        Selecting --> LawsOffered : one negated node clicked
        Rejected --> Selecting : selection changed
        LawsOffered --> Selecting : selection cleared or the law changed nothing
    }

    Active --> PreLawHighlight : applyLaw on a tutorial stage
    PreLawHighlight --> Animating : after preLawHighlightMs 1500 ms
    Active --> Animating : applyLaw outside the tutorial
    Animating --> Active : step landed, moves remain
    Animating --> DeadEnd : step landed, no law applies anywhere
    Animating --> Complete : canonical text equals the goal
    Animating --> Active : the law changed nothing, so no step is recorded

    Active --> HintShown : Hint pressed
    HintShown --> Active : auto-dismiss after 6000 ms
    Active --> Guided : Guide activated and points are available
    Guided --> LawsOffered : two paths pre-selected and laws computed
    Guided --> Selecting : one path highlighted, learner clicks it
    Active --> Active : term or factor reordered, no step recorded
    DeadEnd --> Active : undo, reset or reorder

    Complete --> ScoreShown : graded - local estimate, then the server result
    Complete --> ScoreShown : sandbox - unscored attempt summary
    ScoreShown --> Active : Try Again or reset
    ScoreShown --> NextStage : Next Stage
    ScoreShown --> Stages : Back to Stages

    state "Graded: progress written once, on first completion" as GradedProgress
    ScoreShown --> GradedProgress : addPoints, completeStage, saveSolution, saveScore
    GradedProgress --> Persisted : debounced POST /api/progress/save when signed in
    GradedProgress --> ScoreShown : guest - localStorage only

    NextStage --> [*]
    Stages --> [*]
    Redirected --> [*]

    note right of DeadEnd
        Dead end = scanHints returns an empty list.
        That is a statement about the implemented
        law registry, not a proof of unsolvability.
    end note

    note right of Complete
        The win test is canonical-text equality,
        not truth-table equivalence.
    end note

    note right of GradedProgress
        The sandbox branch never reaches this state:
        no points, no stars, no persisted progress.
    end note
```

**Notes.**

- A solution replayed from saved progress re-enters `Complete` for **review only**: it does not
  re-award points and does not auto-open the modal
  (`frontend/src/components/puzzle/usePuzzleSession.js:153-156`).
- `Redirected` is a real exit, not decoration: `usePuzzleSession.js:118` navigates to the stage list for
  an out-of-range stage and `:123` navigates to `/levels` when the level fetch fails.
- The three terminal actions from `ScoreShown` are the three buttons the modal offers
  (`frontend/src/components/puzzle/ScoreModal.jsx:191-226`).

---

## D9 — Flowchart: level unlock

**How to read this:** level ids are 0-based — **0 is the Tutorial** — and the only gate that can lock a
level is the diamond requiring both every stage scored and a rounded average of at least 80.

**What it shows:** the Tutorial and Level 1 need no score prerequisite, Levels 2 and 3 are chain-gated
on the previous level's unlock, the Sandbox needs the completed Tutorial, and inside a level stage `n`
opens only once stage `n-1` is complete. Two details make this figure worth reading:

1. **The average is rounded before it is compared.** `Math.round(sum / totalStages)` happens first and
   the comparison is `>= 80` afterwards, so a true average of 79.5 **passes**
   (`frontend/src/state/progressStore.js:301-303` then `:309`).
2. **Unfinished stages count as zero.** The divisor is the level's total stages, not the number of
   stages actually played, so one skipped stage drags the average down.

**This is a frontend rendering gate, not a security boundary.** Nothing server-side records an unlock,
and `GET /api/levels/{level_id}` has no auth dependency, so a learner who types the URL can open any
stage (`backend/api/routes/levels.py:24-27`).

**Source of truth:** `frontend/src/state/progressStore.js:291-313`, `frontend/src/config/gameRules.js:38-46`, `frontend/src/config/gameRules.js:48-49`, `frontend/src/pages/LevelSelectPage.jsx:78`, `frontend/src/pages/LevelSelectPage.jsx:80-92`, `frontend/src/pages/LevelSelectPage.jsx:94-120`, `frontend/src/pages/StageSelectorPage.jsx:55-62`, `frontend/src/components/TutorialGate.jsx:64-75`, `frontend/src/state/progressStore.js:281-285`.

```mermaid
flowchart TD
    S["Learner opens /levels"] --> T{"Which entry?"}
    T -->|"Tutorial, content id 0"| T1["Always unlocked, 4 stages"]
    T -->|"Level 1, content id 1"| U1{"Tutorial complete?<br/>all four tutorial stages done"}
    U1 -->|"no"| L1["Locked, reason tutorial-gate"]
    U1 -->|"yes"| OK1["Unlocked, 12 stages"]
    T -->|"Level 2, content id 2"| V2{"Level 1: every stage scored<br/>and rounded average at least 80?"}
    V2 -->|"no"| L2["Locked, reason score-gate"]
    V2 -->|"yes"| OK2["Unlocked, 12 stages"]
    T -->|"Level 3, content id 3"| V3{"Level 2: every stage scored<br/>and rounded average at least 80?"}
    V3 -->|"no"| L3["Locked, reason score-gate"]
    V3 -->|"yes"| OK3["Unlocked, 12 boss stages"]
    T -->|"Sandbox"| U4{"Tutorial complete?"}
    U4 -->|"no"| L4["Locked, reason tutorial-gate"]
    U4 -->|"yes"| OK4["Unlocked, free practice"]

    OK2 --> ST["Inside a level, stage 0 is always available<br/>and stage N opens only once stage N-1 is complete"]
    OK3 --> ST
    OK1 --> ST

    ST --> AVG["getLevelProgress computes completed, allDone,<br/>and avgScore = round(sum of scores / totalStages)"]
    AVG --> CMP{"allDone and avgScore at least 80?"}
    CMP -->|"yes"| UNL["The next level unlocks"]
    CMP -->|"no"| LOCK["Stays locked"]
    AVG --> STARS{"Best score on the stage"}
    STARS -->|"at least 90"| S3["3 stars"]
    STARS -->|"at least 75"| S2["2 stars"]
    STARS -->|"otherwise"| S1["1 star"]
```

**Notes.**

- Content volumes used above: Tutorial 4 stages; Levels 1–3 have 12 each — **40 puzzles in total**
  (`content/levels.json`, confirmed by `GET /api/levels` returning `puzzleCount` `[4,12,12,12]`).
- `Math.round` on the average is why 79.5 passes; do not restate this as "80 exactly or higher" without
  the rounding clause.
- The tutorial gate redirects unfinished learners to their next incomplete tutorial stage and carries a
  `returnTo` parameter (`frontend/src/components/TutorialGate.jsx:64-75`).

---

## D10 — Flowchart: scoring breakdown

**How to read this:** three components are computed independently and only then summed; the rounding
happens once, at the total.

**What it shows:** efficiency (40) compares steps used with an optimum that is **clamped to be no larger
than what the learner actually used**; target law (30) is proportional and pays full marks when a puzzle
declares none; hint independence (30) loses 10 per hint **or guide**, because hints and guides are
counted as one assistance figure. The total is rounded once to one decimal and is **not capped** at 100;
`earnedPoints` scales with that unclamped total and is 0–5 for non-negative inputs only, paid on top of
the frontend's base 10 XP. Persistence is best-effort in a background task, so a slow database never
delays the response.

The optimum itself comes from the browser: for a graded puzzle it is the **objective-aware** optimum —
the fewest steps that reach the goal *and* apply every `targetLaws` id (`findOptimalPathWithLaws`,
`frontend/src/engine/solver.js:271`) — not the raw shortest path. The efficiency band therefore measures
the learner against the shortest route that teaches the puzzle's laws.

**The server does not verify the derivation.** `stepsUsed`, `lawsUsed`, `hintsUsed` and `guidesUsed` are
all submitted by the browser, the algebra engine is frontend-only, and the server scores the numbers it
is handed. \(stepsUsed = 0\) with a claimed law id returns a total of **100.0**, and
\(optimalSteps = 999\) still yields full efficiency because of the clamp. An unvalidated **negative**
assistance count *buys* score rather than costing it: with `hintsUsed: -99`, `hintIndependence` becomes
`1020.0` instead of clamping at 30, and the total exceeds 1000 with no upper cap — its only floor is 0,
because `efficiency` and `hintIndependence` clamp there and `targetLaw` is a non-negative ratio by
construction. Only `targetLaws` comes from content.

**Source of truth:** `backend/services/scoring_service.py:32-77`, `backend/services/scoring_service.py:80-88`, `backend/services/scoring_service.py:91-96`, `backend/services/scoring_service.py:99-107`, `backend/services/scoring_service.py:110-115`, `backend/config/constants.py:9-25`, `backend/api/routes/score.py:20-48`, `backend/api/schemas/score.py:13-29`, `backend/services/progress_service.py:87`, `frontend/src/engine/scoring.js:54-98`.

```mermaid
flowchart TD
    A["POST /api/score with a ScoreRequest"] --> B["get_puzzle(levelId, stageIdx)"]
    B -->|"level or stage unknown"| C["NotFoundError renders the 404 envelope"]
    B --> D["optimal = a positive override,<br/>else the puzzle's own optimalSteps,<br/>else stepsUsed"]
    D --> E["optimal = min(optimal, stepsUsed)<br/>a shorter solution lowers the bar"]
    E --> F["efficiency: 40 when stepsUsed is at most optimal,<br/>otherwise max(0, 40 minus 10 per extra step)"]
    B --> G["targetLaws = the puzzle's declared target laws"]
    G --> H["targetLaw: full 30 when none are declared,<br/>otherwise round(30 times matched over declared, 1)"]
    A --> I["assistance = hintsUsed plus guidesUsed"]
    I --> J["hintIndependence = max(0, 30 minus 10 times assistance)"]
    F --> K["total = round(efficiency plus targetLaw plus hintIndependence, 1)"]
    H --> K
    J --> K
    K --> L["earnedPoints = round(total / 100 times 5)"]
    K --> M["ScoreResponse with the breakdown"]
    L --> M
    M --> N{"Valid bearer token present?"}
    N -->|"yes"| O["BackgroundTasks: persist_score<br/>insert score_history, raise best_score when higher"]
    N -->|"no"| P["Score returned, nothing persisted"]
    Q["Client-claimed inputs: stepsUsed, lawsUsed,<br/>hintsUsed, guidesUsed"] -.->|"the server cannot verify a derivation"| A
```

**Notes.**

- **The clamp matters.** The `optimalSteps` echoed in the response is not always the value authored in
  `content/levels.json` (`backend/services/scoring_service.py:87-88`).
- **The client's optimum is objective-aware, and not always the shortest path.** The browser solves the
  state graph for the fewest steps that reach the goal **and** apply every `targetLaws` id
  (`findOptimalPathWithLaws`, `frontend/src/engine/solver.js:271-346`; wired at
  `frontend/src/state/useGameState.js:87-113`). An empty `targetLaws` list falls back to the plain
  shortest path (`frontend/src/engine/solver.js:274`), and an unsatisfiable objective reports
  `found: false`, which makes the workspace fall back to that plain optimum
  (`frontend/src/state/useGameState.js:101-105`). Consequence: a route shorter than the optimum that
  skips a required law still earns the full 40 efficiency points but forfeits that law's target-law
  credit. The two optima now coincide on Tutorial stage 1 — the shortcut there was a semantic
  absorption collapse, forbidden by the proposal's Module 4 — and still differ on 11 of the 40
  puzzles. Worked example and full arithmetic: [scoring-and-rewards.md](../06-reference/scoring-and-rewards.md)
  [W9](../06-reference/scoring-and-rewards.md#w9--the-taught-route-is-now-the-only-route-tutorial-stage-1).
- **The empty-target-laws branch is a guard, not a shipped path:** all 40 puzzles declare at least one
  target law, so that branch is unreachable through today's content
  (`backend/services/scoring_service.py:101-102`).
- **Known discrepancy (rounding across the wire).** The backend uses Python `round()`, which is
  half-to-even, while the frontend mirror uses `Math.round`, which is half-up. At totals of 90.0, 50.0
  and 10.0 the two disagree (`backend/services/scoring_service.py:55` versus
  `frontend/src/engine/scoring.js:80`). The backend value is the one persisted.
- **Known discrepancy (trust).** Because every input except `targetLaws` is client-claimed, a
  hand-crafted request can score 100.0 without solving anything, and a negative assistance count
  inflates the total without limit. Treat the score as a self-report, not as proof
  (`backend/services/scoring_service.py:51,110-115`; independently reproduced against the live endpoint).
- **No range guarantees anywhere in the schema.** `score_history` has no `CHECK` constraints, so none of
  the numeric columns are bounded by the database either (`database/init.sql:28-42`).
- Guides cost 20 points as a **spend** (`frontend/src/config/gameRules.js:35`) and also count as
  assistance for the 10-point deduction. These are two different things; do not conflate them.

---

## D11 — Deployment diagram

**How to read this:** three deployment parties — Render, Vercel and Supabase — and the key routing fact
is that the browser reaches the API through the SPA's own origin rather than calling Render directly.

**What it shows:** `render.yaml` declares exactly **one** service, the Python `praxis-backend`.
The SPA is deployed separately to Vercel, which rewrites `/api/(.*)` to the Render host and everything
else to `/index.html`. The sign-in path goes straight from the browser to Supabase Auth, and the API
independently validates the resulting token. In production `/api/*` is therefore **same-origin to the
SPA and proxied**, which is why the production CORS story is quiet — CORS configuration matters mainly
for local development, where the Vite dev server proxies `/api` to `127.0.0.1:8000`.

**Source of truth:** `render.yaml:1-15`, `frontend/vercel.json:1-11`, `backend/config/settings.py:23-27`, `backend/config/settings.py:59-63`, `backend/config/settings.py:66-71`, `backend/config/settings.py:75`, `backend/main.py:30-36`, `backend/repositories/content_repository.py:16`, `frontend/src/config/storageKeys.js:10`, `frontend/src/config/storageKeys.js:16-25`, `backend/api/routes/health.py:15-18`.

```mermaid
flowchart TB
    subgraph device["Learner device"]
        browser["Browser<br/>loads the SPA bundle once"]
        storage["localStorage holds the progress snapshot<br/>sessionStorage holds sandbox and dismiss flags"]
        browser --- storage
    end

    subgraph vercel["Vercel - static host"]
        edge["Edge router from vercel.json<br/>/api/* is rewritten to Render<br/>everything else serves index.html"]
        assets["Built assets<br/>index.html and dist assets"]
        edge --- assets
    end

    subgraph render["Render - free plan, one service"]
        api["praxis-backend<br/>uvicorn main:app on the assigned port<br/>rootDir backend, pip install -r requirements.txt"]
    end

    subgraph repo["Repository at build and boot time"]
        contentJson["content/laws.json and content/levels.json<br/>10 laws, 4 levels, 40 puzzles"]
    end

    subgraph supabase["Supabase project"]
        auth["Auth /auth/v1/user"]
        rest["PostgREST /rest/v1<br/>user_progress, stage_progress, score_history"]
    end

    browser -->|"GET / and the asset paths"| edge
    browser -->|"same-origin fetch to /api/*"| edge
    edge -->|"rewrite /api/(.*) to praxis-backend-5302.onrender.com"| api
    browser -->|"signUp, signInWithPassword, token refresh with the publishable key"| auth
    api -->|"learner JWT plus the service key as apikey"| auth
    api -->|"service key, eq filters, insert and upsert"| rest
    api -->|"reads at runtime, cached per process with lru_cache"| contentJson
    assets -->|"bundled at build time through the @content alias"| contentJson

    envNote["render.yaml sets FRONTEND_URL to the Vercel origin for CORS.<br/>SUPABASE_URL and SUPABASE_SERVICE_KEY use sync false<br/>and are set in the Render dashboard, never in git."]
    envNote -.->|"configuration"| api
```

**Notes.**

- **Render hosts only the backend.** There is no frontend service in `render.yaml`; drawing the SPA as
  a Render service would be wrong. `FRONTEND_URL` is a literal in the file
  (`https://praxis-seven-puce.vercel.app`) and is appended to the CORS origins.
- **The rewrite target is hardcoded**: `/api/(.*)` → `https://praxis-backend-5302.onrender.com/api/$1`
  (`frontend/vercel.json:5`). Renaming the Render service breaks production routing silently.
- The one free instance **sleeps when idle**, so the first request after a quiet period pays a cold
  start.
- **Secrets never appear in diagrams or docs.** Use `<service-role-key>` and `<project-ref>`
  placeholders. Only `FRONTEND_URL` is a literal in the repository; the two Supabase values are
  dashboard-only (`render.yaml:10-15`).
- The health probe is `GET /`, which is deliberately plain JSON outside the envelope because Render
  reads it (`backend/api/routes/health.py:15-18`). `render.yaml` does not currently map it to a
  `healthCheckPath`.

---

## D12 — Frontend data flow

**How to read this:** solid arrows are calls and dashed arrows are returns; the return leg comes back up
through a single store, which is what makes a server response and a local point award re-render the same
way.

**What it shows:** components emit events and hold no game state; the state layer decides; the pure
engine computes; **every** network call passes through one chokepoint, `apiClient.apiRequest`, which
attaches the bearer token and unwraps the `{success, data, error}` envelope into `data` or throws
`ApiError`. Writes land as updates on a module-level progress store whose `publish()` notifies every
`useSyncExternalStore` subscriber. `localStorage` is the fast path and the server is the durable one.

**Source of truth:** `frontend/src/pages/ProblemPage.jsx:134-135`, `frontend/src/components/puzzle/usePuzzleSession.js:34-35`, `frontend/src/components/puzzle/usePuzzleSession.js:86-100`, `frontend/src/state/useGameState.js:2-7`, `frontend/src/state/useProgress.js:20-24`, `frontend/src/state/progressStore.js:49-57`, `frontend/src/state/progressStore.js:69-94`, `frontend/src/state/progressStore.js:147-166`, `frontend/src/services/apiClient.js:27-31`, `frontend/src/services/apiClient.js:63`, `frontend/src/services/apiClient.js:33-45`, `frontend/src/services/scoreApi.js:31`, `frontend/src/services/progressApi.js:12`, `frontend/src/services/contentApi.js:49`, `frontend/src/state/AuthProvider.jsx:37-42`.

```mermaid
flowchart TB
    subgraph ui["Presentation"]
        page["pages/ProblemPage.jsx<br/>composition root - tier layout and transient UI"]
        comps["components/puzzle/*<br/>DerivationCanvas, LawPanel, StepHistoryPanel, ScoreModal"]
    end

    subgraph state["State layer"]
        session["components/puzzle/usePuzzleSession.js<br/>route identity, puzzle load, completion and scoring"]
        game["state/useGameState.js<br/>history, selection, status, hints, animation"]
        progress["state/progressStore.js<br/>module-level snapshot: points, streak, scores"]
        uprogress["state/useProgress.js<br/>useSyncExternalStore binding"]
        authctx["state/AuthProvider.jsx to authContext.js to useSession.js<br/>session: data, isPending, error"]
    end

    subgraph pure["Pure core"]
        engine["engine/index.js barrel<br/>23 modules, no React, no DOM, no network"]
        rules["config/gameRules.js<br/>every tunable number"]
    end

    subgraph net["The only network boundary"]
        client["services/apiClient.js<br/>fetch, bearer token, envelope unwrap"]
        capi["services/contentApi.js"]
        sapi["services/scoreApi.js"]
        papi["services/progressApi.js"]
        supa["services/supabaseClient.js<br/>auth session"]
    end

    backend["FastAPI<br/>7 endpoints"]
    sb["Supabase<br/>Auth plus 3 tables"]
    ls[("localStorage<br/>praxis_v1_userId")]
    ss[("sessionStorage<br/>sandbox puzzle and flags")]

    comps -->|"onClickLit, onClickTerm, onClickNot"| game
    comps -->|"onApplyLaw(law)"| game
    comps -->|"onHint, onGuide, onUndo, onReset"| session
    session --> game
    session --> engine
    session --> capi
    session --> sapi
    session --> progress
    game --> engine
    engine --> rules
    game --> rules
    progress --> rules
    progress --> papi
    progress --> ls
    uprogress --> progress
    uprogress --> authctx
    page --> session
    page --> uprogress
    page --> comps
    page --> ss

    capi --> client
    sapi --> client
    papi --> client
    client -->|"attach the bearer token from the session"| supa
    client -->|"GET /api/levels, POST /api/score<br/>GET /api/progress, POST /api/progress/save"| backend
    supa -->|"signIn, signUp, getSession"| sb
    backend -->|"verify the token, then PostgREST reads and writes"| sb

    backend -.->|"the envelope - success, data, error"| client
    client -.->|"unwrapped data, or ApiError"| sapi
    sapi -.->|"server score result"| session
    papi -.->|"server snapshot"| progress
    progress -.->|"publish notifies every subscriber"| uprogress
    uprogress -.->|"new snapshot"| page
```

**Notes.**

- `frontend/src/services/apiClient.js:63` is the **only** `fetch` call in `frontend/src`; everything
  else goes through it. Components must never call `fetch` directly.
- The engine has exactly two inbound edges, from `useGameState` and `usePuzzleSession`. That single
  coupling is what lets the engine be tested in plain Node with no DOM.
- `progressStore` is the single write point for progress; `useProgress` is a thin binding, not a second
  store. The server snapshot is merged without ever lowering a best value
  (`frontend/src/state/progressStore.js:97-130`).
- **The auth path is deliberately separate from the API path.** The SPA talks to Supabase Auth directly
  and the API independently verifies the token, so two arrows pointing at Supabase from two different
  places is correct rather than a drawing error.
- The client credits points from its **own** estimate while the server writes its own value to
  `score_history`, so the displayed balance and the ledger can differ
  (`frontend/src/components/puzzle/usePuzzleSession.js:190-213`,
  `backend/services/progress_service.py:87-127`).
