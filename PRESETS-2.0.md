# Presets 2.0: Composable Units

This document describes the redesigned preset system where presets are composed of reusable **units** rather than monolithic Dockerfiles.

## Motivation

The current system uses hand-written Dockerfiles per preset. These share significant common infrastructure (zsh, dev utilities, GitHub CLI, user-setup boilerplate) that gets duplicated and diverges across presets. Adding a new preset means copying an entire Dockerfile and adapting it, even when only one toolchain differs.

Units factor out the shared foundation. Each unit declares its dependencies and contributes a small, focused piece to the final Dockerfile. Presets become a list of units.

## Concepts

### Unit

A unit is a self-contained, reusable component that provides a specific capability (e.g., Node.js, Rust, Playwright). A unit declares:

- **apt packages** — merged with other units into a single `apt-get install`
- **apt repos** — PPAs or custom sources added before the merged apt install
- **pip packages** — merged with other units into a single `pip install`
- **build args** — parameterized inputs (e.g., version) with defaults
- **requirements** — other units that must be present (validated, not auto-resolved)
- **Dockerfile snippets** — injected at a declared slot in the generated Dockerfile

### Preset

A preset is a named composition of units with optional per-unit arg overrides:

```json
{
  "name": "full-stack-node",
  "units": [
    { "name": "node", "args": { "version": "22" } },
    { "name": "bun" },
    { "name": "dev-utils" },
    { "name": "rust", "args": { "version": "stable" } }
  ]
}
```

Presets can be built-in (shipped with sj), global (`$XDG_CONFIG_HOME/sj/presets/`), or per-repo (`.sj/presets/`).

### Slots

The generated Dockerfile has a fixed skeleton with named **slots** where unit snippets are injected. sj controls the skeleton and the security-critical stages; units contribute content to the open slots.

Available slots:

| Slot | Location | Default? |
|------|----------|----------|
| `post-install` | After merged apt and pip installs, before user-setup | Yes (if no slot specified) |
| `post-agent-install` | After sj-controlled agent installation stage | No |

Additional slots may be added as use cases emerge. Shell customization and user-setup remain sj-controlled and are not configurable through units.

## Unit Definition

A unit is a directory containing a manifest and optional Dockerfile fragments.

### Directory Structure

```
units/
  node/
    unit.json              # manifest: apt, pip, args, requires, slot
    install.Dockerfile     # snippet injected into the main image
  ghidra/
    unit.json
    build.Dockerfile       # standalone FROM stage (multi-stage build)
    install.Dockerfile     # COPY --from + final setup in main image
  dev-utils/
    unit.json              # apt and pip only, no Dockerfile snippets needed
```

### Manifest (`unit.json`)

```json
{
  "description": "Node.js via NodeSource",
  "apt": ["nodejs"],
  "aptRepos": [
    {
      "url": "https://deb.nodesource.com/setup_${UNIT_NODE_VERSION}.x",
      "name": "nodesource"
    }
  ],
  "pip": [],
  "args": {
    "version": {
      "description": "Node.js major version",
      "default": "22"
    }
  },
  "requires": ["dev-utils"],
  "slot": "post-install"
}
```

All fields are optional except that a unit should declare at least one of: `apt`, `pip`, `install.Dockerfile`, or `build.Dockerfile`.

### Build Args and Naming Convention

Unit args are exposed as Dockerfile `ARG`s with a namespaced prefix to avoid collisions:

```
UNIT_<UPPER_SNAKE_UNIT_NAME>_<UPPER_SNAKE_ARG_NAME>
```

Examples:
- Unit `node`, arg `version` → `ARG UNIT_NODE_VERSION=22`
- Unit `rust`, arg `version` → `ARG UNIT_RUST_VERSION=stable`

Unit Dockerfile snippets reference these args directly (e.g., `$UNIT_NODE_VERSION`).

### Dockerfile Snippets

**`install.Dockerfile`** — A fragment injected into the main image at the unit's declared slot. This is not a complete Dockerfile; it contains `RUN`, `COPY`, `ENV`, etc. directives that execute in the context of the main image stage.

**`build.Dockerfile`** — An optional standalone build stage that gets its own `FROM` block at the top of the generated Dockerfile. Used for multi-stage builds: compiling from source, downloading and extracting large archives, etc. The stage is automatically named `unit-<name>-build`, and the unit's `install.Dockerfile` can reference it via `COPY --from=unit-<name>-build`.

### Apt Repos

For packages available in standard Ubuntu repos, listing them in `apt` is sufficient. For packages requiring a PPA or custom repo, units have two options:

1. **Declarative `aptRepos`** — sj adds the repo source before the merged `apt-get install`. This handles the common case (GitHub CLI, .NET, Node repos) cleanly.
2. **Snippet-based** — For truly custom setup that doesn't fit the add-repo-then-install pattern (curl | tar, multi-step sequences), the unit handles everything in its `install.Dockerfile` and does not list those packages in `apt`.

Both approaches are compatible and a single unit can use both: declarative `apt` for the simple packages and a snippet for the rest.

### Requirements (Dependencies)

Units can declare `"requires": ["other-unit"]` to indicate they need another unit present in the preset. sj validates the full unit list before generating anything:

