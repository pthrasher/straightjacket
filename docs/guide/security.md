# Security Model

Straight Jacket containers are hardened by default. The goal: let agents work autonomously while preventing them from affecting anything outside your project.

## Container Hardening

Every container runs with:

- **`--cap-drop=ALL`** — all Linux capabilities removed
- **`--security-opt=no-new-privileges`** — prevents privilege escalation via setuid/setgid
- **`--userns=keep-id`** — maps your host UID/GID into the container without root

## Credential Handling

- **No secrets in images** — API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) are passed via environment variables at runtime, never baked into layers
- **SSH keys stay on the host** — agent forwarding shares access to keys without copying them
- **Read-only entrypoint** — the generated entrypoint script is bind-mounted read-only

## What's Isolated

| Resource | Access |
| --- | --- |
| Host filesystem (outside project) | None |
| Host home directory | None — agent gets a sandboxed `$HOME` |
| Project directory | Read-write (agents need to edit code) |
| Network | Full access (agents need APIs and package registries) |
| Host processes | None |
| Linux capabilities | None (all dropped) |

## What's Not Isolated

Your **project directory is mounted read-write**. An agent can:

- Delete files in your project
- Overwrite code
- Make a mess of your repo

This is by design — agents need to edit code to be useful. Mitigations:

- **Use version control.** Commit before launching an agent. Review diffs after.
- **Don't pass production credentials.** If it's in an env var or a file in your project, the agent can see it.
- **Review what you mount.** Straight Jacket only mounts your current project directory, not your entire home.

## Network Access

Agents currently have full network access. They need to:

- Call AI APIs (Anthropic, OpenAI)
- Install packages (npm, pip, cargo, apt)
- Clone repos, push code

Network restriction (configurable firewalling) is a [planned future feature](/roadmap).
