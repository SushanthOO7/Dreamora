import path from "node:path";
import { existsSync } from "node:fs";
import dotenv from "dotenv";

function candidateEnvPaths(): string[] {
  const cwd = process.cwd();
  const direct = path.join(cwd, ".env");
  const apiLocal = path.join(cwd, "apps", "api", ".env");

  if (path.basename(cwd) === "api") {
    return [direct, path.join(cwd, "..", "..", ".env")];
  }

  return [apiLocal, direct];
}

for (const envPath of candidateEnvPaths()) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export type AppConfig = {
  comfyEnabled: boolean;
  comfyUrl: string;
  imageWorkflowPath: string | null;
  videoWorkflowPath: string | null;
  defaultImageModel: string;
  defaultVideoModel: string;
  port: number;
  host: string;
  corsOrigin: string | true;
};

export function getAppConfig(): AppConfig {
  return {
    comfyEnabled: process.env.COMFY_ENABLED === "1",
    comfyUrl: process.env.COMFYUI_URL ?? "http://127.0.0.1:8188",
    imageWorkflowPath:
      process.env.COMFY_IMAGE_WORKFLOW_PATH ??
      process.env.COMFY_WORKFLOW_PATH ??
      null,
    videoWorkflowPath:
      process.env.COMFY_VIDEO_WORKFLOW_PATH ??
      process.env.COMFY_WORKFLOW_PATH ??
      null,
    defaultImageModel:
      process.env.DEFAULT_IMAGE_MODEL ?? "sd_xl_base_1.0.safetensors",
    defaultVideoModel:
      process.env.DEFAULT_VIDEO_MODEL ?? "wan2.2_ti2v_5B_fp16.safetensors",
    port: Number(process.env.PORT ?? 8787),
    host: process.env.HOST ?? "0.0.0.0",
    corsOrigin: process.env.CORS_ORIGIN ?? true
  };
}
