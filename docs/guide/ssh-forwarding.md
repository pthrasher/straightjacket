# SSH Agent Forwarding

SSH agent forwarding lets agents inside the container use your host SSH keys for git operations and commit signing — without copying private keys into the container.

## Setup

Enable it in your config:

```json
{
  "sshForwarding": true
}
```

Or per-invocation:

```bash
sj claude --sshForwarding
```

## How It Works

### Linux

The host's `SSH_AUTH_SOCK` socket is bind-mounted directly into the container. Simple and fast.

### macOS

macOS uses virtiofs to share files with the Podman VM, which can't mount Unix sockets. Straight Jacket works around this automatically:

1. Opens an SSH reverse tunnel into the Podman VM
2. Forwards your host's `SSH_AUTH_SOCK` to a socket inside the VM
3. Bind-mounts that VM socket into the container

This happens transparently — you just set `sshForwarding: true` and it works.

::: info Rootless Podman recommended
SSH agent forwarding works best with rootless Podman, which is needed for `--userns=keep-id` to map file ownership correctly.
:::
