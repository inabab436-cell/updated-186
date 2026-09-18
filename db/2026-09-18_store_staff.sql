-- =============================================================================
-- CUPAI — Staff accounts with granular permissions.
-- A store owner invites a person by email; when that person signs in with
-- Google using the same email, their account is linked to the owner's store
-- and they only see what their permissions allow.
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- =============================================================================

create table if not exists public.store_staff (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid references auth.users(id) on delete set null,
  email text not null,
  name text,
  permissions text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending','active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists store_staff_owner_email_idx
  on public.store_staff (owner_user_id, lower(email));
create index if not exists store_staff_member_idx on public.store_staff (member_user_id);
create index if not exists store_staff_email_idx  on public.store_staff (lower(email));

grant select, insert, update, delete on public.store_staff to authenticated;
grant all on public.store_staff to service_role;

alter table public.store_staff enable row level security;

drop policy if exists store_staff_owner on public.store_staff;
create policy store_staff_owner on public.store_staff for all
  to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

drop policy if exists store_staff_self_read on public.store_staff;
create policy store_staff_self_read on public.store_staff for select
  to authenticated using (member_user_id = auth.uid());
