# Requirements

## Distribution

- TypeScript application targeting the Bun runtime.
- Compiled to a single standalone executable via `bun build --compile`, self-contained with no external dependencies.
- Default presets are embedded into the binary via `import ... with { type: "file" }` imports, which Bun bundles into the compiled executable automatically.
- Podman only (v1). Docker support is a future consideration.

## Source Layout

```
straightjacket/
├── src/                      # TypeScript source code
├── default-presets/          # built-in preset Dockerfiles (embedded into binary at compile)
│   ├── full-stack/
│   │   └── Dockerfile
│   └── full-stack-playwright/
│       └── Dockerfile
├── REQUIREMENTS.md
├── ROADMAP.md
└── ...
```

## Dependencies

- **citty** (UnJS) — CLI argument parsing, subcommand routing.
- **c12** (UnJS) — Layered config loading and merging. Handles the resolution order: CLI overrides → per-repo config → global config → defaults.

Parsed CLI args from citty are passed as c12's `overrides` parameter (highest priority layer).

## CLI Interface

- `sj shell` — drop into a bash shell in the container (default command if no default agent configured).
- `sj claude` — launch Claude Code in a container for the current repo.
- `sj codex` — launch Codex in a container for the current repo.
- `sj` — launch the default agent (configured in global config), or `sj shell` if no default set.
- `sj init` — scaffold a customizable Dockerfile in the current repo.
- `--rebuild` flag — force rebuild the image (e.g. `sj claude --rebuild`, `sj --rebuild`).

All CLI flags can also be specified in config files (see Global Configuration and Per-Repo Configuration).

## Global Configuration

Location: `$XDG_CONFIG_HOME/sj/` (typically `~/.config/sj/`)

Directory structure:
```
$XDG_CONFIG_HOME/sj/
├── config.json
├── presets/                  # user-defined presets
│   └── <name>/
│       └── Dockerfile
└── harness-config/           # per-agent sandboxed home dirs (persisted across runs)
    ├── claude/               # mounted as $HOME for claude containers
    │   ├── .claude/
    │   ├── .claude.json
    │   └── .gitconfig        # synced from host (see Git Config Sync)
    └── codex/                # mounted as $HOME for codex containers
        ├── .codex/
        └── .gitconfig
```

### config.json

Every CLI argument can also be specified as a key in `config.json`. CLI flags override config.json values.

Config keys include:
- `defaultAgent` — which agent bare `sj` launches (`claude`, `codex`, etc.). If unset, `sj` defaults to `sj shell`.
- `defaultPreset` — preset to use when not otherwise specified
- `autoUpdate` — whether to auto-update agents inside the container before launch
- `gitConfigSync` — sync host git config into container on each start (`true` by default)
- `preRunScripts` — list of scripts to execute before launching the agent
- `agents` — per-agent overrides, including custom harness config paths

### Per-Agent Config Path Override

By default each agent's sandboxed home directory lives under `$XDG_CONFIG_HOME/sj/harness-config/<agent>/`. Users can override this to point at any directory:

```json
{
  "agents": {
    "codex": {
      "configPath": "/Users/me/.codex-poopypants"
    }
  }
}
```

This directory is mounted as `$HOME` inside the container in place of the default harness-config path for that agent.

## Per-Repo Configuration

Location: `.sj/` in the project root.

```
<project>/
└── .sj/
    ├── config.json           # per-repo config overrides
    └── presets/
        └── <name>/
            └── Dockerfile    # per-repo custom preset
```

`sj` checks for `.sj/` in the current repo first. Settings in `.sj/config.json` override global config, and CLI flags override both.

**Resolution order (highest priority first):**
1. CLI flags
2. `.sj/config.json` (per-repo)
3. `$XDG_CONFIG_HOME/sj/config.json` (global)
4. Built-in defaults

## Presets

Each preset is a directory containing a `Dockerfile` that defines the build environment and toolchains.

**Preset resolution order (highest priority first):**
1. Per-repo presets in `.sj/presets/<name>/`
2. User presets in `$XDG_CONFIG_HOME/sj/presets/<name>/`
3. Built-in presets embedded in the binary

Built-in presets:
- `full-stack` — general-purpose web dev / development.
- `full-stack-playwright` — same as `full-stack` plus Playwright and Chromium for browser automation/testing.

