import type { ProviderConfig, RunSummary } from "@dreamora/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const ERROR_DETAIL_LIMIT = 1200;

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`GET ${path} failed (${response.status}): ${detail.slice(0, ERROR_DETAIL_LIMIT)}`);
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`POST ${path} failed (${response.status}): ${detail.slice(0, ERROR_DETAIL_LIMIT)}`);
  }

  return response.json() as Promise<T>;
}

async function deleteJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`DELETE ${path} failed (${response.status}): ${detail.slice(0, ERROR_DETAIL_LIMIT)}`);
  }

  return response.json() as Promise<T>;
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`PATCH ${path} failed (${response.status}): ${detail.slice(0, ERROR_DETAIL_LIMIT)}`);
  }

  return response.json() as Promise<T>;
}

export async function createProject(input: {
  name: string;
  format: string;
  status: string;
  summary: string;
}) {
  return postJson("/api/projects", input);
}

export async function createPrompt(input: {
  title: string;
  engine: string;
  type: string;
  summary: string;
  tags: string[];
  projectId?: string;
}) {
  return postJson("/api/prompts", input);
}

export async function createProvider(input: {
  name: string;
  category: string;
  auth: string;
  defaultModel: string;
  note: string;
}) {
  return postJson("/api/providers", input);
}

export async function updateProviderCredentials(
  providerId: string,
  configured: boolean,
  secretHint?: string
) {
  return patchJson(`/api/providers/${providerId}/credentials`, {
    configured,
    secretHint
  });
}

export async function createRun(input: {
  title: string;
  engine: string;
  mode: "image" | "video";
  status: string;
  duration: string;
  output: string;
  tokensUsed?: number;
  projectId?: string;
  referenceAssetIds?: string[];
}): Promise<RunSummary> {
  return postJson<RunSummary>("/api/runs", input);
}

export type StudioAsset = {
  id: string;
  scope: "project" | "global";
  projectId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  role: "primary" | "secondary";
  weight: number;
  createdAt: string;
  updatedAt: string;
  previewUrl: string;
};

export async function uploadAsset(input: FormData): Promise<StudioAsset> {
  const response = await fetch(`${API_URL}/api/assets/upload`, {
    method: "POST",
    body: input
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `POST /api/assets/upload failed (${response.status}): ${detail.slice(0, ERROR_DETAIL_LIMIT)}`
    );
  }

  return response.json() as Promise<StudioAsset>;
}

export async function listAssets(
  scope: "project" | "global",
  projectId?: string
): Promise<StudioAsset[]> {
  const params = new URLSearchParams();
  params.set("scope", scope);
  if (scope === "project" && projectId) {
    params.set("projectId", projectId);
  }

  const payload = await getJson<{
    scope: "project" | "global";
    projectId: string | null;
    assets: StudioAsset[];
  }>(`/api/assets?${params.toString()}`);

  return payload.assets;
}

export async function deleteAsset(assetId: string): Promise<{
  deleted: boolean;
  assetId: string;
  deletedRunIds: string[];
}> {
  return deleteJson(`/api/assets/${assetId}`);
}

export async function deleteProject(projectId: string): Promise<{
  deleted: boolean;
  projectId: string;
  deletedRunIds: string[];
  deletedPromptIds: string[];
  deletedAssetIds: string[];
}> {
  return deleteJson(`/api/projects/${projectId}`);
}

export async function updateRunStatus(
  runId: string,
  status: string,
  duration?: string
): Promise<RunSummary> {
  return patchJson<RunSummary>(`/api/runs/${runId}/status`, {
    status,
    duration
  });
}

export type StartGenerationRequest = {
  mode: "image" | "video";
  prompt: string;
  model: string;
  aspectRatio: string;
  quality: "Standard" | "High" | "Ultra";
  batchSize?: number;
  projectId?: string;
  referenceAssetIds?: string[];
};

export type StartGenerationResponse = {
  jobId: string;
  runId: string;
  status: "queued" | "running" | "completed" | "failed";
  backend: "comfy" | "simulated";
  fallbackReason: string | null;
  workflowPath: string | null;
};

export type GenerationStatusResponse = {
  id: string;
  runId: string;
  status: "queued" | "running" | "completed" | "failed";
  backend: "comfy" | "simulated";
  error: string | null;
  outputSummary: string | null;
  workflowPath: string | null;
  policy?: {
    policyVersion: string;
    shouldRegenerate: boolean;
    severity: "low" | "medium" | "high";
    reasons: Array<{
      id: string;
      severity: "low" | "medium" | "high";
      message: string;
    }>;
    suggestedAdjustments: {
      quality?: "Standard" | "High" | "Ultra";
      batchSize?: number;
      aspectRatio?: string;
      promptAddendum?: string;
    };
    nextAction:
      | "continue_polling"
      | "accept_result"
      | "retry_with_adjustments"
      | "manual_review";
  } | null;
};

export type StudioSuggestionsResponse = {
  mode: "image" | "video";
  memory: {
    promptMatches: Array<{
      id: string;
      title: string;
      summary: string;
      tags: string[];
      score: number;
    }>;
    topRuns: Array<{
      id: string;
      title: string;
      engine: string;
      mode: "image" | "video";
      status: string;
      duration: string;
      output: string;
      tokensUsed: number;
      aspectRatio: string | null;
      quality: string | null;
      batchSize: number | null;
      promptExcerpt: string | null;
    }>;
  };
  recommendations: {
    model: string;
    aspectRatio: string;
    quality: "Standard" | "High" | "Ultra";
    batchSize: number;
    averageTokens: number;
  };
};

