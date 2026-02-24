import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  unitArgName,
  resolveUnit,
  loadUnit,
  validateUnitRequirements,
} from "../../src/units.ts";
import { BUILT_IN_UNITS } from "../../src/built-in-units.ts";
import type { ResolvedUnit } from "../../src/types.ts";

describe("unitArgName", () => {
  test("converts to UNIT_<NAME>_<ARG> format", () => {
    expect(unitArgName("node", "version")).toBe("UNIT_NODE_VERSION");
  });

  test("handles hyphens in unit name", () => {
    expect(unitArgName("github-cli", "version")).toBe(
      "UNIT_GITHUB_CLI_VERSION",
    );
  });

  test("handles hyphens in arg name", () => {
    expect(unitArgName("rust", "default-toolchain")).toBe(
      "UNIT_RUST_DEFAULT_TOOLCHAIN",
    );
  });

  test("uppercases everything", () => {
    expect(unitArgName("myUnit", "someArg")).toBe("UNIT_MYUNIT_SOMEARG");
  });
});

describe("resolveUnit", () => {
  let tmpDir: string;
  const originalXdg = process.env.XDG_CONFIG_HOME;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "sj-unit-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    if (originalXdg !== undefined) {
      process.env.XDG_CONFIG_HOME = originalXdg;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }
  });

  test("finds per-repo unit", () => {
    const projectDir = join(tmpDir, "project");
    const unitDir = join(projectDir, ".sj", "units", "my-unit");
    mkdirSync(unitDir, { recursive: true });
    writeFileSync(
      join(unitDir, "unit.json"),
      JSON.stringify({ description: "test" }),
    );

    const result = resolveUnit("my-unit", projectDir);
    expect(result.origin).toBe("per-repo");
    expect(result.dir).toBe(unitDir);
  });

  test("finds user-global unit", () => {
    const projectDir = join(tmpDir, "project");
    const xdgDir = join(tmpDir, "config");
    process.env.XDG_CONFIG_HOME = xdgDir;

    const unitDir = join(xdgDir, "sj", "units", "my-unit");
    mkdirSync(unitDir, { recursive: true });
    writeFileSync(
      join(unitDir, "unit.json"),
      JSON.stringify({ description: "user unit" }),
    );

    const result = resolveUnit("my-unit", projectDir);
    expect(result.origin).toBe("user");
    expect(result.dir).toBe(unitDir);
  });

  test("per-repo overrides user-global", () => {
    const projectDir = join(tmpDir, "project");
    const xdgDir = join(tmpDir, "config");
    process.env.XDG_CONFIG_HOME = xdgDir;

    // User-global unit
    const userDir = join(xdgDir, "sj", "units", "my-unit");
    mkdirSync(userDir, { recursive: true });
    writeFileSync(
      join(userDir, "unit.json"),
      JSON.stringify({ description: "user" }),
    );

    // Per-repo unit
    const repoDir = join(projectDir, ".sj", "units", "my-unit");
    mkdirSync(repoDir, { recursive: true });
    writeFileSync(
      join(repoDir, "unit.json"),
      JSON.stringify({ description: "repo" }),
    );

    const result = resolveUnit("my-unit", projectDir);
    expect(result.origin).toBe("per-repo");
  });

  test("finds built-in unit", () => {
    // Temporarily register a built-in unit
    BUILT_IN_UNITS["_test-builtin"] = {
      manifest: join(tmpDir, "manifest.json"),
    };
    writeFileSync(
      join(tmpDir, "manifest.json"),
      JSON.stringify({ description: "built-in test" }),
    );

    try {
      const result = resolveUnit("_test-builtin", join(tmpDir, "project"));
      expect(result.origin).toBe("built-in");
      expect(result.builtIn).toBeDefined();
    } finally {
      delete BUILT_IN_UNITS["_test-builtin"];
    }
  });

  test("throws for unknown unit", () => {
    expect(() =>
      resolveUnit("nonexistent", join(tmpDir, "project")),
    ).toThrow(/Unit "nonexistent" not found/);
  });
});

