"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";

const imageModels = [
  "Dreamora FLUX local",
  "OpenAI gpt-image-1",
  "Replicate FLUX Pro"
];

const videoModels = [
  "Dreamora Wan 2.2 local",
  "Runway Gen-4",
  "Replicate Wan video"
];

const imageRatios = ["1:1", "4:5", "3:4", "16:9", "9:16"];
const videoRatios = ["16:9", "9:16"];
const qualityOptions = ["Standard", "High", "Ultra"];
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

export function StudioWorkbench() {
  const [mode, setMode] = useState<"image" | "video">("image");
  const [ratio, setRatio] = useState("16:9");
  const [quality, setQuality] = useState("High");
  const [batch, setBatch] = useState("4");
  const [selectedModel, setSelectedModel] = useState(imageModels[0]);
  const [running, setRunning] = useState(false);

  const models = useMemo(
    () => (mode === "image" ? imageModels : videoModels),
    [mode]
  );

  const ratios = mode === "image" ? imageRatios : videoRatios;

  function handleMode(nextMode: "image" | "video") {
    setMode(nextMode);
    setSelectedModel(nextMode === "image" ? imageModels[0] : videoModels[0]);
    setRatio(nextMode === "image" ? "16:9" : "16:9");
  }

  function handleGenerate() {
    setRunning(true);
    window.setTimeout(() => {
      setRunning(false);
    }, 5200);
  }

  return (
    <div className="space-y-6">
      <div className="panel rounded-[32px] p-4">
        <div className="flex flex-wrap items-center gap-3 rounded-[28px] bg-[#252525] p-2 text-white">
          <div className="flex items-center rounded-[20px] border border-white/8 bg-white/5 px-2">
            {(["image", "video"] as const).map((item) => (
              <button
                key={item}
                onClick={() => handleMode(item)}
                className={[
                  "rounded-[16px] px-4 py-3 text-sm font-medium transition",
                  mode === item ? "bg-[#d7ff1f] text-black" : "text-white/72"
                ].join(" ")}
              >
                {item === "image" ? "Image" : "Video"}
              </button>
            ))}
          </div>

          <select
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value)}
            className="rounded-[18px] border border-white/8 bg-white/5 px-4 py-3 text-sm outline-none"
          >
            {models.map((model) => (
              <option key={model} value={model} className="text-black">
                {model}
              </option>
            ))}
          </select>

          <select
            value={ratio}
            onChange={(event) => setRatio(event.target.value)}
            className="rounded-[18px] border border-white/8 bg-white/5 px-4 py-3 text-sm outline-none"
          >
            {ratios.map((item) => (
              <option key={item} value={item} className="text-black">
                {item}
              </option>
            ))}
          </select>

          <select
            value={quality}
            onChange={(event) => setQuality(event.target.value)}
            className="rounded-[18px] border border-white/8 bg-white/5 px-4 py-3 text-sm outline-none"
          >
            {qualityOptions.map((item) => (
              <option key={item} value={item} className="text-black">
                {item}
              </option>
            ))}
          </select>

          <select
            value={batch}
            onChange={(event) => setBatch(event.target.value)}
            className="rounded-[18px] border border-white/8 bg-white/5 px-4 py-3 text-sm outline-none"
          >
            {batchOptions.map((item) => (
              <option key={item} value={item} className="text-black">
                {item}
              </option>
            ))}
          </select>

          <button
            onClick={handleGenerate}
            className="ml-auto rounded-[20px] bg-[#d7ff1f] px-6 py-3 text-sm font-semibold text-black transition hover:brightness-95"
          >
            Generate
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="panel overflow-hidden rounded-[34px]">
          <div className="border-b border-black/8 px-6 py-4">
            <p className="text-sm text-black/45">Generator</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {mode === "image" ? "Describe the image" : "Describe the video"}
            </h2>
          </div>
          <div className="p-6">
            <div className="rounded-[28px] border border-[#dce2ef] bg-white p-5">
              <p className="text-sm text-black/42">
                Prompt
              </p>
              <p className="mt-3 text-lg leading-8 text-black/72">
                {mode === "image"
                  ? "Premium product scene with controlled reflections, sculpted natural light, elegant material detail, and a restrained editorial composition."
                  : "Luxury product reveal with a slow forward push, clean highlight motion, soft environmental reflections, and stable premium pacing."}
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <InfoCard label="Mode" value={mode === "image" ? "Image generation" : "Video generation"} />
              <InfoCard label="Model" value={selectedModel} />
              <InfoCard label="Aspect ratio" value={ratio} />
              <InfoCard label="Quality / Batch" value={`${quality} · ${batch}`} />
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
                  {running ? "Live" : "Idle"}
                </div>
              </div>

              <div className="mt-6 grid min-h-[420px] grid-cols-[1fr_260px] gap-0 overflow-hidden rounded-[26px] border border-black/8 bg-white">
                <div className="grid-fade relative p-8">
                  <div className="absolute left-10 top-6 rounded-full bg-[#dff9ea] px-3 py-1 text-xs font-medium text-[#23945d]">
                    Run #128
                  </div>
                  <div className="mx-auto mt-16 max-w-[420px] space-y-10">
                    {workflowStages.map((stage, index) => {
                      const active = running && index < workflowStages.length;
                      return (
                        <motion.div
                          key={stage.title}
                          initial={{ opacity: 0.6, y: 8 }}
                          animate={{
                            opacity: running ? 1 : 0.86,
                            y: 0
                          }}
                          transition={{ delay: index * 0.18 }}
                          className="relative"
                        >
                          {index < workflowStages.length - 1 ? (
                            <motion.div
                              className="absolute left-6 top-[88px] h-16 w-px bg-[#6be29c]"
                              animate={{
                                opacity: running ? [0.25, 1, 0.25] : 0.18
                              }}
                              transition={{
                                repeat: running ? Number.POSITIVE_INFINITY : 0,
                                duration: 1.4,
                                delay: index * 0.2
                              }}
                            />
                          ) : null}

                          <motion.div
                            className="rounded-[24px] border border-[#9de7ba] bg-white px-5 py-4 shadow-[0_14px_40px_rgba(60,80,80,0.05)]"
                            animate={{
                              boxShadow: running
                                ? [
                                    "0 14px 40px rgba(60,80,80,0.05)",
                                    "0 18px 44px rgba(77, 222, 133, 0.16)",
                                    "0 14px 40px rgba(60,80,80,0.05)"
                                  ]
                                : "0 14px 40px rgba(60,80,80,0.05)"
                            }}
                            transition={{
                              repeat: running ? Number.POSITIVE_INFINITY : 0,
                              duration: 1.6,
                              delay: index * 0.18
                            }}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <p className="font-medium">{stage.title}</p>
                              <span className="rounded-full bg-[#e8fff0] px-3 py-1 text-xs text-[#23945d]">
                                {running
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
                      );
                    })}
                  </div>
                </div>

                <div className="border-l border-black/8 bg-[#fcfcfa]">
                  <div className="border-b border-black/8 px-4 py-4">
                    <p className="text-lg font-semibold tracking-tight">
                      Recent runs
                    </p>
                  </div>
                  <div className="space-y-1 px-3 py-3">
                    {[
                      "Run #128",
                      "Run #127",
                      "Run #126",
                      "Run #125",
                      "Run #124"
                    ].map((run, index) => (
                      <div
                        key={run}
                        className="flex items-center justify-between rounded-[18px] px-3 py-3 hover:bg-white"
                      >
                        <div>
                          <p className="font-medium">{run}</p>
                          <p className="text-sm text-black/45">
                            {index === 0 && running
                              ? "Executing now"
                              : `Completed ${index + 1} min ago`}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#edf7ef] px-2 py-1 text-xs text-[#23945d]">
                          {index === 0 && running ? "Live" : "Done"}
                        </span>
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
              The model list includes local Dreamora engines and hosted external
              APIs. If a provider is not configured, the setup page prompts for
              the missing API key or auth details before execution.
            </p>
          </div>

          <div className="panel rounded-[34px] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-black/45">Execution note</p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight">
                  Minimal parameter design
                </h3>
              </div>
              <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-xs text-black/55">
                Intentional
              </span>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-black/58">
              <p>
                Image generation uses only model, aspect ratio, quality, and
                batch size.
              </p>
              <p>
                Video generation uses only model, aspect ratio, and quality.
              </p>
              <p>
                Everything else belongs in provider defaults or workflow logic,
                not in the day-to-day interface.
              </p>
            </div>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {running ? (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className="fixed bottom-5 right-5 rounded-[22px] border border-black/8 bg-white px-5 py-4 shadow-[0_20px_70px_rgba(28,34,48,0.15)]"
          >
            <p className="font-medium">Generation in progress</p>
            <p className="mt-1 text-sm text-black/56">
              Routing model, processing output, and collecting usage data.
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
