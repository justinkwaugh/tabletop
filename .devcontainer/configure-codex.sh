#!/usr/bin/env bash

set -euo pipefail

sudo mkdir -p "${HOME}/.codex"
sudo chown "$(id -u):$(id -g)" "${HOME}/.codex"

cat <<'EOF' > "${HOME}/.codex/config.toml"
approval_policy = "never"
sandbox_mode = "danger-full-access"

[projects."/workspace"]
trust_level = "trusted"
EOF

if ! grep -q 'codex-managed-path' "${HOME}/.bashrc" 2>/dev/null; then
cat <<'EOF' >> "${HOME}/.bashrc"

# codex-managed-path
if [[ ":${PATH}:" != *":/usr/local/share/npm-global/bin:"* ]]; then
    export PATH="/usr/local/share/npm-global/bin:${PATH}"
fi
EOF
fi

if ! grep -q 'codex-managed-login-path' "${HOME}/.profile" 2>/dev/null; then
cat <<'EOF' >> "${HOME}/.profile"

# codex-managed-login-path
case ":${PATH}:" in
*":/usr/local/share/npm-global/bin:"*) ;;
*)
    export PATH="/usr/local/share/npm-global/bin:${PATH}"
    ;;
esac
EOF
fi
