import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolvePresetV2, loadPreset } from "../../src/preset-resolution.ts";
import { BUILT_IN_PRESETS_V2 } from "../../src/built-in-presets.ts";

describe("resolvePresetV2", () => {
  let tmpDir: string;
  const originalXdg = process.env.XDG_CONFIG_HOME;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "sj-preset-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    if (originalXdg !== undefined) {
      process.env.XDG_CONFIG_HOME = originalXdg;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }
  });

  test("finds per-repo preset", () => {
    const projectDir = join(tmpDir, "project");
    const presetDir = join(projectDir, ".sj", "presets", "my-preset");
    mkdirSync(presetDir, { recursive: true });
    writeFileSync(
      join(presetDir, "preset.json"),
      JSON.stringify({ name: "my-preset", units: [] }),
    );

    const result = resolvePresetV2("my-preset", projectDir);
    expect(result.origin).toBe("per-repo");
    expect(result.path).toContain("preset.json");
  });

  test("finds user-global preset", () => {
    const projectDir = join(tmpDir, "project");
    const xdgDir = join(tmpDir, "config");
    process.env.XDG_CONFIG_HOME = xdgDir;

    const presetDir = join(xdgDir, "sj", "presets", "my-preset");
    mkdirSync(presetDir, { recursive: true });
    writeFileSync(
      join(presetDir, "preset.json"),
      JSON.stringify({ name: "my-preset", units: [] }),
    );

    const result = resolvePresetV2("my-preset", projectDir);
    expect(result.origin).toBe("user");
  });

  test("per-repo overrides user-global", () => {
    const projectDir = join(tmpDir, "project");
    const xdgDir = join(tmpDir, "config");
    process.env.XDG_CONFIG_HOME = xdgDir;

    // User-global
    const userDir = join(xdgDir, "sj", "presets", "my-preset");
    mkdirSync(userDir, { recursive: true });
    writeFileSync(
      join(userDir, "preset.json"),
      JSON.stringify({ name: "my-preset", units: [] }),
    );

    // Per-repo
    const repoDir = join(projectDir, ".sj", "presets", "my-preset");
    mkdirSync(repoDir, { recursive: true });
    writeFileSync(
      join(repoDir, "preset.json"),
      JSON.stringify({ name: "my-preset", units: [] }),
    );

    const result = resolvePresetV2("my-preset", projectDir);
    expect(result.origin).toBe("per-repo");
  });

  test("finds built-in preset", () => {
    // Temporarily register a built-in preset
    const presetPath = join(tmpDir, "preset.json");
    writeFileSync(
      presetPath,
      JSON.stringify({ name: "test-preset", units: [] }),
    );
    BUILT_IN_PRESETS_V2["_test-builtin"] = presetPath;

    try {
      const result = resolvePresetV2(
        "_test-builtin",
        join(tmpDir, "project"),
      );
      expect(result.origin).toBe("built-in");
    } finally {
      delete BUILT_IN_PRESETS_V2["_test-builtin"];
    }
  });

  test("throws for unknown preset", () => {
    expect(() =>
      resolvePresetV2("nonexistent", join(tmpDir, "project")),
    ).toThrow(/Preset "nonexistent" not found/);
  });
});

describe("loadPreset", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "sj-preset-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function setupPresetWithUnits(
    presetName: string,
    presetManifest: object,
    units: Record<string, { manifest: object; snippets?: Record<string, string> }>,
  ): string {
    const projectDir = join(tmpDir, "project");

    // Create preset
    const presetDir = join(projectDir, ".sj", "presets", presetName);
    mkdirSync(presetDir, { recursive: true });
    writeFileSync(
      join(presetDir, "preset.json"),
      JSON.stringify(presetManifest),
    );

    // Create units
    for (const [name, unit] of Object.entries(units)) {
      const unitDir = join(projectDir, ".sj", "units", name);
      mkdirSync(unitDir, { recursive: true });
      writeFileSync(join(unitDir, "unit.json"), JSON.stringify(unit.manifest));
      for (const [file, content] of Object.entries(unit.snippets ?? {})) {
        writeFileSync(join(unitDir, file), content);
      }
    }

    return projectDir;
  }

  test("resolves all units referenced in preset", () => {
    const projectDir = setupPresetWithUnits(
      "test-preset",
      {
        name: "test-preset",
        units: [{ name: "unit-a" }, { name: "unit-b" }],
      },
      {
        "unit-a": { manifest: { description: "Unit A", apt: ["curl"] } },
        "unit-b": { manifest: { description: "Unit B", pip: ["requests"] } },
      },
    );

    const preset = loadPreset("test-preset", projectDir);
    expect(preset.name).toBe("test-preset");
    expect(preset.units).toHaveLength(2);
    expect(preset.units[0]!.name).toBe("unit-a");
    expect(preset.units[1]!.name).toBe("unit-b");
  });

  test("applies per-unit arg overrides", () => {
    const projectDir = setupPresetWithUnits(
      "test-preset",
      {
        name: "test-preset",
        units: [{ name: "node", args: { version: "20" } }],
      },
      {
        node: {
          manifest: {
            args: { version: { default: "22" } },
          },
        },
      },
    );

    const preset = loadPreset("test-preset", projectDir);
    expect(preset.units[0]!.resolvedArgs.version).toBe("20");
  });

  test("throws when unit not found", () => {
    const projectDir = join(tmpDir, "project");
    const presetDir = join(projectDir, ".sj", "presets", "bad-preset");
    mkdirSync(presetDir, { recursive: true });
    writeFileSync(
      join(presetDir, "preset.json"),
      JSON.stringify({
        name: "bad-preset",
        units: [{ name: "nonexistent-unit" }],
      }),
    );

    expect(() => loadPreset("bad-preset", projectDir)).toThrow(
      /Unit "nonexistent-unit" not found/,
    );
  });
});
