"use client";

import type {
  ProjectSummary,
  PromptPreset,
  ProviderConfig,
  RunSummary
} from "@dreamora/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  deleteAsset,
  deriveModelsFromProviders,
  getGenerationPlan,
  getGenerationStatus,
  getStudioSuggestions,
  listAssets,
  scoreRun,
  startGeneration,
  uploadAsset
} from "../lib/client-api";
import type {
  GenerationPlan,
  ScoreResponse,
  StudioAsset
} from "../lib/client-api";

const imageRatios = ["1:1", "4:5", "3:4", "16:9", "9:16"];
const videoRatios = ["16:9", "9:16"];
const qualityOptions = ["Standard", "High", "Ultra"] as const;
const batchOptions = ["1", "2", "4", "8"];
const MAX_REFERENCES = 5;

const workflowStages = [
  {
    title: "Prompt accepted",
    type: "Trigger",
    badge: "Records",
    note: "The generation request is serialized with model, aspect ratio, and quality."
  },
  {
    title: "Provider routing",
    type: "Agent",
    badge: "Router",
    note: "Local and third-party credentials are checked before queue placement."
  },
  {
    title: "Model execution",
    type: "Process",
    badge: "Inference",
    note: "The selected image or video model starts inference on the active provider."
  },
  {
    title: "Asset packaging",
    type: "Output",
    badge: "Delivery",
    note: "Outputs, previews, and usage metadata are prepared for review."
  }
];

type MemoryPrompt = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  score: number;
};

type MemoryRun = {
  id: string;
  title: string;
  engine: string;
  duration: string;
  tokensUsed: number;
  aspectRatio: string | null;
  quality: string | null;
};

type RecommendedSettings = {
  model: string;
  aspectRatio: string;
  quality: "Standard" | "High" | "Ultra";
  batchSize: number;
  averageTokens: number;
};

type StudioState = {
  mode: "image" | "video";
  ratio: string;
  quality: (typeof qualityOptions)[number];
  batch: string;
  selectedModel: string;
  promptText: string;
  running: boolean;
  submitError: string;
  runtimeNotice: string;
  suggestionError: string;
  suggesting: boolean;
  runs: RunSummary[];
  memoryPrompts: MemoryPrompt[];
  memoryRuns: MemoryRun[];
  recommendedSettings: RecommendedSettings | null;
  plan: GenerationPlan | null;
  planLoading: boolean;
  scoringRunId: string | null;
  lastScoreResult: ScoreResponse | null;
};

type StudioAction =
  | { type: "SET_MODE"; mode: "image" | "video"; model: string }
  | { type: "SET_RATIO"; ratio: string }
  | { type: "SET_QUALITY"; quality: (typeof qualityOptions)[number] }
  | { type: "SET_BATCH"; batch: string }
  | { type: "SET_MODEL"; model: string }
  | { type: "SET_PROMPT"; text: string }
  | { type: "START_GENERATE" }
  | { type: "GENERATION_STARTED"; run: RunSummary; notice: string }
  | { type: "GENERATION_POLL_UPDATE"; runId: string; updates: Partial<RunSummary> }
  | { type: "GENERATION_DONE" }
  | { type: "GENERATION_ERROR"; error: string }
  | { type: "START_SUGGEST" }
  | { type: "SUGGEST_SUCCESS"; prompts: MemoryPrompt[]; runs: MemoryRun[]; settings: RecommendedSettings }
  | { type: "SUGGEST_ERROR"; error: string }
  | { type: "APPLY_SETTINGS" }
  | { type: "SET_NOTICE"; notice: string }
  | { type: "PLAN_LOADING" }
  | { type: "PLAN_LOADED"; plan: GenerationPlan }
  | { type: "PLAN_ERROR" }
  | { type: "APPLY_PLAN" }
  | { type: "SCORE_SUBMITTED"; result: ScoreResponse }
  | { type: "DISMISS_SCORE" };

