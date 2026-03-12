# Configuration

Straight Jacket uses **layered configuration** with clear precedence:

```
CLI flags  >  per-repo config  >  global config  >  built-in defaults
```

## Global Config

Located at `$XDG_CONFIG_HOME/sj/config.json` (typically `~/.config/sj/config.json`):

```json
{
  "defaultAgent": "claude",
  "defaultPreset": "full-stack",
  "gitConfigSync": true,
  "sshForwarding": false,
  "githubCli": false,
  "autoUpdate": false
}
```

## Per-Repo Config

Generate a per-repo config with all defaults pre-filled:

```bash
sj repo-config
```

This creates `.sj/config.json` in your project root. Override any setting per-project — for example, use a different preset for a Rust project without changing your global default.

Use `--force` to overwrite an existing config:

```bash
sj repo-config --force
```

## Config Options

| Option            | Default        | Description                                      |
| ----------------- | -------------- | ------------------------------------------------ |
| `defaultAgent`    | `"claude"`     | Agent to launch with bare `sj`                   |
| `defaultPreset`   | `"full-stack"` | Preset to use when not specified                 |
| `autoUpdate`      | `false`        | Update agent binaries before each launch         |
| `gitConfigSync`   | `true`         | Sync host git config into the container          |
| `sshForwarding`   | `false`        | Forward SSH agent for key-based auth and signing |
| `githubCli`       | `false`        | Prompt for `gh` auth if not authenticated        |
| `codexConfigSync` | `false`        | Sync Codex config and sessions                   |
| `preRunScripts`   | `[]`           | Shell scripts to run before agent launch         |

## Directory Structure

```
~/.config/sj/
├── config.json              # Global config
├── presets/                  # User-defined presets
│   └── <name>/preset.json
├── units/                   # User-defined units
│   └── <name>/unit.json
└── harness-config/          # Per-agent sandboxed home directories
    ├── claude/
    └── codex/
```

Per-repo:

```
your-project/
└── .sj/
    ├── config.json           # Per-repo config overrides
    ├── presets/               # Per-repo custom presets
    └── units/                 # Per-repo custom units
```
