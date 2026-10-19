-- Functions for the verified request pipeline. They mirror src/workflow and src/data/localRepository.ts,
-- and re-check every rule on the server so a modified browser cannot skip one.

-- ---------- shared rules ----------

create function public.is_compatible(p_recipient text, p_donor text) returns boolean
language sql immutable set search_path = '' as $$
  select p_donor = any (case p_recipient
    when 'O-'  then array['O-']
    when 'O+'  then array['O-','O+']
    when 'A-'  then array['O-','A-']
    when 'A+'  then array['O-','O+','A-','A+']
    when 'B-'  then array['O-','B-']
    when 'B+'  then array['O-','O+','B-','B+']
    when 'AB-' then array['O-','A-','B-','AB-']
    when 'AB+' then array['O-','O+','A-','A+','B-','B+','AB-','AB+']
    else array[]::text[] end);
$$;

create function public.response_minutes(p_urgency text) returns int
language sql immutable set search_path = '' as $$
  select case p_urgency when 'Critical' then 30 when 'Urgent' then 120 else 720 end;
$$;

create function public.max_rounds(p_urgency text) returns int
language sql immutable set search_path = '' as $$
  select case p_urgency when 'Routine' then 2 else 3 end;
$$;

-- Distance between sector centres, as in src/data/sectors.ts: at least 0.5 km, one decimal.
create function public.sector_km(p_from text, p_to text) returns numeric
language sql stable security definer set search_path = '' as $$
  select greatest(0.5, round((2 * 6371 * asin(sqrt(
           power(sin(radians(b.lat - a.lat) / 2), 2)
           + cos(radians(a.lat)) * cos(radians(b.lat)) * power(sin(radians(b.lng - a.lng) / 2), 2))))::numeric, 1))
    from public.sectors a, public.sectors b
   where a.id = p_from and b.id = p_to;
$$;

