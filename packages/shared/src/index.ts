export type Metric = {
  label: string;
  value: string;
  detail: string;
};

export type PipelineStage = {
  name: string;
  status: "Ready" | "Queued" | "Draft";
  description: string;
};

export type WorkflowNode = {
  title: string;
  subtitle: string;
  state: "Recommended" | "Optional" | "Later";
};

export type Capability = {
  title: string;
  description: string;
};

export type DashboardResponse = {
  metrics: Metric[];
  sidebar: string[];
  pipeline: PipelineStage[];
  workflow: WorkflowNode[];
  capabilities: Capability[];
};

export type ModelRecommendation = {
  name: string;
  role: string;
  summary: string;
  tags: string[];
};

export type ProjectSummary = {
  id?: string;
  name: string;
  format: string;
  status: string;
  updatedAt: string;
  summary: string;
};

export type PromptPreset = {
  id?: string;
  title: string;
  engine: string;
  type: string;
  summary: string;
  tags: string[];
};

export type RunSummary = {
  id?: string;
  title: string;
  engine: string;
  status: string;
  duration: string;
  output: string;
  mode?: "image" | "video";
  tokensUsed?: number;
};

export type SettingsGroup = {
  title: string;
  description: string;
  items: {
    label: string;
    value: string;
  }[];
};

export type ProviderConfig = {
  id?: string;
  name: string;
  category: string;
  status: string;
  auth: string;
  defaultModel: string;
  note: string;
  secretConfigured?: boolean;
  secretHint?: string | null;
};

export type UsageMetric = {
  label: string;
  value: string;
  detail: string;
};

export type UsageSeries = {
  label: string;
  value: number;
  color: string;
};

export const dashboardResponse: DashboardResponse = {
  metrics: [
    {
      label: "Primary image engine",
      value: "FLUX GGUF",
      detail: "Best prompt adherence and typography quality on your V100."
    },
    {
      label: "Primary video engine",
      value: "Wan 2.2 5B",
      detail: "Comfortable FP16 fit with TeaCache and offloading support."
    },
    {
      label: "Default finishing pass",
      value: "SeedVR2",
      detail: "High-quality upscale after low-resolution generation."
    }
  ],
  sidebar: [
    "Home",
    "Projects",
    "Prompts",
    "Runs",
    "References",
    "Model Library",
    "Automation Studio",
    "Cluster Settings"
  ],
  pipeline: [
    {
      name: "Prompt memory",
      status: "Ready",
      description:
        "Retrieve prior shots, styles, captions, and notes before generation."
    },
    {
      name: "Image draft",
      status: "Ready",
      description:
        "Generate a clean still image in FLUX.1-dev GGUF Q5_K_S or Q6_K."
    },
    {
      name: "Video finish",
      status: "Queued",
      description:
        "Animate through Wan 2.2 5B, then interpolate and upscale."
    }
  ],
  workflow: [
    {
      title: "Retrieve prompt context",
      subtitle: "Pull references, style cards, and prior successful prompts.",
      state: "Recommended"
    },
    {
      title: "Generate keyframe with FLUX",
      subtitle: "Run GGUF image generation with V100-safe attention defaults.",
      state: "Recommended"
    },
    {
      title: "Animate in Wan 2.2",
      subtitle: "Use TeaCache and block offloading for efficient video creation.",
      state: "Recommended"
    },
    {
      title: "Interpolate and upscale",
      subtitle: "Apply RIFE then SeedVR2 or Real-ESRGAN based on target output.",
      state: "Recommended"
    },
    {
      title: "Quality review agent",
      subtitle: "Score coherence, motion, prompt fit, and regenerate if needed.",
      state: "Later"
    }
  ],
  capabilities: [
    {
      title: "Project memory",
      description:
        "Store prompts, references, and winning parameter sets per project."
    },
    {
      title: "Workflow presets",
      description:
        "Switch between still, teaser, moodboard, and product ad pipelines."
    },
    {
      title: "Comfy orchestration",
      description:
        "Drive local or cluster ComfyUI jobs through a typed backend layer."
    },
    {
      title: "Assistant layer",
      description:
        "Make MCP-ready decisions for prompt refinement and workflow control."
    }
  ]
};

