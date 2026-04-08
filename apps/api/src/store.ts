import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  projectSummaries,
  promptPresets,
  providerConfigs,
  runSummaries
} from "@dreamora/shared";

const STORE_VERSION = 2;

type StoredProject = {
  id: string;
  name: string;
  format: string;
  status: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
};

type StoredPrompt = {
  id: string;
  title: string;
  engine: string;
  type: string;
  summary: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type StoredRun = {
  id: string;
  title: string;
  engine: string;
  mode: "image" | "video";
  status: string;
  duration: string;
  output: string;
  tokensUsed: number;
  promptExcerpt?: string;
  aspectRatio?: string;
  quality?: "Standard" | "High" | "Ultra";
  batchSize?: number;
  backend?: "comfy" | "simulated";
  score?: number;
  scoreNotes?: string;
  createdAt: string;
  updatedAt: string;
};

type StoredProvider = {
  id: string;
  name: string;
  category: string;
  status: string;
  auth: string;
  defaultModel: string;
  note: string;
  secretConfigured: boolean;
  secretHint: string | null;
  createdAt: string;
  updatedAt: string;
};

type StoreSchema = {
  version: number;
  projects: StoredProject[];
  prompts: StoredPrompt[];
  runs: StoredRun[];
  providers: StoredProvider[];
};

let storeCache: StoreSchema | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let initPromise: Promise<void> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function resolveDataPath(): string {
  const cwd = process.cwd();
  if (path.basename(cwd) === "api") {
    return path.join(cwd, "data", "store.json");
  }

  return path.join(cwd, "apps", "api", "data", "store.json");
}

function seedStore(): StoreSchema {
  const created = nowIso();

  return {
    version: STORE_VERSION,
    projects: projectSummaries.map((project, index) => ({
      id: `project_${index + 1}`,
      name: project.name,
      format: project.format,
      status: project.status,
      summary: project.summary,
      createdAt: created,
      updatedAt: created
    })),
    prompts: promptPresets.map((preset, index) => ({
      id: `prompt_${index + 1}`,
      title: preset.title,
      engine: preset.engine,
      type: preset.type,
      summary: preset.summary,
      tags: preset.tags,
      createdAt: created,
      updatedAt: created
    })),
    runs: runSummaries.map((run, index) => ({
      id: `run_${index + 1}`,
      title: run.title,
      engine: run.engine,
      mode: index % 2 === 0 ? "image" : "video",
      status: run.status,
      duration: run.duration,
      output: run.output,
      tokensUsed: 12000 + index * 3500,
      promptExcerpt: index % 2 === 0 ? "studio seed image prompt" : "studio seed video prompt",
      aspectRatio: index % 2 === 0 ? "1:1" : "16:9",
      quality: index % 2 === 0 ? "High" : "Standard",
      batchSize: index % 2 === 0 ? 2 : 1,
      backend: "simulated",
      createdAt: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: created
    })),
    providers: providerConfigs.map((provider, index) => ({
      id: `provider_${index + 1}`,
      name: provider.name,
      category: provider.category,
      status: provider.status,
      auth: provider.auth,
      defaultModel: provider.defaultModel,
      note: provider.note,
      secretConfigured: provider.status === "Connected",
      secretHint: provider.status === "Connected" ? "configured" : null,
      createdAt: created,
      updatedAt: created
    }))
  };
}

function migrateStore(data: Record<string, unknown>): StoreSchema {
  const version = typeof data.version === "number" ? data.version : 1;

  if (version < 2) {
    data.version = STORE_VERSION;
  }

  return data as StoreSchema;
}

async function writeStore(data: StoreSchema): Promise<void> {
  const dataPath = resolveDataPath();
  await mkdir(path.dirname(dataPath), { recursive: true });
  await writeFile(dataPath, JSON.stringify(data, null, 2), "utf8");
}

export async function initStore(): Promise<void> {
  if (storeCache) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    if (storeCache) {
      return;
    }

    const dataPath = resolveDataPath();
    try {
      const raw = await readFile(dataPath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      storeCache = migrateStore(parsed);

      if ((parsed.version as number) < STORE_VERSION) {
        await writeStore(storeCache);
      }
    } catch (error) {
      const isNotFound =
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT";

      if (!isNotFound) {
        console.warn(
          "Could not read existing store, creating fresh:",
          error instanceof Error ? error.message : error
        );
      }

      storeCache = seedStore();
      await writeStore(storeCache);
    }
  })();

  await initPromise;
}

