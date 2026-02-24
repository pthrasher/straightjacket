import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  dockerfileContentHash,
  imageRef,
  writeGeneratedDockerfile,
} from "../../src/image.ts";
import type { ResolvedPreset } from "../../src/types.ts";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "sj-image-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function fakePreset(
  overrides: Partial<ResolvedPreset> & { name: string },
): ResolvedPreset {
  return {
    manifest: { name: overrides.name, units: [] },
    units: [],
    origin: "built-in",
    ...overrides,
  };
}

describe("dockerfileContentHash", () => {
  test("returns a 12-char hex string", () => {
    const hash = dockerfileContentHash("FROM ubuntu:24.04\n");
    expect(hash).toHaveLength(12);
    expect(hash).toMatch(/^[0-9a-f]{12}$/);
  });

  test("is deterministic for same content", () => {
    const hash1 = dockerfileContentHash("FROM ubuntu:24.04\nRUN apt-get update\n");
    const hash2 = dockerfileContentHash("FROM ubuntu:24.04\nRUN apt-get update\n");
    expect(hash1).toBe(hash2);
  });

  test("changes when content changes", () => {
    const hash1 = dockerfileContentHash("FROM ubuntu:24.04\n");
    const hash2 = dockerfileContentHash("FROM ubuntu:22.04\n");
    expect(hash1).not.toBe(hash2);
  });
});

describe("imageRef", () => {
  test("built-in preset: sj-<name>:<hash>", () => {
    const preset = fakePreset({ name: "full-stack", origin: "built-in" });
    const ref = imageRef(preset, "/home/user/my-project", "abc123def456");
    expect(ref).toBe("sj-full-stack:abc123def456");
  });

  test("user preset: sj-<name>:<hash>", () => {
    const preset = fakePreset({ name: "my-preset", origin: "user" });
    const ref = imageRef(preset, "/home/user/my-project", "abc123def456");
    expect(ref).toBe("sj-my-preset:abc123def456");
  });

  test("per-repo preset: sj-<parent>-<project>-<name>:<hash>", () => {
    const preset = fakePreset({ name: "custom", origin: "per-repo" });
    const ref = imageRef(preset, "/home/user/my-project", "abc123def456");
    expect(ref).toBe("sj-user-my-project-custom:abc123def456");
  });
});

describe("writeGeneratedDockerfile", () => {
  test("writes content to a temp file", async () => {
    const content = "FROM ubuntu:24.04\nRUN echo hello\n";
    const { path, cleanup } = await writeGeneratedDockerfile(content);

    expect(path).toContain("sj-dockerfile-");
    expect(path).toEndWith("/Dockerfile");

    const written = await Bun.file(path).text();
    expect(written).toBe(content);

    await cleanup();
  });

  test("cleanup removes temp files", async () => {
    const { path, cleanup } = await writeGeneratedDockerfile("FROM ubuntu:24.04\n");
    const { existsSync } = await import("node:fs");

    expect(existsSync(path)).toBe(true);
    await cleanup();
    expect(existsSync(path)).toBe(false);
  });
});
