-- Record the outcome of a match atomically. Locks the chosen donors so two concurrent
-- requests cannot both claim the same person.
create function public.record_match(p_request jsonb, p_donors jsonb, p_audit jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_ids uuid[];
  v_locked int;
begin
  select array_agg((d ->> 'donor_id')::uuid) into v_ids from jsonb_array_elements(p_donors) d;
  if v_ids is null or array_length(v_ids, 1) is null then
    raise exception 'no_donors' using errcode = 'P0001';
  end if;

  select count(*) into v_locked from (
    select id from public.donors where id = any (v_ids) and held_by is null for update
  ) s;
  if v_locked <> array_length(v_ids, 1) then
    raise exception 'donor_unavailable' using errcode = 'P0001';
  end if;

  insert into public.blood_requests (code, recipient_group, units, urgency, sector_id, k)
  values (
    'BR-' || nextval('public.blood_request_seq'),
    p_request ->> 'recipient_group',
    (p_request ->> 'units')::int,
    p_request ->> 'urgency',
    p_request ->> 'sector_id',
    (p_request ->> 'k')::int
  )
  returning id into v_id;

  insert into public.request_donors (request_id, donor_id, rank, p, cost)
  select v_id, (d ->> 'donor_id')::uuid, (d ->> 'rank')::int, (d ->> 'p')::numeric, (d ->> 'cost')::numeric
  from jsonb_array_elements(p_donors) d;

  update public.donors
     set held_by = v_id, contacts_last_30d = contacts_last_30d + 1, received_count = received_count + 1
   where id = any (v_ids);

  insert into public.match_audit
    (request_id, algorithm, engine_version, pool_hash, pool_size, eligible_size, front_size, evaluated, shortlisted, objectives)
  values (
    v_id, p_audit ->> 'algorithm', p_audit ->> 'engine_version', p_audit ->> 'pool_hash',
    (p_audit ->> 'pool_size')::int, (p_audit ->> 'eligible_size')::int, (p_audit ->> 'front_size')::int,
    (p_audit ->> 'evaluated')::int, coalesce((p_audit ->> 'shortlisted')::boolean, false), p_audit -> 'objectives'
  );

  return v_id;
end;
$$;

revoke all on function public.record_match(jsonb, jsonb, jsonb) from public;
grant execute on function public.record_match(jsonb, jsonb, jsonb) to anon, authenticated;
