-- Run subscription pausing and protected delivery completion hourly when pg_cron is available.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('order-case-evidence','order-case-evidence',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists order_case_evidence_upload on storage.objects;
create policy order_case_evidence_upload on storage.objects for insert to authenticated with check(bucket_id='order-case-evidence' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists order_case_evidence_read on storage.objects;
create policy order_case_evidence_read on storage.objects for select to authenticated using(bucket_id='order-case-evidence' and (public.is_admin() or (storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.orders o where o.id::text=(storage.foldername(name))[2] and auth.uid() in(o.reseller_id,o.merchant_id))));

do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    execute 'select cron.unschedule(jobid) from cron.job where jobname=''jom-hub-operational-maintenance''';
    execute $schedule$select cron.schedule('jom-hub-operational-maintenance','15 * * * *','select public.run_operational_maintenance();')$schedule$;
  end if;
end $$;
