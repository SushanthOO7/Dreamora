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

Status: Completed

Delivered:

- Semantic search engine (`apps/api/src/semantic.ts`):
  - TF-IDF vectorization with bigram support
  - Cosine similarity scoring across prompts and runs
  - Replaces lexical keyword matching in suggestions endpoint
  - Dedicated search endpoint: `GET /api/studio/search`
- Workflow planner (`apps/api/src/planner.ts`):
  - Content signal detection (product, portrait, motion, typography, upscale)
  - Style classification (cinematic, editorial, noir, etc.)
  - Multi-step recipe generation with mode-specific pipelines
  - Quality-weighted run history for parameter recommendations
  - Planner endpoint: `POST /api/studio/plan`
- Quality scoring and feedback loop (`apps/api/src/scoring.ts`):
  - 1-5 run scoring with notes
  - Score-weighted recommendations in suggestions endpoint
  - Score persistence in store (run.score, run.scoreNotes fields)
  - Scoring endpoint: `POST /api/runs/:id/score`
  - Score distribution tracking
- Auto-regeneration policies:
  - Low quality retry (score <= 2)
  - Failure retry (up to 2 retries)
  - Timeout retry (disabled by default)
  - Parameter adjustments per policy (quality, batch, steps)
  - Policy management: `GET /api/policies`, `PATCH /api/policies/:id`
  - Runtime policy evaluation endpoint: `GET /api/generation/:id/policy`
  - Policy signal embedded in generation status response
- MCP orchestration integration:
  - JSON-RPC endpoint: `POST /api/mcp`
  - Tool registry and dispatch for:
    - semantic memory search
    - assistant workflow planning
    - generation start
    - generation status
    - regeneration policy evaluation
- Studio frontend updates:
  - Workflow planner panel with step visualization
  - Apply plan settings button
  - Run scoring buttons (1-5) on completed runs
  - Score feedback toast with regeneration decision display
  - Runtime notice when policy recommends retry on completed/failed jobs

Known limitations:

- Semantic index is in-memory, rebuilt on each suggestions request
- Scoring is in-memory (not persisted across restarts except via store.score field)
- MCP endpoint is local-only and not yet split into a standalone server process
- No automatic retry execution yet (policies return recommendations; retries are not auto-submitted)

## Stage 7 - Production Hardening

Status: Completed (v1 reference library slice)

Delivered:

- Store schema extensions:
  - `assets[]` collection
  - optional `projectId` linkage for prompts/runs
  - `referenceAssetIds[]` persisted on runs
- Local asset service in `apps/api/src/assets.ts`:
  - validated image mime handling
  - deterministic project/global file pathing
  - file write/existence/delete helpers
- Asset and cascade APIs:
  - `POST /api/assets/upload`
  - `GET /api/assets`
  - `GET /api/assets/:id/file`
  - `DELETE /api/assets/:id`
  - `DELETE /api/projects/:id` with project-level cascade delete
- Generation reference support:
  - accepts `projectId` + `referenceAssetIds`
  - validates max 5 references
  - enforces exactly one primary among selected references
  - enforces project/global scope compatibility
  - passes reference metadata into Comfy workflow token substitution
- Studio UI updates:
  - project selector with global fallback when no project is selected
  - reference upload controls (role/weight + image file)
  - selection and hard-delete actions
  - generation payload includes selected project and reference IDs

Known limitations:

- Reference role/weight is defined at upload time (no dedicated edit endpoint yet)
- Hard-delete behavior is strict by design; unselect action deletes the local file and library record

## Stage 8 - Production Hardening

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
4. Harden Stage 6 orchestration with durable memory index + automatic retry worker.
