"use client";

import type { PromptPreset, ProviderConfig, RunSummary } from "@dreamora/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  deriveModelsFromProviders,
  getGenerationPlan,
  getGenerationStatus,
  getStudioSuggestions,
  scoreRun,
  startGeneration
} from "../lib/client-api";
import type { GenerationPlan, PlanStep, ScoreResponse } from "../lib/client-api";

const imageRatios = ["1:1", "4:5", "3:4", "16:9", "9:16"];
const videoRatios = ["16:9", "9:16"];
const qualityOptions = ["Standard", "High", "Ultra"] as const;
const batchOptions = ["1", "2", "4", "8"];

const workflowStages = [
  {
    title: "Prompt accepted",
    note: "The generation request is serialized with model, aspect ratio, and quality."
  },
  {
    title: "Provider routing",
    note: "Local and third-party credentials are checked before queue placement."
  },
  {
    title: "Model execution",
    note: "The selected image or video model starts inference on the active provider."
  },
  {
    title: "Asset packaging",
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
};

export function StudioWorkbench({
  providers,
  initialRuns,
  promptPresets
}: StudioWorkbenchProps) {
  const modelGroups = useMemo(
    () => deriveModelsFromProviders(providers),
    [providers]
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

  const handleMode = useCallback((nextMode: "image" | "video") => {
    const nextModels =
      nextMode === "image" ? modelGroups.imageModels : modelGroups.videoModels;
    dispatch({
      type: "SET_MODE",
      mode: nextMode,
      model: nextModels[0] ?? state.selectedModel
    });
  }, [modelGroups, state.selectedModel]);

  function applyPreset(preset: PromptPreset) {
    dispatch({ type: "SET_PROMPT", text: preset.summary });
    if (preset.type.toLowerCase().includes("video")) {
      handleMode("video");
    } else {
      handleMode("image");
    }
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
          id: run.id,
          title: run.title,
          engine: run.engine,
          duration: run.duration,
          tokensUsed: run.tokensUsed,
          aspectRatio: run.aspectRatio,
          quality: run.quality
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
    } catch {
      // scoring is non-critical
    }
  }

  async function pollGeneration(jobId: string, runId: string, signal: AbortSignal) {
    let attempts = 0;
    const maxAttempts = 120;

    while (attempts < maxAttempts && !signal.aborted) {
      attempts += 1;
      await new Promise((resolve) => {
        window.setTimeout(resolve, 2500);
      });

      if (signal.aborted || !mountedRef.current) return;

      try {
        const status = await getGenerationStatus(jobId);
        if (signal.aborted || !mountedRef.current) return;

        if (status.status === "completed") {
          dispatch({
            type: "GENERATION_POLL_UPDATE",
            runId,
            updates: {
              status: "Completed",
              output: status.outputSummary ?? undefined
            }
          });
          dispatch({ type: "GENERATION_DONE" });
          return;
        }

        if (status.status === "failed") {
          dispatch({
            type: "GENERATION_POLL_UPDATE",
            runId,
            updates: {
              status: "Failed",
              duration: "Failed",
              output: status.error ?? "Generation failed"
            }
          });
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
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: "START_GENERATE" });

    const now = new Date();
    const runTitle =
      state.mode === "image"
        ? `Image generation ${now.toLocaleTimeString()}`
        : `Video generation ${now.toLocaleTimeString()}`;

    try {
      const started = await startGeneration({
        mode: state.mode,
        prompt: state.promptText,
        model: state.selectedModel,
        aspectRatio: state.ratio,
        quality: state.quality,
        batchSize: state.mode === "image" ? Number(state.batch) : 1
      });

      if (controller.signal.aborted || !mountedRef.current) return;

      const provisionalRun: RunSummary = {
        id: started.runId,
        title: runTitle,
        engine: state.selectedModel,
        status: "Running",
        duration: "Pending",
        output: state.mode === "image" ? `${state.batch} image(s)` : `${state.ratio} clip`,
        mode: state.mode
      };

      let notice = "";
      if (started.backend === "simulated" && started.fallbackReason) {
        notice = `ComfyUI fallback active: ${started.fallbackReason}`;
      } else if (started.backend === "simulated") {
        notice = "ComfyUI not enabled; using simulated backend.";
      } else {
        notice = `ComfyUI backend active (${started.workflowPath ?? "workflow path unknown"}).`;
      }

      dispatch({ type: "GENERATION_STARTED", run: provisionalRun, notice });
      await pollGeneration(started.jobId, started.runId, controller.signal);
    } catch {
      if (!mountedRef.current) return;
      dispatch({ type: "GENERATION_ERROR", error: "Could not start generation. Check API server." });
    }
  }

  const displayedRuns = state.runs.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="panel rounded-[32px] p-4">
        <div className="flex flex-wrap items-center gap-3 rounded-[28px] bg-[#252525] p-2 text-white">
          <div className="flex items-center rounded-[20px] border border-white/8 bg-white/5 px-2">
            {(["image", "video"] as const).map((item) => (
              <button
                key={item}
                onClick={() => handleMode(item)}
                aria-label={`Switch to ${item} generation`}
                className={[
                  "rounded-[16px] px-4 py-3 text-sm font-medium transition",
                  state.mode === item ? "bg-[#d7ff1f] text-black" : "text-white/72"
                ].join(" ")}
              >
                {item === "image" ? "Image" : "Video"}
              </button>
            ))}
          </div>

          <select
            value={state.selectedModel}
            onChange={(event) => dispatch({ type: "SET_MODEL", model: event.target.value })}
            aria-label="Select model"
            className="rounded-[18px] border border-white/8 bg-white/5 px-4 py-3 text-sm outline-none"
          >
            {models.map((model) => (
              <option key={model} value={model} className="text-black">
                {model}
              </option>
            ))}
          </select>

          <select
            value={state.ratio}
            onChange={(event) => dispatch({ type: "SET_RATIO", ratio: event.target.value })}
            aria-label="Select aspect ratio"
            className="rounded-[18px] border border-white/8 bg-white/5 px-4 py-3 text-sm outline-none"
          >
            {ratios.map((item) => (
              <option key={item} value={item} className="text-black">
                {item}
              </option>
            ))}
          </select>

          <select
            value={state.quality}
            onChange={(event) =>
              dispatch({ type: "SET_QUALITY", quality: event.target.value as (typeof qualityOptions)[number] })
            }
            aria-label="Select quality"
            className="rounded-[18px] border border-white/8 bg-white/5 px-4 py-3 text-sm outline-none"
          >
            {qualityOptions.map((item) => (
              <option key={item} value={item} className="text-black">
                {item}
              </option>
            ))}
          </select>

          <select
            value={state.batch}
            onChange={(event) => dispatch({ type: "SET_BATCH", batch: event.target.value })}
            disabled={state.mode === "video"}
            aria-label="Select batch size"
            className="rounded-[18px] border border-white/8 bg-white/5 px-4 py-3 text-sm outline-none disabled:opacity-60"
          >
            {batchOptions.map((item) => (
              <option key={item} value={item} className="text-black">
                {item}
              </option>
            ))}
          </select>

          <button
            onClick={handleGenerate}
            disabled={state.running || !state.selectedModel || !state.promptText.trim()}
            className="ml-auto rounded-[20px] bg-[#d7ff1f] px-6 py-3 text-sm font-semibold text-black transition hover:brightness-95 disabled:opacity-65"
          >
            {state.running ? "Generating..." : "Generate"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={handleAnalyzePrompt}
            disabled={state.suggesting || !state.promptText.trim()}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm disabled:opacity-60"
          >
            {state.suggesting ? "Analyzing..." : "Analyze Prompt"}
          </button>
          <button
            onClick={() => dispatch({ type: "APPLY_SETTINGS" })}
            disabled={!state.recommendedSettings}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm disabled:opacity-60"
          >
            Apply Best Settings
          </button>
          {state.recommendedSettings ? (
            <span className="text-sm text-black/65">
              Avg tokens: {state.recommendedSettings.averageTokens.toLocaleString()}
            </span>
          ) : null}
        </div>
        {state.runtimeNotice ? (
          <p className="mt-3 text-sm text-black/70">{state.runtimeNotice}</p>
        ) : null}
        {state.submitError ? <p className="mt-2 text-sm text-red-600">{state.submitError}</p> : null}
        {state.suggestionError ? <p className="mt-2 text-sm text-red-600">{state.suggestionError}</p> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="panel overflow-hidden rounded-[34px]">
          <div className="border-b border-black/8 px-6 py-4">
            <p className="text-sm text-black/45">Generator</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {state.mode === "image" ? "Describe the image" : "Describe the video"}
            </h2>
          </div>
          <div className="p-6">
            <div className="rounded-[28px] border border-[#dce2ef] bg-white p-5">
              <label htmlFor="studio-prompt" className="text-sm text-black/42">Prompt</label>
              <textarea
                id="studio-prompt"
                value={state.promptText}
                onChange={(event) => dispatch({ type: "SET_PROMPT", text: event.target.value })}
                className="mt-3 min-h-32 w-full resize-y rounded-xl border border-black/10 bg-[#fcfcfc] p-3 text-base leading-7 text-black/72 outline-none"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {promptPresets.slice(0, 4).map((preset) => (
                  <button
                    key={preset.id ?? preset.title}
                    onClick={() => applyPreset(preset)}
                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-black/68"
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <InfoCard
                label="Mode"
                value={state.mode === "image" ? "Image generation" : "Video generation"}
              />
              <InfoCard label="Model" value={state.selectedModel} />
              <InfoCard label="Aspect ratio" value={state.ratio} />
              <InfoCard
                label="Quality / Batch"
                value={`${state.quality} - ${state.mode === "image" ? state.batch : "n/a"}`}
              />
            </div>

            <div className="mt-6 rounded-[30px] border border-black/8 bg-[#fafaf7] px-5 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-black/42">Processing</p>
                  <h3 className="mt-1 text-xl font-semibold">
                    Workflow execution view
                  </h3>
                </div>
                <div className="rounded-full border border-black/8 bg-white px-3 py-1 text-xs text-black/58">
                  {state.running ? "Live" : "Idle"}
                </div>
              </div>

              <div className="mt-6 grid min-h-[420px] grid-cols-[1fr_260px] gap-0 overflow-hidden rounded-[26px] border border-black/8 bg-white">
                <div className="grid-fade relative p-8" role="region" aria-label="Workflow stages">
                  <div className="absolute left-10 top-6 rounded-full bg-[#dff9ea] px-3 py-1 text-xs font-medium text-[#23945d]">
                    Run queue
                  </div>
                  <div className="mx-auto mt-16 max-w-[420px] space-y-10">
                    {workflowStages.map((stage, index) => (
                      <motion.div
                        key={stage.title}
                        initial={{ opacity: 0.6, y: 8 }}
                        animate={{
                          opacity: state.running ? 1 : 0.86,
                          y: 0
                        }}
                        transition={{ delay: index * 0.18 }}
                        className="relative"
                      >
                        {index < workflowStages.length - 1 ? (
                          <motion.div
                            className="absolute left-6 top-[88px] h-16 w-px bg-[#6be29c]"
                            animate={{
                              opacity: state.running ? [0.25, 1, 0.25] : 0.18
                            }}
                            transition={{
                              repeat: state.running ? Number.POSITIVE_INFINITY : 0,
                              duration: 1.4,
                              delay: index * 0.2
                            }}
                          />
                        ) : null}

                        <motion.div
                          className="rounded-[24px] border border-[#9de7ba] bg-white px-5 py-4 shadow-[0_14px_40px_rgba(60,80,80,0.05)]"
                          animate={{
                            boxShadow: state.running
                              ? [
                                  "0 14px 40px rgba(60,80,80,0.05)",
                                  "0 18px 44px rgba(77, 222, 133, 0.16)",
                                  "0 14px 40px rgba(60,80,80,0.05)"
                                ]
                              : "0 14px 40px rgba(60,80,80,0.05)"
                          }}
                          transition={{
                            repeat: state.running ? Number.POSITIVE_INFINITY : 0,
                            duration: 1.6,
                            delay: index * 0.18
                          }}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <p className="font-medium">{stage.title}</p>
                            <span className="rounded-full bg-[#e8fff0] px-3 py-1 text-xs text-[#23945d]">
                              {state.running
                                ? index === workflowStages.length - 1
                                  ? "Finishing"
                                  : "Processing"
                                : "Ready"}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-black/56">
                            {stage.note}
                          </p>
                        </motion.div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="border-l border-black/8 bg-[#fcfcfa]" role="complementary" aria-label="Recent runs">
                  <div className="border-b border-black/8 px-4 py-4">
                    <p className="text-lg font-semibold tracking-tight">
                      Recent runs
                    </p>
                  </div>
                  <div className="space-y-1 px-3 py-3">
                    {displayedRuns.map((run) => (
                      <div
                        key={run.id ?? run.title}
                        className="rounded-[18px] px-3 py-3 hover:bg-white"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{run.title}</p>
                            <p className="text-sm text-black/45">
                              {run.status} - {run.duration}
                            </p>
                          </div>
                          <span className={[
                            "shrink-0 rounded-full px-2 py-1 text-xs",
                            run.status === "Failed"
                              ? "bg-red-50 text-red-600"
                              : run.status === "Running"
                                ? "bg-blue-50 text-blue-600"
                                : "bg-[#edf7ef] text-[#23945d]"
                          ].join(" ")}>
                            {run.status}
                          </span>
                        </div>
                        {run.id && run.status === "Completed" ? (
                          <div className="mt-2 flex gap-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <button
                                key={s}
                                onClick={() => handleScoreRun(run.id!, s)}
                                aria-label={`Score ${s} out of 5`}
                                className="h-5 w-5 rounded-full border border-black/10 text-[10px] font-medium text-black/50 transition hover:bg-[#d7ff1f] hover:text-black"
                              >
                                {s}
                              </button>
                            ))}
                            <span className="ml-1 text-[10px] text-black/35 leading-5">rate</span>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="panel rounded-[34px] p-6">
            <p className="text-sm text-black/45">Third-party model support</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">
              Provider-aware generation
            </h3>
            <p className="mt-3 text-sm leading-6 text-black/56">
              Available models are derived from configured providers. This
              removes manual model list maintenance and prevents broken runs
              from unconfigured providers.
            </p>
          </div>

          <div className="panel rounded-[34px] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-black/45">Workflow planner</p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight">
                  Generation recipe
                </h3>
              </div>
              <button
                onClick={handleGetPlan}
                disabled={state.planLoading || !state.promptText.trim()}
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs disabled:opacity-60"
              >
                {state.planLoading ? "Planning..." : "Plan"}
              </button>
            </div>
            {state.plan ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-black/55">{state.plan.reasoning}</p>
                {state.plan.steps.map((step) => (
                  <div
                    key={step.order}
                    className={[
                      "flex items-start gap-3 rounded-[16px] px-3 py-2",
                      step.optional ? "bg-black/3" : "bg-[#edf7ef]"
                    ].join(" ")}
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/8 text-[10px] font-semibold">
                      {step.order}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium">
                        {step.action.replace(/_/g, " ")}{" "}
                        <span className="font-normal text-black/45">({step.engine})</span>
                        {step.optional ? (
                          <span className="ml-1 text-black/35">optional</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-4 text-black/50">{step.description}</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-black/45">
                    ~{state.plan.estimatedTotalTokens.toLocaleString()} tokens (required steps)
                  </span>
                  <button
                    onClick={() => dispatch({ type: "APPLY_PLAN" })}
                    className="rounded-full bg-[#d7ff1f] px-3 py-1 text-xs font-medium text-black"
                  >
                    Apply plan settings
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-black/55">
                Analyze your prompt to get a multi-step generation recipe with content-aware settings.
              </p>
            )}
          </div>

          <div className="panel rounded-[34px] p-6">
            <p className="text-sm text-black/45">Prompt memory</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">
              Retrieved context
            </h3>
            {state.memoryPrompts.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-black/55">
                Analyze your prompt to retrieve similar presets and successful run signals.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {state.memoryPrompts.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[20px] border border-black/8 bg-white px-4 py-3"
                  >
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-black/55">{item.summary}</p>
                    <p className="mt-2 text-xs text-black/45">
                      score {item.score} · {item.tags.slice(0, 3).join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel rounded-[34px] p-6">
            <p className="text-sm text-black/45">Run comparison</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">
              Best recent completions
            </h3>
            {state.memoryRuns.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-black/55">
                No completed run memory loaded yet.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {state.memoryRuns.slice(0, 3).map((run) => (
                  <div
                    key={run.id}
                    className="rounded-[20px] border border-black/8 bg-white px-4 py-3"
                  >
                    <p className="text-sm font-medium">{run.title}</p>
                    <p className="mt-1 text-xs text-black/55">
                      {run.engine} · {run.duration}
                    </p>
                    <p className="mt-1 text-xs text-black/45">
                      {run.aspectRatio ?? "n/a"} · {run.quality ?? "n/a"} · {run.tokensUsed.toLocaleString()} tokens
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {state.running ? (
          <motion.div
            key="generating"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            role="alert"
            className="fixed bottom-5 right-5 rounded-[22px] border border-black/8 bg-white px-5 py-4 shadow-[0_20px_70px_rgba(28,34,48,0.15)]"
          >
            <p className="font-medium">Generation in progress</p>
            <p className="mt-1 text-sm text-black/56">
              Routing model, processing output, and collecting usage data.
            </p>
          </motion.div>
        ) : null}
        {state.lastScoreResult ? (
          <motion.div
            key="scored"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className="fixed bottom-5 right-5 rounded-[22px] border border-black/8 bg-white px-5 py-4 shadow-[0_20px_70px_rgba(28,34,48,0.15)]"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="font-medium">
                Scored {state.lastScoreResult.score.score}/5
              </p>
              <button
                onClick={() => dispatch({ type: "DISMISS_SCORE" })}
                className="text-xs text-black/40 hover:text-black"
              >
                dismiss
              </button>
            </div>
            <p className="mt-1 text-sm text-black/56">
              {state.lastScoreResult.regeneration.shouldRegenerate
                ? state.lastScoreResult.regeneration.reason
                : "Score recorded. Recommendations will weight this feedback."}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-black/8 bg-white px-4 py-4">
      <p className="text-sm text-black/42">{label}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-black/78">{value}</p>
    </div>
  );
}
