-- toggle_merchant_follow() (20260808000600_merchant_followers.sql) had no
-- notification producer -- a merchant currently has no way to know they
-- got a new follower except manually checking their own store page.
-- public.notifications / create_notification() exist precisely "for
-- events with no natural source row to derive a notification from"
-- (see 20260807000200_campaign_notifications.sql's own comment) --  a
-- follow is exactly that, same as campaign approval/rejection was.
-- Only the follow direction notifies, not unfollow, matching how the
-- other producers only surface positive/actionable events.
create or replace function public.toggle_merchant_follow(p_merchant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_following boolean;
  v_follower_name text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'reseller' then
    raise exception 'Only resellers can follow merchant stores.';
  end if;

  if p_merchant_id = auth.uid() then
    raise exception 'You cannot follow your own store.';
  end if;

  if exists (select 1 from public.merchant_followers where reseller_id = auth.uid() and merchant_id = p_merchant_id) then
    delete from public.merchant_followers where reseller_id = auth.uid() and merchant_id = p_merchant_id;
    v_following := false;
  else
    insert into public.merchant_followers (reseller_id, merchant_id) values (auth.uid(), p_merchant_id);
    v_following := true;

    select full_name into v_follower_name from public.profiles where id = auth.uid();
    perform public.create_notification(
      p_merchant_id, 'follow',
      'New follower',
      format('%s started following your store.', coalesce(v_follower_name, 'A reseller')),
      '/merchant-store/' || p_merchant_id::text,
      jsonb_build_object('reseller_id', auth.uid())
    );
  end if;

  return v_following;
end;
$$;

grant execute on function public.toggle_merchant_follow(uuid) to authenticated;
