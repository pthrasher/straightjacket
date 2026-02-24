import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolvePreset, BUILT_IN_PRESETS } from "../../src/presets.ts";

let tmpDir: string;
let originalXdg: string | undefined;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "sj-presets-test-"));
  originalXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = join(tmpDir, "xdg-config");
});

afterEach(() => {
  if (originalXdg !== undefined) {
    process.env.XDG_CONFIG_HOME = originalXdg;
  } else {
    delete process.env.XDG_CONFIG_HOME;
  }
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("BUILT_IN_PRESETS", () => {
  test("contains full-stack", () => {
    expect(BUILT_IN_PRESETS["full-stack"]).toBeDefined();
  });

  test("contains full-stack-playwright", () => {
    expect(BUILT_IN_PRESETS["full-stack-playwright"]).toBeDefined();
  });

  test("contains il2cpp-re", () => {
    expect(BUILT_IN_PRESETS["il2cpp-re"]).toBeDefined();
  });

  test("embedded paths are readable", async () => {
    const content = await Bun.file(BUILT_IN_PRESETS["full-stack"]!).text();
    expect(content).toContain("FROM ubuntu:24.04");
  });
});

describe("resolvePreset", () => {
  test("resolves built-in preset by name", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    const result = resolvePreset("full-stack", projectDir);
    expect(result.name).toBe("full-stack");
    expect(result.origin).toBe("built-in");
    expect(result.dockerfilePath).toBe(BUILT_IN_PRESETS["full-stack"]!);
  });

  test("resolves built-in full-stack-playwright", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    const result = resolvePreset("full-stack-playwright", projectDir);
    expect(result.name).toBe("full-stack-playwright");
    expect(result.origin).toBe("built-in");
  });

  test("resolves built-in il2cpp-re", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    const result = resolvePreset("il2cpp-re", projectDir);
    expect(result.name).toBe("il2cpp-re");
    expect(result.origin).toBe("built-in");
  });

  test("per-repo preset overrides built-in", () => {
    const projectDir = join(tmpDir, "project");
    const presetDir = join(projectDir, ".sj", "presets", "full-stack");
    mkdirSync(presetDir, { recursive: true });
    writeFileSync(join(presetDir, "Dockerfile"), "FROM alpine:latest\n");

    const result = resolvePreset("full-stack", projectDir);
    expect(result.origin).toBe("per-repo");
    expect(result.dockerfilePath).toBe(join(presetDir, "Dockerfile"));
  });

  test("user preset overrides built-in", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    const userPresetDir = join(
      tmpDir,
      "xdg-config",
      "sj",
      "presets",
      "full-stack",
    );
    mkdirSync(userPresetDir, { recursive: true });
    writeFileSync(join(userPresetDir, "Dockerfile"), "FROM alpine:latest\n");

    const result = resolvePreset("full-stack", projectDir);
    expect(result.origin).toBe("user");
    expect(result.dockerfilePath).toBe(join(userPresetDir, "Dockerfile"));
  });

  test("per-repo preset overrides user preset", () => {
    const projectDir = join(tmpDir, "project");

    // Create both per-repo and user presets
    const repoPresetDir = join(projectDir, ".sj", "presets", "my-preset");
    mkdirSync(repoPresetDir, { recursive: true });
    writeFileSync(join(repoPresetDir, "Dockerfile"), "FROM repo\n");

    const userPresetDir = join(
      tmpDir,
      "xdg-config",
      "sj",
      "presets",
      "my-preset",
    );
    mkdirSync(userPresetDir, { recursive: true });
    writeFileSync(join(userPresetDir, "Dockerfile"), "FROM user\n");

    const result = resolvePreset("my-preset", projectDir);
    expect(result.origin).toBe("per-repo");
  });

  test("throws descriptive error for unknown preset", () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    expect(() => resolvePreset("nonexistent", projectDir)).toThrow(
      /Preset "nonexistent" not found/,
    );
  });
});