export const modelRecommendations: ModelRecommendation[] = [
  {
    name: "FLUX.1-dev GGUF",
    role: "Image foundation",
    summary:
      "Best default image model for your setup due to prompt fidelity, text rendering, and reliable GGUF memory savings on Volta.",
    tags: ["Q5_K_S", "PyTorch SDP", "FluxGuidance 3.5-5.0"]
  },
  {
    name: "Wan 2.2 5B",
    role: "Video foundation",
    summary:
      "Best production video choice on V100 32GB because FP16 fits comfortably and the ecosystem already supports TeaCache, offloading, and post chains.",
    tags: ["FP16", "TeaCache", "RIFE + SeedVR2"]
  },
  {
    name: "LTX-2",
    role: "Secondary research path",
    summary:
      "Useful for experimentation, but not the first production target because memory pressure and loader complexity are less favorable on your hardware.",
    tags: ["Optional", "Low-VRAM loaders", "Narrative motion"]
  }
];

export const orchestrationStrategy = {
  backend: "Fastify",
  frontend: "Next.js",
  retrieval: {
    enabled: true,
    purpose: [
      "Prompt memory",
      "Reference boards",
      "Preset reuse",
      "Technical playbooks"
    ],
    note: "Use retrieval around the generation workflow, not inside the core diffusion loop."
  },
  mcp: {
    enabled: true,
    phase: "Phase 2",
    note: "Ship a stable direct orchestration layer first, then expose it through MCP for agent-driven workflow control."
  },
  gpuStrategy: {
    image: "FLUX GGUF Q5_K_S or Q6_K",
    video: "Wan 2.2 5B FP16",
    cache: "TeaCache",
    longVideo: "FramePack",
    finish: "RIFE and SeedVR2"
  }
};

export const projectSummaries: ProjectSummary[] = [
  {
    name: "Aura product teaser",
    format: "Image to video",
    status: "In progress",
    updatedAt: "2 hours ago",
    summary:
      "Luxury product launch workflow with FLUX stills, Wan animation, and SeedVR2 upscale."
  },
  {
    name: "Noir fashion moodboard",
    format: "Image batch",
    status: "Ready",
    updatedAt: "Yesterday",
    summary:
      "Editorial still generation with typography overlays and portrait-safe prompt presets."
  },
  {
    name: "Studio lighting tests",
    format: "Research set",
    status: "Draft",
    updatedAt: "3 days ago",
    summary:
      "Controlled prompt experiments comparing lens language, film stock cues, and negative handling."
  }
];

export const promptPresets: PromptPreset[] = [
  {
    title: "Cinematic product close-up",
    engine: "FLUX.1-dev GGUF",
    type: "Still image",
    summary:
      "Built for premium hardware shots with precise reflections, shallow depth, and restrained copy.",
    tags: ["Luxury", "Macro", "Typography-safe"]
  },
  {
    title: "Founder intro motion pass",
    engine: "Wan 2.2 5B",
    type: "Video",
    summary:
      "Short talking-head animation with soft camera drift, stable framing, and upscale-ready pacing.",
    tags: ["16 fps", "TeaCache", "RIFE"]
  },
  {
    title: "Brand moodboard retrieval",
    engine: "Assistant + RAG",
    type: "Preparation",
    summary:
      "Pulls saved references, style notes, and prior winning prompts before generation starts.",
    tags: ["Memory", "References", "Preflight"]
  }
];

