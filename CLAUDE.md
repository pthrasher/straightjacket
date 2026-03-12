# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Straight Jacket (`sj`) is a CLI tool that automates running AI agents (Claude Code, Codex) inside containerized sandboxes via Podman. It handles image building, config management, credential forwarding, and agent lifecycle.



## Tech Stack

- **Runtime:** Bun 1.3.9 (managed via asdf, see `.tool-versions`)
- **Language:** TypeScript (strict mode)
- **CLI framework:** citty (UnJS) for arg parsing and subcommands
- **Config loading:** c12 (UnJS) for layered config merging (CLI > per-repo > global > defaults)
- **Container runtime:** Podman (v1 only)
- **Distribution:** Single compiled binary via `bun build --compile`

## Commands

- `bun run dev` — run the CLI in development mode
- `bun run build` — compile to standalone binary at `build/sj`
- `bun run typecheck` — type-check without emitting
- `bun test` — run tests

## Source Layout

```
src/                          # TypeScript source
default-presets/              # Built-in preset definitions (JSON, embedded at compile)
  full-stack/preset.json
  full-stack-playwright/preset.json
  il2cpp-re/preset.json
  rust-wasm/preset.json
default-units/                # Built-in unit definitions (JSON + Dockerfile snippets, embedded at compile)
  dev-utils/
  node/
  bun/
  rust/
  wasm/
  github-cli/
  doc-utils/
  playwright/
  java/
  dotnet/
  ghidra/
  jadx/
  il2cpp-tools/
sandbox/                      # Legacy reference implementation (gitignored, not part of the build)
```

## Key Architecture Decisions

- **Composable units:** Presets are JSON compositions of units, not monolithic Dockerfiles. Each unit declares packages, Dockerfile snippets, PATH entries, and build args. `sj` generates a multi-stage Dockerfile from the resolved units at build time.
- **Embedded assets:** Both presets and units are embedded into the compiled binary via `import ... with { type: "file" }` — Bun bundles these into the executable automatically. Adding a new preset or unit requires updating `src/built-in-presets.ts` or `src/built-in-units.ts`.
- **Config resolution:** c12 with layered priority: CLI flags (citty) → `.sj/config.json` (per-repo) → `$XDG_CONFIG_HOME/sj/config.json` (global) → built-in defaults.
- **Sandboxed home:** Each agent gets a sandboxed home directory (`harness-config/<agent>/`) mounted as `$HOME` inside the container. This persists config, caches, and shell history across runs.
- **Generated entrypoint:** The entrypoint script is generated at runtime by `src/entrypoint.ts`, not hand-maintained. It assembles PATH from unit `pathDirs`, handles auth flows, and launches the agent.
- **Content-hash tagging:** Images are tagged with a SHA-256 hash of the generated Dockerfile, so repos sharing the same preset share the same image.

## Communication Style

- **Follow the user's lead.** If I ask about an alternative approach and you've already stated your preference, do not repeat it. Assume I heard you and have a reason for exploring the alternative. Be curious about that reason — ask clarifying questions instead of restating your position.
- **Escalate through questions, not repetition.** If you believe there's a critical risk, ask a targeted question to surface whether I'm aware of it. If my answers reveal I'm missing something important, then be more direct and insistent — that's welcome. But the path to insistence must go through curiosity first.
- **Assume I may know something you don't.** When I persist on an approach, explore why before pushing back.
