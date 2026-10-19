\set ON_ERROR_STOP 1
\set QUIET 1
-- Users: two recipients and two donors with accounts.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'r@example.com', '{"role":"recipient","full_name":"Rae Recipient"}'),
  ('22222222-2222-2222-2222-222222222222', 'o@example.com', '{"role":"recipient","full_name":"Other Recipient"}'),
  ('33333333-3333-3333-3333-333333333333', 'd@example.com', '{"role":"donor","full_name":"Dana Donor","blood_group":"A+","sector":"G-8"}'),
  ('55555555-5555-5555-5555-555555555555', 'e@example.com', '{"role":"donor","full_name":"Eli Donor","blood_group":"A+","sector":"G-8"}'),
  ('66666666-6666-6666-6666-666666666666', 'f@example.com', '{"role":"donor","full_name":"Fay Donor","blood_group":"A+","sector":"G-8"}');
-- Blood bank accounts are not part of this iteration, so signing up as one is refused.
do $$ begin
  begin
    insert into auth.users (email, raw_user_meta_data) values ('fake@bank.example', '{"role":"blood_bank","full_name":"Fake"}');
    assert false, 'sign-up as blood bank should fail';
  exception when raise_exception or check_violation or others then
    assert sqlerrm <> 'sign-up as blood bank should fail', 'sign-up as blood bank should fail';
  end;
end $$;
\echo accounts ok

\set R '11111111-1111-1111-1111-111111111111'
\set O '22222222-2222-2222-2222-222222222222'
\set DN '33333333-3333-3333-3333-333333333333'
\set EN '55555555-5555-5555-5555-555555555555'
\set FN '66666666-6666-6666-6666-666666666666'
\set H1 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
\set H2 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

-- Uploads the file the way the app does, then submits the request. Runs as the caller.
create function pg_temp.mk(p_patient uuid, p_units int, p_urgency text, p_group text, p_hash text, p_pmdc text default '10234-P')
returns jsonb language plpgsql as $$
begin
  insert into storage.objects (bucket_id, name) values ('prescriptions', auth.uid()::text || '/' || p_hash || '.pdf') on conflict do nothing;
  return public.submit_request(jsonb_build_object('patient_id', p_patient, 'units', p_units, 'urgency', p_urgency, 'prescription', jsonb_build_object(
    'doctor_name','Dr. Sana Malik','pmdc_number',p_pmdc,'hospital_id','H-CGH','issued_on', current_date::text,'blood_group',p_group,
    'units_prescribed',p_units,'diagnosis','Anaemia','file_path', auth.uid()::text || '/' || p_hash || '.pdf','file_name','rx.pdf',
    'file_type','application/pdf','file_size',1200,'file_hash', p_hash)));
end $$;

-- ---------- recipient: patient and verified request ----------
select set_config('request.jwt.claim.sub', :'R', false);
set role authenticated;
select (public.save_patient('{"full_name":"Ali Raza","mr_number":"cgh-1001","hospital_id":"H-CGH","blood_group":"A+","birth_year":1980}')).id as p1 \gset
select pg_temp.mk(:'p1', 1, 'Urgent', 'A+', :'H1') as res1 \gset
select (:'res1'::jsonb ->> 'id') as req1 \gset
select (:'res1'::jsonb ->> 'verification') = 'Verified' as ok \gset
\if :ok \echo clean request verified \else \echo FAIL clean request not verified :res1 \quit \endif

-- A file that was never uploaded is refused; so is a second open request for the same patient.
do $$ begin
  begin
    perform public.submit_request(jsonb_build_object('patient_id', (select id from public.patients where mr_number = 'CGH-1001'), 'units', 1, 'urgency', 'Urgent',
      'prescription', jsonb_build_object('doctor_name','Dr. Sana Malik','pmdc_number','10234-P','hospital_id','H-CGH','issued_on', current_date::text,
      'blood_group','A+','units_prescribed',1,'file_path','11111111-1111-1111-1111-111111111111/nothing.pdf','file_name','x','file_type','application/pdf',
      'file_size',10,'file_hash', repeat('c', 64))));
    assert false, 'should refuse';
  exception when sqlstate 'P0001' then
    assert sqlerrm like 'invalid:document:%', 'missing upload: ' || sqlerrm;
  end;
  begin
    perform pg_temp.mk((select id from public.patients where mr_number = 'CGH-1001'), 1, 'Urgent', 'A+', repeat('a', 64));
    assert false, 'duplicate open request accepted';
  exception when sqlstate 'P0001' then
    assert sqlerrm like 'invalid:duplicate:%', 'duplicate: ' || sqlerrm;
  end;
