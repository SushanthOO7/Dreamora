import { CardGrid } from "../../components/workspace-cards";
import { CreatePromptForm } from "../../components/stage3-actions";
import { WorkspaceShell } from "../../components/workspace-shell";
import { getPrompts } from "../../lib/api";

export default async function PromptsPage() {
  const promptPresets = await getPrompts();

  return (
    <WorkspaceShell
      title="Prompt Library"
      description="Save reusable prompt structures, reference-driven templates, and retrieval-assisted preflight recipes."
    >
      <CreatePromptForm />
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
