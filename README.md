# Dreamora

Dreamora is a personal productivity workspace for AI image and video generation.

It combines:

- A minimal, premium web interface inspired by Attio's visual language
- A Fastify API for generation jobs, presets, model strategy, and orchestration
- Shared TypeScript contracts for reliable frontend/backend integration
- Architecture notes for running FLUX, Wan 2.2, and LTX-style workflows on a V100 32GB GPU

## Stack

- Next.js 15
- React 19
- Fastify 5
- TypeScript
- Tailwind CSS 4
- npm workspaces

## Apps

- `apps/web`: product UI
- `apps/api`: orchestration API
- `packages/shared`: shared types and seed data

## Run

```bash
npm install
npm run dev
```

Web: `http://localhost:3000`

API: `http://localhost:8787`

## Stage 4 Generation Orchestration

Stage 4 is implemented with backend job orchestration:

- `POST /api/generation/start` creates a persistent run and starts a generation job
- `GET /api/generation/:id` returns live job status for polling
- Studio now calls these endpoints directly and updates run status based on backend state

### ComfyUI mode (real execution)

Create `apps/api/.env` (or export env vars in your server shell):

```bash
COMFY_ENABLED=1
COMFYUI_URL=http://127.0.0.1:8188
COMFY_WORKFLOW_PATH=workflows/comfy-template.json
```

Behavior:

- If `COMFY_ENABLED=1` and submission works, jobs run through ComfyUI
- If Comfy submission fails (or Comfy is disabled), backend falls back to simulated execution and reports the fallback reason in Studio

### Workflow template tokens

When `COMFY_WORKFLOW_PATH` points to a JSON workflow, the backend replaces:

- `__PROMPT__`
- `__MODEL__`
- `__WIDTH__`
- `__HEIGHT__`
- `__STEPS__`
- `__BATCH__`
- `__RUN_ID__`

Use these placeholders inside your Comfy workflow JSON where relevant.
