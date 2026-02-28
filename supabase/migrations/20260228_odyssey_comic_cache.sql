-- Odyssey comic sequence compile cache
-- Stores precompiled comic payloads keyed by chapter/session runtime context.

create table if not exists public.ody_comic_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  storyline_id text not null,
  chapter_id text not null,
  node_id text null,
  source_type text not null check (source_type in ('chapter_intro', 'dialogue_node')),
  style text not null check (style in ('hero_bright')),
  source_hash text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ody_comic_cache_storyline_chapter_idx
  on public.ody_comic_cache (storyline_id, chapter_id, source_type);

create index if not exists ody_comic_cache_node_idx
  on public.ody_comic_cache (node_id)
  where node_id is not null;

create or replace function public.ody_touch_comic_cache_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ody_comic_cache_touch_updated_at on public.ody_comic_cache;

create trigger ody_comic_cache_touch_updated_at
before update on public.ody_comic_cache
for each row
execute function public.ody_touch_comic_cache_updated_at();
