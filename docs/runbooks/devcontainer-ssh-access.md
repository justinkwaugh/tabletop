---
kind: runbook
status: current
applies_to:
    - .devcontainer
last_reviewed: 2026-08-30
---

# Devcontainer SSH Access

The workspace container accepts SSH connections from the host Mac on `127.0.0.1:2224`. Docker does
not publish this port on the LAN. Authentication is public-key only, root login is disabled, and
the only permitted login account is the container's existing `node` user.

Docker retains container-specific Codex state, root Node dependencies, and SSH host keys in named
volumes managed by Docker Desktop. The Codex mount does not expose the Mac's `~/.codex`, and the
dependency mount masks any root `node_modules` directory in the macOS workspace bind mount.

The ChatGPT macOS app discovers concrete hosts from `~/.ssh/config`. It uses SSH to start the remote
Codex app server, so both `ssh tabletop-devcontainer` and `codex login status` must work inside the
container before adding the project in ChatGPT.

## Create The Dedicated Key

Run these commands in a macOS terminal from the host-side repository checkout, not inside the
devcontainer.

Check whether the dedicated key already exists:

```bash
ls -l "$HOME/.ssh/tabletop-devcontainer" "$HOME/.ssh/tabletop-devcontainer.pub"
```

If neither file exists, create an Ed25519 key and load it into the macOS Keychain:

```bash
ssh-keygen -t ed25519 -a 64 \
  -f "$HOME/.ssh/tabletop-devcontainer" \
  -C "$USER@tabletop-devcontainer"
ssh-add --apple-use-keychain "$HOME/.ssh/tabletop-devcontainer"
```

Do not overwrite an existing key unless you intend to rotate it. Copy only the public key into the
ignored local authorization file:

```bash
mkdir -p .devcontainer/ssh
install -m 600 \
  "$HOME/.ssh/tabletop-devcontainer.pub" \
  .devcontainer/ssh/authorized_keys.local
ssh-keygen -lf "$HOME/.ssh/tabletop-devcontainer.pub"
ssh-keygen -lf .devcontainer/ssh/authorized_keys.local
git check-ignore .devcontainer/ssh/authorized_keys.local
```

The fingerprints must match. `authorized_keys.local` must contain exactly one Ed25519 public key.
Never copy the private key into the repository or container.

## Configure The Mac SSH Client

Add this concrete host entry to `~/.ssh/config`:

```sshconfig
Host tabletop-devcontainer
  HostName 127.0.0.1
  Port 2224
  User node
  IdentityFile ~/.ssh/tabletop-devcontainer
  IdentitiesOnly yes
  AddKeysToAgent yes
  UseKeychain yes
  StrictHostKeyChecking accept-new
  HostKeyAlias tabletop-devcontainer
```

Preserve any existing entries, then enforce the expected permissions and confirm OpenSSH resolves
the alias:

```bash
chmod 700 "$HOME/.ssh"
chmod 600 "$HOME/.ssh/config"
ssh -G tabletop-devcontainer | grep -E '^(hostname|port|user|identityfile) '
```

## Rebuild And Connect

In VS Code, run **Dev Containers: Rebuild and Reopen in Container**. The rebuild installs Codex and
the SSH server; the startup hook installs the local public key and applies the hardened SSH policy.

Connect from a macOS terminal and verify the remote environment:

```bash
ssh tabletop-devcontainer
ssh tabletop-devcontainer \
  'id -un && test -d /workspace && command -v pnpm && command -v codex && codex --version && codex login status'
```

If Codex is not authenticated, use its device flow once:

```bash
ssh -t tabletop-devcontainer 'codex login --device-auth'
```

The `codex-home` volume retains authentication, configuration, sessions, and other Codex state
across ordinary container rebuilds.

## Add The Project In ChatGPT

In the ChatGPT macOS app:

1. Open **Settings > Connections**.
2. Add or enable the discovered `tabletop-devcontainer` SSH host.
3. Select `/workspace` as the remote project folder.

ChatGPT then starts the remote Codex app server and runs its shell commands inside the devcontainer.

## Security And Recovery

- Docker binds SSH only to `127.0.0.1`; do not change it to `0.0.0.0` for this workflow.
- The container rejects passwords, keyboard-interactive authentication, root login, and users other
  than `node`.
- `docker compose down -v` deletes the named volumes. Export important Codex state before deleting
  or pruning them.
- If the SSH host-key volume is deleted, run `ssh-keygen -R tabletop-devcontainer`, rebuild, and
  reconnect.
- If port 2224 is occupied, identify the listener with
  `lsof -nP -iTCP:2224 -sTCP:LISTEN` and stop or reconfigure it.
