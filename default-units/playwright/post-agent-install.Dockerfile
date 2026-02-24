# Install Chromium browser as sandboxuser.
# Store browsers outside $HOME so they survive the harness-config mount.
ARG SANDBOX_UID=1000
ARG SANDBOX_GID=1000
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
RUN mkdir -p /opt/playwright-browsers \
  && chown ${SANDBOX_UID}:${SANDBOX_GID} /opt/playwright-browsers
USER sandboxuser
RUN playwright install chromium
USER root
