import type { ProviderConfig, RunSummary } from "@dreamora/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${path}`);
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
    throw new Error(`Request failed: ${path}`);
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

export type StudioModelGroups = {
  imageModels: string[];
  videoModels: string[];
};

export function deriveModelsFromProviders(providers: ProviderConfig[]): StudioModelGroups {
  const imageModels: string[] = [];
  const videoModels: string[] = [];

  for (const provider of providers) {
    const model = `${provider.name} ${provider.defaultModel}`;
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
    imageModels: imageModels.length > 0 ? imageModels : ["Dreamora FLUX local"],
    videoModels: videoModels.length > 0 ? videoModels : ["Dreamora Wan 2.2 local"]
  };
}
