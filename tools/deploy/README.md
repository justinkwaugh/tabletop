# Tabletop Deploy

Ink-based TUI and CLI for managing `site-manifest.json`, builds, and deploys.

## Install

From repo root (installs dependencies; build is still required to create the bin entrypoint):

```bash
npm install
```

## Quick start

```bash
npm run build --workspace @tabletop/deploy
npm exec --workspace @tabletop/deploy -- tabletop-deploy tui
```

Or run the compiled file directly:

```bash
node tools/deploy/esm/cli.js tui
```

Or use the root script:

```bash
npm run deploy:tui
```
Note: the root script runs the compiled file; run `npm run build --workspace @tabletop/deploy` first if needed.

## Commands

```text
tui                          Launch the TUI (default)
status                       Print the current manifest
sync-manifest                Sync site-manifest.json from package versions
build-ui <gameId>            Build a game UI bundle (rollup)
deploy-ui <gameId>           Build + bundle a game UI and deploy to GCS
build-logic <gameId>         Build a game logic bundle (rollup)
deploy-logic <gameId>        Build + bundle game logic and deploy to GCS
build-frontend               Build the frontend
deploy-frontend              Deploy the frontend bundle to GCS
build-backend                Build the backend
deploy-backend               Deploy the backend (Cloud Run)
rollback-backend <revision>  Shift traffic to a backend revision
```

## Configuration

Create `tools/deploy/deploy.config.json` (see `tools/deploy/deploy.config.example.json`).

```json
{
    "gcsBucket": "your-gcs-bucket",
    "backendManifestUrl": "https://your-backend.example.com/api/v1/manifest",
    "backendAdmin": {
        "url": "https://your-backend.example.com/api/v1/admin/manifest/invalidate",
        "username": "admin",
        "password": "your-password"
    },
    "backend": {
        "image": "us-central1-docker.pkg.dev/your-project/your-repo/backend",
        "service": "your-cloud-run-service",
        "region": "us-central1",
        "project": "your-gcp-project",
        "deployCommand": []
    }
}
```

Environment overrides:

- `TABLETOP_GCS_BUCKET`
- `TABLETOP_BACKEND_MANIFEST_URL` (or `TABLETOP_MANIFEST_URL`)
- `TABLETOP_BACKEND_ADMIN_URL`
- `TABLETOP_BACKEND_ADMIN_USER`
- `TABLETOP_BACKEND_ADMIN_PASSWORD`
- `TABLETOP_BACKEND_ADMIN_TOKEN`
- `TABLETOP_BACKEND_ADMIN_COOKIE`
- `TABLETOP_BACKEND_IMAGE`
- `TABLETOP_BACKEND_SERVICE`
- `TABLETOP_BACKEND_REGION`
- `GCLOUD_PROJECT`

Notes:
- `backend.image` is required for backend deploy in the TUI; it is used for the docker build/tag/push flow.
- `backendAdmin` is required to invalidate the manifest cache after deploys; provide a cookie, token, or username/password.

## Notes

- UI build logs write to `/tmp/<gameId>-ui-bundle.log`.
- Logic build logs write to `/tmp/<gameId>-logic-bundle.log`.
- Backend/frontend build logs write to `/tmp/backend-build.log` and `/tmp/frontend-build.log`.
- Deploy logs write to `/tmp/*-deploy.log`.
- Package versions are the source of truth; the manifest is synced from package.json.
