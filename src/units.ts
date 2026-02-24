import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { UnitManifest, ResolvedUnit } from "./types.ts";
import { repoUnitsDir, userUnitsDir } from "./paths.ts";
import { BUILT_IN_UNITS, type BuiltInUnitFiles } from "./built-in-units.ts";

/**
 * Convert a unit name and arg name to the namespaced Dockerfile ARG name.
 * e.g. unitArgName("node", "version") → "UNIT_NODE_VERSION"
 */
export function unitArgName(unitName: string, argName: string): string {
  const upper = (s: string) => s.replace(/-/g, "_").toUpperCase();
  return `UNIT_${upper(unitName)}_${upper(argName)}`;
}

interface UnitLocation {
  dir: string;
  origin: ResolvedUnit["origin"];
  builtIn?: BuiltInUnitFiles;
}

/**
 * Find a unit by name across resolution locations (priority: per-repo > user > built-in).
 * Returns the directory path and origin, or throws if not found.
 */
export function resolveUnit(
  name: string,
  projectDir: string,
): UnitLocation {
  // 1. Per-repo
  const repoDir = join(repoUnitsDir(projectDir), name);
  if (existsSync(join(repoDir, "unit.json"))) {
    return { dir: repoDir, origin: "per-repo" };
  }

  // 2. User (global)
  const userDir = join(userUnitsDir(), name);
  if (existsSync(join(userDir, "unit.json"))) {
    return { dir: userDir, origin: "user" };
  }

  // 3. Built-in
  const builtIn = BUILT_IN_UNITS[name];
  if (builtIn) {
    return { dir: "", origin: "built-in", builtIn };
  }

  throw new Error(
    `Unit "${name}" not found. Searched: per-repo (.sj/units/), user ($XDG_CONFIG_HOME/sj/units/), built-in units.`,
  );
}

/**
 * Read a file if it exists, returning its content or null.
 */
function readOptionalFile(path: string): string | null {
  if (existsSync(path)) {
    return readFileSync(path, "utf-8");
  }
  return null;
}

/**
 * Read file content from a Bun virtual FS path (for built-in units in compiled binary).
 */
function readBunFile(path: string): string {
  return readFileSync(path, "utf-8");
}

/**
 * Load a unit: resolve it, parse manifest, read snippet files, merge arg overrides.
 */
export function loadUnit(
  name: string,
  projectDir: string,
  argOverrides?: Record<string, string>,
): ResolvedUnit {
  const loc = resolveUnit(name, projectDir);

  let manifest: UnitManifest;
  let postInstallSnippet: string | null;
  let postAgentInstallSnippet: string | null;
  let buildSnippet: string | null;

  if (loc.builtIn) {
    // Built-in unit: read from Bun virtual FS paths
    manifest = JSON.parse(readBunFile(loc.builtIn.manifest));
    postInstallSnippet = loc.builtIn.postInstall
      ? readBunFile(loc.builtIn.postInstall)
      : null;
    postAgentInstallSnippet = loc.builtIn.postAgentInstall
      ? readBunFile(loc.builtIn.postAgentInstall)
      : null;
    buildSnippet = loc.builtIn.build ? readBunFile(loc.builtIn.build) : null;
  } else {
    // Filesystem unit: read from directory
    manifest = JSON.parse(readFileSync(join(loc.dir, "unit.json"), "utf-8"));
    postInstallSnippet = readOptionalFile(
      join(loc.dir, "post-install.Dockerfile"),
    );
    postAgentInstallSnippet = readOptionalFile(
      join(loc.dir, "post-agent-install.Dockerfile"),
    );
    buildSnippet = readOptionalFile(join(loc.dir, "build.Dockerfile"));
  }

  // Merge arg overrides with defaults
  const resolvedArgs: Record<string, string> = {};
  if (manifest.args) {
    for (const [key, def] of Object.entries(manifest.args)) {
      resolvedArgs[key] = argOverrides?.[key] ?? def.default;
    }
  }

  return {
    name,
    manifest,
    resolvedArgs,
    buildSnippet,
    postInstallSnippet,
    postAgentInstallSnippet,
    origin: loc.origin,
  };
}

/**
 * Validate that all unit requirements are satisfied.
 * Returns an array of warning messages (empty if all requirements met).
 */
export function validateUnitRequirements(
  units: ResolvedUnit[],
): string[] {
  const names = new Set(units.map((u) => u.name));
  const warnings: string[] = [];

  for (const unit of units) {
    for (const req of unit.manifest.requires ?? []) {
      if (!names.has(req)) {
        warnings.push(
          `unit '${unit.name}' requires '${req}' but it's not included in the preset`,
        );
      }
    }
  }

  return warnings;
}