## Container Lifecycle

### Build Phase

- Build the image on first use or when the Dockerfile/preset has changed.
- Derive the image tag from the preset name + a content hash so rebuilds only happen when needed.
- Repos sharing the same preset share the same image (no redundant builds).
- Per-repo custom presets get a distinct image: `<parent-dir>-<project-dir>-<preset-name>`. If this conflicts, error and let the user fix the preset name.
- The workdir inside the container follows the `/workdirs/<project-name>` pattern (e.g. `/workdirs/my-app`). This is important because images may be shared across multiple projects using the same preset, and agents like Claude Code and Codex use the project root path to track per-project state. A consistent, unique path per project ensures each repo gets its own project context within the agent.
- Force rebuild via `--rebuild` flag.

### Dockerfile Standards

- Multi-stage builds to keep final images lean and layers cacheable.
- Separate stages for: system deps → user-space tools → agent installation.
- Build args for all variable inputs (UID, GID, workdir, Node version, etc.).
- Presets should only install what's relevant to their domain (no LaTeX in a Rust preset).

### Run Phase

- Mount the host repo into the container at the derived workdir.
- Pass `--rm -it` (ephemeral interactive containers).
- Network access is allowed (v1). Network restrictions (host/IP firewalling) are a future consideration.
- The tool owns the entrypoint logic (see Entrypoint below).

## Entrypoint

`sj` generates and manages the container entrypoint. There is no hand-maintained start script in presets. The entrypoint handles:

1. **Git config sync** — copy host `.gitconfig` and `~/.config/git/` into `$HOME` if `gitConfigSync` is enabled.
2. **Environment setup** — set `HOME`, `USER`, `PATH`, and forwarded TTY variables.
3. **SSH agent** — ensure `SSH_AUTH_SOCK` is accessible.
4. **Pre-run scripts** — execute any user-configured `preRunScripts`.
5. **Agent auto-update** — if `autoUpdate` is enabled, run the agent's update command.
6. **Agent launch** — invoke the requested agent with appropriate flags:
   - **Claude Code:** agent-specific env vars, then `claude`.
   - **Codex:** `codex --dangerously-bypass-approvals-and-sandbox`.
   - **Shell:** `bash`.

## UID/GID Alignment

- Detect the host user's UID and GID at build time via build args.
- Handle GID collisions gracefully: on macOS the default GID is 20 (`staff`), which already exists inside Ubuntu-based containers. The build must detect this and reuse the existing group rather than failing or creating a mismatched one.
- Use `--userns=keep-id` for transparent UID mapping via Podman.

## Agent Config Directory Management

The entire harness-config directory for the active agent is mounted as `$HOME` inside the container. This means everything the agent writes to `$HOME` persists across runs — config files, caches, shell history, etc.

On first run for a given agent, `sj` creates the harness-config directory and launches the container. Agents that require authentication (like Claude Code) handle their auth flow inline on first launch. For agents like Codex where auth tokens live in the config directory, the user sets up auth once and it persists.

Each agent's config is completely separate from any non-sandboxed installation on the host.

Users can override the config path for any agent via `config.json` (see Per-Agent Config Path Override above).

## Agent Binary Installation

Since the harness-config directory is mounted as `$HOME`, agent binaries cannot be installed to `~/.local/bin` or the user-local npm prefix (those would end up on the persistent volume). Instead:

- Agent binaries are installed to `/usr/local/bin/` inside the image at build time.
- `/usr/local/bin` must be writable by `sandboxuser` so that agent auto-update mechanisms can replace the binary in-place.
- Auto-update behavior varies by agent and needs to be tested:
  - **Claude Code:** Installed via `curl -fsSL https://claude.ai/install.sh | bash`. Auto-update mechanism needs investigation — it's closed-source, so the update target path must be discovered empirically. Making `/usr/local/bin` writable by sandboxuser is likely sufficient.
  - **Codex:** Installed via npm. Open-source, so the update mechanism can be inspected directly.
- Trade-off: auto-updates within a running container are lost on the next image rebuild. This is acceptable — image rebuilds get the latest version anyway.

## Credential Handling

