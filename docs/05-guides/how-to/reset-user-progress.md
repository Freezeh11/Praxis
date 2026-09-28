# How to reset a learner's progress

**What this is:** the exact procedure for wiping progress — points, streaks, completed stages, best
scores and saved derivations — either for the learner signed in on your machine or for everyone in the
Supabase project.

**Who it's for:** a developer testing the level gates, a support person acting on a reset request, or
anyone whose own progress is stuck after an experiment. If you have never run the app, read
[getting-started.md](../tutorials/getting-started.md) first.

**The one thing to know before you start:** progress lives in **two** layers, and the frontend
**merges** rather than overwrites them. Clearing only one layer does not reset anybody
(§4 explains why, with the code).

## Contents

1. [Where progress actually lives](#1-where-progress-actually-lives)
2. [Reset the signed-in learner on this machine](#2-reset-the-signed-in-learner-on-this-machine)
3. [Reset one learner everywhere, browser and database](#3-reset-one-learner-everywhere-browser-and-database)
4. [Why half a reset fails](#4-why-half-a-reset-fails)
5. [Surgical resets: one level, one stage, or the tutorial gate](#5-surgical-resets-one-level-one-stage-or-the-tutorial-gate)
6. [Full wipe: every learner](#6-full-wipe-every-learner)
7. [Verifying the reset](#7-verifying-the-reset)
8. [Things that will bite you](#8-things-that-will-bite-you)

---

## 1. Where progress actually lives

| Layer | What | Key / table | Cleared by |
|---|---|---|---|
| Browser `localStorage` | the full snapshot: points, streak, best streak, `levelsCompleted`, `stageProgress`, `stageScores`, `stageSolutions`, `hasSeenTutorial` | `praxis_v1_<userId>` (`frontend/src/config/storageKeys.js:10`) | DevTools, §2 |
| Browser `sessionStorage` | "don't ask again" flags and the sandbox hand-off puzzle | `praxis_skip_tutorial_replay_prompt`, `praxis_skip_reset_confirm`, `praxis_sandbox_custom_puzzle`, `praxis_hide_rotate_banner` (`frontend/src/config/storageKeys.js:16-25`) | closing the tab, §2 |
| Supabase `user_progress` | one row per learner: `points`, `streak`, `best_streak`, `updated_at` | `database/init.sql:7-13` | SQL, §3/§6 |
| Supabase `stage_progress` | one row per completed stage: `best_score`, `completed`, `completed_at` | `database/init.sql:16-25` | SQL, §3/§6 |
| Supabase `score_history` | one row per scored attempt | `database/init.sql:28-42` | SQL, §3/§6 |

The browser key is **per learner**: signing in as a different account on the same machine reads a
different key. The guest (signed-out) learner uses `praxis_v1_guest`, because `GUEST_USER_ID = 'guest'`
(`frontend/src/state/progressStore.js:28`) feeds into the same key builder.

The snapshot shape is defined once, in `frontend/src/state/progressStore.js:30-39`:

```js
const defaultProgress = {
  points: 0,
  streak: 0,
  bestStreak: 0,
  levelsCompleted: [],        // [1, 2, 3]
  stageProgress: {},          // { "1": [0, 1, 2] } → level 1, stages 0,1,2 done
  stageScores: {},            // { "1:0": 87.5 } → best total score per stage
  stageSolutions: {},         // { "1:0": [{ law, from, to }] } → saved derivation
  hasSeenTutorial: false,
}
```

Remember the level numbering: the tutorial is content level **0**, and `stageProgress["0"]` holds its
four stage indexes. Levels 1–3 are content ids 1, 2, 3.

---

## 2. Reset the signed-in learner on this machine

Use this when you want a clean local experience without touching anyone else's data — and remember
that the server rows still exist, so signing in again will re-hydrate them (§4).

### 2.1 Sign out first

Sign out from the app. This is not cosmetic: while the app is open, the in-memory store keeps writing
`localStorage` on every change and pushes to the server after a 500 ms debounce
(`frontend/src/state/progressStore.js:87-94`). A reset performed under a live store can be
overwritten seconds later.

### 2.2 Clear the browser storage

Open DevTools on <http://localhost:5173> (**F12**) → **Console**, and run:

```js
// 1. Inspect: which Praxis keys exist, and what they hold
Object.keys(localStorage)
  .filter((k) => k.startsWith('praxis_'))
  .forEach((k) => console.log(k, JSON.parse(localStorage.getItem(k) || 'null')))
```

Each progress key is literally `praxis_v1_<user-id>`, so the key name tells you which learner it
belongs to. To remove the snapshot for **the current learner only**, find the id first:

```js
// 2. The current learner's Supabase id (the key suffix), if the app is signed in
const sessionKey = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
const userId = sessionKey ? JSON.parse(localStorage.getItem(sessionKey))?.user?.id : null
console.log('current user id:', userId)

// 3. Delete exactly that learner's snapshot
if (userId) localStorage.removeItem(`praxis_v1_${userId}`)
```

To remove **every Praxis snapshot on this browser** (all learners who ever signed in here):

```js
Object.keys(localStorage)
  .filter((k) => k.startsWith('praxis_v1_'))
  .forEach((k) => localStorage.removeItem(k))
```

Optionally reset the per-session flags and the sound preference:

```js
// session flags (also cleared by closing the tab)
;['praxis_skip_tutorial_replay_prompt', 'praxis_skip_reset_confirm', 'praxis_sandbox_custom_puzzle', 'praxis_hide_rotate_banner']
  .forEach((k) => sessionStorage.removeItem(k))

// sound preference ('true' | 'false')
localStorage.removeItem('praxis_sound_enabled')
```

### 2.3 Reload

Reload <http://localhost:5173>. The store starts from `defaultProgress`, and — if you are still signed
in — hydrates from the server, which is why §3 matters for a real reset.

**✅ Verify:** the points chip shows 0 and `/levels` sends you to the tutorial. If the old values come
back, you have hit the merge rule: read §4 and do §3.

---

## 3. Reset one learner everywhere, browser and database

This is the complete, per-learner reset. Do it in this order.

### 3.1 Sign out and close the app's tabs

Any open tab can write progress back. Sign out, then close every Praxis tab (or use a fresh window
after the reset).

### 3.2 Find the learner's user id

Supabase dashboard → **Authentication → Users**, and copy the `id` (a UUID) of the learner. The same
id is the suffix of their localStorage key (`praxis_v1_<uuid>`), which is a handy cross-check.

Or from the SQL editor:

```sql
select id, email, created_at, last_sign_in_at
from auth.users
order by created_at desc;
```

### 3.3 Delete their database rows

Supabase dashboard → **SQL Editor** → paste, replacing the UUID:

```sql
-- Score attempts first, then stage rows, then the totals row.
delete from score_history  where user_id = '<uuid>';
delete from stage_progress where user_id = '<uuid>';
delete from user_progress  where user_id = '<uuid>';
```

Delete order does not strictly matter — there are no foreign keys between the three tables — but
writing it in this order keeps the intent clear and the counts easy to read.

Optionally delete the account itself. `auth.users` is the parent of all three tables with
`ON DELETE CASCADE` (`database/init.sql:8`, `:18`, `:30`), so this wipes their progress *and* their
login:

```sql
delete from auth.users where id = '<uuid>';
```

### 3.4 Delete their browser snapshot

On the machine that learner used, run the snippet from §2.2 (the per-learner version), or open a fresh
incognito window for the next test so no snapshot exists at all.

### 3.5 Sign in again

**✅ Verify:** immediately after signing in, the learner is sent to the tutorial and
`GET /api/progress` returns a defaults payload (`points: 0`, empty maps). Confirm in the backend log;
a `200` with an empty snapshot is the proof that the server has nothing.

---

## 4. Why half a reset fails

Two behaviours in `frontend/src/state/progressStore.js` are the reason this how-to insists on doing
both layers.

**1. Hydration merges, and takes the maximum.** When a learner signs in, `setUser()` reads the local
snapshot and then calls `loadProgress()`; the answer is merged:

```js
points: Math.max(local.points, server.points || 0),
bestStreak: Math.max(local.bestStreak, server.bestStreak || 0),
```

plus a union of completed stages and `Math.max` per stage score
(`frontend/src/state/progressStore.js:96-130`, `:147-166`). There is no "server wins" or "local wins"
switch:

| You cleared | Result |
|---|---|
| Database only | the browser snapshot re-populates points and stages on the next sign-in |
| Browser only | the server snapshot re-populates them on the next sign-in |
| Both | a genuine reset |

**2. Persistence is debounced and silent.** Any change schedules `POST /api/progress/save` 500 ms
later (`frontend/src/state/progressStore.js:87-94`; `TIMING.progressSaveDebounceMs = 500`,
`frontend/src/config/gameRules.js:68`), and that endpoint **upserts** — there is no delete route in the
API (see [API-REFERENCE.md](../../04-api/API-REFERENCE.md)). So a database reset performed while a
signed-in tab is open can be undone by that tab. Sign out first.

A third trap, for the guest learner: the guest never syncs (`scheduleServerSave` returns early when
`userId === GUEST_USER_ID`, `frontend/src/state/progressStore.js:88`), so guest progress exists **only**
in `localStorage` — clearing `praxis_v1_guest` is a complete reset for it.

---

## 5. Surgical resets: one level, one stage, or the tutorial gate

All of these are database-first, then browser.

### 5.1 Reset the tutorial gate only

The gate is driven by `hasCompletedTutorial`, which is true when `levelsCompleted` contains `0`
**or** all four tutorial stages are complete (`frontend/src/state/progressStore.js:330-335`). To send
the learner back through the tutorial:

```sql
-- tutorial = level_id 0
delete from stage_progress where user_id = '<uuid>' and level_id = 0;
```

Then delete the browser snapshot (§2.2) — or, if you want to keep their other progress, edit the
stored JSON instead:

```js
// Remove the tutorial from the local snapshot but keep everything else.
const key = `praxis_v1_<uuid>`
const p = JSON.parse(localStorage.getItem(key))
p.hasSeenTutorial = false
p.hasCompletedTutorial = false
p.levelsCompleted = (p.levelsCompleted || []).filter((id) => id !== 0)
delete p.stageProgress['0']
Object.keys(p.stageScores).filter((k) => k.startsWith('0:')).forEach((k) => delete p.stageScores[k])
Object.keys(p.stageSolutions || {}).filter((k) => k.startsWith('0:')).forEach((k) => delete p.stageSolutions[k])
localStorage.setItem(key, JSON.stringify(p))
```

The only UI-driven reset in the app is the tutorial replay prompt; it calls
`resetLevelProgress(TUTORIAL.levelId)` (`frontend/src/hooks/useTutorialReplay.js:31`), which clears
level 0 locally — and, because it does not touch the server, the tutorial completes again on the next
sign-in unless you also run the SQL above.

### 5.2 Reset one level

```sql
-- level_id 2 = "Level 2" (content ids: 0 tutorial, 1, 2, 3)
delete from stage_progress where user_id = '<uuid>' and level_id = 2;
delete from score_history  where user_id = '<uuid>' and level_id = 2;
```

In the browser, remove the same level from the snapshot:

```js
const key = `praxis_v1_<uuid>`
const p = JSON.parse(localStorage.getItem(key))
delete p.stageProgress['2']
Object.keys(p.stageScores).filter((k) => k.startsWith('2:')).forEach((k) => delete p.stageScores[k])
Object.keys(p.stageSolutions || {}).filter((k) => k.startsWith('2:')).forEach((k) => delete p.stageSolutions[k])
p.levelsCompleted = (p.levelsCompleted || []).filter((id) => id !== 2)
localStorage.setItem(key, JSON.stringify(p))
```

### 5.3 Reset one stage

```sql
-- level 1, stage 0  (stages are 0-based, exactly as in content/levels.json)
delete from stage_progress where user_id = '<uuid>' and level_id = 1 and stage_idx = 0;
```

Browser side:

```js
const key = `praxis_v1_<uuid>`
const p = JSON.parse(localStorage.getItem(key))
p.stageProgress['1'] = (p.stageProgress['1'] || []).filter((i) => i !== 0)
delete p.stageScores['1:0']
if (p.stageSolutions) delete p.stageSolutions['1:0']
localStorage.setItem(key, JSON.stringify(p))
```

A single-stage reset does not change `points` or `streak`; those are monotonic totals maintained by
`addPoints` (`frontend/src/state/progressStore.js:170-176`). If you need those reset too, do the full
reset in §3.

### 5.4 Reset the score history only (keep current progress)

```sql
delete from score_history where user_id = '<uuid>';
```

Nothing in the UI reads `score_history` — current best scores live in `stage_progress` — so this
changes no visible state. It is the safe way to shrink the table that grows without bound
(see [monitoring.md](../../08-devops/monitoring.md) §6.2).

---

## 6. Full wipe: every learner

Use this on a development or demo project before a clean run. It deletes **all** progress for **all**
learners; it does not delete the accounts.

```sql
-- 1. Count first, so you can prove what changed.
select
  (select count(*) from user_progress)  as users,
  (select count(*) from stage_progress) as stage_rows,
  (select count(*) from score_history)  as attempts;

-- 2. Wipe.
delete from score_history;
delete from stage_progress;
delete from user_progress;

-- 3. Confirm.
select
  (select count(*) from user_progress)  as users,
  (select count(*) from stage_progress) as stage_rows,
  (select count(*) from score_history)  as attempts;
```

`truncate score_history, stage_progress, user_progress;` is equivalent and faster; use `delete` if you
want the row counts in the statement output.

To also remove the learner accounts:

```sql
-- Development projects only. Cascades to all three progress tables.
delete from auth.users;
```

If you want to keep the schema but start from a known state, re-running
[`database/init.sql`](../../../database/init.sql) is always safe — it uses `CREATE TABLE IF NOT EXISTS`
and `CREATE INDEX IF NOT EXISTS` and never drops anything.

Finally, clear the browser layer on every machine you use (§2.2, the "all Praxis snapshots" variant).
A fresh incognito window is equivalent for a one-off test.

---

## 7. Verifying the reset

Do all three checks; a reset that passes only the first two will still surprise you on the next
sign-in.

**1. Database is empty for that learner:**

```sql
select
  (select count(*) from user_progress  where user_id = '<uuid>') as totals_rows,
  (select count(*) from stage_progress where user_id = '<uuid>') as stage_rows,
  (select count(*) from score_history  where user_id = '<uuid>') as attempt_rows;
```

Expected: `0, 0, 0`.

**2. The API returns defaults.** Sign in in a fresh window and watch the backend log; or with a valid
Bearer token (see [runbooks.md RB-03](../../08-devops/runbooks.md#rb-03-401-unauthorized-on-progress-routes)):

```bash
curl -s -H 'Authorization: Bearer <token>' http://127.0.0.1:8000/api/progress
```

Expected (envelope shortened):

```json
{"success":true,"data":{"points":0,"streak":0,"bestStreak":0,"stageProgress":{},"stageScores":{}},"error":null}
```

**3. The browser is empty.** In DevTools → **Application → Local Storage**, the learner's
`praxis_v1_<uuid>` key is absent (or the app recreates it with defaults on first change). The UI shows
0 points and the tutorial gate sends you to `/level/0/stage/0?tutorial=true`.

---

## 8. Things that will bite you

| Trap | Why it happens | What to do |
|---|---|---|
| Reset "did not work" after a reload | the other layer re-hydrated it | clear both layers (§4) |
| Progress came back seconds later | a signed-in tab was still open and pushed its snapshot | sign out and close the tabs first |
| Deleting the DB row did nothing visible | the browser snapshot is the fast path and is read first | clear `localStorage` too |
| The learner cannot replay the tutorial | the gate reads four stage indexes, not "seen" | §5.1 |
| Points stay high after a level reset | `points`/`streak` are monotonic totals | full reset (§3) |
| A different account on the same browser seems reset | keys are per user id — you cleared the wrong one | check the key suffix (§2.2) |
| Guest progress survived a database wipe | guests never sync to the server | clear `praxis_v1_guest` |
| `sessionStorage` flags reset themselves | they are session-scoped by design | nothing to fix; use them as intended |
| Tests fail because a fixture expects a completed level | test data is separate from learner progress | this how-to changes application data, not fixtures |

For a learner-facing explanation of what is stored and why, point them at the app's own behaviour —
progress is stored in their browser and in your Supabase project, and signing out does not delete
either. For incident work (a database that needs restoring rather than clearing), see
[runbooks.md RB-08](../../08-devops/runbooks.md#rb-08-back-up-and-restore-supabase-data).

Related reading: [configuration reference](../../06-reference/config-reference.md#4-frontendsrcconfigstoragekeysjs)
for the storage keys and snapshot fields · [SCHEMA.md](../../03-database/SCHEMA.md) for the table
definitions · [SCORING](../../06-reference/scoring-and-rewards.md) for what the numbers mean.
