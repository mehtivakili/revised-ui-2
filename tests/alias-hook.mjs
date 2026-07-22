import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Resolves the project's `@/` TypeScript path alias for `node --test`.
 * tsconfig maps `@/*` to the repository root, and source imports omit the extension,
 * so this hook rewrites the specifier and probes the same candidates tsc would.
 */

const projectRoot = new URL("../", import.meta.url);
const candidates = ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) return nextResolve(specifier, context);

  const base = new URL(specifier.slice(2), projectRoot);
  for (const suffix of candidates) {
    const candidate = new URL(base.href + suffix);
    if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
  }
  return nextResolve(base.href, context);
}
