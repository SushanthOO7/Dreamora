# Stage 7 Reference Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable local reference-image library (global or project-scoped) that supports up to 5 references (1 primary + 4 secondary) for both image and video generation, with strict hard-delete cascade behavior.

**Architecture:** Extend the JSON store schema with `assets` plus project/run linkage, add an API asset service backed by local files in `apps/api/data/assets`, and pass reference IDs through generation into Comfy workflow tokens. Update Studio to manage references, including hard-delete confirmation and global fallback when no project is selected.

**Tech Stack:** Fastify 5, TypeScript, Next.js 15, React 19, local filesystem persistence.

---

### Task 1: Add Store Schema and Cascade Operations

**Files:**
- Modify: `apps/api/src/store.ts`

- [ ] **Step 1: Add asset and project linkage types**

```ts
export type StoredAsset = {
  id: string;
  scope: "project" | "global";
  projectId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  role: "primary" | "secondary";
  weight: number;
  filePath: string;
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 2: Extend store schema and migration**

```ts
type StoreSchema = {
  version: number;
  projects: StoredProject[];
  prompts: StoredPrompt[];
  runs: StoredRun[];
  providers: StoredProvider[];
  assets: StoredAsset[];
};
```

- [ ] **Step 3: Add create/list/delete asset functions**

```ts
export async function createAsset(input: Omit<StoredAsset, "id" | "createdAt" | "updatedAt">): Promise<StoredAsset> { /* ... */ }
export function listAssets(scope: "project" | "global", projectId?: string): StoredAsset[] { /* ... */ }
export async function deleteAssetRecord(id: string): Promise<StoredAsset> { /* ... */ }
```

- [ ] **Step 4: Add project cascade delete function**

```ts
export async function deleteProjectCascade(projectId: string): Promise<{
  projectId: string;
  deletedRunIds: string[];
  deletedPromptIds: string[];
  deletedAssetIds: string[];
}> { /* ... */ }
```

- [ ] **Step 5: Verify typecheck**

Run: `npm run typecheck -w apps/api`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/store.ts
git commit -m "feat(api): add asset schema and project cascade operations"
```

### Task 2: Implement Asset File Service

**Files:**
- Create: `apps/api/src/assets.ts`

- [ ] **Step 1: Create asset path helpers**

```ts
export function resolveAssetPath(scope: "project" | "global", projectId: string | null, assetId: string, extension: string): string { /* ... */ }
```

- [ ] **Step 2: Add write/delete helpers**

```ts
export async function writeAssetFile(path: string, content: Buffer): Promise<void> { /* ... */ }
export async function deleteAssetFile(path: string): Promise<void> { /* ... */ }
```

- [ ] **Step 3: Add mime/extension validation**

```ts
export function validateImageMime(mimeType: string): boolean { /* ... */ }
export function safeExtension(filename: string, mimeType: string): string { /* ... */ }
```

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck -w apps/api`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/assets.ts
git commit -m "feat(api): add local asset file service utilities"
```

### Task 3: Add Asset API Endpoints and Project Delete Endpoint

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Add multipart dependency**

```json
"@fastify/multipart": "^9.0.0"
```

- [ ] **Step 2: Register multipart plugin in server**

```ts
import multipart from "@fastify/multipart";
await app.register(multipart, { limits: { files: 1, fileSize: 10 * 1024 * 1024 } });
```

- [ ] **Step 3: Implement `POST /api/assets/upload`**

```ts
app.post("/api/assets/upload", async (request, reply) => {
  // read multipart file
  // validate scope/project/mime
  // write local file
  // persist metadata
});
```

- [ ] **Step 4: Implement `GET /api/assets` and `DELETE /api/assets/:id`**

```ts
app.get("/api/assets", async (request) => { /* ... */ });
app.delete("/api/assets/:id", async (request, reply) => { /* ... */ });
```

- [ ] **Step 5: Implement `DELETE /api/projects/:id` cascade endpoint**

```ts
app.delete("/api/projects/:id", async (request, reply) => {
  // preflight files
  // delete files
  // commit metadata cascade
});
```

- [ ] **Step 6: Install and verify**

Run: `npm install`  
Run: `npm run typecheck -w apps/api`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json package-lock.json apps/api/src/server.ts
git commit -m "feat(api): add asset upload/list/delete and project cascade delete endpoints"
```

### Task 4: Extend Generation Pipeline for Reference Inputs

**Files:**
- Modify: `apps/api/src/generation.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Extend generation request type**

```ts
type GenerationRequest = {
  // existing fields...
  references?: Array<{ id: string; path: string; weight: number; role: "primary" | "secondary" }>;
};
```

- [ ] **Step 2: Add token interpolation for refs**

```ts
.replaceAll("__REF_COUNT__", String(refCount))
.replaceAll("__REF1_PATH__", refPaths[0] ?? "")
.replaceAll("__REF1_WEIGHT__", String(refWeights[0] ?? 0))
```

- [ ] **Step 3: Validate workflow token compatibility**

```ts
if (references.length > 0 && !rawWorkflow.includes("__REF1_PATH__")) {
  throw new Error("Workflow missing reference image tokens");
}
```

