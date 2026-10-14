-- Accounts: every signed-in person has a profile with one role. Donors also get a row in the
-- donor pool, linked to their account. The role comes from sign-up metadata, so the trigger only
-- accepts the roles that may self-register; blood banks cannot be created this way.

create table public.profiles (
  id         uuid primary key references auth.users (id),
  role       text not null check (role in ('donor','recipient','blood_bank')),
  full_name  text not null check (char_length(full_name) between 2 and 80),
  created_at timestamptz not null default now()
);

create table public.donor_accounts (
  user_id  uuid primary key references auth.users (id),
  donor_id uuid not null unique references public.donors (id)
);

create sequence public.donor_code_seq start 1001;

alter table public.profiles       enable row level security;
alter table public.donor_accounts enable row level security;

create policy "own profile"    on public.profiles       for select to authenticated using (id = auth.uid());
create policy "own donor link" on public.donor_accounts for select to authenticated using (user_id = auth.uid());

revoke all on public.profiles, public.donor_accounts from anon, authenticated;
grant select on public.profiles, public.donor_accounts to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role   text := coalesce(new.raw_user_meta_data ->> 'role', '');
  v_name   text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  v_group  text;
  v_sector text;
  v_last   date;
  v_donor  uuid;
begin
  if v_role not in ('donor', 'recipient') then
    raise exception 'role_not_allowed';
  end if;
  if char_length(v_name) < 2 then
    raise exception 'name_required';
  end if;

  insert into public.profiles (id, role, full_name) values (new.id, v_role, left(v_name, 80));

  if v_role = 'donor' then
    v_group  := new.raw_user_meta_data ->> 'blood_group';
    v_sector := new.raw_user_meta_data ->> 'sector';
    if v_group is null or v_group not in ('O-','O+','A-','A+','B-','B+','AB-','AB+') then
      raise exception 'bad_group';
    end if;
    if not exists (select 1 from public.sectors where id = v_sector) then
      raise exception 'bad_sector';
    end if;
    begin
      v_last := nullif(new.raw_user_meta_data ->> 'last_donation', '')::date;
    exception when others then
      raise exception 'bad_date';
    end;
    if v_last is not null and v_last > current_date then
      raise exception 'bad_date';
    end if;

    insert into public.donors (code, blood_group, sector_id, last_donation_date)
    values ('D-' || nextval('public.donor_code_seq'), v_group, v_sector, coalesce(v_last, current_date - 365))
    returning id into v_donor;
    insert into public.donor_accounts (user_id, donor_id) values (new.id, v_donor);
  end if;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
