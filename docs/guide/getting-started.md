# Getting Started

## Prerequisites

- [Podman](https://podman.io/) (rootless mode recommended if you want SSH agent forwarding)
- An `ANTHROPIC_API_KEY` (for Claude Code) or `OPENAI_API_KEY` (for Codex)

## Installation

### Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/pthrasher/straightjacket/master/install.sh | sh
```

Detects your OS and architecture, downloads the latest release binary, and installs to `/usr/local/bin`.

| Environment Variable | Description |
| --- | --- |
| `SJ_INSTALL_DIR` | Custom install directory (default: `/usr/local/bin`) |
| `SJ_VERSION` | Pin a specific version (e.g., `v0.1.0`) |

### From Source

```bash
git clone https://github.com/pthrasher/straightjacket.git
cd straightjacket
bun install
bun run build
cp build/sj /usr/local/bin/sj
```

## Quick Start

```bash
cd your-project

# Launch Claude Code in a container
sj claude

# Launch Codex instead
sj codex

# Force rebuild the image (after changing presets/units)
sj claude --rebuild

# Use a different preset
sj codex --preset rust-wasm

# Just get a shell
sj shell
```

## What Happens on First Run

When you run `sj claude` for the first time in a project:

1. **Builds a container image** tailored to your preset's units (Node, Rust, etc.)
2. **Creates a sandboxed home directory** for the agent at `~/.config/sj/harness-config/claude/`
3. **Syncs your git config** into the container
4. **Mounts your project** at `/workdirs/<project>` inside the container
5. **Launches the agent** in full autonomous mode — no permission prompts

Subsequent runs reuse the cached image and persisted agent state — startup is near-instant.

## How It Works

```
┌─────────────────────────────────────┐
│  Your Host                          │
│                                     │
│  $ sj claude                        │
│    │                                │
│    ├─ Resolve config & preset       │
│    ├─ Generate Dockerfile from units│
│    ├─ Build image (cached by hash)  │
│    ├─ Sync git config, SSH keys     │
│    └─ podman run ...                │
│         │                           │
│  ┌──────┴──────────────────────┐    │
│  │  Container                  │    │
│  │  • cap-drop=ALL             │    │
│  │  • no-new-privileges        │    │
│  │  • userns=keep-id           │    │
│  │  • /workdirs/project (rw)   │    │
│  │  • $HOME = sandboxed        │    │
│  │                             │    │
│  │  Claude Code (autonomous)   │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

::: warning A container is not a magic shield
Straight Jacket prevents agents from trashing your host system or accessing files outside your project — but your project directory is mounted read-write. A rogue agent can still delete your entire codebase or overwrite files. Don't pass production credentials or secrets you wouldn't want an intern to have. Straight Jacket constrains the blast radius; it doesn't eliminate it. Use version control. Review diffs. Stay sharp.
:::
