# Versioning Plan

## Goals
- Version each game independently.
- Treat game UI bundles and frontend builds as immutable assets.
- Keep deploys consistent between backend logic and frontend UI versions.
- Allow safe rollbacks by switching version pointers.

## Source of Truth
- The `config-games` project publishes a manifest describing:
  - `frontend` object with a `version` property
  - per-game `logicVersion` and `uiVersion`

Example manifest:
```json
{
  "frontend": { "version": "2025.01.16-1" },
  "games": {
    "bridges": { "logicVersion": "1.4.2", "uiVersion": "1.4.2" },
    "sol":     { "logicVersion": "2.0.0", "uiVersion": "2.0.1" }
  }
}
```

## Storage Layout (GCS)
- Frontend builds: `gs://<bucket>/frontend/<frontendVersion>/...`
- Game UI bundles: `gs://<bucket>/games/<gameId>/<uiVersion>/...`

## Mount Mapping (Backend)
- `gs://<bucket>/frontend/<frontendVersion>/` is mounted at `/`.
- `gs://<bucket>/games/<gameId>/<uiVersion>/` is mounted at `/games/<gameId>/<uiVersion>/`.
- This allows the frontend to use **relative URLs** like:
  - `/games/bridges/1.4.2/index.js`

## Backend Responsibilities
- Choose a `frontendVersion` at startup (from manifest or env override).
- Serve frontend assets from the mounted versioned directory at `/`:
  - `/index.html` should be `no-store` (or very short max-age).
  - `/assets/*` (hashed) should be `public,max-age=31536000,immutable`.
- Expose `/games/manifest` with the manifest used by the backend.
- Build with game logic packages pinned to the manifest’s `logicVersion`.

## Frontend Responsibilities
- Load `/games/manifest` on boot.
- For each game, construct the UI module URL as:
  - `/games/<gameId>/<uiVersion>/index.js`
- Use `base: '/'` in Vite so assets are relative to the mounted root.

## Deploy Flow
### Game update (logic and/or UI)
1. Bump `logicVersion` and/or `uiVersion` in `config-games`.
2. Build game UI and upload to `gs://.../games/<id>/<uiVersion>/`.
3. Build game logic package and deploy backend with updated manifest reference.
4. Frontend loads the new manifest and pulls the new UI bundle.

### Frontend update
1. Bump `frontend.version` in `config-games`.
2. Build frontend (`base: '/'`) and upload to `gs://.../frontend/<frontendVersion>/`.
3. Deploy/restart backend to mount the new frontend version at `/`.

## Rollback
- Update manifest (or env override) to a previous `frontend.version` or `uiVersion`.
- Restart backend to switch the mounted frontend version or served manifest.

## Notes on Separate Versions
- Separate `logicVersion` and `uiVersion` provides maximum flexibility.
- If desired, keep them in lockstep by default and only diverge when needed.
- **Rule:** If `logicVersion` changes, `uiVersion` must also be bumped and the UI must be rebuilt/deployed, because the UI bundle embeds game logic.

## Deploy Tool (Draft Spec)

### Goals
- Provide a single interface to view and update versions, publish manifests, and deploy assets.
- Enforce versioning rules (e.g., logic bump implies UI bump/deploy).
- Make rollbacks easy and safe.
- Prefer building the TUI with Ink (Node/TypeScript).

### Data Sources
- `config-games` manifest (read/write).
- Backend `/games/manifest` (reported deployed versions).
- Mounted GCS directories (`/games/*` and `/frontend/*`) for existence checks.

### Core Commands
- `status`: show manifest vs deployed versions (frontend + games).
- `edit`: bump versions (frontend, per-game logic/ui) with validation rules.
- `build:ui <gameId>`: build UI bundle.
- `deploy:ui <gameId>`: upload UI bundle to `/games/<gameId>/<uiVersion>/`.
- `build:backend`: build backend with pinned logic versions.
- `deploy:backend`: deploy backend and mount selected frontend version.
- `build:frontend`: build frontend (`base: '/'`).
- `deploy:frontend`: upload to `/frontend/<version>/`.
- `publish:manifest`: publish updated manifest.
- `rollback`: switch manifest or frontend mount to a previous version.

### TUI Layout
- Left pane: game list with logic/ui versions.
- Right pane: selected game details and actions.
- Top bar: manifest version + backend reported versions + mounted frontend version.
- Bottom bar: command palette (deploy/build/publish/rollback).

### Validation Rules
- Changing `logicVersion` requires a `uiVersion` bump.
- UI deploy must precede backend deploy for the same logic change.
- Refuse deploy if the versioned UI directory does not exist (or require build first).
