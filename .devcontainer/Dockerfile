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

# Go: apps/realtime is the realtime relay (docs/realtime-relay.md).
ARG GO_VERSION=1.27.3
RUN case "$(dpkg --print-architecture)" in \
        amd64) go_arch=amd64 go_sha256=65efbc80fdc1fa2cd2631cad5b481777a68e8725f34e89f50fc6ac714e379b40 ;; \
        arm64) go_arch=arm64 go_sha256=a06e99309dbcbdca1a8ccd2282c3ee146e55930886e26b4f1193269587165f49 ;; \
        *) echo "Unsupported architecture for Go" >&2; exit 1 ;; \
    esac \
    && curl -fsSLo /tmp/go.tgz "https://go.dev/dl/go${GO_VERSION}.linux-${go_arch}.tar.gz" \
    && echo "${go_sha256}  /tmp/go.tgz" | sha256sum -c - \
    && tar -C /usr/local -xzf /tmp/go.tgz \
    && rm /tmp/go.tgz
ENV PATH="/usr/local/go/bin:${PATH}"

# Keep all Claude Code state, including the .claude.json that normally sits in $HOME,
# inside the claude-home volume so auth and conversations survive rebuilds.
ENV CLAUDE_CONFIG_DIR="/home/node/.claude"

ENV PNPM_HOME="/opt/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
ARG T3_VERSION=0.0.45
RUN pnpm add --global t3@${T3_VERSION}

USER node

RUN mkdir -p /home/node/.t3 /home/node/.claude

RUN curl -fsSL https://chatgpt.com/codex/install.sh | sh

# Native installer: binary in ~/.local/bin, versions in ~/.local/share/claude, self-updating.
RUN curl -fsSL https://claude.ai/install.sh | bash
ENV PATH="/home/node/.local/bin:${PATH}"

# rustup only: libs/18xx-autorouter/rust/rust-toolchain.toml pins the compiler and wasm target.
RUN curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs \
    | sh -s -- -y --no-modify-path --default-toolchain none --profile minimal
ENV PATH="/home/node/.cargo/bin:${PATH}"

USER root
