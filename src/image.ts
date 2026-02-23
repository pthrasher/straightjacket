import { createHash } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { PresetSource } from "./types.ts";

/**
 * SHA-256 hash of Dockerfile content, truncated to 12 hex chars.
 */
export async function dockerfileContentHash(
  dockerfilePath: string,
): Promise<string> {
  const content = await Bun.file(dockerfilePath).text();
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

/**
 * Derive the image reference (name:tag) from a preset and project dir.
 * - Built-in/user presets: sj-<preset-name>:<hash>
 * - Per-repo presets: sj-<parent-dir>-<project-dir>-<preset-name>:<hash>
 */
export function imageRef(
  preset: PresetSource,
  projectDir: string,
  hash: string,
): string {
  if (preset.origin === "per-repo") {
    const parent = basename(dirname(projectDir));
    const project = basename(projectDir);
    return `sj-${parent}-${project}-${preset.name}:${hash}`;
  }
  return `sj-${preset.name}:${hash}`;
}

/**
 * Materialize a Dockerfile to a real filesystem path that podman can read.
 * For built-in presets in compiled binary, the import path is a $bunfs/ virtual
 * path that podman cannot access — we write the content to a temp file.
 * For non-built-in presets, the path is already a real filesystem path.
 */
export async function materializeDockerfile(
  preset: PresetSource,
): Promise<{ path: string; cleanup: (() => Promise<void>) | null }> {
  if (preset.origin === "built-in") {
    const content = await Bun.file(preset.dockerfilePath).text();
    const tmpDir = await mkdtemp(join(tmpdir(), "sj-dockerfile-"));
    const tmpPath = join(tmpDir, "Dockerfile");
    await writeFile(tmpPath, content);
    return {
      path: tmpPath,
      cleanup: async () => {
        try {
          await unlink(tmpPath);
          await rmdir(tmpDir);
        } catch {
          // Best-effort cleanup
        }
      },
    };
  }
  return { path: preset.dockerfilePath, cleanup: null };
}

/**
 * Check if a podman image exists locally.
 */
export function imageExists(ref: string): boolean {
  const proc = Bun.spawnSync(["podman", "image", "exists", ref]);
  return proc.success;
}

export interface BuildImageOptions {
  dockerfilePath: string;
  imageRef: string;
  uid: number;
  gid: number;
  workdir: string;
  rebuild: boolean;
}

/**
 * Build the image if it doesn't exist or if rebuild is forced.
 */
export async function buildImageIfNeeded(
  opts: BuildImageOptions,
): Promise<void> {
  if (!opts.rebuild && imageExists(opts.imageRef)) {
    return;
  }

  console.log(`Building image ${opts.imageRef}...`);
  const proc = Bun.spawn(
    [
      "podman",
      "build",
      "--build-arg",
      `SANDBOX_UID=${opts.uid}`,
      "--build-arg",
      `SANDBOX_GID=${opts.gid}`,
      "--build-arg",
      `SANDBOX_WORKDIR=${opts.workdir}`,
      "-f",
      opts.dockerfilePath,
      "-t",
      opts.imageRef,
      // Build context — our Dockerfiles don't COPY from context, but podman requires it
      dirname(opts.dockerfilePath),
    ],
    {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    },
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Image build failed with exit code ${exitCode}`);
  }
}
