-- ============================================================================
-- Migration: Payments, Onboarding & Terms Acceptance
-- Date: 2026-02-11
-- Description:
--   1. Adds consent/onboarding columns to `settings`
--   2. Extends `billing_profiles` with subscription metadata
--   3. Creates `payment_events` audit table
--   4. Creates `user_onboarding` table for tracking onboarding steps
--   5. Updates `handle_new_user()` to seed billing_profiles + default consent
--   6. Full RLS policies for all new/modified tables
-- ============================================================================

-- ============================================================================
-- 1. SETTINGS: Add consent and onboarding columns
-- ============================================================================

alter table settings
  add column if not exists accepted_terms_at timestamptz default null,
  add column if not exists accepted_privacy_at timestamptz default null,
  add column if not exists onboarding_completed_at timestamptz default null;

comment on column settings.accepted_terms_at is 'Timestamp when user accepted Terms of Service (GDPR)';
comment on column settings.accepted_privacy_at is 'Timestamp when user accepted Privacy Policy (GDPR)';
comment on column settings.onboarding_completed_at is 'Timestamp when user completed onboarding flow';

-- ============================================================================
-- 2. BILLING_PROFILES: Extend with subscription metadata
-- ============================================================================

alter table billing_profiles
  add column if not exists plan_name text default 'free',
  add column if not exists subscription_id text default null,
  add column if not exists current_period_start timestamptz default null,
  add column if not exists current_period_end timestamptz default null,
  add column if not exists cancel_at_period_end boolean default false,
  add column if not exists trial_end timestamptz default null,
  add column if not exists payment_method_type text default null,
  add column if not exists payment_method_last4 text default null;

comment on column billing_profiles.plan_name is 'Human-readable plan name: free, basic, pro, proplus';
comment on column billing_profiles.subscription_id is 'Stripe subscription ID (sub_xxx)';
comment on column billing_profiles.current_period_start is 'Current billing period start';
comment on column billing_profiles.current_period_end is 'Current billing period end / renewal date';
comment on column billing_profiles.cancel_at_period_end is 'Whether subscription will cancel at period end';
comment on column billing_profiles.trial_end is 'Trial end date if applicable';
comment on column billing_profiles.payment_method_type is 'Payment method type (card, sepa_debit, etc.)';
comment on column billing_profiles.payment_method_last4 is 'Last 4 digits of payment method';

-- ============================================================================
-- 3. PAYMENT_EVENTS: Audit log of all payment-related events
-- ============================================================================

create table if not exists payment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  stripe_event_id text,
  amount_cents int,
  currency text default 'usd',
  status text not null default 'succeeded',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

comment on table payment_events is 'Audit trail for all Stripe payment and subscription lifecycle events';
comment on column payment_events.event_type is 'e.g. checkout.session.completed, invoice.paid, subscription.updated, subscription.deleted';

create index if not exists idx_payment_events_user_id on payment_events(user_id);
create index if not exists idx_payment_events_event_type on payment_events(event_type);
create index if not exists idx_payment_events_stripe_event_id on payment_events(stripe_event_id);

alter table payment_events enable row level security;

drop policy if exists p_select_own_payment_events on payment_events;
create policy p_select_own_payment_events on payment_events
  for select using (auth.uid() = user_id);

drop policy if exists p_insert_payment_events_service on payment_events;
create policy p_insert_payment_events_service on payment_events
  for insert with check (true);

-- ============================================================================
-- 4. USER_ONBOARDING: Track individual onboarding steps
-- ============================================================================

create table if not exists user_onboarding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  step_key text not null,
  completed_at timestamptz default now(),
  metadata jsonb default '{}',
  unique (user_id, step_key)
);

comment on table user_onboarding is 'Tracks completion of individual onboarding steps per user';
comment on column user_onboarding.step_key is 'e.g. welcome_shown, terms_accepted, first_task_created, first_area_rated, profile_completed';

create index if not exists idx_user_onboarding_user_id on user_onboarding(user_id);

alter table user_onboarding enable row level security;

