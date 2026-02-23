#!/usr/bin/env bash
# Reference entrypoint for sj containers.
# In production, sj generates this per-run. This file is for manual
# testing during Phase 0.
set -euo pipefail

AGENT="${1:-shell}"

# ── 1. Git config sync ──────────────────────────────────────────────
# Handled by sj on the HOST side before container launch: it copies
# ~/.gitconfig and ~/.config/git/ into the harness-config directory,
# which is bind-mounted as $HOME. Nothing to do here.

# ── 2. Environment setup ────────────────────────────────────────────
export USER="${USER:-sandboxuser}"
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
# TTY vars (TERM, COLORTERM, TERM_PROGRAM, etc.) are passed in via
# podman --env flags — no action needed here.

# ── 3. SSH agent ────────────────────────────────────────────────────
if [ -z "${SSH_AUTH_SOCK:-}" ]; then
  echo "warning: SSH_AUTH_SOCK is not set — SSH agent forwarding unavailable" >&2
elif [ ! -S "$SSH_AUTH_SOCK" ]; then
  echo "warning: SSH_AUTH_SOCK ($SSH_AUTH_SOCK) is not a valid socket" >&2
fi

# ── 4. Pre-run scripts ─────────────────────────────────────────────
# Placeholder — sj will inject user-configured preRunScripts here.

# ── 5. Agent launch ────────────────────────────────────────────────
case "$AGENT" in
  claude)
    export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
    # Optional: claude update (controlled by autoUpdate config)
    # claude update
    exec claude --allow-dangerously-skip-permissions --dangerously-skip-permissions
    ;;
  codex)
    exec codex --dangerously-bypass-approvals-and-sandbox
    ;;
  shell|*)
    exec zsh
    ;;
esac
