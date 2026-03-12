# Roadmap

Straight Jacket is under active development. Here's what's on the horizon.

## Planned

- **Docker support** — use Docker as an alternative container runtime
- **Apple Containers** — native macOS container support when it ships
- **Alternative build systems** — Buildah, Buildkit, Nix-based container builds
- **Custom lifecycle hooks** — user-defined hooks for config sync, post-build, pre-launch, and teardown events
- **GPG-based commit signing** — in addition to SSH signing
- **Network restrictions** — configurable host/IP firewalling for tighter sandboxing
- **Auto-detection** — automatically select presets based on repo contents (`Cargo.toml` -> rust, `package.json` -> full-stack)
- **Additional presets** — Go, Zig, Python ML, and more
- **`sj status`** — management subcommands for inspecting running containers
- **Plugin system** — third-party units and presets distributed as packages
- **Multi-agent orchestration** — run multiple agents in coordinated containers

## Completed

- Composable unit system (Presets 2.0)
- Content-hash image tagging and sharing
- SSH agent forwarding (Linux + macOS)
- Git config sync
- GitHub CLI auth forwarding
- Claude Code session sync
- Codex config/session sync
- Generated entrypoint (no hand-maintained scripts)
- Security hardening (cap-drop, no-new-privileges, userns)
- Pre-run scripts
- Per-repo and global config with layered resolution
