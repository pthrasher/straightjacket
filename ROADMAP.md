# Straight Jacket Roadmap

## Core Concept

A standalone CLI tool (`sj`) distributed as a single bundled Bun executable that automates containerized AI agent workflows. Run `sj` from any project root to launch Claude Code, Codex, or other agents inside a purpose-built Podman container.

See [REQUIREMENTS.md](REQUIREMENTS.md) for detailed technical requirements.

## Phase 1: Foundation (v1)

- CLI skeleton: `sj shell`, `sj claude`, `sj codex`, `sj init`, bare `sj` with default agent
- `--rebuild` flag for forcing image rebuilds
- Global config (`$XDG_CONFIG_HOME/sj/config.json`) — every CLI flag is also a config key
- Per-repo config (`.sj/config.json`) with override precedence: CLI > per-repo > global > defaults
- Podman only
- Image build lifecycle (build on first use, content-hash tagging, shared images for same preset)
- UID/GID alignment with macOS GID collision handling
- Harness-config directory mounted as `$HOME` per agent
- First-run bootstrapping (create harness-config dir, agent handles its own auth flow)
- Agent binaries installed to `/usr/local/bin` (writable by sandboxuser for auto-update)
- Generated entrypoint (no hand-maintained start scripts in presets)
- Git config sync (host → container, configurable)
- SSH agent forwarding and SSH-based commit signing
- TTY environment passthrough
- Security defaults (cap-drop, no-new-privileges, userns=keep-id)
- Network access allowed
- `full-stack` and `full-stack-playwright` built-in presets (embedded via `bun build --compile` with `{ type: "file" }` imports)
- Preset resolution: per-repo `.sj/presets/` → user presets → built-in presets

## Phase 2: Scaffolding

- `sj init` generates a customizable Dockerfile satisfying the preset contract
- Documented contract / rules that custom Dockerfiles must follow

## Future

- Docker support
- GPG-based commit signing
- Network restrictions (host/IP firewalling)
- Auto-detection of preset based on repo contents (`Cargo.toml` → rust, `package.json` → full-stack, etc.)
- Additional built-in presets: `rust`, `go`, `zig`
- Auto-update management for agents inside containers
- `sj status` and other management subcommands
