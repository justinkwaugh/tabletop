#!/usr/bin/env bash

set -euo pipefail

readonly T3_HOME="${HOME}/.t3"
readonly T3_SEED="${HOME}/.codex/t3-devcontainer-seed"
readonly T3_LOG="${T3_HOME}/devcontainer.log"

sudo install -d -m 700 -o "$(id -u)" -g "$(id -g)" "${T3_HOME}"
exec 9>"${T3_HOME}/devcontainer.lock"
if ! flock -n 9; then
    echo "T3 is already managed by the devcontainer startup script."
    exit 0
fi

if [ ! -d "${T3_HOME}/userdata" ] && [ -d "${T3_SEED}/userdata" ]; then
    cp -a "${T3_SEED}/." "${T3_HOME}/"
fi

if (echo > /dev/tcp/127.0.0.1/3773) 2>/dev/null; then
    echo "Port 3773 is already in use; leaving the existing server running."
    exit 0
fi

umask 077
nohup t3 serve /workspace --host 127.0.0.1 --port 3773 --base-dir "${T3_HOME}" \
    >>"${T3_LOG}" 2>&1 < /dev/null &
t3_pid=$!

for ((attempt = 0; attempt < 30; attempt++)); do
    if ! kill -0 "${t3_pid}" 2>/dev/null; then
        echo "T3 failed to start. See ${T3_LOG}." >&2
        exit 1
    fi
    if (echo > /dev/tcp/127.0.0.1/3773) 2>/dev/null; then
        echo "T3 is listening on 127.0.0.1:3773. Log: ${T3_LOG}"
        exit 0
    fi
    sleep 1
done

echo "T3 has not opened port 3773 yet. See ${T3_LOG}." >&2
exit 1