- Host credentials (API keys, tokens) are passed into the container via environment variables or read-only bind mounts.
- `SSH_AUTH_SOCK` is forwarded into the container via bind mount for SSH agent access (git operations, SSH-based commit signing).
- No credential material is baked into images.

## Git Config Sync

The user's host git configuration (`~/.gitconfig`, `~/.config/git/`) needs to be available inside the container for commits, signing, etc.

- On first run (or when no `.gitconfig` exists in the harness-config home), copy the host's git config into the harness-config directory.
- By default, re-sync from host on each container start (one-way: host → container, overwriting the container copy).
- This is configurable — users can disable auto-sync if they want the sandboxed git config to diverge from the host.
- Config key: `gitConfigSync` (`true` by default, set to `false` to disable).

## Commit Signing

SSH-based commit signing only (v1). GPG-based signing is a future consideration.

`SSH_AUTH_SOCK` is bind-mounted into the container. Combined with the synced git config (which contains the user's `gpg.format = ssh` and `user.signingKey` settings), this should work transparently.

## Security Defaults

- `--cap-drop=ALL` — drop all Linux capabilities by default.
- `--security-opt=no-new-privileges` — prevent privilege escalation.
- `--cap-add=SYS_PTRACE` available as an opt-in (for debugging).
- `--userns=keep-id` for rootless operation.

## TTY Environment Passthrough

The invoking shell has TTY-related environment variables that must be forwarded into the container so terminal rendering, colors, and sizing work correctly. `sj` captures these at invocation time and passes them via `--env`:

- `TERM`, `COLORTERM`
- `TERM_PROGRAM`, `TERM_PROGRAM_VERSION`
- `LANG`, `LC_*` (locale)
- `COLUMNS`, `LINES` (terminal dimensions)

## Agent-Specific Runtime Concerns

Each agent has different runtime needs handled by the entrypoint:

- **Claude Code:** environment variables (`CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION`, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, etc.), optional auto-update before launch.
- **Codex:** `--dangerously-bypass-approvals-and-sandbox` flag (already inside a sandbox).
- **Shell:** plain `bash`, no agent-specific setup.
- Common to all: proper `HOME`, `USER`, and `PATH` setup.

## Testing

Tests use `bun test` (Bun's built-in test runner, compatible with Jest/expect API).

### Unit Tests

Unit tests cover pure logic that doesn't require Podman or a running container:

- **Config resolution** — verify layered merging: CLI flags override per-repo, per-repo overrides global, global overrides defaults. Test edge cases like missing files, malformed JSON, XDG_CONFIG_HOME variations.
- **Preset resolution** — verify priority order: per-repo `.sj/presets/` > user presets > built-in presets. Test fallback behavior when presets are missing.
- **Image naming/tagging** — verify content-hash derivation, shared images for same preset, distinct names for per-repo custom presets, collision detection.
- **UID/GID handling** — verify GID collision detection (macOS GID 20), group reuse logic.
- **Entrypoint generation** — verify the generated entrypoint script contains correct steps for each agent type, respects config flags (gitConfigSync, autoUpdate, preRunScripts).
- **TTY env capture** — verify the correct environment variables are captured from the invoking shell.
- **Git config sync logic** — verify copy behavior, skip-when-disabled behavior.
- **CLI arg parsing** — verify subcommand routing, flag parsing, --rebuild flag, bare `sj` default behavior.

### Integration Tests

Integration tests require Podman and exercise the full container lifecycle. These are slower and may be gated behind an environment flag (e.g. `SJ_INTEGRATION_TESTS=1`):

- **Build and run** — build an image from the `full-stack` preset, run a container, verify the agent binary exists at `/usr/local/bin/`, verify the workdir is correctly set.
- **Harness-config mount** — verify the harness-config directory is mounted as `$HOME`, files written inside persist after container exit.
- **SSH agent forwarding** — verify `SSH_AUTH_SOCK` is accessible inside the container and can list keys.
- **Git config sync** — verify host `.gitconfig` is copied into the container's `$HOME`, verify commit signing config is present.
- **TTY passthrough** — verify forwarded env vars are set inside the container.
- **Security defaults** — verify capabilities are dropped, no-new-privileges is set.
- **Rebuild** — verify `--rebuild` triggers a fresh image build even when the content hash hasn't changed.
- **First-run bootstrapping** — verify harness-config directory is created when it doesn't exist.
