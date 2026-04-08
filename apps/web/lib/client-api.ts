import type { ProviderConfig, RunSummary } from "@dreamora/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

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
    throw new Error(`POST ${path} failed (${response.status}): ${detail.slice(0, 200)}`);
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
    throw new Error(`PATCH ${path} failed (${response.status}): ${detail.slice(0, 200)}`);
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
}): Promise<RunSummary> {
  return postJson<RunSummary>("/api/runs", input);
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
  const response = await fetch(`${API_URL}/api/generation/${jobId}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Request failed: /api/generation/${jobId}`);
  }

  return response.json() as Promise<GenerationStatusResponse>;
}

export async function getGenerationPolicy(jobId: string): Promise<NonNullable<GenerationStatusResponse["policy"]>> {
  const response = await fetch(`${API_URL}/api/generation/${jobId}/policy`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Request failed: /api/generation/${jobId}/policy`);
  }

  return response.json() as Promise<NonNullable<GenerationStatusResponse["policy"]>>;
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
    const model = provider.defaultModel?.trim() || `${provider.name} model`;
    const text = `${provider.name} ${provider.defaultModel}`.toLowerCase();
    const isVideo = text.includes("wan") || text.includes("runway") || text.includes("video");
    const isConnected = provider.secretConfigured || provider.category === "Self-hosted";

    if (!isConnected && provider.status !== "Optional") {
      continue;
    }

    if (isVideo) {
      videoModels.push(model);
    } else {
      imageModels.push(model);
    }
  }

  return {
    imageModels: imageModels.length > 0 ? imageModels : ["sd_xl_base_1.0.safetensors"],
    videoModels: videoModels.length > 0 ? videoModels : ["wan2.2_ti2v_5B_fp16.safetensors"]
  };
}
