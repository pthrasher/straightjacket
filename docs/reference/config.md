# Config Reference

## Resolution Order

Configuration is resolved with the following precedence (highest first):

1. **CLI flags** — passed directly to the `sj` command
2. **Per-repo config** — `.sj/config.json` in the project root
3. **Global config** — `$XDG_CONFIG_HOME/sj/config.json`
4. **Built-in defaults** — hardcoded in the binary

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultAgent` | `"claude" \| "codex"` | `"claude"` | Agent to launch when running bare `sj` |
| `defaultPreset` | `string` | `"full-stack"` | Preset to use when `--preset` is not specified |
| `autoUpdate` | `boolean` | `false` | Update agent binaries before each launch |
| `gitConfigSync` | `boolean` | `true` | Copy host `~/.gitconfig` and `~/.config/git/` into the container on each run |
| `sshForwarding` | `boolean` | `false` | Forward `SSH_AUTH_SOCK` for key-based auth and commit signing |
| `githubCli` | `boolean` | `false` | Prompt for `gh auth login` if not already authenticated |
| `codexConfigSync` | `boolean` | `false` | Sync Codex config, auth, and session data into the container |
| `preRunScripts` | `string[]` | `[]` | Shell scripts to execute inside the container before launching the agent |
| `rebuild` | `boolean` | `false` | Force rebuild the container image (same as `--rebuild` flag) |

## Per-Agent Overrides

The `agents` key allows per-agent configuration:

```json
{
  "agents": {
    "claude": {
      "configPath": "/custom/path/to/claude-harness"
    },
    "codex": {
      "configPath": "/custom/path/to/codex-harness"
    }
  }
}
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `agents.<name>.configPath` | `string` | `~/.config/sj/harness-config/<name>/` | Custom path for the agent's sandboxed home directory |
