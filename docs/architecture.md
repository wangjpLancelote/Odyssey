# Architecture Overview

## Goals
- Chapter-driven mainline narrative with fixed must-pass nodes.
- AI-generated sidequests under state-machine and canon constraints.
- Private player footprint map with checkpoint restore.
- Day/night driven by system time.
- Comic storyboard cutscenes rendered in PixiJS, orchestrated by GSAP, sounded by Howler.js.

## Layering
- `packages/domain`: canonical data and core mechanics (rank, bloodline, word spirit).
- `packages/engine`: state machine, plot tree, footprint, canon guard, queue idempotency.
- `packages/ai`: LLM adapter and constrained sidequest generation.
- `packages/scene-dsl`: low-nesting storyboard DSL and timeline compiler.
- `apps/web`: UI, API routes, and BFF runtime.
- `services/worker`: asynchronous queue consumer skeleton.

## Multiplayer-ready (async shared world)
- Session and queue models include realm-level expansion points.
- Realtime event contracts are versioned even before transport implementation.

## MVP Contracts
- Mainline is immutable in runtime.
- Sidequest candidates only persist after canon validation.
- Footprints are private by default.
- No login/register module; session identity is anonymous with display name + session token.

## AV Pipeline
- PixiJS: layered frame rendering.
- GSAP: timeline and transition choreography.
- Howler.js: bus-level BGM/SFX/Voice control + fade orchestration.
