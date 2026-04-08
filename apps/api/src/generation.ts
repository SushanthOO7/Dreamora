import { readFile } from "node:fs/promises";
import path from "node:path";

export type GenerationRequest = {
  mode: "image" | "video";
  prompt: string;
  model: string;
  aspectRatio: string;
  quality: "Standard" | "High" | "Ultra";
  batchSize?: number;
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

function applyWorkflowTokens(
  workflowText: string,
  request: GenerationRequest,
  runId: string
): string {
  const { width, height } = ratioToResolution(request.aspectRatio, request.mode);
  const steps = qualityToSteps(request.quality);
  const batch = request.mode === "image" ? request.batchSize ?? 1 : 1;

  return workflowText
    .replaceAll("__PROMPT__", request.prompt)
    .replaceAll("__MODEL__", request.model)
    .replaceAll("__WIDTH__", String(width))
    .replaceAll("__HEIGHT__", String(height))
    .replaceAll("__STEPS__", String(steps))
    .replaceAll("__BATCH__", String(batch))
    .replaceAll("__RUN_ID__", runId);
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

  const rawWorkflow = await readFile(workflowPath, "utf8");
  const workflowJson = JSON.parse(applyWorkflowTokens(rawWorkflow, request, runId));

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
    throw new Error(`Comfy submit failed with ${response.status}`);
  }

  const payload = (await response.json()) as { prompt_id?: string };
  if (!payload.prompt_id) {
    throw new Error("Comfy response missing prompt_id");
  }

  return { promptId: payload.prompt_id, workflowPath };
}

async function fetchComfyHistory(promptId: string): Promise<ComfyHistoryResult> {
  const comfyUrl = process.env.COMFYUI_URL ?? "http://127.0.0.1:8188";
  const response = await fetch(`${comfyUrl}/history/${promptId}`);

  if (!response.ok) {
    return { status: "running" };
  }

  const payload = (await response.json()) as Record<string, any>;
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
    if (Array.isArray((output as any).images)) {
      outputCount += (output as any).images.length;
    }
    if (Array.isArray((output as any).gifs)) {
      outputCount += (output as any).gifs.length;
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
    pruneJobs();
    return running;
  } catch (error) {
    const fallback: GenerationJob = {
      ...initial,
      backend: "simulated",
      status: "queued",
      error: (error as Error).message
    };
    jobs.set(jobId, fallback);
    pruneJobs();
    return fallback;
  }
}

export function startComfyPolling(
  job: GenerationJob,
  onCompleted: (outputCount: number) => Promise<void>,
  onFailed: (reason: string) => Promise<void>
): void {
  if (!job.promptId || job.backend !== "comfy") {
    return;
  }

  clearJobPoller(job.id);
  const timer = setInterval(async () => {
    const current = jobs.get(job.id);
    if (!current || current.status === "completed" || current.status === "failed") {
      clearJobPoller(job.id);
      return;
    }

    try {
      const result = await fetchComfyHistory(job.promptId!);
      if (result.status === "running") {
        return;
      }

      if (result.status === "failed") {
        const failed: GenerationJob = {
          ...current,
          status: "failed",
          completedAt: Date.now(),
          error: result.error ?? "Generation failed"
        };
        jobs.set(job.id, failed);
        pruneJobs();
        clearJobPoller(job.id);
        await onFailed(failed.error ?? "Generation failed");
        return;
      }

      const done: GenerationJob = {
        ...current,
        status: "completed",
        completedAt: Date.now(),
        outputSummary: `${result.outputCount ?? 0} artifact(s)`
      };
      jobs.set(job.id, done);
      pruneJobs();
      clearJobPoller(job.id);
      await onCompleted(result.outputCount ?? 0);
    } catch (error) {
      const failed: GenerationJob = {
        ...current,
        status: "failed",
        completedAt: Date.now(),
        error: (error as Error).message
      };
      jobs.set(job.id, failed);
      pruneJobs();
      clearJobPoller(job.id);
      await onFailed(failed.error ?? "Generation failed");
    }
  }, 4000);

  pollers.set(job.id, timer);
}

export function startSimulatedProgress(
  job: GenerationJob,
  onRunning: () => Promise<void>,
  onCompleted: () => Promise<void>
): void {
  jobs.set(job.id, {
    ...job,
    status: "running",
    startedAt: Date.now()
  });
  pruneJobs();

  void onRunning();

  const timer = setTimeout(async () => {
    const current = jobs.get(job.id);
    if (!current) {
      return;
    }

    jobs.set(job.id, {
      ...current,
      status: "completed",
      completedAt: Date.now(),
      outputSummary: current.mode === "image" ? "simulated image set" : "simulated video clip"
    });
    pruneJobs();
    await onCompleted();
  }, 5500);

  pollers.set(job.id, timer);
}
