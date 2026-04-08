# Stage 7 Design: Multi-Reference Library (Up To 5 Images) for Image and Video Generation

## 1. Objective

Implement a reusable reference-image library that supports:

- Up to 5 reference images per generation request
- Exactly 1 primary reference and up to 4 secondary references
- Use with both image and video generation modes
- Project-scoped libraries and a global fallback library
- Strict hard-delete semantics (metadata + local file deletion)

This stage is the first Stage 7 hardening slice and is intentionally local-first (no external object storage yet).

## 2. Scope

In scope:

- Local file storage for reference assets under `apps/api/data/assets`
- Store metadata extension for assets and run-reference links
- New asset CRUD APIs (upload/list/delete)
- Generation API extension to accept reference asset IDs
- Comfy workflow token mapping for reference paths and weights
- Studio UI support for selecting, weighting, and deleting references
- Cascade hard-delete for project deletion and asset deletion

Out of scope:

- External object storage (S3/R2/GCS)
- Soft-delete / recycle bin
- Cross-instance file consistency
- Auth and role-based access control
- Automatic retry worker execution (policy already exists as recommendation)

## 3. Non-Negotiable Behavior

1. Max references per generation request: 5
2. If references are used: exactly 1 must be primary
3. Removing/unselecting a reference from Studio permanently deletes that asset from local disk and library metadata
4. Deleting a project permanently deletes all project assets from disk and removes related runs/prompts
5. If no project is selected, Studio uses global fallback library

## 4. Architecture

### 4.1 Storage Layer

- Metadata remains in `apps/api/data/store.json`
- Binary files stored on disk:
  - Global: `apps/api/data/assets/global/<assetId>.<ext>`
  - Project: `apps/api/data/assets/projects/<projectId>/<assetId>.<ext>`

### 4.2 API Layer

Fastify server (`apps/api/src/server.ts`) receives:

- Asset upload/list/delete operations
- Extended generation start payload with references
- Project deletion endpoint with cascade cleanup

### 4.3 Generation Layer

`apps/api/src/generation.ts` adds reference token interpolation for both image and video workflows:

- `__REF_COUNT__`
- `__REF1_PATH__` ... `__REF5_PATH__`
- `__REF1_WEIGHT__` ... `__REF5_WEIGHT__`

If reference tokens are required by workflow configuration but cannot be resolved, generation request is rejected with explicit validation error.

### 4.4 UI Layer

Studio (`apps/web/components/studio-workbench.tsx`) adds:

- Optional project context selector
- Reference library tray (project or global fallback)
- Primary/secondary role assignment
- Per-reference weight controls
- Hard-delete confirmation flow

## 5. Data Model Changes

## 5.1 Store Schema Additions

Add `assets` array to store schema:

```ts
type StoredAsset = {
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

Extend run schema:

```ts
type StoredRun = {
  // existing fields...
  projectId?: string | null;
  referenceAssetIds?: string[];
};
```

Extend prompt schema to support project cascade deletes:

```ts
type StoredPrompt = {
  // existing fields...
  projectId?: string | null;
};
```

## 5.2 Invariants

- `assets.id` is unique
- `assets.scope="project"` requires non-null `projectId`
- `assets.scope="global"` requires `projectId=null`
- `weight` range for first release: `0.1` to `1.0`
- `referenceAssetIds.length <= 5`

## 6. API Contract

## 6.1 Upload Asset

- `POST /api/assets/upload` (multipart)
- Input:
  - `file`
  - `scope` (`project` | `global`)
  - optional `projectId`
  - optional `role` (`primary` | `secondary`)
  - optional `weight`
- Output: stored asset metadata

Validation:

- File must be image mime type
- Project scope requires existing `projectId`
- Enforce local file write success before metadata persist

## 6.2 List Assets

- `GET /api/assets?scope=&projectId=`
- If project is selected in Studio:
  - list project assets
- If no project selected:
  - list global assets only

## 6.3 Delete Asset (Hard Delete)

- `DELETE /api/assets/:id`
- Deletes:
  - metadata record from `assets`
  - file from local disk
  - all runs that reference this asset ID
  - references from active in-memory UI selections

## 6.4 Extend Generation Start

- `POST /api/generation/start` extends request with:
  - `projectId?: string`
  - `referenceAssetIds?: string[]`

Validation:

- If provided, all asset IDs must exist
- Max 5 asset IDs
- Exactly 1 primary role among selected refs
- Scope consistency:
  - project mode: refs belong to that project
  - no project mode: refs belong to global scope

Persist selected references on run record (`referenceAssetIds`).

## 6.5 Delete Project (Cascade Hard Delete)

- `DELETE /api/projects/:id` (new)
- Cascade operations:
  1. Delete all project assets from local disk
  2. Remove project asset metadata
  3. Delete related runs/prompts for that project
  4. Delete project record itself

Operation must be fail-fast and metadata-safe: if any file deletion fails, endpoint returns error and metadata remains unchanged.
Delete order:

1. Validate all target records and files
2. Delete files
3. Delete metadata records (`assets`, related `runs`, related `prompts`, project)

If file deletion fails, no metadata deletion is applied.

## 7. Generation and Workflow Mapping

For each generation request with references:

1. Resolve reference asset metadata
2. Build ordered list:
   - Primary first
   - Secondary references by deterministic order (upload order or explicit user order)
3. Build token payload for 1..5 slots
4. Fill unused slots with neutral defaults
   - path tokens empty
   - weight tokens `0`
5. Submit workflow

Image and video workflows both support this mapping in the same token contract.

## 8. UI Flow

1. User opens Studio
2. User optionally chooses project
3. Reference tray displays:
   - project library if project selected
   - global library if no project selected
4. User selects up to 5 references
5. User marks one primary (or first selection auto-primary until changed)
6. User sets weights
7. Generate request includes selected IDs + project context

Hard-delete UX:

- Removing/unselecting image triggers confirmation modal:
  - "This permanently deletes the reference from local storage and library."
- On confirm:
  - delete API called
  - file removed from disk
  - references removed from local UI state and historical data

## 9. Error Handling

Error cases and expected responses:

- Invalid reference count (>5): `400`
- Missing primary reference when refs exist: `400`
- Asset ID not found: `404`
- Asset scope/project mismatch: `400`
- File deletion failure: `500` with explicit file path context redacted to safe message
- Workflow ref-token mismatch: `400` with actionable message

System should never silently keep metadata when a hard-delete file operation fails.

## 10. Testing Strategy

API tests:

- Upload asset (global/project)
- List assets by scope
- Delete asset hard-delete path verification
- Generation start with:
  - no refs
  - 1 primary
  - 5 refs (1 primary + 4 secondary)
  - invalid role combinations
- Project delete cascade verifies:
  - project assets removed from disk
  - project runs/prompts removed

Integration checks:

- Studio selection and role assignment
- UI delete confirmation and post-delete refresh
- Global fallback behavior when no project selected

Manual smoke:

- Run with COMFY disabled and enabled
- Confirm request payload and persisted run reference IDs

## 11. Rollout Plan

1. Add store schema and migration for `assets` and run reference linkage
2. Add local file asset service utilities (path resolution, save/delete)
3. Add asset endpoints
4. Extend generation API and workflow token handling
5. Add project delete cascade endpoint
6. Add Studio UI controls and deletion confirmations
7. Verify with typecheck/build and focused manual tests

## 12. Risks and Mitigations

Risk: Accidental data loss from hard-delete UX  
Mitigation: Explicit confirmation modal and clear warning copy before delete

Risk: Partial failure in project cascade deletion  
Mitigation: Preflight file existence checks and fail-fast before metadata mutation

Risk: Workflow mismatch for reference tokens  
Mitigation: Validate required token support at request-time with clear errors

Risk: Local-only storage scalability  
Mitigation: Keep storage abstraction boundaries for later migration to object storage

## 13. Success Criteria

- User can upload and reuse references in project/global libraries
- User can generate image/video with up to 5 references
- Primary + secondary weighting is enforced and persisted
- Unselect/remove performs permanent local deletion
- Project deletion permanently deletes associated assets and related artifacts
- Typecheck and build pass