function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case "SET_MODE":
      return {
        ...state,
        mode: action.mode,
        selectedModel: action.model,
        ratio: "16:9",
        promptText: action.mode === "image"
          ? "Premium product scene with controlled reflections, sculpted natural light, elegant material detail, and a restrained editorial composition."
          : "Luxury product reveal with a slow forward push, clean highlight motion, soft environmental reflections, and stable premium pacing."
      };
    case "SET_RATIO":
      return { ...state, ratio: action.ratio };
    case "SET_QUALITY":
      return { ...state, quality: action.quality };
    case "SET_BATCH":
      return { ...state, batch: action.batch };
    case "SET_MODEL":
      return { ...state, selectedModel: action.model };
    case "SET_PROMPT":
      return { ...state, promptText: action.text };
    case "START_GENERATE":
      return { ...state, running: true, submitError: "", runtimeNotice: "" };
    case "GENERATION_STARTED":
      return {
        ...state,
        runs: [action.run, ...state.runs].slice(0, 10),
        runtimeNotice: action.notice
      };
    case "GENERATION_POLL_UPDATE":
      return {
        ...state,
        runs: state.runs.map((run) =>
          run.id === action.runId ? { ...run, ...action.updates } : run
        )
      };
    case "GENERATION_DONE":
      return { ...state, running: false };
    case "GENERATION_ERROR":
      return { ...state, running: false, submitError: action.error };
    case "START_SUGGEST":
      return { ...state, suggesting: true, suggestionError: "" };
    case "SUGGEST_SUCCESS":
      return {
        ...state,
        suggesting: false,
        memoryPrompts: action.prompts,
        memoryRuns: action.runs,
        recommendedSettings: action.settings,
        runtimeNotice: "Prompt memory analysis updated from successful runs."
      };
    case "SUGGEST_ERROR":
      return { ...state, suggesting: false, suggestionError: action.error };
    case "APPLY_SETTINGS":
      if (!state.recommendedSettings) return state;
      return {
        ...state,
        selectedModel: state.recommendedSettings.model,
        ratio: state.recommendedSettings.aspectRatio,
        quality: state.recommendedSettings.quality,
        batch: state.mode === "image" ? String(state.recommendedSettings.batchSize) : state.batch,
        runtimeNotice: "Applied recommended settings from memory."
      };
    case "SET_NOTICE":
      return { ...state, runtimeNotice: action.notice };
    case "PLAN_LOADING":
      return { ...state, planLoading: true, plan: null };
    case "PLAN_LOADED":
      return { ...state, planLoading: false, plan: action.plan };
    case "PLAN_ERROR":
      return { ...state, planLoading: false, runtimeNotice: "Could not generate plan." };
    case "APPLY_PLAN":
      if (!state.plan) return state;
      return {
        ...state,
        selectedModel: state.plan.recommendedSettings.model,
        ratio: state.plan.recommendedSettings.aspectRatio,
        quality: state.plan.recommendedSettings.quality,
        batch: state.mode === "image" ? String(state.plan.recommendedSettings.batchSize) : state.batch,
        runtimeNotice: `Plan applied: ${state.plan.steps.filter((s) => !s.optional).length} required steps, ${state.plan.estimatedTotalTokens.toLocaleString()} estimated tokens.`
      };
    case "SCORE_SUBMITTED":
      return { ...state, lastScoreResult: action.result, scoringRunId: null };
    case "DISMISS_SCORE":
      return { ...state, lastScoreResult: null };
    default:
      return state;
  }
}

type StudioWorkbenchProps = {
  providers: ProviderConfig[];
  initialRuns: RunSummary[];
  promptPresets: PromptPreset[];
  projects: ProjectSummary[];
};