drop policy if exists p_select_own_onboarding on user_onboarding;
create policy p_select_own_onboarding on user_onboarding
  for select using (auth.uid() = user_id);

drop policy if exists p_mod_own_onboarding on user_onboarding;
create policy p_mod_own_onboarding on user_onboarding
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- 5. UPDATE handle_new_user() to seed billing_profiles and defaults
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- Insert default settings with null consent (user must explicitly accept)
  insert into public.settings (
    user_id, daily_capacity, timezone, calendar_provider,
    accepted_terms_at, accepted_privacy_at, onboarding_completed_at
  )
  values (
    new.id, 6, 'Europe/London', 'google',
    null, null, null
  )
  on conflict (user_id) do nothing;

  -- Insert default coach config
  insert into public.coach_configs (user_id, provider, model)
  values (new.id, 'openai', 'gpt-4o-mini')
  on conflict (user_id) do nothing;

  -- Insert free billing profile (every new user starts on free)
  insert into public.billing_profiles (
    user_id, subscription_status, plan_name
  )
  values (new.id, 'free', 'free')
  on conflict (user_id) do nothing;

  -- Insert default life areas
  insert into public.life_areas (user_id, name, color, rating)
  values
    (new.id, 'Home', '#2563EB', 5),
    (new.id, 'Career', '#10B981', 5),
    (new.id, 'Love', '#F97316', 5),
    (new.id, 'Family & Friends', '#6366F1', 5),
    (new.id, 'Leisure', '#EC4899', 5),
    (new.id, 'Finance', '#F59E0B', 5),
    (new.id, 'Health', '#14B8A6', 5),
    (new.id, 'Personal Development', '#8B5CF6', 5)
  on conflict (user_id, name) do nothing;

  -- Track onboarding start
  insert into public.user_onboarding (user_id, step_key, metadata)
  values (new.id, 'account_created', '{}')
  on conflict (user_id, step_key) do nothing;

  return new;
end;
$$ language plpgsql security definer;

-- Recreate trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 6. ENSURE RLS ON ALL TABLES (idempotent)
-- ============================================================================

-- Settings: already has RLS, but ensure consent columns are covered by existing policies
-- (existing p_select_settings and p_mod_settings cover all columns)

-- Billing profiles: already has RLS via p_select_billing and p_mod_billing
-- Add a service-role insert policy for webhook writes
drop policy if exists p_insert_billing_service on billing_profiles;
create policy p_insert_billing_service on billing_profiles
  for insert with check (true);

-- Update billing_profiles trigger to also update plan_name
create or replace function public.handle_billing_profiles_updated()
returns trigger as $$
begin
  NEW.updated_at = now();
  -- Auto-derive plan_name from subscription_status
  if NEW.subscription_status = 'free' or NEW.subscription_status is null then
    NEW.plan_name = 'free';
  elsif NEW.price_id is not null then
    -- Plan name will be set by application layer, keep existing
    null;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- 7. HELPER VIEW: user_subscription_summary (optional, for dashboards)
-- ============================================================================

create or replace view public.user_subscription_summary as
select
  s.user_id,
  s.daily_capacity,
  s.timezone,
  s.accepted_terms_at is not null as has_accepted_terms,
  s.accepted_privacy_at is not null as has_accepted_privacy,
  s.onboarding_completed_at is not null as has_completed_onboarding,
  coalesce(b.subscription_status, 'free') as subscription_status,
  coalesce(b.plan_name, 'free') as plan_name,
  b.price_id,
  b.current_period_end,
  b.cancel_at_period_end,
  (select count(*) from items i where i.user_id = s.user_id and i.status != 'archived') as active_item_count
from settings s
left join billing_profiles b on s.user_id = b.user_id;

-- ============================================================================
-- 8. INDEXES for performance
-- ============================================================================

create index if not exists idx_items_user_status on items(user_id, status);
create index if not exists idx_items_user_scheduled on items(user_id, scheduled_for);
create index if not exists idx_xp_events_user_created on xp_events(user_id, created_at);
create index if not exists idx_workstreams_user_area on workstreams(user_id, life_area_id);

-- ============================================================================
-- DONE
-- ============================================================================
