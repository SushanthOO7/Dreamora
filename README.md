# Dreamora

Dreamora is a monorepo for a personal productivity app focused on image and video generation workflows.

The product direction is:

1. Keep UI minimal: model, aspect ratio, quality, batch (image only), prompt.
2. Push complexity to orchestration and memory retrieval.
3. Run locally on a single server with ComfyUI, plus optional third-party providers.

## Stage Status

Implemented:

- Stage 1: landing and visual system
- Stage 2: app shell, route structure, workspace UI
- Stage 3: backend persistence and create flows
- Stage 4: generation orchestration (ComfyUI + fallback)
- Stage 5 (v1): prompt memory and settings recommendation
- Stage 6: semantic retrieval, planner, policies, MCP orchestration
- Stage 7 (v1): reference library with project/global scope, up to 5 context images, and hard-delete behavior

Planned and left:

- Stage 8: production hardening (auth, encrypted secret vault, queue workers, observability, multi-user support)

Full checklist: `docs/implementation-status.md`

## Monorepo Structure

```text
Dreamora/
  apps/
    web/                 Next.js app (UI and App Router pages)
    api/                 Fastify API (orchestration + persistence)
  packages/
    shared/              shared types and seeded constants
  docs/
    architecture.md      architecture details
    implementation-status.md
  README.md
```

## Architecture

Frontend:

- Next.js 15, React 19, Tailwind 4
- Route pages: `/`, `/studio`, `/models`, `/projects`, `/prompts`, `/providers`, `/runs`, `/reports`, `/settings`
- Client-side generation controls and workflow animation in `apps/web/components/studio-workbench.tsx`
- API calls go through `/api/*` rewrite proxy in `apps/web/next.config.ts`

Backend:

- Fastify 5 in `apps/api/src/server.ts`
- JSON store in `apps/api/src/store.ts` persisted to `apps/api/data/store.json`
- ComfyUI orchestration in `apps/api/src/generation.ts`
- Runtime env bootstrap in `apps/api/src/env.ts`

Shared contracts:

- `@dreamora/shared` package (`packages/shared/src/index.ts`) provides:
  - shared types
  - seeded defaults for dashboard, models, providers, prompts, runs

## Implemented Features

Studio:

- Minimal control bar:
  - mode (`image` / `video`)
  - model
  - aspect ratio
  - quality
  - batch size (image only)
- Prompt editor with preset chips
- Reference library panel:
  - project-scoped or global fallback assets
  - upload with role/weight metadata
  - select up to 5 references
  - strict unselect/delete flow that permanently removes local files
- Animated workflow execution panel (Framer Motion)
- Run polling and status cards
- Backend notice for Comfy or fallback mode

Persistence:

- Create and list projects
- Create and list prompts
- Create and list runs and update run status
- Create providers and toggle credential-configured state
- Reporting metrics from stored runs

Generation orchestration:

- `POST /api/generation/start` creates run + generation job
- Attempts Comfy submit when `COMFY_ENABLED=1`
- Falls back to simulated backend on failure and returns reason
- `GET /api/generation/:id` polls backend job status

Stage 5 productivity:

- `GET /api/studio/suggestions?mode=&query=`
- Prompt match retrieval from stored presets
- Top completed runs retrieval
- Frequency-based recommended model/ratio/quality/batch
- "Analyze Prompt" + "Apply Best Settings" in Studio

Stage 6 orchestration:

- TF-IDF semantic retrieval index for prompts and completed runs
- Workflow planner endpoint and Studio plan panel
- Run scoring + policy endpoints for regeneration decisions
- Generation status now includes policy decision metadata
- MCP-compatible JSON-RPC orchestration endpoint (`POST /api/mcp`)

Stage 7 reference library (v1):

- Project/global scoped reference image library persisted on local disk
- `POST /api/assets/upload`, `GET /api/assets`, `GET /api/assets/:id/file`, `DELETE /api/assets/:id`
- `DELETE /api/projects/:id` cascades through related project assets/runs/prompts
- Generation now accepts `projectId` + `referenceAssetIds` (up to 5)
- Workflow token expansion for reference-aware templates:
  - `__REF_COUNT__`
  - `__REF1_PATH__ ... __REF5_PATH__`
  - `__REF1_WEIGHT__ ... __REF5_WEIGHT__`
- Enforced at generation time:
  - max 5 references
  - exactly one primary reference
  - project/global scope consistency

## API Endpoints

Health and runtime:

- `GET /health`
- `GET /api/runtime`

Dashboard/support:

- `GET /api/dashboard`
- `GET /api/models/recommendations`
- `GET /api/strategy`
- `GET /api/jobs/templates`

