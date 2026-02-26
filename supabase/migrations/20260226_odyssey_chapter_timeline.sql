-- Odyssey chapter timeline extension
-- Adds storyline/chapter tracking and chapter transition validation.

alter table if exists public.ody_sessions
  add column if not exists storyline_id text not null default 'fire-dawn';

alter table if exists public.ody_sessions
  alter column chapter_id set default 'ch01';

alter table if exists public.ody_footprint_checkpoints
  add column if not exists storyline_id text not null default 'fire-dawn',
  add column if not exists chapter_id text not null default 'ch01';

update public.ody_footprint_checkpoints cp
set
  storyline_id = coalesce(cp.storyline_id, s.storyline_id, 'fire-dawn'),
  chapter_id = coalesce(cp.chapter_id, s.chapter_id, 'ch01')
from public.ody_sessions s
where cp.session_id = s.id;

create table if not exists public.ody_chapter_timeline (
  storyline_id text not null,
  chapter_id text not null,
  chapter_order integer not null check (chapter_order > 0),
  prev_chapter_id text,
  next_chapter_id text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (storyline_id, chapter_id),
  unique (storyline_id, chapter_order)
);

insert into public.ody_chapter_timeline (
  storyline_id,
  chapter_id,
  chapter_order,
  prev_chapter_id,
  next_chapter_id,
  enabled
)
values
  ('fire-dawn', 'ch01', 1, null, 'ch02', true),
  ('fire-dawn', 'ch02', 2, 'ch01', null, true)
on conflict (storyline_id, chapter_id) do update
set
  chapter_order = excluded.chapter_order,
  prev_chapter_id = excluded.prev_chapter_id,
  next_chapter_id = excluded.next_chapter_id,
  enabled = excluded.enabled,
  updated_at = now();

create or replace function public.ody_validate_chapter_transition(
  p_storyline_id text,
  p_from_chapter_id text,
  p_to_chapter_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_next text;
  v_target_enabled boolean;
begin
  select next_chapter_id
  into v_expected_next
  from public.ody_chapter_timeline
  where storyline_id = p_storyline_id
    and chapter_id = p_from_chapter_id
    and enabled = true;

  if v_expected_next is null then
    return false;
  end if;

  if v_expected_next <> p_to_chapter_id then
    return false;
  end if;

  select enabled
  into v_target_enabled
  from public.ody_chapter_timeline
  where storyline_id = p_storyline_id
    and chapter_id = p_to_chapter_id;

  return coalesce(v_target_enabled, false);
end;
$$;

drop function if exists public.ody_start_session(text, text, text, text, integer);

create or replace function public.ody_start_session(
  p_display_name text,
  p_storyline_id text,
  p_chapter_id text,
  p_start_node_id text,
  p_day_night text default 'DAY',
  p_session_ttl_seconds integer default 21600
)
returns table (
  session_id text,
  session_token text,
  player_id uuid,
  display_name text,
  storyline_id text,
  chapter_id text,
  current_node_id text,
  day_night text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  name_conflict boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_normalized_display_name text;
  v_player_id uuid;
  v_session_id text;
  v_session_token text;
  v_created_at timestamptz;
  v_updated_at timestamptz;
begin
  perform public.ody_cleanup_expired_sessions();

  if not exists (
    select 1
    from public.ody_chapter_timeline t
    where t.storyline_id = p_storyline_id
      and t.chapter_id = p_chapter_id
      and t.enabled = true
  ) then
    raise exception 'chapter_disabled';
  end if;

  v_display_name := btrim(p_display_name);
  if length(v_display_name) < 2 or length(v_display_name) > 12 then
    raise exception 'invalid_display_name';
  end if;

  v_normalized_display_name := lower(v_display_name);
  v_session_id := 'session-' || gen_random_uuid()::text;
  v_session_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.ody_players (display_name, normalized_display_name)
  values (v_display_name, v_normalized_display_name)
  returning id into v_player_id;

  insert into public.ody_sessions (
    id,
    player_id,
    session_token,
    storyline_id,
    chapter_id,
    current_node_id,
    status,
    day_night,
    expires_at
  )
  values (
    v_session_id,
    v_player_id,
    v_session_token,
    p_storyline_id,
    p_chapter_id,
    p_start_node_id,
    'ACTIVE',
    p_day_night,
    now() + make_interval(secs => p_session_ttl_seconds)
  )
  returning created_at, updated_at into v_created_at, v_updated_at;

  insert into public.ody_name_locks (
    normalized_display_name,
    display_name,
    session_id,
    expires_at
  )
  values (
    v_normalized_display_name,
    v_display_name,
    v_session_id,
    now() + make_interval(secs => p_session_ttl_seconds)
  )
  on conflict (normalized_display_name) do nothing;

  if not found then
    delete from public.ody_sessions where id = v_session_id;

    return query
    select
      null::text,
      null::text,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      null::timestamptz,
      null::timestamptz,
      true;
    return;
  end if;

  insert into public.ody_visited_nodes (session_id, node_id)
  values (v_session_id, p_start_node_id)
  on conflict do nothing;

  insert into public.ody_footprint_checkpoints (
    checkpoint_id,
    session_id,
    storyline_id,
    chapter_id,
    node_id,
    plot_cursor,
    metadata
  )
  values (
    'cp-' || v_session_id || '-1',
    v_session_id,
    p_storyline_id,
    p_chapter_id,
    p_start_node_id,
    0,
    jsonb_build_object('reason', 'chapter_start')
  )
  on conflict do nothing;

  insert into public.ody_sidequest_states (session_id, state)
  values (v_session_id, 'IDLE')
  on conflict (session_id) do update set state = excluded.state, updated_at = now();

  return query
  select
    v_session_id,
    v_session_token,
    v_player_id,
    v_display_name,
    p_storyline_id,
    p_chapter_id,
    p_start_node_id,
    p_day_night,
    'ACTIVE'::text,
    v_created_at,
    v_updated_at,
    false;
end;
$$;

drop function if exists public.ody_authorize_session(text, text, integer);

create or replace function public.ody_authorize_session(
  p_session_id text,
  p_session_token text,
  p_session_ttl_seconds integer default 21600
)
returns table (
  session_id text,
  session_token text,
  player_id uuid,
  display_name text,
  storyline_id text,
  chapter_id text,
  current_node_id text,
  current_branch_tag text,
  day_night text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ody_cleanup_expired_sessions();

  return query
  with touched as (
    update public.ody_sessions s
    set
      expires_at = now() + make_interval(secs => p_session_ttl_seconds),
      updated_at = now()
    where
      s.id = p_session_id
      and s.session_token = p_session_token
      and s.expires_at > now()
    returning s.*
  ), touch_lock as (
    update public.ody_name_locks l
    set expires_at = now() + make_interval(secs => p_session_ttl_seconds)
    where l.session_id in (select id from touched)
    returning l.session_id
  )
  select
    t.id,
    t.session_token,
    t.player_id,
    p.display_name,
    t.storyline_id,
    t.chapter_id,
    t.current_node_id,
    t.current_branch_tag,
    t.day_night,
    t.status,
    t.created_at,
    t.updated_at
  from touched t
  join public.ody_players p on p.id = t.player_id;
end;
$$;
