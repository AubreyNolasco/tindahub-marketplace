-- Fix: the CASE expression inside the UPDATE...SET status = (...) statement
-- resolves to text, not campaign_submission_status -- PL/pgSQL only applies
-- the implicit enum cast on plain variable assignment (as used correctly in
-- submit_campaign_product's v_status := case...), not on a CASE expression
-- embedded directly in an UPDATE's SET clause. Explicit cast fixes it.
create or replace function public.review_campaign_submission(p_id uuid, p_approve boolean, p_reason text default null)
returns public.campaign_products
language plpgsql security definer set search_path = public as $$
declare v_result public.campaign_products;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.campaign_products set
    status = (case when p_approve then 'approved' else 'rejected' end)::public.campaign_submission_status,
    rejection_reason = case when p_approve then null else p_reason end,
    reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_id and status = 'pending'
  returning * into v_result;
  if v_result.id is null then raise exception 'SUBMISSION_NOT_PENDING'; end if;
  return v_result;
end;
$$;
revoke all on function public.review_campaign_submission(uuid, boolean, text) from public, anon;
grant execute on function public.review_campaign_submission(uuid, boolean, text) to authenticated;

notify pgrst, 'reload schema';
