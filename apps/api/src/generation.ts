import { readFile } from "node:fs/promises";
import path from "node:path";

export type GenerationRequest = {
  mode: "image" | "video";
  prompt: string;
  model: string;
  aspectRatio: string;
  quality: "Standard" | "High" | "Ultra";
  batchSize?: number;
  references?: Array<{
    id: string;
    path: string;
    weight: number;
    role: "primary" | "secondary";
  }>;
};

export type GenerationBackend = "comfy" | "simulated";
export type GenerationStatus = "queued" | "running" | "completed" | "failed";

export type GenerationJob = {
  id: string;
  runId: string;
  backend: GenerationBackend;
  status: GenerationStatus;
  mode: "image" | "video";
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  promptId?: string;
  outputSummary?: string;
  workflowPath?: string;
};

type ComfyHistoryResult = {
  status: "running" | "completed" | "failed";
  outputCount?: number;
  error?: string;
};

const jobs = new Map<string, GenerationJob>();
const pollers = new Map<string, NodeJS.Timeout>();
const MAX_JOB_CACHE = 500;

const workflowCache = new Map<string, { content: string; loadedAt: number }>();
const WORKFLOW_CACHE_TTL = 60_000;

function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647) + 1;
}

function ratioToResolution(ratio: string, mode: "image" | "video"): { width: number; height: number } {
  const presetsImage: Record<string, { width: number; height: number }> = {
    "1:1": { width: 1024, height: 1024 },
    "4:5": { width: 896, height: 1120 },
    "3:4": { width: 896, height: 1194 },
    "16:9": { width: 1280, height: 720 },
    "9:16": { width: 720, height: 1280 }
  };

  const presetsVideo: Record<string, { width: number; height: number }> = {
    "16:9": { width: 1280, height: 720 },
    "9:16": { width: 720, height: 1280 }
  };

  const table = mode === "image" ? presetsImage : presetsVideo;
  return table[ratio] ?? (mode === "image" ? presetsImage["1:1"] : presetsVideo["16:9"]);
}

function qualityToSteps(quality: "Standard" | "High" | "Ultra"): number {
  if (quality === "Ultra") {
    return 42;
  }
  if (quality === "High") {
    return 30;
  }
  return 20;
}

function resolveWorkflowPath(mode: "image" | "video"): string | null {
  const configured =
    mode === "image"
      ? process.env.COMFY_IMAGE_WORKFLOW_PATH ?? process.env.COMFY_WORKFLOW_PATH
      : process.env.COMFY_VIDEO_WORKFLOW_PATH ?? process.env.COMFY_WORKFLOW_PATH;
  if (!configured) {
    return null;
  }

  if (path.isAbsolute(configured)) {
    return configured;
  }

  const cwd = process.cwd();
  if (path.basename(cwd) === "api") {
    return path.join(cwd, configured);
  }
  return path.join(cwd, "apps", "api", configured);
}

async function loadWorkflow(filePath: string): Promise<string> {
  const cached = workflowCache.get(filePath);
  if (cached && Date.now() - cached.loadedAt < WORKFLOW_CACHE_TTL) {
    return cached.content;
  }

  const content = await readFile(filePath, "utf8");
  workflowCache.set(filePath, { content, loadedAt: Date.now() });
  return content;
}

