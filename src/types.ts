export type AgentName = "claude" | "codex";
export type LaunchMode = AgentName | "shell";

export interface PresetSource {
  name: string;
  dockerfilePath: string;
  origin: "per-repo" | "user" | "built-in";
}

export interface SjConfig {
  defaultAgent: AgentName;
  defaultPreset: string;
  autoUpdate: boolean;
  gitConfigSync: boolean;
  githubCli: boolean;
  preRunScripts: string[];
  rebuild: boolean;
  agents: Record<string, { configPath?: string }>;
}
