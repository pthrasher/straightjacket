import { homedir } from "node:os";
import { join, basename } from "node:path";
import type { AgentName } from "./types.ts";

export function xdgConfigHome(): string {
  return process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
}

export function sjConfigDir(): string {
  return join(xdgConfigHome(), "sj");
}

export function sjGlobalConfigFile(): string {
  return join(sjConfigDir(), "config.json");
}

export function harnessConfigDir(
  agent: AgentName,
  override?: string,
): string {
  return override || join(sjConfigDir(), "harness-config", agent);
}

export function userPresetsDir(): string {
  return join(sjConfigDir(), "presets");
}

export function repoConfigFile(projectDir: string): string {
  return join(projectDir, ".sj", "config.json");
}

export function repoPresetsDir(projectDir: string): string {
  return join(projectDir, ".sj", "presets");
}

export function containerWorkdir(projectName: string): string {
  return `/workdirs/${projectName}`;
}
