# Configuration reference — every env var, constant and design token

**What this is:** the exhaustive lookup table for everything tunable in Praxis: the six environment
variables, every constant in `backend/config/constants.py` and `frontend/src/config/`, every Tailwind
design token, and every CSS custom property.

**Who it's for:** someone who needs the exact value of a knob and where it is defined — changing a
score weight, matching a colour, finding which key holds a learner's progress. Each row cites
`file:line` so you can jump straight to the source.

**How to use it:** to *configure a machine*, read
[configuration-guide.md](../08-devops/configuration-guide.md) instead — this file is the reference the
guide points at. Values marked *(example)* are literals; values marked `<placeholder>` are secrets you
supply yourself.

## Contents

1. [Environment variables](#1-environment-variables)
2. [`backend/config/constants.py`](#2-backendconfigconstantspy)
3. [`frontend/src/config/gameRules.js`](#3-frontendsrcconfiggamerulesjs)
4. [`frontend/src/config/storageKeys.js`](#4-frontendsrcconfigstoragekeysjs)
5. [`frontend/src/config/appLinks.js`](#5-frontendsrcconfigapplinksjs)
6. [Tailwind design tokens](#6-tailwind-design-tokens)
7. [CSS custom properties (`tokens.css`)](#7-css-custom-properties-tokenscss)
8. [Which layer owns which number](#8-which-layer-owns-which-number)

---

## 1. Environment variables

Six variables, in two files, plus two platform-provided ones. Nothing else is read anywhere in the
repository.

### 1.1 Backend (`backend/.env` locally, Render dashboard in production)

| Variable | Required | Secret | Placeholder | Read at | Consumed by |
|---|---|---|---|---|---|
| `SUPABASE_URL` | **yes** | no | `https://<project-ref>.supabase.co` | `backend/config/settings.py:60` | `backend/supabase_client.py:24` (`/rest/v1`), `:89` (`/auth/v1/user`) |
| `SUPABASE_SERVICE_KEY` | **yes** | **yes** | `<service-role-key>` | `backend/config/settings.py:61` | `backend/supabase_client.py:26-31` (`apikey` + `Authorization` headers) |
| `FRONTEND_URL` | no | no | `https://<your-spa-domain>` | `backend/config/settings.py:62` | `backend/config/settings.py:66-71` → CORS allow-list → `backend/main.py:31-32` |
| `PORT` | platform-provided | no | `$PORT` | `render.yaml:7` | the uvicorn start command |

Failure semantics, exactly:

- Missing `SUPABASE_URL` or `SUPABASE_SERVICE_KEY` → `RuntimeError` **at import time**
  (`backend/config/settings.py:74-75`, `:30-38`). No route answers, not even `GET /api/levels`.
- Missing `FRONTEND_URL` → no failure; `build_cors_origins(None)` returns the three defaults
  (`backend/config/settings.py:68`).
- The three dev origins are hardcoded at `backend/config/settings.py:23-27`:
  `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:3001`.

Resolution order (`backend/config/settings.py:19-20`): `backend/.env` (absolute path) → cwd-relative
`.env` → **real environment variables win over both** (`override=False`).

### 1.2 Frontend (`frontend/.env.local` locally, Vercel env vars in production)

| Variable | Required | Secret | Placeholder | Read at | Consumed by |
|---|---|---|---|---|---|
| `VITE_SUPABASE_URL` | yes (runtime) | no | `https://<project-ref>.supabase.co` | `frontend/src/services/supabaseClient.js:7` | `createClient(...)` → Supabase Auth |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes (runtime) | no — ships in the bundle | `<anon-key>` | `frontend/src/services/supabaseClient.js:8` | `createClient(...)` → Supabase Auth |
| `VITE_AUTH_URL` | **no — unused** | no | — | *nowhere* (grep-verified) | dead remnant of the abandoned Better Auth plan |

Only `VITE_`-prefixed variables reach the browser bundle, and their values are inlined at **build
time**: change one and you must restart the dev server or redeploy the SPA.

### 1.3 Dev-server only

| Variable | Default | Read at | Notes |
|---|---|---|---|
| `VITE_API_TARGET` | `http://127.0.0.1:8000` | `frontend/vite.config.js:8` | Read from `process.env` when the config is evaluated, so it must come from the shell — verified: a value in `.env.local` does **not** appear in `process.env`. Used by the `/api` proxy at `frontend/vite.config.js:30-33`. No effect on a production build. |

### 1.4 Dead configuration (do not "fix" by implementing it)

| Artifact | Location | Status |
|---|---|---|
| `/api/auth` → `127.0.0.1:3001` proxy | `frontend/vite.config.js:24-28` | Dead: no Better Auth server exists, nothing listens on 3001 |
| `npx auth migrate` comment | `database/init.sql:4` | Dead: auth is Supabase Auth |
| `auth-server/node_modules/` ignore rule | `.gitignore:4` | Dead: no such directory |

---

## 2. `backend/config/constants.py`

The scoring and progression contract, shared with the UI. Every value below is the module-level
assignment from the file (26 lines).

| Constant | Value | Line | Used by |
|---|---|---|---|
| `EFFICIENCY_WEIGHT` | `40.0` | `backend/config/constants.py:9` | `backend/services/scoring_service.py` |
| `TARGET_LAW_WEIGHT` | `30.0` | `backend/config/constants.py:10` | same |
| `HINT_INDEPENDENCE_WEIGHT` | `30.0` | `backend/config/constants.py:11` | same |
| `MAX_SCORE` | `100.0` (sum of the three weights) | `backend/config/constants.py:12` | same |
| `STEP_PENALTY` | `10.0` | `backend/config/constants.py:15` | per step over the optimum |
| `ASSISTANCE_PENALTY` | `10.0` | `backend/config/constants.py:16` | per hint **or** guide |
| `MAX_BONUS_POINTS` | `5` | `backend/config/constants.py:19` | `earnedPoints` ceiling, paid **on top of** the frontend's base `STAGE_COMPLETION_XP` |
| `SCORE_ROUNDING_DP` | `1` | `backend/config/constants.py:22` | decimals kept on every reported component |
| `STAR_THRESHOLDS` | `(90.0, 75.0)` | `backend/config/constants.py:25` | 3 stars ≥ 90, 2 stars ≥ 75, else 1 |
| `UNLOCK_AVERAGE` | `80.0` | `backend/config/constants.py:26` | average score needed to unlock the next level |

Worked example (verified live) for `{levelId: 1, stageIdx: 0, stepsUsed: 1, lawsUsed: ["absorption"],
hintsUsed: 0}`: efficiency `40.0` + target law `30.0` + hint independence `30.0` = `100.0`, and
`earnedPoints` = `5`.

The algorithm itself — including the subtle `optimal = min(declared, stepsUsed)` rule, the treatment
of a puzzle with no target laws, and the bonus rounding — is documented in
[scoring-and-rewards.md](scoring-and-rewards.md).

> **Rounding note (D21).** `earnedPoints` is computed server-side with Python `round()`, which uses
> banker's rounding, while the frontend mirror uses `Math.round` (half-up). The formula is
> `earnedPoints = round((total / 100) * 5)`, so whenever `total` is 10, 30, 50, 70 or 90 the
> intermediate value is exactly `x.5`. Measured on this checkout: Python returns `0, 2, 2, 4, 4` where
> JavaScript returns `1, 3, 3, 4, 5` for those five totals. **The server value is authoritative** —
> never recompute a learner's points in a support script and expect the frontend's number to match.

---

## 3. `frontend/src/config/gameRules.js`

Every tunable number in the UI, in one file: "Change a rule here and every consumer follows"
(`frontend/src/config/gameRules.js:6`).

### 3.1 Scoring and rewards

| Export | Value | Line | Meaning |
|---|---|---|---|
| `SCORE_WEIGHTS` | `{ efficiency: 40, targetLaw: 30, hintIndependence: 30 }` | `gameRules.js:14-18` | must sum to 100 |
| `SCORE_PENALTY.stepOverOptimal` | `10` | `gameRules.js:23` | per step beyond the optimum |
| `SCORE_PENALTY.assistance` | `10` | `gameRules.js:25` | per hint or guide |
| `SCORE_BONUS_MAX_POINTS` | `5` | `gameRules.js:29` | perfect-score bonus, on top of `STAGE_COMPLETION_XP` |
| `STAGE_COMPLETION_XP` | `10` | `gameRules.js:32` | fixed XP for finishing a stage |
| `GUIDE_COST_POINTS` | `20` | `gameRules.js:35` | **points spent** to activate the Guide on a graded stage (free in the sandbox) |

`GUIDE_COST_POINTS = 20` is a spend and `SCORE_PENALTY.assistance = 10` is a deduction — do not
conflate them.

### 3.2 Progression

| Export | Value | Line | Meaning |
|---|---|---|---|
| `STAR_THRESHOLDS.three` | `90` | `gameRules.js:39` | score ≥ 90 earns 3 stars |
| `STAR_THRESHOLDS.two` | `75` | `gameRules.js:40` | score ≥ 75 earns 2 stars |
| `STAR_THRESHOLDS.one` | `1` | `gameRules.js:42` | any completion earns at least 1 star |
| `MAX_STARS_PER_STAGE` | `3` | `gameRules.js:46` | ceiling per stage |
| `UNLOCK_AVERAGE_SCORE` | `80` | `gameRules.js:49` | **every** stage done **and** average ≥ 80 unlocks the next level |
| `SCORE_RAMP.good` | `80` | `gameRules.js:53` | progress-bar colour band: ≥ 80 % |
| `SCORE_RAMP.fair` | `50` | `gameRules.js:54` | ≥ 50 %; below that the bar shows the low band |

The unlock rule as implemented: `frontend/src/state/progressStore.js:291-313` computes `allDone` and
`avgScore` and returns `unlocked: allDone && avgScore >= UNLOCK_AVERAGE_SCORE`.

> The proposal in [`docs/context.md`](../context.md) claims "Level 2 requires Level 1 average ≥ 70 %".
> The real figure is **80**, and completion of every stage is also required (finding D9).

### 3.3 Timing (milliseconds)

| Export | Value | Line | Meaning |
|---|---|---|---|
| `TIMING.lawAnimationMs` | `1350` | `gameRules.js:60` | law animation duration before the abstract syntax tree (AST) updates |
| `TIMING.preLawHighlightMs` | `1500` | `gameRules.js:62` | tutorial pause highlighting the upcoming change |
| `TIMING.successModalDelayMs` | `200` | `gameRules.js:64` | delay before the success modal opens |
| `TIMING.hintAutoDismissMs` | `6000` | `gameRules.js:66` | how long a hint bubble stays visible |
| `TIMING.progressSaveDebounceMs` | `500` | `gameRules.js:68` | debounce before pushing progress to the server |
| `TIMING.sandboxValidationDebounceMs` | `300` | `gameRules.js:70` | debounce before validating sandbox input |
| `TIMING.sandboxBusyPaintMs` | `30` | `gameRules.js:72` | paint delay while a sandbox puzzle builds |
| `TIMING.signOutRedirectMs` | `100` | `gameRules.js:74` | pause after sign-out so auth state clears |
| `TIMING.coachCardReflowMs` | `320` | `gameRules.js:76` | poll interval keeping the tutorial card anchored |
| `TIMING.spotlightRectPollMs` | `200` | `gameRules.js:78` | poll interval keeping the spotlight on a moving target |

> The proposal claims a "2.5 s" animation. The real value is **1350 ms** (finding D12).

### 3.4 Tutorial identity

| Export | Value | Line | Meaning |
|---|---|---|---|
| `TUTORIAL.levelId` | `0` | `gameRules.js:83` | the tutorial is content level **0** — this is why tutorial progress rows have `level_id = 0` |
| `TUTORIAL.stageIndexes` | `[0, 1, 2, 3]` | `gameRules.js:84` | the four tutorial stages; all four gate Levels 1–3 and the sandbox |

`frontend/src/components/TutorialGate.jsx:5` builds the entry route
`/level/0/stage/0?tutorial=true`, and `frontend/src/state/progressStore.js:330-335` decides
`hasCompletedTutorial` from those four indexes.

### 3.5 Drag and drop

| Export | Value | Line | Meaning |
|---|---|---|---|
| `DRAG.thresholdPx` | `6` | `gameRules.js:90` | movement that turns a press into a drag |
| `DRAG.nearCapsuleTolerancePx` | `28` | `gameRules.js:92` | how far past a capsule edge a release still counts |
| `DRAG.clickSuppressMs` | `400` | `gameRules.js:94` | how long a stray click stays swallowed after a drag |

### 3.6 Sandbox

| Export | Value | Line | Meaning |
|---|---|---|---|
| `SANDBOX.maxVariables` | `4` | `gameRules.js:112` | distinct literals one learner expression may use |
| `SANDBOX.difficulty` | `'medium'` | `gameRules.js:114` | default difficulty for generated problems |
| `SANDBOX.budget.simplestForm.maxDepth` | `16` | `gameRules.js:128` | search depth budget |
| `SANDBOX.budget.simplestForm.maxStates` | `40000` | `gameRules.js:128` | state budget — raised from 20 000 after measuring a real worst case |
| `SANDBOX.budget.optimalPath.maxDepth` | `16` | `gameRules.js:131` | depth budget for replaying the optimal derivation |
| `SANDBOX.budget.optimalPath.maxStates` | `24000` | `gameRules.js:131` | state budget |
| `SANDBOX_DIFFICULTY` | `'medium'` | `gameRules.js:136` | alias of `SANDBOX.difficulty` |

### 3.7 Sound

Cue shape is `{ type, notes, noteMs, gapMs, gain }` (`gameRules.js:141`) — one oscillator per note
inside a gain envelope, with `notes` in scientific pitch (`'C#5'`, `'Eb4'`). Adding a cue is one
line here; nothing outside this file hardcodes a frequency or a duration.

| Export | Value | Line |
|---|---|---|
| `SOUND.enabled` | `true` (first-run default only; the learner's choice lives in `localStorage`) | `gameRules.js:153` |
| `SOUND.volume` | `0.16` | `gameRules.js:155` |
| `SOUND.attackMs` | `12` | `gameRules.js:157` |
| `SOUND.throttleMs` | `90` — shortest gap between two plays of the **same** cue; enforced only by `playThrottledSound()`, which is what the carousel ticks use | `gameRules.js:167` |
| `SOUND.cues.step` | `{ triangle, ['E5'], 70, 0, 0.75 }` | `gameRules.js:170` |
| `SOUND.cues.hint` | `{ sine, ['C5','G5'], 90, 45, 0.8 }` | `gameRules.js:172` |
| `SOUND.cues.guide` | `{ sine, ['E5','A5','C#6'], 85, 45, 0.8 }` | `gameRules.js:174` |
| `SOUND.cues.correct` | `{ sine, ['C5','E5','G5','C6'], 95, 55, 0.95 }` | `gameRules.js:176` |
| `SOUND.cues.wrong` | `{ sawtooth, ['A3','E3'], 120, 60, 0.7 }` | `gameRules.js:178` |
| `SOUND.cues.reset` | `{ triangle, ['A5','F5','C5'], 85, 40, 0.7 }` | `gameRules.js:180` |
| `SOUND.cues.complete` | `{ sine, ['C5','E5','G5','C6','E6'], 110, 60, 1 }` | `gameRules.js:182` |
| `SOUND.cues.select` | `{ triangle, ['B5'], 50, 0, 0.5 }` | `gameRules.js:187` |
| `SOUND.cues.deselect` | `{ triangle, ['F#5'], 50, 0, 0.34 }` | `gameRules.js:189` |
| `SOUND.cues.levelNav` | `{ sine, ['A5'], 40, 0, 0.32 }` | `gameRules.js:191` |
| `SOUND.cues.enter` | `{ sine, ['G5','D6'], 75, 45, 0.7 }` | `gameRules.js:193` |
| `SOUND.cues.panelOpen` | `{ sine, ['D5','G5'], 55, 30, 0.45 }` | `gameRules.js:195` |
| `SOUND.cues.panelClose` | `{ sine, ['G5','D5'], 55, 30, 0.4 }` | `gameRules.js:197` |

Cues are named for what the learner just did, not for the screen that plays them, so one cue can
serve several places. Every cue is called from exactly one kind of moment:

| Cue | Fired when |
|---|---|
| `step` / `hint` / `guide` / `correct` / `wrong` / `reset` | the puzzle derivation changes or a dead end is reached (`state/useGameState.js`), and `complete` when a stage is scored (`components/puzzle/usePuzzleSession.js:162`) |
| `select` / `deselect` | a literal, term or negated group is clicked into or out of the selection (`state/useGameState.js`, one cue per click) |
| `levelNav` | the level carousel's selected index changes (`pages/LevelSelectPage.jsx`) — always through the throttled path |
| `enter` | a level or stage is actually chosen and the app navigates there (`pages/LevelSelectPage.jsx`, `pages/StageSelectorPage.jsx`) |
| `panelOpen` / `panelClose` | a panel or drawer becomes visible or hidden — laws reference, step history (`hooks/usePanelSound.js`) |

`playSound()` no-ops when muted or when no user gesture has unlocked the audio context yet, so a
call site never re-checks the preference; the gesture that starts a sound on a screen without
puzzle interactions (the level and stage screens, any panel trigger) calls `primeAudio()` first.
Nothing plays from a render: selection clicks cue from the event handler, the carousel and the
panels cue from a guarded state-transition effect.

### 3.8 Solver budgets

| Export | Value | Line | Meaning |
|---|---|---|---|
| `SOLVER_BUDGET.graded.maxDepth` | `10` | `gameRules.js:204` | depth cap for a graded puzzle |
| `SOLVER_BUDGET.graded.maxStates` | `3000` | `gameRules.js:204` | state cap for a graded puzzle |
| `SOLVER_BUDGET.generator.simplestForm.maxDepth` | `12` | `gameRules.js:207` | generator must reach the simplest form… |
| `SOLVER_BUDGET.generator.simplestForm.maxStates` | `8000` | `gameRules.js:207` | …within this budget |
| `SOLVER_BUDGET.generator.optimalPath.maxDepth` | `12` | `gameRules.js:208` | …then the goal |
| `SOLVER_BUDGET.generator.optimalPath.maxStates` | `12000` | `gameRules.js:208` | path budget |

---

## 4. `frontend/src/config/storageKeys.js`

Every browser storage key the app uses. Never inline one of these strings at a call site
(`frontend/src/config/storageKeys.js:6`).

| Export | Value | Storage | Line | Meaning |
|---|---|---|---|---|
| `progressKey(userId)` | `` `praxis_v1_${userId}` `` | `localStorage` | `storageKeys.js:10` | the learner's progress snapshot; **per user id**, e.g. `praxis_v1_9f1c…` |
| `PROGRESS_KEY_PREFIX` | `'praxis_v1_'` | — | `storageKeys.js:13` | prefix used to find the key generically |
| `SKIP_TUTORIAL_REPLAY_PROMPT` | `'praxis_skip_tutorial_replay_prompt'` | `sessionStorage` | `storageKeys.js:16` | "don't ask again" for the tutorial-replay prompt |
| `SKIP_RESET_CONFIRM` | `'praxis_skip_reset_confirm'` | `sessionStorage` | `storageKeys.js:19` | "don't ask again" for the puzzle-reset confirmation |
| `CUSTOM_SANDBOX_PUZZLE` | `'praxis_sandbox_custom_puzzle'` | `sessionStorage` | `storageKeys.js:22` | learner-authored expression handed from `/sandbox` to `/sandbox/play` |
| `HIDE_ROTATE_BANNER` | `'praxis_hide_rotate_banner'` | `sessionStorage` | `storageKeys.js:25` | rotate-device banner dismissed this session |
| `SOUND_ENABLED` | `'praxis_sound_enabled'` | `localStorage` | `storageKeys.js:28` | `'true'` / `'false'` sound preference |

The guest learner uses the key `praxis_v1_guest` — `GUEST_USER_ID = 'guest'`
(`frontend/src/state/progressStore.js:28`) feeds straight into `progressKey`. See
[reset-user-progress.md](../05-guides/how-to/reset-user-progress.md) for how to clear both layers.

What the progress snapshot contains (`frontend/src/state/progressStore.js:30-39`):

| Field | Type | Meaning |
|---|---|---|
| `points` | number | total points |
| `streak` | number | current streak |
| `bestStreak` | number | best streak |
| `levelsCompleted` | number[] | completed level ids, `0` = tutorial |
| `stageProgress` | `{ "1": [0,1,2] }` | completed stage indexes by level id |
| `stageScores` | `{ "1:0": 87.5 }` | best total score per `level:stage` |
| `stageSolutions` | `{ "1:0": [{ law, from, to }] }` | saved derivation, so it can be replayed offline |
| `hasSeenTutorial` | boolean | the looser of the two tutorial flags |

---

## 5. `frontend/src/config/appLinks.js`

| Export | Value | Line | Used by |
|---|---|---|---|
| `SURVEY_URL` | `https://docs.google.com/forms/d/1P4O0MdbQUAUGz-xNL-neMHX5ukDuLTjCq-nXpEaFdb8/viewform?edit_requested=true` | `frontend/src/config/appLinks.js:9` | `SurveyButton` — opens the learner feedback form in a new tab |

Renaming or replacing the survey is a one-line change here (`appLinks.js:4-6`).

---

## 6. Tailwind design tokens

`frontend/tailwind.config.js` is the source of truth for anything reached through a class name
(`frontend/src/styles/tokens.css:4-7`). The `content` globs are `./index.html` and
`./src/**/*.{js,ts,jsx,tsx}` (`tailwind.config.js:3-6`); `plugins` is empty
(`tailwind.config.js:56`).

### 6.1 Colors

| Class family | Token | Value | Line |
|---|---|---|---|
| `bg-bg` | `bg` | `#f0f2f7` | `tailwind.config.js:10` |
| `bg-bg-card` | `bg-card` | `#ffffff` | `tailwind.config.js:11` |
| `border-border` | `border` | `#e2e5ed` | `tailwind.config.js:12` |
| `border-border-dark` | `border-dark` | `#c8ccd6` | `tailwind.config.js:13` |
| `text-text-1` | `text.1` | `#1a2035` | `tailwind.config.js:15` |
| `text-text-2` | `text.2` | `#4b5468` | `tailwind.config.js:16` |
| `text-text-3` | `text.3` | `#9aa0b0` | `tailwind.config.js:17` |
| `bg-accent` / `text-accent` | `accent` | `#1a2035` | `tailwind.config.js:19` |
| `bg-teal` / `text-teal` | `teal.DEFAULT` | `#0ea5e9` | `tailwind.config.js:21` |
| `bg-teal-light` | `teal.light` | `#e0f4fd` | `tailwind.config.js:22` |
| `bg-amber` / `text-amber` | `amber.DEFAULT` | `#f59e0b` | `tailwind.config.js:25` |
| `bg-amber-light` | `amber.light` | `#fef3c7` | `tailwind.config.js:26` |
| `bg-green` / `text-green` | `green.DEFAULT` | `#10b981` | `tailwind.config.js:29` |
| `bg-green-light` | `green.light` | `#d1fae5` | `tailwind.config.js:30` |
| `bg-red` / `text-red` | `red` | `#ef4444` | `tailwind.config.js:32` |

The proposal's colour table matches the base values but omits every `-light` variant — prefer this
list and the config file.

### 6.2 Shadows

| Class | Value | Line |
|---|---|---|
| `shadow-sm` | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` | `tailwind.config.js:35` |
| `shadow-md` | `0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)` | `tailwind.config.js:36` |
| `shadow-lg` | `0 16px 40px rgba(0,0,0,0.14)` | `tailwind.config.js:37` |

### 6.3 Radii, fonts and transitions

| Token | Value | Line |
|---|---|---|
| `rounded-sm` | `6px` | `tailwind.config.js:40` |
| `rounded-md` | `12px` | `tailwind.config.js:41` |
| `rounded-lg` | `20px` | `tailwind.config.js:42` |
| `font-sans` | `Inter, system-ui, sans-serif` | `tailwind.config.js:45` |
| `font-mono` | `JetBrains Mono, Fira Code, monospace` | `tailwind.config.js:46` |
| default `transition-property` | `background-color, border-color, color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter, right` | `tailwind.config.js:49` |
| default `transition-duration` | `180ms` | `tailwind.config.js:52` |

The custom `transitionProperty` list exists so the rotate banner can animate `right`. Both fonts are
loaded from Google Fonts in `frontend/index.html:11-13`.

---

## 7. CSS custom properties (`tokens.css`)

Seven custom properties on `:root` (`frontend/src/styles/tokens.css:15-24`). They exist for the few
inline styles that cannot use a class — currently the rotate banner/overlay chrome
(`tokens.css:4-7`).

| Property | Value | Line | Tailwind equivalent |
|---|---|---|---|
| `--color-bg` | `#f0f2f7` | `tokens.css:16` | `bg-bg` |
| `--color-text-1` | `#1a2035` | `tokens.css:17` | `text-text-1` |
| `--color-text-2` | `#4b5468` | `tokens.css:18` | `text-text-2` |
| `--color-accent` | `#1a2035` | `tokens.css:19` | `bg-accent` / `text-accent` |
| `--color-amber` | `#f59e0b` | `tokens.css:20` | `bg-amber` / `text-amber` |
| `--color-amber-light` | `#fef3c7` | `tokens.css:21` | `bg-amber-light` |
| `--font-sans` | `'Inter', system-ui, sans-serif` | `tokens.css:23` | `font-sans` |

Base element rules in the same file: a global `box-sizing` reset with zeroed margins/padding
(`tokens.css:26`), `html, body, #root { height: 100% }` plus the sans font (`tokens.css:27`), body
background/colour and font smoothing (`tokens.css:28`), a `button` reset with the pointer cursor
(`tokens.css:29`), and `a { text-decoration: none }` (`tokens.css:30`).

> **Import order is load-bearing.** `frontend/src/main.jsx:6-10` imports `index.css` (Tailwind
> layers) first, then `tokens.css`, `utilities.css`, `orientation.css` and `animations.css`. Moving an
> `@import` after the `@tailwind` directives silently drops every utility — see
> `frontend/src/styles/index.css:1-14`.

---

## 8. Which layer owns which number

When a number appears in more than one place, this decides which copy is authoritative.

| Number | Authoritative source | Mirror | Notes |
|---|---|---|---|
| 40 / 30 / 30 weights | `backend/config/constants.py:9-11` | `gameRules.js:14-18` | the backend scores; the frontend previews |
| 10-point step penalty | `backend/config/constants.py:15` | `gameRules.js:23` | — |
| 10-point assistance penalty | `backend/config/constants.py:16` | `gameRules.js:25` | — |
| 5 bonus points | `backend/config/constants.py:19` | `gameRules.js:29` | paid on top of `STAGE_COMPLETION_XP` |
| 10 XP completion | `gameRules.js:32` | — | frontend-only concept; the backend knows only the bonus |
| 20-point Guide cost | `gameRules.js:35` | — | a spend, not a deduction |
| 90 / 75 stars | `backend/config/constants.py:25` | `gameRules.js:39-40` | — |
| 80 % unlock | `backend/config/constants.py:26` | `gameRules.js:49` | plus the "every stage done" rule in `progressStore.js:291-313` |
| Level indexes (0 = tutorial) | `content/levels.json` | `gameRules.js:83` | `TUTORIAL.levelId` must match the content id |
| Tutorial stage set | `content/levels.json` (4 puzzles) | `gameRules.js:84` | `stageIndexes` must match |
| Animation timings | `gameRules.js:58-79` | — | frontend only |
| Design tokens | `frontend/tailwind.config.js` | `tokens.css` | Tailwind for class names, CSS vars for inline styles |

Related reading: [configuration-guide.md](../08-devops/configuration-guide.md) ·
[scoring-and-rewards.md](scoring-and-rewards.md) · [boolean-laws.md](boolean-laws.md) ·
[error-codes.md](error-codes.md) · [glossary](../10-project/glossary.md).
