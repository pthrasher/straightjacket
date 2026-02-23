import {
  existsSync,
  mkdirSync,
  copyFileSync,
  cpSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * Create the harness-config directory for an agent if it doesn't exist.
 * Ensure XDG subdirectories exist inside it.
 * Matches prep.sh step 1.
 */
export function bootstrapHarnessConfig(harnessHome: string): void {
  if (!existsSync(harnessHome)) {
    console.log(
      `First run — creating harness-config at ${harnessHome}`,
    );
    mkdirSync(harnessHome, { recursive: true });
  }

  for (const subdir of [".config", ".cache", ".local/share"]) {
    const dir = join(harnessHome, subdir);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Sync host git config into the harness-config directory.
 * One-way copy: host overwrites the sandboxed copy.
 * Matches prep.sh step 2.
 */
export function syncGitConfig(harnessHome: string): void {
  const hostHome = homedir();

  // ~/.gitconfig
  const hostGitconfig = join(hostHome, ".gitconfig");
  if (existsSync(hostGitconfig)) {
    copyFileSync(hostGitconfig, join(harnessHome, ".gitconfig"));
  }

  // ~/.config/git/ (includes config, ignore, attributes, etc.)
  const hostConfigGit = join(hostHome, ".config", "git");
  if (existsSync(hostConfigGit)) {
    const dest = join(harnessHome, ".config", "git");
    mkdirSync(dest, { recursive: true });
    cpSync(hostConfigGit, dest, { recursive: true });
  }
}

/**
 * Capture TTY-related environment variables as podman --env args.
 * Matches prep.sh step 4.
 */
export function captureTtyEnvArgs(): string[] {
  const args: string[] = [];
  const vars = [
    "TERM",
    "COLORTERM",
    "TERM_PROGRAM",
    "TERM_PROGRAM_VERSION",
    "LANG",
    "COLUMNS",
    "LINES",
  ];

  for (const key of vars) {
    const val = process.env[key];
    if (val) {
      args.push("--env", `${key}=${val}`);
    }
  }

  // Forward all LC_* variables
  for (const [key, val] of Object.entries(process.env)) {
    if (key.startsWith("LC_") && val) {
      args.push("--env", `${key}=${val}`);
    }
  }

  return args;
}

/**
 * Detect SSH_AUTH_SOCK and return podman args for forwarding.
 * Matches prep.sh step 5.
 */
export function sshForwardingArgs(): string[] {
  const sock = process.env.SSH_AUTH_SOCK;
  if (!sock) {
    console.error(
      "warning: SSH_AUTH_SOCK not available — SSH agent forwarding disabled",
    );
    return [];
  }

  try {
    statSync(sock);
  } catch {
    console.error(
      "warning: SSH_AUTH_SOCK not available — SSH agent forwarding disabled",
    );
    return [];
  }

  return [
    "-v",
    `${sock}:/run/ssh-agent.sock:ro`,
    "--env",
    "SSH_AUTH_SOCK=/run/ssh-agent.sock",
  ];
}

/**
 * Forward API key environment variables as podman --env args.
 * Matches prep.sh step 6.
 */
export function credentialEnvArgs(): string[] {
  const args: string[] = [];
  const keys = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"];

  for (const key of keys) {
    const val = process.env[key];
    if (val) {
      args.push("--env", `${key}=${val}`);
    }
  }

  return args;
}

/**
 * Get the current user's UID and GID.
 */
export function getUidGid(): { uid: number; gid: number } {
  return {
    uid: process.getuid!(),
    gid: process.getgid!(),
  };
}
