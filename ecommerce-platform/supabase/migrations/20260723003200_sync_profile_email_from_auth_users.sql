-- profiles.email can end up NULL even though auth.users.email is set. This
-- happens because handle_new_user() only reads NEW.email at the moment
-- auth.users is first inserted (AFTER INSERT trigger) -- if Supabase Auth
-- populates the email on that row via a later statement/transaction rather
-- than in the same INSERT, the trigger has already fired and committed with
-- whatever was there at that instant, and nothing since has corrected it.
--
-- Fix: backfill the profiles that are already out of sync, and add an
-- AFTER UPDATE trigger on auth.users so profiles.email self-heals any time
-- auth.users.email changes, regardless of why the initial insert missed it.

update public.profiles p
set email = lower(u.email), updated_at = now()
from auth.users u
where u.id = p.id
  and p.email is null
  and u.email is not null;

create or replace function public.sync_profile_email_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.email is not null and (old.email is distinct from new.email) then
    update public.profiles
    set email = lower(new.email), updated_at = now()
    where id = new.id
      and email is distinct from lower(new.email);
  end if;
  return new;
end
$$;

drop trigger if exists trg_sync_profile_email on auth.users;
create trigger trg_sync_profile_email
after update on auth.users
for each row execute function public.sync_profile_email_from_auth_user();

revoke all on function public.sync_profile_email_from_auth_user() from public,anon,authenticated;

notify pgrst,'reload schema';
