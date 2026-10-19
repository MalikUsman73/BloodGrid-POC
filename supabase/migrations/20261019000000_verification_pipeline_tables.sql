-- The verified request pipeline, from the proposal defence feedback:
--   patient record and doctor's prescription -> verification rules and fraud checks -> donor matching
--   rounds with time limits -> the seeker confirms each donation and can thank the donor.
-- Also: widening rounds, priority between competing requests, donor reports and the registered blood
-- banks shown to seekers on critical requests. Hospitals, doctors and banks are synthetic reference data.

-- Reference data. Sectors are normally loaded by seed.sql; the ones referenced here are added now.
insert into public.sectors (id, lat, lng) values
  ('E-7', 33.735, 73.045),
  ('E-11', 33.701, 72.965),
  ('F-6', 33.7294, 73.0791),
  ('F-7', 33.7215, 73.0551),
  ('F-8', 33.71, 73.035),
  ('F-10', 33.6985, 73.009),
  ('F-11', 33.685, 72.988),
  ('G-6', 33.712, 73.083),
  ('G-7', 33.705, 73.06),
  ('G-8', 33.695, 73.039),
  ('G-9', 33.688, 73.02),
  ('G-10', 33.679, 73.003),
  ('G-11', 33.668, 72.985),
  ('H-8', 33.678, 73.045),
  ('H-9', 33.67, 73.027),
  ('H-10', 33.66, 73.01),
  ('I-8', 33.665, 73.068),
  ('I-9', 33.656, 73.048),
  ('I-10', 33.647, 73.028),
  ('I-11', 33.638, 73.009)
on conflict (id) do nothing;

create table public.hospitals (
  id        text primary key,
  name      text not null,
  sector_id text not null references public.sectors (id)
);

-- Synthetic sample standing in for the PMDC register.
create table public.doctors (
  pmdc        text primary key,
  name        text not null,
  hospital_id text not null references public.hospitals (id)
);

create table public.blood_banks (
  id        text primary key,
  name      text not null,
  sector_id text not null references public.sectors (id),
  kind      text not null check (kind in ('Government','Non-profit','Hospital'))
);

insert into public.hospitals (id, name, sector_id) values
  ('H-CGH', 'Capital General Hospital', 'G-8'),
  ('H-FMC', 'Federal Medical Complex', 'G-6'),
  ('H-NCH', 'North City Hospital', 'F-8'),
  ('H-EMC', 'E-11 Medical Centre', 'E-11'),
  ('H-MCH', 'Margalla Children’s Hospital', 'H-8'),
  ('H-SWH', 'Southwest Hospital', 'I-10'),
  ('H-WMC', 'West Medical Centre', 'G-11');

insert into public.doctors (pmdc, name, hospital_id) values
  ('10234-P', 'Dr. Sana Malik', 'H-CGH'),
  ('20871-P', 'Dr. Imran Qureshi', 'H-CGH'),
  ('31455-F', 'Dr. Ayesha Khan', 'H-FMC'),
  ('44120-F', 'Dr. Bilal Ahmed', 'H-FMC'),
  ('52309-P', 'Dr. Hira Javed', 'H-NCH'),
  ('60117-K', 'Dr. Usama Raza', 'H-EMC'),
  ('71842-P', 'Dr. Mehwish Tariq', 'H-MCH'),
  ('83306-S', 'Dr. Faisal Iqbal', 'H-SWH'),
  ('94518-P', 'Dr. Nadia Hussain', 'H-WMC'),
  ('15562-B', 'Dr. Kamran Shah', 'H-WMC');

insert into public.blood_banks (id, name, sector_id, kind) values
  ('BB-CRBC', 'Central Regional Blood Centre', 'G-7', 'Government'),
  ('BB-NBT', 'Northern Blood Trust', 'F-7', 'Non-profit'),
  ('BB-CGH', 'Capital General Hospital Blood Bank', 'G-8', 'Hospital'),
  ('BB-SBS', 'Southern Blood Services', 'I-9', 'Non-profit');

-- Set when several donors report the account's requests for fraud or payment demands. Later requests are refused.
alter table public.profiles add column flagged boolean not null default false;

create table public.patients (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id),
  full_name   text not null check (char_length(full_name) between 2 and 80),
  mr_number   text not null check (mr_number ~ '^[A-Z0-9][A-Z0-9-]{3,19}$'),
  hospital_id text not null references public.hospitals (id),
  blood_group text not null check (blood_group in ('O-','O+','A-','A+','B-','B+','AB-','AB+')),
  birth_year  int  not null check (birth_year between 1900 and 2100),
  created_at  timestamptz not null default now(),
  unique (owner_id, hospital_id, mr_number)
);
create index patients_record_idx on public.patients (hospital_id, mr_number);

-- Requests now belong to a patient and carry their verification state.
alter table public.blood_requests
  add column patient_id   uuid references public.patients (id),
  add column hospital_id  text references public.hospitals (id),
  add column verification text not null default 'Verified' check (verification in ('Verified','Unverified')),
  add column flags        jsonb not null default '[]',
  add column round        int not null default 1,
  add column confirmed_at timestamptz;
