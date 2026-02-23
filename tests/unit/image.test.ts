import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  dockerfileContentHash,
  imageRef,
  materializeDockerfile,
} from "../../src/image.ts";
import type { PresetSource } from "../../src/types.ts";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "sj-image-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("dockerfileContentHash", () => {
  test("returns a 12-char hex string", async () => {
    const dockerfilePath = join(tmpDir, "Dockerfile");
    writeFileSync(dockerfilePath, "FROM ubuntu:24.04\n");

    const hash = await dockerfileContentHash(dockerfilePath);
    expect(hash).toHaveLength(12);
    expect(hash).toMatch(/^[0-9a-f]{12}$/);
  });

  test("is deterministic for same content", async () => {
    const path1 = join(tmpDir, "Dockerfile1");
    const path2 = join(tmpDir, "Dockerfile2");
    writeFileSync(path1, "FROM ubuntu:24.04\nRUN apt-get update\n");
    writeFileSync(path2, "FROM ubuntu:24.04\nRUN apt-get update\n");

    const hash1 = await dockerfileContentHash(path1);
    const hash2 = await dockerfileContentHash(path2);
    expect(hash1).toBe(hash2);
  });

  test("changes when content changes", async () => {
    const path = join(tmpDir, "Dockerfile");

    writeFileSync(path, "FROM ubuntu:24.04\n");
    const hash1 = await dockerfileContentHash(path);

    writeFileSync(path, "FROM ubuntu:22.04\n");
    const hash2 = await dockerfileContentHash(path);

    expect(hash1).not.toBe(hash2);
  });
});

describe("imageRef", () => {
  test("built-in preset: sj-<name>:<hash>", () => {
    const preset: PresetSource = {
      name: "full-stack",
      dockerfilePath: "/embedded/Dockerfile",
      origin: "built-in",
    };
    const ref = imageRef(preset, "/home/user/my-project", "abc123def456");
    expect(ref).toBe("sj-full-stack:abc123def456");
  });

  test("user preset: sj-<name>:<hash>", () => {
    const preset: PresetSource = {
      name: "my-preset",
      dockerfilePath: "/config/sj/presets/my-preset/Dockerfile",
      origin: "user",
    };
    const ref = imageRef(preset, "/home/user/my-project", "abc123def456");
    expect(ref).toBe("sj-my-preset:abc123def456");
  });

  test("per-repo preset: sj-<parent>-<project>-<name>:<hash>", () => {
    const preset: PresetSource = {
      name: "custom",
      dockerfilePath: "/home/user/my-project/.sj/presets/custom/Dockerfile",
      origin: "per-repo",
    };
    const ref = imageRef(preset, "/home/user/my-project", "abc123def456");
    expect(ref).toBe("sj-user-my-project-custom:abc123def456");
  });
});

describe("materializeDockerfile", () => {
  test("built-in preset writes to temp file", async () => {
    // Create a fake Dockerfile to simulate a built-in preset
    const fakePath = join(tmpDir, "Dockerfile");
    writeFileSync(fakePath, "FROM ubuntu:24.04\nRUN echo built-in\n");

    const preset: PresetSource = {
      name: "test",
      dockerfilePath: fakePath,
      origin: "built-in",
    };

    const { path, cleanup } = await materializeDockerfile(preset);
    expect(path).toContain("sj-dockerfile-");
    expect(path).toEndWith("/Dockerfile");

    const content = await Bun.file(path).text();
    expect(content).toBe("FROM ubuntu:24.04\nRUN echo built-in\n");

    // Cleanup
    expect(cleanup).not.toBeNull();
    await cleanup!();
  });

  test("non-built-in preset returns original path", async () => {
    const fakePath = join(tmpDir, "Dockerfile");
    writeFileSync(fakePath, "FROM ubuntu:24.04\n");

    const preset: PresetSource = {
      name: "test",
      dockerfilePath: fakePath,
      origin: "per-repo",
    };

    const { path, cleanup } = await materializeDockerfile(preset);
    expect(path).toBe(fakePath);
    expect(cleanup).toBeNull();
  });

  test("user preset returns original path", async () => {
    const fakePath = join(tmpDir, "Dockerfile");
    writeFileSync(fakePath, "FROM ubuntu:24.04\n");

    const preset: PresetSource = {
      name: "test",
      dockerfilePath: fakePath,
      origin: "user",
    };

    const { path, cleanup } = await materializeDockerfile(preset);
    expect(path).toBe(fakePath);
    expect(cleanup).toBeNull();
  });
});