- [ ] **Step 4: Validate generation payload in server**

```ts
// validate max 5, exactly one primary, scope/project match
// attach references to run record
```

- [ ] **Step 5: Verify typecheck/build**

Run: `npm run typecheck -w apps/api`  
Run: `npm run build -w apps/api`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/generation.ts apps/api/src/server.ts
git commit -m "feat(api): support up to five weighted reference images in generation"
```

### Task 5: Add Client API Contracts for Assets and Extended Generation

**Files:**
- Modify: `apps/web/lib/client-api.ts`

- [ ] **Step 1: Add asset types**

```ts
export type StudioAsset = { id: string; scope: "project" | "global"; projectId: string | null; role: "primary" | "secondary"; weight: number; /* ... */ };
```

- [ ] **Step 2: Add asset API helpers**

```ts
export async function uploadAsset(input: FormData): Promise<StudioAsset> { /* ... */ }
export async function listAssets(scope: "project" | "global", projectId?: string): Promise<StudioAsset[]> { /* ... */ }
export async function deleteAsset(assetId: string): Promise<{ deleted: boolean }> { /* ... */ }
```

- [ ] **Step 3: Extend start generation request**

```ts
type StartGenerationRequest = {
  // existing fields...
  projectId?: string;
  referenceAssetIds?: string[];
};
```

- [ ] **Step 4: Verify web typecheck**

Run: `npm run typecheck -w apps/web`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/client-api.ts
git commit -m "feat(web): add asset api client and reference-aware generation payload"
```

### Task 6: Wire Studio Page Data for Project Fallback Context

**Files:**
- Modify: `apps/web/app/studio/page.tsx`
- Modify: `apps/web/lib/api.ts`

- [ ] **Step 1: Ensure project list is available to studio page**

```ts
const [providers, runs, prompts, projects] = await Promise.all([/* ... */]);
```

- [ ] **Step 2: Pass projects into StudioWorkbench props**

```tsx
<StudioWorkbench providers={providers} initialRuns={runs} promptPresets={prompts} projects={projects} />
```

- [ ] **Step 3: Verify web typecheck**

Run: `npm run typecheck -w apps/web`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/studio/page.tsx apps/web/lib/api.ts
git commit -m "feat(web): provide project context for reference library scope selection"
```

### Task 7: Implement Studio Reference Library UX

**Files:**
- Modify: `apps/web/components/studio-workbench.tsx`

- [ ] **Step 1: Add reference library state**

```ts
assets: StudioAsset[];
selectedReferenceIds: string[];
selectedProjectId: string | null;
deletingAssetId: string | null;
```

- [ ] **Step 2: Add project/global scope switching and load assets**

```ts
// if selectedProjectId -> scope "project"
// else -> scope "global"
```

- [ ] **Step 3: Add upload control and list rendering**

```tsx
<input type="file" accept="image/*" />
// list cards with role/weight controls
```

- [ ] **Step 4: Enforce selection constraints**

```ts
// max 5 selected
// exactly one primary among selected (auto-fix on change)
```

- [ ] **Step 5: Implement strict hard-delete confirmation**

```ts
if (confirm("This permanently deletes the reference from local storage and library.")) {
  await deleteAsset(id);
}
```

- [ ] **Step 6: Send reference IDs in generation payload**

```ts
await startGeneration({ /* existing fields */, projectId: selectedProjectId ?? undefined, referenceAssetIds: selectedReferenceIds });
```

- [ ] **Step 7: Verify studio builds**

Run: `npm run typecheck -w apps/web`  
Run: `npm run build -w apps/web`  
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/studio-workbench.tsx
git commit -m "feat(web): add reference library management and hard-delete flows in studio"
```

### Task 8: Update Documentation and Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/implementation-status.md`

- [ ] **Step 1: Update README endpoints and reference behavior**

```md
- POST /api/assets/upload
- GET /api/assets
- DELETE /api/assets/:id
- DELETE /api/projects/:id
```

- [ ] **Step 2: Update implementation status for completed Stage 7 slice**

```md
- Stage 7 slice complete: multi-reference local library and hard-delete cascades
```

- [ ] **Step 3: Run full verification**

Run: `npm run typecheck`  
Run: `npm run build`  
Expected: PASS (allow existing dynamic-render warnings in Next build output)

- [ ] **Step 4: Commit**

```bash
git add README.md docs/implementation-status.md
git commit -m "docs: document reference library stage 7 implementation"
```

### Task 9: Manual Smoke Checks

**Files:**
- Modify: none

- [ ] **Step 1: Start app**

Run: `npm run dev`

- [ ] **Step 2: Validate global fallback**

Expected:
- no project selected -> global assets load
- generation works with selected global refs

- [ ] **Step 3: Validate project scope and cascade**

Expected:
- project selected -> project assets only
- deleting project removes assets and related records

- [ ] **Step 4: Validate hard-delete behavior**

Expected:
- unselect/remove action permanently deletes local asset file
- deleted asset no longer appears in list

- [ ] **Step 5: Capture any follow-up issues**

```md
Record mismatches or missing workflow token support for next patch.
```
