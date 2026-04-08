import type { GenerationPlan } from "./planner.js";
import type { RegenerationPolicyDecision } from "./policy.js";
import type { GenerationStatus } from "./generation.js";

type Mode = "image" | "video";

export type McpJsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

type McpErrorCode = -32700 | -32600 | -32601 | -32602 | -32603;

type McpJsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: McpErrorCode;
    message: string;
  };
};

export type McpGenerationStatus = {
  id: string;
  runId: string;
  status: GenerationStatus;
  backend: "comfy" | "simulated";
  error: string | null;
  outputSummary: string | null;
  workflowPath: string | null;
};

export type McpHandlers = {
  searchMemory: (mode: Mode, query: string) => {
    mode: Mode;
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
        mode: Mode;
        status: string;
        duration: string;
        output: string;
        tokensUsed: number;
        aspectRatio: string | null;
        quality: string | null;
        batchSize: number | null;
        promptExcerpt: string | null;
        score?: number | null;
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
  createPlan: (mode: Mode, goal: string, constraints: string[]) => GenerationPlan;
  startGeneration: (input: {
    mode: Mode;
    prompt: string;
    model: string;
    aspectRatio: string;
    quality: "Standard" | "High" | "Ultra";
    batchSize?: number;
    projectId?: string;
    referenceAssetIds?: string[];
  }) => Promise<{
    jobId: string;
    runId: string;
    status: GenerationStatus;
    backend: "comfy" | "simulated";
    fallbackReason: string | null;
    workflowPath: string | null;
  }>;
  getGenerationStatus: (jobId: string) => McpGenerationStatus | null;
  evaluateRegeneration: (jobId: string) => RegenerationPolicyDecision | null;
};

const TOOL_DEFINITIONS = [
  {
    name: "dreamora.search_memory",
    description: "Semantic retrieval over prompts and completed runs.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["image", "video"] },
        query: { type: "string" }
      },
      required: ["mode", "query"]
    }
  },
  {
    name: "dreamora.plan_workflow",
    description: "Build an assistant workflow plan from goal and mode.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["image", "video"] },
        goal: { type: "string" },
        constraints: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["mode", "goal"]
    }
  },
  {
    name: "dreamora.start_generation",
    description: "Start an image or video generation job.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["image", "video"] },
        prompt: { type: "string" },
        model: { type: "string" },
        aspectRatio: { type: "string" },
        quality: { type: "string", enum: ["Standard", "High", "Ultra"] },
        batchSize: { type: "number" },
        projectId: { type: "string" },
        referenceAssetIds: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["mode", "prompt", "model", "aspectRatio", "quality"]
    }
  },
  {
    name: "dreamora.get_generation_status",
    description: "Read generation status for a job id.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string" }
      },
      required: ["jobId"]
    }
  },
  {
    name: "dreamora.evaluate_regeneration",
    description: "Evaluate policy-based regeneration recommendation for a job id.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string" }
      },
      required: ["jobId"]
    }
  }
] as const;

function success(id: string | number | null, result: unknown): McpJsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}

function failure(
  id: string | number | null,
  code: McpErrorCode,
  message: string
): McpJsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message
    }
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asMode(value: unknown): Mode {
  return value === "video" ? "video" : "image";
}

function asConstraints(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

export async function handleMcpRequest(
  request: McpJsonRpcRequest,
  handlers: McpHandlers
): Promise<McpJsonRpcResponse> {
  const id = request.id ?? null;

  if (request.jsonrpc && request.jsonrpc !== "2.0") {
    return failure(id, -32600, "jsonrpc must be '2.0'");
  }

  const method = request.method;
  if (!method || typeof method !== "string") {
    return failure(id, -32600, "method is required");
  }

  try {
    if (method === "initialize") {
      return success(id, {
        protocolVersion: "2025-03-26",
        serverInfo: {
          name: "dreamora-orchestrator",
          version: "0.1.0-stage6"
        },
        capabilities: {
          tools: true
        }
      });
    }

    if (method === "tools/list") {
      return success(id, {
        tools: TOOL_DEFINITIONS
      });
    }

    if (method !== "tools/call") {
      return failure(id, -32601, `Unsupported method: ${method}`);
    }

    const params = request.params ?? {};
    const name = asString(params.name);
    const args = (params.arguments ?? {}) as Record<string, unknown>;

    if (!name) {
      return failure(id, -32602, "tools/call requires params.name");
    }

    if (name === "dreamora.search_memory") {
      const mode = asMode(args.mode);
      const query = asString(args.query);
      return success(id, handlers.searchMemory(mode, query));
    }

    if (name === "dreamora.plan_workflow") {
      const mode = asMode(args.mode);
      const goal = asString(args.goal).trim();
      if (!goal) {
        return failure(id, -32602, "goal is required");
      }
      const constraints = asConstraints(args.constraints);
      return success(id, handlers.createPlan(mode, goal, constraints));
    }

    if (name === "dreamora.start_generation") {
      const prompt = asString(args.prompt).trim();
      const model = asString(args.model).trim();
      const aspectRatio = asString(args.aspectRatio).trim();
      const qualityRaw = asString(args.quality).trim();
      const quality: "Standard" | "High" | "Ultra" =
        qualityRaw === "Ultra" ? "Ultra" : qualityRaw === "Standard" ? "Standard" : "High";

      if (!prompt || !model || !aspectRatio) {
        return failure(
          id,
          -32602,
          "start_generation requires prompt, model, and aspectRatio"
        );
      }

      const batchSize =
        typeof args.batchSize === "number" && Number.isFinite(args.batchSize)
          ? Math.max(1, Math.floor(args.batchSize))
          : undefined;
      const projectId = asString(args.projectId).trim() || undefined;
      const referenceAssetIds = Array.isArray(args.referenceAssetIds)
        ? args.referenceAssetIds
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 5)
        : undefined;

      const result = await handlers.startGeneration({
        mode: asMode(args.mode),
        prompt,
        model,
        aspectRatio,
        quality,
        batchSize,
        projectId,
        referenceAssetIds
      });
      return success(id, result);
    }

    if (name === "dreamora.get_generation_status") {
      const jobId = asString(args.jobId).trim();
      if (!jobId) {
        return failure(id, -32602, "jobId is required");
      }

      const status = handlers.getGenerationStatus(jobId);
      if (!status) {
        return failure(id, -32602, "Job not found");
      }
      return success(id, status);
    }

    if (name === "dreamora.evaluate_regeneration") {
      const jobId = asString(args.jobId).trim();
      if (!jobId) {
        return failure(id, -32602, "jobId is required");
      }
      const decision = handlers.evaluateRegeneration(jobId);
      if (!decision) {
        return failure(id, -32602, "Policy evaluation unavailable for job");
      }
      return success(id, decision);
    }

    return failure(id, -32601, `Unsupported tool: ${name}`);
  } catch (error) {
    return failure(
      id,
      -32603,
      error instanceof Error ? error.message : "MCP handler failure"
    );
  }
}
