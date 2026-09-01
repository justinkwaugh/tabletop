#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

sudo install -d -m 755 -o "$(id -u)" -g "$(id -g)" node_modules .pnpm-store
pnpm install --frozen-lockfile --prefer-offline
pnpm turbo init-project
bash .devcontainer/configure-github.sh
bash .devcontainer/configure-codex.sh

touch "${HOME}/.codex/.postcreate_done"