- If a required unit is missing, sj prints a clear warning: `unit 'playwright' requires 'node' but it's not included in preset 'my-preset'`
- sj does **not** auto-resolve dependencies (no dynamic dep resolution)
- The preset author is responsible for including all required units

## Generated Dockerfile Structure

sj assembles the final Dockerfile from the skeleton and unit contributions:

```dockerfile
# ============================
# 1. Build stages (per-unit)
# ============================
# Each unit with a build.Dockerfile gets its own FROM block.
# Stage name: unit-<name>-build

FROM ubuntu:24.04 AS unit-ghidra-build
# ... contents of ghidra/build.Dockerfile ...

# ============================
# 2. System deps stage
# ============================
FROM ubuntu:24.04 AS system-deps

# 2a. Apt repos (merged from all units)
# ... add all declared aptRepos ...

# 2b. Apt packages (merged from all units, single apt-get install)
RUN apt-get update && apt-get install -y \
    <merged apt packages> \
    && rm -rf /var/lib/apt/lists/*

# 2c. Pip packages (merged from all units, single pip install)
RUN pip install --break-system-packages \
    <merged pip packages>

# 2d. Slot: post-install (unit snippets, in preset declaration order)
# ... node/install.Dockerfile ...
# ... ghidra/install.Dockerfile (with COPY --from=unit-ghidra-build) ...
# ... etc ...

# ============================
# 3. User-setup stage (sj-controlled, not customizable)
# ============================
FROM system-deps AS user-setup

# UID/GID handling, GID collision detection
# Create sandboxuser, zsh shell, home directory
# XDG directories, shell config, history setup

# ============================
# 4. Agents stage (sj-controlled, not customizable)
# ============================
FROM user-setup AS agents

# Install agent binaries to /usr/local/bin
# Claude Code, Codex, etc.

# Slot: post-agent-install (unit snippets, in preset declaration order)
# ... any units targeting this slot ...

# ============================
# 5. Finalize
# ============================
WORKDIR ${SANDBOX_WORKDIR}
USER sandboxuser
```

### sj-Controlled Stages

The user-setup and agents stages are owned by sj and are not customizable through units. These handle:

- `SANDBOX_UID` / `SANDBOX_GID` / `SANDBOX_WORKDIR` build args
- GID collision handling (macOS GID 20)
- sandboxuser creation with zsh shell
- XDG directory structure in home
- Agent binary installation to `/usr/local/bin`
- `/usr/local/bin` writable by sandboxuser (for agent auto-update)

## Unit Storage and Resolution

### Built-in Units

Built-in units ship with sj, embedded into the binary at compile time via Bun's `import ... with { type: "file" }`. They live in the source tree:

```
default-units/
  node/
    unit.json
    install.Dockerfile
  bun/
    unit.json
    install.Dockerfile
  rust/
    unit.json
    build.Dockerfile
    install.Dockerfile
  dev-utils/
    unit.json
  ...
```

### User-Defined Units

Users can define custom units at two levels:

- **Global:** `$XDG_CONFIG_HOME/sj/units/<name>/`
- **Per-repo:** `.sj/units/<name>/`

### Resolution Order (highest priority first)

1. Per-repo units (`.sj/units/<name>/`)
2. Global user units (`$XDG_CONFIG_HOME/sj/units/<name>/`)
3. Built-in units

This allows users to override a built-in unit (e.g., to pin a different default version) without forking.

## Preset Storage and Resolution

Presets follow the same resolution pattern:

- **Built-in:** embedded in the binary (e.g., `full-stack`, `full-stack-playwright`)
- **Global:** `$XDG_CONFIG_HOME/sj/presets/<name>/preset.json`
- **Per-repo:** `.sj/presets/<name>/preset.json`

### Resolution Order (highest priority first)

1. Per-repo presets (`.sj/presets/<name>/preset.json`)
2. Global user presets (`$XDG_CONFIG_HOME/sj/presets/<name>/preset.json`)
3. Built-in presets

## Migration from Presets 1.0

This system completely replaces the monolithic Dockerfile preset system. Existing presets (`full-stack`, `full-stack-playwright`, `il2cpp-re`) will be decomposed into units and rebuilt as unit-based presets.

Example decomposition of `full-stack`:

```json
{
  "name": "full-stack",
  "units": [
    { "name": "dev-utils" },
    { "name": "node" },
    { "name": "bun" },
    { "name": "python-dev" }
  ]
}
```

Example decomposition of `il2cpp-re`:

```json
{
  "name": "il2cpp-re",
  "units": [
    { "name": "dev-utils" },
    { "name": "dotnet" },
    { "name": "python-dev" },
    { "name": "ghidra", "args": { "version": "11.3.2" } },
    { "name": "jadx" },
    { "name": "il2cpp-tools" }
  ]
}
```

## Open Questions

- **`aptRepos` format:** The exact format for declaring apt repos needs to be nailed down. The manifest example above is a rough sketch — we need to handle GPG keys, signed-by, and architecture filtering.
- **Snippet ordering within a slot:** Currently defined as "preset declaration order." Is explicit ordering ever needed, or is declaration order always sufficient?
- **Unit versioning:** If a user overrides a built-in unit, how do they know when the built-in version has been updated? Do we need a mechanism for this, or is it the user's responsibility?
