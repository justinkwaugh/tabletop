# T3 Code in the devcontainer

The image installs T3 with pnpm. `T3_VERSION` in `.devcontainer/Dockerfile`
pins the version; update it and rebuild to upgrade. `post-start.sh` starts
`t3 serve /workspace` as the `node` user, listening on loopback port 3773.
Repeated startup calls leave the running server alone.

T3 runs its agents inside the container, so sign in to Claude Code (`claude`)
or Codex (`codex login --device-auth`) there first.

The T3 Code desktop app connects over SSH, using the `tabletop-devcontainer`
host set up in [Devcontainer SSH Access](devcontainer-ssh-access.md).

T3 Connect provides mobile access through T3's relay, without publishing a
Docker port.

On a fresh installation, link the environment from a terminal in the container:

```bash
t3 connect link --headless --base-dir "$HOME/.t3"
```

`--headless` uses the device flow: open the printed URL on your own computer and
finish sign-in. Decline the systemd service if asked; `post-start.sh` already
starts the server. Restart the container after linking so the server picks up
the connection, then confirm it:

```bash
t3 connect status --base-dir "$HOME/.t3"
```

Sign into the same account in the mobile app.

The `t3-home` volume retains `/home/node/.t3`, including Connect credentials,
threads, settings, and worktrees, across rebuilds. Do not remove that volume
when cleaning up Docker resources. Logs are in `~/.t3/devcontainer.log` and can
contain pairing credentials; do not share the log without reviewing it.

For the first migration from an existing container, startup restores
`~/.codex/t3-devcontainer-seed` if the new T3 volume has no `userdata` directory.
The seed is a local snapshot in the existing persistent Codex volume, never a
repository file. Later starts use the T3 volume and do not restore the snapshot.
Remove the seed after confirming the rebuilt container has your environment
and threads. Work performed after the snapshot is not included in it.

The host must stay awake and the container must stay running. The existing
`shutdownAction: stopCompose` setting still stops the container when its VS Code
window closes. This setup starts T3 on devcontainer startup; it does not restart
T3 automatically if the process crashes.
