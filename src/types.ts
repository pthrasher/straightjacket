export type AgentName = "claude" | "codex";
export type LaunchMode = AgentName | "shell";

// ── Unit and Preset types ───────────────────────────────────────────

export interface UnitArgDef {
  description?: string;
  default: string;
}

export interface UnitAptRepo {
  name: string;
  gpgKeyUrl: string;
  sourceLine: string;
}

export interface UnitManifest {
  description?: string;
  apt?: string[];
  aptRepos?: UnitAptRepo[];
  pip?: string[];
  pathDirs?: string[];
  args?: Record<string, UnitArgDef>;
  requires?: string[];
}

export interface ResolvedUnit {
  name: string;
  manifest: UnitManifest;
  resolvedArgs: Record<string, string>;
  buildSnippet: string | null;
  postInstallSnippet: string | null;
  postAgentInstallSnippet: string | null;
  origin: "per-repo" | "user" | "built-in";
}

export interface PresetUnitRef {
  name: string;
  args?: Record<string, string>;
}

export interface PresetManifest {
  name: string;
  units: PresetUnitRef[];
}

export interface ResolvedPreset {
  name: string;
  manifest: PresetManifest;
  units: ResolvedUnit[];
  origin: "per-repo" | "user" | "built-in";
}

// ── Config ──────────────────────────────────────────────────────────

export interface SjConfig {
  defaultAgent: AgentName;
  defaultPreset: string;
  autoUpdate: boolean;
  gitConfigSync: boolean;
  githubCli: boolean;
  sshForwarding: boolean;
  claudeEnvSync: boolean;
  codexConfigSync: boolean;
  preRunScripts: string[];
  rebuild: boolean;
  agents: Record<string, { configPath?: string }>;
}
