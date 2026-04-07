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
