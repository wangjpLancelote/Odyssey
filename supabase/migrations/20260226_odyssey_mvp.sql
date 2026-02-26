-- Odyssey MVP schema for Supabase
-- Focus: anonymous sessions, display names, duplicate-name locking, footprints, plot edges.

create extension if not exists pgcrypto;

create table if not exists public.ody_players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  normalized_display_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists ody_players_normalized_idx
  on public.ody_players (normalized_display_name);

create table if not exists public.ody_sessions (
  id text primary key,
  player_id uuid not null references public.ody_players(id) on delete cascade,
  session_token text not null unique,
  chapter_id text not null,
  current_node_id text not null,
  current_branch_tag text,
  status text not null check (status in ('ACTIVE', 'PAUSED', 'FINISHED')),
  day_night text not null check (day_night in ('DAY', 'NIGHT')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ody_sessions_expires_idx
  on public.ody_sessions (expires_at);

create table if not exists public.ody_name_locks (
  normalized_display_name text primary key,
  display_name text not null,
  session_id text not null unique references public.ody_sessions(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists ody_name_locks_expires_idx
  on public.ody_name_locks (expires_at);

create table if not exists public.ody_plot_edges (
  id bigserial primary key,
  session_id text not null references public.ody_sessions(id) on delete cascade,
  from_node_id text not null,
  to_node_id text not null,
  choice_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists ody_plot_edges_session_idx
  on public.ody_plot_edges (session_id, id);

create table if not exists public.ody_visited_nodes (
  session_id text not null references public.ody_sessions(id) on delete cascade,
  node_id text not null,
  created_at timestamptz not null default now(),
  primary key (session_id, node_id)
);

create table if not exists public.ody_footprint_checkpoints (
  checkpoint_id text primary key,
  session_id text not null references public.ody_sessions(id) on delete cascade,
  node_id text not null,
  plot_cursor integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ody_footprint_checkpoints_session_idx
  on public.ody_footprint_checkpoints (session_id, created_at);

create table if not exists public.ody_sidequest_states (
  session_id text primary key references public.ody_sessions(id) on delete cascade,
  state text not null check (state in ('IDLE', 'ELIGIBLE', 'GENERATING', 'ACTIVE', 'RESOLVED', 'FAILED')),
  updated_at timestamptz not null default now()
);

create or replace function public.ody_cleanup_expired_sessions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.ody_sessions where expires_at <= now();
  delete from public.ody_name_locks where expires_at <= now();
end;
$$;

create or replace function public.ody_start_session(
  p_display_name text,
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
    node_id,
    plot_cursor,
    metadata
  )
  values (
    'cp-' || v_session_id || '-1',
    v_session_id,
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
    p_chapter_id,
    p_start_node_id,
    p_day_night,
    'ACTIVE'::text,
    v_created_at,
    v_updated_at,
    false;
end;
$$;

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
