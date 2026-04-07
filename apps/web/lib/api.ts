import type {
  DashboardResponse,
  ModelRecommendation
} from "@dreamora/shared";
import {
  dashboardResponse,
  modelRecommendations
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
