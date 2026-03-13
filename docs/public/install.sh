#!/bin/sh
# Install Straight Jacket (sj)
# Usage: curl -fsSL https://straightjacket.dev/install.sh | sh
set -e

REPO="pthrasher/straightjacket"
BINARY="sj"

# Determine install directory
if [ -n "$SJ_INSTALL_DIR" ]; then
  INSTALL_DIR="$SJ_INSTALL_DIR"
elif echo ":$PATH:" | grep -q ":$HOME/.local/bin:"; then
  INSTALL_DIR="$HOME/.local/bin"
else
  INSTALL_DIR="/usr/local/bin"
fi

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Linux)  OS_TAG="linux" ;;
  Darwin) OS_TAG="darwin" ;;
  *)
    echo "Error: unsupported OS: $OS" >&2
    exit 1
    ;;
esac

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64)  ARCH_TAG="x64" ;;
  arm64|aarch64)  ARCH_TAG="arm64" ;;
  *)
    echo "Error: unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

ARTIFACT="sj-${OS_TAG}-${ARCH_TAG}"

# Get latest release tag (or use specified version)
if [ -n "$SJ_VERSION" ]; then
  TAG="$SJ_VERSION"
else
  TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | cut -d'"' -f4)
  if [ -z "$TAG" ]; then
    echo "Error: could not determine latest release" >&2
    exit 1
  fi
fi

URL="https://github.com/${REPO}/releases/download/${TAG}/${ARTIFACT}"

echo "Installing Straight Jacket ${TAG} (${OS_TAG}/${ARCH_TAG})..."

# Download
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
curl -fsSL -o "$TMP" "$URL"
chmod +x "$TMP"

# Install
mkdir -p "$INSTALL_DIR" 2>/dev/null || true
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP" "${INSTALL_DIR}/${BINARY}"
else
  echo "Need sudo to install to ${INSTALL_DIR}"
  sudo mv "$TMP" "${INSTALL_DIR}/${BINARY}"
fi

echo "Installed sj to ${INSTALL_DIR}/${BINARY}"
echo "Run 'sj --help' to get started."
