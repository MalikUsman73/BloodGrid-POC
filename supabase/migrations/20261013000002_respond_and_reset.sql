alter table public.blood_requests add column archived boolean not null default false;

-- A donor accepts or declines. When enough have accepted, the rest are stood down and released.
create function public.respond_to_request(p_request_donor uuid, p_state text)
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
begin
  if p_state not in ('Accepted','Declined') then
    raise exception 'invalid_state' using errcode = 'P0001';
  end if;

  select * into v_rd from public.request_donors where id = p_request_donor for update;
  if not found or v_rd.state <> 'Sent' then
    raise exception 'not_open' using errcode = 'P0001';
  end if;
  select * into v_req from public.blood_requests where id = v_rd.request_id for update;

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

-- Return the demo to its seeded state. Requests are archived rather than removed, so the audit trail stays.
create function public.reset_demo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.blood_requests set archived = true where not archived;
  update public.donors
     set held_by = null, accepted_count = base_accepted, received_count = base_received, contacts_last_30d = base_contacts
   where true;
end;
$$;

revoke all on function public.respond_to_request(uuid, text) from public;
revoke all on function public.reset_demo() from public;
grant execute on function public.respond_to_request(uuid, text) to anon, authenticated;
grant execute on function public.reset_demo() to anon, authenticated;
