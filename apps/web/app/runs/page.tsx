import { runSummaries } from "@dreamora/shared";
import { DataTable } from "../../components/workspace-cards";
import { WorkspaceShell } from "../../components/workspace-shell";

export default function RunsPage() {
  return (
    <WorkspaceShell
      title="Runs"
      description="Track every generation pass from draft stills to video motion and upscale jobs."
    >
      <DataTable
        columns={["Run", "Engine", "Status", "Output"]}
        rows={runSummaries.map((run) => [
          `${run.title} · ${run.duration}`,
          run.engine,
          run.status,
          run.output
        ])}
      />
    </WorkspaceShell>
  );
}
