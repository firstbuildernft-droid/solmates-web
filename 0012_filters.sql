-- =====================================================================
-- Solmates — 0012: search filters (age, distance, SOL balance, verified)
-- Run in Supabase SQL Editor.
-- Filters live on the user's own profile row, so they persist across
-- sessions and discover() reads them directly — no params to plumb.
-- =====================================================================

alter table profiles add column if not exists f_min_age smallint not null default 18;
alter table profiles add column if not exists f_max_age smallint not null default 99;
alter table profiles add column if not exists f_max_km integer;          -- null = any distance
alter table profiles add column if not exists f_min_sol numeric not null default 0;
alter table profiles add column if not exists f_verified_only boolean not null default false;

drop function if exists discover(integer);

create function discover(limit_n int default 20)
returns table (
  id uuid, display_name text, age int, city text, bio text,
  height_cm smallint, weight_kg smallint, gym boolean, drinks boolean,
  smokes boolean, face_verified boolean, wallet_address text,
  wallet_verified boolean, sol_balance numeric, photos text[], trades text[],
  distance_km int, prompt_qs text[], prompt_as text[]
)
language sql security definer stable set search_path = public
as $$
  with me as (
    select lat, lng, gender,
           f_min_age, f_max_age, f_max_km, f_min_sol, f_verified_only
    from profiles where id = auth.uid()
  )
  select
    p.id, p.display_name, extract(year from age(p.birthdate))::int,
    p.city, p.bio, p.height_cm, p.weight_kg, p.gym, p.drinks, p.smokes,
    p.face_verified, w.address, (w.id is not null), b.sol_balance,
    coalesce((select array_agg(ph.storage_path order by ph.position) from photos ph where ph.user_id = p.id), '{}'),
    coalesce((select array_agg(t.label order by t.position) from trades t where t.user_id = p.id), '{}'),
    round(km_between((select lat from me), (select lng from me), p.lat, p.lng))::int,
    coalesce((select array_agg(pr.prompt order by pr.position) from prompts pr where pr.user_id = p.id), '{}'),
    coalesce((select array_agg(pr.answer order by pr.position) from prompts pr where pr.user_id = p.id), '{}')
  from profiles p
  left join wallets w on w.user_id = p.id and w.state = 'verified'
  left join wallet_balances b on b.address = w.address
  where p.id <> auth.uid() and p.onboarded and not p.paused
    and p.gender <> (select gender from me)
    and not exists (select 1 from swipes s where s.swiper_id = auth.uid() and s.target_id = p.id)
    and not is_blocked(auth.uid(), p.id)
    and exists (select 1 from photos ph where ph.user_id = p.id)

    -- ---- filters ----
    -- Age: always applied (defaults 18-99 let everyone through).
    and extract(year from age(p.birthdate))::int
        between (select f_min_age from me) and (select f_max_age from me)

    -- Distance: skipped when the filter is null, or when either side has
    -- no location (don't punish people we can't measure).
    and (
      (select f_max_km from me) is null
      or (select lat from me) is null
      or p.lat is null
      or km_between((select lat from me), (select lng from me), p.lat, p.lng)
         <= (select f_max_km from me)
    )

    -- Minimum SOL: only meaningful for verified wallets. A 0 minimum
    -- (the default) lets unverified people through too.
    and (
      (select f_min_sol from me) <= 0
      or (w.id is not null and coalesce(b.sol_balance, 0) >= (select f_min_sol from me))
    )

    -- Verified only: wallet-verified OR face-verified counts as verified.
    and (
      not (select f_verified_only from me)
      or w.id is not null
      or p.face_verified
    )

  order by (w.id is not null) desc,
    km_between((select lat from me), (select lng from me), p.lat, p.lng) asc nulls last,
    random()
  limit limit_n;
$$;

grant execute on function discover(int) to authenticated;


-- Save filters in one call.
create or replace function set_filters(
  min_age int, max_age int, max_km int,
  min_sol numeric, verified_only boolean
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update profiles set
    f_min_age       = greatest(18, least(coalesce(min_age, 18), 99))::smallint,
    f_max_age       = greatest(18, least(coalesce(max_age, 99), 99))::smallint,
    f_max_km        = max_km,
    f_min_sol       = greatest(0, coalesce(min_sol, 0)),
    f_verified_only = coalesce(verified_only, false)
  where id = auth.uid();
end;
$$;

grant execute on function set_filters(int, int, int, numeric, boolean) to authenticated;


-- Read them back for the filter sheet.
create or replace function my_filters()
returns table (
  min_age int, max_age int, max_km int,
  min_sol numeric, verified_only boolean
)
language sql security definer stable set search_path = public
as $$
  select f_min_age::int, f_max_age::int, f_max_km, f_min_sol, f_verified_only
  from profiles where id = auth.uid();
$$;

grant execute on function my_filters() to authenticated;