function escapeJsonString(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function orderedReferences(
  references: GenerationRequest["references"]
): Array<{ path: string; weight: number }> {
  const list = Array.isArray(references) ? references : [];
  const primary = list
    .filter((item) => item.role === "primary")
    .slice(0, 1)
    .map((item) => ({
      path: item.path,
      weight: Math.max(0, Math.min(1, item.weight))
    }));
  const secondary = list
    .filter((item) => item.role !== "primary")
    .slice(0, 4)
    .map((item) => ({
      path: item.path,
      weight: Math.max(0, Math.min(1, item.weight))
    }));

  return [...primary, ...secondary].slice(0, 5);
}

function applyWorkflowTokens(
  workflowText: string,
  request: GenerationRequest,
  runId: string
): string {
  const { width, height } = ratioToResolution(request.aspectRatio, request.mode);
  const steps = qualityToSteps(request.quality);
  const batch = request.mode === "image" ? request.batchSize ?? 1 : 1;
  const seed = randomSeed();
  const safePrompt = escapeJsonString(request.prompt);
  const refs = orderedReferences(request.references);

  if (refs.length > 0) {
    const hasRefPathToken = workflowText.includes("__REF1_PATH__");
    const hasRefWeightToken = workflowText.includes("__REF1_WEIGHT__");
    if (!hasRefPathToken || !hasRefWeightToken) {
      throw new Error(
        "Workflow missing reference image tokens (__REF1_PATH__ / __REF1_WEIGHT__)."
      );
    }
  }

  const refPaths = new Array<string>(5).fill("");
  const refWeights = new Array<string>(5).fill("0");
  for (let index = 0; index < refs.length; index += 1) {
    refPaths[index] = escapeJsonString(refs[index].path);
    refWeights[index] = String(refs[index].weight);
  }

  let updated = workflowText
    .replaceAll("\"__WIDTH__\"", String(width))
    .replaceAll("\"__HEIGHT__\"", String(height))
    .replaceAll("\"__STEPS__\"", String(steps))
    .replaceAll("\"__BATCH__\"", String(batch))
    .replaceAll("\"__SEED__\"", String(seed))
    .replaceAll("__PROMPT__", safePrompt)
    .replaceAll("__MODEL__", request.model)
    .replaceAll("__WIDTH__", String(width))
    .replaceAll("__HEIGHT__", String(height))
    .replaceAll("__STEPS__", String(steps))
    .replaceAll("__BATCH__", String(batch))
    .replaceAll("__SEED__", String(seed))
    .replaceAll("__RUN_ID__", runId);

  for (let index = 0; index < 5; index += 1) {
    const i = index + 1;
    updated = updated
      .replaceAll(`"__REF${i}_PATH__"`, `"${refPaths[index]}"`)
      .replaceAll(`"__REF${i}_WEIGHT__"`, refWeights[index])
      .replaceAll(`__REF${i}_PATH__`, refPaths[index])
      .replaceAll(`__REF${i}_WEIGHT__`, refWeights[index]);
  }

  updated = updated.replaceAll("\"__REF_COUNT__\"", String(refs.length));
  updated = updated.replaceAll("__REF_COUNT__", String(refs.length));
  return updated;
}

async function submitToComfy(
  request: GenerationRequest,
  runId: string
): Promise<{ promptId: string; workflowPath: string }> {
  const comfyUrl = process.env.COMFYUI_URL ?? "http://127.0.0.1:8188";
  const workflowPath = resolveWorkflowPath(request.mode);

  if (!workflowPath) {
    throw new Error(
      request.mode === "image"
        ? "COMFY_IMAGE_WORKFLOW_PATH (or COMFY_WORKFLOW_PATH) is not configured"
        : "COMFY_VIDEO_WORKFLOW_PATH (or COMFY_WORKFLOW_PATH) is not configured"
    );
  }

  const rawWorkflow = await loadWorkflow(workflowPath);

  let workflowJson: unknown;
  try {
    workflowJson = JSON.parse(applyWorkflowTokens(rawWorkflow, request, runId));
  } catch (parseError) {
    throw new Error(
      `Workflow JSON parse failed after token substitution: ${(parseError as Error).message}`
    );
  }

  const response = await fetch(`${comfyUrl}/prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt: workflowJson
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(could not read response body)");
    throw new Error(`Comfy submit failed with ${response.status}: ${body.slice(0, 500)}`);
  }

  const payload = (await response.json()) as { prompt_id?: string };
  if (!payload.prompt_id) {
    throw new Error("Comfy response missing prompt_id");
  }

  return { promptId: payload.prompt_id, workflowPath };
}

async function fetchComfyHistory(promptId: string): Promise<ComfyHistoryResult> {
  const comfyUrl = process.env.COMFYUI_URL ?? "http://127.0.0.1:8188";

  let response: Response;
  try {
    response = await fetch(`${comfyUrl}/history/${promptId}`);
  } catch {
    return { status: "running" };
  }

  if (!response.ok) {
    return { status: "running" };
  }

  let payload: Record<string, any>;
  try {
    payload = (await response.json()) as Record<string, any>;
  } catch {
    return { status: "running" };
  }

  const run = payload[promptId];
  if (!run) {
    return { status: "running" };
  }

  const finished =
    run.status?.completed === true ||
    run.status_str === "success" ||
    run.status?.status_str === "success";
  const failed =
    run.status_str === "error" ||
    run.status?.status_str === "error";

  if (failed) {
    return {
      status: "failed",
      error: run.status?.messages?.[0]?.[1]?.exception_message ?? "Comfy run failed"
    };
  }

  if (!finished) {
    return { status: "running" };
  }

  const outputs = run.outputs ? Object.values(run.outputs) : [];
  let outputCount = 0;
  for (const output of outputs) {
    const out = output as Record<string, unknown>;
    if (Array.isArray(out.images)) {
      outputCount += out.images.length;
    }
    if (Array.isArray(out.gifs)) {
      outputCount += out.gifs.length;
    }
  }

  return {
    status: "completed",
    outputCount
  };
}

function clearJobPoller(jobId: string): void {
  const timer = pollers.get(jobId);
  if (timer) {
    clearInterval(timer);
    pollers.delete(jobId);
  }
}

export function getGenerationJob(jobId: string): GenerationJob | null {
  return jobs.get(jobId) ?? null;
}

function pruneJobs(): void {
  if (jobs.size <= MAX_JOB_CACHE) {
    return;
  }

  const ordered = [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt);
  const keepIds = new Set(ordered.slice(0, MAX_JOB_CACHE).map((item) => item.id));

  for (const jobId of jobs.keys()) {
    if (!keepIds.has(jobId)) {
      clearJobPoller(jobId);
      jobs.delete(jobId);
    }
  }
}

export function formatDuration(startMs: number, endMs: number): string {
  const totalSeconds = Math.round((endMs - startMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function createSimulatedJob(runId: string, request: GenerationRequest): GenerationJob {
  const job: GenerationJob = {
    id: crypto.randomUUID(),
    runId,
    backend: "simulated",
    status: "queued",
    mode: request.mode,
    createdAt: Date.now()
  };
  jobs.set(job.id, job);
  pruneJobs();
  return job;
}

export async function createComfyOrSimulatedJob(
  runId: string,
  request: GenerationRequest
): Promise<GenerationJob> {
  const comfyEnabled = process.env.COMFY_ENABLED === "1";
  const jobId = crypto.randomUUID();

  const initial: GenerationJob = {
    id: jobId,
    runId,
    backend: comfyEnabled ? "comfy" : "simulated",
    status: "queued",
    mode: request.mode,
    createdAt: Date.now()
  };
  jobs.set(jobId, initial);
  pruneJobs();

  if (!comfyEnabled) {
    return initial;
  }

  try {
    const submission = await submitToComfy(request, runId);
    const running: GenerationJob = {
      ...initial,
      status: "running",
      promptId: submission.promptId,
      workflowPath: submission.workflowPath,
      startedAt: Date.now()
    };
    jobs.set(jobId, running);
    return running;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (request.mode === "video") {
      jobs.delete(jobId);
      throw new Error(`Video generation requires successful Comfy submission: ${reason}`);
    }

    if (
      reason.includes("Workflow missing reference image tokens") ||
      reason.includes("Workflow JSON parse failed after token substitution")
    ) {
      jobs.delete(jobId);
      throw new Error(reason);
    }

    const fallback: GenerationJob = {
      ...initial,
      backend: "simulated",
      status: "queued",
      error: reason
    };
    jobs.set(jobId, fallback);
    return fallback;
  }
}

const POLL_INITIAL_MS = 2000;
const POLL_MAX_MS = 10_000;
const POLL_BACKOFF = 1.5;

export function startComfyPolling(
  job: GenerationJob,
  onCompleted: (outputCount: number, durationStr: string) => Promise<void>,
  onFailed: (reason: string, durationStr: string) => Promise<void>
): void {
  if (!job.promptId || job.backend !== "comfy") {
    return;
  }

  clearJobPoller(job.id);
  const startTime = job.startedAt ?? Date.now();
  let currentInterval = POLL_INITIAL_MS;
  let polling = false;

  const poll = async () => {
    if (polling) {
      return;
    }
    polling = true;

    const current = jobs.get(job.id);
    if (!current || current.status === "completed" || current.status === "failed") {
      clearJobPoller(job.id);
      polling = false;
      return;
    }

    try {
      const result = await fetchComfyHistory(job.promptId!);
      if (result.status === "running") {
        polling = false;
        // Increase interval with backoff
        currentInterval = Math.min(currentInterval * POLL_BACKOFF, POLL_MAX_MS);
        clearJobPoller(job.id);
        const timer = setTimeout(poll, currentInterval);
        pollers.set(job.id, timer);
        return;
      }

      const endTime = Date.now();
      const duration = formatDuration(startTime, endTime);

      if (result.status === "failed") {
        const failed: GenerationJob = {
          ...current,
          status: "failed",
          completedAt: endTime,
          error: result.error ?? "Generation failed"
        };
        jobs.set(job.id, failed);
        clearJobPoller(job.id);
        polling = false;
        await onFailed(failed.error ?? "Generation failed", duration);
        return;
      }

      const done: GenerationJob = {
        ...current,
        status: "completed",
        completedAt: endTime,
        outputSummary: `${result.outputCount ?? 0} artifact(s)`
      };
      jobs.set(job.id, done);
      clearJobPoller(job.id);
      polling = false;
      await onCompleted(result.outputCount ?? 0, duration);
    } catch (error) {
      const endTime = Date.now();
      const duration = formatDuration(startTime, endTime);
      const errorMsg = error instanceof Error ? error.message : String(error);
      const failed: GenerationJob = {
        ...current,
        status: "failed",
        completedAt: endTime,
        error: errorMsg
      };
      jobs.set(job.id, failed);
      clearJobPoller(job.id);
      polling = false;
      await onFailed(errorMsg, duration);
    }
  };

  const timer = setTimeout(poll, currentInterval);
  pollers.set(job.id, timer);
}

export function startSimulatedProgress(
  job: GenerationJob,
  onRunning: () => Promise<void>,
  onCompleted: (durationStr: string) => Promise<void>
): void {
  const startTime = Date.now();
  jobs.set(job.id, {
    ...job,
    status: "running",
    startedAt: startTime
  });

  void onRunning();

  const duration = job.mode === "image" ? 3000 : 5500;
  const timer = setTimeout(async () => {
    const current = jobs.get(job.id);
    if (!current) {
      return;
    }

    const endTime = Date.now();
    jobs.set(job.id, {
      ...current,
      status: "completed",
      completedAt: endTime,
      outputSummary: current.mode === "image" ? "simulated image set" : "simulated video clip"
    });
    await onCompleted(formatDuration(startTime, endTime));
  }, duration);

  pollers.set(job.id, timer);
}
