# SCHEMA — the Praxis data dictionary

**What this is:** the exhaustive, column-by-column reference for the three PostgreSQL tables Praxis
stores in Supabase — `user_progress`, `stage_progress` and `score_history` — including every
constraint, every index and every Row Level Security policy, quoted verbatim from the DDL.
**Who it's for:** a new teammate who has to change the schema, debug a missing row, or explain to a
reviewer what the database does and does not guarantee. Read [ERD.md](ERD.md) first for the picture;
this file is the detail.

## Contents

- [How to read this reference](#how-to-read-this-reference)
- [Where the schema lives](#where-the-schema-lives)
- [Tables at a glance](#tables-at-a-glance)
- [user_progress](#user_progress)
- [stage_progress](#stage_progress)
- [score_history](#score_history)
- [Constraints in full](#constraints-in-full)
- [Indexes in full](#indexes-in-full)
- [Row Level Security](#row-level-security)
- [Who writes these tables](#who-writes-these-tables)
- [What is NOT in the database](#what-is-not-in-the-database)
- [Known discrepancies](#known-discrepancies)
- [Applying and verifying the schema](#applying-and-verifying-the-schema)

---

## How to read this reference

| Column in the tables below | Meaning |
|---|---|
| **Column** | The PostgreSQL column name, exactly as the API returns it in `select("*")` queries. |
| **Type** | The declared PostgreSQL type. `REAL` is `float4` (4-byte floating point), not `NUMERIC`. |
| **Null?** | `NO` only where the DDL says `NOT NULL` or the column is part of a `PRIMARY KEY`. Everything else accepts `NULL` **even when it has a default** — a default applies only when the column is omitted from an `INSERT`, it does not stop an explicit `NULL`. |
| **Default** | Taken verbatim from the DDL. |
| **Constraints** | Primary key, foreign key, unique — plus the honest note that there are no `CHECK` constraints anywhere in `database/init.sql`. |

Every quoted DDL fragment in this file comes from the 58-line script `database/init.sql`, which is
the whole schema. There is no migrations directory, no ORM and no second DDL file: verified with
`grep -rn "CREATE TABLE" --include=*.sql .` → three matches, all in `database/init.sql:7,16,28`.

## Where the schema lives

- The DDL is one file: `database/init.sql` (58 lines). Its header says to run it in the Supabase SQL
  Editor (`database/init.sql:2`).
- All three tables are created in the **`public`** schema (no `CREATE SCHEMA` statement exists), and
  they reference **`auth.users(id)`**, a table owned by Supabase Auth and created by Supabase, not by
  this repo (`database/init.sql:8,18,30`).
- The application never runs DDL. The backend only speaks PostgREST over HTTP
  (`backend/supabase_client.py:24`, `base_url = f"{self.url}/rest/v1"`).
- The schema is therefore applied **by hand, out of band**. That is why the three tables can be
  out of step with the repository: nothing in the code checks that `init.sql` was ever executed.

## Tables at a glance

| Table | Row means | Row count per learner | Written by |
|---|---|---|---|
| `user_progress` | The learner's running totals: points, current streak, best streak. | **At most 1** — the PK *is* the FK to `auth.users`. | `POST /api/progress/save` only (`backend/services/progress_service.py:63`). |
| `stage_progress` | One stage the learner has finished, with the best score ever earned there. | At most one per (level, stage) — `UNIQUE(user_id, level_id, stage_idx)`. Up to 40 today (4 + 12 + 12 + 12). | `POST /api/progress/save` (`backend/services/progress_service.py:76`) **and** the background score task (`backend/services/progress_service.py:114`). |
| `score_history` | One scored attempt: an immutable log line per puzzle completion. | Unbounded — every attempt inserts a new row. | The background score task only (`backend/services/progress_service.py:94`). |

There are **no other tables**. In particular there is no `levels`, `laws`, `puzzles` or `solutions`
table: all game content is static JSON under `content/` (see
[What is NOT in the database](#what-is-not-in-the-database)).

---

## user_progress

One row per learner, created the first time their client pushes a progress snapshot. A learner who
has never saved has **no row at all**, and `GET /api/progress` still answers `200` — the service
substitutes zeros when the row is missing (`backend/services/progress_service.py:45-47`).

```sql
CREATE TABLE IF NOT EXISTS user_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,        -- References Supabase auth.users
  points INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

*(`database/init.sql:7-13`, reproduced verbatim.)*

| # | Column | Type | Null? | Default | Constraints |
|---|---|---|---|---|---|
| 1 | `user_id` | `UUID` | NO | — | **PRIMARY KEY**; **FOREIGN KEY** → `auth.users(id)` **ON DELETE CASCADE** (`database/init.sql:8`). A `PRIMARY KEY` column is implicitly `NOT NULL`. |
| 2 | `points` | `INTEGER` | YES | `0` | none (`database/init.sql:9`) |
| 3 | `streak` | `INTEGER` | YES | `0` | none (`database/init.sql:10`) |
| 4 | `best_streak` | `INTEGER` | YES | `0` | none (`database/init.sql:11`) |
| 5 | `updated_at` | `TIMESTAMPTZ` | YES | `now()` | none (`database/init.sql:12`) |

### What each column actually holds

| Column | In practice | Evidence |
|---|---|---|
| `user_id` | The Supabase Auth user id (`auth.users.id`), passed as `user["id"]` from the bearer token. | `backend/api/routes/progress.py:34`, `backend/core/security.py` (`get_current_user`) |
| `points` | The learner's **client-computed** running total, in whole points. The server never adds anything up; it stores what the browser sends. | `backend/api/schemas/progress.py:12`, `backend/services/progress_service.py:66` |
| `streak` | Current streak counter, incremented client-side by `addPoints` on every scored stage. | `frontend/src/state/progressStore.js:170-175` |
| `best_streak` | High-water mark of `streak`, also computed client-side. | `frontend/src/state/progressStore.js:175` |
| `updated_at` | **Misleading name.** Nothing updates it. There is no `CREATE TRIGGER` and no `ON UPDATE` anywhere in `database/init.sql`, and no writer sends the column, so it holds the time the row was first inserted — not the last time the row changed. | absence of `TRIGGER`/`UPDATE` in `database/init.sql`; payload at `backend/services/progress_service.py:63-70` omits it |

> **Integrity finding (documented honestly, not fixed):** `points` is client-authoritative. A learner
> can POST any integer to `/api/progress/save` and it is written verbatim. There is no server-side
> balance, no `CHECK (points >= 0)` and no reconciliation against `score_history.earned_points`. The
> API contract that makes this possible is `backend/api/schemas/progress.py:11-18`. Verified by
> execution: `SaveProgressRequest.model_validate({"progress": {"points": -5, "streak": -1, …}})`
> parses without error, so a negative balance is storable even though the browser's own
> `deductPoints` floors at 0 (`frontend/src/state/progressStore.js:178`).

---

## stage_progress

One row per finished stage. This is the table the lock gates read: the frontend unions the
`stage_idx` values per level to decide which stages are available
(`frontend/src/state/progressStore.js:33-39`).

```sql
CREATE TABLE IF NOT EXISTS stage_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,           -- References Supabase auth.users
  level_id INTEGER NOT NULL,
  stage_idx INTEGER NOT NULL,
  best_score REAL DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, level_id, stage_idx)
);
```

*(`database/init.sql:16-25`, reproduced verbatim.)*

| # | Column | Type | Null? | Default | Constraints |
|---|---|---|---|---|---|
| 1 | `id` | `UUID` | NO | `gen_random_uuid()` | **PRIMARY KEY** (`database/init.sql:17`). Surrogate key — no application code reads it; the repository keys rows on `(user_id, level_id, stage_idx)`. |
| 2 | `user_id` | `UUID` | **NO** | — | **FOREIGN KEY** → `auth.users(id)` **ON DELETE CASCADE** (`database/init.sql:18`) |
| 3 | `level_id` | `INTEGER` | **NO** | — | none — **no FK, no CHECK** (`database/init.sql:19`) |
| 4 | `stage_idx` | `INTEGER` | **NO** | — | none — **no FK, no CHECK** (`database/init.sql:20`) |
| 5 | `best_score` | `REAL` | YES | `0` | none (`database/init.sql:21`) |
| 6 | `completed` | `BOOLEAN` | YES | `FALSE` | none (`database/init.sql:22`) |
| 7 | `completed_at` | `TIMESTAMPTZ` | YES | `now()` | none (`database/init.sql:23`) |
| — | *table* | | | | **UNIQUE (user_id, level_id, stage_idx)** (`database/init.sql:24`) |

### What each column actually holds

| Column | In practice | Evidence |
|---|---|---|
| `level_id` | The **content id** from `content/levels.json`, which is **0-based**: `0` = Tutorial, `1` = Level 1, `2` = Level 2, `3` = Level 3 — Boss. So a Tutorial row is `level_id = 0`. | `content/levels.json`; `frontend/src/config/gameRules.js:82-85` (`TUTORIAL.levelId = 0`) |
| `stage_idx` | The **0-based** index into that level's `puzzles` array. Tutorial has indices 0–3; Levels 1–3 have 0–11. | `backend/services/content_service.py:39-42` |
| `best_score` | The **best total** ever earned on that stage. Raised, never lowered: the background task only upserts when `outcome.total > current_best`. It carries **no range guarantee** — `total` is unclamped, so an unvalidated negative assistance count can push it past 100 (verified: `hintsUsed: -99` → `total 1060.0`), and the column has no `CHECK` constraint to stop it. | `backend/services/progress_service.py:110-122`; `backend/services/scoring_service.py:110-115`; `database/init.sql` |
| `completed` | Always written as `true` by both writers — the row's existence already means "finished". | `backend/services/progress_service.py:82,120` |
| `completed_at` | Set on first insert. A later upsert does not include the column, so it is **not** refreshed by a better score. *(PostgREST upsert updates only the columns present in the payload — documented behaviour, not executed against a live database.)* | payload at `backend/services/progress_service.py:114-122` |

### The UNIQUE constraint is load-bearing

`UNIQUE(user_id, level_id, stage_idx)` at `database/init.sql:24` is not decoration — it is the
conflict target of every stage write. The repository passes exactly those three columns to
PostgREST:

```python
STAGE_CONFLICT_COLUMNS = "user_id,level_id,stage_idx"   # backend/repositories/progress_repository.py:18
...
supabase.table(STAGE_PROGRESS_TABLE).upsert(record).on_conflict(STAGE_CONFLICT_COLUMNS)
                                                        # backend/repositories/progress_repository.py:65-68
```

Drop or rename that constraint and every `upsert_stage_progress` call fails with a PostgREST error,
which the repository converts to `UpstreamError("Progress storage is unavailable", …)`
(`backend/repositories/progress_repository.py:25-26`). The `/api/progress/save` route then returns a
`5xx`, and the background score task swallows the failure (`backend/services/progress_service.py:123-127`),
so a broken constraint degrades silently on the scoring path.

> **No referential integrity on level/stage.** `level_id` and `stage_idx` are bare `INTEGER NOT NULL`
> columns. PostgreSQL cannot check them against anything because the levels live in a JSON file, not
> a table. `POST /api/progress/save` will happily store `level_id = 99`, `stage_idx = -4` for any
> authenticated user (`backend/api/schemas/progress.py:15` accepts any `dict[str, list[int]]`), and
> such a row is invisible to the UI rather than rejected. Verified by execution: a payload with
> `stageProgress: {"99": [-4]}` and `stageScores: {"99:-4": 999.9}` parses cleanly and the writer loop
> at `backend/services/progress_service.py:72-84` would upsert exactly those numbers — no bounds are
> applied on either side.

---

## score_history

An append-only log: one row per scored attempt. `POST /api/score` inserts here in a background task
after the response has been sent (`backend/api/routes/score.py:37-39`), so a logging failure never
breaks gameplay and never surfaces to the learner
(`backend/services/progress_service.py:123-127`).

```sql
CREATE TABLE IF NOT EXISTS score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level_id INTEGER NOT NULL,
  stage_idx INTEGER NOT NULL,
  steps_used INTEGER NOT NULL,
  laws_used TEXT[] NOT NULL,
  hints_used INTEGER NOT NULL,
  efficiency REAL NOT NULL,
  target_law REAL NOT NULL,
  hint_independence REAL NOT NULL,
  total REAL NOT NULL,
  earned_points INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

*(`database/init.sql:28-42`, reproduced verbatim.)*

| # | Column | Type | Null? | Default | Constraints |
|---|---|---|---|---|---|
| 1 | `id` | `UUID` | NO | `gen_random_uuid()` | **PRIMARY KEY** (`database/init.sql:29`) |
| 2 | `user_id` | `UUID` | **NO** | — | **FOREIGN KEY** → `auth.users(id)` **ON DELETE CASCADE** (`database/init.sql:30`) |
| 3 | `level_id` | `INTEGER` | **NO** | — | none (`database/init.sql:31`) |
| 4 | `stage_idx` | `INTEGER` | **NO** | — | none (`database/init.sql:32`) |
| 5 | `steps_used` | `INTEGER` | **NO** | — | none (`database/init.sql:33`) |
| 6 | `laws_used` | `TEXT[]` | **NO** | — | none (`database/init.sql:34`) |
| 7 | `hints_used` | `INTEGER` | **NO** | — | none (`database/init.sql:35`) |
| 8 | `efficiency` | `REAL` | **NO** | — | none (`database/init.sql:36`) |
| 9 | `target_law` | `REAL` | **NO** | — | none (`database/init.sql:37`) |
| 10 | `hint_independence` | `REAL` | **NO** | — | none (`database/init.sql:38`) |
| 11 | `total` | `REAL` | **NO** | — | none (`database/init.sql:39`) |
| 12 | `earned_points` | `INTEGER` | **NO** | — | none (`database/init.sql:40`) |
| 13 | `created_at` | `TIMESTAMPTZ` | YES | `now()` | none (`database/init.sql:41`) |

### What each column actually holds

Every value below is written by one function, `persist_score`
(`backend/services/progress_service.py:87-108`). The mapping from the scorer's output object to the
column names is:

| Column | Value written | Source |
|---|---|---|
| `steps_used` | The step count the client submitted. Not re-derived server-side. | `backend/services/scoring_service.py:60` → `progress_service.py:99` |
| `laws_used` | The law ids as submitted, **including duplicates**, in step order. Stored as a PostgreSQL array. | `backend/services/scoring_service.py:22,61` → `progress_service.py:100` |
| `hints_used` | **Not just hints.** It stores `hints_used + guides_used` as one "assistance" figure — the same number the scorer calls `assistance_used`. A learner who took 0 hints and 1 Guide gets `hints_used = 1`. | `backend/services/scoring_service.py:51`, `progress_service.py:101` |
| `efficiency` | 0–40 component. | `backend/services/scoring_service.py:91-96` |
| `target_law` | 0–30 component. | `backend/services/scoring_service.py:99-107` |
| `hint_independence` | 0–30 component **for non-negative inputs**; unvalidated — a negative `hints_used`/`guides_used` inflates it without limit (verified: `hintsUsed: -99` → `1020.0`). | `backend/services/scoring_service.py:110-115` |
| `total` | Unclamped sum of the three components, rounded to 1 decimal. It is **not** capped at `MAX_SCORE`: `hintsUsed: -99` → `1060.0` (verified). Its only lower floor is 0 — `efficiency` and `hint_independence` clamp there (`backend/services/scoring_service.py:96,112-115`) and `target_law` is a non-negative ratio by construction (`:103-107`). | `backend/services/scoring_service.py:54`; `backend/config/constants.py:12` |
| `earned_points` | The **bonus only** — 0–5 for non-negative inputs, but it scales with the unclamped `total` (verified: `hintsUsed: -99` → `53`). It is *not* the stage payout, which is `STAGE_COMPLETION_XP (10) + earned_points`. | `backend/services/scoring_service.py:55`; `frontend/src/config/gameRules.js:29,32` |
| `created_at` | Time the attempt was logged (response-time + background task). | `database/init.sql:41` |

> **Naming trap for a new contributor:** `hints_used` does not mean "hints". If you write a report
> from this column, you are reporting hints **plus** Guides. The correct name would be
> `assistance_used`. The distortion is real, not theoretical: a Guide costs 20 points *and* folds a
> second deduction into this column (see
> [scoring-and-rewards.md](../06-reference/scoring-and-rewards.md)).
> `docs/ARCHITECTURE.md:278` already notes the same folding.

> **Attempt vs. best.** `score_history` grows on **every** completion, including replays with a worse
> score; `stage_progress.best_score` keeps only the maximum. Analytics questions ("how did the
> learner improve?") read `score_history`; gate questions ("is this stage done?") read
> `stage_progress`.

---

## Constraints in full

Everything the DDL constrains, and everything it deliberately does not.

| Kind | Where | Detail |
|---|---|---|
| `PRIMARY KEY` | `database/init.sql:8,17,29` | `user_progress(user_id)`; `stage_progress(id)`; `score_history(id)`. The two surrogate `id` columns are never read by application code. |
| `FOREIGN KEY` | `database/init.sql:8,18,30` | All three reference `auth.users(id)`. All three are `ON DELETE CASCADE`, so deleting the Supabase Auth user removes every trace of their progress. |
| `UNIQUE` | `database/init.sql:24` | `stage_progress(user_id, level_id, stage_idx)` — the upsert conflict target. |
| `NOT NULL` | `database/init.sql:18,19,20,30-40` | `stage_progress.user_id/level_id/stage_idx`; every `score_history` column except `created_at`. |
| Implicit `NOT NULL` | `database/init.sql:8,17,29` | Primary-key columns. |
| `CHECK` | **nowhere** | Zero `CHECK` constraints: no `points >= 0`, no `stage_idx >= 0`, no `0 <= total <= 100`, no `cardinality(laws_used) >= 0`. Verified with `grep -n "CHECK" database/init.sql` → no match. |
| `DEFAULT` | `database/init.sql:9-12,17,21-23,29,41` | See the per-table tables. `gen_random_uuid()` requires PostgreSQL ≥ 13, where it is built in; the script creates **no extension** (`grep -n "EXTENSION" database/init.sql` → no match), so on an older Postgres this DDL fails. |
| `TRIGGER` | **nowhere** | No audit trigger, no `updated_at` refresher, no user-creation hook. Verified with `grep -n "TRIGGER" database/init.sql` → no match. |
| `GRANT` / `REVOKE` | **nowhere** | Table privileges are left at Supabase defaults; access control is entirely RLS (next section). |

Because there are no `CHECK` constraints, every range rule in this system lives in application code —
`backend/services/scoring_service.py` for scores and `frontend/src/state/progressStore.js:178` for the
points floor (`Math.max(0, p.points - amount)`).

## Indexes in full

```sql
CREATE INDEX IF NOT EXISTS idx_stage_progress_user ON stage_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_score_history_user ON score_history(user_id);
CREATE INDEX IF NOT EXISTS idx_score_history_level ON score_history(user_id, level_id, stage_idx);
```

*(`database/init.sql:45-47`, reproduced verbatim.)*

| Index | Table | Columns | Query it serves | Evidence |
|---|---|---|---|---|
| `idx_stage_progress_user` | `stage_progress` | `(user_id)` | `GET /api/progress` listing every stage row for one learner. | `backend/repositories/progress_repository.py:37-42` |
| `idx_score_history_user` | `score_history` | `(user_id)` | Per-learner history retrieval. **No application query reads `score_history` today** — the column exists for future analytics and for manual inspection. | `grep -rn "score_history" backend --include=*.py` shows only the insert path (`backend/repositories/progress_repository.py:57-59`) |
| `idx_score_history_level` | `score_history` | `(user_id, level_id, stage_idx)` | "Every attempt on this stage by this learner" — filtered history. Also unused by current application code. | same as above |

Implicit indexes created by the DDL itself:

| Implicit index | Table | Reason |
|---|---|---|
| `user_progress_pkey` | `user_progress` | `PRIMARY KEY (user_id)` — also serves the `eq("user_id", …)` lookup at `backend/repositories/progress_repository.py:32`. |
| `stage_progress_pkey` | `stage_progress` | `PRIMARY KEY (id)`. |
| `stage_progress_user_id_level_id_stage_idx_key` | `stage_progress` | The `UNIQUE` constraint — this is the index PostgREST uses for `on_conflict`. |
| `score_history_pkey` | `score_history` | `PRIMARY KEY (id)`. |
| FK indexes | all three | **Not created by PostgreSQL automatically.** `user_progress.user_id` is covered by its PK; `stage_progress.user_id` has `idx_stage_progress_user`; `score_history.user_id` has `idx_score_history_user`. Nothing indexes `auth.users` deletes beyond that, so a cascade delete of a learner scans each table once. |

> There is **no index on `stage_progress(user_id, level_id, stage_idx)` other than the UNIQUE
> constraint** — the same column set, so the unique index also accelerates the stage row lookup at
> `backend/repositories/progress_repository.py:47-53`. Keep the constraint if you ever refactor.

## Row Level Security

RLS is **enabled** on all three tables, and each gets exactly one policy. Here is the entire block,
verbatim:

```sql
-- Enable Row Level Security (permissive for now — tighten when auth RLS is set up)
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;

-- Permissive policies (the backend uses service_role key which bypasses RLS,
-- but these are needed in case the frontend queries Supabase directly)
CREATE POLICY "Service role full access" ON user_progress FOR ALL USING (true);
CREATE POLICY "Service role full access" ON stage_progress FOR ALL USING (true);
CREATE POLICY "Service role full access" ON score_history FOR ALL USING (true);
```

*(`database/init.sql:49-58`, reproduced verbatim.)*

### Exactly who these policies let through

| Property of the policy | Value | Consequence |
|---|---|---|
| `FOR` | `ALL` | Applies to `SELECT`, `INSERT`, `UPDATE` and `DELETE`. |
| `TO` | **absent** | The policy therefore applies to `PUBLIC` — every role in the database, including `anon`, `authenticated` and `service_role`. This is PostgreSQL's documented default for an omitted `TO` clause. |
| `USING (true)` | always true | The row filter passes for **every row of the table**, so all rows are visible to the matched roles. |
| `WITH CHECK` | **absent** | For a `FOR ALL` policy PostgreSQL reuses the `USING` expression as the `WITH CHECK` expression, so **writes are accepted too**. |
| `auth.uid() = user_id` predicate | **absent** | Nothing ties a row to the caller. Verified: `grep -rn "auth.uid" database/ backend/` matches only the word `service_role` inside the comment at `database/init.sql:54` — there is no `auth.uid()`, no `auth.jwt()` and no role check anywhere in the repo. |

**Plain-language summary:** these are *not* per-user policies. They are one blanket "allow
everything" rule per table, and their name — `"Service role full access"` — is aspirational rather
than accurate: the policy does not mention `service_role` at all, so it grants more than the name
suggests. Anyone who can reach PostgREST with *any* valid API key for the project can read and
mutate every learner's rows.

That reachability matters because the frontend ships an anon/publishable key in its bundle by design
(`frontend/src/services/supabaseClient.js:6-10` reads `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`). The frontend currently uses that client for **auth only** — every
call is `supabase.auth.*` (`frontend/src/services/authActions.js:11,21,33`,
`frontend/src/state/AuthProvider.jsx:23,37`), and no application code queries
`/rest/v1/<table>` from the browser.

**Honest limits of this finding — what I could and could not verify:**

| Statement | Status |
|---|---|
| The policies are `FOR ALL USING (true)` with no `TO` and no `auth.uid()` predicate. | **Verified** by reading `database/init.sql:56-58` and grepping for `auth.uid`. |
| Under PostgreSQL semantics a `TO`-less policy applies to all roles, and a `FOR ALL` policy without `WITH CHECK` reuses `USING` for writes. | Documented PostgreSQL behaviour; **not executed here** — no PostgreSQL instance is reachable from this workspace (`which psql` → not found). |
| With the project's anon/publishable key, `/rest/v1/user_progress` is reachable anonymously from the public internet. | > ⚠️ **Unverified** — this depends on the live project's *Exposed schemas* setting in the Supabase API configuration and on the key's exact role. Both live outside the repository. Treat it as the expected consequence of the DDL, and confirm in the Supabase dashboard before quoting it as fact. |
| The e2e suites prove anon access. | **They do not.** `.e2e/_harness.mjs:99-101` and `.e2e/tutorial-gate.mjs:31-32` authenticate with `SUPABASE_SERVICE_KEY`, which bypasses RLS entirely. They prove the *service role* can write, which was never in doubt. |

> **Recommended fix (not applied — `database/init.sql` is the Lead's frozen input, and rewriting a
> deployed schema is a migration, not a doc task):** drop the three `"Service role full access"`
> policies *without* replacement. The backend needs no policy at all, because the service-role key
> bypasses RLS — the header comment at `database/init.sql:54` says so itself. If the frontend ever
> needs direct table access, add per-user policies with `TO authenticated USING (auth.uid() = user_id)
> WITH CHECK (auth.uid() = user_id)` at that point. This is the security finding the register calls
> **D20**; see `docs/_staging/GROUND-TRUTH.md`.

## Who writes these tables

Three write paths exist. Nothing else in the repository writes to Supabase except the read-only
content path (JSON files) and the auth lookup.

| Trigger | Function | Tables touched | When it runs | Evidence |
|---|---|---|---|---|
| `POST /api/progress/save` | `progress_service.save_progress` | `user_progress` upsert + one `stage_progress` upsert per completed stage | On the learner's debounced client push (500 ms after any progress change). | `backend/api/routes/progress.py:26-41`; `backend/services/progress_service.py:53-84`; debounce at `frontend/src/config/gameRules.js:68` |
| `POST /api/score` with a valid bearer token | `progress_service.persist_score` (FastAPI `BackgroundTasks`) | `score_history` insert, then `stage_progress` upsert when the total beats the stored best | After the HTTP response has already been sent. Failures are logged and swallowed. | `backend/api/routes/score.py:37-39`; `backend/services/progress_service.py:87-127` |
| Manual / test tooling | direct PostgREST `DELETE`/`POST` with the service key | all three | Out of band; used to reset the shared e2e learner between runs. | `.e2e/_harness.mjs:97-115`; `.e2e/tutorial-gate.mjs:40-58` |

Reads: `GET /api/progress` calls `progress_repository.get_user_progress_row`
(`backend/repositories/progress_repository.py:29-34`) and `list_stage_progress_rows`
(`backend/repositories/progress_repository.py:37-42`), then merges them in
`progress_service.build_progress` (`backend/services/progress_service.py:25-50`). `score_history` is
never read by the application.

## What is NOT in the database

| Data | Where it actually lives | Why it matters here |
|---|---|---|
| Levels, puzzles, hints, `optimalSteps`, `targetLaws` | `content/levels.json` | No `levels` table exists, so `stage_progress.level_id` / `stage_idx` cannot be foreign keys. |
| Law reference cards | `content/laws.json` (10 laws) | `score_history.laws_used` stores bare law-id strings with no lookup table. |
| Saved derivations (`stageSolutions`) | Browser `localStorage` only | `POST /api/progress/save` structurally **drops** them: the payload model has no such field (`backend/api/schemas/progress.py:11-18`), and Pydantic ignores unknown keys by default. Verified by executing `SaveProgressRequest.model_validate({... "stageSolutions": {...}})` → the parsed model contains only `points, streak, bestStreak, stageProgress, stageScores`. |
| `levelsCompleted` and `hasSeenTutorial` flags | Browser `localStorage`; re-derived on the server-merge path | `build_progress` returns only `points`, `streak`, `bestStreak`, `stageProgress`, `stageScores` (`backend/services/progress_service.py:44-50`), so they are inferred from stage completion, not stored. |
| Star counts | Computed on the fly from `stage_progress.best_score` | No `stars` column; see `frontend/src/state/progressStore.js:281-285`. |
| Auth identities (email, password hash, sessions) | Supabase's `auth` schema, managed by Supabase Auth | The `public` tables only ever hold the `auth.users.id` value. |

That is the whole storage story: 3 tables for a learner's numbers, plus JSON files for the game
itself. The backend is 1,241 lines of Python; it deliberately does not model the game in the
database.

## Known discrepancies

| ID | A document says | The code says | Where this file handles it |
|---|---|---|---|
| **D2** | `docs/context.md:29` — "**Database** … credentials provided, **NOT integrated yet**"; `docs/context.md:30` — "**Auth: None**"; `docs/context.md:220,222` — "Database integration ❌ MISSING", "Supabase client ❌ MISSING" | Fully integrated: three tables written through `backend/repositories/progress_repository.py`, bearer-authenticated routes, Supabase Auth on the frontend. | The whole of this document describes the integrated schema. |
| **D7** | `docs/context.md:85` — `POST /api/score` "**does NOT save to DB**" | It does persist, in a background task, whenever a bearer token is present: `backend/api/routes/score.py:37-39`. | [score_history](#score_history), [Who writes these tables](#who-writes-these-tables) |
| **D20** | the repo-root `README.md:44` tells the newcomer that running `init.sql` will "configure Row Level Security" | RLS is *enabled*, but the only policies are `FOR ALL USING (true)`. That is permissive, not protective. | [Row Level Security](#row-level-security) |
| **D3** | `database/init.sql:4` — "Better Auth tables (user, session, account, verification) are created automatically by `npx auth migrate`" | There is no Better Auth in this repository. The FK target is Supabase's `auth.users` (`database/init.sql:8`), and auth runs through `@supabase/supabase-js` (`frontend/src/services/authActions.js:11`). The header comment is a dead remnant. | [Where the schema lives](#where-the-schema-lives) |

## Applying and verifying the schema

The schema is applied manually, once per Supabase project:

```text
1. Supabase dashboard → SQL Editor → New Query
2. Paste the contents of database/init.sql
3. Run.  Re-running is safe: every statement is IF NOT EXISTS / CREATE OR REPLACE-free idempotent DDL.
```

*(Instruction taken from `database/init.sql:1-3` and the repo-root `README.md:44`.)*

Verification queries a reviewer can run in the same SQL Editor:

```sql
-- 1. Exactly 3 application tables, all RLS-enabled.
select relname, relrowsecurity
from pg_class
where relname in ('user_progress','stage_progress','score_history');

-- 2. Every policy on them: expect one "Service role full access" row per table,
--    with cmd = ALL, roles = {public}, and a USING expression of "true".
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where tablename in ('user_progress','stage_progress','score_history');

-- 3. Every index: expect the 3 explicit ones plus 3 primary keys and 1 unique.
select tablename, indexname, indexdef
from pg_indexes
where tablename in ('user_progress','stage_progress','score_history')
order by tablename, indexname;

-- 4. Confirm there is no trigger that could refresh updated_at / completed_at.
select event_object_table, trigger_name
from information_schema.triggers
where event_object_table in ('user_progress','stage_progress','score_history');
-- Expected: 0 rows.
```

> These four queries were **written by reading the DDL**, not executed — this workspace has no
> PostgreSQL client and no Supabase credentials (`which psql` → not found). They are the checks the
> schema comment claims, expressed so a reviewer can confirm or refute them in one paste.

Cross-references: [ERD.md](ERD.md) for the entity picture and cardinalities;
[scoring-and-rewards.md](../06-reference/scoring-and-rewards.md) for what the numbers in
`score_history` mean.