end $$;
\echo upload and duplicate checks ok

-- Units over the prescription, and a group mismatch, are refused.
select (public.save_patient('{"full_name":"Sara Khan","mr_number":"CGH-2002","hospital_id":"H-CGH","blood_group":"B+","birth_year":1990}')).id as p2 \gset
do $$ begin
  begin
    perform public.submit_request(jsonb_build_object('patient_id', (select id from public.patients where mr_number = 'CGH-2002'), 'units', 2, 'urgency', 'Urgent',
      'prescription', jsonb_build_object('doctor_name','Dr. Sana Malik','pmdc_number','10234-P','hospital_id','H-CGH','issued_on', current_date::text,
      'blood_group','B+','units_prescribed',1,'file_path','x','file_name','x','file_type','application/pdf','file_size',10,'file_hash', repeat('c', 64))));
    assert false;
  exception when sqlstate 'P0001' then assert sqlerrm like 'invalid:units:%', sqlerrm;
  end;
  begin
    perform pg_temp.mk((select id from public.patients where mr_number = 'CGH-2002'), 1, 'Urgent', 'A+', repeat('c', 64));
    assert false;
  exception when sqlstate 'P0001' then assert sqlerrm like 'invalid:prescriptionGroup:%', sqlerrm;
  end;
end $$;
\echo prescription rules ok

-- ---------- matching round, server re-checks ----------
select string_agg(id::text, ',') as pick from (
  select id from public.donor_pool() where public.is_compatible('A+', blood_group) and available and held_by is null
     and last_donation_date <= current_date - 90 and public.sector_km(sector_id, 'G-8') <= 15 and contacts_30 < 3
     and code like 'D-0%' order by contacts_30, code limit 2) s \gset
select split_part(:'pick', ',', 1) as d1, split_part(:'pick', ',', 2) as d2 \gset
do $$ begin
  begin
    perform public.record_round((select id from public.blood_requests order by created_at desc limit 1),
      jsonb_build_array(jsonb_build_object('donor_id', (select id from public.donors where blood_group = 'B+' and available limit 1), 'rank', 1, 'p', 0.5, 'cost', 0)),
      '{}');
    assert false, 'incompatible donor accepted';
  exception when sqlstate 'P0001' then assert sqlerrm = 'donor_unavailable', sqlerrm;
  end;
end $$;
select public.record_round(:'req1', jsonb_build_array(
  jsonb_build_object('donor_id', :'d1', 'rank', 1, 'p', 0.6, 'cost', 0),
  jsonb_build_object('donor_id', :'d2', 'rank', 2, 'p', 0.5, 'cost', 0)),
  '{"algorithm":"nsga3","engine_version":"t","pool_hash":"x","pool_size":300,"eligible_size":40,"front_size":3,"evaluated":100,"objectives":{"travel":1,"recovery":100,"fulfilment":0.8,"preservation":0}}') as st \gset
\if `test ":st" = "Awaiting response" && echo 1 || echo 0` \echo round one sent \else \echo FAIL round status :st \quit \endif
do $$ begin
  begin
    perform public.record_round((select id from public.blood_requests where status = 'Awaiting response' limit 1), '[]', '{"algorithm":"nsga3","engine_version":"t","pool_hash":"x","pool_size":300,"eligible_size":40,"front_size":3,"evaluated":100,"objectives":{"travel":1,"recovery":100,"fulfilment":0.8,"preservation":0}}');
    assert false;
  exception when sqlstate 'P0001' then assert sqlerrm in ('not_ready', 'nothing_to_send'), sqlerrm;
  end;
end $$;

