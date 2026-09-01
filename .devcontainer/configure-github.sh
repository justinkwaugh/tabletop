#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${GH_TOKEN:-}" ]]; then
    echo "GH_TOKEN is not set; skipping GitHub authentication setup"
    exit 0
fi

if ! gh auth status --hostname github.com >/dev/null 2>&1; then
    echo "GH_TOKEN is not valid for github.com; skipping GitHub authentication setup"
    exit 0
fi

gh auth setup-git --hostname github.com >/dev/null
git config --global --replace-all 'url.https://github.com/.insteadOf' 'git@github.com:'
git config --global --add 'url.https://github.com/.insteadOf' 'ssh://git@github.com/'
