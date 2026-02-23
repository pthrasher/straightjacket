import { describe, test, expect } from "bun:test";
import {
  generateEntrypoint,
  writeEntrypointTempFile,
  cleanupEntrypointTempFile,
} from "../../src/entrypoint.ts";
import { CONFIG_DEFAULTS } from "../../src/config.ts";
import { existsSync } from "node:fs";
import type { SjConfig } from "../../src/types.ts";

function withConfig(overrides: Partial<SjConfig> = {}): SjConfig {
  return { ...CONFIG_DEFAULTS, ...overrides };
}

describe("generateEntrypoint", () => {
  test("starts with shebang and set -euo pipefail", () => {
    const script = generateEntrypoint("shell", withConfig());
    expect(script).toStartWith("#!/usr/bin/env bash\nset -euo pipefail\n");
  });

  test("sets up USER and PATH environment", () => {
    const script = generateEntrypoint("shell", withConfig());
    expect(script).toContain('export USER="${USER:-sandboxuser}"');
    expect(script).toContain('export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"');
  });

  test("includes SSH agent check", () => {
    const script = generateEntrypoint("shell", withConfig());
    expect(script).toContain("SSH_AUTH_SOCK");
    expect(script).toContain("warning: SSH_AUTH_SOCK is not set");
    expect(script).toContain("is not a valid socket");
  });

  test("shell agent launches zsh with exec", () => {
    const script = generateEntrypoint("shell", withConfig());
    expect(script).toContain("exec zsh");
  });

  test("claude agent sets experimental env and launches with exec", () => {
    const script = generateEntrypoint("claude", withConfig());
    expect(script).toContain(
      "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1",
    );
    expect(script).toContain(
      "exec claude --allow-dangerously-skip-permissions --dangerously-skip-permissions",
    );
  });

  test("codex agent launches with exec and bypass flag", () => {
    const script = generateEntrypoint("codex", withConfig());
    expect(script).toContain(
      "exec codex --dangerously-bypass-approvals-and-sandbox",
    );
  });

  test("claude with autoUpdate includes update command", () => {
    const script = generateEntrypoint(
      "claude",
      withConfig({ autoUpdate: true }),
    );
    expect(script).toContain("claude update || true");
  });

  test("claude without autoUpdate omits update command", () => {
    const script = generateEntrypoint(
      "claude",
      withConfig({ autoUpdate: false }),
    );
    expect(script).not.toContain("claude update");
  });

  test("codex with autoUpdate includes npm update command", () => {
    const script = generateEntrypoint(
      "codex",
      withConfig({ autoUpdate: true }),
    );
    expect(script).toContain("npm update -g @openai/codex || true");
  });

  test("codex without autoUpdate omits npm update command", () => {
    const script = generateEntrypoint(
      "codex",
      withConfig({ autoUpdate: false }),
    );
    expect(script).not.toContain("npm update");
  });

  test("includes preRunScripts when configured", () => {
    const script = generateEntrypoint(
      "shell",
      withConfig({ preRunScripts: ["echo hello", "npm install"] }),
    );
    expect(script).toContain("# ── Pre-run scripts ──");
    expect(script).toContain("bash -c 'echo hello'");
    expect(script).toContain("bash -c 'npm install'");
  });

  test("omits preRunScripts section when empty", () => {
    const script = generateEntrypoint(
      "shell",
      withConfig({ preRunScripts: [] }),
    );
    expect(script).not.toContain("Pre-run scripts");
  });

  test("properly escapes single quotes in preRunScripts", () => {
    const script = generateEntrypoint(
      "shell",
      withConfig({ preRunScripts: ["echo 'hello world'"] }),
    );
    expect(script).toContain("bash -c 'echo '\\''hello world'\\'''");
  });

  test("ends with newline", () => {
    const script = generateEntrypoint("shell", withConfig());
    expect(script).toEndWith("\n");
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
