-- Write functions now check who is calling. Matching is for recipients; a response comes from the
-- donor it is addressed to; reset only touches the caller's own requests.

create or replace function public.record_match(p_request jsonb, p_donors jsonb, p_audit jsonb)
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
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'recipient') then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  select array_agg((d ->> 'donor_id')::uuid) into v_ids from jsonb_array_elements(p_donors) d;
  if v_ids is null or array_length(v_ids, 1) is null then
    raise exception 'no_donors' using errcode = 'P0001';
  end if;

  select count(*) into v_locked from (
    select id from public.donors where id = any (v_ids) and held_by is null and available for update
  ) s;
  if v_locked <> array_length(v_ids, 1) then
    raise exception 'donor_unavailable' using errcode = 'P0001';
  end if;

  insert into public.blood_requests (code, recipient_group, units, urgency, sector_id, k, requester_id)
  values (
    'BR-' || nextval('public.blood_request_seq'),
    p_request ->> 'recipient_group',
    (p_request ->> 'units')::int,
    p_request ->> 'urgency',
    p_request ->> 'sector_id',
    (p_request ->> 'k')::int,
    auth.uid()
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

create or replace function public.respond_to_request(p_request_donor uuid, p_state text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rd public.request_donors%rowtype;
  v_req public.blood_requests%rowtype;
  v_accepted int;
  v_open int;
  v_own boolean;
  v_claimed boolean;
begin
  if auth.uid() is null then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if p_state not in ('Accepted','Declined') then
    raise exception 'invalid_state' using errcode = 'P0001';
  end if;

  select * into v_rd from public.request_donors where id = p_request_donor for update;
  if not found or v_rd.state <> 'Sent' then
    raise exception 'not_open' using errcode = 'P0001';
  end if;
  select * into v_req from public.blood_requests where id = v_rd.request_id for update;

  -- The donor answers for themselves. A recipient may only simulate an answer for a pool donor
  -- who has no account, so the demo still runs end to end.
  v_own := exists (select 1 from public.donor_accounts where user_id = auth.uid() and donor_id = v_rd.donor_id);
  v_claimed := exists (select 1 from public.donor_accounts where donor_id = v_rd.donor_id);
  if not v_own and not (v_req.requester_id = auth.uid() and not v_claimed) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  update public.request_donors set state = p_state, responded_at = now() where id = v_rd.id;

  if p_state = 'Accepted' then
    update public.donors set accepted_count = accepted_count + 1 where id = v_rd.donor_id;
  else
    update public.donors set held_by = null where id = v_rd.donor_id;
  end if;

  select count(*) into v_accepted from public.request_donors where request_id = v_req.id and state = 'Accepted';
  if v_accepted >= v_req.units then
    update public.donors set held_by = null
     where id in (select donor_id from public.request_donors where request_id = v_req.id and state = 'Sent');
    update public.request_donors set state = 'Stood Down', responded_at = now()
     where request_id = v_req.id and state = 'Sent';
    update public.blood_requests set status = 'Confirmed' where id = v_req.id;
    return 'Confirmed';
  end if;

  select count(*) into v_open from public.request_donors where request_id = v_req.id and state = 'Sent';
  if v_open = 0 then
    update public.blood_requests set status = 'Unfilled' where id = v_req.id;
    return 'Unfilled';
  end if;
  return 'Awaiting response';
end;
$$;

-- Clears the caller's own open requests: they are archived (the audit trail stays) and the donors they
-- held are released. Pool donors get their seeded counters back; donors with accounts keep theirs.
create or replace function public.reset_demo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  update public.donors d
     set held_by = null
   where d.held_by in (select id from public.blood_requests where requester_id = auth.uid());

  update public.donors d
     set accepted_count = base_accepted, received_count = base_received, contacts_last_30d = base_contacts
   where d.id in (
          select rd.donor_id from public.request_donors rd
            join public.blood_requests r on r.id = rd.request_id
           where r.requester_id = auth.uid() and not r.archived)
     and not exists (select 1 from public.donor_accounts da where da.donor_id = d.id);

  update public.blood_requests set archived = true where requester_id = auth.uid() and not archived;
end;
$$;

-- What a donor sees: their own record and the offers addressed to them, with no recipient identity.
create function public.donor_profile()
returns table (code text, blood_group text, sector_id text, last_donation_date date, available boolean,
               accepted_count int, received_count int, on_hold boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select d.code, d.blood_group, d.sector_id, d.last_donation_date, d.available,
         d.accepted_count, d.received_count, d.held_by is not null
    from public.donor_accounts a join public.donors d on d.id = a.donor_id
   where a.user_id = auth.uid();
$$;

create function public.donor_offers()
returns table (request_donor_id uuid, request_code text, recipient_group text, units int, urgency text,
               sector_id text, state text, request_status text, offered_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select rd.id, r.code, r.recipient_group, r.units, r.urgency, r.sector_id, rd.state, r.status, r.created_at
    from public.donor_accounts a
    join public.request_donors rd on rd.donor_id = a.donor_id
    join public.blood_requests r on r.id = rd.request_id
   where a.user_id = auth.uid() and not r.archived
   order by r.created_at desc;
$$;

create function public.set_availability(p_available boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.donors set available = p_available
   where id = (select donor_id from public.donor_accounts where user_id = auth.uid());
  if not found then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.record_match(jsonb, jsonb, jsonb), public.respond_to_request(uuid, text), public.reset_demo(),
  public.donor_profile(), public.donor_offers(), public.set_availability(boolean) from public, anon;
grant execute on function public.record_match(jsonb, jsonb, jsonb), public.respond_to_request(uuid, text), public.reset_demo(),
  public.donor_profile(), public.donor_offers(), public.set_availability(boolean) to authenticated;
