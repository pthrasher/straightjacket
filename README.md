# Straight Jacket

**Run AI agents in sandboxed containers. No footguns.**

Straight Jacket (`sj`) lets you run [Claude Code](https://claude.ai/code), [Codex](https://github.com/openai/codex), and other AI agents in full autonomous mode — no permission prompts, no babysitting — inside hardened Podman containers where they can't touch your host system. Your credentials, SSH keys, git config, and project files are forwarded automatically. One command, zero manual setup.

```bash
# Launch Claude Code against the current repo
sj claude

# Launch Codex instead
sj codex

# Just drop into a shell
sj shell
```

Your code stays mounted. Your agent stays caged. Ship fearlessly.

---

## Why Straight Jacket?

AI coding agents are powerful — and dangerous. They install packages, modify system files, run arbitrary commands, and sometimes do things you didn't ask for. Running them directly on your host is a liability.

Straight Jacket fixes this by making containerized agent workflows **trivially easy**:

- **Unattended agents, safely.** Agents run in full bypass-permissions mode — no confirmation prompts, no interruptions — because the container *is* the sandbox. Let them work autonomously without worrying about what they'll do to your system.[^1]
- **One binary, one command.** `sj claude` and you're coding. No Dockerfiles to write, no volume mounts to remember, no environment variables to juggle.
- **Composable presets.** Mix and match units (Node, Rust, Playwright, Ghidra, etc.) to build exactly the environment your project needs.
- **Persistent agent state.** Agent config, caches, shell history, and installed tools survive across sessions via sandboxed home directories.
- **Credential forwarding done right.** API keys, SSH agent, GitHub CLI auth — forwarded securely without baking secrets into images.
- **Security by default.** All capabilities dropped, no new privileges, user namespace isolation. The container is locked down from the start.
- **Single compiled binary.** Presets and units are embedded into the executable. No runtime dependencies beyond Podman.

---

## Installation

### Prerequisites

- [Podman](https://podman.io/) (rootless mode recommended if you want ssh-agent forwarding)

### Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/pthrasher/straightjacket/master/install.sh | sh
```

This detects your OS and architecture, downloads the latest release binary, and installs it to `/usr/local/bin`. Set `SJ_INSTALL_DIR` to change the install location, or `SJ_VERSION` to pin a specific version.

### From Source

```bash
git clone https://github.com/pthrasher/straightjacket.git
cd straightjacket
bun install
bun run build
cp build/sj /usr/local/bin/sj
```

---

## Quick Start

```bash
cd your-project

# Launch Claude Code in a container
sj claude

# Force rebuild the image (after changing presets/units)
sj claude --rebuild

# Use a different preset
sj codex --preset rust-wasm

# Just get a shell
sj shell
```

On first run, Straight Jacket builds a container image tailored to your preset, creates a sandboxed home directory for the agent, syncs your git config, and launches the agent with your project mounted at `/workdirs/<project>`.

Subsequent runs reuse the cached image and persisted agent state — startup is near-instant.

---

## How It Works

### Presets & Units

Straight Jacket uses a **composable unit system** instead of monolithic Dockerfiles.

A **unit** is a reusable component — a set of packages, Dockerfile snippets, PATH entries, and build args. A **preset** is a named composition of units.

```
┌─────────────────────────────────────────────────┐
│  Preset: full-stack                             │
│  ┌───────────┐ ┌──────┐ ┌─────┐ ┌───────────┐   │
│  │ dev-utils │ │ node │ │ bun │ │ github-cli│   │
│  └───────────┘ └──────┘ └─────┘ └───────────┘   │
└─────────────────────────────────────────────────┘
```

Straight Jacket generates a multi-stage Dockerfile from the preset's units, builds it once, and content-hash tags the image so repos sharing the same preset share the same image.

### Built-in Presets

| Preset                    | Units                                                                       | Use Case                        |
| ------------------------- | --------------------------------------------------------------------------- | ------------------------------- |
| **full-stack**            | dev-utils, node, bun, github-cli, doc-utils                                 | Web apps, JS/TS projects        |
| **full-stack-playwright** | full-stack + playwright                                                     | E2E testing, browser automation |
| **rust-wasm**             | dev-utils, node, rust, wasm, github-cli                                     | WebAssembly development         |
| **il2cpp-re**             | dev-utils, node, github-cli, java, dotnet, rust, ghidra, jadx, il2cpp-tools | Reverse engineering             |

### Built-in Units

| Unit             | What It Provides                                                                   |
| ---------------- | ---------------------------------------------------------------------------------- |
| **dev-utils**    | git, build-essential, zsh, ripgrep, jq, fd, bat, tree, and 30+ essential dev tools |
| **node**         | Node.js (configurable version, default: 24)                                        |
| **bun**          | Bun JavaScript runtime                                                             |
| **rust**         | Rust via rustup (configurable version)                                             |
| **wasm**         | Binaryen, wasmtime, wasm-tools                                                     |
| **github-cli**   | GitHub CLI (`gh`)                                                                  |
| **doc-utils**    | pandoc, PDF tools, OCR, document processing                                        |
| **playwright**   | Playwright + Chromium for browser automation                                       |
| **java**         | OpenJDK 21                                                                         |
| **dotnet**       | .NET SDK 8.0 + ILSpy CLI                                                           |
| **ghidra**       | Ghidra reverse engineering framework (multi-stage build)                           |
| **jadx**         | Dex-to-Java decompiler                                                             |
| **il2cpp-tools** | IL2CPP/Unity reverse engineering toolkit                                           |

### Custom Presets

Create your own presets to define exactly the environment you need:

```bash
mkdir -p .sj/presets/my-preset
```

```json
// .sj/presets/my-preset/preset.json
{
  "name": "my-preset",
  "units": [
    { "name": "dev-utils" },
    { "name": "node", "args": { "version": "20" } },
    { "name": "rust", "args": { "version": "nightly" } }
  ]
}
```

Presets resolve in order: **per-repo** (`.sj/presets/`) > **user** (`~/.config/sj/presets/`) > **built-in**.

### Custom Units

You can also create custom units with their own packages and Dockerfile snippets:

```bash
mkdir -p ~/.config/sj/units/my-tools
```

Add a `unit.json` manifest and optional `post-install.Dockerfile`, `build.Dockerfile`, or `post-agent-install.Dockerfile` snippets. See the built-in units in `default-units/` for examples.

---

## Configuration

Straight Jacket uses **layered configuration** with clear precedence:

```
CLI flags  >  per-repo config  >  global config  >  built-in defaults
```

### Global Config

Located at `$XDG_CONFIG_HOME/sj/config.json` (typically `~/.config/sj/config.json`):

```json
{
  "defaultAgent": "claude",
  "defaultPreset": "full-stack",
  "gitConfigSync": true,
  "sshForwarding": false,
  "githubCli": false,
  "autoUpdate": false
}
```

### Per-Repo Config

Generate a per-repo config with all defaults pre-filled:

```bash
sj repo-config
```

This creates `.sj/config.json` in your project root. Override any setting per-project.

### Config Options

| Option            | Default        | Description                                      |
| ----------------- | -------------- | ------------------------------------------------ |
| `defaultAgent`    | `"claude"`     | Agent to launch with bare `sj`                   |
| `defaultPreset`   | `"full-stack"` | Preset to use when not specified                 |
| `autoUpdate`      | `false`        | Update agent binaries before each launch         |
| `gitConfigSync`   | `true`         | Sync host git config into the container          |
| `sshForwarding`   | `false`        | Forward SSH agent for key-based auth and signing |
| `githubCli`       | `false`        | Prompt for `gh` auth if not authenticated        |
| `codexConfigSync` | `false`        | Sync Codex config and sessions                   |
| `preRunScripts`   | `[]`           | Shell scripts to run before agent launch         |

---

## Security Model

Straight Jacket containers are hardened by default:

- **`--cap-drop=ALL`** — all Linux capabilities removed
- **`--security-opt=no-new-privileges`** — prevents privilege escalation
- **`--userns=keep-id`** — UID/GID mapping without root
- **No secrets in images** — credentials are passed via environment variables at runtime
- **Read-only entrypoint** — the generated entrypoint script is bind-mounted read-only
- **Network access allowed** — agents need to reach APIs and package registries (network restrictions are a planned future feature)

Your project directory is mounted read-write (agents need to edit code), but the agent's home directory is isolated from your host home.

---

## SSH Agent Forwarding

Enable SSH agent forwarding for key-based git operations and commit signing:

```json
{
  "sshForwarding": true
}
```

On **Linux**, the SSH socket is bind-mounted directly. On **macOS**, Straight Jacket automatically sets up an SSH reverse tunnel into the Podman VM (macOS can't bind-mount host Unix sockets due to virtiofs limitations).

---

## Future Plans

Straight Jacket is under active development. Here's what's on the horizon:

- **Docker support** — use Docker as an alternative container runtime
- **Apple Containers** — native macOS container support
- **Alternative build systems** — Buildah, Buildkit, Nix-based container builds
- **Custom lifecycle hooks** — user-defined hooks for config sync, post-build, pre-launch, and teardown events
- **GPG-based commit signing** — in addition to SSH signing
- **Network restrictions** — configurable host/IP firewalling for tighter sandboxing
- **Auto-detection** — automatically select presets based on repo contents (`Cargo.toml` -> rust, `package.json` -> full-stack)
- **Additional presets** — Go, Zig, Python ML, and more
- **`sj status`** — management subcommands for inspecting running containers
- **Plugin system** — third-party units and presets distributed as packages
- **Multi-agent orchestration** — run multiple agents in coordinated containers

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). We welcome contributions — and we have high standards. AI-assisted code is welcome, but the bar is excellence, not volume.

## License

[MIT](LICENSE)

---

[^1]: **A container is not a magic shield.** Straight Jacket prevents agents from trashing your host system or accessing files outside your project — but your project directory is mounted read-write. A rogue agent can still delete your entire codebase, overwrite files, or make a mess of your repo. Don't pass production credentials, cloud admin keys, or secrets you wouldn't want an intern to have. Straight Jacket constrains the blast radius; it doesn't eliminate it. Use version control. Review diffs. Stay sharp.
