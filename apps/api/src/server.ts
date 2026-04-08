import cors from "@fastify/cors";
import Fastify from "fastify";
import { dashboardResponse, modelRecommendations, orchestrationStrategy } from "@dreamora/shared";
import "./env.js";
import {
  createComfyOrSimulatedJob,
  getGenerationJob,
  startComfyPolling,
  startSimulatedProgress
} from "./generation.js";
import {
  createProject,
  createPrompt,
  createProvider,
  createRun,
  getStore,
  initStore,
  updateProviderCredentials,
  updateRunFields,
  updateRunStatus
} from "./store.js";

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: true
});

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (hours < 1) {
    return "just now";
  }

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function toProviderStatus(secretConfigured: boolean, existingStatus: string): string {
  if (secretConfigured) {
    return "Connected";
  }

  if (existingStatus === "Optional") {
    return "Optional";
  }

  return "Needs key";
}

function cleanText(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalizeModelName(raw: string): string {
  const text = cleanText(raw);
  if (!text) {
    return text;
  }

  const filenameMatch = text.match(/[A-Za-z0-9._-]+\.safetensors/i);
  if (filenameMatch) {
    return filenameMatch[0];
  }

  const lower = text.toLowerCase();
  if (lower.includes("dreamora flux local") || lower.includes("flux")) {
    return process.env.DEFAULT_IMAGE_MODEL ?? "sd_xl_base_1.0.safetensors";
  }
  if (lower.includes("dreamora wan") || lower.includes("wan")) {
    return process.env.DEFAULT_VIDEO_MODEL ?? "wan2.2_ti2v_5B_fp16.safetensors";
  }

  return text;
}

function requireFields(values: Array<{ key: string; value: string }>): string | null {
  for (const entry of values) {
    if (!entry.value) {
      return `${entry.key} is required`;
    }
  }

  return null;
}

app.get("/health", async () => ({
  ok: true
}));

app.get("/api/runtime", async () => ({
  comfyEnabled: process.env.COMFY_ENABLED === "1",
  comfyUrl: process.env.COMFYUI_URL ?? null,
  comfyImageWorkflowPath:
    process.env.COMFY_IMAGE_WORKFLOW_PATH ??
    process.env.COMFY_WORKFLOW_PATH ??
    null,
  comfyVideoWorkflowPath:
    process.env.COMFY_VIDEO_WORKFLOW_PATH ??
    process.env.COMFY_WORKFLOW_PATH ??
    null
}));

app.get("/api/dashboard", async () => dashboardResponse);
app.get("/api/models/recommendations", async () => modelRecommendations);
app.get("/api/strategy", async () => orchestrationStrategy);

app.get("/api/projects", async () => {
  const { projects } = getStore();
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    format: project.format,
    status: project.status,
    updatedAt: formatRelativeTime(project.updatedAt),
    summary: project.summary
  }));
});

app.post<{
  Body: {
    name: string;
    format: string;
    status: string;
    summary: string;
  };
}>("/api/projects", async (request, reply) => {
  const payload = {
    name: cleanText(request.body.name),
    format: cleanText(request.body.format),
    status: cleanText(request.body.status),
    summary: cleanText(request.body.summary)
  };

  const error = requireFields([
    { key: "name", value: payload.name },
    { key: "format", value: payload.format },
    { key: "status", value: payload.status },
    { key: "summary", value: payload.summary }
  ]);

  if (error) {
    reply.code(400);
    return { error };
  }

  const project = await createProject(payload);
  reply.code(201);
  return project;
});

app.get("/api/prompts", async () => {
  const { prompts } = getStore();
  return prompts;
});

app.post<{
  Body: {
    title: string;
    engine: string;
    type: string;
    summary: string;
    tags: string[];
  };
}>("/api/prompts", async (request, reply) => {
  const payload = {
    title: cleanText(request.body.title),
    engine: cleanText(request.body.engine),
    type: cleanText(request.body.type),
    summary: cleanText(request.body.summary),
    tags: request.body.tags ?? []
  };

  const error = requireFields([
    { key: "title", value: payload.title },
    { key: "engine", value: payload.engine },
    { key: "type", value: payload.type },
    { key: "summary", value: payload.summary }
  ]);

  if (error) {
    reply.code(400);
    return { error };
  }

  const prompt = await createPrompt(payload);
  reply.code(201);
  return prompt;
});

