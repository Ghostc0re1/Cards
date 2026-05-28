create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  username_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_key_format check (username_key ~ '^[a-z0-9_]{3,24}$')
);

create table if not exists public.builds (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled build',
  state_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  shared_at timestamptz
);

create table if not exists public.build_shares (
  id text primary key references public.builds(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled build',
  state_json jsonb not null,
  updated_at timestamptz not null default now(),
  shared_at timestamptz not null default now()
);

alter table public.builds
add column if not exists deleted_at timestamptz;

alter table public.builds
add column if not exists shared_at timestamptz;

alter table public.build_shares
add column if not exists updated_at timestamptz not null default now();

alter table public.build_shares
add column if not exists shared_at timestamptz not null default now();

insert into public.build_shares (id, owner_id, name, state_json, updated_at, shared_at)
select
  builds.id,
  builds.owner_id,
  builds.name,
  builds.state_json,
  coalesce(builds.shared_at, builds.updated_at),
  builds.shared_at
from public.builds
where builds.deleted_at is null
  and builds.shared_at is not null
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.builds enable row level security;
alter table public.build_shares enable row level security;

drop policy if exists "Users can read profiles" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can read profiles"
on public.profiles
for select
to authenticated
using (true);

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read their own builds" on public.builds;
drop policy if exists "Users can read shared builds" on public.builds;
drop policy if exists "Users can insert their own builds" on public.builds;
drop policy if exists "Users can update their own builds" on public.builds;
drop policy if exists "Users can delete their own builds" on public.builds;
drop policy if exists "Users can read shared build snapshots" on public.build_shares;
drop policy if exists "Users can insert their own shared build snapshots" on public.build_shares;
drop policy if exists "Users can update their own shared build snapshots" on public.build_shares;
drop policy if exists "Users can delete their own shared build snapshots" on public.build_shares;

create policy "Users can read their own builds"
on public.builds
for select
to authenticated
using (auth.uid() = owner_id);

create policy "Users can insert their own builds"
on public.builds
for insert
to authenticated
with check (auth.uid() = owner_id);

create policy "Users can update their own builds"
on public.builds
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Users can delete their own builds"
on public.builds
for delete
to authenticated
using (auth.uid() = owner_id);

create policy "Users can read shared build snapshots"
on public.build_shares
for select
to authenticated
using (auth.uid() is not null);

create policy "Users can insert their own shared build snapshots"
on public.build_shares
for insert
to authenticated
with check (auth.uid() = owner_id);

create policy "Users can update their own shared build snapshots"
on public.build_shares
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Users can delete their own shared build snapshots"
on public.build_shares
for delete
to authenticated
using (auth.uid() = owner_id);

create index if not exists builds_owner_updated_idx
on public.builds (owner_id, updated_at desc);

drop index if exists public.builds_shared_idx;

create index if not exists build_shares_shared_idx
on public.build_shares (shared_at desc);

create or replace view public.shared_builds
with (security_invoker = true)
as
select
  build_shares.id,
  build_shares.owner_id,
  profiles.username,
  coalesce(nullif(build_shares.state_json ->> 'title', ''), 'Untitled hero') as hero_name,
  build_shares.name,
  build_shares.state_json,
  build_shares.updated_at,
  build_shares.shared_at
from public.build_shares
join public.profiles on profiles.user_id = build_shares.owner_id;

grant select on public.shared_builds to authenticated;
