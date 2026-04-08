/**
 * Workflow planner: analyzes a prompt and generates a multi-step
 * generation recipe based on mode, content signals, and historical
 * run performance.
 */

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
  contentSignals: ContentSignals;
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

type ContentSignals = {
  hasProduct: boolean;
  hasPortrait: boolean;
  hasMotion: boolean;
  hasTypography: boolean;
  hasUpscale: boolean;
  complexity: "simple" | "standard" | "complex";
  style: string | null;
};

type RunHistory = {
  engine: string;
  mode: "image" | "video";
  quality?: "Standard" | "High" | "Ultra";
  aspectRatio?: string;
  batchSize?: number;
  score?: number;
  status: string;
};

const PRODUCT_KEYWORDS = [
  "product", "luxury", "packaging", "bottle", "watch", "jewelry",
  "perfume", "cosmetic", "device", "gadget", "shoe", "bag", "brand"
];

const PORTRAIT_KEYWORDS = [
  "portrait", "face", "person", "founder", "model", "headshot",
  "talking", "expression", "character", "human", "woman", "man"
];

const MOTION_KEYWORDS = [
  "motion", "movement", "slow", "push", "pan", "reveal", "drift",
  "tracking", "sweep", "zoom", "rotate", "dolly", "crane", "fly"
];

const TYPOGRAPHY_KEYWORDS = [
  "text", "type", "typography", "headline", "title", "caption",
  "lettering", "font", "copy", "label", "logo", "wordmark"
];

const UPSCALE_KEYWORDS = [
  "upscale", "4k", "8k", "high-res", "detail", "sharp", "crisp",
  "master", "final", "delivery", "print", "billboard"
];

const STYLE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /cinematic|film|movie/i, label: "cinematic" },
  { pattern: /editorial|magazine|vogue/i, label: "editorial" },
  { pattern: /minimal|clean|simple/i, label: "minimal" },
  { pattern: /noir|dark|moody/i, label: "noir" },
  { pattern: /neon|vibrant|colorful|pop/i, label: "vibrant" },
  { pattern: /vintage|retro|analog/i, label: "vintage" },
  { pattern: /studio|controlled|professional/i, label: "studio" },
  { pattern: /abstract|surreal|dream/i, label: "abstract" }
];

function detectSignals(prompt: string): ContentSignals {
  const lower = prompt.toLowerCase();
  const words = lower.split(/\s+/);

  const hasProduct = PRODUCT_KEYWORDS.some((k) => lower.includes(k));
  const hasPortrait = PORTRAIT_KEYWORDS.some((k) => lower.includes(k));
  const hasMotion = MOTION_KEYWORDS.some((k) => lower.includes(k));
  const hasTypography = TYPOGRAPHY_KEYWORDS.some((k) => lower.includes(k));
  const hasUpscale = UPSCALE_KEYWORDS.some((k) => lower.includes(k));

  const signalCount = [hasProduct, hasPortrait, hasMotion, hasTypography, hasUpscale]
    .filter(Boolean).length;
  const complexity: ContentSignals["complexity"] =
    signalCount >= 3 ? "complex" : signalCount >= 1 ? "standard" : "simple";

  let style: string | null = null;
  for (const sp of STYLE_PATTERNS) {
    if (sp.pattern.test(lower)) {
      style = sp.label;
      break;
    }
  }

  return { hasProduct, hasPortrait, hasMotion, hasTypography, hasUpscale, complexity, style };
}

function bestFromHistory(
  history: RunHistory[],
  mode: "image" | "video"
): {
  model: string | null;
  aspectRatio: string | null;
  quality: "Standard" | "High" | "Ultra" | null;
  batchSize: number | null;
} {
  const modeRuns = history.filter(
    (r) => r.mode === mode && r.status === "Completed"
  );

  if (modeRuns.length === 0) {
    return { model: null, aspectRatio: null, quality: null, batchSize: null };
  }

  const scored = modeRuns.filter((r) => typeof r.score === "number" && r.score > 0);
  const pool = scored.length > 0 ? scored : modeRuns;

  const engineWeights = new Map<string, number>();
  const ratioWeights = new Map<string, number>();
  const qualityWeights = new Map<string, number>();
  const batchWeights = new Map<number, number>();

  for (const run of pool) {
    const weight = typeof run.score === "number" ? run.score : 1;
    engineWeights.set(run.engine, (engineWeights.get(run.engine) ?? 0) + weight);
    if (run.aspectRatio) {
      ratioWeights.set(run.aspectRatio, (ratioWeights.get(run.aspectRatio) ?? 0) + weight);
    }
    if (run.quality) {
      qualityWeights.set(run.quality, (qualityWeights.get(run.quality) ?? 0) + weight);
    }
    if (typeof run.batchSize === "number") {
      batchWeights.set(run.batchSize, (batchWeights.get(run.batchSize) ?? 0) + weight);
    }
  }

  const top = <T>(map: Map<T, number>): T | null =>
    [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    model: top(engineWeights),
    aspectRatio: top(ratioWeights),
    quality: top(qualityWeights) as "Standard" | "High" | "Ultra" | null,
    batchSize: top(batchWeights)
  };
}

