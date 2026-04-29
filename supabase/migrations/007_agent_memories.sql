create table if not exists agent_memories (
  id            uuid primary key default gen_random_uuid(),
  agent_id      text not null,
  context_type  text not null default 'general' check (context_type in ('general','client')),
  context_id    text,
  role          text not null check (role in ('user','assistant')),
  content       text not null,
  created_at    timestamptz not null default now()
);

create index if not exists agent_memories_agent_context_idx
  on agent_memories (agent_id, context_type, context_id, created_at desc);
