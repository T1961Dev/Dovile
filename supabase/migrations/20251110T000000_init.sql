-- LifeWheel initial schema
-- Generated on 2025-11-10

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists life_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#6b7280',
  rating int2 not null default 5,
  created_at timestamptz default now(),
  unique (user_id, name)
);

create type project_kind as enum ('project','process','habit');

create table if not exists workstreams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  life_area_id uuid not null references life_areas(id) on delete cascade,
  kind project_kind not null,
  title text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz default now()
);

create type item_type as enum ('task','idea');

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  life_area_id uuid not null references life_areas(id) on delete cascade,
  workstream_id uuid references workstreams(id) on delete set null,
  type item_type not null,
  title text not null,
  notes text,
  status text not null default 'pending',
  due_date date,
  scheduled_for date,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  kind text not null,
  amount int not null,
  meta jsonb,
  created_at timestamptz default now()
);

create table if not exists settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_capacity int not null default 6,
  calendar_provider text default 'google',
  timezone text default 'Europe/London'
);

create table if not exists calendar_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text,
  refresh_token text,
  scope text,
  token_type text,
  expiry_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists coach_configs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'openai',
  model text not null default 'gpt-4o-mini',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists billing_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer_id text,
  subscription_status text default 'free',
  price_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table life_areas enable row level security;
alter table workstreams enable row level security;
alter table items enable row level security;
alter table xp_events enable row level security;
alter table settings enable row level security;
alter table calendar_credentials enable row level security;
alter table coach_configs enable row level security;
alter table billing_profiles enable row level security;

drop policy if exists p_select_own on life_areas;
create policy p_select_own on life_areas
  for select using (auth.uid() = user_id);

drop policy if exists p_mod_own on life_areas;
create policy p_mod_own on life_areas
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists p_select_own_ws on workstreams;
create policy p_select_own_ws on workstreams
  for select using (auth.uid() = user_id);

drop policy if exists p_mod_own_ws on workstreams;
create policy p_mod_own_ws on workstreams
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists p_select_own_items on items;
create policy p_select_own_items on items
  for select using (auth.uid() = user_id);

drop policy if exists p_mod_own_items on items;
create policy p_mod_own_items on items
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists p_select_own_xp on xp_events;
create policy p_select_own_xp on xp_events
  for select using (auth.uid() = user_id);

drop policy if exists p_insert_own_xp on xp_events;
create policy p_insert_own_xp on xp_events
  for insert with check (auth.uid() = user_id);

drop policy if exists p_select_settings on settings;
create policy p_select_settings on settings
  for select using (auth.uid() = user_id);

drop policy if exists p_mod_settings on settings;
create policy p_mod_settings on settings
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists p_select_calendar_creds on calendar_credentials;
create policy p_select_calendar_creds on calendar_credentials
  for select using (auth.uid() = user_id);

drop policy if exists p_mod_calendar_creds on calendar_credentials;
create policy p_mod_calendar_creds on calendar_credentials
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists p_select_coach_configs on coach_configs;
create policy p_select_coach_configs on coach_configs
  for select using (auth.uid() = user_id);

drop policy if exists p_mod_coach_configs on coach_configs;
create policy p_mod_coach_configs on coach_configs
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists p_select_billing on billing_profiles;
create policy p_select_billing on billing_profiles
  for select using (auth.uid() = user_id);

drop policy if exists p_mod_billing on billing_profiles;
create policy p_mod_billing on billing_profiles
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_calendar_credentials_updated()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql security definer;

create or replace trigger trg_calendar_credentials_updated
before update on calendar_credentials
for each row execute function handle_calendar_credentials_updated();

create or replace function public.handle_coach_configs_updated()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql security definer;

create or replace trigger trg_coach_configs_updated
before update on coach_configs
for each row execute function handle_coach_configs_updated();

create or replace function public.handle_billing_profiles_updated()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql security definer;

create or replace trigger trg_billing_profiles_updated
before update on billing_profiles
for each row execute function handle_billing_profiles_updated();

