import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createComfyOrSimulatedJob } from "./generation.js";

type PromptNode = {
  class_type: string;
  inputs: Record<string, unknown>;
};

function isApiPromptWorkflow(value: unknown): value is Record<string, PromptNode> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return false;
  }

  return entries.every(([key, node]) => {
    if (!/^\d+$/.test(key)) {
      return false;
    }
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      return false;
    }

    const candidate = node as Record<string, unknown>;
    return (
      typeof candidate.class_type === "string" &&
      !!candidate.inputs &&
      typeof candidate.inputs === "object" &&
      !Array.isArray(candidate.inputs)
    );
  });
}

test("video workflow is Comfy API prompt JSON", async () => {
  const workflowPath = path.join(process.cwd(), "apps", "api", "workflows", "comfy-video-template.json");
  const rawTemplate = await readFile(workflowPath, "utf8");
  const raw = rawTemplate
    .replaceAll("__WIDTH__", "1280")
    .replaceAll("__HEIGHT__", "720")
    .replaceAll("__STEPS__", "20")
    .replaceAll("__SEED__", "1");
  const parsed = JSON.parse(raw) as unknown;

  assert.equal(
    isApiPromptWorkflow(parsed),
    true,
    "Video workflow must be API prompt JSON (node-id keyed), not UI graph JSON."
  );
});

test("video generation does not silently fallback when Comfy submission fails", async () => {
  const previous = {
    COMFY_ENABLED: process.env.COMFY_ENABLED,
    COMFY_VIDEO_WORKFLOW_PATH: process.env.COMFY_VIDEO_WORKFLOW_PATH
  };

  try {
    process.env.COMFY_ENABLED = "1";
    process.env.COMFY_VIDEO_WORKFLOW_PATH = "workflows/does-not-exist.json";

    await assert.rejects(
      () =>
        createComfyOrSimulatedJob("run_test_video", {
          mode: "video",
          prompt: "test prompt",
          model: "wan2.2_ti2v_5B_fp16.safetensors",
          aspectRatio: "16:9",
          quality: "Standard",
          batchSize: 1
        }),
      /workflow|submit|ENOENT|not configured/i
    );
  } finally {
    if (previous.COMFY_ENABLED === undefined) {
      delete process.env.COMFY_ENABLED;
    } else {
      process.env.COMFY_ENABLED = previous.COMFY_ENABLED;
    }

    if (previous.COMFY_VIDEO_WORKFLOW_PATH === undefined) {
      delete process.env.COMFY_VIDEO_WORKFLOW_PATH;
    } else {
      process.env.COMFY_VIDEO_WORKFLOW_PATH = previous.COMFY_VIDEO_WORKFLOW_PATH;
    }
  }
});
