#!/usr/bin/env bash

set -euo pipefail

readonly AUTHORIZED_KEY_SOURCE="/workspace/.devcontainer/ssh/authorized_keys.local"
readonly AUTHORIZED_KEYS_FILE="${HOME}/.ssh/authorized_keys.tabletop-devcontainer"
readonly SSHD_STATE_DIR="/var/lib/tabletop-sshd"
readonly SSHD_HOST_KEY="${SSHD_STATE_DIR}/ssh_host_ed25519_key"
readonly SSHD_CONFIG_DROP_IN="/etc/ssh/sshd_config.d/99-tabletop-devcontainer.conf"
readonly SSH_SESSION_PATH="/home/node/.codex/bin:/home/node/.local/bin:/usr/local/share/npm-global/bin:/usr/local/share/nvm/current/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/games:/usr/games"

sudo service ssh stop

managed_public_key=""
key_validation_error=""
if [ -f "${AUTHORIZED_KEY_SOURCE}" ]; then
    mapfile -t configured_keys < <(sed '/^[[:space:]]*#/d; /^[[:space:]]*$/d' "${AUTHORIZED_KEY_SOURCE}")
    if [ "${#configured_keys[@]}" -ne 1 ] || [[ ! "${configured_keys[0]}" =~ ^ssh-ed25519[[:space:]] ]]; then
        key_validation_error="${AUTHORIZED_KEY_SOURCE} must contain exactly one Ed25519 public key."
    else
        managed_public_key="${configured_keys[0]}"
    fi
else
    echo "Managed ChatGPT SSH access is disabled until ${AUTHORIZED_KEY_SOURCE} is created." >&2
    echo "Follow docs/runbooks/devcontainer-ssh-access.md from the host Mac, then restart the container." >&2
fi

install -d -m 700 "${HOME}/.ssh"
authorized_keys_candidate="$(mktemp "${HOME}/.ssh/authorized_keys.tabletop-devcontainer.XXXXXX")"
trap 'rm -f "${authorized_keys_candidate}"' EXIT
if [ -n "${managed_public_key}" ]; then
    printf '%s\n' "${managed_public_key}" > "${authorized_keys_candidate}"
    if ! ssh-keygen -l -f "${authorized_keys_candidate}" >/dev/null 2>&1; then
        key_validation_error="${AUTHORIZED_KEY_SOURCE} does not contain a valid Ed25519 public key."
        : > "${authorized_keys_candidate}"
    fi
fi
chmod 600 "${authorized_keys_candidate}"
mv "${authorized_keys_candidate}" "${AUTHORIZED_KEYS_FILE}"
trap - EXIT

sudo install -d -m 700 -o root -g root "${SSHD_STATE_DIR}"
if ! sudo test -f "${SSHD_HOST_KEY}"; then
    sudo ssh-keygen -q -t ed25519 -N '' -f "${SSHD_HOST_KEY}"
fi
sudo chown root:root "${SSHD_HOST_KEY}" "${SSHD_HOST_KEY}.pub"
sudo chmod 600 "${SSHD_HOST_KEY}"
sudo chmod 644 "${SSHD_HOST_KEY}.pub"
sudo install -d -m 755 -o root -g root /run/sshd

sudo tee "${SSHD_CONFIG_DROP_IN}" >/dev/null <<EOF
Port 2222
HostKey ${SSHD_HOST_KEY}
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys .ssh/authorized_keys.tabletop-devcontainer
AuthenticationMethods publickey
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
AllowUsers node
SetEnv PATH=${SSH_SESSION_PATH}
EOF
sudo chmod 644 "${SSHD_CONFIG_DROP_IN}"
sudo sshd -t
sudo service ssh start

if [ -n "${key_validation_error}" ]; then
    echo "${key_validation_error}" >&2
    exit 1
fi
