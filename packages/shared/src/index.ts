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