Core entities:

- `GET /api/projects`
- `POST /api/projects`
- `DELETE /api/projects/:id`
- `GET /api/prompts`
- `POST /api/prompts`
- `GET /api/runs`
- `POST /api/runs`
- `PATCH /api/runs/:id/status`
- `GET /api/providers`
- `POST /api/providers`
- `PATCH /api/providers/:id/credentials`
- `GET /api/reporting/usage`
- `POST /api/assets/upload`
- `GET /api/assets`
- `GET /api/assets/:id/file`
- `DELETE /api/assets/:id`

Studio generation:

- `GET /api/studio/suggestions`
- `GET /api/studio/search`
- `POST /api/studio/plan`
- `POST /api/assistant/plan`
- `POST /api/generation/start`
- `GET /api/generation/:id`
- `GET /api/generation/:id/policy`
- `POST /api/mcp`

Scoring and policies:

- `POST /api/runs/:id/score`
- `GET /api/runs/:id/score`
- `GET /api/policies`
- `PATCH /api/policies/:id`

## Local Setup

Prereqs:

- Node 20+ (or 22)
- npm 10+
- Python 3.11 (for ComfyUI)

Install and run:

```bash
npm install
npm run dev
```

Default local ports:

- web: `http://localhost:3000`
- api: `http://127.0.0.1:8787`

Validation:

```bash
npm run typecheck
npm run build
```

## ComfyUI Setup (Single Server)

```bash
cd ~/research
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
python3.11 -m venv .venv
source .venv/bin/activate
python -m ensurepip --upgrade
python -m pip install -U pip setuptools wheel
python -m pip install -r requirements.txt
mkdir -p models/checkpoints models/diffusion_models models/text_encoders models/vae models/loras
python main.py --listen 0.0.0.0 --port 8188
```

## Dreamora API Environment

Create `apps/api/.env`:

```bash
COMFY_ENABLED=1
COMFYUI_URL=http://127.0.0.1:8188
COMFY_WORKFLOW_PATH=workflows/comfy-template.json
COMFY_IMAGE_WORKFLOW_PATH=workflows/comfy-template.json
COMFY_VIDEO_WORKFLOW_PATH=workflows/comfy-video-template.json
COMFY_VIDEO_VAE_NAME=pixel_space
DEFAULT_IMAGE_MODEL=sd_xl_base_1.0.safetensors
DEFAULT_VIDEO_MODEL=wan2.2_ti2v_5B_fp16.safetensors
```

## Workflow JSON Rules

Dreamora expects Comfy API prompt JSON, not UI graph JSON.

Valid shape:

- top-level object keyed by node id (`"3"`, `"37"`, etc.)
- each node has `class_type` and `inputs`

Invalid shape:

- top-level `nodes`, `links`, `groups`, `extra`, `version` (this is UI format)

Template tokens supported by Dreamora:

- `__PROMPT__`
- `__MODEL__`
- `__WIDTH__`
- `__HEIGHT__`
- `__STEPS__`
- `__BATCH__`
- `__RUN_ID__`
- `__REF_COUNT__`
- `__REF1_PATH__` ... `__REF5_PATH__`
- `__REF1_WEIGHT__` ... `__REF5_WEIGHT__`

Files:

- image template: `apps/api/workflows/comfy-template.json`
- video template: `apps/api/workflows/comfy-video-template.json`

## Deploying On One Server (VS Code Tunnel Friendly)

Recommended process:

1. Keep ComfyUI running on `127.0.0.1:8188`.
2. Build Dreamora: `npm run build`.
3. Start API and web with process manager (pm2/systemd).
4. Expose only web port to tunnel/reverse proxy.
5. Let web proxy `/api/*` to API via `API_PROXY_TARGET`.

Example environment for web process:

```bash
API_PROXY_TARGET=http://127.0.0.1:8787
```

## Troubleshooting

`ERR_CONNECTION_REFUSED` on browser API calls:

- web should call `/api/*` (same origin), not direct `localhost:8787`
- verify rewrite in `apps/web/next.config.ts`

`ComfyUI not enabled; using simulated backend`:

- check `GET /api/runtime`
- ensure `apps/api/.env` has `COMFY_ENABLED=1`
- restart API

`Comfy submit failed with 400`:

- workflow JSON format wrong or node inputs invalid
- loader model value must match actual local model filename
- if VAE validation fails, set `COMFY_VIDEO_VAE_NAME` to an available VAE from your ComfyUI dropdown (for many installs `pixel_space` is valid)
- check Studio fallback reason text for exact Comfy error

## Documentation

- Architecture: `docs/architecture.md`
- Stage checklist and backlog: `docs/implementation-status.md`
