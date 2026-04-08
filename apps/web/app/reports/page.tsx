import { WorkspaceShell } from "../../components/workspace-shell";
import { getUsageReporting } from "../../lib/api";
import { ReportsContent } from "../../components/reports-content";

export default async function ReportsPage() {
  const { metrics: usageMetrics, breakdown: modelUsageBreakdown, weekly: weeklyUsageSeries } =
    await getUsageReporting();

  return (
    <WorkspaceShell
      title="Business Metrics"
      description="Overview of your generation pipeline, model usage, and weekly activity."
      actions={
        <>
          <button className="rounded-full border border-[var(--line)] bg-white/60 px-4 py-2 text-xs font-medium text-[var(--foreground)]/55 transition hover:bg-white/80">
            Refresh data
          </button>
          <button className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white transition hover:opacity-90">
            Add report
          </button>
        </>
      }
    >
      <ReportsContent
        usageMetrics={usageMetrics}
        modelUsageBreakdown={modelUsageBreakdown}
        weeklyUsageSeries={weeklyUsageSeries}
      />
    </WorkspaceShell>
  );
}
