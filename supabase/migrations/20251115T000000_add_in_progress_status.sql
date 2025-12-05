-- Add in_progress status support and constraint
-- Only one task can be in_progress at a time per user

-- Add check constraint to ensure status values are valid
alter table items
  drop constraint if exists items_status_check;

alter table items
  add constraint items_status_check
  check (status in ('pending', 'in_progress', 'done', 'archived'));

-- Create function to enforce only one in_progress task per user
create or replace function enforce_single_in_progress()
returns trigger as $$
begin
  -- If setting status to in_progress, set all other in_progress tasks to pending
  if NEW.status = 'in_progress' and (OLD.status is null or OLD.status != 'in_progress') then
    update items
    set status = 'pending'
    where user_id = NEW.user_id
      and id != NEW.id
      and status = 'in_progress'
      and type = 'task';
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

-- Create trigger to enforce single in_progress
drop trigger if exists trg_enforce_single_in_progress on items;
create trigger trg_enforce_single_in_progress
before insert or update on items
for each row
when (NEW.type = 'task' and NEW.status = 'in_progress')
execute function enforce_single_in_progress();

