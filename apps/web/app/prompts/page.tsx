import { promptPresets } from "@dreamora/shared";
import { CardGrid } from "../../components/workspace-cards";
import { WorkspaceShell } from "../../components/workspace-shell";

export default function PromptsPage() {
  return (
    <WorkspaceShell
      title="Prompt Library"
      description="Save reusable prompt structures, reference-driven templates, and retrieval-assisted preflight recipes."
    >
      <CardGrid
        items={promptPresets.map((preset) => ({
          title: preset.title,
          eyebrow: `${preset.engine} · ${preset.type}`,
          body: preset.summary,
          meta: preset.tags
        }))}
      />
    </WorkspaceShell>
  );
}
