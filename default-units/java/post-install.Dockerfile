# Arch-independent symlink for JAVA_HOME
RUN ARCH="$(dpkg --print-architecture)" \
  && ln -s "/usr/lib/jvm/java-21-openjdk-${ARCH}" /usr/lib/jvm/java-21-openjdk
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk
