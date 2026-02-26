# Supabase Setup (MVP)

1. Create a Supabase project.
2. Run SQL in `supabase/migrations/20260226_odyssey_mvp.sql`.
3. Set env vars in `apps/web` runtime:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Start app with `bun run dev:web`.

## Name collision rule
- Name uniqueness is enforced by `public.ody_name_locks.normalized_display_name`.
- Expired sessions are cleaned in `ody_cleanup_expired_sessions()`.
- Session start uses `ody_start_session()` atomically to lock name and create session.
