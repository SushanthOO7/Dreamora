"use client";

import type {
  ProjectSummary,
  PromptPreset,
  ProviderConfig
} from "@dreamora/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  deleteAsset,
  deriveModelsFromProviders,
  getGenerationStatus,
  listAssets,
  startGeneration,
  uploadAsset
} from "../lib/client-api";
import type { GenerationOutputRef, StudioAsset } from "../lib/client-api";

const imageRatios = ["1:1", "4:5", "3:4", "16:9", "9:16"];
const videoRatios = ["16:9", "9:16"];
const qualityOptions = ["Standard", "High", "Ultra"] as const;
const batchOptions = ["1", "2", "4", "8"];
const videoDurationOptions = [5, 10, 15] as const;
const videoFpsOptions = [16, 24, 30, 60] as const;
const MAX_REFERENCES = 5;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type PreviewState = {
  jobId: string;
  outputs: GenerationOutputRef[];
} | null;

type StudioState = {
  mode: "image" | "video";
  ratio: string;
  quality: (typeof qualityOptions)[number];
  batch: string;
  videoDuration: (typeof videoDurationOptions)[number];
  videoFps: (typeof videoFpsOptions)[number];
  selectedModel: string;
  promptText: string;
  running: boolean;
  submitError: string;
  runtimeNotice: string;
  preview: PreviewState;
};

type StudioAction =
  | { type: "SET_MODE"; mode: "image" | "video"; model: string }
  | { type: "SET_RATIO"; ratio: string }
  | { type: "SET_QUALITY"; quality: (typeof qualityOptions)[number] }
  | { type: "SET_BATCH"; batch: string }
  | { type: "SET_VIDEO_DURATION"; duration: (typeof videoDurationOptions)[number] }
  | { type: "SET_VIDEO_FPS"; fps: (typeof videoFpsOptions)[number] }
  | { type: "SET_MODEL"; model: string }
  | { type: "SET_PROMPT"; text: string }
  | { type: "START_GENERATE"; notice: string }
  | { type: "GENERATION_DONE" }
  | { type: "GENERATION_ERROR"; error: string }
  | { type: "SET_NOTICE"; notice: string }
  | { type: "PREVIEW_SET"; jobId: string; outputs: GenerationOutputRef[] }
  | { type: "PREVIEW_CLEAR" };

function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case "SET_MODE":
      return {
        ...state,
        mode: action.mode,
        selectedModel: action.model,
        ratio: action.mode === "image" ? "1:1" : "16:9",
        promptText:
          action.mode === "image"
            ? "Premium product scene with controlled reflections, sculpted natural light, and a restrained editorial composition."
            : "Luxury product reveal with a slow forward push, clean highlight motion, and stable premium pacing."
      };
    case "SET_RATIO":
      return { ...state, ratio: action.ratio };
    case "SET_QUALITY":
      return { ...state, quality: action.quality };
    case "SET_BATCH":
      return { ...state, batch: action.batch };
    case "SET_VIDEO_DURATION":
      return { ...state, videoDuration: action.duration };
    case "SET_VIDEO_FPS":
      return { ...state, videoFps: action.fps };
    case "SET_MODEL":
      return { ...state, selectedModel: action.model };
    case "SET_PROMPT":
      return { ...state, promptText: action.text };
    case "START_GENERATE":
      return {
        ...state,
        running: true,
        submitError: "",
        runtimeNotice: action.notice,
        preview: null
      };
    case "GENERATION_DONE":
      return { ...state, running: false };
    case "GENERATION_ERROR":
      return { ...state, running: false, submitError: action.error };
    case "SET_NOTICE":
      return { ...state, runtimeNotice: action.notice };
    case "PREVIEW_SET":
      return {
        ...state,
        preview: { jobId: action.jobId, outputs: action.outputs }
      };
    case "PREVIEW_CLEAR":
      return { ...state, preview: null };
    default:
      return state;
  }
}

type StudioWorkbenchProps = {
  providers: ProviderConfig[];
  promptPresets: PromptPreset[];
  projects: ProjectSummary[];
};

