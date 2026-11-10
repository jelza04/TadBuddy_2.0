-- TADBuddy v2 schema. Run once in the Supabase SQL Editor.
-- Replaces the single `documents` table from rag-learning with separate,
-- purpose-built tables. The old table is left untouched.

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Identity. If you use Supabase Auth, app_users.id = auth.users.id.
-- ---------------------------------------------------------------------------
create table if not exists app_users (
  id           uuid primary key,
  display_name text,
  created_at   timestamptz not null default now()
);

create table if not exists conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references app_users(id) on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user_idx on conversations (user_id, updated_at desc);

create table if not exists messages (
  id              bigserial primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  safety_flag     text,            -- e.g. 'crisis' when the safety layer intervened
  model           text,            -- which LLM produced an assistant message
  latency_ms      integer,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conv_idx on messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Knowledge base: counseling examples. Context and response stored
-- separately; only `context` is embedded (user messages look like contexts).
-- ---------------------------------------------------------------------------
create table if not exists kb_documents (
  id              bigserial primary key,
  source          text not null,             -- dataset name / version
  context         text not null,
  response        text not null,
  topic           text,
  content_hash    text not null unique,      -- dedup enforced by the DB, not just Python
  embedding       vector(384) not null,
  embedding_model text not null,             -- lets you migrate models safely later
  created_at      timestamptz not null default now()
);
-- HNSW: approximate nearest-neighbour index. Pointless at 200 rows,
-- essential at 100k+. Cheap to have from day one.
create index if not exists kb_documents_embedding_hnsw
  on kb_documents using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Long-term per-user memory. Small per user, so we filter by user_id with a
-- btree index and do an exact distance scan over that user's rows -- more
-- accurate than HNSW + filter, and fast at hundreds of rows per user.
-- ---------------------------------------------------------------------------
create table if not exists user_memories (
  id                bigserial primary key,
  user_id           uuid not null references app_users(id) on delete cascade,
  content           text not null,
  embedding         vector(384) not null,
  embedding_model   text not null,
  importance        smallint not null default 1 check (importance between 1 and 3),
  source_message_id bigint references messages(id) on delete set null,
  times_seen        integer not null default 1,
  created_at        timestamptz not null default now(),
  last_seen_at      timestamptz not null default now()
);
create index if not exists user_memories_user_idx on user_memories (user_id, last_seen_at desc);

-- ---------------------------------------------------------------------------
-- Observability: what was retrieved for every answer. This is how you tune
-- the system -- without it you're guessing.
-- ---------------------------------------------------------------------------
create table if not exists retrieval_logs (
  id            bigserial primary key,
  message_id    bigint references messages(id) on delete cascade,
  kb_ids        bigint[],
  kb_distances  real[],
  memory_ids    bigint[],
  low_confidence boolean not null default false,
  created_at    timestamptz not null default now()
);
