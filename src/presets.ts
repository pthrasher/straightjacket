import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PresetSource } from "./types.ts";
import { repoPresetsDir, userPresetsDir } from "./paths.ts";

// Bun's { type: "file" } import embeds these into the compiled binary.
// Returns a path string: real filesystem path in dev, $bunfs/... in compiled binary.
// @ts-expect-error — Bun-specific import attribute; not understood by tsc
import fullStack from "../default-presets/full-stack/Dockerfile" with { type: "file" };
// @ts-expect-error — Bun-specific import attribute; not understood by tsc
import fullStackPlaywright from "../default-presets/full-stack-playwright/Dockerfile" with { type: "file" };

export const BUILT_IN_PRESETS: Record<string, string> = {
  "full-stack": fullStack,
  "full-stack-playwright": fullStackPlaywright,
};

/**
 * Resolve a preset by name, checking locations in priority order:
 * 1. Per-repo: <project>/.sj/presets/<name>/Dockerfile
 * 2. User: $XDG_CONFIG_HOME/sj/presets/<name>/Dockerfile
 * 3. Built-in: embedded in binary
 */
export function resolvePreset(
  name: string,
  projectDir: string,
): PresetSource {
  // 1. Per-repo preset
  const repoDockerfile = join(repoPresetsDir(projectDir), name, "Dockerfile");
  if (existsSync(repoDockerfile)) {
    return { name, dockerfilePath: repoDockerfile, origin: "per-repo" };
  }

  // 2. User preset
  const userDockerfile = join(userPresetsDir(), name, "Dockerfile");
  if (existsSync(userDockerfile)) {
    return { name, dockerfilePath: userDockerfile, origin: "user" };
  }

  // 3. Built-in preset
  const builtInPath = BUILT_IN_PRESETS[name];
  if (builtInPath) {
    return { name, dockerfilePath: builtInPath, origin: "built-in" };
  }

  throw new Error(
    `Preset "${name}" not found. Searched: per-repo (.sj/presets/), user ($XDG_CONFIG_HOME/sj/presets/), built-in presets.`,
  );
}