app.get("/api/runs", async () => {
  const { runs } = getStore();
  return runs;
});

app.post<{
  Body: {
    title: string;
    engine: string;
    mode: "image" | "video";
    status: string;
    duration: string;
    output: string;
    tokensUsed?: number;
  };
}>("/api/runs", async (request, reply) => {
  const payload = {
    ...request.body,
    title: cleanText(request.body.title),
    engine: cleanText(request.body.engine),
    status: cleanText(request.body.status),
    duration: cleanText(request.body.duration),
    output: cleanText(request.body.output)
  };

  const error = requireFields([
    { key: "title", value: payload.title },
    { key: "engine", value: payload.engine },
    { key: "status", value: payload.status },
    { key: "duration", value: payload.duration },
    { key: "output", value: payload.output }
  ]);

  if (error) {
    reply.code(400);
    return { error };
  }

  const run = await createRun({
    ...payload,
    tokensUsed: request.body.tokensUsed ?? 0
  });

  reply.code(201);
  return run;
});

app.patch<{
  Params: { id: string };
  Body: { status: string; duration?: string };
}>("/api/runs/:id/status", async (request, reply) => {
  const status = cleanText(request.body.status);
  const duration = cleanText(request.body.duration);

  if (!status) {
    reply.code(400);
    return { error: "status is required" };
  }

  try {
    const run = await updateRunStatus(
      request.params.id,
      status,
      duration || undefined
    );
    return run;
  } catch {
    reply.code(404);
    return { error: "Run not found" };
  }
});

app.get("/api/providers", async () => {
  const { providers } = getStore();
  return providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    category: provider.category,
    status: toProviderStatus(provider.secretConfigured, provider.status),
    auth: provider.auth,
    defaultModel: provider.defaultModel,
    note: provider.note,
    secretConfigured: provider.secretConfigured,
    secretHint: provider.secretHint
  }));
});

app.post<{
  Body: {
    name: string;
    category: string;
    auth: string;
    defaultModel: string;
    note: string;
  };
}>("/api/providers", async (request, reply) => {
  const payload = {
    name: cleanText(request.body.name),
    category: cleanText(request.body.category),
    auth: cleanText(request.body.auth),
    defaultModel: cleanText(request.body.defaultModel),
    note: cleanText(request.body.note)
  };

  const error = requireFields([
    { key: "name", value: payload.name },
    { key: "category", value: payload.category },
    { key: "auth", value: payload.auth },
    { key: "defaultModel", value: payload.defaultModel }
  ]);

  if (error) {
    reply.code(400);
    return { error };
  }

  const provider = await createProvider(payload);
  reply.code(201);
  return provider;
});

app.patch<{
  Params: { id: string };
  Body: { secretHint?: string; configured: boolean };
}>("/api/providers/:id/credentials", async (request, reply) => {
  try {
    const provider = await updateProviderCredentials(
      request.params.id,
      request.body.configured,
      request.body.secretHint
    );

    return {
      id: provider.id,
      status: toProviderStatus(provider.secretConfigured, provider.status),
      secretConfigured: provider.secretConfigured,
      secretHint: provider.secretHint
    };
  } catch {
    reply.code(404);
    return {
      error: "Provider not found"
    };
  }
});

