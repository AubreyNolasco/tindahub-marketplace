-- Same class of gap as the follow/chat/review notification fixes
-- earlier today: review_reseller_id_verification() (20260729000100)
-- updates id_verification_status but a reseller had no way to know
-- their ID was approved or rejected short of manually revisiting
-- /verify-id. Row-count guarded so a call that matches no pending row
-- (already reviewed, wrong id, wrong role) stays a silent no-op, same
-- as before -- only a real status change notifies.
create or replace function public.review_reseller_id_verification(p_user_id uuid, p_approved boolean, p_notes text default ''::text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_updated int;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.profiles set
    id_verification_status = case when p_approved then 'approved' else 'rejected' end,
    id_verification_notes = left(trim(coalesce(p_notes, '')), 500),
    id_verification_reviewed_at = now(),
    id_verification_reviewed_by = auth.uid()
  where id = p_user_id and role = 'reseller' and id_verification_status = 'pending';
  get diagnostics v_updated = row_count;

  if v_updated > 0 then
    perform public.create_notification(
      p_user_id, 'id_verification',
      case when p_approved then 'ID verification approved' else 'ID verification needs another look' end,
      case when p_approved then 'Your identity verification was approved. You can now use your reseller account fully.' else coalesce(nullif(trim(p_notes), ''), 'Your submitted ID could not be verified. Please resubmit.') end,
      '/verify-id',
      jsonb_build_object('approved', p_approved)
    );
  end if;
end; $function$;
