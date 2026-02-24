RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    unzip \
  && rm -rf /var/lib/apt/lists/*

RUN wget --progress=dot:giga -O /tmp/jadx.zip "https://github.com/skylot/jadx/releases/download/v${UNIT_JADX_VERSION}/jadx-${UNIT_JADX_VERSION}.zip"
RUN mkdir -p /opt/jadx \
  && unzip -q /tmp/jadx.zip -d /opt/jadx \
  && rm /tmp/jadx.zip \
  && if [ -d /opt/jadx/bin ]; then \
       true; \
     elif [ -d /opt/jadx/jadx-${UNIT_JADX_VERSION}/bin ]; then \
       ln -sfn /opt/jadx/jadx-${UNIT_JADX_VERSION}/bin /opt/jadx/bin; \
     else \
       echo "jadx bin directory not found under /opt/jadx" >&2; \
       exit 1; \
      fi
