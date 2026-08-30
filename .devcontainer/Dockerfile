FROM mcr.microsoft.com/devcontainers/typescript-node:24-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        openssh-server \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g \
    @openai/codex \
    pnpm@10.28.2 \
    turbo
