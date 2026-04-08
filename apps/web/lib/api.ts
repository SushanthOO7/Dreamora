import type {
  DashboardResponse,
  ModelRecommendation,
  ProjectSummary,
  PromptPreset,
  RunSummary,
  ProviderConfig,
  UsageMetric,
  UsageSeries
} from "@dreamora/shared";
import {
  dashboardResponse,
  modelRecommendations,
  modelUsageBreakdown,
  projectSummaries,
  promptPresets,
  providerConfigs,
  runSummaries,
  usageMetrics,
  weeklyUsageSeries
} from "@dreamora/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

async function getJson<T>(path: string): Promise<T> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      next: { revalidate: 60 }
    });

    if (!response.ok) {
      throw new Error(`Request failed for ${path}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (path === "/api/dashboard") {
      return dashboardResponse as T;
    }

    if (path === "/api/models/recommendations") {
      return modelRecommendations as T;
    }

    throw error;
  }
}

export function getDashboard(): Promise<DashboardResponse> {
  return getJson<DashboardResponse>("/api/dashboard");
}

export function getRecommendations(): Promise<ModelRecommendation[]> {
  return getJson<ModelRecommendation[]>("/api/models/recommendations");
}

export function getProviders(): Promise<ProviderConfig[]> {
  return getJson<ProviderConfig[]>("/api/providers").catch(
    () => providerConfigs
  );
}

export function getUsageReporting(): Promise<{
  metrics: UsageMetric[];
  breakdown: UsageSeries[];
  weekly: UsageSeries[];
}> {
  return getJson<{
    metrics: UsageMetric[];
    breakdown: UsageSeries[];
    weekly: UsageSeries[];
  }>("/api/reporting/usage").catch(() => ({
    metrics: usageMetrics,
    breakdown: modelUsageBreakdown,
    weekly: weeklyUsageSeries
  }));
}

export function getProjects(): Promise<ProjectSummary[]> {
  return getJson<ProjectSummary[]>("/api/projects").catch(() => projectSummaries);
}

export function getPrompts(): Promise<PromptPreset[]> {
  return getJson<PromptPreset[]>("/api/prompts").catch(() => promptPresets);
}

export function getRuns(): Promise<RunSummary[]> {
  return getJson<RunSummary[]>("/api/runs").catch(() => runSummaries);
}
