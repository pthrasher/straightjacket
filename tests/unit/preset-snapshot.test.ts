import { describe, test, expect } from "bun:test";
import { loadPreset } from "../../src/preset-resolution.ts";
import { generateDockerfile } from "../../src/dockerfile-gen.ts";

// Use a non-existent project dir so all units resolve from built-in
const NO_PROJECT = "/nonexistent-project-for-snapshot-tests";

describe("full-stack preset generation", () => {
  const preset = loadPreset("full-stack", NO_PROJECT);
  const dockerfile = generateDockerfile(preset.units);

  test("has all expected stages", () => {
    expect(dockerfile).toContain("FROM ubuntu:24.04 AS system-deps");
    expect(dockerfile).toContain("FROM system-deps AS user-setup");
    expect(dockerfile).toContain("FROM user-setup AS agents");
  });

  test("has no build stages (no multi-stage units)", () => {
    // full-stack has no units with build.Dockerfile
    expect(dockerfile).not.toContain("AS unit-");
  });

  test("includes dev-utils apt packages", () => {
    expect(dockerfile).toContain("git");
    expect(dockerfile).toContain("zsh");
    expect(dockerfile).toContain("ripgrep");
    expect(dockerfile).toContain("sqlite3");
    expect(dockerfile).toContain("build-essential");
  });

  test("includes node repo and package", () => {
    expect(dockerfile).toContain("nodesource");
    expect(dockerfile).toContain("nodejs");
    expect(dockerfile).toContain("UNIT_NODE_VERSION=24");
  });

  test("includes bun install", () => {
    expect(dockerfile).toContain("bun.sh/install");
  });

  test("includes github-cli repo and package", () => {
    expect(dockerfile).toContain("github-cli");
    expect(dockerfile).toContain("gh");
  });

  test("includes doc-utils apt and pip packages", () => {
    expect(dockerfile).toContain("pandoc");
    expect(dockerfile).toContain("imagemagick");
    expect(dockerfile).toContain("openpyxl");
    expect(dockerfile).toContain("beautifulsoup4");
    expect(dockerfile).toContain("python-docx");
  });

  test("includes dev-utils convenience symlinks", () => {
    expect(dockerfile).toContain("batcat");
    expect(dockerfile).toContain("fdfind");
  });

  test("includes user-setup stage", () => {
    expect(dockerfile).toContain("SANDBOX_UID");
    expect(dockerfile).toContain("useradd");
    expect(dockerfile).toContain("sandboxuser");
  });

  test("includes agent installation", () => {
    expect(dockerfile).toContain("@openai/codex");
    expect(dockerfile).toContain("claude.ai/install.sh");
  });

  test("ends with USER sandboxuser", () => {
    expect(dockerfile).toContain("USER sandboxuser");
    expect(dockerfile).toContain('CMD ["bash"]');
  });
});

describe("full-stack-playwright preset generation", () => {
  const preset = loadPreset("full-stack-playwright", NO_PROJECT);
  const dockerfile = generateDockerfile(preset.units);

  test("includes everything from full-stack", () => {
    expect(dockerfile).toContain("ripgrep");
    expect(dockerfile).toContain("nodejs");
    expect(dockerfile).toContain("bun.sh/install");
    expect(dockerfile).toContain("openpyxl");
  });

  test("includes playwright pip package", () => {
    expect(dockerfile).toContain("playwright");
  });

  test("includes playwright install-deps in post-install slot", () => {
    const systemDepsIdx = dockerfile.indexOf("AS system-deps");
    const userSetupIdx = dockerfile.indexOf("AS user-setup");
    const installDepsIdx = dockerfile.indexOf("install-deps chromium");
    expect(installDepsIdx).toBeGreaterThan(systemDepsIdx);
    expect(installDepsIdx).toBeLessThan(userSetupIdx);
  });

  test("includes playwright browser install in post-agent-install slot", () => {
    const agentsIdx = dockerfile.indexOf("AS agents");
    const finalizeIdx = dockerfile.indexOf("# === Finalize");
    const browserIdx = dockerfile.indexOf("playwright install chromium");
    expect(browserIdx).toBeGreaterThan(agentsIdx);
    expect(browserIdx).toBeLessThan(finalizeIdx);
  });

  test("includes PLAYWRIGHT_BROWSERS_PATH env", () => {
    expect(dockerfile).toContain("PLAYWRIGHT_BROWSERS_PATH");
  });
});

describe("il2cpp-re preset generation", () => {
  const preset = loadPreset("il2cpp-re", NO_PROJECT);
  const dockerfile = generateDockerfile(preset.units);

  test("has ghidra and jadx build stages", () => {
    expect(dockerfile).toContain("FROM ubuntu:24.04 AS unit-ghidra-build");
    expect(dockerfile).toContain("FROM ubuntu:24.04 AS unit-jadx-build");
  });

  test("build stages appear before system-deps", () => {
    const ghidraBuildIdx = dockerfile.indexOf("unit-ghidra-build");
    const jadxBuildIdx = dockerfile.indexOf("unit-jadx-build");
    const systemDepsIdx = dockerfile.indexOf("AS system-deps");
    expect(ghidraBuildIdx).toBeLessThan(systemDepsIdx);
    expect(jadxBuildIdx).toBeLessThan(systemDepsIdx);
  });

  test("uses node version 20 (overridden from default 24)", () => {
    expect(dockerfile).toContain("UNIT_NODE_VERSION=20");
  });

  test("includes COPY --from for ghidra and jadx", () => {
    expect(dockerfile).toContain("COPY --from=unit-ghidra-build");
    expect(dockerfile).toContain("COPY --from=unit-jadx-build");
  });

  test("includes il2cpp-specific apt packages", () => {
    expect(dockerfile).toContain("clang");
    expect(dockerfile).toContain("radare2");
    expect(dockerfile).toContain("mono-complete");
  });

  test("includes il2cpp-specific pip packages", () => {
    expect(dockerfile).toContain("frida-tools");
    expect(dockerfile).toContain("UnityPy");
    expect(dockerfile).toContain("capstone");
  });

  test("includes java, dotnet, and rust setup", () => {
    expect(dockerfile).toContain("JAVA_HOME");
    expect(dockerfile).toContain("DOTNET_ROOT");
    expect(dockerfile).toContain("RUSTUP_HOME");
    expect(dockerfile).toContain("CARGO_HOME");
  });

  test("includes ghidra env", () => {
    expect(dockerfile).toContain("GHIDRA_HOME=/opt/ghidra");
  });

  test("does NOT include doc-utils packages (not in il2cpp-re)", () => {
    expect(dockerfile).not.toContain("openpyxl");
    expect(dockerfile).not.toContain("python-docx");
  });
});