export function StudioWorkbench({
  providers,
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
    ratio: "1:1",
    quality: "High",
    batch: "4",
    videoDuration: 5,
    videoFps: 24,
    selectedModel: modelGroups.imageModels[0] ?? "Dreamora FLUX local",
    promptText:
      "Premium product scene with controlled reflections, sculpted natural light, and a restrained editorial composition.",
    running: false,
    submitError: "",
    runtimeNotice: "",
    preview: null
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([]);
  const [assetError, setAssetError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showReferences, setShowReferences] = useState(false);

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
    formData.set("role", "secondary");
    formData.set("weight", "0.5");
    if (selectedProjectId) formData.set("projectId", selectedProjectId);
    try {
      await uploadAsset(formData);
      if (!mountedRef.current) return;
      await refreshAssets(assetScope, selectedProjectId);
    } catch {
      if (!mountedRef.current) return;
      setAssetError("Could not upload reference image.");
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }

  async function handleRemoveAsset(assetId: string) {
    const confirmed = window.confirm("Remove this reference permanently?");
    if (!confirmed) return;
    try {
      await deleteAsset(assetId);
      if (!mountedRef.current) return;
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      setSelectedReferenceIds((prev) => prev.filter((id) => id !== assetId));
    } catch {
      if (!mountedRef.current) return;
      setAssetError("Could not delete reference image.");
    }
  }

  function handleToggleAsset(asset: StudioAsset) {
    setAssetError("");
    if (selectedReferenceIds.includes(asset.id)) {
      setSelectedReferenceIds((prev) => prev.filter((id) => id !== asset.id));
      return;
    }
    if (selectedReferenceIds.length >= MAX_REFERENCES) {
      setAssetError(`Max ${MAX_REFERENCES} references.`);
      return;
    }
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

  async function pollGeneration(jobId: string, signal: AbortSignal) {
    let attempts = 0;
    const maxAttempts = 240;
    while (attempts < maxAttempts && !signal.aborted) {
      attempts += 1;
      await new Promise((resolve) => { window.setTimeout(resolve, 2500); });
      if (signal.aborted || !mountedRef.current) return;
      try {
        const status = await getGenerationStatus(jobId);
        if (signal.aborted || !mountedRef.current) return;
        if (status.status === "completed") {
          if (status.outputs && status.outputs.length > 0) {
            dispatch({ type: "PREVIEW_SET", jobId, outputs: status.outputs });
          }
          dispatch({ type: "GENERATION_DONE" });
          return;
        }
        if (status.status === "failed") {
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
    dispatch({ type: "START_GENERATE", notice: "" });
    try {
      const started = await startGeneration({
        mode: state.mode, prompt: state.promptText, model: state.selectedModel,
        aspectRatio: state.ratio, quality: state.quality,
        batchSize: state.mode === "image" ? Number(state.batch) : 1,
        durationSeconds: state.mode === "video" ? state.videoDuration : undefined,
        fps: state.mode === "video" ? state.videoFps : undefined,
        projectId: selectedProjectId ?? undefined,
        referenceAssetIds: selectedReferenceIds
      });
      if (controller.signal.aborted || !mountedRef.current) return;
      if (started.backend === "simulated") {
        const notice = started.fallbackReason
          ? `Simulated (fallback: ${started.fallbackReason})`
          : "Simulated backend";
        dispatch({ type: "SET_NOTICE", notice });
      }
      await pollGeneration(started.jobId, controller.signal);
    } catch (error) {
      if (!mountedRef.current) return;
      dispatch({
        type: "GENERATION_ERROR",
        error: error instanceof Error && error.message ? error.message : "Could not start generation."
      });
    }
  }

  const canGenerate = !state.running && !!state.selectedModel && state.promptText.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6">
      {/* ─── Preview ─────────────────────────────── */}
      <PreviewPanel
        preview={state.preview}
        running={state.running}
        onClear={() => dispatch({ type: "PREVIEW_CLEAR" })}
      />

      {/* ─── Prompt + Generate ─────────────────── */}
      <div className="panel-strong rounded-[28px] p-6">
        <textarea
          value={state.promptText}
          onChange={(e) => dispatch({ type: "SET_PROMPT", text: e.target.value })}
          placeholder="Describe what you want to create..."
          className="w-full min-h-[88px] resize-none rounded-[18px] border border-[var(--line)] bg-white/60 px-4 py-3 text-sm leading-6 text-[var(--foreground)]/80 outline-none placeholder:text-[var(--foreground)]/25 transition focus:border-[var(--accent-warm)]/30 focus:bg-white/80"
        />

        {promptPresets.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {promptPresets.slice(0, 3).map((preset) => (
              <button
                key={preset.id ?? preset.title}
                onClick={() => applyPreset(preset)}
                className="rounded-full border border-[var(--line)] bg-white/50 px-2.5 py-0.5 text-[11px] text-[var(--foreground)]/50 transition hover:bg-white/80 hover:text-[var(--foreground)]"
              >
                {preset.title}
              </button>
            ))}
          </div>
        )}

        {/* Controls row */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* Mode toggle */}
          <div className="flex rounded-full border border-[var(--line)] bg-white/40 p-0.5">
            {(["image", "video"] as const).map((m) => (
              <button
                key={m}
                onClick={() => handleMode(m)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  state.mode === m
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--foreground)]/50 hover:text-[var(--foreground)]"
                }`}
              >
                {m === "image" ? "Image" : "Video"}
              </button>
            ))}
          </div>

          <Select
            value={state.selectedModel}
            onChange={(v) => dispatch({ type: "SET_MODEL", model: v })}
            options={models.map((m) => ({ value: m, label: m }))}
          />
          <Select
            value={state.ratio}
            onChange={(v) => dispatch({ type: "SET_RATIO", ratio: v })}
            options={ratios.map((r) => ({ value: r, label: r }))}
          />
          <Select
            value={state.quality}
            onChange={(v) => dispatch({ type: "SET_QUALITY", quality: v as (typeof qualityOptions)[number] })}
            options={qualityOptions.map((q) => ({ value: q, label: q }))}
          />

          {state.mode === "image" && (
            <Select
              value={state.batch}
              onChange={(v) => dispatch({ type: "SET_BATCH", batch: v })}
              options={batchOptions.map((b) => ({ value: b, label: `${b}×` }))}
            />
          )}

          {state.mode === "video" && (
            <>
              <Select
                value={String(state.videoDuration)}
                onChange={(v) => dispatch({ type: "SET_VIDEO_DURATION", duration: Number(v) as (typeof videoDurationOptions)[number] })}
                options={videoDurationOptions.map((d) => ({ value: String(d), label: `${d}s` }))}
                title="Clip length. 15s @ 60fps is very heavy."
              />
              <Select
                value={String(state.videoFps)}
                onChange={(v) => dispatch({ type: "SET_VIDEO_FPS", fps: Number(v) as (typeof videoFpsOptions)[number] })}
                options={videoFpsOptions.map((f) => ({ value: String(f), label: `${f} fps` }))}
                title="Playback rate. Wan 2.2 is trained near 16–24 fps."
              />
            </>
          )}

          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="ml-auto rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {state.running ? "Generating..." : "Generate"}
          </button>
        </div>

        {(state.submitError || state.runtimeNotice) && (
          <div className="mt-3 space-y-1">
            {state.submitError && <p className="text-xs text-[var(--danger)]">{state.submitError}</p>}
            {state.runtimeNotice && <p className="text-xs text-[var(--foreground)]/55">{state.runtimeNotice}</p>}
          </div>
        )}
      </div>

      {/* ─── Reference library (collapsible) ─── */}
      <div>
        <div className="panel rounded-[24px] p-5">
          <button
            type="button"
            onClick={() => setShowReferences((prev) => !prev)}
            className="flex w-full items-center justify-between"
          >
            <p className="text-xs uppercase tracking-wider text-[var(--foreground)]/35">
              References
            </p>
            <span className="text-[11px] text-[var(--foreground)]/30">
              {selectedReferenceIds.length}/{MAX_REFERENCES} · {showReferences ? "hide" : "show"}
            </span>
          </button>

          {showReferences && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                {projectOptions.length > 0 && (
                  <Select
                    value={selectedProjectId ?? "__global__"}
                    onChange={handleProjectScopeChange}
                    options={[
                      { value: "__global__", label: "Global" },
                      ...projectOptions.map((p) => ({ value: p.id, label: p.name }))
                    ]}
                  />
                )}
                <label className="ml-auto cursor-pointer rounded-full bg-[var(--accent)] px-3 py-1 text-[11px] font-medium text-white shadow-sm transition hover:opacity-90">
                  {uploading ? "..." : "Upload"}
                  <input type="file" accept="image/*" disabled={uploading} onChange={handleUploadFile} className="hidden" />
                </label>
              </div>

              {assets.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-[var(--foreground)]/35">
                  No references yet.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {assets.map((asset) => {
                    const selected = selectedReferenceIds.includes(asset.id);
                    return (
                      <div key={asset.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => handleToggleAsset(asset)}
                          className={`block aspect-square w-full overflow-hidden rounded-[12px] border transition ${
                            selected
                              ? "border-[var(--accent-warm)] ring-2 ring-[var(--accent-warm)]/30"
                              : "border-[var(--line)] hover:border-[var(--foreground)]/20"
                          }`}
                        >
                          <img
                            src={`${API_BASE_URL}${asset.previewUrl}`}
                            alt={asset.filename}
                            className="h-full w-full object-cover"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAsset(asset.id)}
                          className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/50 text-[11px] text-white group-hover:flex"
                          title="Delete"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {assetError && <p className="text-[11px] text-[var(--danger)]">{assetError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────── */

function PreviewPanel({
  preview,
  running,
  onClear
}: {
  preview: PreviewState;
  running: boolean;
  onClear: () => void;
}) {
  return (
    <div className="panel-strong rounded-[28px] p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-[var(--foreground)]/35">Preview</p>
        {preview && (
          <button
            onClick={onClear}
            className="text-[11px] text-[var(--foreground)]/35 transition hover:text-[var(--foreground)]/60"
          >
            clear
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {preview && preview.outputs.length > 0 ? (
          <motion.div
            key={preview.jobId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`grid gap-3 ${
              preview.outputs.length > 1 ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1"
            }`}
          >
            {preview.outputs.map((output) => (
              <PreviewItem key={output.url} output={output} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex aspect-[16/9] items-center justify-center rounded-[20px] border border-dashed border-[var(--line)] bg-white/30"
          >
            {running ? (
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  className="h-2 w-2 rounded-full bg-[var(--accent-warm)]"
                  animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                />
                <p className="text-xs text-[var(--foreground)]/40">Generating...</p>
              </div>
            ) : (
              <p className="text-xs text-[var(--foreground)]/35">
                Your generated output will appear here
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PreviewItem({ output }: { output: GenerationOutputRef }) {
  const src = `${API_BASE_URL}${output.url}`;
  if (output.kind === "video") {
    return (
      <video
        src={src}
        controls
        autoPlay
        loop
        playsInline
        className="w-full rounded-[20px] border border-[var(--line)] bg-black"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={output.filename}
      className="w-full rounded-[20px] border border-[var(--line)] object-contain"
    />
  );
}

function Select({
  value,
  onChange,
  options,
  title
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  title?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={title}
        className="appearance-none rounded-full border border-[var(--line)] bg-white/60 pl-3 pr-7 py-1.5 text-xs font-medium text-[var(--foreground)]/70 outline-none transition hover:bg-white/80 focus:border-[var(--accent-warm)]/40 focus:ring-1 focus:ring-[var(--accent-warm)]/20 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--foreground)]/30"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 5l3 3 3-3" />
      </svg>
    </div>
  );
}

