-- Supabase exposes every table in the `public` schema through its auto-generated
-- REST API (PostgREST). Anyone holding your project's anon/publishable key could
-- read these tables unless Row Level Security is on.
--
-- All access goes through the FastAPI backend, which connects as the `postgres`
-- role (bypasses RLS). So: enable RLS and add NO policies -> the public API can
-- read/write nothing, the backend is unaffected.

alter table app_users       enable row level security;
alter table conversations   enable row level security;
alter table messages        enable row level security;
alter table kb_documents    enable row level security;
alter table user_memories   enable row level security;
alter table retrieval_logs  enable row level security;

-- If the frontend ever needs to read data directly via supabase-js, add narrow
-- policies instead of disabling RLS, e.g.:
-- create policy "own memories" on user_memories
--   for select to authenticated using (user_id = auth.uid());
