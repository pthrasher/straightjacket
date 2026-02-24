import {
  existsSync,
  mkdirSync,
  copyFileSync,
  cpSync,
  statSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface SshForwardingResult {
  podmanArgs: string[];
  cleanup: (() => void) | null;
}

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
 * Sync host GitHub CLI config into the harness-config directory.
 * One-way copy: host overwrites the sandboxed copy.
 */
export function syncGhConfig(harnessHome: string): void {
  const hostGhConfig = join(homedir(), ".config", "gh");
  if (existsSync(hostGhConfig)) {
    const dest = join(harnessHome, ".config", "gh");
    mkdirSync(dest, { recursive: true });
    cpSync(hostGhConfig, dest, { recursive: true });
  }
}

/**
 * Slugify a path the way Claude Code does for ~/.claude/projects/:
 * replace every `/` with `-`.
 */
export function slugifyProjectPath(p: string): string {
  return p.replace(/\//g, "-");
}

/**
 * Recursively copy files from src to dest, skipping files that already
 * exist at the destination. Rewrites hostPath → containerPath in all
 * copied file contents.
 */
function syncNewFiles(
  srcDir: string,
  destDir: string,
  hostPath: string,
  containerPath: string,
): void {
  const entries = readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      syncNewFiles(srcPath, destPath, hostPath, containerPath);
    } else if (!existsSync(destPath)) {
      const content = readFileSync(srcPath, "utf8");
      writeFileSync(destPath, content.replaceAll(hostPath, containerPath));
    }
  }
}

/**
 * Sync Claude Code session/project files from the host's
 * ~/.claude/projects/<host-slug>/ into the harness-config's
 * ~/.claude/projects/<container-slug>/.
 *
 * Only copies files that don't already exist at the destination.
 * Rewrites host project paths to container paths in all copied files.
 */
