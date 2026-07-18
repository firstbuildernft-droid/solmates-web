-- =====================================================================
-- Solmates — 0010: location & distance
-- Run in Supabase SQL Editor after 0009_settings.sql
-- =====================================================================

-- lat/lng already exist on profiles (from 0001). We add:
--   location_updated_at — so we know how stale it is / can refresh
--   the raw coords stay server-side ONLY; they are never selected by any
--   function that returns to the client. Only rounded distance leaves.
alter table profiles add column if not exists location_updated_at timestamptz;

-- Index-ish helper: nothing fancy needed at your scale. Haversine in SQL
-- is fine for tens of thousands of rows; if you ever need more, this is
-- where PostGIS + a geography index would go.

-- ---------------------------------------------------------------------
-- Distance between two lat/lng points, in km. Haversine — no extension
-- required. Returns null if either point is missing.
-- ---------------------------------------------------------------------
create or replace function km_between(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else 6371 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lng2 - lng1) / 2), 2)
    ))
  end;
$$;

-- ---------------------------------------------------------------------
-- Set my location. The app sends real coords; we fuzz before storing so
-- even a database leak can't pinpoint a home address. ~500m of jitter,
-- plus we snap to ~2 decimal places (~1.1km grid). The distance a user
-- sees is rounded on top of this — defense in depth.
--
-- SECURITY DEFINER so it can write only the caller's own row.
-- ---------------------------------------------------------------------
create or replace function set_location(raw_lat double precision, raw_lng double precision)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  jitter_lat double precision;
  jitter_lng double precision;
begin
  if raw_lat is null or raw_lng is null
     or raw_lat < -90 or raw_lat > 90
     or raw_lng < -180 or raw_lng > 180 then
    raise exception 'bad coordinates';
  end if;

  -- +/- ~0.005 deg (~500m) random jitter, then round to 2dp.
  jitter_lat := round(((raw_lat + (random() - 0.5) * 0.01))::numeric, 2);
  jitter_lng := round(((raw_lng + (random() - 0.5) * 0.01))::numeric, 2);

  update profiles
  set lat = jitter_lat,
      lng = jitter_lng,
      location_updated_at = now()
  where id = auth.uid();
end;
$$;

revoke execute on function set_location(double precision, double precision) from public;
grant execute on function set_location(double precision, double precision) to authenticated;


-- ---------------------------------------------------------------------
-- discover(), now with distance_km. It computes distance from ME to each
-- candidate using the stored (already-fuzzed) coords, and returns it
-- ROUNDED. The candidate's raw lat/lng are NEVER in the output.
--
-- If either party has no location, distance_km is null and the card just
-- won't show a distance — matching the "deny -> see everyone, no
-- distance" choice.
-- ---------------------------------------------------------------------
create or replace function discover(limit_n int default 20)
returns table (
  id uuid, display_name text, age int, city text, bio text,
  height_cm smallint, weight_kg smallint, gym boolean, drinks boolean,
  smokes boolean, face_verified boolean, wallet_address text,
  wallet_verified boolean, sol_balance numeric, photos text[], trades text[],
  distance_km int
)
language sql
security definer
stable
set search_path = public
as $$
  with me as (select lat, lng, gender from profiles where id = auth.uid())
  select
    p.id, p.display_name,
    extract(year from age(p.birthdate))::int,
    p.city, p.bio, p.height_cm, p.weight_kg, p.gym, p.drinks, p.smokes,
    p.face_verified, w.address, (w.id is not null), b.sol_balance,
    coalesce((select array_agg(ph.storage_path order by ph.position)
              from photos ph where ph.user_id = p.id), '{}'),
    coalesce((select array_agg(t.label order by t.position)
              from trades t where t.user_id = p.id), '{}'),
    -- rounded so raw coords can't be reverse-engineered from the number
    round(km_between((select lat from me), (select lng from me), p.lat, p.lng))::int
  from profiles p
  left join wallets w on w.user_id = p.id and w.state = 'verified'
  left join wallet_balances b on b.address = w.address
  where p.id <> auth.uid()
    and p.onboarded
    and not p.paused
    and p.gender <> (select gender from me)
    and not exists (
      select 1 from swipes s
      where s.swiper_id = auth.uid() and s.target_id = p.id
    )
    and not is_blocked(auth.uid(), p.id)
    and exists (select 1 from photos ph where ph.user_id = p.id)
  order by
    (w.id is not null) desc,
    -- nearer first when we have distance; random otherwise
    km_between((select lat from me), (select lng from me), p.lat, p.lng)
      asc nulls last,
    random()
  limit limit_n;
$$;

revoke execute on function discover(int) from public;
grant execute on function discover(int) to authenticated;
