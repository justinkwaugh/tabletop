FROM mcr.microsoft.com/devcontainers/typescript-node:24-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        gnupg \
        openssh-server \
    && rm -rf /var/lib/apt/lists/*

# Google Cloud CLI: tools/deploy uploads artifacts and manifests with `gcloud storage`.
RUN install -d -m 0755 /etc/apt/keyrings \
    && curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
        | gpg --batch --yes --dearmor -o /etc/apt/keyrings/google-cloud-cli.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/google-cloud-cli.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
        > /etc/apt/sources.list.d/google-cloud-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-cloud-cli \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g \
    pnpm@10.28.2 \
    turbo

ENV PNPM_HOME="/opt/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
ARG T3_VERSION=0.0.42
RUN pnpm add --global t3@${T3_VERSION}

USER node

RUN mkdir -p /home/node/.t3

RUN curl -fsSL https://chatgpt.com/codex/install.sh | sh

# rustup only: libs/18xx-autorouter/rust/rust-toolchain.toml pins the compiler and wasm target.
RUN curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs \
    | sh -s -- -y --no-modify-path --default-toolchain none --profile minimal
ENV PATH="/home/node/.cargo/bin:${PATH}"

USER root
