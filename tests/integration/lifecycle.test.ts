/**
 * Integration tests for the full container lifecycle.
 * Requires Podman installed. Gated behind SJ_INTEGRATION_TESTS=1.
 * These tests are slow (image builds) — timeouts are set accordingly.
 */
import { describe, test, expect, beforeAll } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { dockerfileContentHash, imageExists, writeGeneratedDockerfile } from "../../src/image.ts";
import { loadPreset } from "../../src/preset-resolution.ts";
import { generateDockerfile } from "../../src/dockerfile-gen.ts";
import { bootstrapHarnessConfig } from "../../src/prep.ts";
import {
  generateEntrypoint,
  writeEntrypointTempFile,
  cleanupEntrypointTempFile,
} from "../../src/entrypoint.ts";
import { CONFIG_DEFAULTS } from "../../src/config.ts";

const SKIP = !process.env.SJ_INTEGRATION_TESTS;
const describeIf = SKIP ? describe.skip : describe;

const WORKDIR = "/workdirs/test-project";

/**
 * Build the full-stack image with our standard build args and return its ref.
 * Reuses existing image if content hash matches.
 */
async function ensureFullStackImage(): Promise<string> {
  const preset = loadPreset("full-stack", "/tmp/dummy");
  const dockerfileContent = generateDockerfile(preset.units);
  const hash = dockerfileContentHash(dockerfileContent);
  const ref = `sj-full-stack:${hash}`;

  if (imageExists(ref)) {
    return ref;
  }

  const uid = process.getuid!();
  const gid = process.getgid!();
  const { path: dockerfilePath, cleanup } = await writeGeneratedDockerfile(dockerfileContent);

  try {
    const proc = Bun.spawnSync(
      [
        "podman",
        "build",
        "--build-arg", `SANDBOX_UID=${uid}`,
        "--build-arg", `SANDBOX_GID=${gid}`,
        "--build-arg", `SANDBOX_WORKDIR=${WORKDIR}`,
        "-f", dockerfilePath,
        "-t", ref,
        ".",
      ],
      { stdin: "inherit", stdout: "inherit", stderr: "inherit" },
    );

    if (!proc.success) {
      throw new Error(
        `Failed to build integration test image: exit code ${proc.exitCode}`,
      );
    }
  } finally {
    await cleanup();
  }

  return ref;
}

/** Run a command inside the full-stack image and return stdout */
function podmanRun(ref: string, ...cmd: string[]): string {
  const proc = Bun.spawnSync(
    ["podman", "run", "--rm", "--userns=keep-id", ref, ...cmd],
    { stdout: "pipe", stderr: "pipe" },
  );
  return proc.stdout.toString().trim();
}

