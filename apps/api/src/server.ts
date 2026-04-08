import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import type { MultipartFile } from "@fastify/multipart";
import Fastify from "fastify";
import { readFile as readLocalFile } from "node:fs/promises";
import { dashboardResponse, modelRecommendations, orchestrationStrategy } from "@dreamora/shared";
import "./env.js";
import {
  createComfyOrSimulatedJob,
  getGenerationJob,
  startComfyPolling,
  startSimulatedProgress
} from "./generation.js";
import { createPlan } from "./planner.js";
import { handleMcpRequest, type McpJsonRpcRequest } from "./mcp.js";
import { evaluateRegenerationPolicy } from "./policy.js";
import {
  evaluateRegeneration,
  getRunScore,
  getPolicies,
  scoreRun,
  updatePolicy,
  getScoreDistribution,
  getAllScores
} from "./scoring.js";
import { getSemanticIndex } from "./semantic.js";
import {
  deleteAssetFile,
  ensureFileExists,
  resolveAssetPath,
  safeExtension,
  validateImageMime,
  writeAssetFile
} from "./assets.js";
import {
  commitAssetDelete,
  commitProjectCascadeDelete,
  createAsset,
  createProject,
  createPrompt,
  createProvider,
  createRun,
  getAssetById,
  getAssetDeletePreview,
  getProjectCascadePreview,
  getStore,
  initStore,
  listAssets,
  type StoredAsset,
  updateProviderCredentials,
  updateRunFields,
  updateRunStatus
} from "./store.js";

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? true
});
await app.register(multipart, {
  limits: {
    files: 1,
    fileSize: 10 * 1024 * 1024
  }
});

app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
  app.log.error(error);
  reply.code(error.statusCode ?? 500).send({
    error: error.message ?? "Internal server error"
  });
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

function normalizeModelName(raw: string, mode?: "image" | "video"): string {
  const text = cleanText(raw);
  if (!text) {
    return text;
  }

  const filenameMatch = text.match(/[A-Za-z0-9._-]+\.safetensors/i);
  if (filenameMatch) {
    return filenameMatch[0];
  }

  const lower = text.toLowerCase();
  const hasFlux = lower.includes("dreamora flux local") || lower.includes("flux");
  const hasWan = lower.includes("dreamora wan") || lower.includes("wan");

  // When the model name contains both image and video keywords (e.g. "FLUX + Wan 2.2"),
  // use the mode to pick the correct checkpoint instead of falling through to the first match.
  if (hasFlux && hasWan) {
    if (mode === "video") {
      return process.env.DEFAULT_VIDEO_MODEL ?? "wan2.2_ti2v_5B_fp16.safetensors";
    }
    return process.env.DEFAULT_IMAGE_MODEL ?? "sd_xl_base_1.0.safetensors";
  }

  if (hasFlux) {
    return process.env.DEFAULT_IMAGE_MODEL ?? "sd_xl_base_1.0.safetensors";
  }
  if (hasWan) {
    return process.env.DEFAULT_VIDEO_MODEL ?? "wan2.2_ti2v_5B_fp16.safetensors";
  }

  return text;
}

function requireFields(values: Array<{ key: string; value: string }>): string | null {
  for (const entry of values) {
    if (!entry.value || typeof entry.value !== "string") {
      return `${entry.key} is required`;
    }
  }

  return null;
}

const VALID_MODES = new Set(["image", "video"]);
const VALID_QUALITIES = new Set(["Standard", "High", "Ultra"]);
const MAX_BATCH = 8;
const MIN_BATCH = 1;
const MAX_REFERENCES = 5;

function toAssetScope(raw: string): "project" | "global" | null {
  if (raw === "project") {
    return "project";
  }
  if (raw === "global") {
    return "global";
  }
  return null;
}

function toAssetRole(raw: string): "primary" | "secondary" {
  return raw === "primary" ? "primary" : "secondary";
}

