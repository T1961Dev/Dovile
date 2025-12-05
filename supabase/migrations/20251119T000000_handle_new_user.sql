-- Handle new user creation - seed default data
-- Generated on 2025-11-19
-- IMPORTANT: This creates ONLY the 8 default life area bubbles
-- No tasks, no workstreams - users start with a clean slate

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- Insert default settings (only if doesn't exist)
  insert into public.settings (user_id, daily_capacity, timezone, calendar_provider)
  values (new.id, 6, 'Europe/London', 'google')
  on conflict (user_id) do nothing;

  -- Insert default coach config (only if doesn't exist)
  insert into public.coach_configs (user_id, provider, model)
  values (new.id, 'openai', 'gpt-4o-mini')
  on conflict (user_id) do nothing;

  -- Insert ONLY the 8 default life areas (main bubbles)
  -- Using ON CONFLICT to prevent duplicates if trigger runs multiple times
  -- Each user gets exactly ONE of each life area - clean slate
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

  -- DO NOT create any tasks, workstreams, or other items
  -- Users start with a clean slate - only the 8 main life area bubbles

  return new;
end;
$$ language plpgsql security definer;

-- Create trigger on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

