import { CardGrid } from "../../components/workspace-cards";
import { WorkspaceShell } from "../../components/workspace-shell";
import { getProjects } from "../../lib/api";

export default async function ProjectsPage() {
  const projectSummaries = await getProjects();

  return (
    <WorkspaceShell
      title="Projects"
      description="Organize generation work by campaign, concept, or client so prompts, references, and outputs stay connected."
    >
      <CardGrid
        items={projectSummaries.map((project) => ({
          title: project.name,
          eyebrow: project.status,
          body: project.summary,
          meta: [project.format, `Updated ${project.updatedAt}`]
        }))}
      />
    </WorkspaceShell>
  );
}
