import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  xdgConfigHome,
  sjConfigDir,
  sjGlobalConfigFile,
  harnessConfigDir,
  userPresetsDir,
  userUnitsDir,
  repoConfigFile,
  repoPresetsDir,
  repoUnitsDir,
  containerWorkdir,
} from "../../src/paths.ts";

describe("xdgConfigHome", () => {
  const original = process.env.XDG_CONFIG_HOME;

  afterEach(() => {
    if (original !== undefined) {
      process.env.XDG_CONFIG_HOME = original;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }
  });

  test("uses XDG_CONFIG_HOME when set", () => {
    process.env.XDG_CONFIG_HOME = "/custom/config";
    expect(xdgConfigHome()).toBe("/custom/config");
  });

  test("falls back to ~/.config when XDG_CONFIG_HOME is unset", () => {
    delete process.env.XDG_CONFIG_HOME;
    const result = xdgConfigHome();
    expect(result).toEndWith("/.config");
    expect(result).not.toContain("undefined");
  });
});

describe("sjConfigDir", () => {
  const original = process.env.XDG_CONFIG_HOME;

  afterEach(() => {
    if (original !== undefined) {
      process.env.XDG_CONFIG_HOME = original;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }
  });

  test("returns <xdg>/sj", () => {
    process.env.XDG_CONFIG_HOME = "/custom/config";
    expect(sjConfigDir()).toBe("/custom/config/sj");
  });
});

describe("sjGlobalConfigFile", () => {
  const original = process.env.XDG_CONFIG_HOME;

  afterEach(() => {
    if (original !== undefined) {
      process.env.XDG_CONFIG_HOME = original;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }
  });

  test("returns <xdg>/sj/config.json", () => {
    process.env.XDG_CONFIG_HOME = "/custom/config";
    expect(sjGlobalConfigFile()).toBe("/custom/config/sj/config.json");
  });
});

describe("harnessConfigDir", () => {
  const original = process.env.XDG_CONFIG_HOME;

  afterEach(() => {
    if (original !== undefined) {
      process.env.XDG_CONFIG_HOME = original;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }
  });

  test("returns default path for agent", () => {
    process.env.XDG_CONFIG_HOME = "/custom/config";
    expect(harnessConfigDir("claude")).toBe(
      "/custom/config/sj/harness-config/claude",
    );
  });

  test("returns override path when provided", () => {
    process.env.XDG_CONFIG_HOME = "/custom/config";
    expect(harnessConfigDir("codex", "/my/custom/path")).toBe(
      "/my/custom/path",
    );
  });
});

describe("userPresetsDir", () => {
  const original = process.env.XDG_CONFIG_HOME;

  afterEach(() => {
    if (original !== undefined) {
      process.env.XDG_CONFIG_HOME = original;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }
  });

  test("returns <xdg>/sj/presets", () => {
    process.env.XDG_CONFIG_HOME = "/custom/config";
    expect(userPresetsDir()).toBe("/custom/config/sj/presets");
  });
});

describe("repoConfigFile", () => {
  test("returns <project>/.sj/config.json", () => {
    expect(repoConfigFile("/home/user/my-project")).toBe(
      "/home/user/my-project/.sj/config.json",
    );
  });
});

describe("repoPresetsDir", () => {
  test("returns <project>/.sj/presets", () => {
    expect(repoPresetsDir("/home/user/my-project")).toBe(
      "/home/user/my-project/.sj/presets",
    );
  });
});

describe("userUnitsDir", () => {
  const original = process.env.XDG_CONFIG_HOME;

  afterEach(() => {
    if (original !== undefined) {
      process.env.XDG_CONFIG_HOME = original;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }
  });

  test("returns <xdg>/sj/units", () => {
    process.env.XDG_CONFIG_HOME = "/custom/config";
    expect(userUnitsDir()).toBe("/custom/config/sj/units");
  });
});

describe("repoUnitsDir", () => {
  test("returns <project>/.sj/units", () => {
    expect(repoUnitsDir("/home/user/my-project")).toBe(
      "/home/user/my-project/.sj/units",
    );
  });
});

describe("containerWorkdir", () => {
  test("returns /workdirs/<name>", () => {
    expect(containerWorkdir("my-app")).toBe("/workdirs/my-app");
  });

  test("handles names with hyphens", () => {
    expect(containerWorkdir("my-cool-project")).toBe(
      "/workdirs/my-cool-project",
    );
  });
});
