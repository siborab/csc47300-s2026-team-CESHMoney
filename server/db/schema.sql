-- SpendWise database schema for Supabase (Postgres)
-- Run this in: Supabase Dashboard -> SQL Editor -> New Query

-- Enable required extension for uuid generation
create extension if not exists "pgcrypto";

-- ---------- USERS ----------
create table if not exists public.users (
  id                        uuid primary key default gen_random_uuid(),
  full_name                 text not null,
  email                     text unique not null,
  password                  text not null,
  role                      text not null default 'user',
  is_active                 boolean not null default true,
  can_manage_subscriptions  boolean not null default true,
  can_export                boolean not null default true,
  created_at                timestamptz not null default now()
);

-- If you ran an earlier version of this schema, add the new permission columns:
alter table public.users add column if not exists is_active                boolean not null default true;
alter table public.users add column if not exists can_manage_subscriptions boolean not null default true;
alter table public.users add column if not exists can_export               boolean not null default true;

-- ---------- SUBSCRIPTIONS (= products in this app) ----------
create table if not exists public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.users(id) on delete cascade,
  name          text not null,
  category      text default 'entertainment',
  price         numeric not null default 0,
  billing_cycle text not null default 'monthly',
  next_billing  date,
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);

-- ---------- EXPENSES ----------
create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.users(id) on delete cascade,
  date          date not null,
  description   text,
  category      text,
  amount        numeric not null,
  type          text not null default 'expense',
  split_count   integer,
  each_amount   numeric,
  created_at    timestamptz not null default now()
);

create index if not exists expenses_user_id_idx on public.expenses(user_id);
create index if not exists expenses_date_idx on public.expenses(date desc);

-- ---------- CATEGORY BUDGETS ----------
create table if not exists public.categories (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid references public.users(id) on delete cascade,
  name      text not null,
  budget    numeric not null default 0,
  unique (user_id, name)
);

-- NOTE: demo admin and demo user are seeded automatically by the Express API
-- server on first start (see server/lib/seed.js). The server uses bcrypt to
-- generate proper password hashes, which is safer than hard-coding them here.
--
-- Default seeded accounts:
--   admin@spendwise.com  / admin123   (role: admin)
--   demo@spendwise.com   / demo123    (role: user)