describe("loadUnit", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "sj-unit-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function createUnit(
    name: string,
    manifest: object,
    snippets?: {
      postInstall?: string;
      postAgentInstall?: string;
      build?: string;
    },
  ): string {
    const projectDir = join(tmpDir, "project");
    const unitDir = join(projectDir, ".sj", "units", name);
    mkdirSync(unitDir, { recursive: true });
    writeFileSync(join(unitDir, "unit.json"), JSON.stringify(manifest));
    if (snippets?.postInstall) {
      writeFileSync(
        join(unitDir, "post-install.Dockerfile"),
        snippets.postInstall,
      );
    }
    if (snippets?.postAgentInstall) {
      writeFileSync(
        join(unitDir, "post-agent-install.Dockerfile"),
        snippets.postAgentInstall,
      );
    }
    if (snippets?.build) {
      writeFileSync(join(unitDir, "build.Dockerfile"), snippets.build);
    }
    return projectDir;
  }

  test("parses manifest correctly", () => {
    const projectDir = createUnit("test-unit", {
      description: "Test unit",
      apt: ["curl", "git"],
      pip: ["requests"],
    });

    const unit = loadUnit("test-unit", projectDir);
    expect(unit.name).toBe("test-unit");
    expect(unit.manifest.description).toBe("Test unit");
    expect(unit.manifest.apt).toEqual(["curl", "git"]);
    expect(unit.manifest.pip).toEqual(["requests"]);
    expect(unit.origin).toBe("per-repo");
  });

  test("reads post-install snippet", () => {
    const projectDir = createUnit(
      "test-unit",
      { description: "test" },
      { postInstall: "RUN echo 'hello'" },
    );

    const unit = loadUnit("test-unit", projectDir);
    expect(unit.postInstallSnippet).toBe("RUN echo 'hello'");
  });

  test("reads post-agent-install snippet", () => {
    const projectDir = createUnit(
      "test-unit",
      { description: "test" },
      { postAgentInstall: "RUN echo 'after agents'" },
    );

    const unit = loadUnit("test-unit", projectDir);
    expect(unit.postAgentInstallSnippet).toBe("RUN echo 'after agents'");
  });

  test("reads both snippet slots (multi-slot unit)", () => {
    const projectDir = createUnit(
      "test-unit",
      { description: "test" },
      {
        postInstall: "RUN echo 'install'",
        postAgentInstall: "RUN echo 'post-agent'",
      },
    );

    const unit = loadUnit("test-unit", projectDir);
    expect(unit.postInstallSnippet).toBe("RUN echo 'install'");
    expect(unit.postAgentInstallSnippet).toBe("RUN echo 'post-agent'");
  });

  test("reads build snippet", () => {
    const projectDir = createUnit(
      "test-unit",
      { description: "test" },
      { build: "RUN make all" },
    );

    const unit = loadUnit("test-unit", projectDir);
    expect(unit.buildSnippet).toBe("RUN make all");
  });

  test("returns null for missing optional snippets", () => {
    const projectDir = createUnit("test-unit", { description: "test" });

    const unit = loadUnit("test-unit", projectDir);
    expect(unit.postInstallSnippet).toBeNull();
    expect(unit.postAgentInstallSnippet).toBeNull();
    expect(unit.buildSnippet).toBeNull();
  });

  test("resolves arg defaults", () => {
    const projectDir = createUnit("test-unit", {
      args: {
        version: { default: "22", description: "Version" },
        flavor: { default: "stable" },
      },
    });

    const unit = loadUnit("test-unit", projectDir);
    expect(unit.resolvedArgs).toEqual({ version: "22", flavor: "stable" });
  });

  test("applies arg overrides", () => {
    const projectDir = createUnit("test-unit", {
      args: {
        version: { default: "22" },
        flavor: { default: "stable" },
      },
    });

    const unit = loadUnit("test-unit", projectDir, { version: "20" });
    expect(unit.resolvedArgs).toEqual({ version: "20", flavor: "stable" });
  });
});

describe("validateUnitRequirements", () => {
  function fakeUnit(
    name: string,
    requires?: string[],
  ): ResolvedUnit {
    return {
      name,
      manifest: { requires },
      resolvedArgs: {},
      buildSnippet: null,
      postInstallSnippet: null,
      postAgentInstallSnippet: null,
      origin: "built-in",
    };
  }

  test("returns empty array when all requirements met", () => {
    const units = [fakeUnit("node"), fakeUnit("playwright", ["node"])];
    expect(validateUnitRequirements(units)).toEqual([]);
  });

  test("returns warning when requirement missing", () => {
    const units = [fakeUnit("playwright", ["node"])];
    const warnings = validateUnitRequirements(units);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("playwright");
    expect(warnings[0]).toContain("node");
  });

  test("returns multiple warnings for multiple missing requirements", () => {
    const units = [fakeUnit("complex", ["node", "rust"])];
    const warnings = validateUnitRequirements(units);
    expect(warnings).toHaveLength(2);
  });

  test("handles units with no requirements", () => {
    const units = [fakeUnit("dev-utils"), fakeUnit("node")];
    expect(validateUnitRequirements(units)).toEqual([]);
  });
});
