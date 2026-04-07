import type {
  DashboardResponse,
  ModelRecommendation
} from "@dreamora/shared";

const navigation = [
  "Overview",
  "Workflows",
  "Models",
  "Automations"
];

type ShellProps = {
  dashboard: DashboardResponse;
  recommendations: ModelRecommendation[];
};

function Pill({
  children,
  tone = "default"
}: {
  children: React.ReactNode;
  tone?: "default" | "success";
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-black/10 bg-white/80 text-black/70"
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export function Shell({ dashboard, recommendations }: ShellProps) {
  return (
    <main className="min-h-screen">
      <div className="grid-fade fixed inset-0 opacity-60" />
      <div className="relative mx-auto max-w-[1440px] px-6 pb-12 pt-5 md:px-8">
        <header className="panel flex items-center justify-between rounded-full px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black text-sm font-semibold text-white">
              D
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Dreamora</p>
              <p className="text-xs text-black/45">
                Personal AI generation command center
              </p>
            </div>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-black/65 md:flex">
            {navigation.map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`}>
                {item}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium">
              Sync Cluster
            </button>
            <button className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white">
              New Run
            </button>
          </div>
        </header>

        <section
          id="overview"
          className="grid gap-8 px-2 pb-14 pt-16 lg:grid-cols-[1.05fr_0.95fr]"
        >
          <div className="max-w-3xl">
            <Pill>V100-optimized orchestration</Pill>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.05em] text-black md:text-7xl">
              Create better image and video output with fewer manual steps.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-black/62">
              Dreamora is built around the generation workflow that actually
              works on a V100 32GB: draft in FLUX, animate with Wan 2.2,
              accelerate with TeaCache, and finish with upscale and review.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button className="rounded-full bg-black px-5 py-3 text-sm font-medium text-white">
                Start workflow
              </button>
              <button className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium">
                Review architecture
              </button>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {dashboard.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="panel rounded-[28px] px-5 py-5"
                >
                  <p className="text-sm text-black/45">{metric.label}</p>
                  <p className="mt-4 text-3xl font-semibold tracking-tight">
                    {metric.value}
                  </p>
                  <p className="mt-2 text-sm text-black/55">{metric.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel rounded-[34px] p-4">
            <div className="rounded-[28px] border border-black/8 bg-white/80">
              <div className="flex items-center justify-between border-b border-black/6 px-5 py-4">
                <div>
                  <p className="text-sm text-black/45">Live orchestration</p>
                  <h2 className="text-xl font-semibold tracking-tight">
                    Generation workspace
                  </h2>
                </div>
                <Pill tone="success">Active</Pill>
              </div>
              <div className="grid grid-cols-[220px_1fr]">
                <aside className="border-r border-black/6 px-4 py-4">
                  <div className="rounded-2xl border border-black/8 bg-[#f6f7f9] p-3 text-sm text-black/70">
                    Quick Actions
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    {dashboard.sidebar.map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl px-3 py-2 text-black/70 transition hover:bg-black/5"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </aside>
                <div className="px-5 py-5">
                  <div className="rounded-[26px] border border-black/8 bg-[#fcfcfb] p-5">
                    <p className="text-sm text-black/45">Today</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                      Good evening, creator.
                    </h3>
                    <div className="mt-5 rounded-[24px] border border-[#d7ddeb] bg-white px-4 py-4">
                      <p className="text-sm text-black/45">
                        Active prompt studio
                      </p>
                      <p className="mt-3 max-w-2xl text-lg leading-8 text-black/72">
                        Build a cinematic product teaser with crisp lighting,
                        restrained camera motion, subtle depth of field, and a
                        clean luxury composition.
                      </p>
                    </div>
                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                      {dashboard.pipeline.map((stage) => (
                        <div
                          key={stage.name}
                          className="rounded-[24px] border border-black/8 bg-white p-4"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{stage.name}</p>
                            <Pill
                              tone={
                                stage.status === "Ready" ? "success" : "default"
                              }
                            >
                              {stage.status}
                            </Pill>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-black/55">
                            {stage.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="workflows"
          className="grid gap-px overflow-hidden rounded-[36px] border border-black/8 bg-black/8 lg:grid-cols-[0.75fr_1.25fr_0.8fr]"
        >
          <div className="bg-white/82 p-10">
            <p className="text-sm uppercase tracking-[0.22em] text-black/35">
              Workflow
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">
              Automate draft to final delivery.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-black/62">
              The product flow is tuned for your hardware: generate stills in
              FLUX, animate in Wan 2.2 5B, optionally extend with FramePack,
              then upscale with SeedVR2 or Real-ESRGAN.
            </p>
          </div>
          <div className="bg-[#fbfbf8] p-8">
            <div className="grid-fade rounded-[30px] border border-black/8 bg-white/65 p-8">
              {dashboard.workflow.map((node, index) => (
                <div key={node.title} className="relative pb-8 last:pb-0">
                  {index < dashboard.workflow.length - 1 ? (
                    <span className="absolute left-[15px] top-9 h-[calc(100%-8px)] w-px bg-emerald-300" />
                  ) : null}
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-black text-xs font-semibold text-white">
                      {index + 1}
                    </div>
                    <div className="w-full rounded-[26px] border border-black/8 bg-white px-5 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-lg font-medium">{node.title}</p>
                          <p className="mt-1 text-sm text-black/52">
                            {node.subtitle}
                          </p>
                        </div>
                        <Pill tone={node.state === "Recommended" ? "success" : "default"}>
                          {node.state}
                        </Pill>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white/82 p-8">
            <p className="text-sm uppercase tracking-[0.22em] text-black/35">
              Engine picks
            </p>
            <div className="mt-4 space-y-4">
              {recommendations.map((model) => (
                <div
                  key={model.name}
                  className="rounded-[28px] border border-black/8 bg-[#f7f6f2] p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold">{model.name}</h3>
                    <Pill>{model.role}</Pill>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-black/60">
                    {model.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {model.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-white px-3 py-1 text-xs text-black/58"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="models"
          className="grid gap-6 px-2 py-14 lg:grid-cols-[1fr_1fr]"
        >
          <div className="panel rounded-[34px] p-8">
            <p className="text-sm uppercase tracking-[0.22em] text-black/35">
              Decision
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">
              Recommended model stack for your V100.
            </h2>
            <div className="mt-6 space-y-5 text-base leading-7 text-black/64">
              <p>
                FLUX is the image-first creative engine because prompt fidelity,
                typography, and GGUF efficiency are the strongest fit for your
                GPU.
              </p>
              <p>
                Wan 2.2 5B is the default video engine because it fits in FP16
                on 32GB and works cleanly with TeaCache, block offload, and
                post-upscale pipelines.
              </p>
              <p>
                LTX remains a secondary option for narrative motion or research
                experimentation, not the default production path on Volta.
              </p>
            </div>
          </div>
          <div className="panel rounded-[34px] p-8">
            <p className="text-sm uppercase tracking-[0.22em] text-black/35">
              Knowledge
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">
              RAG and MCP where they actually help.
            </h2>
            <div className="mt-6 space-y-5 text-base leading-7 text-black/64">
              <p>
                RAG is useful for prompt memory, reusable shot recipes, style
                packs, reference boards, prior runs, and technical guidance. It
                is not needed in the critical generation path itself.
              </p>
              <p>
                MCP is valuable if you want an assistant layer to inspect
                workflows, submit ComfyUI jobs, score outputs, and chain
                revisions without living inside the visual graph editor.
              </p>
              <p>
                The first version should ship with a direct API orchestration
                layer and stay MCP-ready rather than depending on MCP from day
                one.
              </p>
            </div>
          </div>
        </section>

        <section
          id="automations"
          className="panel rounded-[38px] p-8 md:p-10"
        >
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-black/35">
                System design
              </p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">
                Built for productivity instead of isolated generations.
              </h2>
              <p className="mt-6 max-w-xl text-base leading-7 text-black/62">
                This app treats generation like work: presets, project memory,
                reusable references, review queues, and orchestration settings
                are first-class features so output quality improves over time.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {dashboard.capabilities.map((capability) => (
                <div
                  key={capability.title}
                  className="rounded-[28px] border border-black/8 bg-white p-5"
                >
                  <p className="text-lg font-medium">{capability.title}</p>
                  <p className="mt-3 text-sm leading-6 text-black/56">
                    {capability.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
