import { WorkspaceShell } from "../../components/workspace-shell";
import { StudioWorkbench } from "../../components/studio-workbench";
import { getPrompts, getProviders, getRuns } from "../../lib/api";

export default async function StudioPage() {
  const [providers, runs, prompts] = await Promise.all([
    getProviders(),
    getRuns(),
    getPrompts()
  ]);

  return (
    <WorkspaceShell
      title="Generation Studio"
      description="A minimal production surface for image and video generation, with provider-aware models and a live workflow execution view."
    >
      <StudioWorkbench
        providers={providers}
        initialRuns={runs}
        promptPresets={prompts}
      />
    </WorkspaceShell>
  );
}
