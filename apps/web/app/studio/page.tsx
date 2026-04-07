import { WorkspaceShell } from "../../components/workspace-shell";
import { StudioWorkbench } from "../../components/studio-workbench";

export default function StudioPage() {
  return (
    <WorkspaceShell
      title="Generation Studio"
      description="A minimal production surface for image and video generation, with provider-aware models and a live workflow execution view."
    >
      <StudioWorkbench />
    </WorkspaceShell>
  );
}
