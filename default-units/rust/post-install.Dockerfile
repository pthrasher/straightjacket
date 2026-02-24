ENV RUSTUP_HOME=/opt/rustup
ENV CARGO_HOME=/opt/cargo

RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal \
  && /opt/cargo/bin/rustup default ${UNIT_RUST_VERSION} \
  && chmod -R a+rwx /opt/rustup /opt/cargo
