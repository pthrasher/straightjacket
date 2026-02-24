import { describe, test, expect } from "bun:test";
import { repoConfigDefaults, CONFIG_DEFAULTS } from "../../src/config.ts";

describe("repoConfigDefaults", () => {
  test("excludes rebuild", () => {
    const defaults = repoConfigDefaults();
    expect(defaults).not.toHaveProperty("rebuild");
  });

  test("excludes agents", () => {
    const defaults = repoConfigDefaults();
    expect(defaults).not.toHaveProperty("agents");
  });

  test("includes all other CONFIG_DEFAULTS fields", () => {
    const defaults = repoConfigDefaults();
    expect(defaults).toHaveProperty("defaultAgent", CONFIG_DEFAULTS.defaultAgent);
    expect(defaults).toHaveProperty("defaultPreset", CONFIG_DEFAULTS.defaultPreset);
    expect(defaults).toHaveProperty("autoUpdate", CONFIG_DEFAULTS.autoUpdate);
    expect(defaults).toHaveProperty("gitConfigSync", CONFIG_DEFAULTS.gitConfigSync);
    expect(defaults).toHaveProperty("githubCli", CONFIG_DEFAULTS.githubCli);
    expect(defaults).toHaveProperty("preRunScripts");
    expect(defaults.preRunScripts).toEqual([]);
  });

  test("produces valid JSON round-trip", () => {
    const defaults = repoConfigDefaults();
    const json = JSON.stringify(defaults, null, 2);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(defaults);
  });
});
