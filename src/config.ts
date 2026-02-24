import { loadConfig } from "c12";
import { defu } from "defu";
import type { SjConfig } from "./types.ts";
import { sjGlobalConfigFile } from "./paths.ts";

export const CONFIG_DEFAULTS: SjConfig = {
  defaultAgent: "claude",
  defaultPreset: "full-stack",
  autoUpdate: false,
  gitConfigSync: true,
  githubCli: false,
  preRunScripts: [],
  rebuild: false,
  agents: {},
};

/**
 * Build the config object written by `sj repo-config`.
 * Excludes transient/empty fields that aren't useful in a persisted config.
 */
export function repoConfigDefaults(): Record<string, unknown> {
  const { rebuild, agents, ...rest } = CONFIG_DEFAULTS;
  return rest;
}

/**
 * Load and merge config from all layers.
 * Priority: cliOverrides > per-repo .sj/config.json > global $XDG_CONFIG_HOME/sj/config.json > defaults
 */
export async function resolveConfig(
  projectDir: string,
  cliOverrides: Partial<SjConfig> = {},
): Promise<SjConfig> {
  // Read global config manually (c12's globalRc doesn't support XDG paths)
  let globalConfig: Partial<SjConfig> = {};
  try {
    globalConfig = await Bun.file(sjGlobalConfigFile()).json();
  } catch {
    // File doesn't exist or invalid JSON — use empty
  }

  // Pre-merge global config over built-in defaults.
  // defu(a, b) gives precedence to a, fills gaps from b.
  const mergedDefaults = defu(globalConfig, CONFIG_DEFAULTS);

  // Strip undefined values from CLI overrides so they don't clobber real values
  const cleanOverrides: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(cliOverrides)) {
    if (value !== undefined) {
      cleanOverrides[key] = value;
    }
  }

  // c12 handles per-repo config at .sj/config.json
  const { config } = await loadConfig<SjConfig>({
    name: "sj",
    cwd: `${projectDir}/.sj`,
    configFile: "config",
    rcFile: false,
    globalRc: false,
    packageJson: false,
    overrides: cleanOverrides as unknown as SjConfig,
    defaults: mergedDefaults,
  });

  return config as SjConfig;
}
