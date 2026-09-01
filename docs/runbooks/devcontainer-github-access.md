# Devcontainer GitHub Access

The devcontainer includes GitHub CLI and can use a Personal Access Token for both `gh` commands and HTTPS Git operations.

Create the local environment file before rebuilding the devcontainer:

```bash
cp .env.devcontainer.example .env.devcontainer
```

Set `GH_TOKEN` in `.env.devcontainer` to a GitHub Personal Access Token with access to the repositories and operations you need. Keep its permissions as narrow as practical. The local file is ignored by Git and must not be committed.

Rebuild the devcontainer after creating or changing the file. Docker Compose loads its variables into the container, and the startup configuration uses GitHub CLI as Git's HTTPS credential helper. GitHub SSH-form repository URLs are routed through HTTPS so the token is used without modifying each repository's configured remote.

Verify authentication inside the rebuilt container:

```bash
gh auth status
git ls-remote origin HEAD
```

`GH_TOKEN` remains in the container environment and is not copied into GitHub CLI's credential store.