export async function startGeneration(
  input: StartGenerationRequest
): Promise<StartGenerationResponse> {
  return postJson<StartGenerationResponse>("/api/generation/start", input);
}

export async function getGenerationStatus(
  jobId: string
): Promise<GenerationStatusResponse> {
  return getJson<GenerationStatusResponse>(`/api/generation/${jobId}`);
}

export async function getGenerationPolicy(jobId: string): Promise<NonNullable<GenerationStatusResponse["policy"]>> {
  return getJson<NonNullable<GenerationStatusResponse["policy"]>>(`/api/generation/${jobId}/policy`);
}

export async function getStudioSuggestions(
  mode: "image" | "video",
  query: string
): Promise<StudioSuggestionsResponse> {
  const params = new URLSearchParams();
  params.set("mode", mode);
  if (query.trim()) {
    params.set("query", query.trim());
  }

  const response = await fetch(`${API_URL}/api/studio/suggestions?${params.toString()}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Could not load studio suggestions");
  }

  return response.json() as Promise<StudioSuggestionsResponse>;
}

// --- Stage 6: Planner ---
export type PlanStep = {
  order: number;
  action: string;
  engine: string;
  description: string;
  estimatedTokens: number;
  optional: boolean;
};

export type GenerationPlan = {
  id: string;
  mode: "image" | "video";
  prompt: string;
  contentSignals: {
    hasProduct: boolean;
    hasPortrait: boolean;
    hasMotion: boolean;
    hasTypography: boolean;
    hasUpscale: boolean;
    complexity: "simple" | "standard" | "complex";
    style: string | null;
  };
  steps: PlanStep[];
  estimatedTotalTokens: number;
  recommendedSettings: {
    model: string;
    aspectRatio: string;
    quality: "Standard" | "High" | "Ultra";
    batchSize: number;
  };
  reasoning: string;
};

export async function getGenerationPlan(
  prompt: string,
  mode: "image" | "video"
): Promise<GenerationPlan> {
  return postJson<GenerationPlan>("/api/studio/plan", { prompt, mode });
}

// --- Stage 6: Scoring ---
export type ScoreResponse = {
  score: { runId: string; score: number; notes: string; scoredAt: string };
  regeneration: {
    shouldRegenerate: boolean;
    policyId: string | null;
    reason: string;
    adjustments: Array<{ parameter: string; action: string; value?: number | string }>;
    retriesUsed: number;
    maxRetries: number;
  };
};

export async function scoreRun(
  runId: string,
  score: number,
  notes?: string
): Promise<ScoreResponse> {
  return postJson<ScoreResponse>(`/api/runs/${runId}/score`, { score, notes: notes ?? "" });
}

// --- Stage 6: Semantic search ---
export type SemanticSearchResult = {
  id: string;
  score: number;
  source: "prompt" | "run";
  meta: Record<string, unknown>;
};

export async function semanticSearch(
  query: string,
  source?: "prompt" | "run"
): Promise<{ query: string; results: SemanticSearchResult[]; indexSize: number }> {
  const params = new URLSearchParams({ query });
  if (source) params.set("source", source);

  const response = await fetch(`${API_URL}/api/studio/search?${params.toString()}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Semantic search failed");
  }

  return response.json() as Promise<{ query: string; results: SemanticSearchResult[]; indexSize: number }>;
}

export type StudioModelGroups = {
  imageModels: string[];
  videoModels: string[];
};

export function deriveModelsFromProviders(providers: ProviderConfig[]): StudioModelGroups {
  const imageModels: string[] = [];
  const videoModels: string[] = [];

  for (const provider of providers) {
    const text = `${provider.name} ${provider.defaultModel}`.toLowerCase();
    const hasImage = text.includes("flux") || text.includes("image") || text.includes("sdxl");
    const hasVideo = text.includes("wan") || text.includes("runway") || text.includes("video");
    const isConnected = provider.secretConfigured || provider.category === "Self-hosted";

    if (!isConnected && provider.status !== "Optional") {
      continue;
    }

    // When a provider supports both image and video (e.g. "FLUX + Wan 2.2"),
    // split into mode-specific friendly names so the UI shows the right model per mode.
    if (hasImage && hasVideo) {
      const imgName = text.includes("flux") ? "FLUX.1-dev GGUF" : "Image model";
      const vidName = text.includes("wan") ? "Wan 2.2 5B" : text.includes("runway") ? "Runway Gen-4" : "Video model";
      imageModels.push(imgName);
      videoModels.push(vidName);
    } else if (hasVideo) {
      const model = provider.defaultModel?.trim() || `${provider.name} model`;
      videoModels.push(model);
    } else {
      const model = provider.defaultModel?.trim() || `${provider.name} model`;
      imageModels.push(model);
    }
  }

  // Deduplicate while preserving order
  const uniqueImage = [...new Set(imageModels)];
  const uniqueVideo = [...new Set(videoModels)];

  return {
    imageModels: uniqueImage.length > 0 ? uniqueImage : ["FLUX.1-dev GGUF"],
    videoModels: uniqueVideo.length > 0 ? uniqueVideo : ["Wan 2.2 5B"]
  };
}
