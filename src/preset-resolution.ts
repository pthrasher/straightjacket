import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PresetManifest, ResolvedPreset } from "./types.ts";
import { repoPresetsDir, userPresetsDir } from "./paths.ts";
import { BUILT_IN_PRESETS_V2 } from "./built-in-presets.ts";
import { loadUnit, validateUnitRequirements } from "./units.ts";

interface PresetLocation {
  path: string;
  origin: ResolvedPreset["origin"];
}

/**
 * Find a preset.json by name across resolution locations.
 * Priority: per-repo > user > built-in.
 */
export function resolvePresetV2(
  name: string,
  projectDir: string,
): PresetLocation {
  // 1. Per-repo
  const repoPath = join(repoPresetsDir(projectDir), name, "preset.json");
  if (existsSync(repoPath)) {
    return { path: repoPath, origin: "per-repo" };
  }

  // 2. User (global)
  const userPath = join(userPresetsDir(), name, "preset.json");
  if (existsSync(userPath)) {
    return { path: userPath, origin: "user" };
  }

  // 3. Built-in
  const builtInPath = BUILT_IN_PRESETS_V2[name];
  if (builtInPath) {
    return { path: builtInPath, origin: "built-in" };
  }

  throw new Error(
    `Preset "${name}" not found. Searched: per-repo (.sj/presets/), user ($XDG_CONFIG_HOME/sj/presets/), built-in presets.`,
  );
}

/**
 * Load a preset: resolve it, parse manifest, resolve all units, validate requirements.
 */
export function loadPreset(
  name: string,
  projectDir: string,
): ResolvedPreset {
  const loc = resolvePresetV2(name, projectDir);
  const manifest: PresetManifest = JSON.parse(
    readFileSync(loc.path, "utf-8"),
  );

  // Resolve all units referenced by the preset
  const units = manifest.units.map((ref) =>
    loadUnit(ref.name, projectDir, ref.args),
  );

  // Validate requirements (warn, don't throw)
  const warnings = validateUnitRequirements(units);
  for (const w of warnings) {
    console.warn(`Warning: ${w}`);
  }

  return {
    name: manifest.name,
    manifest,
    units,
    origin: loc.origin,
  };
}
