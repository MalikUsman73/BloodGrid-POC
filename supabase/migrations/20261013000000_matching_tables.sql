-- CCP-1 donor matching: schema for synthetic demo data.
-- Donors carry no name, phone or address. Identity is out of scope for this module.

create table public.sectors (
  id  text primary key,
  lat double precision not null,
  lng double precision not null
);

create table public.blood_requests (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  recipient_group text not null check (recipient_group in ('O-','O+','A-','A+','B-','B+','AB-','AB+')),
  units           int  not null check (units between 1 and 4),
  urgency         text not null check (urgency in ('Routine','Urgent','Critical')),
  sector_id       text not null references public.sectors (id),
  k               int  not null check (k >= 1),
  status          text not null default 'Awaiting response'
                    check (status in ('Awaiting response','Confirmed','Unfilled')),
  created_at      timestamptz not null default now()
);

create table public.donors (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  blood_group        text not null check (blood_group in ('O-','O+','A-','A+','B-','B+','AB-','AB+')),
  sector_id          text not null references public.sectors (id),
  last_donation_date date not null,
  available          boolean not null default true,
  accepted_count     int not null default 0 check (accepted_count >= 0),
  received_count     int not null default 0 check (received_count >= 0),
  contacts_last_30d  int not null default 0 check (contacts_last_30d >= 0),
  held_by            uuid references public.blood_requests (id) on delete set null,
  base_accepted      int not null default 0,
  base_received      int not null default 0,
  base_contacts      int not null default 0
);
create index donors_group_idx on public.donors (blood_group);
create index donors_held_idx on public.donors (held_by);

create table public.request_donors (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.blood_requests (id) on delete cascade,
  donor_id     uuid not null references public.donors (id),
  rank         int  not null,
  state        text not null default 'Sent' check (state in ('Sent','Accepted','Declined','Stood Down')),
  p            numeric not null,
  cost         numeric not null,
  responded_at timestamptz,
  unique (request_id, donor_id)
);
create index request_donors_donor_idx on public.request_donors (donor_id);

create table public.match_audit (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.blood_requests (id) on delete cascade,
  algorithm      text not null,
  engine_version text not null,
  pool_hash      text not null,
  pool_size      int  not null,
  eligible_size  int  not null,
  front_size     int  not null,
  evaluated      int  not null,
  shortlisted    boolean not null default false,
  objectives     jsonb not null,
  created_at     timestamptz not null default now()
);
create index match_audit_request_idx on public.match_audit (request_id);

create sequence public.blood_request_seq start 1001;

-- Row Level Security: the demo is read-only for the public key. All writes go through the
-- functions below, which validate their input.
alter table public.sectors         enable row level security;
alter table public.blood_requests  enable row level security;
alter table public.donors          enable row level security;
alter table public.request_donors  enable row level security;
alter table public.match_audit     enable row level security;

create policy "demo read" on public.sectors        for select to anon using (true);
create policy "demo read" on public.blood_requests for select to anon using (true);
create policy "demo read" on public.donors         for select to anon using (true);
create policy "demo read" on public.request_donors for select to anon using (true);
create policy "demo read" on public.match_audit    for select to anon using (true);

revoke all on public.sectors, public.blood_requests, public.donors, public.request_donors, public.match_audit from anon, authenticated;
grant select on public.sectors, public.blood_requests, public.donors, public.request_donors, public.match_audit to anon, authenticated;
