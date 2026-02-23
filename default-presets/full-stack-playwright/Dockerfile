# full-stack-playwright preset — full-stack + Playwright & Chromium
# Multi-stage build: system-deps → user-setup → agents

# ═════════════════════════════════════════════════════════════════════
# Stage 1: System dependencies (as root)
# ═════════════════════════════════════════════════════════════════════
FROM ubuntu:24.04 AS system-deps

ARG DEBIAN_FRONTEND=noninteractive
ARG NODE_MAJOR=24

# ── Core system packages ────────────────────────────────────────────
# Identical to full-stack for maximum layer cache sharing.
RUN apt-get update \
  && apt-get install -y --no-install-recommends software-properties-common \
  && add-apt-repository -y universe \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    # Core utilities
    ca-certificates \
    curl \
    wget \
    gnupg \
    lsb-release \
    file \
    less \
    zip \
    unzip \
    tmux \
    openssh-client \
    # Shells
    zsh \
    # Version control
    git \
    git-lfs \
    # Build tools
    build-essential \
    cmake \
    ninja-build \
    pkg-config \
    # Python
    python3 \
    python3-venv \
    python3-pip \
    python3-dev \
    # CLI search & navigation
    ripgrep \
    jq \
    tree \
    fd-find \
    bat \
    # Archive / compression
    p7zip-full \
    xz-utils \
    zstd \
    lz4 \
    # Hex / binary inspection
    xxd \
    hexyl \
    bvi \
    vbindiff \
    bsdextrautils \
    # Database
    sqlite3 \
    # Document conversion
    pandoc \
    # PDF CLI tools
    poppler-utils \
    ghostscript \
    qpdf \
    # OCR
    tesseract-ocr \
    tesseract-ocr-eng \
    # Image processing
    imagemagick \
  && rm -rf /var/lib/apt/lists/*

# ── Node.js ─────────────────────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
  && apt-get update \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

# ── Bun ──────────────────────────────────────────────────────────────
RUN curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash

# ── GitHub CLI ──────────────────────────────────────────────────────
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/*

# ── Convenience symlinks (Ubuntu renames these) ─────────────────────
RUN ln -sf /usr/bin/batcat /usr/local/bin/bat \
  && ln -sf /usr/bin/fdfind /usr/local/bin/fd

# ── Playwright system dependencies (separate RUN to preserve cache) ─
RUN pip3 install --no-cache-dir --break-system-packages playwright \
  && playwright install-deps chromium


# ═════════════════════════════════════════════════════════════════════
# Stage 2: User setup (as root)
# ═════════════════════════════════════════════════════════════════════
FROM system-deps AS user-setup

ARG SANDBOX_UID=1000
ARG SANDBOX_GID=1000
ARG SANDBOX_WORKDIR=/workdirs/project

# ── Create sandbox user with GID collision handling ─────────────────
# macOS default GID is 20 (staff), which maps to "dialout" in Ubuntu.
# Detect if the GID already exists and reuse it instead of failing.
RUN existing_group=$(getent group ${SANDBOX_GID} | cut -d: -f1 || true) \
  && if [ -z "$existing_group" ]; then \
       groupadd -g ${SANDBOX_GID} sandboxgroup; \
     fi \
  && useradd -m -u ${SANDBOX_UID} -g ${SANDBOX_GID} -s /bin/zsh sandboxuser

# ── Python packages (installed as root to system site-packages) ─────
# Must NOT install as sandboxuser — ~/.local/ gets shadowed when
# harness-config is mounted as $HOME.
RUN pip3 install --no-cache-dir --break-system-packages \
    # Excel
    openpyxl \
    xlsxwriter \
    # Word / PowerPoint
    python-docx \
    python-pptx \
    # PDF
    pypdf \
    reportlab \
    pdfplumber \
    ocrmypdf \
    # Data & visualization
    pandas \
    matplotlib \
    Pillow \
    # HTML / web scraping
    beautifulsoup4 \
    lxml \
    requests \
    httpx \
    html2text \
    markdownify \
    trafilatura \
    readability-lxml \
    # YAML / CSV tools
    pyyaml \
    yq \
    csvkit \
    # File type detection
    python-magic \
    # Utilities
    tqdm \
    lz4

# ── Workdir ─────────────────────────────────────────────────────────
RUN mkdir -p ${SANDBOX_WORKDIR} \
  && chown ${SANDBOX_UID}:${SANDBOX_GID} ${SANDBOX_WORKDIR}


# ═════════════════════════════════════════════════════════════════════
# Stage 3: Agent installation (as root)
# ═════════════════════════════════════════════════════════════════════
FROM user-setup AS agents

ARG SANDBOX_UID=1000
ARG SANDBOX_GID=1000

# ── Make /usr/local/bin group-writable for agent auto-update ────────
RUN chown root:${SANDBOX_GID} /usr/local/bin \
  && chmod 775 /usr/local/bin

# ── Codex ───────────────────────────────────────────────────────────
RUN npm install -g @openai/codex@latest

# ── Claude Code ─────────────────────────────────────────────────────
# The installer creates a symlink at ~/.local/bin/claude pointing to
# the real binary under ~/.local/share/claude/versions/<ver>. We need
# to copy the actual binary, not the symlink.
RUN curl -fsSL https://claude.ai/install.sh | bash \
  && CLAUDE_BIN=$(readlink -f /root/.local/bin/claude) \
  && test -f "$CLAUDE_BIN" \
       || { echo "Claude binary not found"; find /root -name claude -type f; exit 1; } \
  && cp "$CLAUDE_BIN" /usr/local/bin/claude \
  && chmod 755 /usr/local/bin/claude \
  && rm -rf /root/.local /root/.claude

# ── Playwright Chromium browser (as sandboxuser) ────────────────────
# Store browsers outside $HOME so they survive the harness-config mount.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
RUN mkdir -p /opt/playwright-browsers \
  && chown ${SANDBOX_UID}:${SANDBOX_GID} /opt/playwright-browsers
USER sandboxuser
RUN playwright install chromium
USER root


# ═════════════════════════════════════════════════════════════════════
# Final
# ═════════════════════════════════════════════════════════════════════
ARG SANDBOX_WORKDIR=/workdirs/project
WORKDIR ${SANDBOX_WORKDIR}
CMD ["bash"]
