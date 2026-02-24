import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import type { LaunchMode, SjConfig, ResolvedUnit } from "./types.ts";

function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

/**
 * Deduplicate an array of strings while preserving order.
 */
function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

interface EntrypointOptions {
  agent: LaunchMode;
  config: SjConfig;
  units: ResolvedUnit[];
}

/**
 * Generate entrypoint shell script matching default-presets/entrypoint.sh.
 * Parameterized by agent, config, and resolved units.
 */
export function generateEntrypoint(opts: EntrypointOptions): string {
  const { agent, config, units } = opts;

  // Build PATH: unit pathDirs + standard dirs
  const unitPathDirs = dedupe(units.flatMap((u) => u.manifest.pathDirs ?? []));
  const standardDirs = ["$HOME/.local/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
  const allPathDirs = [...unitPathDirs, ...standardDirs].join(":");

  const lines: string[] = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    '# ── Environment setup ──',
    'export USER="${USER:-sandboxuser}"',
    `export PATH="${allPathDirs}:$PATH"`,
    "",
    "# ── SSH agent ──",
    'if [ -z "${SSH_AUTH_SOCK:-}" ]; then',
    '  echo "warning: SSH_AUTH_SOCK is not set — SSH agent forwarding unavailable" >&2',
    'elif [ ! -S "$SSH_AUTH_SOCK" ]; then',
    '  echo "warning: SSH_AUTH_SOCK ($SSH_AUTH_SOCK) is not a valid socket" >&2',
    "fi",
    "",
  ];

  // GitHub CLI auth
  if (config.githubCli) {
    lines.push("# ── GitHub CLI auth ──");
    lines.push('if ! gh auth status >/dev/null 2>&1; then');
    lines.push('  echo "GitHub CLI is not authenticated. Running gh auth login..."');
    lines.push("  gh auth login");
    lines.push("fi");
    lines.push("");
  }

  // Pre-run scripts
  if (config.preRunScripts.length > 0) {
    lines.push("# ── Pre-run scripts ──");
    for (const script of config.preRunScripts) {
      lines.push(`bash -c ${shellQuote(script)}`);
    }
    lines.push("");
  }

  // Agent launch
  lines.push("# ── Agent launch ──");
  switch (agent) {
    case "claude":
      lines.push("export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1");
      if (config.autoUpdate) {
        lines.push("claude update || true");
      }
      lines.push(
        "exec claude --allow-dangerously-skip-permissions --dangerously-skip-permissions",
      );
      break;
    case "codex":
      if (config.autoUpdate) {
        lines.push("npm update -g @openai/codex || true");
      }
      lines.push("exec codex --dangerously-bypass-approvals-and-sandbox");
      break;
    case "shell":
      lines.push("exec zsh");
      break;
  }

  return lines.join("\n") + "\n";
}

/**
 * Write generated entrypoint to a temp file for bind-mounting into the container.
 */
export async function writeEntrypointTempFile(
  content: string,
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sj-entrypoint-"));
  const filePath = join(dir, "entrypoint.sh");
  await writeFile(filePath, content, { mode: 0o755 });
  return filePath;
}

/**
 * Best-effort cleanup of the temp entrypoint file and its directory.
 */
export async function cleanupEntrypointTempFile(
  filePath: string,
): Promise<void> {
  try {
    await unlink(filePath);
    await rmdir(dirname(filePath));
  } catch {
    // Best-effort cleanup
  }
}
