import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveConfig, CONFIG_DEFAULTS } from "../../src/config.ts";

let tmpDir: string;
let originalXdg: string | undefined;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "sj-config-test-"));
  originalXdg = process.env.XDG_CONFIG_HOME;
  // Point XDG to temp dir so global config reads from there
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

describe("resolveConfig", () => {
  test("returns defaults when no config files exist", async () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    const config = await resolveConfig(projectDir);
    expect(config.defaultAgent).toBe("shell");
    expect(config.defaultPreset).toBe("full-stack");
    expect(config.autoUpdate).toBe(false);
    expect(config.gitConfigSync).toBe(true);
    expect(config.preRunScripts).toEqual([]);
    expect(config.rebuild).toBe(false);
    expect(config.agents).toEqual({});
  });

  test("global config overrides defaults", async () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    // Create global config
    const globalDir = join(tmpDir, "xdg-config", "sj");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(
      join(globalDir, "config.json"),
      JSON.stringify({ defaultAgent: "claude", autoUpdate: true }),
    );

    const config = await resolveConfig(projectDir);
    expect(config.defaultAgent).toBe("claude");
    expect(config.autoUpdate).toBe(true);
    // Unset values still come from defaults
    expect(config.defaultPreset).toBe("full-stack");
    expect(config.gitConfigSync).toBe(true);
  });

  test("per-repo config overrides global config", async () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(join(projectDir, ".sj"), { recursive: true });

    // Global config sets defaultAgent to claude
    const globalDir = join(tmpDir, "xdg-config", "sj");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(
      join(globalDir, "config.json"),
      JSON.stringify({ defaultAgent: "claude", defaultPreset: "custom" }),
    );

    // Per-repo config overrides defaultAgent to codex
    writeFileSync(
      join(projectDir, ".sj", "config.json"),
      JSON.stringify({ defaultAgent: "codex" }),
    );

    const config = await resolveConfig(projectDir);
    expect(config.defaultAgent).toBe("codex");
    // Global value that wasn't overridden by per-repo
    expect(config.defaultPreset).toBe("custom");
  });

  test("CLI overrides win over everything", async () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(join(projectDir, ".sj"), { recursive: true });

    // Global config
    const globalDir = join(tmpDir, "xdg-config", "sj");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(
      join(globalDir, "config.json"),
      JSON.stringify({ defaultAgent: "claude" }),
    );

    // Per-repo config
    writeFileSync(
      join(projectDir, ".sj", "config.json"),
      JSON.stringify({ defaultAgent: "codex" }),
    );

    // CLI override wins
    const config = await resolveConfig(projectDir, {
      defaultAgent: "shell",
    });
    expect(config.defaultAgent).toBe("shell");
  });

  test("undefined CLI overrides do not clobber real values", async () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    const globalDir = join(tmpDir, "xdg-config", "sj");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(
      join(globalDir, "config.json"),
      JSON.stringify({ defaultAgent: "claude" }),
    );

    const config = await resolveConfig(projectDir, {
      rebuild: undefined,
    });
    expect(config.defaultAgent).toBe("claude");
    expect(config.rebuild).toBe(false);
  });

  test("deep merges agents object", async () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(join(projectDir, ".sj"), { recursive: true });

    const globalDir = join(tmpDir, "xdg-config", "sj");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(
      join(globalDir, "config.json"),
      JSON.stringify({
        agents: {
          claude: { configPath: "/global/claude" },
          codex: { configPath: "/global/codex" },
        },
      }),
    );

    // Per-repo only overrides claude
    writeFileSync(
      join(projectDir, ".sj", "config.json"),
      JSON.stringify({
        agents: { claude: { configPath: "/repo/claude" } },
      }),
    );

    const config = await resolveConfig(projectDir);
    expect(config.agents.claude?.configPath).toBe("/repo/claude");
    expect(config.agents.codex?.configPath).toBe("/global/codex");
  });

  test("handles malformed global config gracefully", async () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    const globalDir = join(tmpDir, "xdg-config", "sj");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(join(globalDir, "config.json"), "not valid json{{{");

    const config = await resolveConfig(projectDir);
    // Falls back to defaults
    expect(config.defaultAgent).toBe("shell");
  });

  test("handles missing .sj directory gracefully", async () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });
    // No .sj/ directory at all

    const config = await resolveConfig(projectDir);
    expect(config.defaultAgent).toBe("shell");
  });

  test("rebuild CLI override works", async () => {
    const projectDir = join(tmpDir, "project");
    mkdirSync(projectDir, { recursive: true });

    const config = await resolveConfig(projectDir, { rebuild: true });
    expect(config.rebuild).toBe(true);
  });
});
