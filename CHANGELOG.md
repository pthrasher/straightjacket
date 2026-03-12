# Changelog

All notable changes to Straight Jacket will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- VitePress documentation site with GitHub Pages deployment
- GitHub Actions release workflow with macOS code signing and notarization
- Pipeable install script (`curl | sh`) with OS/arch detection
- `rust-wasm` preset with wasm unit (binaryen, wasmtime, wasm-tools)
- `node` unit post-install step for global package support
- README, LICENSE (MIT), and CONTRIBUTING docs

### Removed

- Legacy Phase 0 reference scripts (`prep.sh`, `entrypoint.sh`)
- Stale design docs (`REQUIREMENTS.md`, `ROADMAP.md`, `PRESETS-2.0.md`)
