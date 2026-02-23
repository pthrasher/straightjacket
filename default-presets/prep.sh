#!/usr/bin/env bash
# Reference host-side prep script for sj containers.
# In production, sj does all of this in TypeScript before calling
# podman run. This file is for manual testing during Phase 0.
set -euo pipefail

AGENT="${1:-shell}"
PROJECT_DIR="${2:-$(pwd)}"
PROJECT_NAME="$(basename "$PROJECT_DIR")"

# ── Config paths ────────────────────────────────────────────────────
SJ_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}/sj"
HARNESS_HOME="$SJ_CONFIG_HOME/harness-config/$AGENT"

# ── 1. First-run bootstrapping ──────────────────────────────────────
# Create the harness-config directory if it doesn't exist yet.
# This becomes $HOME inside the container.
if [ ! -d "$HARNESS_HOME" ]; then
  echo "First run for agent '$AGENT' — creating harness-config at $HARNESS_HOME"
  mkdir -p "$HARNESS_HOME"
fi

# Ensure XDG directories exist inside harness-config so agents
# that write to ~/.config, ~/.cache, ~/.local don't fail.
mkdir -p "$HARNESS_HOME/.config"
mkdir -p "$HARNESS_HOME/.cache"
mkdir -p "$HARNESS_HOME/.local/share"

# ── 2. Git config sync (host → harness-config) ─────────────────────
# Controlled by gitConfigSync config key (default: true).
# One-way copy: host overwrites the sandboxed copy each run.
GIT_CONFIG_SYNC="${SJ_GIT_CONFIG_SYNC:-true}"

if [ "$GIT_CONFIG_SYNC" = "true" ]; then
  # ~/.gitconfig
  if [ -f "$HOME/.gitconfig" ]; then
    cp "$HOME/.gitconfig" "$HARNESS_HOME/.gitconfig"
  fi

  # ~/.config/git/ (includes config, ignore, attributes, etc.)
  if [ -d "$HOME/.config/git" ]; then
    mkdir -p "$HARNESS_HOME/.config/git"
    cp -a "$HOME/.config/git/." "$HARNESS_HOME/.config/git/"
  fi
fi

# ── 3. Resolve container workdir ────────────────────────────────────
WORKDIR="/workdirs/$PROJECT_NAME"

# ── 4. Capture TTY environment ──────────────────────────────────────
TTY_ENVS=()
for var in TERM COLORTERM TERM_PROGRAM TERM_PROGRAM_VERSION LANG COLUMNS LINES; do
  if [ -n "${!var:-}" ]; then
    TTY_ENVS+=(--env "$var=${!var}")
  fi
done
# Forward all LC_* variables
for var in $(env | grep '^LC_' | cut -d= -f1); do
  TTY_ENVS+=(--env "$var=${!var}")
done

# ── 5. Resolve SSH agent socket ─────────────────────────────────────
SSH_ARGS=()
if [ -n "${SSH_AUTH_SOCK:-}" ] && [ -S "$SSH_AUTH_SOCK" ]; then
  SSH_ARGS+=(-v "$SSH_AUTH_SOCK:/run/ssh-agent.sock:ro" --env "SSH_AUTH_SOCK=/run/ssh-agent.sock")
else
  echo "warning: SSH_AUTH_SOCK not available — SSH agent forwarding disabled" >&2
fi

# ── 6. Credential passthrough ───────────────────────────────────────
CRED_ENVS=()
# Pass through API keys if set (agents read these from env)
for var in ANTHROPIC_API_KEY OPENAI_API_KEY; do
  if [ -n "${!var:-}" ]; then
    CRED_ENVS+=(--env "$var=${!var}")
  fi
done

# ── 7. Build image if needed ────────────────────────────────────────
# In production, sj checks content hashes and only rebuilds when the
# Dockerfile changes. For Phase 0, always build.
PRESET_DIR="${PRESET_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/full-stack}"
IMAGE_NAME="sj-$(basename "$PRESET_DIR")"
REBUILD="${SJ_REBUILD:-0}"

if [ "$REBUILD" = "1" ] || ! podman image exists "$IMAGE_NAME"; then
  echo "Building image $IMAGE_NAME from $PRESET_DIR..."
  podman build \
    --build-arg "SANDBOX_UID=$(id -u)" \
    --build-arg "SANDBOX_GID=$(id -g)" \
    --build-arg "SANDBOX_WORKDIR=$WORKDIR" \
    -f "$PRESET_DIR/Dockerfile" \
    -t "$IMAGE_NAME" \
    "$(dirname "${BASH_SOURCE[0]}")/.."
fi

# ── 8. Launch container ─────────────────────────────────────────────
ENTRYPOINT_SH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/entrypoint.sh"

exec podman run --rm -it \
  --userns=keep-id \
  --cap-drop=ALL \
  --security-opt=no-new-privileges \
  -v "$PROJECT_DIR:$WORKDIR" \
  -v "$HARNESS_HOME:/home/sandboxuser" \
  -v "$ENTRYPOINT_SH:/entrypoint.sh:ro" \
  "${SSH_ARGS[@]}" \
  "${TTY_ENVS[@]}" \
  "${CRED_ENVS[@]}" \
  --env "HOME=/home/sandboxuser" \
  --env "USER=sandboxuser" \
  -w "$WORKDIR" \
  "$IMAGE_NAME" \
  bash /entrypoint.sh "$AGENT"
