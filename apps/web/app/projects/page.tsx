import { CreateProjectForm, ProjectLibraryList } from "../../components/stage3-actions";
import { WorkspaceShell } from "../../components/workspace-shell";
import { getProjects } from "../../lib/api";

export default async function ProjectsPage() {
  const projectSummaries = await getProjects();

  return (
    <WorkspaceShell
      title="Projects"
      description="Organize generation work by campaign, concept, or client so prompts, references, and outputs stay connected."
    >
      <CreateProjectForm />
      <ProjectLibraryList projects={projectSummaries} />
    </WorkspaceShell>
  );
}
