# Add WASM compilation targets
RUN /opt/cargo/bin/rustup target add wasm32-unknown-unknown wasm32-wasip1

# Install wasmtime
RUN ARCH="$(uname -m)" \
  && if [ "${UNIT_WASM_WASMTIME_VERSION}" = "latest" ]; then \
       WASMTIME_VER="$(curl -fsSI -o /dev/null -w '%{redirect_url}' \
         https://github.com/bytecodealliance/wasmtime/releases/latest \
         | grep -oP 'v\K[0-9.]+')"; \
     else \
       WASMTIME_VER="${UNIT_WASM_WASMTIME_VERSION}"; \
     fi \
  && curl -fsSL "https://github.com/bytecodealliance/wasmtime/releases/download/v${WASMTIME_VER}/wasmtime-v${WASMTIME_VER}-${ARCH}-linux.tar.xz" \
       -o /tmp/wasmtime.tar.xz \
  && mkdir -p /opt/wasmtime/bin \
  && tar -xf /tmp/wasmtime.tar.xz -C /tmp \
  && cp /tmp/wasmtime-*/wasmtime /opt/wasmtime/bin/ \
  && chmod 755 /opt/wasmtime/bin/wasmtime \
  && rm -rf /tmp/wasmtime*