describeIf("integration: container lifecycle", () => {
  let ref: string;

  // Image build can take minutes on first run
  beforeAll(async () => {
    ref = await ensureFullStackImage();
  }, 600_000);

  test("image exists with content-hash tag", () => {
    expect(imageExists(ref)).toBe(true);
  });

  test("imageExists returns false for nonexistent image", () => {
    expect(imageExists("sj-nonexistent:000000000000")).toBe(false);
  });

  test("claude binary exists at /usr/local/bin/claude", () => {
    expect(podmanRun(ref, "which", "claude")).toBe("/usr/local/bin/claude");
  });

  test("codex binary is on PATH", () => {
    expect(podmanRun(ref, "which", "codex")).toContain("codex");
  });

  test("python packages are importable", () => {
    const output = podmanRun(
      ref,
      "python3",
      "-c",
      "import pandas, openpyxl; print('ok')",
    );
    expect(output).toBe("ok");
  });

  test("node v24 is available", () => {
    expect(podmanRun(ref, "node", "--version")).toStartWith("v24");
  });

  test("zsh is available", () => {
    expect(podmanRun(ref, "zsh", "--version")).toContain("zsh");
  });

  test("/usr/local/bin is writable by sandboxuser", () => {
    const proc = Bun.spawnSync(
      [
        "podman", "run", "--rm", "--userns=keep-id",
        ref, "touch", "/usr/local/bin/sj-write-test",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    expect(proc.success).toBe(true);
  });

  test("workdir exists at expected path", () => {
    expect(podmanRun(ref, "ls", "-d", WORKDIR)).toBe(WORKDIR);
  });
});

describeIf("integration: harness-config mount", () => {
  let ref: string;
  let tmpDir: string;

  beforeAll(async () => {
    ref = await ensureFullStackImage();
    tmpDir = mkdtempSync(join(tmpdir(), "sj-integ-harness-"));
  }, 600_000);

  test("files written to $HOME persist via harness-config mount", () => {
    const harnessHome = join(tmpDir, "harness-claude");
    bootstrapHarnessConfig(harnessHome);

    const proc = Bun.spawnSync(
      [
        "podman", "run", "--rm", "--userns=keep-id",
        "-v", `${harnessHome}:/home/sandboxuser`,
        "--env", "HOME=/home/sandboxuser",
        ref,
        "bash", "-c", "echo 'persisted' > /home/sandboxuser/test-persist.txt",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    expect(proc.success).toBe(true);

    const content = readFileSync(
      join(harnessHome, "test-persist.txt"),
      "utf8",
    );
    expect(content.trim()).toBe("persisted");
  });
});

describeIf("integration: security defaults", () => {
  let ref: string;

  beforeAll(async () => {
    ref = await ensureFullStackImage();
  }, 600_000);

  test("capabilities are dropped with --cap-drop=ALL", () => {
    const proc = Bun.spawnSync(
      [
        "podman", "run", "--rm", "--userns=keep-id",
        "--cap-drop=ALL", "--security-opt=no-new-privileges",
        ref, "cat", "/proc/self/status",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const output = proc.stdout.toString();
    const capEff = output.match(/CapEff:\s+(\S+)/);
    expect(capEff).not.toBeNull();
    expect(capEff![1]).toBe("0000000000000000");
  });

  test("no-new-privileges is set", () => {
    const proc = Bun.spawnSync(
      [
        "podman", "run", "--rm", "--userns=keep-id",
        "--cap-drop=ALL", "--security-opt=no-new-privileges",
        ref, "cat", "/proc/self/status",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const output = proc.stdout.toString();
    expect(output).toContain("NoNewPrivs:\t1");
  });
});

describeIf("integration: entrypoint generation", () => {
  test("generated entrypoint for shell is valid bash", async () => {
    const entrypoint = generateEntrypoint("shell", CONFIG_DEFAULTS);
    const path = await writeEntrypointTempFile(entrypoint);
    try {
      const check = Bun.spawnSync(["bash", "-n", path], {
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(check.success).toBe(true);
    } finally {
      await cleanupEntrypointTempFile(path);
    }
  });

  test("generated entrypoint for claude with all options is valid bash", async () => {
    const entrypoint = generateEntrypoint("claude", {
      ...CONFIG_DEFAULTS,
      autoUpdate: true,
      preRunScripts: ["echo hello", "npm install"],
    });
    const path = await writeEntrypointTempFile(entrypoint);
    try {
      const check = Bun.spawnSync(["bash", "-n", path], {
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(check.success).toBe(true);
    } finally {
      await cleanupEntrypointTempFile(path);
    }
  });
});

describeIf("integration: TTY env passthrough", () => {
  let ref: string;

  beforeAll(async () => {
    ref = await ensureFullStackImage();
  }, 600_000);

  test("TTY env vars are set inside container when passed via --env", () => {
    const proc = Bun.spawnSync(
      [
        "podman", "run", "--rm", "--userns=keep-id",
        "--env", "TERM=xterm-256color",
        "--env", "COLORTERM=truecolor",
        "--env", "LANG=en_US.UTF-8",
        ref, "bash", "-c", "echo $TERM $COLORTERM $LANG",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const output = proc.stdout.toString().trim();
    expect(output).toBe("xterm-256color truecolor en_US.UTF-8");
  });
});

describeIf("integration: rebuild", () => {
  test(
    "--rebuild forces a fresh build even when image exists",
    async () => {
      const ref = await ensureFullStackImage();
      const preset = loadPreset("full-stack", "/tmp/dummy");
      const dockerfileContent = generateDockerfile(preset.units);
      const rebuildTag = `${ref}-rebuild-test`;
      const { path: dockerfilePath, cleanup } = await writeGeneratedDockerfile(dockerfileContent);

      try {
        const proc = Bun.spawnSync(
          [
            "podman", "build", "--no-cache",
            "--build-arg", `SANDBOX_UID=${process.getuid!()}`,
            "--build-arg", `SANDBOX_GID=${process.getgid!()}`,
            "--build-arg", `SANDBOX_WORKDIR=${WORKDIR}`,
            "-f", dockerfilePath,
            "-t", rebuildTag,
            ".",
          ],
          { stdin: "inherit", stdout: "inherit", stderr: "inherit" },
        );
        expect(proc.success).toBe(true);
      } finally {
        await cleanup();
        Bun.spawnSync(["podman", "rmi", rebuildTag]);
      }
    },
    600_000,
  );
});
