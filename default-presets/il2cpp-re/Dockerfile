# il2cpp-re preset — IL2CPP / Unity reverse engineering environment
# Multi-stage build: assets → ghidra-src → system-deps → user-setup → agents

# ═════════════════════════════════════════════════════════════════════
# Stage: Download jadx release
# ═════════════════════════════════════════════════════════════════════
FROM ubuntu:24.04 AS assets

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    unzip \
  && rm -rf /var/lib/apt/lists/*

RUN wget --progress=dot:giga -O /tmp/jadx.zip "https://github.com/skylot/jadx/releases/download/v1.5.3/jadx-1.5.3.zip"
RUN mkdir -p /opt/jadx \
  && unzip -q /tmp/jadx.zip -d /opt/jadx \
  && rm /tmp/jadx.zip \
  && if [ -d /opt/jadx/bin ]; then \
       true; \
     elif [ -d /opt/jadx/jadx-1.5.3/bin ]; then \
       ln -sfn /opt/jadx/jadx-1.5.3/bin /opt/jadx/bin; \
     else \
       echo "jadx bin directory not found under /opt/jadx" >&2; \
       exit 1; \
      fi

# ═════════════════════════════════════════════════════════════════════
# Stage: Build Ghidra from source
# ═════════════════════════════════════════════════════════════════════
FROM ubuntu:24.04 AS ghidra-src

ARG DEBIAN_FRONTEND=noninteractive
ARG GHIDRA_VERSION=12.0.2
ARG GHIDRA_TAG=Ghidra_${GHIDRA_VERSION}_build

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    unzip \
    zip \
    openjdk-21-jdk \
    python3 \
    python3-venv \
    python3-pip \
    build-essential \
    cmake \
    ninja-build \
    pkg-config \
    rsync \
  && rm -rf /var/lib/apt/lists/*

RUN ARCH="$(dpkg --print-architecture)" \
  && ln -s "/usr/lib/jvm/java-21-openjdk-${ARCH}" /usr/lib/jvm/java-21-openjdk

ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk

RUN git clone --depth 1 --branch "$GHIDRA_TAG" https://github.com/NationalSecurityAgency/ghidra.git /src/ghidra

WORKDIR /src/ghidra
RUN sed -i 's/application.release.name=DEV/application.release.name=PUBLIC/' Ghidra/application.properties
RUN ./gradlew -I gradle/support/fetchDependencies.gradle
RUN ./gradlew buildNatives
RUN ./gradlew buildGhidra

RUN GHIDRA_ZIP="$(find build/dist -type f -name 'ghidra_*_PUBLIC_*.zip' | head -n1)" \
  && test -n "$GHIDRA_ZIP" \
  && unzip -q "$GHIDRA_ZIP" -d /opt \
  && GDIR="$(find /opt -maxdepth 1 -type d -name 'ghidra_*' | head -n1)" \
  && test -n "$GDIR" \
  && mv "$GDIR" /opt/ghidra


# ═════════════════════════════════════════════════════════════════════
# Stage 1: System dependencies (as root)
# ═════════════════════════════════════════════════════════════════════
FROM ubuntu:24.04 AS system-deps

ARG DEBIAN_FRONTEND=noninteractive
ARG NODE_MAJOR=20

# ── Core system packages ────────────────────────────────────────────
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
    # Java
    openjdk-21-jdk \
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
    # RE / binary analysis
    clang \
    llvm \
    strace \
    ltrace \
    patchelf \
    apktool \
    android-sdk-platform-tools \
    android-sdk-build-tools \
    radare2 \
    binwalk \
    mono-complete \
  && rm -rf /var/lib/apt/lists/*

# ── Java symlink (arch-independent) ──────────────────────────────────
RUN ARCH="$(dpkg --print-architecture)" \
  && ln -s "/usr/lib/jvm/java-21-openjdk-${ARCH}" /usr/lib/jvm/java-21-openjdk

# ── Node.js ─────────────────────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
  && apt-get update \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

# ── .NET SDK ────────────────────────────────────────────────────────
RUN mkdir -p /etc/apt/keyrings \
  && wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /etc/apt/keyrings/microsoft.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/microsoft.gpg] https://packages.microsoft.com/ubuntu/24.04/prod noble main" > /etc/apt/sources.list.d/microsoft-prod.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends dotnet-sdk-8.0 \
  && rm -rf /var/lib/apt/lists/*

# ── Rust ─────────────────────────────────────────────────────────────
ENV RUSTUP_HOME=/opt/rustup
ENV CARGO_HOME=/opt/cargo

RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal \
  && /opt/cargo/bin/rustup default stable \
  && chmod -R a+rwx /opt/rustup /opt/cargo

# ── ILSpy CLI ────────────────────────────────────────────────────────
RUN dotnet tool install --tool-path /usr/local/dotnet-tools ilspycmd

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

# ── Copy built artifacts from earlier stages ─────────────────────────
COPY --from=ghidra-src /opt/ghidra /opt/ghidra
COPY --from=assets /opt/jadx /opt/jadx


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
    capstone \
    pyyaml \
    frida-tools \
    UnityPy \
    lz4 \
    tqdm

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


# ═════════════════════════════════════════════════════════════════════
# Final
# ═════════════════════════════════════════════════════════════════════
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk
ENV DOTNET_ROOT=/usr/lib/dotnet
ENV RUSTUP_HOME=/opt/rustup
ENV CARGO_HOME=/opt/cargo
ENV GHIDRA_HOME=/opt/ghidra
ENV PATH=/opt/cargo/bin:/usr/local/dotnet-tools:/opt/jadx/bin:/opt/ghidra/support:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

ARG SANDBOX_WORKDIR=/workdirs/project
WORKDIR ${SANDBOX_WORKDIR}
CMD ["bash"]