async function persist(): Promise<void> {
  if (!storeCache) {
    throw new Error("Store not initialized");
  }

  writeQueue = writeQueue.then(async () => {
    await writeStore(storeCache as StoreSchema);
  });

  await writeQueue;
}

export function getStore(): StoreSchema {
  if (!storeCache) {
    throw new Error("Store not initialized");
  }

  return storeCache;
}

export async function createProject(input: {
  name: string;
  format: string;
  status: string;
  summary: string;
}): Promise<StoredProject> {
  const store = getStore();
  const record: StoredProject = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  store.projects.unshift(record);
  await persist();
  return record;
}

export async function createPrompt(input: {
  title: string;
  engine: string;
  type: string;
  summary: string;
  tags: string[];
}): Promise<StoredPrompt> {
  const store = getStore();
  const record: StoredPrompt = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  store.prompts.unshift(record);
  await persist();
  return record;
}

export async function createRun(input: {
  title: string;
  engine: string;
  mode: "image" | "video";
  status: string;
  duration: string;
  output: string;
  tokensUsed: number;
  promptExcerpt?: string;
  aspectRatio?: string;
  quality?: "Standard" | "High" | "Ultra";
  batchSize?: number;
  backend?: "comfy" | "simulated";
}): Promise<StoredRun> {
  const store = getStore();
  const record: StoredRun = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  store.runs.unshift(record);
  await persist();
  return record;
}

export async function createProvider(input: {
  name: string;
  category: string;
  auth: string;
  defaultModel: string;
  note: string;
}): Promise<StoredProvider> {
  const store = getStore();
  const record: StoredProvider = {
    id: crypto.randomUUID(),
    ...input,
    status: "Needs key",
    secretConfigured: false,
    secretHint: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  store.providers.push(record);
  await persist();
  return record;
}

export async function updateProviderCredentials(
  id: string,
  configured: boolean,
  secretHint?: string
): Promise<StoredProvider> {
  const store = getStore();
  const provider = store.providers.find((item) => item.id === id);

  if (!provider) {
    throw new Error("Provider not found");
  }

  provider.secretConfigured = configured;
  provider.secretHint = secretHint ?? null;
  provider.updatedAt = nowIso();
  await persist();
  return provider;
}

export async function updateRunStatus(
  id: string,
  status: string,
  duration?: string
): Promise<StoredRun> {
  const store = getStore();
  const run = store.runs.find((item) => item.id === id);

  if (!run) {
    throw new Error("Run not found");
  }

  run.status = status;
  if (duration) {
    run.duration = duration;
  }
  run.updatedAt = nowIso();
  await persist();
  return run;
}

export async function updateRunFields(
  id: string,
  fields: Partial<
    Pick<
      StoredRun,
      "status" | "duration" | "output" | "tokensUsed" | "backend" | "promptExcerpt" | "aspectRatio" | "quality" | "batchSize" | "score" | "scoreNotes"
    >
  >
): Promise<StoredRun> {
  const store = getStore();
  const run = store.runs.find((item) => item.id === id);

  if (!run) {
    throw new Error("Run not found");
  }

  const updatable: Array<keyof typeof fields> = [
    "status", "duration", "output", "backend", "promptExcerpt", "aspectRatio", "quality", "scoreNotes"
  ];

  for (const key of updatable) {
    if (typeof fields[key] === "string") {
      (run as Record<string, unknown>)[key] = fields[key];
    }
  }

  if (typeof fields.tokensUsed === "number") {
    run.tokensUsed = fields.tokensUsed;
  }

  if (typeof fields.batchSize === "number") {
    run.batchSize = fields.batchSize;
  }

  if (typeof fields.score === "number") {
    run.score = Math.max(1, Math.min(5, Math.round(fields.score)));
  }

  run.updatedAt = nowIso();
  await persist();
  return run;
}
