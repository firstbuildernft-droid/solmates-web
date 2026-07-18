-- =====================================================================
-- Solmates — 0007: face verification
-- Run in Supabase SQL Editor after 0006_fix_storage.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Every attempt, pass or fail. This is the rate-limit ledger AND your
-- window into whether the flow is broken vs whether people are faking.
--
-- We store the SIMILARITY SCORE and outcome — never the selfie itself.
-- The selfie is compared in memory and thrown away in the same request.
-- Storing biometric images is a KVKK/GDPR liability you don't want and
-- don't need.
-- ---------------------------------------------------------------------
create table face_attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles on delete cascade,
  passed     boolean not null,
  similarity real,             -- 0-100, or null if no face / error
  reason     text,             -- 'ok' | 'no_face' | 'no_match' | 'multiple_faces' | 'no_photos' | 'error'
  created_at timestamptz not null default now()
);

create index face_attempts_user_idx on face_attempts (user_id, created_at desc);

alter table face_attempts enable row level security;

-- Users can see their own attempts (so the UI can show "1 try left").
-- Only the server writes them — a user can't mark themselves passed.
create policy face_attempts_read on face_attempts
  for select to authenticated using (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- How many attempts in the last 24h, and whether already verified.
-- One call, so the UI and the API agree on the same number.
-- ---------------------------------------------------------------------
create or replace function face_status()
returns table (
  verified       boolean,
  attempts_24h   int,
  attempts_left  int,
  last_reason    text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    (select face_verified from profiles where id = auth.uid()),
    coalesce(cnt.n, 0)::int,
    greatest(0, 2 - coalesce(cnt.n, 0))::int,
    (select reason from face_attempts
     where user_id = auth.uid() order by created_at desc limit 1)
  from (
    select count(*) as n from face_attempts
    where user_id = auth.uid()
      and created_at > now() - interval '24 hours'
  ) cnt;
$$;

revoke execute on function face_status() from public;
grant execute on function face_status() to authenticated;
