# CLI Reference

## Commands

### `sj claude`

Launch Claude Code in a container for the current project.

```bash
sj claude [options]
```

### `sj codex`

Launch Codex in a container for the current project.

```bash
sj codex [options]
```

### `sj shell`

Drop into a zsh shell inside the container. Useful for debugging or manual work.

```bash
sj shell [options]
sj shell claude    # Use claude agent's harness-config as $HOME
sj shell codex     # Use codex agent's harness-config as $HOME
```

### `sj` (bare)

Launch the default agent (configured via `defaultAgent`).

```bash
sj [options]
```

### `sj repo-config`

Generate a `.sj/config.json` in the current project with all defaults pre-filled.

```bash
sj repo-config
sj repo-config --force    # Overwrite existing config
```

## Global Options

| Flag | Description |
| --- | --- |
| `--rebuild` | Force rebuild the container image, ignoring cache |
| `--preset <name>` | Use a specific preset instead of the default |