app.get("/api/reporting/usage", async () => {
  const { runs } = getStore();
  const totalTokens = runs.reduce((sum, run) => sum + run.tokensUsed, 0);
  const imageCount = runs.filter((run) => run.mode === "image").length;
  const videoCount = runs.filter((run) => run.mode === "video").length;

  const engineCounts = new Map<string, number>();
  for (const run of runs) {
    engineCounts.set(run.engine, (engineCounts.get(run.engine) ?? 0) + 1);
  }

  const topModel =
    [...engineCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";

  const breakdownPalette = ["#111111", "#4d7cfe", "#6ccf96", "#f4b35e", "#ca8ee0"];
  const breakdown = [...engineCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count], index) => ({
      label,
      value: Math.round((count / Math.max(1, runs.length)) * 100),
      color: breakdownPalette[index % breakdownPalette.length]
    }));

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyBuckets = new Map<string, number>();
  for (const run of runs) {
    const day = dayLabels[new Date(run.createdAt).getDay()];
    weeklyBuckets.set(day, (weeklyBuckets.get(day) ?? 0) + 1);
  }

  const weekly = dayLabels.map((label, index) => ({
    label,
    value: Math.min(100, (weeklyBuckets.get(label) ?? 0) * 20 + 20),
    color: ["#d5def9", "#bdd0ff", "#a9c2ff", "#8fb2ff", "#6e9cff", "#8ec5a5", "#c7d4e8"][index]
  }));

  return {
    metrics: [
      {
        label: "Total tokens",
        value: totalTokens.toLocaleString(),
        detail:
          "Prompting, retrieval context, and orchestration inference token estimates."
      },
      {
        label: "Images generated",
        value: String(imageCount),
        detail: "Image-mode runs persisted in the run history."
      },
      {
        label: "Videos rendered",
        value: String(videoCount),
        detail: "Video-mode runs persisted in the run history."
      },
      {
        label: "Top model",
        value: topModel,
        detail: "Most frequently used generation engine in stored runs."
      }
    ],
    breakdown,
    weekly
  };
});

