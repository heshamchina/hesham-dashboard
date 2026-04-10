-- ============================================================
-- heshamchina-dashboard: Supabase schema
-- Run this in Supabase SQL Editor → New Query
-- ============================================================

CREATE TABLE deals (
  id            TEXT PRIMARY KEY,
  client        TEXT NOT NULL,
  stream        TEXT NOT NULL CHECK (stream IN ('sourcing','itinerary','markets')),
  value         NUMERIC NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  status        TEXT NOT NULL CHECK (status IN ('lead','negotiating','closed','paid')),
  next_action   TEXT NOT NULL DEFAULT '',
  contact_id    TEXT,
  logs          JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  health        TEXT NOT NULL CHECK (health IN ('on-track','at-risk','blocked')),
  progress      INT NOT NULL DEFAULT 0,
  next_action   TEXT NOT NULL DEFAULT '',
  due_date      TEXT,
  vercel_url    TEXT,
  live_url      TEXT,
  tags          JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE follower_log (
  date          TEXT PRIMARY KEY,
  ig            INT NOT NULL DEFAULT 0,
  x             INT NOT NULL DEFAULT 0
);

CREATE TABLE content_ideas (
  id             TEXT PRIMARY KEY,
  series         TEXT NOT NULL,
  hook           TEXT NOT NULL DEFAULT '',
  script         TEXT NOT NULL DEFAULT '',
  vibe           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea','scripted','filmed','edited','posted')),
  notes          TEXT NOT NULL DEFAULT '',
  scheduled_date TEXT,
  views_24h      INT,
  views_7d       INT,
  posted_at      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE daily_focus (
  date          TEXT PRIMARY KEY,
  main_mission  TEXT NOT NULL DEFAULT '',
  checklist     JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE captures (
  id            TEXT PRIMARY KEY,
  text          TEXT NOT NULL,
  processed     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE weekly_goals (
  id            TEXT PRIMARY KEY,
  text          TEXT NOT NULL,
  progress      INT NOT NULL DEFAULT 0,
  week_start    TEXT NOT NULL
);

CREATE TABLE streaks (
  id                 TEXT PRIMARY KEY DEFAULT 'singleton',
  posting_streak     INT NOT NULL DEFAULT 0,
  checkin_streak     INT NOT NULL DEFAULT 0,
  last_posted_date   TEXT NOT NULL DEFAULT '',
  last_checkin_date  TEXT NOT NULL DEFAULT ''
);
INSERT INTO streaks (id) VALUES ('singleton') ON CONFLICT DO NOTHING;

CREATE TABLE affiliate_links (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  url           TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('hotel','flight','train','attraction','other')),
  commission    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE revenue_settings (
  id                 TEXT PRIMARY KEY DEFAULT 'singleton',
  monthly_target     NUMERIC NOT NULL DEFAULT 3000,
  currency           TEXT NOT NULL DEFAULT 'USD',
  stale_alert_days   INT NOT NULL DEFAULT 3
);
INSERT INTO revenue_settings (id) VALUES ('singleton') ON CONFLICT DO NOTHING;

CREATE TABLE contacts (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('client','supplier','collaborator','lead','other')),
  company           TEXT,
  wechat            TEXT,
  whatsapp          TEXT,
  email             TEXT,
  country           TEXT,
  notes             JSONB NOT NULL DEFAULT '[]',
  tags              JSONB NOT NULL DEFAULT '[]',
  last_contacted_at TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE journal_entries (
  id              TEXT PRIMARY KEY,
  date            TEXT NOT NULL UNIQUE,
  wins            TEXT NOT NULL DEFAULT '',
  struggles       TEXT NOT NULL DEFAULT '',
  lessons         TEXT NOT NULL DEFAULT '',
  gratitude       TEXT NOT NULL DEFAULT '',
  tomorrow_focus  TEXT NOT NULL DEFAULT '',
  mood            INT NOT NULL CHECK (mood BETWEEN 1 AND 5)
);

CREATE TABLE expenses (
  id            TEXT PRIMARY KEY,
  description   TEXT NOT NULL,
  amount        NUMERIC NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'USD',
  category      TEXT NOT NULL CHECK (category IN ('travel','tools','marketing','office','food','other')),
  date          TEXT NOT NULL,
  deal_id       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE footage (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  location        TEXT NOT NULL DEFAULT '',
  tag             TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused','scripted','posted')),
  duration        TEXT,
  notes           TEXT,
  thumbnail_url   TEXT,
  film_date       TEXT,
  linked_idea_id  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
