#!/usr/bin/env bash
set -euo pipefail

# macOS only — Bun's JS engine needs JIT entitlements or the kernel
# will SIGKILL the process on launch. We build to a fresh temp dir,
# ad-hoc codesign with entitlements, install, and clean up.

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Error: this script only runs on macOS" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="$(mktemp -d)"
OUTFILE="${BUILD_DIR}/sj"
ENTITLEMENTS="${SCRIPT_DIR}/entitlements.plist"

INSTALL_DIR="${HOME}/.local/bin"
INSTALL_PATH="${INSTALL_DIR}/sj"

echo "Building to ${BUILD_DIR}..."
bun build --compile "${PROJECT_DIR}/src/index.ts" --outfile "$OUTFILE" --external chokidar

echo "Installing to ${INSTALL_PATH}..."
mkdir -p "$INSTALL_DIR"
cp "$OUTFILE" "$INSTALL_PATH"

echo "Cleaning up build directory..."
rm -rf "$BUILD_DIR"

echo "Codesigning with JIT entitlements..."
codesign --entitlements "$ENTITLEMENTS" --sign - --force "$INSTALL_PATH"

echo "Done. $(${INSTALL_PATH} --version 2>/dev/null || echo 'sj installed')"
