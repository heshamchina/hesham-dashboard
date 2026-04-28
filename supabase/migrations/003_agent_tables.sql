-- Agent task history
create table if not exists agent_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  agent_name text not null,
  task_type text not null,
  input text,
  output text,
  session_id uuid,
  status text not null default 'done',
  created_at timestamptz not null default now()
);

-- Team meeting sessions
create table if not exists meeting_sessions (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

-- Messages within a meeting session (one row per agent turn)
create table if not exists meeting_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references meeting_sessions(id) on delete cascade,
  agent_id text not null,
  agent_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists agent_tasks_agent_id_idx on agent_tasks(agent_id);
create index if not exists agent_tasks_session_id_idx on agent_tasks(session_id);
create index if not exists meeting_messages_session_id_idx on meeting_messages(session_id);
