-- Scrape target config — which accounts and hashtags to track
create table if not exists scrape_config (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('account', 'hashtag')),
  target text not null,          -- username (no @) or hashtag (no #)
  active boolean not null default true,
  label text,                    -- optional display name, e.g. "Main competitor"
  created_at timestamptz not null default now()
);

-- Scrape results — raw Apify output stored as JSONB
create table if not exists scrape_results (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('account', 'hashtag')),
  target text not null,
  data jsonb not null default '[]',
  scraped_at timestamptz not null default now()
);

-- Indexes
create index if not exists scrape_config_type_idx on scrape_config(type);
create index if not exists scrape_config_active_idx on scrape_config(active);
create index if not exists scrape_results_target_idx on scrape_results(target);
create index if not exists scrape_results_scraped_at_idx on scrape_results(scraped_at desc);

-- Seed some initial competitor/hashtag targets (edit as needed)
insert into scrape_config (type, target, label) values
  ('account', 'chinawithme',         'Competitor — Arab China creator'),
  ('account', 'arabsinchina',        'Competitor — Arab community'),
  ('hashtag', 'الصين',               'Arabic China hashtag'),
  ('hashtag', 'السياحة_في_الصين',    'Arabic China tourism'),
  ('hashtag', 'chinatravel',         'China travel EN'),
  ('hashtag', 'chinaexplorer',       'China explorer')
on conflict do nothing;
