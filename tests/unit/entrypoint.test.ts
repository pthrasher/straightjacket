import { describe, test, expect } from "bun:test";
import {
  generateEntrypoint,
  writeEntrypointTempFile,
  cleanupEntrypointTempFile,
} from "../../src/entrypoint.ts";
import { CONFIG_DEFAULTS } from "../../src/config.ts";
import { existsSync } from "node:fs";
import type { SjConfig, ResolvedUnit } from "../../src/types.ts";

function withConfig(overrides: Partial<SjConfig> = {}): SjConfig {
  return { ...CONFIG_DEFAULTS, ...overrides };
}

function makeUnit(overrides: Partial<ResolvedUnit> & { name: string }): ResolvedUnit {
  return {
    manifest: {},
    resolvedArgs: {},
    buildSnippet: null,
    postInstallSnippet: null,
    postAgentInstallSnippet: null,
    origin: "built-in",
    ...overrides,
  };
}

function gen(agent: string, config?: Partial<SjConfig>, units: ResolvedUnit[] = []) {
  return generateEntrypoint({ agent: agent as any, config: withConfig(config), units });
}

describe("generateEntrypoint", () => {
  test("starts with shebang and set -euo pipefail", () => {
    const script = gen("shell");
    expect(script).toStartWith("#!/usr/bin/env bash\nset -euo pipefail\n");
  });

  test("sets up USER and PATH environment", () => {
    const script = gen("shell");
    expect(script).toContain('export USER="${USER:-sandboxuser}"');
    expect(script).toContain('export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"');
  });

  test("includes SSH agent check", () => {
    const script = gen("shell");
    expect(script).toContain("SSH_AUTH_SOCK");
    expect(script).toContain("warning: SSH_AUTH_SOCK is not set");
    expect(script).toContain("is not a valid socket");
  });

  test("shell agent launches zsh with exec", () => {
    const script = gen("shell");
    expect(script).toContain("exec zsh");
  });

  test("claude agent sets experimental env and launches with exec", () => {
    const script = gen("claude");
    expect(script).toContain(
      "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1",
    );
    expect(script).toContain(
      "exec claude --allow-dangerously-skip-permissions --dangerously-skip-permissions",
    );
  });

  test("codex agent launches with exec and bypass flag", () => {
    const script = gen("codex");
    expect(script).toContain(
      "exec codex --dangerously-bypass-approvals-and-sandbox",
    );
  });

  test("claude with autoUpdate includes update command", () => {
    const script = gen("claude", { autoUpdate: true });
    expect(script).toContain("claude update || true");
  });

  test("claude without autoUpdate omits update command", () => {
    const script = gen("claude", { autoUpdate: false });
    expect(script).not.toContain("claude update");
  });

  test("codex with autoUpdate includes npm update command", () => {
    const script = gen("codex", { autoUpdate: true });
    expect(script).toContain("npm update -g @openai/codex || true");
  });

  test("codex without autoUpdate omits npm update command", () => {
    const script = gen("codex", { autoUpdate: false });
    expect(script).not.toContain("npm update");
  });

  test("includes preRunScripts when configured", () => {
    const script = gen("shell", { preRunScripts: ["echo hello", "npm install"] });
    expect(script).toContain("# ── Pre-run scripts ──");
    expect(script).toContain("bash -c 'echo hello'");
    expect(script).toContain("bash -c 'npm install'");
  });

  test("omits preRunScripts section when empty", () => {
    const script = gen("shell", { preRunScripts: [] });
    expect(script).not.toContain("Pre-run scripts");
  });

  test("properly escapes single quotes in preRunScripts", () => {
    const script = gen("shell", { preRunScripts: ["echo 'hello world'"] });
    expect(script).toContain("bash -c 'echo '\\''hello world'\\'''");
  });

  test("includes gh auth block when githubCli is true", () => {
    const script = gen("shell", { githubCli: true });
    expect(script).toContain("# ── GitHub CLI auth ──");
    expect(script).toContain("gh auth status");
    expect(script).toContain("gh auth login");
  });

  test("omits gh auth block when githubCli is false", () => {
    const script = gen("shell", { githubCli: false });
    expect(script).not.toContain("GitHub CLI auth");
    expect(script).not.toContain("gh auth status");
    expect(script).not.toContain("gh auth login");
  });

  test("ends with newline", () => {
    const script = gen("shell");
    expect(script).toEndWith("\n");
  });

  test("prepends unit pathDirs to PATH", () => {
    const units = [
      makeUnit({ name: "rust", manifest: { pathDirs: ["/opt/cargo/bin"] } }),
      makeUnit({ name: "jadx", manifest: { pathDirs: ["/opt/jadx/bin"] } }),
    ];
    const script = gen("shell", {}, units);
    expect(script).toContain(
      'export PATH="/opt/cargo/bin:/opt/jadx/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"',
    );
  });

  test("deduplicates pathDirs", () => {
    const units = [
      makeUnit({ name: "unit-a", manifest: { pathDirs: ["/opt/cargo/bin", "/opt/jadx/bin"] } }),
      makeUnit({ name: "unit-b", manifest: { pathDirs: ["/opt/cargo/bin"] } }),
    ];
    const script = gen("shell", {}, units);
    // /opt/cargo/bin should appear only once
    const pathLine = script.split("\n").find((l) => l.startsWith("export PATH="))!;
    const cargoCount = (pathLine.match(/\/opt\/cargo\/bin/g) || []).length;
    expect(cargoCount).toBe(1);
  });

  test("PATH has no unit dirs when no pathDirs specified", () => {
    const units = [
      makeUnit({ name: "dev-utils", manifest: { apt: ["git"] } }),
    ];
    const script = gen("shell", {}, units);
    expect(script).toContain('export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"');
  });
});

describe("writeEntrypointTempFile", () => {
  test("writes file to temp directory and returns path", async () => {
    const content = "#!/usr/bin/env bash\necho hello\n";
    const path = await writeEntrypointTempFile(content);

    expect(path).toContain("sj-entrypoint-");
    expect(path).toEndWith("/entrypoint.sh");
    expect(existsSync(path)).toBe(true);

    const written = await Bun.file(path).text();
    expect(written).toBe(content);

    await cleanupEntrypointTempFile(path);
  });

  test("cleanup removes the file and directory", async () => {
    const content = "#!/usr/bin/env bash\n";
    const path = await writeEntrypointTempFile(content);
    expect(existsSync(path)).toBe(true);

    await cleanupEntrypointTempFile(path);
    expect(existsSync(path)).toBe(false);
  });

  test("cleanup is best-effort (no throw on missing file)", async () => {
    // Should not throw
    await cleanupEntrypointTempFile("/nonexistent/path/entrypoint.sh");
  });
});
