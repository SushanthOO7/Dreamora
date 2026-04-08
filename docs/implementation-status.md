# Dreamora Implementation Status

This document tracks what is implemented, what is partial, and what is still pending.

## Stage 1 - Foundation UI

Status: Completed

Delivered:

- Landing page and visual direction
- Minimal premium styling baseline
- App shell direction aligned to requested reference style

## Stage 2 - Product Surface

Status: Completed

Delivered:

- Route structure:
  - `/studio`
  - `/models`
  - `/projects`
  - `/prompts`
  - `/providers`
  - `/runs`
  - `/reports`
  - `/settings`
- Shared workspace shell components
- Minimal setup cards and stage progression UI

## Stage 3 - Persistence and Core CRUD

Status: Completed

Delivered:

- Fastify API service in `apps/api`
- JSON persistence in `apps/api/data/store.json`
- CRUD-style endpoints for projects, prompts, runs, providers
- Provider credential state update endpoint
- Reporting endpoint with metric aggregation

Known limitations:

- File store is single-node and not suitable for concurrent multi-instance writes
- No transactional guarantees beyond process-level write queue

## Stage 4 - Generation Orchestration

Status: Completed

Delivered:

- Generation API:
  - `POST /api/generation/start`
  - `GET /api/generation/:id`
- ComfyUI submission path using workflow templates
- Token substitution in workflow JSON:
  - `__PROMPT__`, `__MODEL__`, `__WIDTH__`, `__HEIGHT__`, `__STEPS__`, `__BATCH__`, `__RUN_ID__`
- Comfy history polling and run finalization
- Automatic simulated fallback with explicit reason returned to UI
- Runtime env diagnostics endpoint (`GET /api/runtime`)

Known limitations:

- No dedicated queue broker yet (jobs are in-memory)
- Fallback mode is simulation, not provider failover execution

## Stage 5 - Productivity Layer (v1)

Status: Completed (v1)

Delivered:

- Prompt memory endpoint: `GET /api/studio/suggestions`
- Prompt retrieval from stored presets using lexical score
- Recent completed run retrieval and comparison cards
- Frequency-based recommendation:
  - model
  - aspect ratio
  - quality
  - batch size
  - average tokens
- Studio actions:
  - Analyze Prompt
  - Apply Best Settings

Known limitations:

- Retrieval is lexical/frequency based, not semantic vector retrieval
- No feedback loop scoring output quality yet

## Stage 6 - Intelligent Orchestration

Status: Planned

Planned scope:

- Semantic RAG (embedding + vector search for prompts/references)
- Assistant planner for multi-step generation recipes
- MCP server integration for workflow tool orchestration
- Policy-based auto-regeneration rules

## Stage 7 - Production Hardening

Status: Planned

Planned scope:

- Authentication and authorization
- Secret encryption at rest for third-party provider keys
- Background job queue (Redis/BullMQ or equivalent)
- Observability: structured logs, traces, error tracking
- Output artifact catalog and preview index
- Multi-user workspace/project isolation

## Environment Baseline

Verified baseline for this repository:

- Node 20+
- npm workspaces
- Python 3.11 for ComfyUI
- Comfy workflow templates in `apps/api/workflows`

## Immediate Next Priorities

1. Replace JSON file store with database-backed persistence (PostgreSQL + Prisma or Drizzle).
2. Add encrypted provider secret vault and never store raw keys in plain JSON.
3. Add robust worker queue and durable job state for generation lifecycle.
4. Implement Stage 6 semantic retrieval and assistant orchestration.