-- Accept one: request confirmed, the other stood down, the accepted donor still held.
select id as rd1 from public.request_donors where request_id = :'req1' and donor_id = :'d1' \gset
select public.respond_to_request(:'rd1', 'Accepted') as st \gset
reset role;
do $$ declare v record; begin
  select * into v from public.request_donors where state = 'Stood Down' limit 1;
  assert v.state = 'Stood Down', 'other donor stood down';
  assert (select held_by from public.donors where id = v.donor_id) is null, 'stood down donor released';
  assert (select count(*) from public.donors d join public.request_donors rd on rd.donor_id = d.id and rd.state = 'Accepted' where d.held_by = rd.request_id) = 1, 'accepted donor still held';
  assert (select confirmed_at is not null from public.blood_requests where status = 'Confirmed' limit 1), 'confirmed_at set';
end $$;
\echo confirmation ok

-- ---------- the seeker confirms the donation and says thanks ----------
-- Only the seeker who raised the request may do it.
select set_config('request.jwt.claim.sub', :'O', false);
set role authenticated;
select set_config('t.rd1', :'rd1', false) as _ \gset
do $$ begin
  begin perform public.confirm_donation(current_setting('t.rd1')::uuid, 'Donated', 'x'); assert false;
  exception when sqlstate 'P0001' then assert sqlerrm in ('not_found', 'not_waiting'), sqlerrm; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', :'R', false);
set role authenticated;
do $$ begin
  begin perform public.confirm_donation((select id from public.request_donors where state = 'Accepted' limit 1), 'Donated', repeat('x', 201)); assert false;
  exception when sqlstate 'P0001' then assert sqlerrm = 'note_too_long', sqlerrm; end;
  begin perform public.confirm_donation((select id from public.request_donors where state = 'Stood Down' limit 1), 'Donated', ''); assert false;
  exception when sqlstate 'P0001' then assert sqlerrm = 'not_waiting', sqlerrm; end;
end $$;
select public.confirm_donation(:'rd1', 'Donated', 'Thank you, you saved my father.');
reset role;
do $$ begin
  assert (select state from public.request_donors where id = (select id from public.request_donors where feedback is not null)) = 'Donated', 'donated';
  assert (select feedback from public.request_donors where state = 'Donated') = 'Thank you, you saved my father.', 'note kept';
  assert (select last_donation_date from public.donors where id = (select donor_id from public.request_donors where state = 'Donated')) = current_date, 'donation date updated';
  assert (select held_by from public.donors where id = (select donor_id from public.request_donors where state = 'Donated')) is null, 'released after donation';
end $$;
-- A second confirmation of the same donor is refused.
select set_config('request.jwt.claim.sub', :'R', false);
set role authenticated;
do $$ begin
  begin perform public.confirm_donation((select id from public.request_donors where state = 'Donated' limit 1), 'No show', ''); assert false;
  exception when sqlstate 'P0001' then assert sqlerrm = 'not_waiting', sqlerrm; end;
end $$;
reset role;
\echo donation confirmation ok

-- ---------- the donor sees the thank-you and the donation count, and nothing about the seeker ----------
select donor_id as fn_donor from public.donor_accounts where user_id = :'FN' \gset
select set_config('request.jwt.claim.sub', :'R', false);
set role authenticated;
select (public.save_patient('{"full_name":"Thanks Pat","mr_number":"CGH-8008","hospital_id":"H-CGH","blood_group":"A+","birth_year":1981}')).id as p9 \gset
select (pg_temp.mk(:'p9', 1, 'Urgent', 'A+', repeat('7', 64)) ->> 'id') as req9 \gset
select public.record_round(:'req9', jsonb_build_array(jsonb_build_object('donor_id', :'fn_donor', 'rank', 1, 'p', 0.5, 'cost', 0)), '{"algorithm":"nsga3","engine_version":"t","pool_hash":"x","pool_size":300,"eligible_size":40,"front_size":3,"evaluated":100,"objectives":{"travel":1,"recovery":100,"fulfilment":0.8,"preservation":0}}');
reset role;
select set_config('request.jwt.claim.sub', :'FN', false);
set role authenticated;
select request_donor_id as rd9 from public.donor_offers() where request_id = :'req9' \gset
select public.respond_to_request(:'rd9', 'Accepted');
reset role;
select set_config('request.jwt.claim.sub', :'R', false);
set role authenticated;
select public.confirm_donation(:'rd9', 'Donated', 'You are a hero.');
reset role;
select set_config('request.jwt.claim.sub', :'FN', false);
set role authenticated;
do $$ declare v record; begin
  select * into v from public.donor_thanks() limit 1;
  assert v.donated = 1 and v.note = 'You are a hero.', 'donor sees the note and count';
  assert (select state from public.donor_offers() limit 1) = 'Donated', 'offer shows donated';
