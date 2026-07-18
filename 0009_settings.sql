-- =====================================================================
-- Solmates — 0009: settings
-- Run in Supabase SQL Editor after 0008_social.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Settings columns on the profile.
--   paused        — hidden from everyone's deck, account intact
--   distance_unit — 'km' | 'mi', display only
--   notif_*       — which emails/pushes they want
--   language      — 'en' now; the column exists so switching later is
--                   data, not a migration
-- ---------------------------------------------------------------------
alter table profiles add column if not exists paused boolean not null default false;
alter table profiles add column if not exists distance_unit text not null default 'km';
alter table profiles add column if not exists notif_matches boolean not null default true;
alter table profiles add column if not exists notif_messages boolean not null default true;
alter table profiles add column if not exists notif_likes boolean not null default true;
alter table profiles add column if not exists language text not null default 'en';


-- ---------------------------------------------------------------------
-- discover(): also hide paused profiles. Same as 0008 plus one line.
-- ---------------------------------------------------------------------
create or replace function discover(limit_n int default 20)
returns table (
  id uuid, display_name text, age int, city text, bio text,
  height_cm smallint, weight_kg smallint, gym boolean, drinks boolean,
  smokes boolean, face_verified boolean, wallet_address text,
  wallet_verified boolean, sol_balance numeric, photos text[], trades text[]
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id, p.display_name,
    extract(year from age(p.birthdate))::int,
    p.city, p.bio, p.height_cm, p.weight_kg, p.gym, p.drinks, p.smokes,
    p.face_verified, w.address, (w.id is not null), b.sol_balance,
    coalesce((select array_agg(ph.storage_path order by ph.position)
              from photos ph where ph.user_id = p.id), '{}'),
    coalesce((select array_agg(t.label order by t.position)
              from trades t where t.user_id = p.id), '{}')
  from profiles p
  left join wallets w on w.user_id = p.id and w.state = 'verified'
  left join wallet_balances b on b.address = w.address
  where p.id <> auth.uid()
    and p.onboarded
    and not p.paused
    and p.gender <> (select gender from profiles where id = auth.uid())
    and not exists (
      select 1 from swipes s
      where s.swiper_id = auth.uid() and s.target_id = p.id
    )
    and not is_blocked(auth.uid(), p.id)
    and exists (select 1 from photos ph where ph.user_id = p.id)
  order by (w.id is not null) desc, random()
  limit limit_n;
$$;

revoke execute on function discover(int) from public;
grant execute on function discover(int) to authenticated;


-- ---------------------------------------------------------------------
-- The people I've blocked, with names, for the settings list.
-- ---------------------------------------------------------------------
create or replace function my_blocks()
returns table (blocked_id uuid, name text, photo text, created_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select
    b.blocked_id,
    p.display_name,
    (select ph.storage_path from photos ph
     where ph.user_id = b.blocked_id order by ph.position limit 1),
    b.created_at
  from blocks b
  join profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

revoke execute on function my_blocks() from public;
grant execute on function my_blocks() to authenticated;


-- ---------------------------------------------------------------------
-- Unblock. Removing the block is enough — it doesn't restore the old
-- match (that was deleted), it just lets them see each other in the deck
-- again, which is the expected behaviour.
-- ---------------------------------------------------------------------
create or replace function unblock(target uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from blocks where blocker_id = auth.uid() and blocked_id = target;
$$;

revoke execute on function unblock(uuid) from public;
grant execute on function unblock(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- Delete my account. Required by the App Store — a user must be able to
-- delete themselves, fully.
--
-- Deleting the auth user cascades to the profile (profiles.id references
-- auth.users on delete cascade), and the profile cascades to photos,
-- swipes, matches, messages, wallets, etc. One delete, everything goes.
--
-- This runs as the service role (called from a server route that checks
-- the session first) because a user can't delete from auth.users via RLS.
-- Storage files are cleaned up in the route, since SQL can't reach the
-- storage bucket.
-- ---------------------------------------------------------------------
-- (No SQL function needed — the /api/account/delete route uses the admin
--  client's auth.admin.deleteUser(). Documented here so the cascade
--  chain is on the record.)
