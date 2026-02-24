COPY --from=unit-ghidra-build /opt/ghidra /opt/ghidra
ENV GHIDRA_HOME=/opt/ghidra
