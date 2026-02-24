#!/usr/bin/env bash
set -euo pipefail

# macOS only — Gatekeeper quarantines unsigned binaries and remembers
# output directories, so we build to a fresh temp dir every time,
# ad-hoc codesign, install, and clean up.

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Error: this script only runs on macOS" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$(mktemp -d)"
OUTFILE="${BUILD_DIR}/sj"

echo "Building to ${BUILD_DIR}..."
bun build --compile "${SCRIPT_DIR}/src/index.ts" --outfile "$OUTFILE" --external chokidar

echo "Codesigning..."
codesign --sign - --force "$OUTFILE"

echo "Installing to ~/.local/bin/sj..."
mkdir -p ~/.local/bin
cp "$OUTFILE" ~/.local/bin/sj

echo "Cleaning up build directory..."
rm -rf "$BUILD_DIR"

echo "Done. $(~/.local/bin/sj --version 2>/dev/null || echo 'sj installed')"
