import { describe, test, expect } from "bun:test";
import { generateDockerfile } from "../../src/dockerfile-gen.ts";
import type { ResolvedUnit } from "../../src/types.ts";

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

describe("generateDockerfile", () => {
  test("generates valid skeleton with a single apt-only unit", () => {
    const units = [
      makeUnit({
        name: "dev-utils",
        manifest: { apt: ["curl", "git"] },
      }),
    ];

    const dockerfile = generateDockerfile(units);

    // Should have all required stages
    expect(dockerfile).toContain("FROM ubuntu:24.04 AS system-deps");
    expect(dockerfile).toContain("FROM system-deps AS user-setup");
    expect(dockerfile).toContain("FROM user-setup AS agents");
    expect(dockerfile).toContain("USER sandboxuser");
    expect(dockerfile).toContain('CMD ["bash"]');

    // Should have bootstrap packages
    expect(dockerfile).toContain("ca-certificates");
    expect(dockerfile).toContain("software-properties-common");

    // Should have unit's apt packages
    expect(dockerfile).toContain("curl");
    expect(dockerfile).toContain("git");
  });

  test("merges apt packages from multiple units", () => {
    const units = [
      makeUnit({
        name: "unit-a",
        manifest: { apt: ["git", "tmux"] },
      }),
      makeUnit({
        name: "unit-b",
        manifest: { apt: ["wget", "jq"] },
      }),
    ];

    const dockerfile = generateDockerfile(units);

    // Find the second apt-get install block (after bootstrap)
    const allMatches = [
      ...dockerfile.matchAll(
        /apt-get install -y --no-install-recommends[\s\S]*?rm -rf \/var\/lib\/apt\/lists\/\*/g,
      ),
    ];
    // allMatches[0] = bootstrap, allMatches[1] = merged unit packages
    expect(allMatches.length).toBeGreaterThanOrEqual(2);
    const mergedBlock = allMatches[1]![0];
    expect(mergedBlock).toContain("git");
    expect(mergedBlock).toContain("tmux");
    expect(mergedBlock).toContain("wget");
    expect(mergedBlock).toContain("jq");
  });

  test("deduplicates apt packages", () => {
    const units = [
      makeUnit({
        name: "unit-a",
        manifest: { apt: ["git", "tmux"] },
      }),
      makeUnit({
        name: "unit-b",
        manifest: { apt: ["git", "wget"] },
      }),
    ];

    const dockerfile = generateDockerfile(units);

    // Find the merged apt install block (second one, after bootstrap)
    const allMatches = [
      ...dockerfile.matchAll(
        /apt-get install -y --no-install-recommends[\s\S]*?rm -rf \/var\/lib\/apt\/lists\/\*/g,
      ),
    ];
    expect(allMatches.length).toBeGreaterThanOrEqual(2);
    const mergedBlock = allMatches[1]![0];
    const gitCount = (mergedBlock.match(/\bgit\b/g) || []).length;
    expect(gitCount).toBe(1);
  });

  test("merges pip packages from multiple units", () => {
    const units = [
      makeUnit({
        name: "unit-a",
        manifest: { pip: ["requests", "pandas"] },
      }),
      makeUnit({
        name: "unit-b",
        manifest: { pip: ["beautifulsoup4"] },
      }),
    ];

    const dockerfile = generateDockerfile(units);

    expect(dockerfile).toContain("pip3 install");
    expect(dockerfile).toContain("requests");
    expect(dockerfile).toContain("pandas");
    expect(dockerfile).toContain("beautifulsoup4");
  });

  test("omits pip section when no pip packages", () => {
    const units = [
      makeUnit({
        name: "dev-utils",
        manifest: { apt: ["git"] },
      }),
    ];

    const dockerfile = generateDockerfile(units);
    expect(dockerfile).not.toContain("pip3 install");
  });

  test("generates build stages for units with buildSnippet", () => {
    const units = [
      makeUnit({
        name: "ghidra",
        buildSnippet: "RUN git clone https://example.com/ghidra\nRUN make",
        postInstallSnippet: "COPY --from=unit-ghidra-build /opt/ghidra /opt/ghidra",
      }),
    ];

    const dockerfile = generateDockerfile(units);

    expect(dockerfile).toContain("FROM ubuntu:24.04 AS unit-ghidra-build");
    expect(dockerfile).toContain("RUN git clone");
    expect(dockerfile).toContain("COPY --from=unit-ghidra-build");

    // Build stage should appear before system-deps
    const buildIdx = dockerfile.indexOf("unit-ghidra-build");
    const systemDepsIdx = dockerfile.indexOf("AS system-deps");
    expect(buildIdx).toBeLessThan(systemDepsIdx);
  });

  test("places post-install snippets in system-deps stage", () => {
    const units = [
      makeUnit({
        name: "bun",
        postInstallSnippet:
          "RUN curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash",
      }),
    ];

    const dockerfile = generateDockerfile(units);

    // Snippet should be between system-deps and user-setup
    const systemDepsIdx = dockerfile.indexOf("AS system-deps");
    const userSetupIdx = dockerfile.indexOf("AS user-setup");
    const snippetIdx = dockerfile.indexOf("bun.sh/install");

    expect(snippetIdx).toBeGreaterThan(systemDepsIdx);
    expect(snippetIdx).toBeLessThan(userSetupIdx);
  });

  test("places post-agent-install snippets in agents stage", () => {
    const units = [
      makeUnit({
        name: "playwright",
        postAgentInstallSnippet:
          "RUN playwright install chromium",
      }),
    ];

    const dockerfile = generateDockerfile(units);

    // Snippet should be in agents stage (after "AS agents")
    const agentsIdx = dockerfile.indexOf("AS agents");
    const snippetIdx = dockerfile.indexOf("playwright install chromium");
    const finalizeIdx = dockerfile.indexOf("# === Finalize");

    expect(snippetIdx).toBeGreaterThan(agentsIdx);
    expect(snippetIdx).toBeLessThan(finalizeIdx);
  });

  test("multi-slot unit: both post-install and post-agent-install", () => {
    const units = [
      makeUnit({
        name: "playwright",
        postInstallSnippet: "RUN playwright install-deps chromium",
        postAgentInstallSnippet: "RUN playwright install chromium",
      }),
    ];

    const dockerfile = generateDockerfile(units);

    // post-install snippet in system-deps stage
    const systemDepsIdx = dockerfile.indexOf("AS system-deps");
    const userSetupIdx = dockerfile.indexOf("AS user-setup");
    const installDepsIdx = dockerfile.indexOf("install-deps chromium");
    expect(installDepsIdx).toBeGreaterThan(systemDepsIdx);
    expect(installDepsIdx).toBeLessThan(userSetupIdx);

    // post-agent-install snippet in agents stage
    const agentsIdx = dockerfile.indexOf("AS agents");
    const installBrowserIdx = dockerfile.lastIndexOf("install chromium");
    expect(installBrowserIdx).toBeGreaterThan(agentsIdx);
  });

  test("generates correct ARG names", () => {
    const units = [
      makeUnit({
        name: "node",
        manifest: {
          args: { version: { default: "22" } },
        },
        resolvedArgs: { version: "22" },
      }),
    ];

    const dockerfile = generateDockerfile(units);
    expect(dockerfile).toContain("ARG UNIT_NODE_VERSION=22");
  });

  test("generates declarative apt repo commands", () => {
    const units = [
      makeUnit({
        name: "node",
        manifest: {
          apt: ["nodejs"],
          aptRepos: [
            {
              name: "nodesource",
              gpgKeyUrl:
                "https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key",
              sourceLine:
                "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${UNIT_NODE_VERSION}.x nodistro main",
            },
          ],
        },
      }),
    ];

    const dockerfile = generateDockerfile(units);

    // GPG key download
    expect(dockerfile).toContain("curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key");
    expect(dockerfile).toContain("gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg");

    // Sources list
    expect(dockerfile).toContain("/etc/apt/sources.list.d/nodesource.list");

    // Repo setup should come before merged apt install
    const repoIdx = dockerfile.indexOf("nodesource.gpg");
    const aptInstallIdx = dockerfile.indexOf("nodejs");
    expect(repoIdx).toBeLessThan(aptInstallIdx);
  });

  test("includes sj-controlled user-setup stage", () => {
    const units = [makeUnit({ name: "dev-utils", manifest: { apt: ["git"] } })];
    const dockerfile = generateDockerfile(units);

    expect(dockerfile).toContain("SANDBOX_UID");
    expect(dockerfile).toContain("SANDBOX_GID");
    expect(dockerfile).toContain("groupadd");
    expect(dockerfile).toContain("useradd");
    expect(dockerfile).toContain("sandboxuser");
    expect(dockerfile).toContain("/bin/zsh");
  });

  test("includes sj-controlled agents stage", () => {
    const units = [makeUnit({ name: "dev-utils", manifest: { apt: ["git"] } })];
    const dockerfile = generateDockerfile(units);

    expect(dockerfile).toContain("chmod 775 /usr/local/bin");
    expect(dockerfile).toContain("@openai/codex@latest");
    expect(dockerfile).toContain("claude.ai/install.sh");
  });

  test("emits ENV PATH with pathDirs from units", () => {
    const units = [
      makeUnit({
        name: "rust",
        manifest: { pathDirs: ["/opt/cargo/bin"] },
      }),
      makeUnit({
        name: "jadx",
        manifest: { pathDirs: ["/opt/jadx/bin"] },
      }),
    ];

    const dockerfile = generateDockerfile(units);

    expect(dockerfile).toContain("ENV PATH=/opt/cargo/bin:/opt/jadx/bin:$PATH");

    // Should be in the finalize section
    const finalizeIdx = dockerfile.indexOf("# === Finalize");
    const envPathIdx = dockerfile.indexOf("ENV PATH=");
    expect(envPathIdx).toBeGreaterThan(finalizeIdx);
  });

  test("deduplicates pathDirs", () => {
    const units = [
      makeUnit({
        name: "unit-a",
        manifest: { pathDirs: ["/opt/cargo/bin", "/opt/jadx/bin"] },
      }),
      makeUnit({
        name: "unit-b",
        manifest: { pathDirs: ["/opt/cargo/bin"] },
      }),
    ];

    const dockerfile = generateDockerfile(units);

    const envLine = dockerfile.split("\n").find((l) => l.startsWith("ENV PATH="));
    expect(envLine).toBe("ENV PATH=/opt/cargo/bin:/opt/jadx/bin:$PATH");
  });

  test("omits ENV PATH when no pathDirs", () => {
    const units = [
      makeUnit({ name: "dev-utils", manifest: { apt: ["git"] } }),
    ];

    const dockerfile = generateDockerfile(units);
    expect(dockerfile).not.toContain("ENV PATH=");
  });

  test("bootstrap packages are in first RUN", () => {
    const units = [makeUnit({ name: "dev-utils", manifest: { apt: ["git"] } })];
    const dockerfile = generateDockerfile(units);

    // Find the first apt-get install after system-deps
    const systemDepsIdx = dockerfile.indexOf("AS system-deps");
    const firstInstallIdx = dockerfile.indexOf(
      "apt-get install",
      systemDepsIdx,
    );
    const firstInstallEnd = dockerfile.indexOf(
      "rm -rf /var/lib/apt/lists/*",
      firstInstallIdx,
    );
    const bootstrapSection = dockerfile.slice(
      firstInstallIdx,
      firstInstallEnd,
    );

    expect(bootstrapSection).toContain("ca-certificates");
    expect(bootstrapSection).toContain("curl");
    expect(bootstrapSection).toContain("gnupg");

    // Unit packages should NOT be in the bootstrap section
    expect(bootstrapSection).not.toContain("git");
  });
});
