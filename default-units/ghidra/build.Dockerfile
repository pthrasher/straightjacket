ARG GHIDRA_TAG=Ghidra_${UNIT_GHIDRA_VERSION}_build

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
