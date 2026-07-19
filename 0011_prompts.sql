-- =====================================================================
-- Solmates — 0011: profile prompts (Hinge-style questions)
-- Run in Supabase SQL Editor after 0010_location.sql
-- =====================================================================

-- A user picks a few prompts and answers them. Free text answer, capped.
-- The prompt itself is stored as text (not a foreign key to a prompts
-- table) so you can add/retire prompts in the app without a migration.
create table prompts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles on delete cascade,
  prompt     text not null,
  answer     text not null check (length(answer) between 1 and 250),
  position   smallint not null default 0,
  created_at timestamptz not null default now()
);

create index prompts_user_idx on prompts (user_id, position);

alter table prompts enable row level security;

create policy prompts_read on prompts for select to authenticated using (true);
create policy prompts_write on prompts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- discover() also returns each candidate's prompts, as parallel arrays
-- (prompt_qs / prompt_as), so the expanded profile can render them
-- without a second query.
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
  with me as (select lat, lng, gender from profiles where id = auth.uid())
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
  order by (w.id is not null) desc,
    km_between((select lat from me), (select lng from me), p.lat, p.lng) asc nulls last,
    random()
  limit limit_n;
$$;

grant execute on function discover(int) to authenticated;