export function syncClaudeSessionFiles(
  projectDir: string,
  harnessHome: string,
  containerWorkdir: string,
): void {
  const hostSlug = slugifyProjectPath(projectDir);
  const containerSlug = slugifyProjectPath(containerWorkdir);

  const srcDir = join(homedir(), ".claude", "projects", hostSlug);
  const destDir = join(harnessHome, ".claude", "projects", containerSlug);

  if (!existsSync(srcDir)) {
    return;
  }

  mkdirSync(destDir, { recursive: true });
  syncNewFiles(srcDir, destDir, projectDir, containerWorkdir);
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
 * Set up SSH agent forwarding and return podman args + cleanup function.
 *
 * On Linux: direct bind-mount of SSH_AUTH_SOCK into the container.
 * On macOS: podman runs in a VM and can't mount host Unix sockets,
 * so we establish an SSH reverse tunnel into the VM first, then
 * mount the VM-side socket into the container.
 */
export async function setupSshForwarding(): Promise<SshForwardingResult> {
  const sock = process.env.SSH_AUTH_SOCK;
  if (!sock) {
    console.error(
      "warning: SSH_AUTH_SOCK not available — SSH agent forwarding disabled",
    );
    return { podmanArgs: [], cleanup: null };
  }

  if (process.platform === "darwin") {
    return setupMacOsSshTunnel(sock);
  }

  // Linux: direct socket mount
  try {
    statSync(sock);
  } catch {
    console.error(
      "warning: SSH_AUTH_SOCK not available — SSH agent forwarding disabled",
    );
    return { podmanArgs: [], cleanup: null };
  }

  return {
    podmanArgs: [
      "-v",
      `${sock}:/run/ssh-agent.sock:ro`,
      "--env",
      "SSH_AUTH_SOCK=/run/ssh-agent.sock",
    ],
    cleanup: null,
  };
}

/**
 * On macOS, set up an SSH reverse tunnel that forwards the host's
 * SSH_AUTH_SOCK into the podman VM as a Unix socket.
 *
 * Podman on macOS runs in a Linux VM (applehv) and cannot bind-mount
 * host Unix domain sockets via virtiofs. Instead we:
 * 1. SSH into the VM with -R to create a reverse-forwarded socket
 * 2. chmod the socket so the container user can connect
 * 3. Mount the VM-side socket into the container
 *
 * We must disable SSH multiplexing (-o ControlMaster=no) because a
 * mux client sends the forward request to the master and exits
 * immediately, but the forward doesn't persist. We also need
 * --security-opt label=disable on the podman mount since SELinux in
 * the VM is enforcing.
 */
async function setupMacOsSshTunnel(
  hostSock: string,
): Promise<SshForwardingResult> {
  const inspect = Bun.spawnSync(
    ["podman", "machine", "inspect"],
    { stdout: "pipe", stderr: "pipe" },
  );

  if (!inspect.success) {
    console.error(
      "warning: could not inspect podman machine — SSH agent forwarding disabled",
    );
    return { podmanArgs: [], cleanup: null };
  }

  let sshConfig: { Port: number; IdentityPath: string; RemoteUsername: string };
  try {
    const machineInfo = JSON.parse(inspect.stdout.toString());
    sshConfig = machineInfo[0]?.SSHConfig;
    if (!sshConfig?.Port || !sshConfig?.IdentityPath || !sshConfig?.RemoteUsername) {
      throw new Error("incomplete SSH config");
    }
  } catch {
    console.error(
      "warning: could not parse podman machine SSH config — SSH agent forwarding disabled",
    );
    return { podmanArgs: [], cleanup: null };
  }

  const { Port, IdentityPath, RemoteUsername } = sshConfig;
  const vmSocketPath = "/tmp/sj-ssh-agent.sock";

  const sshBase = [
    "ssh",
    "-p", String(Port),
    "-i", IdentityPath,
    "-o", "StrictHostKeyChecking=no",
    "-o", "UserKnownHostsFile=/dev/null",
  ];

  // Clean up any stale socket in the VM
  Bun.spawnSync(
    [...sshBase, `${RemoteUsername}@localhost`, "rm", "-f", vmSocketPath],
    { stdout: "pipe", stderr: "pipe" },
  );

  // Start reverse tunnel: forwards VM socket → host SSH_AUTH_SOCK.
  // ControlMaster=no is critical — mux clients exit immediately and
  // the forward doesn't survive.
  const tunnel = Bun.spawn(
    [
      ...sshBase,
      "-o", "ControlMaster=no",
      "-o", "ControlPath=none",
      "-o", "ExitOnForwardFailure=yes",
      "-R", `${vmSocketPath}:${hostSock}`,
      "-N",
      `${RemoteUsername}@localhost`,
    ],
    { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
  );

  // Give the tunnel a moment to establish, then verify it's still alive
  const earlyExit = await Promise.race([
    tunnel.exited.then((code) => code),
    Bun.sleep(2000).then(() => null),
  ]);

  if (earlyExit !== null) {
    console.error(
      "warning: SSH tunnel to podman VM failed — SSH agent forwarding disabled",
    );
    return { podmanArgs: [], cleanup: null };
  }

  // The socket is created with owner-only permissions (0600) by sshd.
  // chmod so the container user (mapped via --userns=keep-id) can connect.
  Bun.spawnSync(
    [...sshBase, `${RemoteUsername}@localhost`, "chmod", "0666", vmSocketPath],
    { stdout: "pipe", stderr: "pipe" },
  );

  return {
    podmanArgs: [
      // SELinux in the podman VM is enforcing — label=disable lets the
      // container process access the socket without the right label.
      "--security-opt", "label=disable",
      "-v", `${vmSocketPath}:/run/ssh-agent.sock`,
      "--env", "SSH_AUTH_SOCK=/run/ssh-agent.sock",
    ],
    cleanup: () => {
      tunnel.kill();
      Bun.spawnSync(
        [...sshBase, `${RemoteUsername}@localhost`, "rm", "-f", vmSocketPath],
        { stdout: "pipe", stderr: "pipe" },
      );
    },
  };
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
