create table if not exists client_records (
  id              text primary key,
  name            text not null,
  contact_info    text not null,
  whatsapp        text,
  industry        text not null default '',
  products_wanted jsonb not null default '[]',
  product_photos  jsonb not null default '[]',
  manager_name    text not null,
  manager_field   text not null,
  status          text not null check (status in ('active','pending','closed')),
  discussion      jsonb not null default '[]',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('client-products', 'client-products', true)
on conflict (id) do nothing;
