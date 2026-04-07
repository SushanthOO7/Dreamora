# Dreamora Architecture

## Product Direction

Dreamora is a personal productivity application for AI-assisted image and video generation. The product is designed around repeatable creative workflows rather than single prompts.

Core product goals:

- Keep the interface minimal, calm, and premium
- Optimize for V100 32GB constraints instead of generic consumer GPUs
- Treat prompts, references, presets, and prior outputs as reusable knowledge
- Support direct orchestration first, with MCP integration as a later capability

## Stack Choice

### Frontend: Next.js

Why:

- Fastest path to a polished application shell and dashboard experience
- Strong server-rendering model for content-heavy product pages
- Excellent TypeScript ergonomics
- Easy evolution into authenticated app routes and server actions later

### Backend: Fastify

Why:

- Better raw throughput and lower overhead than heavier Node frameworks
- Clean route model for orchestration APIs
- Good fit for job submission, template management, run history, and model strategy services
- Easy to keep lean while the product surface grows

This is a stronger fit for your request than using only Next.js route handlers, because the backend will eventually own queueing, cluster integration, ComfyUI bridge logic, and job lifecycle management.

## Model Recommendations

### Default Image Model

`FLUX.1-dev GGUF (Q5_K_S or Q6_K)`

Why:

- Best image-generation default on your V100 from the research you provided
- Strong prompt understanding and text rendering
- GGUF materially reduces VRAM pressure without relying on unsupported FP8 compute
- Leaves room for ControlNet, adapters, VAE handling, and upscale stages

### Default Video Model

`Wan 2.2 5B FP16`

Why:

- Fits comfortably in your 32GB V100 without needing extreme compromises
- Strong ecosystem support for TeaCache, block offloading, and ComfyUI wrappers
- Better production choice than pushing LTX as the first default on Volta

### Secondary Research Model

`LTX-2`

Why:

- Worth keeping available for experimentation and advanced motion studies
- Not the first production recommendation for your hardware due to loader and VRAM complexity

## Recommended Pipeline

### Image pipeline

1. Retrieve prompt context and references
2. Generate with FLUX GGUF
3. Optional face/detail pass
4. Optional tiled upscale and refinement

### Video pipeline

1. Retrieve prior prompt and style context
2. Generate keyframe in FLUX
3. Animate with Wan 2.2 5B
4. Accelerate with TeaCache
5. Interpolate with RIFE
6. Upscale with SeedVR2
7. Store outputs and best settings for reuse

### Long-form video path

Use `FramePack` when long duration matters more than keeping the pipeline simple.

## RAG Decision

RAG is useful here, but not as a blanket feature.

Use retrieval for:

- Prompt memory
- Reusable shot recipes
- Style references
- Prior successful generations
- Technical notes tied to model presets

Do not place retrieval inside the low-level generation loop. It should improve prompt preparation and workflow decisions, not slow down diffusion inference.

## MCP Decision

MCP is a good phase-two addition.

Use it for:

- Letting an assistant inspect available workflows
- Submitting ComfyUI jobs
- Reading outputs and metadata
- Running review loops or regeneration plans

Do not make MCP a hard dependency for v1. The first production version should work through a direct backend orchestration layer and expose MCP later when the job system is stable.

## Suggested Roadmap

### Phase 1

- Finish the product shell and dashboard
- Add project, preset, prompt, and run entities
- Add direct ComfyUI bridge endpoints
- Add job status polling and result storage

### Phase 2

- Add retrieval-backed prompt memory
- Add assistant-guided workflow planning
- Add MCP server integration
- Add automated output scoring and regeneration rules

### Phase 3

- Add SLURM or cluster-aware execution
- Add LoRA asset tracking
- Add team/project collaboration features if needed