end $$;
reset role;
\echo thanks reach the donor ok

-- ---------- rules: reuse refused, one odd detail goes ahead unverified ----------
select set_config('request.jwt.claim.sub', :'O', false);
set role authenticated;
select (public.save_patient('{"full_name":"Bilal","mr_number":"CGH-3003","hospital_id":"H-CGH","blood_group":"O+","birth_year":1975}')).id as p3 \gset
do $$ begin
  begin
    perform pg_temp.mk((select id from public.patients where mr_number = 'CGH-3003'), 1, 'Critical', 'O+', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    assert false, 'reused document accepted';
  exception when sqlstate 'P0001' then
    assert sqlerrm like 'refused:[%', 'reused document refused: ' || sqlerrm;
    assert sqlerrm like '%document-reused%', 'reuse flag named: ' || sqlerrm;
  end;
end $$;
select count(*) as saved from public.blood_requests where requester_id = :'O' \gset
\if :saved \echo FAIL refused request was saved \quit \else \echo refused request leaves nothing behind \endif
select pg_temp.mk(:'p3', 1, 'Routine', 'O+', repeat('9', 64), '99999-Z') as res2 \gset
select (:'res2'::jsonb ->> 'verification') as ver2 \gset
\if `test ":ver2" = "Unverified" && echo 1 || echo 0` \echo unverified request goes ahead \else \echo FAIL expected Unverified :res2 \quit \endif
-- Donors see the label.
select (public.cancel_request((:'res2'::jsonb ->> 'id')::uuid));
reset role;
-- Another account's patients are invisible.
select set_config('request.jwt.claim.sub', :'O', false);
set role authenticated;
select count(*) as seen from public.patients where owner_id <> auth.uid() \gset
\if :seen \echo FAIL other accounts patients visible \quit \else \echo patients are private \endif
do $$ begin
  begin perform public.donor_pool() ; exception when others then assert false, 'recipients may read the pool'; end;
end $$;
reset role;

-- ---------- expiry, second round, preemption ----------
select set_config('request.jwt.claim.sub', :'R', false);
set role authenticated;
select (public.save_patient('{"full_name":"Routine Pat","mr_number":"CGH-4004","hospital_id":"H-CGH","blood_group":"A+","birth_year":1970}')).id as p4 \gset
select pg_temp.mk(:'p4', 1, 'Routine', 'A+', :'H2') ->> 'id' as req4 \gset
select string_agg(id::text, ',') as pick from (
  select id from public.donor_pool() where public.is_compatible('A+', blood_group) and available and held_by is null
     and last_donation_date <= current_date - 90 and public.sector_km(sector_id, 'G-8') <= 15 and contacts_30 < 3
     and code like 'D-0%' order by contacts_30, code limit 2) s \gset
select split_part(:'pick', ',', 1) as e1, split_part(:'pick', ',', 2) as e2 \gset
select public.record_round(:'req4', jsonb_build_array(jsonb_build_object('donor_id', :'e1', 'rank', 1, 'p', 0.5, 'cost', 0),
  jsonb_build_object('donor_id', :'e2', 'rank', 2, 'p', 0.5, 'cost', 0)), '{"algorithm":"nsga3","engine_version":"t","pool_hash":"x","pool_size":300,"eligible_size":40,"front_size":3,"evaluated":100,"objectives":{"travel":1,"recovery":100,"fulfilment":0.8,"preservation":0}}');
reset role;

-- A critical request from the other account takes e1 from the routine request.
select set_config('request.jwt.claim.sub', :'O', false);
set role authenticated;
select (public.save_patient('{"full_name":"Critical Pat","mr_number":"CGH-5005","hospital_id":"H-CGH","blood_group":"A+","birth_year":1960}')).id as p5 \gset
select pg_temp.mk(:'p5', 1, 'Critical', 'A+', repeat('d', 64)) as res5 \gset
select (:'res5'::jsonb ->> 'id') as req5 \gset
select public.record_round(:'req5', jsonb_build_array(jsonb_build_object('donor_id', :'e1', 'rank', 1, 'p', 0.5, 'cost', 0)), '{"algorithm":"nsga3","engine_version":"t","pool_hash":"x","pool_size":300,"eligible_size":40,"front_size":3,"evaluated":100,"objectives":{"travel":1,"recovery":100,"fulfilment":0.8,"preservation":0}}') as st \gset
reset role;
do $$ begin
  assert (select state from public.request_donors where state = 'Reassigned') = 'Reassigned', 'routine row reassigned';
  assert (select held_by from public.donors where id = (select donor_id from public.request_donors where state = 'Reassigned'))
       = (select request_id from public.request_donors where donor_id = (select donor_id from public.request_donors where state = 'Reassigned') and state = 'Sent'), 'held by critical now';
end $$;
\echo preemption ok

-- A routine offer lapses after 12 hours; the request is unfilled, and the same donor cannot be asked again.
update public.request_donors set sent_at = now() - interval '13 hours' where request_id = :'req4' and state = 'Sent';
select set_config('request.jwt.claim.sub', :'R', false);
set role authenticated;
select public.sweep();
select status as st4 from public.blood_requests where id = :'req4' \gset
\if `test ":st4" = "Unfilled" && echo 1 || echo 0` \echo routine request lapsed to unfilled \else \echo FAIL expected Unfilled :st4 \quit \endif
do $$ begin
  begin
    perform public.record_round((select id from public.blood_requests where status = 'Unfilled' limit 1),
      jsonb_build_array(jsonb_build_object('donor_id', (select donor_id from public.request_donors where state = 'Expired' limit 1), 'rank', 1, 'p', 0.5, 'cost', 0)), '{"algorithm":"nsga3","engine_version":"t","pool_hash":"x","pool_size":300,"eligible_size":40,"front_size":3,"evaluated":100,"objectives":{"travel":1,"recovery":100,"fulfilment":0.8,"preservation":0}}');
    assert false, 'asked same donor twice';
  exception when sqlstate 'P0001' then assert sqlerrm = 'donor_unavailable', sqlerrm;
  end;
end $$;
reset role;
\echo second-round rules ok

-- ---------- cancelling releases the donors it holds ----------
select set_config('request.jwt.claim.sub', :'O', false);
set role authenticated;
select public.cancel_request(:'req5');
reset role;
do $$ begin
  assert (select count(*) from public.donors where held_by = (select id from public.blood_requests where status = 'Cancelled' limit 1)) = 0, 'cancel released donors';
end $$;

-- ---------- donor reports ----------
-- The other recipient asks the two donors with accounts, one on each request.
select donor_id as dn_donor from public.donor_accounts where user_id = :'DN' \gset
select donor_id as en_donor from public.donor_accounts where user_id = :'EN' \gset
select set_config('request.jwt.claim.sub', :'O', false);
set role authenticated;
select (public.save_patient('{"full_name":"Fraud Pat","mr_number":"CGH-6006","hospital_id":"H-CGH","blood_group":"A+","birth_year":1985}')).id as p6 \gset
select (public.save_patient('{"full_name":"Fraud Pat Two","mr_number":"CGH-6007","hospital_id":"H-CGH","blood_group":"A+","birth_year":1986}')).id as p7 \gset
select (pg_temp.mk(:'p6', 1, 'Urgent', 'A+', repeat('e', 64)) ->> 'id') as req6 \gset
select (pg_temp.mk(:'p7', 1, 'Urgent', 'A+', repeat('f', 64)) ->> 'id') as req7 \gset
select public.record_round(:'req6', jsonb_build_array(jsonb_build_object('donor_id', :'dn_donor', 'rank', 1, 'p', 0.5, 'cost', 0)), '{"algorithm":"nsga3","engine_version":"t","pool_hash":"x","pool_size":300,"eligible_size":40,"front_size":3,"evaluated":100,"objectives":{"travel":1,"recovery":100,"fulfilment":0.8,"preservation":0}}');
select public.record_round(:'req7', jsonb_build_array(jsonb_build_object('donor_id', :'en_donor', 'rank', 1, 'p', 0.5, 'cost', 0)), '{"algorithm":"nsga3","engine_version":"t","pool_hash":"x","pool_size":300,"eligible_size":40,"front_size":3,"evaluated":100,"objectives":{"travel":1,"recovery":100,"fulfilment":0.8,"preservation":0}}');
reset role;

select set_config('request.jwt.claim.sub', :'DN', false);
set role authenticated;
do $$ begin
  assert (select bool_and(request_id is not null and verification in ('Verified','Unverified')) from public.donor_offers()), 'offers carry request id and verification';
  begin perform public.donor_pool(); assert false, 'donor reached donor_pool'; exception when sqlstate 'P0001' then null; end;
  begin perform public.report_request('{"request_id":"00000000-0000-0000-0000-000000000000","kind":"Bogus","note":"hello there"}'); assert false;
  exception when sqlstate 'P0001' then assert sqlerrm = 'invalid_kind', sqlerrm; end;
end $$;
select public.report_request(jsonb_build_object('request_id', :'req6', 'kind', 'Asked for payment', 'note', 'Asked me to pay for the blood bag.'));
do $$ begin
  begin perform public.report_request(jsonb_build_object('request_id', (select request_id from public.reports limit 1), 'kind', 'Asked for payment', 'note', 'Same thing again.')); assert false;
  exception when sqlstate 'P0001' then assert sqlerrm = 'already_reported', sqlerrm; end;
  assert (select count(*) from public.my_reports()) = 1, 'my_reports lists the report';
end $$;
reset role;
do $$ begin
  assert not (select flagged from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'one report does not flag';
end $$;
select count(*) as open6 from public.blood_requests where id = :'req6' and status = 'Awaiting response' \gset
\if :open6 \echo one report leaves the request open \else \echo FAIL one report closed the request \quit \endif
select count(*) as flagged1 from public.profiles where id = :'O' and flagged \gset
\if :flagged1 \echo FAIL one report flagged the account \quit \else \echo one report does not flag the account \endif

-- A second, different donor reporting fraud flags the account and closes its open requests.
select set_config('request.jwt.claim.sub', :'EN', false);
set role authenticated;
select public.report_request(jsonb_build_object('request_id', :'req7', 'kind', 'Suspected fraud', 'note', 'The details did not match the ward.'));
reset role;
do $$ begin
  assert (select flagged from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'account flagged';
  assert (select count(*) from public.blood_requests where requester_id = '22222222-2222-2222-2222-222222222222' and status in ('Awaiting response','Unfilled')) = 0, 'open requests closed';
  assert (select held_by from public.donors d join public.donor_accounts a on a.donor_id = d.id where a.user_id = '33333333-3333-3333-3333-333333333333') is null, 'donor released';
end $$;
\echo fraud reports flag the account ok

-- The next request from the flagged account is refused.
select set_config('request.jwt.claim.sub', :'O', false);
set role authenticated;
select (public.save_patient('{"full_name":"Next Pat","mr_number":"CGH-7008","hospital_id":"H-CGH","blood_group":"A+","birth_year":1985}')).id as p8 \gset
do $$ begin
  begin
    perform pg_temp.mk((select id from public.patients where mr_number = 'CGH-7008'), 1, 'Urgent', 'A+', repeat('1', 64));
    assert false, 'flagged account accepted';
  exception when sqlstate 'P0001' then assert sqlerrm like 'refused:%account-flagged%', sqlerrm; end;
end $$;
select public.reset_demo();
reset role;
do $$ begin
  assert (select count(*) from public.blood_requests where requester_id = '22222222-2222-2222-2222-222222222222' and not archived) = 0, 'reset archived';
end $$;

-- ---------- anon sees nothing personal ----------
set role anon;
do $$ begin
  begin perform 1 from public.patients; assert false, 'anon read patients'; exception when insufficient_privilege then null; end;
  begin perform public.submit_request('{}'); assert false; exception when insufficient_privilege then null; end;
end $$;
reset role;
\echo ALL SQL CHECKS PASSED
