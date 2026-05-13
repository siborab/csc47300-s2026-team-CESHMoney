-- Migration: add fine-grained permission flags to users.
-- Safe to re-run; uses `add column if not exists`.
--
-- Apply via Supabase Dashboard -> SQL Editor -> New Query.

alter table public.users
  add column if not exists is_active                boolean not null default true;

alter table public.users
  add column if not exists can_manage_subscriptions boolean not null default true;

alter table public.users
  add column if not exists can_export               boolean not null default true;
