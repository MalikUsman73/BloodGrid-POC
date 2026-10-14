-- Requests belong to the recipient who raised them. The public key no longer reads any person-linked
-- table: recipients read their own requests and the donor pool they match against; donors read only
-- their own offers, through the functions in the next migration.

alter table public.blood_requests add column requester_id uuid references auth.users (id);
update public.blood_requests set archived = true where requester_id is null;

alter policy "demo read" on public.blood_requests to authenticated using (requester_id = auth.uid());

alter policy "demo read" on public.request_donors to authenticated using (
  exists (select 1 from public.blood_requests r where r.id = request_id and r.requester_id = auth.uid())
);

alter policy "demo read" on public.match_audit to authenticated using (
  exists (select 1 from public.blood_requests r where r.id = request_id and r.requester_id = auth.uid())
);

alter policy "demo read" on public.donors to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'recipient')
);

revoke select on public.blood_requests, public.request_donors, public.match_audit, public.donors from anon;
