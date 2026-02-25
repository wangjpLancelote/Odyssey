# Odyssey MVP

Monorepo scaffold for a dialogue-driven narrative game inspired by Longzu.

## Stack
- Bun workspaces
- Next.js + shadcn-style UI + PixiJS + GSAP + Howler.js
- PostgreSQL + Prisma
- Cloudflare R2 (asset storage contract)

## Run
1. `bun install`
2. `bun run dev:web`
3. `bun run dev:worker`

## Current scope
- No login/register; player enters with name gate (random/custom).
- Chapter-driven mainline scaffold
- AI sidequest state machine scaffold
- Footprint map with checkpoint restore API
- Day/night detection from system time
- Scene DSL (JSON modules + plan) compiled to runtime timeline