create function public.contacts_30(p_donor uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.donor_contacts where donor_id = p_donor and contacted_at > now() - interval '30 days';
$$;

-- Work out a request's status from its donor rows. Internal.
create function public.refresh_request(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  r public.blood_requests%rowtype;
  v_covered int;
  v_sent int;
begin
  select * into r from public.blood_requests where id = p_id for update;
  if r.status = 'Cancelled' then
    return r.status;
  end if;

  select count(*) filter (where state in ('Accepted','Donated')), count(*) filter (where state = 'Sent')
    into v_covered, v_sent
    from public.request_donors where request_id = p_id;

  if v_covered >= r.units then
    update public.donors set held_by = null
     where held_by = p_id and id in (select donor_id from public.request_donors where request_id = p_id and state = 'Sent');
    update public.request_donors set state = 'Stood Down', responded_at = now() where request_id = p_id and state = 'Sent';
    update public.blood_requests
       set status = 'Confirmed', confirmed_at = case when status = 'Confirmed' then confirmed_at else now() end
     where id = p_id;
    return 'Confirmed';
  end if;

  update public.blood_requests
     set confirmed_at = null,
         status = case when r.round = 0 or v_sent > 0 then 'Awaiting response' else 'Unfilled' end
   where id = p_id
  returning status into r.status;
  return r.status;
end;
$$;

-- Close a request: stand down its donors and release them. Internal.
create function public.close_request(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.request_donors set state = 'Stood Down', responded_at = now()
   where request_id = p_id and state in ('Sent','Accepted');
  update public.donors set held_by = null where held_by = p_id;
  update public.blood_requests set status = 'Cancelled' where id = p_id;
end;
$$;

-- Lapse unanswered offers and release donors held too long after confirmation. Called before reads.
create function public.sweep() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_req uuid;
begin
  for v_req in
    with lapsed as (
      update public.request_donors rd set state = 'Expired', responded_at = now()
        from public.blood_requests r
       where rd.request_id = r.id and rd.state = 'Sent'
         and rd.sent_at + make_interval(mins => public.response_minutes(r.urgency)) <= now()
      returning rd.request_id, rd.donor_id
    ), freed as (
      update public.donors d set held_by = null from lapsed l where d.id = l.donor_id and d.held_by = l.request_id
      returning d.id
    )
    select distinct request_id from lapsed
  loop
    perform public.refresh_request(v_req);
  end loop;

  update public.donors d set held_by = null
    from public.blood_requests r
   where d.held_by = r.id and r.status = 'Confirmed' and r.confirmed_at + interval '72 hours' <= now();
end;
$$;

-- ---------- recipients ----------

create function public.save_patient(p jsonb) returns public.patients
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.patients;
  v_mr text := upper(btrim(coalesce(p ->> 'mr_number', '')));
  v_name text := btrim(coalesce(p ->> 'full_name', ''));
  v_year int;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'recipient') then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  begin
    v_year := (p ->> 'birth_year')::int;
  exception when others then
    raise exception 'invalid:birthYear:Enter a valid year of birth.' using errcode = 'P0001';
  end;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'invalid:patientName:Enter the patient''s full name.' using errcode = 'P0001';
  end if;
  if v_mr !~ '^[A-Z0-9][A-Z0-9-]{3,19}$' then
    raise exception 'invalid:mrNumber:Enter the hospital record number, 4 to 20 letters, digits or dashes.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.hospitals where id = p ->> 'hospital_id') then
    raise exception 'invalid:hospitalId:Choose the hospital treating the patient.' using errcode = 'P0001';
  end if;
  if coalesce(p ->> 'blood_group', '') not in ('O-','O+','A-','A+','B-','B+','AB-','AB+') then
    raise exception 'invalid:patientGroup:Choose the patient''s blood group.' using errcode = 'P0001';
  end if;
  if v_year is null or v_year not between extract(year from now())::int - 120 and extract(year from now())::int then
    raise exception 'invalid:birthYear:Enter a valid year of birth.' using errcode = 'P0001';
  end if;

  insert into public.patients (owner_id, full_name, mr_number, hospital_id, blood_group, birth_year)
  values (auth.uid(), v_name, v_mr, p ->> 'hospital_id', p ->> 'blood_group', v_year)
  on conflict (owner_id, hospital_id, mr_number)
  do update set full_name = excluded.full_name, blood_group = excluded.blood_group, birth_year = excluded.birth_year
  returning * into v_row;
  return v_row;
end;
$$;

-- Validate the request, look for signs of fraud, decide, and save. Mirrors src/workflow/verification.ts.
create function public.submit_request(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pt public.patients%rowtype;
  v_rx jsonb := p -> 'prescription';
  v_units int;
  v_urgency text := p ->> 'urgency';
  v_issued date;
  v_age int;
  v_prescribed int;
  v_pmdc text := upper(btrim(coalesce(v_rx ->> 'pmdc_number', '')));
  v_hash text := v_rx ->> 'file_hash';
  v_path text := v_rx ->> 'file_path';
  v_doctor public.doctors%rowtype;
  v_flags jsonb := '[]';
  v_uses int;
  v_groups text;
  v_recent int;
  v_decision text;
  v_sector text;
  v_id uuid;
  v_code text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'recipient') then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  select * into v_pt from public.patients where id = (p ->> 'patient_id')::uuid and owner_id = auth.uid();
  if not found then
    raise exception 'invalid:patientName:Choose one of your patients.' using errcode = 'P0001';
  end if;
  begin
    v_units := (p ->> 'units')::int;
    v_prescribed := (v_rx ->> 'units_prescribed')::int;
    v_issued := (v_rx ->> 'issued_on')::date;
  exception when others then
    raise exception 'invalid:issuedOn:Check the prescription date and units.' using errcode = 'P0001';
  end;
  if v_urgency not in ('Routine','Urgent','Critical') then
    raise exception 'invalid:units:Choose the urgency.' using errcode = 'P0001';
  end if;

  -- Blocking checks.
  if char_length(btrim(coalesce(v_rx ->> 'doctor_name', ''))) < 3 then
    raise exception 'invalid:doctorName:Enter the prescribing doctor''s name.' using errcode = 'P0001';
  end if;
  if v_pmdc !~ '^\d{4,6}-[A-Z]$' then
    raise exception 'invalid:pmdcNumber:Enter the PMDC registration number, like 12345-P.' using errcode = 'P0001';
  end if;
  if v_issued is null then
    raise exception 'invalid:issuedOn:Enter the date on the prescription.' using errcode = 'P0001';
  end if;
  v_age := current_date - v_issued;
  if v_age < 0 then
    raise exception 'invalid:issuedOn:The prescription date cannot be in the future.' using errcode = 'P0001';
  end if;
  if v_age > 30 then
    raise exception 'invalid:issuedOn:The prescription is older than 30 days. Ask the doctor for a current one.' using errcode = 'P0001';
  end if;
  if v_rx ->> 'blood_group' is distinct from v_pt.blood_group then
    raise exception 'invalid:prescriptionGroup:The prescription blood group does not match the patient record.' using errcode = 'P0001';
  end if;
  if v_prescribed is null or v_prescribed not between 1 and 10 then
    raise exception 'invalid:unitsPrescribed:Enter the units prescribed, 1 to 10.' using errcode = 'P0001';
  end if;
  if v_units is null or v_units not between 1 and 4 then
    raise exception 'invalid:units:Request 1 to 4 units.' using errcode = 'P0001';
  end if;
  if v_units > v_prescribed then
    raise exception 'invalid:units:You cannot request more units than the prescription allows.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.hospitals where id = v_rx ->> 'hospital_id') then
    raise exception 'invalid:hospitalId:Choose the hospital on the prescription.' using errcode = 'P0001';
  end if;
  if coalesce(v_rx ->> 'file_type', '') not in ('application/pdf','image/jpeg','image/png')
     or coalesce((v_rx ->> 'file_size')::int, 0) not between 1 and 5242880
     or coalesce(v_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid:document:Attach a PDF, JPG or PNG file of up to 5 MB.' using errcode = 'P0001';
  end if;
  -- The file must really be in storage, in the caller's own folder.
  if v_path is null or split_part(v_path, '/', 1) <> auth.uid()::text
     or not exists (select 1 from storage.objects where bucket_id = 'prescriptions' and name = v_path) then
    raise exception 'invalid:document:The prescription file was not uploaded. Attach it again.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.blood_requests
              where patient_id = v_pt.id and not archived and status in ('Awaiting response','Unfilled')) then
    raise exception 'invalid:duplicate:This patient already has an open request. Follow that one, or cancel it before raising another.' using errcode = 'P0001';
  end if;

  -- Fraud and misuse flags.
  -- A follow-up by the same account for the same patient is not reuse.
  select count(*) into v_uses
    from public.prescriptions pr join public.blood_requests br on br.id = pr.request_id
   where pr.file_hash = v_hash and (br.requester_id <> auth.uid() or br.patient_id <> v_pt.id);
  if v_uses > 0 then
    v_flags := v_flags || jsonb_build_object('code', 'document-reused', 'severity', 'high',
      'message', format('The same prescription file was already used on %s other %s.', v_uses, case when v_uses = 1 then 'request' else 'requests' end));
  end if;
  select string_agg(distinct blood_group, ', ') into v_groups
    from public.patients where hospital_id = v_pt.hospital_id and mr_number = v_pt.mr_number and blood_group <> v_pt.blood_group;
  if v_groups is not null then
    v_flags := v_flags || jsonb_build_object('code', 'patient-group-conflict', 'severity', 'high',
      'message', format('This hospital record number was registered before with blood group %s.', v_groups));
  end if;
  if (select flagged from public.profiles where id = auth.uid()) then
    v_flags := v_flags || jsonb_build_object('code', 'account-flagged', 'severity', 'high',
      'message', 'Several donors reported this account''s earlier requests for fraud or payment demands.');
  end if;
  select count(*) into v_recent from public.blood_requests where requester_id = auth.uid() and created_at > now() - interval '24 hours';
  if v_recent >= 3 then
    v_flags := v_flags || jsonb_build_object('code', 'request-burst', 'severity', 'medium',
      'message', format('This account raised %s requests in the last 24 hours.', v_recent));
  end if;
  if v_age > 7 then
    v_flags := v_flags || jsonb_build_object('code', 'stale-prescription', 'severity', 'medium',
      'message', format('The prescription is %s days old.', v_age));
  end if;
  select * into v_doctor from public.doctors where pmdc = v_pmdc;
  if not found then
    v_flags := v_flags || jsonb_build_object('code', 'unregistered-doctor', 'severity', 'medium',
      'message', format('PMDC number %s is not in the doctor registry.', v_pmdc));
  elsif v_doctor.hospital_id <> v_rx ->> 'hospital_id' then
    v_flags := v_flags || jsonb_build_object('code', 'doctor-elsewhere', 'severity', 'low',
      'message', format('%s is registered at another hospital.', v_doctor.name));
  end if;
  if v_rx ->> 'hospital_id' <> v_pt.hospital_id then
    v_flags := v_flags || jsonb_build_object('code', 'hospital-mismatch', 'severity', 'medium',
      'message', 'The prescription is from a different hospital than the patient record.');
  end if;
  if v_units >= 3 and v_urgency = 'Routine' then
    v_flags := v_flags || jsonb_build_object('code', 'many-units', 'severity', 'low',
      'message', format('%s units for a routine request is unusual.', v_units));
  end if;

  -- Rejected on any high flag, or three medium ones together; one or two medium flags go ahead as Unverified.
  v_decision := case
    when exists (select 1 from jsonb_array_elements(v_flags) f where f ->> 'severity' = 'high') then 'Rejected'
    when (select count(*) from jsonb_array_elements(v_flags) f where f ->> 'severity' = 'medium') >= 3 then 'Rejected'
    when exists (select 1 from jsonb_array_elements(v_flags) f where f ->> 'severity' = 'medium') then 'Unverified'
    else 'Verified' end;
  if v_decision = 'Rejected' then
    raise exception 'refused:%', v_flags::text using errcode = 'P0001';
  end if;

  select sector_id into v_sector from public.hospitals where id = v_pt.hospital_id;
  v_code := 'BR-' || nextval('public.blood_request_seq');
  insert into public.blood_requests
    (code, recipient_group, units, urgency, sector_id, k, requester_id, patient_id, hospital_id, verification, flags, round, status)
  values
    (v_code, v_pt.blood_group, v_units, v_urgency, v_sector, 0, auth.uid(), v_pt.id, v_pt.hospital_id, v_decision, v_flags, 0,
     'Awaiting response')
  returning id into v_id;

  insert into public.prescriptions
    (request_id, doctor_name, pmdc_number, hospital_id, issued_on, blood_group, units_prescribed, diagnosis,
     file_path, file_name, file_type, file_size, file_hash)
  values
    (v_id, btrim(v_rx ->> 'doctor_name'), v_pmdc, v_rx ->> 'hospital_id', v_issued, v_rx ->> 'blood_group', v_prescribed,
     left(btrim(coalesce(v_rx ->> 'diagnosis', '')), 200), v_path, left(coalesce(v_rx ->> 'file_name', 'prescription'), 120),
     v_rx ->> 'file_type', (v_rx ->> 'file_size')::int, v_hash);

  return jsonb_build_object('id', v_id, 'verification', v_decision, 'flags', v_flags);
end;
$$;

-- The donor pool as matching sees it, with rolling contact counts and who holds each donor.
create function public.donor_pool()
returns table (id uuid, code text, blood_group text, sector_id text, last_donation_date date, available boolean,
               accepted_count int, received_count int, contacts_30 int, held_by uuid, held_urgency text, held_accepted boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where profiles.id = auth.uid() and role = 'recipient') then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  return query
    select d.id, d.code, d.blood_group, d.sector_id, d.last_donation_date, d.available, d.accepted_count, d.received_count,
           public.contacts_30(d.id), d.held_by, r.urgency,
           coalesce((select rd.state = 'Accepted' from public.request_donors rd where rd.request_id = d.held_by and rd.donor_id = d.id), false)
      from public.donors d left join public.blood_requests r on r.id = d.held_by
     order by d.code;
end;
$$;

-- One matching round: the donors to notify. Every hard rule is checked again here.
create function public.record_round(p_request uuid, p_donors jsonb, p_audit jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  r public.blood_requests%rowtype;
  v_round int;
  v_need int;
  v_k int;
  v_ids uuid[];
  v_radius numeric;
  v_bad int;
  v_other uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'recipient') then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  select * into r from public.blood_requests where id = p_request and requester_id = auth.uid() and not archived for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if not (r.status = 'Unfilled' or (r.status = 'Awaiting response' and r.round = 0)) then
    raise exception 'not_ready' using errcode = 'P0001';
  end if;
  v_round := r.round + 1;
  if v_round > public.max_rounds(r.urgency) then
    raise exception 'no_rounds_left' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_donors, '[]')) = 0 then
    raise exception 'nothing_to_send' using errcode = 'P0001';
  end if;

  select r.units - count(*) filter (where state in ('Accepted','Donated')) into v_need from public.request_donors where request_id = r.id;

  select array_agg((d ->> 'donor_id')::uuid) into v_ids from jsonb_array_elements(p_donors) d;
  v_k := ceil(round((case r.urgency when 'Routine' then 1.3 when 'Urgent' then 1.6 else 2.0 end) * greatest(1, v_need), 6));
  if array_length(v_ids, 1) > v_k then
    raise exception 'too_many_donors' using errcode = 'P0001';
  end if;
  v_radius := greatest(15, (array[15, 25, 40])[least(v_round, public.max_rounds(r.urgency))]);

  perform 1 from public.donors where id = any (v_ids) for update;
  select count(*) into v_bad
    from unnest(v_ids) as want(id)
    left join public.donors d on d.id = want.id
   where d.id is null
      or not public.is_compatible(r.recipient_group, d.blood_group)
      or not d.available
      or d.last_donation_date > current_date - 90
      or public.sector_km(d.sector_id, r.sector_id) > v_radius
      or public.contacts_30(d.id) >= 3
      or exists (select 1 from public.request_donors x where x.request_id = r.id and x.donor_id = d.id)
      or (d.held_by is not null and not (
            r.urgency = 'Critical'
            and d.held_by <> r.id
            and exists (select 1 from public.blood_requests h where h.id = d.held_by and h.urgency <> 'Critical')
            and exists (select 1 from public.request_donors x where x.request_id = d.held_by and x.donor_id = d.id and x.state = 'Sent')));
  if v_bad > 0 or (select count(distinct x) from unnest(v_ids) x) <> array_length(v_ids, 1) then
    raise exception 'donor_unavailable' using errcode = 'P0001';
  end if;

  -- Conflicts: a critical request takes donors a less urgent request was still waiting on.
  for v_other in
    update public.request_donors set state = 'Reassigned', responded_at = now()
     where donor_id = any (v_ids) and state = 'Sent' and request_id <> r.id
    returning request_id
  loop
    perform public.refresh_request(v_other);
  end loop;

  insert into public.request_donors (request_id, donor_id, rank, p, cost, round, sent_at)
  select r.id, (d ->> 'donor_id')::uuid, (d ->> 'rank')::int, (d ->> 'p')::numeric, (d ->> 'cost')::numeric, v_round, now()
    from jsonb_array_elements(p_donors) d;
  update public.donors set held_by = r.id, received_count = received_count + 1, contacts_last_30d = contacts_last_30d + 1
   where id = any (v_ids);
  insert into public.donor_contacts (donor_id, request_id) select x, r.id from unnest(v_ids) x;

  update public.blood_requests set round = v_round, k = k + array_length(v_ids, 1) where id = r.id;

  insert into public.match_audit
    (request_id, algorithm, engine_version, pool_hash, pool_size, eligible_size, front_size, evaluated, shortlisted, objectives)
  values (
    r.id, p_audit ->> 'algorithm', p_audit ->> 'engine_version', p_audit ->> 'pool_hash',
    (p_audit ->> 'pool_size')::int, (p_audit ->> 'eligible_size')::int, (p_audit ->> 'front_size')::int,
    (p_audit ->> 'evaluated')::int, coalesce((p_audit ->> 'shortlisted')::boolean, false), p_audit -> 'objectives'
  );

  return public.refresh_request(r.id);
