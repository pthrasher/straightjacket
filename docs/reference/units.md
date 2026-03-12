# Built-in Units

Units are the building blocks of presets. Each unit provides a set of packages, Dockerfile snippets, PATH entries, and configurable build arguments.

## dev-utils

Core development tools. Almost every preset should include this.

**Packages:** git, build-essential, zsh, curl, wget, ripgrep, jq, fd-find, bat, tree, unzip, zip, less, man-db, ncurses-term, and 20+ more.

## node

Node.js via the NodeSource apt repository.

| Arg | Default | Description |
| --- | --- | --- |
| `version` | `24` | Node.js major version |

```json
{ "name": "node", "args": { "version": "20" } }
```

## bun

The Bun JavaScript runtime.

## rust

Rust toolchain via rustup, installed for the container user.

| Arg | Default | Description |
| --- | --- | --- |
| `version` | `stable` | Rust toolchain version (`stable`, `nightly`, `1.79.0`, etc.) |

```json
{ "name": "rust", "args": { "version": "nightly" } }
```

**PATH:** `$HOME/.cargo/bin`

## wasm

WebAssembly tooling: binaryen (wasm-opt), wasmtime runtime, and wasm-tools.

| Arg | Default | Description |
| --- | --- | --- |
| `wasmtimeVersion` | `31.0.0` | Wasmtime release version |

**Requires:** rust

**PATH:** `$HOME/.wasmtime/bin`

## github-cli

The GitHub CLI (`gh`) for PR management, issue tracking, and GitHub API access.

## doc-utils

Document processing toolkit: pandoc, LaTeX, PDF tools, OCR (tesseract), and image processing.

## playwright

Playwright browser automation framework with Chromium.

**Requires:** node

## java

OpenJDK 21 JDK.

## dotnet

.NET SDK 8.0 with ILSpy CLI for .NET decompilation.

**PATH:** `$HOME/.dotnet/tools`

## ghidra

[Ghidra](https://ghidra-sre.org/) reverse engineering framework. Uses a multi-stage build to download and extract the release archive.

| Arg | Default | Description |
| --- | --- | --- |
| `version` | `12.0.2` | Ghidra release version |

**Requires:** java

## jadx

[JADX](https://github.com/skylot/jadx) dex-to-Java decompiler. Uses a multi-stage build.

| Arg | Default | Description |
| --- | --- | --- |
| `version` | `1.5.3` | JADX release version |

## il2cpp-tools

Specialized tools for IL2CPP/Unity reverse engineering: clang, LLVM, apktool, radare2, binwalk, mono, and more.

## Unit Structure

Each unit consists of:

| File | Required | Purpose |
| --- | --- | --- |
| `unit.json` | Yes | Manifest: packages, args, PATH entries, dependencies |
| `post-install.Dockerfile` | No | Dockerfile snippet injected after system deps |
| `build.Dockerfile` | No | Standalone build stage (for multi-stage builds) |
| `post-agent-install.Dockerfile` | No | Dockerfile snippet injected after agent installation |

## Unit Resolution

Units resolve in priority order:

1. **Per-repo** — `.sj/units/<name>/`
2. **User** — `~/.config/sj/units/<name>/`
3. **Built-in** — embedded in the binary
