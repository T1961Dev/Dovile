-- Extended schema for Life Scope immersive dashboard

create table if not exists visions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  timeframe text not null,
  description text,
  ai_summary text,
  target_date date,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists vision_steps (
  id uuid primary key default gen_random_uuid(),
  vision_id uuid not null references visions(id) on delete cascade,
  bubble_type text not null,
  bubble_payload jsonb not null,
  approved boolean not null default false,
  created_at timestamptz default now(),
  approved_at timestamptz
);

create table if not exists life_area_ratings (
  id uuid primary key default gen_random_uuid(),
  life_area_id uuid not null references life_areas(id) on delete cascade,
  rating smallint not null check (rating between 0 and 10),
  noted_at date not null default current_date,
  note text,
  created_at timestamptz default now()
);

create table if not exists idea_archive (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references items(id) on delete cascade,
  archived_at timestamptz default now(),
  reason text
);

alter table life_areas
  add column if not exists bubble_size numeric,
  add column if not exists bubble_position jsonb,
  add column if not exists vision_text text;

alter table workstreams
  add column if not exists bubble_size numeric,
  add column if not exists bubble_position jsonb,
  add column if not exists vision_id uuid references visions(id);

alter table items
  add column if not exists bubble_size numeric,
  add column if not exists bubble_position jsonb;

create index if not exists idx_items_user_scheduled
  on items (user_id, scheduled_for);

create index if not exists idx_vision_steps_vision
  on vision_steps (vision_id, approved);

create index if not exists idx_life_area_ratings_area
  on life_area_ratings (life_area_id, noted_at desc);

