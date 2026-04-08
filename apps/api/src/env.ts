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
