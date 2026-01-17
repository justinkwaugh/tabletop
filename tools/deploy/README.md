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
build-ui <gameId>            Build a game UI bundle (rollup)
deploy-ui <gameId>           Deploy a game UI bundle to GCS
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
    "backendManifestUrl": "https://your-backend.example.com/manifest",
    "backend": {
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
- `TABLETOP_BACKEND_SERVICE`
- `TABLETOP_BACKEND_REGION`
- `GCLOUD_PROJECT`

## Deploy guardrail

Deploy commands are blocked unless `TABLETOP_DEPLOY_ENABLE=1` is set.

## Notes

- UI build logs write to `/tmp/<gameId>-ui-bundle.log`.
- Backend/frontend build logs write to `/tmp/backend-build.log` and `/tmp/frontend-build.log`.
- Deploy logs write to `/tmp/*-deploy.log`.
