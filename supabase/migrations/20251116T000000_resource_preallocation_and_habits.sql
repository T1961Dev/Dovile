-- Resource preallocation and habits tracking
-- Generated on 2025-11-16

-- Resource preallocation blocks (sleep, food, exercise, etc.)
create table if not exists resource_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, -- e.g., "Sleep", "Food", "Exercise"
  start_hour int2 not null check (start_hour >= 0 and start_hour < 24),
  duration_hours numeric(4,2) not null check (duration_hours > 0 and duration_hours <= 24),
  color text default '#6b7280',
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, name)
);

-- Habits tracking
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  icon text, -- emoji or icon identifier
  color text default '#0EA8A8',
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Daily habit completions
create table if not exists habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits(id) on delete cascade,
  completed_at date not null default current_date,
  notes text,
  created_at timestamptz default now(),
  unique (habit_id, completed_at)
);

-- Social features: friends/connections
create table if not exists user_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connected_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending', -- pending, accepted, blocked
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, connected_user_id),
  check (user_id != connected_user_id)
);

-- Social features: shared progress visibility
create table if not exists progress_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shared_with_user_id uuid not null references auth.users(id) on delete cascade,
  share_level text not null default 'summary', -- summary, detailed, full
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, shared_with_user_id)
);

-- Leaderboard/competition tracking
create table if not exists competition_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  competition_type text not null, -- daily_xp, weekly_streak, monthly_tasks
  period_start date not null,
  period_end date not null,
  score numeric not null default 0,
  rank int,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, competition_type, period_start)
);

-- Enable RLS
alter table resource_blocks enable row level security;
alter table habits enable row level security;
alter table habit_completions enable row level security;
alter table user_connections enable row level security;
alter table progress_shares enable row level security;
alter table competition_entries enable row level security;

-- RLS Policies for resource_blocks
create policy p_select_own_blocks on resource_blocks
  for select using (auth.uid() = user_id);

create policy p_mod_own_blocks on resource_blocks
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS Policies for habits
create policy p_select_own_habits on habits
  for select using (auth.uid() = user_id);

create policy p_mod_own_habits on habits
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS Policies for habit_completions
create policy p_select_own_completions on habit_completions
  for select using (
    exists (
      select 1 from habits
      where habits.id = habit_completions.habit_id
      and habits.user_id = auth.uid()
    )
  );

create policy p_mod_own_completions on habit_completions
  for all using (
    exists (
      select 1 from habits
      where habits.id = habit_completions.habit_id
      and habits.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from habits
      where habits.id = habit_completions.habit_id
      and habits.user_id = auth.uid()
    )
  );

-- RLS Policies for user_connections
create policy p_select_own_connections on user_connections
  for select using (auth.uid() = user_id or auth.uid() = connected_user_id);

create policy p_mod_own_connections on user_connections
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS Policies for progress_shares
create policy p_select_own_shares on progress_shares
  for select using (auth.uid() = user_id or auth.uid() = shared_with_user_id);

create policy p_mod_own_shares on progress_shares
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS Policies for competition_entries
create policy p_select_competition on competition_entries
  for select using (
    auth.uid() = user_id or
    exists (
      select 1 from progress_shares
      where progress_shares.shared_with_user_id = auth.uid()
      and progress_shares.user_id = competition_entries.user_id
    )
  );

create policy p_mod_own_competition on competition_entries
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Add default resource blocks to settings
alter table settings
  add column if not exists default_resource_blocks jsonb default '[
    {"name": "Sleep", "start_hour": 22, "duration_hours": 8, "color": "#1e40af"},
    {"name": "Food", "start_hour": 8, "duration_hours": 2, "color": "#f59e0b"},
    {"name": "Exercise", "start_hour": 7, "duration_hours": 1, "color": "#10b981"}
  ]'::jsonb;

-- Indexes for performance
create index if not exists idx_resource_blocks_user_active
  on resource_blocks (user_id, active);

create index if not exists idx_habits_user_active
  on habits (user_id, active);

create index if not exists idx_habit_completions_habit_date
  on habit_completions (habit_id, completed_at desc);

create index if not exists idx_user_connections_users
  on user_connections (user_id, connected_user_id, status);

create index if not exists idx_competition_entries_period
  on competition_entries (competition_type, period_start, period_end);

-- Triggers for updated_at
create or replace function handle_resource_blocks_updated()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql security definer;

create trigger trg_resource_blocks_updated
before update on resource_blocks
for each row execute function handle_resource_blocks_updated();

create or replace function handle_habits_updated()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql security definer;

create trigger trg_habits_updated
before update on habits
for each row execute function handle_habits_updated();

create or replace function handle_user_connections_updated()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql security definer;

create trigger trg_user_connections_updated
before update on user_connections
for each row execute function handle_user_connections_updated();

create or replace function handle_progress_shares_updated()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql security definer;

create trigger trg_progress_shares_updated
before update on progress_shares
for each row execute function handle_progress_shares_updated();

create or replace function handle_competition_entries_updated()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql security definer;

create trigger trg_competition_entries_updated
before update on competition_entries
for each row execute function handle_competition_entries_updated();