app.get<{
  Querystring: { mode?: "image" | "video"; query?: string };
}>("/api/studio/suggestions", async (request) => {
  const mode = request.query.mode === "video" ? "video" : "image";
  const query = cleanText(request.query.query).toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  const { prompts, runs } = getStore();

  const completedRuns = runs.filter((run) => run.status === "Completed" && run.mode === mode);

  const promptMatches = prompts
    .map((prompt) => {
      const haystack = `${prompt.title} ${prompt.summary} ${prompt.tags.join(" ")}`.toLowerCase();
      const score =
        terms.length === 0
          ? 1
          : terms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
      return { prompt, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((entry) => ({
      id: entry.prompt.id,
      title: entry.prompt.title,
      summary: entry.prompt.summary,
      tags: entry.prompt.tags,
      score: entry.score
    }));

  const modelCounts = new Map<string, number>();
  const ratioCounts = new Map<string, number>();
  const qualityCounts = new Map<string, number>();
  const batchCounts = new Map<number, number>();

  for (const run of completedRuns) {
    modelCounts.set(run.engine, (modelCounts.get(run.engine) ?? 0) + 1);
    if (run.aspectRatio) {
      ratioCounts.set(run.aspectRatio, (ratioCounts.get(run.aspectRatio) ?? 0) + 1);
    }
    if (run.quality) {
      qualityCounts.set(run.quality, (qualityCounts.get(run.quality) ?? 0) + 1);
    }
    if (typeof run.batchSize === "number") {
      batchCounts.set(run.batchSize, (batchCounts.get(run.batchSize) ?? 0) + 1);
    }
  }

  const pickMostFrequent = <T>(map: Map<T, number>, fallback: T): T =>
    [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;

  const topRuns = completedRuns.slice(0, 5).map((run) => ({
    id: run.id,
    title: run.title,
    engine: run.engine,
    mode: run.mode,
    status: run.status,
    duration: run.duration,
    output: run.output,
    tokensUsed: run.tokensUsed,
    aspectRatio: run.aspectRatio ?? null,
    quality: run.quality ?? null,
    batchSize: typeof run.batchSize === "number" ? run.batchSize : null,
    promptExcerpt: run.promptExcerpt ?? null
  }));

  const averageTokens =
    completedRuns.length > 0
      ? Math.round(
          completedRuns.reduce((sum, run) => sum + run.tokensUsed, 0) /
            completedRuns.length
        )
      : 0;

  return {
    mode,
    memory: {
      promptMatches,
      topRuns
    },
    recommendations: {
      model:
        pickMostFrequent(
          modelCounts,
          mode === "image"
            ? (process.env.DEFAULT_IMAGE_MODEL ?? "sd_xl_base_1.0.safetensors")
            : (process.env.DEFAULT_VIDEO_MODEL ?? "wan2.2_ti2v_5B_fp16.safetensors")
        ),
      aspectRatio: pickMostFrequent(ratioCounts, mode === "image" ? "1:1" : "16:9"),
      quality: pickMostFrequent(qualityCounts, "High"),
      batchSize: pickMostFrequent(batchCounts, 1),
      averageTokens
    }
  };
});

app.post<{
  Body: {
    mode: "image" | "video";
    prompt: string;
    model: string;
    aspectRatio: string;
    quality: "Standard" | "High" | "Ultra";
    batchSize?: number;
  };
}>("/api/generation/start", async (request, reply) => {
  const mode = request.body.mode;
  const prompt = cleanText(request.body.prompt);
  const model = cleanText(request.body.model);
  const normalizedModel = normalizeModelName(model);
  const aspectRatio = cleanText(request.body.aspectRatio);
  const quality = request.body.quality;
  const batchSize = request.body.batchSize ?? 1;

  const error = requireFields([
    { key: "prompt", value: prompt },
    { key: "model", value: normalizedModel },
    { key: "aspectRatio", value: aspectRatio },
    { key: "quality", value: quality }
  ]);

  if (error) {
    reply.code(400);
    return { error };
  }

  const run = await createRun({
    title:
      mode === "image"
        ? `Image generation ${new Date().toLocaleTimeString()}`
        : `Video generation ${new Date().toLocaleTimeString()}`,
    engine: model,
    mode,
    status: "Queued",
    duration: "Pending",
    output: mode === "image" ? `${batchSize} image(s)` : `${aspectRatio} clip`,
    tokensUsed: mode === "image" ? 3500 * Math.max(1, batchSize) : 8200,
    promptExcerpt: prompt.slice(0, 280),
    aspectRatio,
    quality,
    batchSize: mode === "image" ? Math.max(1, batchSize) : 1
  });

  const job = await createComfyOrSimulatedJob(run.id, {
    mode,
      prompt,
      model: normalizedModel,
      aspectRatio,
    quality,
    batchSize
  });

  if (job.backend === "comfy" && job.status === "running") {
    await updateRunStatus(run.id, "Running");
    startComfyPolling(
      job,
      async (outputCount) => {
        await updateRunFields(run.id, {
          status: "Completed",
          duration: mode === "image" ? "0m 58s" : "2m 12s",
          backend: "comfy",
          output:
            mode === "image"
              ? `${Math.max(1, outputCount)} image(s)`
              : `${Math.max(1, outputCount)} clip artifact(s)`
        });
      },
      async (reason) => {
        await updateRunFields(run.id, {
          status: "Failed",
          duration: "Failed",
          backend: "comfy",
          output: reason
        });
      }
    );
  } else {
    await updateRunStatus(run.id, "Running");
    startSimulatedProgress(
      job,
      async () => {
        await updateRunStatus(run.id, "Running");
      },
      async () => {
        await updateRunFields(run.id, {
          status: "Completed",
          duration: mode === "image" ? "0m 52s" : "1m 46s",
          backend: "simulated",
          output: mode === "image" ? `${batchSize} image(s)` : `${aspectRatio} clip`
        });
      }
    );
  }

  return {
    jobId: job.id,
    runId: run.id,
    status: job.status,
    backend: job.backend,
    fallbackReason: job.error ?? null,
    workflowPath: job.workflowPath ?? null
  };
});

app.get<{
  Params: { id: string };
}>("/api/generation/:id", async (request, reply) => {
  const job = getGenerationJob(request.params.id);
  if (!job) {
    reply.code(404);
    return {
      error: "Job not found"
    };
  }

  return {
    id: job.id,
    runId: job.runId,
    status: job.status,
    backend: job.backend,
    error: job.error ?? null,
    outputSummary: job.outputSummary ?? null,
    workflowPath: job.workflowPath ?? null
  };
});

app.get("/api/jobs/templates", async () => ({
  templates: [
    {
      id: "flux-image",
      label: "FLUX still image",
      engine: "flux",
      summary: "Best default for high-quality still generation on V100."
    },
    {
      id: "wan-video",
      label: "Wan 2.2 video",
      engine: "wan",
      summary: "Animate a keyframe into 480p video, then upscale."
    },
    {
      id: "review-loop",
      label: "Prompt refinement loop",
      engine: "assistant",
      summary:
        "Use retrieval and scoring to improve prompts before spending GPU time."
    }
  ]
}));

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await initStore();
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
