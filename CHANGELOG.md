# Changelog

All notable changes to Straight Jacket will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.0.0] - 2026-03-12

### Added
- Core CLI with subcommands (`sj claude`, `sj codex`, `sj shell`, `sj init`, `sj repo-config`)
- Layered config system via c12 (CLI flags > per-repo > global > built-in defaults)
- Presets 2.0: composable unit architecture replacing monolithic Dockerfiles
- Dynamic Dockerfile generation from resolved unit compositions
- 13 built-in units: dev-utils, node, bun, rust, wasm, github-cli, doc-utils, playwright, java, dotnet, ghidra, jadx, il2cpp-tools
- 4 built-in presets: full-stack, full-stack-playwright, il2cpp-re, rust-wasm
- Content-hash image tagging (repos sharing the same preset share the same image)
- Declarative `pathDirs` in unit manifests for PATH management
- Host-side prep: harness-config bootstrap, git config sync, SSH agent forwarding
- Codex session/config syncing with path rewriting
- GitHub CLI authentication forwarding
- macOS build script with codesigning and JIT entitlements
- `sj repo-config` subcommand for scaffolding per-repo config
- VitePress documentation site with GitHub Pages deployment
- GitHub Actions release workflow with cross-platform binary builds, macOS code signing and notarization
- Pipeable install script (`curl | sh`) with OS/arch detection

### Security
- Podman hardening defaults: cap-drop=ALL, no-new-privileges, userns=keep-id
- Container isolation for autonomous agent execution
