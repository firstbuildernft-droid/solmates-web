-- =====================================================================
-- Solmates — 0008: unmatch, reports, notification counts
-- Run in Supabase SQL Editor after 0007_face.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Reports. A report flags the profile for you AND quietly hides that
-- person from the reporter (via a block) so she doesn't keep seeing
-- someone she just reported. The reported person is never told.
-- ---------------------------------------------------------------------
create table reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references profiles on delete cascade,
  reported_id  uuid not null references profiles on delete cascade,
  reason       text,
  status       text not null default 'open',   -- 'open' | 'reviewed' | 'actioned'
  created_at   timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

create index reports_status_idx on reports (status, created_at desc);
create index reports_reported_idx on reports (reported_id);

alter table reports enable row level security;

-- A user can file a report and see their own. They cannot see reports
-- filed against them, or anyone else's — only you (service role) see all.
create policy reports_insert on reports for insert to authenticated
  with check (auth.uid() = reporter_id);
create policy reports_read_own on reports for select to authenticated
  using (auth.uid() = reporter_id);


-- ---------------------------------------------------------------------
-- Unmatch: delete the match; messages and reads cascade automatically
-- (both have "on delete cascade" against matches). This makes the chat
-- disappear for BOTH people, which is what you asked for.
--
-- We also drop a block in so an unmatch doesn't immediately re-surface
-- them in the deck. (If you'd rather unmatch NOT block, remove the
-- insert into blocks below.)
-- ---------------------------------------------------------------------
create or replace function unmatch(match uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  other uuid;
begin
  select case when user_a = me then user_b else user_a end
    into other
  from matches
  where id = match and (user_a = me or user_b = me);

  if other is null then
    raise exception 'not your match';
  end if;

  delete from matches where id = match;

  insert into blocks (blocker_id, blocked_id, reason)
  values (me, other, 'unmatched')
  on conflict do nothing;
end;
$$;

revoke execute on function unmatch(uuid) from public;
grant execute on function unmatch(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- Report: file it, and hide them from the reporter via a block.
-- ---------------------------------------------------------------------
create or replace function report_profile(target uuid, why text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if target = me then
    raise exception 'cannot report yourself';
  end if;

  insert into reports (reporter_id, reported_id, reason)
  values (me, target, why);

  -- quietly hide them from the reporter, and undo any match/chat
  insert into blocks (blocker_id, blocked_id, reason)
  values (me, target, 'reported')
  on conflict do nothing;

  delete from matches
  where (user_a = me and user_b = target)
     or (user_a = target and user_b = me);
end;
$$;

revoke execute on function report_profile(uuid, text) from public;
grant execute on function report_profile(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- The two badge numbers, in one call:
--   new_matches   = matches with no messages yet
--   unread_msgs   = messages from others you haven't read
-- ---------------------------------------------------------------------
create or replace function badge_counts()
returns table (new_matches int, unread_msgs int)
language sql
security definer
stable
set search_path = public
as $$
  select
    (
      select count(*)::int
      from matches m
      where (m.user_a = auth.uid() or m.user_b = auth.uid())
        and not exists (select 1 from messages x where x.match_id = m.id)
    ),
    (
      select count(*)::int
      from messages msg
      join matches m on m.id = msg.match_id
      left join match_reads r
        on r.match_id = m.id and r.user_id = auth.uid()
      where (m.user_a = auth.uid() or m.user_b = auth.uid())
        and msg.sender_id <> auth.uid()
        and msg.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
    );
$$;

revoke execute on function badge_counts() from public;
grant execute on function badge_counts() to authenticated;
