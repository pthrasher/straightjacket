import type { LaunchMode } from "./types.ts";

export interface PodmanRunOpts {
  imageRef: string;
  projectDir: string;
  containerWorkdir: string;
  harnessHome: string;
  entrypointPath: string;
  agent: LaunchMode;
  sshArgs: string[];
  ttyEnvs: string[];
  credEnvs: string[];
}

/**
 * Assemble the full podman run argument list.
 * Returns the full argument list for `podman run`.
 */
export function buildPodmanRunArgs(opts: PodmanRunOpts): string[] {
  return [
    "run",
    "--rm",
    "-it",
    // Security
    "--userns=keep-id",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    // Mounts
    "-v",
    `${opts.projectDir}:${opts.containerWorkdir}`,
    "-v",
    `${opts.harnessHome}:/home/sandboxuser`,
    "-v",
    `${opts.entrypointPath}:/entrypoint.sh:ro`,
    // SSH
    ...opts.sshArgs,
    // TTY env
    ...opts.ttyEnvs,
    // Credentials
    ...opts.credEnvs,
    // Core env
    "--env",
    "HOME=/home/sandboxuser",
    "--env",
    "USER=sandboxuser",
    // Working directory
    "-w",
    opts.containerWorkdir,
    // Image
    opts.imageRef,
    // Entrypoint command
    "bash",
    "/entrypoint.sh",
    opts.agent,
  ];
}

/**
 * Exec podman with inherited stdio (TTY passthrough).
 * Returns the exit code.
 */
export async function execPodman(args: string[]): Promise<number> {
  const proc = Bun.spawn(["podman", ...args], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  return await proc.exited;
}