alter table public.blood_requests alter column round set default 0;
alter table public.blood_requests drop constraint blood_requests_status_check;
alter table public.blood_requests add constraint blood_requests_status_check
  check (status in ('Awaiting response','Confirmed','Unfilled','Cancelled'));
alter table public.blood_requests drop constraint blood_requests_k_check;
alter table public.blood_requests add constraint blood_requests_k_check check (k >= 0);

create table public.prescriptions (
  request_id       uuid primary key references public.blood_requests (id) on delete cascade,
  doctor_name      text not null,
  pmdc_number      text not null,
  hospital_id      text not null references public.hospitals (id),
  issued_on        date not null,
  blood_group      text not null,
  units_prescribed int  not null check (units_prescribed between 1 and 10),
  diagnosis        text not null default '',
  file_path        text not null,
  file_name        text not null,
  file_type        text not null check (file_type in ('application/pdf','image/jpeg','image/png')),
  file_size        int  not null check (file_size between 1 and 5242880),
  file_hash        text not null check (file_hash ~ '^[0-9a-f]{64}$')
);
create index prescriptions_hash_idx on public.prescriptions (file_hash);

alter table public.request_donors
  add column round    int not null default 1,
  add column sent_at  timestamptz not null default now(),
  -- The seeker's thank-you note, written when they confirm the donation.
  add column feedback text check (char_length(feedback) <= 200);
alter table public.request_donors drop constraint request_donors_state_check;
alter table public.request_donors add constraint request_donors_state_check
  check (state in ('Sent','Accepted','Declined','Stood Down','Expired','Reassigned','Donated','No show'));

-- Contacts are logged, so the 30-day cap is a true rolling window.
create table public.donor_contacts (
  donor_id     uuid not null references public.donors (id) on delete cascade,
  request_id   uuid references public.blood_requests (id) on delete cascade,
  contacted_at timestamptz not null default now()
);
create index donor_contacts_idx on public.donor_contacts (donor_id, contacted_at);

-- Seeded contact counts become logged contacts spread over the last four weeks.
create function public.seed_contacts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.donor_contacts (donor_id, contacted_at)
  select new.id, now() - make_interval(days => 4 + i * 8) from generate_series(0, new.contacts_last_30d - 1) i;
  return new;
end;
$$;
create trigger donors_seed_contacts after insert on public.donors
  for each row when (new.contacts_last_30d > 0) execute function public.seed_contacts();
insert into public.donor_contacts (donor_id, contacted_at)
select d.id, now() - make_interval(days => 4 + i * 8)
  from public.donors d cross join lateral generate_series(0, d.contacts_last_30d - 1) i
 where d.contacts_last_30d > 0;

-- A donor's report about a request. Several different donors reporting fraud flags the account.
create table public.reports (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.blood_requests (id) on delete cascade,
  raiser_id  uuid not null references auth.users (id),
  kind       text not null check (kind in ('Asked for payment','Suspected fraud','Wrong details','Other')),
  note       text not null check (char_length(note) between 5 and 500),
  created_at timestamptz not null default now(),
  unique (request_id, raiser_id, kind)
);

-- Row Level Security. Reads only; every write goes through a function.
alter table public.hospitals      enable row level security;
alter table public.doctors        enable row level security;
alter table public.blood_banks    enable row level security;
alter table public.patients       enable row level security;
alter table public.prescriptions  enable row level security;
alter table public.donor_contacts enable row level security;
alter table public.reports        enable row level security;

create policy "reference" on public.hospitals   for select to authenticated using (true);
create policy "reference" on public.doctors     for select to authenticated using (true);
create policy "reference" on public.blood_banks for select to authenticated using (true);
create policy "own" on public.patients for select to authenticated using (owner_id = auth.uid());
create policy "own" on public.prescriptions for select to authenticated using (
  exists (select 1 from public.blood_requests r where r.id = request_id and r.requester_id = auth.uid())
);
create policy "own" on public.reports for select to authenticated using (raiser_id = auth.uid());

revoke all on public.hospitals, public.doctors, public.blood_banks, public.patients, public.prescriptions,
  public.donor_contacts, public.reports from anon, authenticated;
grant select on public.hospitals, public.doctors, public.blood_banks, public.patients, public.prescriptions, public.reports to authenticated;
revoke all on function public.seed_contacts() from public, anon, authenticated;

-- Prescription files: a private bucket. A recipient uploads into a folder named after their user id,
-- and only they can read it back.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prescriptions', 'prescriptions', false, 5242880, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy "upload own prescription" on storage.objects for insert to authenticated
  with check (bucket_id = 'prescriptions' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own prescription" on storage.objects for select to authenticated
  using (bucket_id = 'prescriptions' and (storage.foldername(name))[1] = auth.uid()::text);
