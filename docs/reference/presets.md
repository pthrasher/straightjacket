# Built-in Presets

Presets are named compositions of [units](/reference/units). Each preset defines a complete container environment for a specific workflow.

## full-stack

The default preset. Covers web development, JS/TS projects, and general-purpose coding.

**Units:** dev-utils, node, bun, github-cli, doc-utils

```bash
sj claude --preset full-stack
```

## full-stack-playwright

Extends full-stack with browser automation support.

**Units:** dev-utils, node, bun, github-cli, doc-utils, playwright

```bash
sj claude --preset full-stack-playwright
```

## rust-wasm

WebAssembly development with Rust toolchain and wasm tooling.

**Units:** dev-utils, node, rust, wasm, github-cli

```bash
sj claude --preset rust-wasm
```

## il2cpp-re

Reverse engineering toolkit for IL2CPP/Unity binaries. Includes Ghidra, JADX, .NET, and specialized RE tools.

**Units:** dev-utils, node (v20), github-cli, java, dotnet, rust, ghidra, jadx, il2cpp-tools

```bash
sj claude --preset il2cpp-re
```

## Preset Resolution

Presets are resolved in priority order:

1. **Per-repo** — `.sj/presets/<name>/preset.json`
2. **User** — `~/.config/sj/presets/<name>/preset.json`
3. **Built-in** — embedded in the binary

A per-repo preset with the same name as a built-in preset will override it for that project.

## Preset Format

```json
{
  "name": "my-preset",
  "units": [
    { "name": "dev-utils" },
    { "name": "node", "args": { "version": "20" } },
    { "name": "rust", "args": { "version": "nightly" } }
  ]
}
```

Each entry in `units` can include an `args` object to override the unit's default build arguments.