export function createPlan(
  prompt: string,
  mode: "image" | "video",
  history: RunHistory[],
  defaults: { imageModel: string; videoModel: string }
): GenerationPlan {
  const signals = detectSignals(prompt);
  const best = bestFromHistory(history, mode);

  const steps: PlanStep[] = [];
  let order = 1;

  // Step 1: always retrieve context
  steps.push({
    order: order++,
    action: "retrieve_context",
    engine: "retrieval",
    description: "Search prompt memory for similar presets, references, and winning parameter sets.",
    estimatedTokens: 800,
    optional: false
  });

  if (mode === "image") {
    // Step 2: generate keyframe(s)
    steps.push({
      order: order++,
      action: "generate_image",
      engine: best.model ?? defaults.imageModel,
      description: signals.hasProduct
        ? "Generate product keyframe with controlled lighting and material detail."
        : signals.hasPortrait
          ? "Generate portrait keyframe with stable framing and facial fidelity."
          : "Generate image using retrieved context and optimized parameters.",
      estimatedTokens: 3500 * (best.batchSize ?? 2),
      optional: false
    });

    // Step 3: optional face/detail pass for portraits
    if (signals.hasPortrait) {
      steps.push({
        order: order++,
        action: "detail_pass",
        engine: "face_restore",
        description: "Run face restoration and detail enhancement on portrait outputs.",
        estimatedTokens: 1200,
        optional: true
      });
    }

    // Step 4: optional typography overlay
    if (signals.hasTypography) {
      steps.push({
        order: order++,
        action: "typography_overlay",
        engine: "text_renderer",
        description: "Add text elements with proper kerning and alignment on generated stills.",
        estimatedTokens: 600,
        optional: true
      });
    }

    // Step 5: optional upscale
    if (signals.hasUpscale || signals.complexity === "complex") {
      steps.push({
        order: order++,
        action: "upscale",
        engine: "SeedVR2",
        description: "Tile-based upscale to delivery resolution with detail refinement.",
        estimatedTokens: 2800,
        optional: true
      });
    }
  } else {
    // Video pipeline

    // Step 2: generate keyframe
    steps.push({
      order: order++,
      action: "generate_keyframe",
      engine: best.model ?? defaults.imageModel,
      description: "Generate a clean still keyframe as the video starting point.",
      estimatedTokens: 3500,
      optional: false
    });

    // Step 3: animate
    steps.push({
      order: order++,
      action: "animate",
      engine: best.model ?? defaults.videoModel,
      description: signals.hasMotion
        ? `Animate keyframe with detected motion intent: ${
            MOTION_KEYWORDS.filter((k) => prompt.toLowerCase().includes(k)).slice(0, 3).join(", ")
          }.`
        : "Animate keyframe with standard motion and stable pacing.",
      estimatedTokens: 8200,
      optional: false
    });

    // Step 4: TeaCache acceleration
    steps.push({
      order: order++,
      action: "accelerate",
      engine: "TeaCache",
      description: "Apply temporal caching for faster re-renders and iteration.",
      estimatedTokens: 0,
      optional: true
    });

    // Step 5: interpolation
    steps.push({
      order: order++,
      action: "interpolate",
      engine: "RIFE",
      description: "Frame interpolation to smooth motion and increase output frame rate.",
      estimatedTokens: 1200,
      optional: true
    });

    // Step 6: upscale
    if (signals.hasUpscale || signals.complexity !== "simple") {
      steps.push({
        order: order++,
        action: "upscale",
        engine: "SeedVR2",
        description: "Upscale video frames to delivery resolution.",
        estimatedTokens: 4200,
        optional: true
      });
    }
  }

  // Final step: score and store
  steps.push({
    order: order++,
    action: "score_and_store",
    engine: "quality_scorer",
    description: "Score output quality, persist run metadata, and update prompt memory.",
    estimatedTokens: 400,
    optional: false
  });

  const estimatedTotalTokens = steps
    .filter((s) => !s.optional)
    .reduce((sum, s) => sum + s.estimatedTokens, 0);

  const defaultRatio = mode === "image"
    ? (signals.hasPortrait ? "3:4" : "16:9")
    : "16:9";

  const defaultQuality = signals.complexity === "complex" ? "Ultra" : "High";

  const reasoning = buildReasoning(mode, signals, best);

  return {
    id: crypto.randomUUID(),
    mode,
    prompt: prompt.slice(0, 280),
    contentSignals: signals,
    steps,
    estimatedTotalTokens,
    recommendedSettings: {
      model: best.model ?? (mode === "image" ? defaults.imageModel : defaults.videoModel),
      aspectRatio: best.aspectRatio ?? defaultRatio,
      quality: best.quality ?? defaultQuality,
      batchSize: mode === "image" ? (best.batchSize ?? 2) : 1
    },
    reasoning
  };
}

function buildReasoning(
  mode: "image" | "video",
  signals: ContentSignals,
  best: ReturnType<typeof bestFromHistory>
): string {
  const parts: string[] = [];

  if (best.model) {
    parts.push(`Using ${best.model} based on quality-weighted run history.`);
  } else {
    parts.push(`Using default ${mode} model (no scored history yet).`);
  }

  if (signals.style) {
    parts.push(`Detected ${signals.style} style — parameters tuned accordingly.`);
  }

  const detectedSignals: string[] = [];
  if (signals.hasProduct) detectedSignals.push("product");
  if (signals.hasPortrait) detectedSignals.push("portrait");
  if (signals.hasMotion) detectedSignals.push("motion");
  if (signals.hasTypography) detectedSignals.push("typography");
  if (signals.hasUpscale) detectedSignals.push("upscale");

  if (detectedSignals.length > 0) {
    parts.push(`Content signals: ${detectedSignals.join(", ")}.`);
  }

  parts.push(`Complexity: ${signals.complexity}.`);

  return parts.join(" ");
}
