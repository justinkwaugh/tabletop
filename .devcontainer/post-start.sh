#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

bash .devcontainer/configure-ssh-access.sh
bash .devcontainer/configure-codex.sh
