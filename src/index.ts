import { defineCommand, runMain } from "citty";
import { basename, dirname } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import type { AgentName, LaunchMode, SjConfig } from "./types.ts";
import { resolveConfig, repoConfigDefaults } from "./config.ts";
import { resolvePreset } from "./presets.ts";
import { harnessConfigDir, containerWorkdir, repoConfigFile } from "./paths.ts";
import {
  dockerfileContentHash,
  imageRef,
  materializeDockerfile,
  buildImageIfNeeded,
} from "./image.ts";
import {
  generateEntrypoint,
  writeEntrypointTempFile,
  cleanupEntrypointTempFile,
} from "./entrypoint.ts";
import {
  bootstrapHarnessConfig,
  syncGitConfig,
  syncGhConfig,
  syncClaudeSessionFiles,
  captureTtyEnvArgs,
  setupSshForwarding,
  credentialEnvArgs,
  getUidGid,
} from "./prep.ts";
import { buildPodmanRunArgs, execPodman } from "./podman.ts";

/**
 * Run the full container lifecycle.
 *
 * @param mode - What to exec: "claude", "codex", or "shell" (zsh)
 * @param harnessAgent - Which agent's harness-config to mount as $HOME
 */
async function runAgent(
  mode: LaunchMode,
  harnessAgent: AgentName,
  cliOverrides: Partial<SjConfig>,
): Promise<void> {
  const projectDir = process.cwd();
  const projectName = basename(projectDir);

  // 1. Resolve config (CLI > per-repo > global > defaults)
  const config = await resolveConfig(projectDir, cliOverrides);

  // 2. Resolve preset
  const preset = resolvePreset(config.defaultPreset, projectDir);

  // 3. UID/GID
  const { uid, gid } = getUidGid();

  // 4. Bootstrap harness-config
  const agentConfigOverride = config.agents[harnessAgent]?.configPath;
  const harnessHome = harnessConfigDir(harnessAgent, agentConfigOverride);
  const workdir = containerWorkdir(projectName);
  bootstrapHarnessConfig(harnessHome);

  // 5. Git config sync
  if (config.gitConfigSync) {
    syncGitConfig(harnessHome);
  }

  // 5a. GitHub CLI config sync
  if (config.githubCli) {
    syncGhConfig(harnessHome);
  }

  // 5b. Claude session file sync
  syncClaudeSessionFiles(projectDir, harnessHome, workdir);

  // 6. Image build
  const { path: dockerfilePath, cleanup: dockerfileCleanup } =
    await materializeDockerfile(preset);
  const hash = await dockerfileContentHash(preset.dockerfilePath);
  const ref = imageRef(preset, projectDir, hash);

  try {
    await buildImageIfNeeded({
      dockerfilePath,
      imageRef: ref,
      uid,
      gid,
      workdir,
      rebuild: config.rebuild,
    });
  } finally {
    await dockerfileCleanup?.();
  }

  // 7. SSH agent forwarding (may start a tunnel on macOS)
  const sshForwarding = await setupSshForwarding();

  // 8. Generate entrypoint
  const entrypointContent = generateEntrypoint(mode, config);
  const entrypointPath = await writeEntrypointTempFile(entrypointContent);

  try {
    // 9. Assemble and exec podman
    const args = buildPodmanRunArgs({
      imageRef: ref,
      projectDir,
      containerWorkdir: workdir,
      harnessHome,
      entrypointPath,
      agent: mode,
      sshArgs: sshForwarding.podmanArgs,
      ttyEnvs: captureTtyEnvArgs(),
      credEnvs: credentialEnvArgs(),
    });

    const exitCode = await execPodman(args);
    process.exit(exitCode);
  } finally {
    sshForwarding.cleanup?.();
    await cleanupEntrypointTempFile(entrypointPath);
  }
}

/**
 * Create a citty subcommand for a specific agent.
 */
function agentCommand(agent: AgentName) {
  const descriptions: Record<AgentName, string> = {
    claude: "Launch Claude Code in a container for the current repo",
    codex: "Launch Codex in a container for the current repo",
  };

  return defineCommand({
    meta: {
      name: agent,
      description: descriptions[agent],
    },
    args: {
      rebuild: {
        type: "boolean",
        description: "Force rebuild the image",
      },
    },
    async run({ args }) {
      await runAgent(agent, agent, {
        rebuild: args.rebuild || undefined,
      });
    },
  });
}

const shellCommand = defineCommand({
  meta: {
    name: "shell",
    description: "Drop into a zsh shell in an agent's container",
  },
  args: {
    rebuild: {
      type: "boolean",
      description: "Force rebuild the image",
    },
    agent: {
      type: "positional",
      description: "Agent harness to use (claude or codex)",
      required: false,
    },
  },
  async run({ args }) {
    const projectDir = process.cwd();
    const config = await resolveConfig(projectDir, {
      rebuild: args.rebuild || undefined,
    });
    const target: AgentName = (args.agent as AgentName) || config.defaultAgent;
    await runAgent("shell", target, {
      rebuild: args.rebuild || undefined,
    });
  },
});

const repoConfigCommand = defineCommand({
  meta: {
    name: "repo-config",
    description: "Create .sj/config.json with all defaults pre-filled",
  },
  args: {
    force: {
      type: "boolean",
      description: "Overwrite existing .sj/config.json",
    },
  },
  run({ args }) {
    const projectDir = process.cwd();
    const configPath = repoConfigFile(projectDir);

    if (existsSync(configPath) && !args.force) {
      console.error(
        `${configPath} already exists. Use --force to overwrite.`,
      );
      process.exit(1);
    }

    mkdirSync(dirname(configPath), { recursive: true });
    const defaults = repoConfigDefaults();
    writeFileSync(
      configPath,
      JSON.stringify(defaults, null, 2) + "\n",
    );
    console.log(`Created ${configPath}`);
    process.exit(0);
  },
});

const initCommand = defineCommand({
  meta: {
    name: "init",
    description:
      "Scaffold a customizable Dockerfile in the current repo (Phase 2)",
  },
  run() {
    console.log("sj init is not yet implemented. Coming in Phase 2.");
    process.exit(0);
  },
});

const main = defineCommand({
  meta: {
    name: "sj",
    version: "0.1.0",
    description: "Straight Jacket — containerized AI agent runner",
  },
  args: {
    rebuild: {
      type: "boolean",
      description: "Force rebuild the image",
    },
  },
  subCommands: {
    shell: shellCommand,
    claude: agentCommand("claude"),
    codex: agentCommand("codex"),
    "repo-config": repoConfigCommand,
    init: initCommand,
  },
  async run({ args }) {
    // Bare `sj` — resolve config to find default agent, then run it
    const projectDir = process.cwd();
    const config = await resolveConfig(projectDir, {
      rebuild: args.rebuild || undefined,
    });

    await runAgent(config.defaultAgent, config.defaultAgent, {
      rebuild: args.rebuild || undefined,
    });
  },
});

runMain(main);
