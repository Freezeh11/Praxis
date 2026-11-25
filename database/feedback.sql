-- Feedback inbox - the table behind the in-app contact form.
--
-- RLS is deliberately enabled with NO policies: the anon/public key can never
-- read or write this table. Only the FastAPI backend (service_role key) inserts,
-- and only an operator reading the Supabase dashboard can see the messages.
-- Run this once in the Supabase SQL editor (after database/init.sql).

create table if not exists public.feedback (
    id          uuid primary key default gen_random_uuid(),
    -- Null for a report sent while signed out.
    user_id     uuid references auth.users (id) on delete set null,
    -- The address to reply to: the account address when signed in, else what was typed.
    email       text,
    category    text not null default 'other' check (category in ('bug', 'idea', 'other')),
    message     text not null check (char_length(message) between 10 and 2000),
    -- Where the learner was when they opened the form.
    page        text check (page is null or char_length(page) <= 200),
    app_version text check (app_version is null or char_length(app_version) <= 40),
    -- Optional puzzle coordinates that caused the report.
    context     jsonb,
    user_agent  text check (user_agent is null or char_length(user_agent) <= 400),
    status      text not null default 'new' check (status in ('new', 'read', 'done')),
    created_at  timestamptz not null default now()
);

comment on table public.feedback is
    'In-app contact form submissions. Written only by the backend service role.';

-- Newest first is the only listing an operator needs.
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
create index if not exists feedback_status_idx on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;

-- No policies on purpose. Do not add a permissive one: submissions carry an
-- email address, and nothing in the client should ever read them back.
grant all on table public.feedback to service_role;