export function StudioWorkbench({
  providers,
  initialRuns,
  promptPresets,
  projects
}: StudioWorkbenchProps) {
  const modelGroups = useMemo(
    () => deriveModelsFromProviders(providers),
    [providers]
  );
  const projectOptions = useMemo(
    () =>
      projects.filter(
        (project): project is ProjectSummary & { id: string } =>
          typeof project.id === "string" && project.id.trim().length > 0
      ),
    [projects]
  );

  const [state, dispatch] = useReducer(studioReducer, {
    mode: "image",
    ratio: "16:9",
    quality: "High",
    batch: "4",
    selectedModel: modelGroups.imageModels[0] ?? "Dreamora FLUX local",
    promptText:
      "Premium product scene with controlled reflections, sculpted natural light, elegant material detail, and a restrained editorial composition.",
    running: false,
    submitError: "",
    runtimeNotice: "",
    suggestionError: "",
    suggesting: false,
    runs: initialRuns,
    memoryPrompts: [],
    memoryRuns: [],
    recommendedSettings: null,
    plan: null,
    planLoading: false,
    scoringRunId: null,
    lastScoreResult: null
  });

  const [activeTab, setActiveTab] = useState<"editor" | "runs">("editor");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetError, setAssetError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [uploadRole, setUploadRole] = useState<"primary" | "secondary">("secondary");
  const [uploadWeight, setUploadWeight] = useState(0.5);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const models = useMemo(
    () => (state.mode === "image" ? modelGroups.imageModels : modelGroups.videoModels),
    [state.mode, modelGroups]
  );

  const ratios = state.mode === "image" ? imageRatios : videoRatios;
  const assetScope: "project" | "global" = selectedProjectId ? "project" : "global";
  const selectedAssets = useMemo(
    () =>
      selectedReferenceIds
        .map((id) => assets.find((asset) => asset.id === id) ?? null)
        .filter((asset): asset is StudioAsset => asset !== null),
    [assets, selectedReferenceIds]
  );
  const selectedPrimaryCount = useMemo(
    () => selectedAssets.filter((asset) => asset.role === "primary").length,
    [selectedAssets]
  );

  const refreshAssets = useCallback(
    async (scope: "project" | "global", projectId: string | null) => {
      setAssetLoading(true);
      setAssetError("");
      try {
        const nextAssets = await listAssets(scope, projectId ?? undefined);
        if (!mountedRef.current) return;
        setAssets(nextAssets);
        setSelectedReferenceIds((previous) =>
          previous.filter((id) => nextAssets.some((asset) => asset.id === id)).slice(0, MAX_REFERENCES)
        );
      } catch {
        if (!mountedRef.current) return;
        setAssetError("Could not load reference library.");
      } finally {
        if (mountedRef.current) setAssetLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void refreshAssets(assetScope, selectedProjectId);
  }, [assetScope, selectedProjectId, refreshAssets]);

  const handleProjectScopeChange = useCallback((value: string) => {
    setSelectedReferenceIds([]);
    setAssetError("");
    if (value === "__global__") {
      setSelectedProjectId(null);
      return;
    }
    setSelectedProjectId(value);
  }, []);

  async function handleUploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setAssetError("");
    const formData = new FormData();
    formData.set("file", file);
    formData.set("scope", assetScope);
    formData.set("role", uploadRole);
    formData.set("weight", String(uploadWeight));
    if (selectedProjectId) formData.set("projectId", selectedProjectId);
    try {
      await uploadAsset(formData);
      if (!mountedRef.current) return;
      await refreshAssets(assetScope, selectedProjectId);
      dispatch({ type: "SET_NOTICE", notice: "Reference image uploaded to the local library." });
    } catch {
      if (!mountedRef.current) return;
      setAssetError("Could not upload reference image.");
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }

  async function handleDeleteAsset(assetId: string, reason?: string) {
    const confirmed = window.confirm(reason ?? "This permanently removes the image from the library and deletes it from local disk. Continue?");
    if (!confirmed) return;
    setDeletingAssetId(assetId);
    setAssetError("");
    try {
      await deleteAsset(assetId);
      if (!mountedRef.current) return;
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      setSelectedReferenceIds((prev) => prev.filter((id) => id !== assetId));
      dispatch({ type: "SET_NOTICE", notice: "Reference removed permanently from library and local disk." });
    } catch {
      if (!mountedRef.current) return;
      setAssetError("Could not delete reference image.");
    } finally {
      if (mountedRef.current) setDeletingAssetId(null);
    }
  }

  async function handleSelectAsset(asset: StudioAsset) {
    if (selectedReferenceIds.includes(asset.id)) {
      await handleDeleteAsset(asset.id, "Unselecting this reference permanently deletes it from local disk and library. Continue?");
      return;
    }
    if (selectedReferenceIds.length >= MAX_REFERENCES) {
      setAssetError(`You can select at most ${MAX_REFERENCES} references.`);
      return;
    }
    if (asset.role === "primary" && selectedPrimaryCount >= 1) {
      setAssetError("Only one primary reference can be selected.");
      return;
    }
    setAssetError("");
    setSelectedReferenceIds((prev) => [...prev, asset.id]);
  }

  const handleMode = useCallback((nextMode: "image" | "video") => {
    const nextModels = nextMode === "image" ? modelGroups.imageModels : modelGroups.videoModels;
    dispatch({ type: "SET_MODE", mode: nextMode, model: nextModels[0] ?? state.selectedModel });
  }, [modelGroups, state.selectedModel]);

  function applyPreset(preset: PromptPreset) {
    dispatch({ type: "SET_PROMPT", text: preset.summary });
    if (preset.type.toLowerCase().includes("video")) handleMode("video");
    else handleMode("image");
  }

  async function handleAnalyzePrompt() {
    dispatch({ type: "START_SUGGEST" });
    try {
      const result = await getStudioSuggestions(state.mode, state.promptText);
      if (!mountedRef.current) return;
      dispatch({
        type: "SUGGEST_SUCCESS",
        prompts: result.memory.promptMatches,
        runs: result.memory.topRuns.map((run) => ({
          id: run.id, title: run.title, engine: run.engine,
          duration: run.duration, tokensUsed: run.tokensUsed,
          aspectRatio: run.aspectRatio, quality: run.quality
        })),
        settings: result.recommendations
      });
    } catch {
      if (!mountedRef.current) return;
      dispatch({ type: "SUGGEST_ERROR", error: "Could not fetch prompt memory recommendations." });
    }
  }

  async function handleGetPlan() {
    dispatch({ type: "PLAN_LOADING" });
    try {
      const plan = await getGenerationPlan(state.promptText, state.mode);
      if (!mountedRef.current) return;
      dispatch({ type: "PLAN_LOADED", plan });
    } catch {
      if (!mountedRef.current) return;
      dispatch({ type: "PLAN_ERROR" });
    }
  }

  async function handleScoreRun(runId: string, score: number) {
    try {
      const result = await scoreRun(runId, score);
      if (!mountedRef.current) return;
      dispatch({ type: "SCORE_SUBMITTED", result });
    } catch { /* scoring is non-critical */ }
  }

  async function pollGeneration(jobId: string, runId: string, signal: AbortSignal) {
    let attempts = 0;
    const maxAttempts = 120;
    while (attempts < maxAttempts && !signal.aborted) {
      attempts += 1;
      await new Promise((resolve) => { window.setTimeout(resolve, 2500); });
      if (signal.aborted || !mountedRef.current) return;
      try {
        const status = await getGenerationStatus(jobId);
        if (signal.aborted || !mountedRef.current) return;
        if (status.status === "completed") {
          dispatch({ type: "GENERATION_POLL_UPDATE", runId, updates: { status: "Completed", output: status.outputSummary ?? undefined } });
          if (status.policy?.shouldRegenerate) {
            dispatch({ type: "SET_NOTICE", notice: `Policy recommendation: retry suggested (${status.policy.reasons[0]?.message ?? "Policy check requested regeneration."})` });
          }
          dispatch({ type: "GENERATION_DONE" });
          return;
        }
        if (status.status === "failed") {
          dispatch({ type: "GENERATION_POLL_UPDATE", runId, updates: { status: "Failed", duration: "Failed", output: status.error ?? "Generation failed" } });
          if (status.policy?.shouldRegenerate) {
            dispatch({ type: "SET_NOTICE", notice: `Policy recommendation: retry suggested (${status.policy.reasons[0]?.message ?? "Policy check requested regeneration."})` });
          }
          dispatch({ type: "GENERATION_ERROR", error: status.error ?? "Generation failed." });
          return;
        }
      } catch {
        if (!mountedRef.current) return;
        dispatch({ type: "GENERATION_ERROR", error: "Could not poll generation status." });
        return;
      }
    }
    if (mountedRef.current && !signal.aborted) {
      dispatch({ type: "GENERATION_ERROR", error: "Generation timeout reached while polling." });
    }
  }

  async function handleGenerate() {
    if (selectedReferenceIds.length > MAX_REFERENCES) { setAssetError(`Max ${MAX_REFERENCES} references.`); return; }
    if (selectedAssets.length !== selectedReferenceIds.length) { setAssetError("Some references unavailable."); return; }
    if (selectedAssets.length > 0 && selectedPrimaryCount !== 1) { setAssetError("Select exactly one primary reference."); return; }
    setAssetError("");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "START_GENERATE" });
    const now = new Date();
    const runTitle = state.mode === "image" ? `Image generation ${now.toLocaleTimeString()}` : `Video generation ${now.toLocaleTimeString()}`;
    try {
      const started = await startGeneration({
        mode: state.mode, prompt: state.promptText, model: state.selectedModel,
        aspectRatio: state.ratio, quality: state.quality,
        batchSize: state.mode === "image" ? Number(state.batch) : 1,
        projectId: selectedProjectId ?? undefined, referenceAssetIds: selectedReferenceIds
      });
      if (controller.signal.aborted || !mountedRef.current) return;
      const provisionalRun: RunSummary = {
        id: started.runId, title: runTitle, engine: state.selectedModel,
        status: "Running", duration: "Pending",
        output: state.mode === "image" ? `${state.batch} image(s)` : `${state.ratio} clip`,
        mode: state.mode
      };
      let notice = "";
      if (started.backend === "simulated" && started.fallbackReason) notice = `ComfyUI fallback: ${started.fallbackReason}`;
      else if (started.backend === "simulated") notice = "ComfyUI not enabled; using simulated backend.";
      else notice = `ComfyUI backend active (${started.workflowPath ?? "unknown"}).`;
      dispatch({ type: "GENERATION_STARTED", run: provisionalRun, notice });
      await pollGeneration(started.jobId, started.runId, controller.signal);
    } catch (error) {
      if (!mountedRef.current) return;
      dispatch({ type: "GENERATION_ERROR", error: error instanceof Error && error.message ? error.message : "Could not start generation." });
    }
  }

  const completedRuns = state.runs.filter((r) => r.status === "Completed").length;
  const failedRuns = state.runs.filter((r) => r.status === "Failed").length;
  const runningRuns = state.runs.filter((r) => r.status === "Running").length;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      {/* ─── Main workflow area ─────────────────────── */}
      <div className="space-y-5">
        {/* Top bar with tabs and live toggle */}
        <div className="panel-strong rounded-[24px] px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-white/40 p-1">
            <button
              onClick={() => setActiveTab("editor")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                activeTab === "editor"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--foreground)]/50 hover:text-[var(--foreground)]"
              }`}
            >
              Editor
            </button>
            <button
              onClick={() => setActiveTab("runs")}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                activeTab === "runs"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--foreground)]/50 hover:text-[var(--foreground)]"
              }`}
            >
              Runs
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                {state.runs.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${state.running ? "bg-[var(--success)] animate-pulse" : "bg-[var(--foreground)]/20"}`} />
              <span className="text-xs font-medium text-[var(--foreground)]/50">
                {state.running ? "Live" : "Idle"}
              </span>
            </div>
            <div className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors ${state.running ? "bg-[var(--success)]" : "bg-[var(--foreground)]/15"}`}>
              <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${state.running ? "left-[22px]" : "left-0.5"}`} />
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "editor" ? (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* ─── Trigger node: Prompt input ────────── */}
              <div className="panel-strong rounded-[28px] p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-warm)]/15">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-warm)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v8M8 12h8" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-[var(--foreground)]/40 uppercase tracking-wider">Trigger</span>
                  <span className="ml-auto rounded-full border border-[var(--line)] bg-white/60 px-2.5 py-0.5 text-[11px] text-[var(--foreground)]/45">
                    {state.mode === "image" ? "Image" : "Video"}
                  </span>
                </div>

                <textarea
                  value={state.promptText}
                  onChange={(e) => dispatch({ type: "SET_PROMPT", text: e.target.value })}
                  placeholder="Describe what you want to create..."
                  className="w-full min-h-[100px] resize-none rounded-[20px] border border-[var(--line)] bg-white/60 px-5 py-4 text-base leading-7 text-[var(--foreground)]/75 outline-none placeholder:text-[var(--foreground)]/25 transition focus:border-[var(--accent-warm)]/30 focus:bg-white/80"
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  {promptPresets.slice(0, 3).map((preset) => (
                    <button
                      key={preset.id ?? preset.title}
                      onClick={() => applyPreset(preset)}
                      className="rounded-full border border-[var(--line)] bg-white/50 px-3 py-1 text-xs text-[var(--foreground)]/50 transition hover:bg-white/80 hover:text-[var(--foreground)]"
                    >
                      {preset.title}
                    </button>
                  ))}
                </div>

                {/* Settings bar */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {(["image", "video"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => handleMode(m)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                        state.mode === m
                          ? "bg-[var(--accent)] text-white"
                          : "border border-[var(--line)] bg-white/50 text-[var(--foreground)]/55"
                      }`}
                    >
                      {m === "image" ? "Image" : "Video"}
                    </button>
                  ))}
                  <select
                    value={state.selectedModel}
                    onChange={(e) => dispatch({ type: "SET_MODEL", model: e.target.value })}
                    className="rounded-full border border-[var(--line)] bg-white/50 px-3 py-1.5 text-xs outline-none"
                  >
                    {models.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select
                    value={state.ratio}
                    onChange={(e) => dispatch({ type: "SET_RATIO", ratio: e.target.value })}
                    className="rounded-full border border-[var(--line)] bg-white/50 px-3 py-1.5 text-xs outline-none"
                  >
                    {ratios.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <select
                    value={state.quality}
                    onChange={(e) => dispatch({ type: "SET_QUALITY", quality: e.target.value as (typeof qualityOptions)[number] })}
                    className="rounded-full border border-[var(--line)] bg-white/50 px-3 py-1.5 text-xs outline-none"
                  >
                    {qualityOptions.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                  <button
                    onClick={handleGenerate}
                    disabled={state.running || !state.selectedModel || !state.promptText.trim()}
                    className="ml-auto rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {state.running ? "Generating..." : "Generate"}
                  </button>
                </div>

                {state.submitError && <p className="mt-3 text-xs text-[var(--danger)]">{state.submitError}</p>}
                {state.runtimeNotice && <p className="mt-2 text-xs text-[var(--foreground)]/55">{state.runtimeNotice}</p>}
              </div>

              {/* ─── Workflow nodes ─────────────────────── */}
              <div className="relative pl-8">
                {/* Vertical connector line */}
                <div className="absolute left-[29px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-[var(--success)] via-[var(--accent-warm)]/40 to-transparent" />

                {workflowStages.map((stage, i) => (
                  <motion.div
                    key={stage.title}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.1, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                    className="relative mb-5 last:mb-0"
                  >
                    {/* Node dot */}
                    <div className={`absolute -left-8 top-5 flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      state.running
                        ? "border-[var(--success)] bg-[var(--success-soft)]"
                        : "border-[var(--line-strong)] bg-white"
                    }`}>
                      {state.running && (
                        <motion.div
                          className="h-2 w-2 rounded-full bg-[var(--success)]"
                          animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                        />
                      )}
                    </div>

                    <motion.div
                      className="panel rounded-[22px] px-5 py-4 transition-shadow"
                      whileHover={{ y: -1, boxShadow: "0 16px 52px rgba(30, 24, 16, 0.08)" }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--line)] bg-white/80">
                            <NodeIcon type={stage.type} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[var(--foreground)]">{stage.title}</p>
                            <p className="text-[11px] text-[var(--foreground)]/40">{stage.note}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-[var(--line)] bg-white/60 px-2.5 py-0.5 text-[10px] font-medium text-[var(--foreground)]/45">
                            {stage.badge}
                          </span>
                          {state.running ? (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="rounded-full bg-[var(--success-soft)] border border-[var(--success)]/20 px-2.5 py-0.5 text-[10px] font-medium text-[var(--success)]"
                            >
                              {i < workflowStages.length - 1 ? "Completed" : "Processing"}
                            </motion.span>
                          ) : (
                            <span className="rounded-full bg-[var(--foreground)]/5 px-2.5 py-0.5 text-[10px] text-[var(--foreground)]/35">
                              Ready
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                ))}
              </div>

              {/* ─── Extra tools row ───────────────────── */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleAnalyzePrompt}
                  disabled={state.suggesting || !state.promptText.trim()}
                  className="panel rounded-[18px] px-4 py-2.5 text-xs font-medium text-[var(--foreground)]/60 transition hover:text-[var(--foreground)] disabled:opacity-50"
                >
                  {state.suggesting ? "Analyzing..." : "Analyze Prompt"}
                </button>
                <button
                  onClick={() => dispatch({ type: "APPLY_SETTINGS" })}
                  disabled={!state.recommendedSettings}
                  className="panel rounded-[18px] px-4 py-2.5 text-xs font-medium text-[var(--foreground)]/60 transition hover:text-[var(--foreground)] disabled:opacity-50"
                >
                  Apply Best Settings
                </button>
                <button
                  onClick={handleGetPlan}
                  disabled={state.planLoading || !state.promptText.trim()}
                  className="panel rounded-[18px] px-4 py-2.5 text-xs font-medium text-[var(--foreground)]/60 transition hover:text-[var(--foreground)] disabled:opacity-50"
                >
                  {state.planLoading ? "Planning..." : "Generate Plan"}
                </button>
              </div>

              {state.suggestionError && <p className="text-xs text-[var(--danger)]">{state.suggestionError}</p>}

              {/* Plan display */}
              {state.plan && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="panel rounded-[24px] p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold">Generation Plan</p>
                    <button
                      onClick={() => dispatch({ type: "APPLY_PLAN" })}
                      className="rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-medium text-white"
                    >
                      Apply
                    </button>
                  </div>
                  <p className="text-xs text-[var(--foreground)]/45 mb-3">{state.plan.reasoning}</p>
                  <div className="space-y-2">
                    {state.plan.steps.map((step) => (
                      <div key={step.order} className={`flex items-start gap-2.5 rounded-[14px] px-3 py-2 ${step.optional ? "bg-[var(--foreground)]/3" : "bg-[var(--success-soft)]"}`}>
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)]/8 text-[10px] font-bold">{step.order}</span>
                        <div>
                          <p className="text-xs font-medium">{step.action.replace(/_/g, " ")} <span className="font-normal text-[var(--foreground)]/40">({step.engine})</span></p>
                          <p className="mt-0.5 text-[11px] text-[var(--foreground)]/40">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-[var(--foreground)]/35">~{state.plan.estimatedTotalTokens.toLocaleString()} tokens estimated</p>
                </motion.div>
              )}

              {/* Reference library */}
              <div className="panel rounded-[24px] p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--foreground)]/40">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                    <span className="text-sm font-semibold">References</span>
                  </div>
                  <span className="text-[11px] text-[var(--foreground)]/35">{selectedReferenceIds.length}/{MAX_REFERENCES}</span>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <select value={selectedProjectId ?? "__global__"} onChange={(e) => handleProjectScopeChange(e.target.value)}
                    className="rounded-full border border-[var(--line)] bg-white/50 px-3 py-1.5 text-xs outline-none">
                    <option value="__global__">Global</option>
                    {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={uploadRole} onChange={(e) => setUploadRole(e.target.value === "primary" ? "primary" : "secondary")}
                    className="rounded-full border border-[var(--line)] bg-white/50 px-3 py-1.5 text-xs outline-none">
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                  </select>
                  <label className="cursor-pointer rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90">
                    {uploading ? "Uploading..." : "Upload"}
                    <input type="file" accept="image/*" disabled={uploading} onChange={handleUploadFile} className="hidden" />
                  </label>
                </div>

                {assetLoading ? (
                  <p className="mt-3 text-xs text-[var(--foreground)]/40">Loading references...</p>
                ) : assets.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {assets.map((asset) => {
                      const selected = selectedReferenceIds.includes(asset.id);
                      const deleting = deletingAssetId === asset.id;
                      return (
                        <div key={asset.id} className="flex items-center gap-3 rounded-[16px] border border-[var(--line)] bg-white/50 px-3 py-2">
                          <img src={`${apiBaseUrl}${asset.previewUrl}`} alt={asset.filename} className="h-10 w-10 rounded-lg border border-[var(--line)] object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{asset.filename}</p>
                            <p className="text-[10px] text-[var(--foreground)]/35">{asset.role} · w{asset.weight.toFixed(2)}</p>
                          </div>
                          <button onClick={() => void handleSelectAsset(asset)} disabled={deleting}
                            className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${selected ? "bg-[var(--danger-soft)] text-[var(--danger)]" : "border border-[var(--line)] text-[var(--foreground)]/50 hover:bg-white"}`}>
                            {selected ? "Remove" : "Select"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[var(--foreground)]/35">No references yet. Upload images to build context.</p>
                )}
                {assetError && <p className="mt-2 text-[11px] text-[var(--danger)]">{assetError}</p>}
              </div>
            </motion.div>
          ) : (
            /* ─── Runs tab ───────────────────────────── */
            <motion.div
              key="runs"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-3"
            >
              {state.runs.map((run, i) => (
                <motion.div
                  key={run.id ?? run.title}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="panel rounded-[22px] px-5 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{run.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--foreground)]/40">{run.engine} · {run.duration}</p>
                    </div>
                    <StatusBadge status={run.status} />
                  </div>
                  <p className="mt-2 text-xs text-[var(--foreground)]/35">Output: {run.output}</p>
                  {run.id && run.status === "Completed" && (
                    <div className="mt-2 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button key={s} onClick={() => handleScoreRun(run.id!, s)}
                          className="h-6 w-6 rounded-full border border-[var(--line)] text-[10px] font-medium text-[var(--foreground)]/40 transition hover:bg-[var(--accent-warm)]/15 hover:text-[var(--accent-warm)]">
                          {s}
                        </button>
                      ))}
                      <span className="ml-1 text-[10px] text-[var(--foreground)]/25">score</span>
                    </div>
                  )}
                </motion.div>
              ))}
              {state.runs.length === 0 && (
                <div className="panel rounded-[22px] px-5 py-8 text-center">
                  <p className="text-sm text-[var(--foreground)]/35">No runs yet. Start a generation to see results.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Right sidebar: Runs overview ──────────── */}
      <div className="space-y-5">
        <div className="panel-strong rounded-[24px] p-5">
          <p className="text-xs uppercase tracking-wider text-[var(--foreground)]/30 mb-4">Recent Runs</p>
          <div className="space-y-2">
            {state.runs.slice(0, 6).map((run, i) => (
              <motion.div
                key={run.id ?? run.title}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between rounded-[16px] px-3 py-2.5 transition hover:bg-white/60 cursor-default"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{run.title}</p>
                  <p className="text-[10px] text-[var(--foreground)]/30">{run.duration}</p>
                </div>
                <StatusBadge status={run.status} small />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Overview stats */}
        <div className="panel-strong rounded-[24px] p-5">
          <p className="text-xs uppercase tracking-wider text-[var(--foreground)]/30 mb-4">Overview</p>
          <div className="grid grid-cols-2 gap-3">
            <StatBox value={completedRuns} label="Completed" color="var(--success)" />
            <StatBox value={failedRuns} label="Failed" color="var(--danger)" />
            <StatBox value={runningRuns} label="In progress" color="#4d7cfe" />
            <StatBox value="18s" label="Avg. runtime" color="var(--foreground)" />
          </div>
        </div>

        {/* Memory context */}
        {state.memoryPrompts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel rounded-[24px] p-5"
          >
            <p className="text-xs uppercase tracking-wider text-[var(--foreground)]/30 mb-3">Prompt Memory</p>
            <div className="space-y-2">
              {state.memoryPrompts.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-[14px] border border-[var(--line)] bg-white/50 px-3 py-2">
                  <p className="text-xs font-medium">{item.title}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--foreground)]/35">score {item.score}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* ─── Floating notifications ────────────────── */}
      <AnimatePresence>
        {state.running && (
          <motion.div
            key="generating"
            initial={{ opacity: 0, y: 18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.95 }}
            className="fixed bottom-5 right-5 panel-strong rounded-[20px] px-5 py-4 z-50"
          >
            <div className="flex items-center gap-3">
              <motion.div
                className="h-3 w-3 rounded-full bg-[var(--success)]"
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              />
              <div>
                <p className="text-sm font-medium">Generation in progress</p>
                <p className="text-xs text-[var(--foreground)]/45">Routing model and processing output...</p>
              </div>
            </div>
          </motion.div>
        )}
        {state.lastScoreResult && (
          <motion.div
            key="scored"
            initial={{ opacity: 0, y: 18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.95 }}
            className="fixed bottom-5 right-5 panel-strong rounded-[20px] px-5 py-4 z-50"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium">Scored {state.lastScoreResult.score.score}/5</p>
              <button onClick={() => dispatch({ type: "DISMISS_SCORE" })} className="text-xs text-[var(--foreground)]/30 hover:text-[var(--foreground)]">dismiss</button>
            </div>
            <p className="mt-1 text-xs text-[var(--foreground)]/45">
              {state.lastScoreResult.regeneration.shouldRegenerate ? state.lastScoreResult.regeneration.reason : "Score recorded."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────── */

function NodeIcon({ type }: { type: string }) {
  switch (type) {
    case "Trigger":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-warm)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
    case "Agent":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4d7cfe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "Process":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      );
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={0.4}>
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
      );
  }
}

function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  const base = small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]";
  let color = "bg-[var(--foreground)]/5 text-[var(--foreground)]/40";
  if (status === "Completed") color = "bg-[var(--success-soft)] text-[var(--success)]";
  else if (status === "Running") color = "bg-blue-50 text-blue-600";
  else if (status === "Failed") color = "bg-[var(--danger-soft)] text-[var(--danger)]";
  return <span className={`shrink-0 rounded-full font-medium ${base} ${color}`}>{status}</span>;
}

function StatBox({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="rounded-[16px] border border-[var(--line)] bg-white/50 px-3 py-3 text-center">
      <p className="text-xl font-semibold tracking-tight" style={{ color }}>{value}</p>
      <p className="mt-0.5 text-[10px] text-[var(--foreground)]/35">{label}</p>
    </div>
  );
}
