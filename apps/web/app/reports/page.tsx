import { modelUsageBreakdown, usageMetrics, weeklyUsageSeries } from "@dreamora/shared";
import { WorkspaceShell } from "../../components/workspace-shell";

export default function ReportsPage() {
  const total = modelUsageBreakdown.reduce((sum, item) => sum + item.value, 0);

  return (
    <WorkspaceShell
      title="Reports"
      description="Track model usage, token consumption, and weekly generation activity with a reporting surface tuned to your creative workflow."
    >
      <div className="grid gap-5 xl:grid-cols-4">
        {usageMetrics.map((metric) => (
          <div key={metric.label} className="panel rounded-[30px] p-5">
            <p className="text-sm text-black/45">{metric.label}</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight">{metric.value}</p>
            <p className="mt-3 text-sm leading-6 text-black/56">{metric.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <section className="panel rounded-[32px] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black/45">Weekly activity</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                Generation volume
              </h2>
            </div>
            <div className="rounded-full border border-black/8 bg-white px-3 py-1 text-xs text-black/58">
              Last 7 days
            </div>
          </div>
          <div className="mt-8 flex h-[320px] items-end gap-4 rounded-[26px] border border-black/8 bg-white/70 px-5 pb-5 pt-10">
            {weeklyUsageSeries.map((item) => (
              <div key={item.label} className="flex flex-1 flex-col items-center gap-3">
                <div className="flex h-full w-full items-end">
                  <div
                    className="w-full rounded-t-[18px]"
                    style={{
                      height: `${item.value}%`,
                      background: item.color
                    }}
                  />
                </div>
                <div className="text-sm text-black/55">{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel rounded-[32px] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black/45">Model usage</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                Engine mix
              </h2>
            </div>
            <div className="rounded-full border border-black/8 bg-white px-3 py-1 text-xs text-black/58">
              By completions
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center">
            <div
              className="relative h-[280px] w-[280px] rounded-full"
              style={{
                background: `conic-gradient(${modelUsageBreakdown
                  .map((item, index, arr) => {
                    const start =
                      arr
                        .slice(0, index)
                        .reduce((sum, part) => sum + part.value, 0) / total * 360;
                    const end =
                      arr
                        .slice(0, index + 1)
                        .reduce((sum, part) => sum + part.value, 0) / total * 360;
                    return `${item.color} ${start}deg ${end}deg`;
                  })
                  .join(", ")})`
              }}
            >
              <div className="absolute inset-[52px] rounded-full bg-[#f5f3ef]" />
            </div>
          </div>

          <div className="mt-8 space-y-3">
            {modelUsageBreakdown.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-[20px] border border-black/8 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: item.color }}
                  />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <span className="text-sm text-black/58">{item.value}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
