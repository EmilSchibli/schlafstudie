-- Studienkonto, einmal im SQL-Editor von Supabase ausführen.
-- Danach unter Authentication einen Benutzer mit E-Mail und Kennwort anlegen.
-- Dieselbe Anmeldung gilt für alle Handys und den Auswertungscomputer.
-- Der anonyme Schlüssel der App darf lesen und schreiben nur nach dieser Anmeldung.

create table if not exists public.days (
  participant_id text not null,
  date text not null,
  payload jsonb not null,
  primary key (participant_id, date),
  constraint days_participant check (participant_id in ('P1', 'P2', 'P3')),
  constraint days_date check (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
);

create table if not exists public.pvt_trials (
  session_id text not null,
  attempt integer not null,
  trial_index integer not null,
  payload jsonb not null,
  primary key (session_id, attempt, trial_index)
);

create table if not exists public.dsst_trials (
  session_id text not null,
  attempt integer not null,
  trial_index integer not null,
  payload jsonb not null,
  primary key (session_id, attempt, trial_index)
);

create table if not exists public.attempts (
  session_id text not null,
  test text not null,
  attempt integer not null,
  payload jsonb not null,
  primary key (session_id, test, attempt),
  constraint attempts_test check (test in ('pvt', 'dsst'))
);

alter table public.days enable row level security;
alter table public.pvt_trials enable row level security;
alter table public.dsst_trials enable row level security;
alter table public.attempts enable row level security;

revoke all on table public.days from anon, public;
revoke all on table public.pvt_trials from anon, public;
revoke all on table public.dsst_trials from anon, public;
revoke all on table public.attempts from anon, public;

grant select, insert, update on table public.days to authenticated;
grant select, insert, update on table public.pvt_trials to authenticated;
grant select, insert, update on table public.dsst_trials to authenticated;
grant select, insert, update on table public.attempts to authenticated;

drop policy if exists days_read on public.days;
drop policy if exists days_insert on public.days;
drop policy if exists days_update on public.days;
create policy days_read on public.days for select to authenticated using (true);
create policy days_insert on public.days for insert to authenticated with check (true);
create policy days_update on public.days for update to authenticated using (true) with check (true);

drop policy if exists pvt_read on public.pvt_trials;
drop policy if exists pvt_insert on public.pvt_trials;
drop policy if exists pvt_update on public.pvt_trials;
create policy pvt_read on public.pvt_trials for select to authenticated using (true);
create policy pvt_insert on public.pvt_trials for insert to authenticated with check (true);
create policy pvt_update on public.pvt_trials for update to authenticated using (true) with check (true);

drop policy if exists dsst_read on public.dsst_trials;
drop policy if exists dsst_insert on public.dsst_trials;
drop policy if exists dsst_update on public.dsst_trials;
create policy dsst_read on public.dsst_trials for select to authenticated using (true);
create policy dsst_insert on public.dsst_trials for insert to authenticated with check (true);
create policy dsst_update on public.dsst_trials for update to authenticated using (true) with check (true);

drop policy if exists attempts_read on public.attempts;
drop policy if exists attempts_insert on public.attempts;
drop policy if exists attempts_update on public.attempts;
create policy attempts_read on public.attempts for select to authenticated using (true);
create policy attempts_insert on public.attempts for insert to authenticated with check (true);
create policy attempts_update on public.attempts for update to authenticated using (true) with check (true);
