import {
  modelRecommendations,
  orchestrationStrategy
} from "@dreamora/shared";
import { CardGrid } from "../../components/workspace-cards";
import { WorkspaceShell } from "../../components/workspace-shell";

export default function ModelsPage() {
  return (
    <WorkspaceShell
      title="Models"
      description="Review the current image, video, and orchestration choices tuned for your single-server V100 setup."
    >
      <CardGrid
        items={modelRecommendations.map((model) => ({
          title: model.name,
          eyebrow: model.role,
          body: model.summary,
          meta: model.tags
        }))}
      />

      <div className="panel rounded-[32px] px-6 py-6">
        <p className="text-xs uppercase tracking-[0.22em] text-black/35">
          Strategy snapshot
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[26px] border border-black/8 bg-white/80 p-4">
            <p className="text-sm text-black/45">Image path</p>
            <p className="mt-2 font-medium">{orchestrationStrategy.gpuStrategy.image}</p>
          </div>
          <div className="rounded-[26px] border border-black/8 bg-white/80 p-4">
            <p className="text-sm text-black/45">Video path</p>
            <p className="mt-2 font-medium">{orchestrationStrategy.gpuStrategy.video}</p>
          </div>
          <div className="rounded-[26px] border border-black/8 bg-white/80 p-4">
            <p className="text-sm text-black/45">Acceleration</p>
            <p className="mt-2 font-medium">{orchestrationStrategy.gpuStrategy.cache}</p>
          </div>
          <div className="rounded-[26px] border border-black/8 bg-white/80 p-4">
            <p className="text-sm text-black/45">Long video</p>
            <p className="mt-2 font-medium">{orchestrationStrategy.gpuStrategy.longVideo}</p>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
