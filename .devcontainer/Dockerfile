FROM mcr.microsoft.com/devcontainers/typescript-node:24-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        openssh-server \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g \
    pnpm@10.28.2 \
    turbo

USER node

RUN curl -fsSL https://chatgpt.com/codex/install.sh | sh

# rustup only: libs/18xx-autorouter/rust/rust-toolchain.toml pins the compiler and wasm target.
RUN curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs \
    | sh -s -- -y --no-modify-path --default-toolchain none --profile minimal
ENV PATH="/home/node/.cargo/bin:${PATH}"

USER root
