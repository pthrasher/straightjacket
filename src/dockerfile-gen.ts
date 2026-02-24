import type { ResolvedUnit } from "./types.ts";
import { unitArgName } from "./units.ts";

/**
 * Generate ARG declarations for a unit's resolved args.
 */
function emitArgDeclarations(unit: ResolvedUnit): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(unit.resolvedArgs)) {
    lines.push(`ARG ${unitArgName(unit.name, key)}=${value}`);
  }
  return lines.join("\n");
}

/**
 * Deduplicate an array of strings while preserving order.
 */
function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

/**
 * Generate a complete Dockerfile from an ordered list of resolved units.
 */
export function generateDockerfile(units: ResolvedUnit[]): string {
  const sections: string[] = [];

  // ── 1. Build stages ─────────────────────────────────────────────────
  const buildUnits = units.filter((u) => u.buildSnippet);
  for (const unit of buildUnits) {
    const argDecls = emitArgDeclarations(unit);
    sections.push(
      [
        `# === Build stage: ${unit.name} ===`,
        `FROM ubuntu:24.04 AS unit-${unit.name}-build`,
        "ARG DEBIAN_FRONTEND=noninteractive",
        argDecls,
        unit.buildSnippet!.trimEnd(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  // ── 2. system-deps stage ────────────────────────────────────────────
  const systemDeps: string[] = [];
  systemDeps.push("# === System dependencies ===");
  systemDeps.push("FROM ubuntu:24.04 AS system-deps");
  systemDeps.push("ARG DEBIAN_FRONTEND=noninteractive");

  // Emit all unit ARG declarations (needed for aptRepo setup scripts)
  const allArgDecls = units
    .map(emitArgDeclarations)
    .filter(Boolean)
    .join("\n");
  if (allArgDecls) {
    systemDeps.push(allArgDecls);
  }

  // 2a. Bootstrap packages (always needed for repo setup) + enable universe repo
  systemDeps.push(
    [
      "# Bootstrap packages (needed before apt repos can be added)",
      "RUN apt-get update \\",
      "  && apt-get install -y --no-install-recommends \\",
      "    ca-certificates \\",
      "    curl \\",
      "    gnupg \\",
      "    lsb-release \\",
      "    software-properties-common \\",
      "  && add-apt-repository -y universe \\",
      "  && rm -rf /var/lib/apt/lists/*",
    ].join("\n"),
  );

  // 2b. Declarative apt repos
  const allAptRepos = units.flatMap((u) => u.manifest.aptRepos ?? []);
  for (const repo of allAptRepos) {
    systemDeps.push(
      [
        `# apt repo: ${repo.name}`,
        "RUN mkdir -p /etc/apt/keyrings \\",
        `  && curl -fsSL ${repo.gpgKeyUrl} | gpg --dearmor -o /etc/apt/keyrings/${repo.name}.gpg \\`,
        `  && echo "${repo.sourceLine}" > /etc/apt/sources.list.d/${repo.name}.list`,
      ].join("\n"),
    );
  }

  // 2c. Merged apt packages
  const allApt = dedupe(units.flatMap((u) => u.manifest.apt ?? []));
  if (allApt.length > 0) {
    const pkgLines = allApt.map((pkg) => `    ${pkg} \\`).join("\n");
    systemDeps.push(
      [
        "RUN apt-get update \\",
        "  && apt-get install -y --no-install-recommends \\",
        pkgLines,
        "  && rm -rf /var/lib/apt/lists/*",
      ].join("\n"),
    );
  }

  // 2d. Merged pip packages
  const allPip = dedupe(units.flatMap((u) => u.manifest.pip ?? []));
  if (allPip.length > 0) {
    const pipLines = allPip.map((pkg) => `    ${pkg} \\`).join("\n");
    systemDeps.push(
      [
        "RUN pip3 install --no-cache-dir --break-system-packages \\",
        pipLines.replace(/\s*\\$/, ""),
      ].join("\n"),
    );
  }

  // 2e. post-install slot snippets
  const postInstallUnits = units.filter((u) => u.postInstallSnippet);
  for (const unit of postInstallUnits) {
    const argDecls = emitArgDeclarations(unit);
    systemDeps.push(
      [
        `# --- unit: ${unit.name} ---`,
        argDecls,
        unit.postInstallSnippet!.trimEnd(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  sections.push(systemDeps.join("\n\n"));

  // ── 3. user-setup stage (sj-controlled) ─────────────────────────────
  sections.push(
    [
      "# === User setup (sj-controlled) ===",
      "FROM system-deps AS user-setup",
      "",
      "ARG SANDBOX_UID=1000",
      "ARG SANDBOX_GID=1000",
      "ARG SANDBOX_WORKDIR=/workdirs/project",
      "",
      "# Create sandbox user with GID collision handling",
      "# macOS default GID is 20 (staff), which maps to \"dialout\" in Ubuntu.",
      "RUN existing_group=$(getent group ${SANDBOX_GID} | cut -d: -f1 || true) \\",
      "  && if [ -z \"$existing_group\" ]; then \\",
      "       groupadd -g ${SANDBOX_GID} sandboxgroup; \\",
      "     fi \\",
      "  && useradd -m -u ${SANDBOX_UID} -g ${SANDBOX_GID} -s /bin/zsh sandboxuser",
      "",
      "RUN mkdir -p ${SANDBOX_WORKDIR} \\",
      "  && chown ${SANDBOX_UID}:${SANDBOX_GID} ${SANDBOX_WORKDIR}",
    ].join("\n"),
  );

  // ── 4. agents stage (sj-controlled) ─────────────────────────────────
  const agentsLines: string[] = [
    "# === Agent installation (sj-controlled) ===",
    "FROM user-setup AS agents",
    "",
    "ARG SANDBOX_UID=1000",
    "ARG SANDBOX_GID=1000",
    "",
    "RUN chown root:${SANDBOX_GID} /usr/local/bin \\",
    "  && chmod 775 /usr/local/bin",
    "",
    "# Codex",
    "RUN npm install -g @openai/codex@latest",
    "",
    "# Claude Code",
    "RUN curl -fsSL https://claude.ai/install.sh | bash \\",
    '  && CLAUDE_BIN=$(readlink -f /root/.local/bin/claude) \\',
    '  && test -f "$CLAUDE_BIN" \\',
    '       || { echo "Claude binary not found"; find /root -name claude -type f; exit 1; } \\',
    '  && cp "$CLAUDE_BIN" /usr/local/bin/claude \\',
    "  && chmod 755 /usr/local/bin/claude \\",
    "  && rm -rf /root/.local /root/.claude",
  ];

  // post-agent-install slot snippets
  const postAgentInstallUnits = units.filter(
    (u) => u.postAgentInstallSnippet,
  );
  for (const unit of postAgentInstallUnits) {
    const argDecls = emitArgDeclarations(unit);
    agentsLines.push("");
    agentsLines.push(`# --- unit: ${unit.name} ---`);
    if (argDecls) agentsLines.push(argDecls);
    agentsLines.push(unit.postAgentInstallSnippet!.trimEnd());
  }

  sections.push(agentsLines.join("\n"));

  // ── 5. Finalize ─────────────────────────────────────────────────────
  const finalizeLines = [
    "# === Finalize ===",
    "ARG SANDBOX_WORKDIR=/workdirs/project",
  ];

  // Prepend unit pathDirs to PATH
  const allPathDirs = dedupe(units.flatMap((u) => u.manifest.pathDirs ?? []));
  if (allPathDirs.length > 0) {
    finalizeLines.push(
      `ENV PATH=${allPathDirs.join(":")}:$PATH`,
    );
  }

  finalizeLines.push(
    "WORKDIR ${SANDBOX_WORKDIR}",
    "USER sandboxuser",
    'CMD ["bash"]',
  );

  sections.push(finalizeLines.join("\n"));

  return sections.join("\n\n") + "\n";
}
