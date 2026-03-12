# Presets & Units

Straight Jacket uses a **composable unit system** instead of monolithic Dockerfiles.

## Concepts

A **unit** is a reusable component — a set of packages, Dockerfile snippets, PATH entries, and build args.

A **preset** is a named composition of units.

```
┌─────────────────────────────────────────────────┐
│  Preset: full-stack                             │
│  ┌───────────┐ ┌──────┐ ┌─────┐ ┌───────────┐   │
│  │ dev-utils │ │ node │ │ bun │ │ github-cli│   │
│  └───────────┘ └──────┘ └─────┘ └───────────┘   │
└─────────────────────────────────────────────────┘
```

Straight Jacket generates a multi-stage Dockerfile from the preset's units, builds it once, and content-hash tags the image. Repos sharing the same preset share the same image — no redundant builds.

## Built-in Presets

| Preset                    | Units                                                                       | Use Case                        |
| ------------------------- | --------------------------------------------------------------------------- | ------------------------------- |
| **full-stack**            | dev-utils, node, bun, github-cli, doc-utils                                 | Web apps, JS/TS projects        |
| **full-stack-playwright** | full-stack + playwright                                                     | E2E testing, browser automation |
| **rust-wasm**             | dev-utils, node, rust, wasm, github-cli                                     | WebAssembly development         |
| **il2cpp-re**             | dev-utils, node, github-cli, java, dotnet, rust, ghidra, jadx, il2cpp-tools | Reverse engineering             |

## Built-in Units

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

## Custom Presets

Create your own presets to define exactly the environment you need.

### Per-Repo Preset

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

### User-Level Preset

```bash
mkdir -p ~/.config/sj/presets/my-preset
# Same preset.json format
```

### Resolution Order

Presets resolve in priority order:

1. **Per-repo** — `.sj/presets/<name>/preset.json`
2. **User** — `~/.config/sj/presets/<name>/preset.json`
3. **Built-in** — embedded in the `sj` binary

## Custom Units

Create custom units with their own packages and Dockerfile snippets:

```bash
mkdir -p ~/.config/sj/units/my-tools
```

A unit consists of:

- **`unit.json`** — manifest declaring packages, build args, PATH entries, and dependencies
- **`post-install.Dockerfile`** *(optional)* — injected after system deps are installed
- **`build.Dockerfile`** *(optional)* — standalone build stage for multi-stage builds
- **`post-agent-install.Dockerfile`** *(optional)* — injected after agent binaries are installed

See the built-in units in [`default-units/`](https://github.com/pthrasher/straightjacket/tree/master/default-units) for examples.

Units resolve with the same priority order as presets: per-repo > user > built-in.
