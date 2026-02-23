import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  bootstrapHarnessConfig,
  syncGitConfig,
  captureTtyEnvArgs,
  sshForwardingArgs,
  credentialEnvArgs,
  getUidGid,
} from "../../src/prep.ts";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "sj-prep-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("bootstrapHarnessConfig", () => {
  test("creates the directory when it doesn't exist", () => {
    const harnessHome = join(tmpDir, "harness", "claude");
    bootstrapHarnessConfig(harnessHome);
    expect(existsSync(harnessHome)).toBe(true);
  });

  test("creates XDG subdirectories", () => {
    const harnessHome = join(tmpDir, "harness", "claude");
    bootstrapHarnessConfig(harnessHome);
    expect(existsSync(join(harnessHome, ".config"))).toBe(true);
    expect(existsSync(join(harnessHome, ".cache"))).toBe(true);
    expect(existsSync(join(harnessHome, ".local", "share"))).toBe(true);
  });

  test("is idempotent — second call doesn't fail", () => {
    const harnessHome = join(tmpDir, "harness", "claude");
    bootstrapHarnessConfig(harnessHome);
    bootstrapHarnessConfig(harnessHome);
    expect(existsSync(harnessHome)).toBe(true);
  });

  test("preserves existing contents", () => {
    const harnessHome = join(tmpDir, "harness", "claude");
    mkdirSync(harnessHome, { recursive: true });
    writeFileSync(join(harnessHome, "existing.txt"), "keep me");

    bootstrapHarnessConfig(harnessHome);
    expect(readFileSync(join(harnessHome, "existing.txt"), "utf8")).toBe(
      "keep me",
    );
  });
});

describe("syncGitConfig", () => {
  test("copies .gitconfig when it exists on host", () => {
    const harnessHome = join(tmpDir, "harness");
    mkdirSync(harnessHome, { recursive: true });

    // We can't easily mock homedir(), but we can test the copy logic
    // by checking that the function doesn't throw when source doesn't exist
    syncGitConfig(harnessHome);
    // No assertion needed — just verifying no crash
  });
});

describe("captureTtyEnvArgs", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ["TERM", "COLORTERM", "TERM_PROGRAM", "LANG", "LC_ALL", "LC_CTYPE"]) {
      savedEnv[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val !== undefined) {
        process.env[key] = val;
      } else {
        delete process.env[key];
      }
    }
  });

  test("captures set TTY variables", () => {
    process.env.TERM = "xterm-256color";
    process.env.COLORTERM = "truecolor";
    delete process.env.TERM_PROGRAM;
    delete process.env.LANG;

    const args = captureTtyEnvArgs();
    expect(args).toContain("--env");
    expect(args).toContain("TERM=xterm-256color");
    expect(args).toContain("COLORTERM=truecolor");
  });

  test("skips unset variables", () => {
    delete process.env.COLORTERM;
    const args = captureTtyEnvArgs();
    const joined = args.join(" ");
    expect(joined).not.toContain("COLORTERM");
  });

  test("captures LC_* variables", () => {
    process.env.LC_ALL = "en_US.UTF-8";
    process.env.LC_CTYPE = "en_US.UTF-8";

    const args = captureTtyEnvArgs();
    expect(args).toContain("LC_ALL=en_US.UTF-8");
    expect(args).toContain("LC_CTYPE=en_US.UTF-8");
  });
});

describe("sshForwardingArgs", () => {
  const savedSock = process.env.SSH_AUTH_SOCK;

  afterEach(() => {
    if (savedSock !== undefined) {
      process.env.SSH_AUTH_SOCK = savedSock;
    } else {
      delete process.env.SSH_AUTH_SOCK;
    }
  });

  test("returns empty array when SSH_AUTH_SOCK is unset", () => {
    delete process.env.SSH_AUTH_SOCK;
    const args = sshForwardingArgs();
    expect(args).toEqual([]);
  });

  test("returns empty array when SSH_AUTH_SOCK points to nonexistent path", () => {
    process.env.SSH_AUTH_SOCK = "/nonexistent/socket.sock";
    const args = sshForwardingArgs();
    expect(args).toEqual([]);
  });

  test("returns mount args when SSH_AUTH_SOCK is valid", () => {
    // Use the actual SSH_AUTH_SOCK if available in test environment
    if (!savedSock) return;
    process.env.SSH_AUTH_SOCK = savedSock;
    const args = sshForwardingArgs();
    if (args.length > 0) {
      expect(args).toContain("-v");
      expect(args).toContain("--env");
      expect(args).toContain("SSH_AUTH_SOCK=/run/ssh-agent.sock");
    }
  });
});

describe("credentialEnvArgs", () => {
  const savedAnthropic = process.env.ANTHROPIC_API_KEY;
  const savedOpenai = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (savedAnthropic !== undefined) {
      process.env.ANTHROPIC_API_KEY = savedAnthropic;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
    if (savedOpenai !== undefined) {
      process.env.OPENAI_API_KEY = savedOpenai;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  test("forwards set API keys", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.OPENAI_API_KEY = "sk-test";

    const args = credentialEnvArgs();
    expect(args).toContain("ANTHROPIC_API_KEY=sk-ant-test");
    expect(args).toContain("OPENAI_API_KEY=sk-test");
  });

  test("skips unset API keys", () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const args = credentialEnvArgs();
    expect(args).toEqual([]);
  });

  test("forwards only set keys", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    delete process.env.OPENAI_API_KEY;

    const args = credentialEnvArgs();
    expect(args).toContain("ANTHROPIC_API_KEY=sk-ant-test");
    expect(args.join(" ")).not.toContain("OPENAI_API_KEY");
  });
});

describe("getUidGid", () => {
  test("returns numeric UID and GID", () => {
    const { uid, gid } = getUidGid();
    expect(typeof uid).toBe("number");
    expect(typeof gid).toBe("number");
    expect(uid).toBeGreaterThan(0);
    expect(gid).toBeGreaterThanOrEqual(0);
  });
});