export const runSummaries: RunSummary[] = [
  {
    title: "Aura teaser keyframe set",
    engine: "FLUX.1-dev GGUF",
    status: "Completed",
    duration: "4m 12s",
    output: "12 stills"
  },
  {
    title: "Aura teaser motion draft",
    engine: "Wan 2.2 5B",
    status: "Running",
    duration: "11m 03s",
    output: "480p clip"
  },
  {
    title: "Editorial upscale pass",
    engine: "SeedVR2",
    status: "Queued",
    duration: "Pending",
    output: "1080p master"
  }
];

export const settingsGroups: SettingsGroup[] = [
  {
    title: "Inference stack",
    description: "Current production defaults tuned for a single V100 32GB server.",
    items: [
      {
        label: "Image engine",
        value: "FLUX.1-dev GGUF Q5_K_S"
      },
      {
        label: "Video engine",
        value: "Wan 2.2 5B FP16"
      },
      {
        label: "Finish chain",
        value: "RIFE -> SeedVR2"
      }
    ]
  },
  {
    title: "Orchestration",
    description: "Service endpoints and runtime switches for the local single-server setup.",
    items: [
      {
        label: "API",
        value: "http://127.0.0.1:8787"
      },
      {
        label: "ComfyUI",
        value: "http://127.0.0.1:8188"
      },
      {
        label: "Retrieval mode",
        value: "Enabled for prompt memory"
      }
    ]
  }
];

export const providerConfigs: ProviderConfig[] = [
  {
    name: "Dreamora local",
    category: "Self-hosted",
    status: "Connected",
    auth: "Internal runtime",
    defaultModel: "FLUX + Wan 2.2",
    note: "Primary local path using your V100 server and ComfyUI orchestration."
  },
  {
    name: "OpenAI images",
    category: "Third-party API",
    status: "Needs key",
    auth: "API key",
    defaultModel: "gpt-image-1",
    note: "Good fallback for fast external image generation when you want hosted inference."
  },
  {
    name: "Runway",
    category: "Third-party API",
    status: "Needs key",
    auth: "API key",
    defaultModel: "Gen-4",
    note: "Video-first hosted provider for external motion generation."
  },
  {
    name: "Replicate",
    category: "Third-party API",
    status: "Optional",
    auth: "API token",
    defaultModel: "Flux / video community models",
    note: "Useful as a multi-model fallback layer when you want broader model coverage."
  }
];

export const usageMetrics: UsageMetric[] = [
  {
    label: "Total tokens",
    value: "2.48M",
    detail: "Prompting, prompt memory, and workflow assistance over the last 30 days."
  },
  {
    label: "Images generated",
    value: "684",
    detail: "Includes batch generations and upscale-ready keyframe sets."
  },
  {
    label: "Videos rendered",
    value: "92",
    detail: "Counts Wan, hosted provider output, and finalized delivery masters."
  },
  {
    label: "Top model",
    value: "Wan 2.2 5B",
    detail: "Most frequently used engine for finished motion work."
  }
];

export const modelUsageBreakdown: UsageSeries[] = [
  {
    label: "FLUX.1-dev GGUF",
    value: 38,
    color: "#111111"
  },
  {
    label: "Wan 2.2 5B",
    value: 31,
    color: "#4d7cfe"
  },
  {
    label: "SeedVR2",
    value: 17,
    color: "#6ccf96"
  },
  {
    label: "Third-party APIs",
    value: 14,
    color: "#f4b35e"
  }
];

export const weeklyUsageSeries: UsageSeries[] = [
  {
    label: "Mon",
    value: 42,
    color: "#d5def9"
  },
  {
    label: "Tue",
    value: 58,
    color: "#bdd0ff"
  },
  {
    label: "Wed",
    value: 80,
    color: "#a9c2ff"
  },
  {
    label: "Thu",
    value: 64,
    color: "#8fb2ff"
  },
  {
    label: "Fri",
    value: 93,
    color: "#6e9cff"
  },
  {
    label: "Sat",
    value: 55,
    color: "#8ec5a5"
  },
  {
    label: "Sun",
    value: 34,
    color: "#c7d4e8"
  }
];
