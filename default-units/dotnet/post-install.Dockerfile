# .NET SDK — uses Microsoft's package repo (non-standard install, handled in snippet)
RUN mkdir -p /etc/apt/keyrings \
  && wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /etc/apt/keyrings/microsoft.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/microsoft.gpg] https://packages.microsoft.com/ubuntu/24.04/prod noble main" > /etc/apt/sources.list.d/microsoft-prod.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends dotnet-sdk-8.0 \
  && rm -rf /var/lib/apt/lists/*

# ILSpy CLI
RUN dotnet tool install --tool-path /usr/local/dotnet-tools ilspycmd

ENV DOTNET_ROOT=/usr/lib/dotnet
