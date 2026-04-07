import cors from "@fastify/cors";
import Fastify from "fastify";
import {
  dashboardResponse,
  modelUsageBreakdown,
  modelRecommendations,
  orchestrationStrategy,
  providerConfigs,
  usageMetrics,
  weeklyUsageSeries
} from "@dreamora/shared";

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: true
});

app.get("/health", async () => ({
  ok: true
}));

app.get("/api/dashboard", async () => dashboardResponse);

app.get("/api/models/recommendations", async () => modelRecommendations);

app.get("/api/strategy", async () => orchestrationStrategy);

app.get("/api/providers", async () => providerConfigs);

app.get("/api/reporting/usage", async () => ({
  metrics: usageMetrics,
  breakdown: modelUsageBreakdown,
  weekly: weeklyUsageSeries
}));

app.get("/api/jobs/templates", async () => ({
  templates: [
    {
      id: "flux-image",
      label: "FLUX still image",
      engine: "flux",
      summary: "Best default for high-quality still generation on V100."
    },
    {
      id: "wan-video",
      label: "Wan 2.2 video",
      engine: "wan",
      summary: "Animate a keyframe into 480p video, then upscale."
    },
    {
      id: "review-loop",
      label: "Prompt refinement loop",
      engine: "assistant",
      summary: "Use retrieval and scoring to improve prompts before spending GPU time."
    }
  ]
}));

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