function normalizeWeight(raw: string | number | undefined, fallback = 0.5): number {
  const numeric = typeof raw === "number" ? raw : Number(raw ?? fallback);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(1, Math.max(0.1, Number(numeric.toFixed(2))));
}

function toPublicAsset(asset: StoredAsset) {
  return {
    id: asset.id,
    scope: asset.scope,
    projectId: asset.projectId,
    filename: asset.filename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    role: asset.role,
    weight: asset.weight,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    previewUrl: `/api/assets/${asset.id}/file`
  };
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

app.delete<{
  Params: { id: string };
}>("/api/projects/:id", async (request, reply) => {
  const preview = getProjectCascadePreview(request.params.id);
  if (!preview) {
    reply.code(404);
    return { error: "Project not found" };
  }

  try {
    for (const asset of preview.assets) {
      await ensureFileExists(asset.filePath);
    }
  } catch {
    reply.code(500);
    return {
      error: "Project delete aborted because one or more asset files are missing."
    };
  }

  try {
    for (const asset of preview.assets) {
      await deleteAssetFile(asset.filePath);
    }
  } catch (error) {
    reply.code(500);
    return {
      error:
        error instanceof Error
          ? `Project delete aborted during file deletion: ${error.message}`
          : "Project delete aborted during file deletion."
    };
  }

  const result = await commitProjectCascadeDelete(request.params.id);
  return {
    deleted: true,
    ...result
  };
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
    projectId?: string;
  };
}>("/api/prompts", async (request, reply) => {
  const projectId = cleanText(request.body.projectId);
  const payload = {
    title: cleanText(request.body.title),
    engine: cleanText(request.body.engine),
    type: cleanText(request.body.type),
    summary: cleanText(request.body.summary),
    tags: Array.isArray(request.body.tags) ? request.body.tags : [],
    projectId: projectId || null
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

  if (payload.projectId) {
    const exists = getStore().projects.some((project) => project.id === payload.projectId);
    if (!exists) {
      reply.code(404);
      return { error: "Project not found for prompt" };
    }
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
    projectId?: string;
    referenceAssetIds?: string[];
  };
}>("/api/runs", async (request, reply) => {
  const projectId = cleanText(request.body.projectId);
  const referenceAssetIds = Array.isArray(request.body.referenceAssetIds)
    ? request.body.referenceAssetIds.filter((value): value is string => typeof value === "string").slice(0, MAX_REFERENCES)
    : [];
  const payload = {
    ...request.body,
    title: cleanText(request.body.title),
    engine: cleanText(request.body.engine),
    status: cleanText(request.body.status),
    duration: cleanText(request.body.duration),
    output: cleanText(request.body.output),
    projectId: projectId || null,
    referenceAssetIds
  };

  if (!VALID_MODES.has(payload.mode)) {
    reply.code(400);
    return { error: "mode must be 'image' or 'video'" };
  }

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

  if (payload.projectId) {
    const exists = getStore().projects.some((project) => project.id === payload.projectId);
    if (!exists) {
      reply.code(404);
      return { error: "Project not found for run" };
    }
  }

  if (payload.referenceAssetIds.length > 0) {
    try {
      resolveReferenceAssetsForGeneration(payload.projectId ?? null, payload.referenceAssetIds);
    } catch (validationError) {
      reply.code(400);
      return {
        error:
          validationError instanceof Error
            ? validationError.message
            : "Invalid reference assets for run"
      };
    }
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

app.post("/api/assets/upload", async (request, reply) => {
  const fields: Record<string, string> = {};
  let filePart: MultipartFile | null = null;

  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (filePart) {
        reply.code(400);
        return { error: "Only one file is allowed per upload request." };
      }
      filePart = part;
      continue;
    }
    fields[part.fieldname] = String(part.value ?? "");
  }

  if (!filePart) {
    reply.code(400);
    return { error: "file is required" };
  }

  const scope = toAssetScope(cleanText(fields.scope));
  if (!scope) {
    reply.code(400);
    return { error: "scope must be 'project' or 'global'" };
  }

  const projectId = cleanText(fields.projectId) || null;
  if (scope === "project" && !projectId) {
    reply.code(400);
    return { error: "projectId is required when scope is 'project'" };
  }

  if (scope === "project") {
    const exists = getStore().projects.some((project) => project.id === projectId);
    if (!exists) {
      reply.code(404);
      return { error: "Project not found for project-scoped asset" };
    }
  }

  if (!validateImageMime(filePart.mimetype)) {
    reply.code(400);
    return { error: `Unsupported file type: ${filePart.mimetype}` };
  }

  const chunks: Buffer[] = [];
  for await (const chunk of filePart.file) {
    chunks.push(Buffer.from(chunk));
  }
  const content = Buffer.concat(chunks);
  if (content.byteLength === 0) {
    reply.code(400);
    return { error: "Uploaded file is empty" };
  }

  const role = toAssetRole(cleanText(fields.role));
  const weight = normalizeWeight(fields.weight, role === "primary" ? 1 : 0.5);
  const assetId = crypto.randomUUID();
  const ext = safeExtension(filePart.filename, filePart.mimetype);
  const filePath = resolveAssetPath({
    scope,
    projectId: scope === "project" ? projectId : null,
    assetId,
    extension: ext
  });

  try {
    await writeAssetFile(filePath, content);
  } catch (error) {
    reply.code(500);
    return {
      error:
        error instanceof Error
          ? `Could not persist uploaded asset file: ${error.message}`
          : "Could not persist uploaded asset file"
    };
  }

  try {
    const asset = await createAsset({
      id: assetId,
      scope,
      projectId: scope === "project" ? projectId : null,
      filename: filePart.filename,
      mimeType: filePart.mimetype,
      sizeBytes: content.byteLength,
      role,
      weight,
      filePath
    });
    reply.code(201);
    return toPublicAsset(asset);
  } catch (error) {
    await deleteAssetFile(filePath).catch(() => undefined);
    reply.code(500);
    return {
      error:
        error instanceof Error
          ? `Could not persist uploaded asset metadata: ${error.message}`
          : "Could not persist uploaded asset metadata"
    };
  }
});

app.get<{
  Querystring: { scope?: string; projectId?: string };
}>("/api/assets", async (request, reply) => {
  const scope = toAssetScope(cleanText(request.query.scope) || "global");
  if (!scope) {
    reply.code(400);
    return { error: "scope must be 'project' or 'global'" };
  }

  const projectId = cleanText(request.query.projectId) || undefined;
  if (scope === "project" && !projectId) {
    reply.code(400);
    return { error: "projectId is required for project-scoped listing" };
  }

  const assets = listAssets(scope, projectId).map((asset) => toPublicAsset(asset));

  return {
    scope,
    projectId: projectId ?? null,
    assets
  };
});

app.get<{
  Params: { id: string };
}>("/api/assets/:id/file", async (request, reply) => {
  const asset = getAssetById(request.params.id);
  if (!asset) {
    reply.code(404);
    return { error: "Asset not found" };
  }

  try {
    const binary = await readLocalFile(asset.filePath);
    reply.header("Content-Type", asset.mimeType);
    return reply.send(binary);
  } catch {
    reply.code(404);
    return { error: "Asset file not found on disk" };
  }
});

app.delete<{
  Params: { id: string };
}>("/api/assets/:id", async (request, reply) => {
  const preview = getAssetDeletePreview(request.params.id);
  if (!preview) {
    reply.code(404);
    return { error: "Asset not found" };
  }

  try {
    await ensureFileExists(preview.asset.filePath);
  } catch {
    reply.code(500);
    return { error: "Asset delete aborted because file is missing on disk." };
  }

  try {
    await deleteAssetFile(preview.asset.filePath);
  } catch (error) {
    reply.code(500);
    return {
      error:
        error instanceof Error
          ? `Asset delete failed during file deletion: ${error.message}`
          : "Asset delete failed during file deletion."
    };
  }

  const result = await commitAssetDelete(request.params.id);
  return {
    deleted: true,
    ...result
  };
});

app.get("/api/reporting/usage", async () => {
  const { runs } = getStore();
  const totalTokens = runs.reduce((sum, run) => sum + run.tokensUsed, 0);

  let imageCount = 0;
  let videoCount = 0;
  const engineCounts = new Map<string, number>();
  const weeklyBuckets = new Map<string, number>();
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (const run of runs) {
    if (run.mode === "image") {
      imageCount++;
    } else {
      videoCount++;
    }
    engineCounts.set(run.engine, (engineCounts.get(run.engine) ?? 0) + 1);
    const day = dayLabels[new Date(run.createdAt).getDay()];
    weeklyBuckets.set(day, (weeklyBuckets.get(day) ?? 0) + 1);
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

  const weeklyPalette = ["#d5def9", "#bdd0ff", "#a9c2ff", "#8fb2ff", "#6e9cff", "#8ec5a5", "#c7d4e8"];
  const weekly = dayLabels.map((label, index) => ({
    label,
    value: Math.min(100, (weeklyBuckets.get(label) ?? 0) * 20 + 20),
    color: weeklyPalette[index]
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

function rebuildSemanticIndex(): void {
  const index = getSemanticIndex();
  const { prompts, runs } = getStore();

  index.clear();

  for (const prompt of prompts) {
    index.addDocument({
      id: prompt.id,
      text: `${prompt.title} ${prompt.summary} ${prompt.tags.join(" ")}`,
      source: "prompt",
      meta: {
        title: prompt.title,
        summary: prompt.summary,
        tags: prompt.tags,
        engine: prompt.engine,
        type: prompt.type
      }
    });
  }

  for (const run of runs) {
    if (run.status !== "Completed") continue;
    index.addDocument({
      id: run.id,
      text: `${run.title} ${run.engine} ${run.promptExcerpt ?? ""} ${run.output}`,
      source: "run",
      meta: {
        title: run.title,
        engine: run.engine,
        mode: run.mode,
        duration: run.duration,
        tokensUsed: run.tokensUsed,
        aspectRatio: run.aspectRatio ?? null,
        quality: run.quality ?? null,
        batchSize: run.batchSize ?? null,
        score: run.score ?? null
      }
    });
  }
}

function getStudioSuggestions(mode: "image" | "video", query: string) {
  const { prompts, runs } = getStore();
  const cleanQuery = cleanText(query);

  rebuildSemanticIndex();
  const index = getSemanticIndex();
  const completedRuns = runs.filter((run) => run.status === "Completed" && run.mode === mode);

  const promptMatches =
    cleanQuery.length > 0
      ? index.search(cleanQuery, 5, "prompt").map((result) => ({
          id: result.id,
          title: (result.meta.title as string) ?? "",
          summary: (result.meta.summary as string) ?? "",
          tags: (result.meta.tags as string[]) ?? [],
          score: result.score
        }))
      : prompts.slice(0, 5).map((prompt) => ({
          id: prompt.id,
          title: prompt.title,
          summary: prompt.summary,
          tags: prompt.tags,
          score: 1
        }));

  const modelCounts = new Map<string, number>();
  const ratioCounts = new Map<string, number>();
  const qualityCounts = new Map<"Standard" | "High" | "Ultra", number>();
  const batchCounts = new Map<number, number>();

  for (const run of completedRuns) {
    const weight = typeof run.score === "number" ? run.score : 1;
    modelCounts.set(run.engine, (modelCounts.get(run.engine) ?? 0) + weight);
    if (run.aspectRatio) {
      ratioCounts.set(run.aspectRatio, (ratioCounts.get(run.aspectRatio) ?? 0) + weight);
    }
    if (run.quality) {
      qualityCounts.set(run.quality, (qualityCounts.get(run.quality) ?? 0) + weight);
    }
    if (typeof run.batchSize === "number") {
      batchCounts.set(run.batchSize, (batchCounts.get(run.batchSize) ?? 0) + weight);
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
    promptExcerpt: run.promptExcerpt ?? null,
    score: run.score ?? null
  }));

  const averageTokens =
    completedRuns.length > 0
      ? Math.round(
          completedRuns.reduce((sum, run) => sum + run.tokensUsed, 0) /
            completedRuns.length
        )
      : 0;

  const semanticRunMatches =
    cleanQuery.length > 0
      ? index.search(cleanQuery, 5, "run").map((result) => ({
          id: result.id,
          title: (result.meta.title as string) ?? "",
          engine: (result.meta.engine as string) ?? "",
          score: result.score
        }))
      : [];

  return {
    mode,
    memory: {
      promptMatches,
      topRuns,
      semanticRunMatches
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
    },
    retrieval: {
      strategy: "tfidf-semantic-v1",
      indexSize: index.size
    }
  };
}

app.get<{
  Querystring: { mode?: "image" | "video"; query?: string };
}>("/api/studio/suggestions", async (request) => {
  const mode = request.query.mode === "video" ? "video" : "image";
  const query = cleanText(request.query.query);
  return getStudioSuggestions(mode, query);
});

function getRegenerationPolicyDecision(jobId: string) {
  const job = getGenerationJob(jobId);
  if (!job) {
    return null;
  }

  const { runs } = getStore();
  const run = runs.find((item) => item.id === job.runId);
  if (!run) {
    return null;
  }

  const attempt = runs.filter((item) => {
    if (item.mode !== run.mode) {
      return false;
    }
    if (run.promptExcerpt && item.promptExcerpt) {
      return item.promptExcerpt === run.promptExcerpt;
    }
    return item.title.split(" ").slice(0, 2).join(" ") === run.title.split(" ").slice(0, 2).join(" ");
  }).length;

  return evaluateRegenerationPolicy({
    mode: run.mode,
    status: job.status,
    backend: job.backend,
    error: job.error ?? null,
    outputSummary: job.outputSummary ?? run.output ?? null,
    quality: run.quality,
    batchSize: run.batchSize,
    aspectRatio: run.aspectRatio,
    tokensUsed: run.tokensUsed,
    attempt: Math.max(1, attempt)
  });
}

function resolveReferenceAssetsForGeneration(
  projectId: string | null,
  referenceAssetIds: string[]
): Array<{ id: string; path: string; weight: number; role: "primary" | "secondary" }> {
  if (referenceAssetIds.length === 0) {
    return [];
  }
  if (referenceAssetIds.length > MAX_REFERENCES) {
    throw new Error(`At most ${MAX_REFERENCES} reference images are allowed.`);
  }

  const uniqueIds = [...new Set(referenceAssetIds)];
  if (uniqueIds.length !== referenceAssetIds.length) {
    throw new Error("Duplicate reference asset IDs are not allowed.");
  }

  const assets = uniqueIds.map((id) => {
    const asset = getAssetById(id);
    if (!asset) {
      throw new Error(`Reference asset not found: ${id}`);
    }
    return asset;
  });

  if (projectId) {
    for (const asset of assets) {
      if (asset.scope !== "project" || asset.projectId !== projectId) {
        throw new Error("All references must belong to the selected project.");
      }
    }
  } else {
    for (const asset of assets) {
      if (asset.scope !== "global" || asset.projectId !== null) {
        throw new Error(
          "When no project is selected, references must come from global assets."
        );
      }
    }
  }

  const primaryCount = assets.filter((asset) => asset.role === "primary").length;
  if (primaryCount !== 1) {
    throw new Error(
      "Exactly one selected reference must be marked as primary."
    );
  }

  const ordered = assets.sort((left, right) => {
    if (left.role === right.role) return 0;
    return left.role === "primary" ? -1 : 1;
  });

  return ordered.map((asset) => ({
    id: asset.id,
    path: asset.filePath,
    weight: asset.weight,
    role: asset.role
  }));
}

// --- Stage 6: Semantic search endpoint ---
app.get<{
  Querystring: { query: string; source?: "prompt" | "run"; limit?: string };
}>("/api/studio/search", async (request, reply) => {
  const query = cleanText(request.query.query);
  if (!query) {
    reply.code(400);
    return { error: "query is required" };
  }

  rebuildSemanticIndex();
  const index = getSemanticIndex();
  const limit = Math.min(20, Math.max(1, Number(request.query.limit) || 10));
  const source = request.query.source === "prompt" || request.query.source === "run"
    ? request.query.source
    : undefined;

  const results = index.search(query, limit, source);
  return { query, results, indexSize: index.size };
});

// --- Stage 6: Workflow planner endpoint ---
app.post<{
  Body: {
    prompt: string;
    mode: "image" | "video";
  };
}>("/api/studio/plan", async (request, reply) => {
  const prompt = cleanText(request.body.prompt);
  const mode = request.body.mode;

  if (!prompt) {
    reply.code(400);
    return { error: "prompt is required" };
  }

  if (mode !== "image" && mode !== "video") {
    reply.code(400);
    return { error: "mode must be 'image' or 'video'" };
  }

  const { runs } = getStore();
  const history = runs.map((r) => ({
    engine: r.engine,
    mode: r.mode,
    quality: r.quality,
    aspectRatio: r.aspectRatio,
    batchSize: r.batchSize,
    score: r.score,
    status: r.status
  }));

  const plan = createPlan(prompt, mode, history, {
    imageModel: process.env.DEFAULT_IMAGE_MODEL ?? "sd_xl_base_1.0.safetensors",
    videoModel: process.env.DEFAULT_VIDEO_MODEL ?? "wan2.2_ti2v_5B_fp16.safetensors"
  });

  return plan;
});

app.post<{
  Body: {
    mode: "image" | "video";
    goal: string;
    constraints?: string[];
  };
}>("/api/assistant/plan", async (request, reply) => {
  const goal = cleanText(request.body.goal);
  const mode = request.body.mode === "video" ? "video" : "image";
  const constraints = Array.isArray(request.body.constraints)
    ? request.body.constraints.map((item) => cleanText(item)).filter(Boolean)
    : [];

  if (!goal) {
    reply.code(400);
    return { error: "goal is required" };
  }

  const { runs } = getStore();
  const history = runs.map((run) => ({
    engine: run.engine,
    mode: run.mode,
    quality: run.quality,
    aspectRatio: run.aspectRatio,
    batchSize: run.batchSize,
    score: run.score,
    status: run.status
  }));

  const prompt = [goal, ...constraints].join(". ");
  const plan = createPlan(prompt, mode, history, {
    imageModel: process.env.DEFAULT_IMAGE_MODEL ?? "sd_xl_base_1.0.safetensors",
    videoModel: process.env.DEFAULT_VIDEO_MODEL ?? "wan2.2_ti2v_5B_fp16.safetensors"
  });

  return {
    ...plan,
    goal,
    constraints
  };
});

// --- Stage 6: Run scoring endpoint ---
app.post<{
  Params: { id: string };
  Body: { score: number; notes?: string };
}>("/api/runs/:id/score", async (request, reply) => {
  const runId = request.params.id;
  const score = request.body.score;
  const notes = cleanText(request.body.notes);

  if (typeof score !== "number" || score < 1 || score > 5) {
    reply.code(400);
    return { error: "score must be a number between 1 and 5" };
  }

  const { runs } = getStore();
  const run = runs.find((r) => r.id === runId);
  if (!run) {
    reply.code(404);
    return { error: "Run not found" };
  }

  const entry = scoreRun(runId, score, notes);

  await updateRunFields(runId, { score: entry.score, scoreNotes: entry.notes });

  const decision = evaluateRegeneration(
    runId,
    run.status === "Completed" ? "completed" : "failed",
    entry.score
  );

  return {
    score: entry,
    regeneration: decision
  };
});

app.get<{
  Params: { id: string };
}>("/api/runs/:id/score", async (request, reply) => {
  const entry = getRunScore(request.params.id);
  if (!entry) {
    reply.code(404);
    return { error: "No score for this run" };
  }
  return entry;
});

// --- Stage 6: Policies endpoint ---
app.get("/api/policies", async () => {
  return {
    policies: getPolicies(),
    scoreDistribution: getScoreDistribution(),
    totalScored: getAllScores().length
  };
});

app.patch<{
  Params: { id: string };
  Body: { enabled?: boolean; threshold?: number; maxRetries?: number };
}>("/api/policies/:id", async (request, reply) => {
  const updated = updatePolicy(request.params.id, request.body);
  if (!updated) {
    reply.code(404);
    return { error: "Policy not found" };
  }
  return updated;
});

app.post<{
  Body: {
    mode: "image" | "video";
    prompt: string;
    model: string;
    aspectRatio: string;
    quality: "Standard" | "High" | "Ultra";
    batchSize?: number;
    projectId?: string;
    referenceAssetIds?: string[];
  };
}>("/api/generation/start", async (request, reply) => {
  const mode = request.body.mode;
  const prompt = cleanText(request.body.prompt);
  const model = cleanText(request.body.model);
  const normalizedModel = normalizeModelName(model, mode);
  const aspectRatio = cleanText(request.body.aspectRatio);
  const quality = request.body.quality;
  const projectId = cleanText(request.body.projectId) || null;
  const referenceAssetIds = Array.isArray(request.body.referenceAssetIds)
    ? request.body.referenceAssetIds
        .filter((value): value is string => typeof value === "string")
        .map((value) => cleanText(value))
        .filter(Boolean)
        .slice(0, MAX_REFERENCES)
    : [];
  const rawBatch = request.body.batchSize ?? 1;
  const batchSize = Math.max(MIN_BATCH, Math.min(MAX_BATCH, Math.floor(rawBatch)));

  if (!VALID_MODES.has(mode)) {
    reply.code(400);
    return { error: "mode must be 'image' or 'video'" };
  }

  if (!VALID_QUALITIES.has(quality)) {
    reply.code(400);
    return { error: "quality must be 'Standard', 'High', or 'Ultra'" };
  }

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

  if (projectId) {
    const exists = getStore().projects.some((project) => project.id === projectId);
    if (!exists) {
      reply.code(404);
      return { error: "Selected project not found." };
    }
  }

  let references: Array<{
    id: string;
    path: string;
    weight: number;
    role: "primary" | "secondary";
  }> = [];
  try {
    references = resolveReferenceAssetsForGeneration(projectId, referenceAssetIds);
  } catch (validationError) {
    reply.code(400);
    return {
      error:
        validationError instanceof Error
          ? validationError.message
          : "Invalid reference asset selection."
    };
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
    batchSize: mode === "image" ? batchSize : 1,
    projectId,
    referenceAssetIds: references.map((item) => item.id)
  });

  let job: Awaited<ReturnType<typeof createComfyOrSimulatedJob>>;
  try {
    job = await createComfyOrSimulatedJob(run.id, {
      mode,
      prompt,
      model: normalizedModel,
      aspectRatio,
      quality,
      batchSize,
      references
    });
  } catch (error) {
    await updateRunFields(run.id, {
      status: "Failed",
      duration: "Failed",
      output: error instanceof Error ? error.message : "Generation request invalid"
    });
    reply.code(400);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Generation request invalid"
    };
  }

  if (job.backend === "comfy" && job.status === "running") {
    await updateRunStatus(run.id, "Running");
    startComfyPolling(
      job,
      async (outputCount, duration) => {
        const output =
          mode === "image"
            ? `${Math.max(1, outputCount)} image(s)`
            : `${Math.max(1, outputCount)} clip artifact(s)`;
        await updateRunFields(run.id, {
          status: "Completed",
          duration,
          backend: "comfy",
          output
        });

        const policy = getRegenerationPolicyDecision(job.id);
        if (policy?.shouldRegenerate) {
          await updateRunFields(run.id, {
            output: `${output} - policy recommends retry (${policy.reasons[0]?.id ?? "quality-check"})`
          });
        }
      },
      async (reason, duration) => {
        await updateRunFields(run.id, {
          status: "Failed",
          duration,
          backend: "comfy",
          output: reason
        });

        const policy = getRegenerationPolicyDecision(job.id);
        if (policy?.shouldRegenerate) {
          await updateRunFields(run.id, {
            output: `${reason} - policy recommends retry`
          });
        }
      }
    );
  } else {
    await updateRunStatus(run.id, "Running");
    startSimulatedProgress(
      job,
      async () => {
        await updateRunStatus(run.id, "Running");
      },
      async (duration) => {
        const output = mode === "image" ? `${batchSize} image(s)` : `${aspectRatio} clip`;
        await updateRunFields(run.id, {
          status: "Completed",
          duration,
          backend: "simulated",
          output
        });

        const policy = getRegenerationPolicyDecision(job.id);
        if (policy?.shouldRegenerate) {
          await updateRunFields(run.id, {
            output: `${output} - policy recommends retry`
          });
        }
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
    workflowPath: job.workflowPath ?? null,
    policy:
      job.status === "completed" || job.status === "failed"
        ? getRegenerationPolicyDecision(job.id)
        : null
  };
});

app.get<{
  Params: { id: string };
}>("/api/generation/:id/policy", async (request, reply) => {
  const decision = getRegenerationPolicyDecision(request.params.id);
  if (!decision) {
    reply.code(404);
    return {
      error: "Job or run not found"
    };
  }

  return decision;
});

app.post<{
  Body: McpJsonRpcRequest;
}>("/api/mcp", async (request, reply) => {
  const mcpHandlers = {
    searchMemory: (mode: "image" | "video", query: string) =>
      getStudioSuggestions(mode, query),
    createPlan: (mode: "image" | "video", goal: string, constraints: string[]) => {
      const { runs } = getStore();
      const history = runs.map((run) => ({
        engine: run.engine,
        mode: run.mode,
        quality: run.quality,
        aspectRatio: run.aspectRatio,
        batchSize: run.batchSize,
        score: run.score,
        status: run.status
      }));

      return createPlan([goal, ...constraints].join(". "), mode, history, {
        imageModel: process.env.DEFAULT_IMAGE_MODEL ?? "sd_xl_base_1.0.safetensors",
        videoModel: process.env.DEFAULT_VIDEO_MODEL ?? "wan2.2_ti2v_5B_fp16.safetensors"
      });
    },
    startGeneration: async (input: {
      mode: "image" | "video";
      prompt: string;
      model: string;
      aspectRatio: string;
      quality: "Standard" | "High" | "Ultra";
      batchSize?: number;
      projectId?: string;
      referenceAssetIds?: string[];
    }) => {
      const injected = await app.inject({
        method: "POST",
        url: "/api/generation/start",
        payload: input
      });

      if (injected.statusCode >= 400) {
        throw new Error(injected.body || `Generation failed (${injected.statusCode})`);
      }

      return injected.json() as {
        jobId: string;
        runId: string;
        status: "queued" | "running" | "completed" | "failed";
        backend: "comfy" | "simulated";
        fallbackReason: string | null;
        workflowPath: string | null;
      };
    },
    getGenerationStatus: (jobId: string) => {
      const job = getGenerationJob(jobId);
      if (!job) {
        return null;
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
    },
    evaluateRegeneration: (jobId: string) => getRegenerationPolicyDecision(jobId)
  };

  const response = await handleMcpRequest(request.body ?? {}, mcpHandlers);

  if (response.error) {
    if (response.error.code === -32600 || response.error.code === -32602) {
      reply.code(400);
    } else if (response.error.code === -32601) {
      reply.code(404);
    } else {
      reply.code(500);
    }
  }

  return response;
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
