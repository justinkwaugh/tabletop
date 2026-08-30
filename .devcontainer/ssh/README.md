# Local SSH Public Key

Create `authorized_keys.local` in this directory by following
[the devcontainer SSH runbook](../../docs/runbooks/devcontainer-ssh-access.md).

The file is ignored by Git and must contain exactly one Ed25519 public key. Never put a private SSH
key in this directory or anywhere else in the repository.
