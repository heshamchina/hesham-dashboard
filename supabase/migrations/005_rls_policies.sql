-- Enable RLS on all tables that need it
alter table agent_tasks      enable row level security;
alter table meeting_sessions enable row level security;
alter table meeting_messages enable row level security;
alter table scrape_config    enable row level security;
alter table scrape_results   enable row level security;
alter table follower_log     enable row level security;

-- ── agent_tasks ────────────────────────────────────────────────
drop policy if exists "anon can read agent_tasks"   on agent_tasks;
drop policy if exists "anon can insert agent_tasks" on agent_tasks;
drop policy if exists "anon can update agent_tasks" on agent_tasks;

create policy "anon can read agent_tasks"
  on agent_tasks for select using (true);

create policy "anon can insert agent_tasks"
  on agent_tasks for insert with check (true);

create policy "anon can update agent_tasks"
  on agent_tasks for update using (true) with check (true);

-- ── meeting_sessions ───────────────────────────────────────────
drop policy if exists "anon can read meeting_sessions"   on meeting_sessions;
drop policy if exists "anon can insert meeting_sessions" on meeting_sessions;

create policy "anon can read meeting_sessions"
  on meeting_sessions for select using (true);

create policy "anon can insert meeting_sessions"
  on meeting_sessions for insert with check (true);

-- ── meeting_messages ───────────────────────────────────────────
drop policy if exists "anon can read meeting_messages"   on meeting_messages;
drop policy if exists "anon can insert meeting_messages" on meeting_messages;

create policy "anon can read meeting_messages"
  on meeting_messages for select using (true);

create policy "anon can insert meeting_messages"
  on meeting_messages for insert with check (true);

-- ── scrape_config ──────────────────────────────────────────────
drop policy if exists "anon can read scrape_config"   on scrape_config;
drop policy if exists "anon can insert scrape_config" on scrape_config;
drop policy if exists "anon can update scrape_config" on scrape_config;
drop policy if exists "anon can delete scrape_config" on scrape_config;

create policy "anon can read scrape_config"
  on scrape_config for select using (true);

create policy "anon can insert scrape_config"
  on scrape_config for insert with check (true);

create policy "anon can update scrape_config"
  on scrape_config for update using (true) with check (true);

create policy "anon can delete scrape_config"
  on scrape_config for delete using (true);

-- ── scrape_results ─────────────────────────────────────────────
drop policy if exists "anon can read scrape_results"   on scrape_results;
drop policy if exists "anon can insert scrape_results" on scrape_results;

create policy "anon can read scrape_results"
  on scrape_results for select using (true);

create policy "anon can insert scrape_results"
  on scrape_results for insert with check (true);

-- ── follower_log ───────────────────────────────────────────────
drop policy if exists "anon can read follower_log"   on follower_log;
drop policy if exists "anon can insert follower_log" on follower_log;

create policy "anon can read follower_log"
  on follower_log for select using (true);

create policy "anon can insert follower_log"
  on follower_log for insert with check (true);