end;
$$;

-- A donor accepts or declines (or a recipient simulates it for a pool donor with no account).
create or replace function public.respond_to_request(p_request_donor uuid, p_state text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rd public.request_donors%rowtype;
  v_req public.blood_requests%rowtype;
  v_own boolean;
  v_claimed boolean;
begin
  if auth.uid() is null then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if p_state not in ('Accepted','Declined') then
    raise exception 'invalid_state' using errcode = 'P0001';
  end if;
  perform public.sweep();

  select * into v_rd from public.request_donors where id = p_request_donor for update;
  if not found or v_rd.state <> 'Sent' then
    raise exception 'not_open' using errcode = 'P0001';
  end if;
  select * into v_req from public.blood_requests where id = v_rd.request_id for update;
  if v_req.status <> 'Awaiting response' then
    raise exception 'not_open' using errcode = 'P0001';
  end if;

  v_own := exists (select 1 from public.donor_accounts where user_id = auth.uid() and donor_id = v_rd.donor_id);
  v_claimed := exists (select 1 from public.donor_accounts where donor_id = v_rd.donor_id);
  if not v_own and not (v_req.requester_id = auth.uid() and not v_claimed) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  update public.request_donors set state = p_state, responded_at = now() where id = v_rd.id;
  if p_state = 'Accepted' then
    update public.donors set accepted_count = accepted_count + 1 where id = v_rd.donor_id;
  else
    update public.donors set held_by = null where id = v_rd.donor_id and held_by = v_req.id;
  end if;
  return public.refresh_request(v_req.id);
end;
$$;

create function public.cancel_request(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.blood_requests%rowtype;
begin
  select * into r from public.blood_requests where id = p_id and requester_id = auth.uid() and not archived for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if r.status = 'Cancelled' then
    raise exception 'already_closed' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.request_donors where request_id = p_id and state = 'Donated') then
    raise exception 'already_donated' using errcode = 'P0001';
  end if;
  perform public.close_request(p_id);
end;
$$;

-- Clears the caller's own requests: open ones are cancelled (releasing donors), all are archived.
-- Pool donors get their seeded counters back; donors with accounts keep theirs.
create or replace function public.reset_demo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  for v_id in
    select id from public.blood_requests
     where requester_id = auth.uid() and not archived and status in ('Awaiting response','Unfilled')
  loop
    perform public.close_request(v_id);
  end loop;

  update public.donors d
     set held_by = null
   where d.held_by in (select id from public.blood_requests where requester_id = auth.uid());

  delete from public.donor_contacts c
   using public.blood_requests r
   where c.request_id = r.id and r.requester_id = auth.uid() and not r.archived
     and not exists (select 1 from public.donor_accounts da where da.donor_id = c.donor_id);

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

-- Offers addressed to the signed-in donor. The recipient's identity is never included.
drop function public.donor_offers();
create function public.donor_offers()
returns table (request_donor_id uuid, request_code text, recipient_group text, units int, urgency text,
               sector_id text, state text, request_status text, offered_at timestamptz, deadline timestamptz, hospital_id text,
               request_id uuid, verification text)
language sql
stable
security definer
set search_path = ''
as $$
  select rd.id, r.code, r.recipient_group, r.units, r.urgency, r.sector_id, rd.state, r.status, rd.sent_at,
         rd.sent_at + make_interval(mins => public.response_minutes(r.urgency)), r.hospital_id, r.id, r.verification
    from public.donor_accounts a
    join public.request_donors rd on rd.donor_id = a.donor_id
    join public.blood_requests r on r.id = rd.request_id
   where a.user_id = auth.uid() and not r.archived
   order by rd.sent_at desc;
$$;

-- The old single-shot match function is replaced by submit_request and record_round.
drop function public.record_match(jsonb, jsonb, jsonb);

-- ---------- confirmation, feedback and reports ----------

-- The seeker confirms whether an accepted donor came. A thank-you note can go with a donation.
create function public.confirm_donation(p_request_donor uuid, p_outcome text, p_thanks text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_rd public.request_donors%rowtype;
  r public.blood_requests%rowtype;
  v_note text := btrim(coalesce(p_thanks, ''));
begin
  if p_outcome not in ('Donated','No show') then
    raise exception 'invalid_state' using errcode = 'P0001';
  end if;
  perform public.sweep();
  select * into v_rd from public.request_donors where id = p_request_donor for update;
  if not found or v_rd.state <> 'Accepted' then
    raise exception 'not_waiting' using errcode = 'P0001';
  end if;
  select * into r from public.blood_requests where id = v_rd.request_id and requester_id = auth.uid() and not archived for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if r.status <> 'Confirmed' then
    raise exception 'not_confirmed' using errcode = 'P0001';
  end if;
  if char_length(v_note) > 200 then
    raise exception 'note_too_long' using errcode = 'P0001';
  end if;

  update public.request_donors
     set state = p_outcome, responded_at = now(), feedback = case when p_outcome = 'Donated' and v_note <> '' then v_note end
   where id = v_rd.id;
  if p_outcome = 'Donated' then
    update public.donors set last_donation_date = current_date where id = v_rd.donor_id;
  else
    update public.donors set accepted_count = greatest(0, accepted_count - 1) where id = v_rd.donor_id;
  end if;
  update public.donors set held_by = null where id = v_rd.donor_id and held_by = r.id;
  perform public.refresh_request(r.id);
end;
$$;

-- A donor reports a request they were asked about. Several different donors reporting fraud or payment
-- demands against one account flags it, and its open requests are closed.
create function public.report_request(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.blood_requests%rowtype;
  v_kind text := p ->> 'kind';
  v_note text := btrim(coalesce(p ->> 'note', ''));
  v_id uuid;
begin
  if not exists (select 1 from public.donor_accounts where user_id = auth.uid()) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if v_kind not in ('Asked for payment','Suspected fraud','Wrong details','Other') then
    raise exception 'invalid_kind' using errcode = 'P0001';
  end if;
  if char_length(v_note) not between 5 and 500 then
    raise exception 'invalid_note' using errcode = 'P0001';
  end if;
  select * into r from public.blood_requests
   where id = (p ->> 'request_id')::uuid and not archived
     and exists (select 1 from public.request_donors rd join public.donor_accounts a on a.donor_id = rd.donor_id
                  where rd.request_id = blood_requests.id and a.user_id = auth.uid());
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  begin
    insert into public.reports (request_id, raiser_id, kind, note) values (r.id, auth.uid(), v_kind, v_note);
  exception when unique_violation then
    raise exception 'already_reported' using errcode = 'P0001';
  end;

  if (select count(distinct x.raiser_id) from public.reports x join public.blood_requests br on br.id = x.request_id
       where br.requester_id = r.requester_id and x.kind in ('Asked for payment','Suspected fraud')) >= 2 then
    update public.profiles set flagged = true where id = r.requester_id;
    for v_id in
      select id from public.blood_requests where requester_id = r.requester_id and not archived and status in ('Awaiting response','Unfilled')
    loop
      perform public.close_request(v_id);
    end loop;
  end if;
end;
$$;

create function public.my_reports()
returns table (id uuid, request_id uuid, request_code text, kind text, note text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select x.id, x.request_id, r.code, x.kind, x.note, x.created_at
    from public.reports x join public.blood_requests r on r.id = x.request_id
   where x.raiser_id = auth.uid() order by x.created_at desc;
$$;

-- A donor's confirmed donations and the thank-you notes seekers left. The seeker is never named.
create function public.donor_thanks()
returns table (donated int, note text, at timestamptz)
language sql stable security definer set search_path = '' as $$
  select count(*) over ()::int, rd.feedback, rd.responded_at
    from public.donor_accounts a
    join public.request_donors rd on rd.donor_id = a.donor_id
   where a.user_id = auth.uid() and rd.state = 'Donated'
   order by rd.responded_at desc;
$$;

revoke all on function public.is_compatible(text, text), public.response_minutes(text), public.max_rounds(text),
  public.sector_km(text, text), public.contacts_30(uuid), public.refresh_request(uuid), public.close_request(uuid),
  public.sweep(), public.save_patient(jsonb), public.submit_request(jsonb), public.donor_pool(),
  public.record_round(uuid, jsonb, jsonb), public.cancel_request(uuid), public.donor_offers(),
  public.confirm_donation(uuid, text, text), public.report_request(jsonb), public.my_reports(), public.donor_thanks()
  from public, anon;
revoke all on function public.refresh_request(uuid), public.close_request(uuid) from authenticated;
grant execute on function public.is_compatible(text, text), public.response_minutes(text), public.max_rounds(text),
  public.sector_km(text, text), public.contacts_30(uuid), public.sweep(),
  public.save_patient(jsonb), public.submit_request(jsonb), public.donor_pool(), public.record_round(uuid, jsonb, jsonb),
  public.cancel_request(uuid), public.donor_offers(), public.confirm_donation(uuid, text, text), public.report_request(jsonb),
  public.my_reports(), public.donor_thanks()
  to authenticated;
