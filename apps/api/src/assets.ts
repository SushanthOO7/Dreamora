import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif"
]);

function resolveAssetsRoot(): string {
  const cwd = process.cwd();
  if (path.basename(cwd) === "api") {
    return path.join(cwd, "data", "assets");
  }
  return path.join(cwd, "apps", "api", "data", "assets");
}

export function validateImageMime(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
}

export function safeExtension(filename: string, mimeType: string): string {
  const fromName = path.extname(filename).toLowerCase();
  if (fromName && fromName.length <= 8) {
    return fromName;
  }

  const mime = mimeType.toLowerCase();
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg" || mime === "image/jpg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  return ".png";
}

export function resolveAssetPath(input: {
  scope: "project" | "global";
  projectId: string | null;
  assetId: string;
  extension: string;
}): string {
  const root = resolveAssetsRoot();
  const ext = input.extension.startsWith(".") ? input.extension : `.${input.extension}`;

  if (input.scope === "global") {
    return path.join(root, "global", `${input.assetId}${ext}`);
  }

  if (!input.projectId) {
    throw new Error("project scope asset requires projectId");
  }

  return path.join(root, "projects", input.projectId, `${input.assetId}${ext}`);
}

export async function writeAssetFile(filePath: string, content: Buffer): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

export async function ensureFileExists(filePath: string): Promise<void> {
  await access(filePath);
}

export async function deleteAssetFile(filePath: string): Promise<void> {
  await ensureFileExists(filePath);
  await rm(filePath);
}
