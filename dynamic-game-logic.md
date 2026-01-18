# Dynamic Game Logic Plan

## Goals
- Serve `/manifest` from a shared backend service (not from `app.ts`).
- Cache the manifest in Redis and fall back to a mounted GCS file when missing.
- Keep an in-memory snapshot and notify listeners on version mismatches.
- Register games based on the manifest (eventually load logic from GCS bundles).
- Allow Fastify to restart itself via a mismatch listener (no Fastify knowledge inside the service).

## Key Decisions
- Any version mismatch triggers a restart.
- Backend should still have a baked-manifest fallback for local/dev.
- Manifest lives under a config directory in GCS (e.g., `/mnt/gcs/config/site-manifest.json`).
- Game bundles stored in GCS:
  - UI: `games/<gameId>/ui/<version>/`
  - Logic: `games/<gameId>/logic/<version>/`
  - Logic bundles are single-file ESM.
- Start with bundle hash checks in the manifest; signed manifest can come позже.

## Proposed Components

### LibraryService (backend)
Responsibilities:
- Load and cache the manifest.
- Keep an in-memory snapshot + hash.
- Emit mismatch events.
- Provide game definitions (initially local; later remote logic bundles).

API sketch:
- `getManifest({ force?: boolean }) -> SiteManifest`
- `refreshManifest() -> SiteManifest`
- `onManifestMismatch(handler) -> unsubscribe`
- `getTitles() -> GameDefinition[]` (until dynamic logic loading is ready)
- `getGameDefinition(gameId) -> GameDefinition`

Mismatch detection:
- Compare fetched manifest vs in-memory snapshot.
- Trigger mismatch for:
  - frontend version change
  - any game logic version change
  - UI version changes do not require restart

### Manifest loader utility
Used by LibraryService, not routes:
1) Redis cache (`site-manifest` key).
2) GCS mount file (default `/mnt/gcs/config/site-manifest.json`).
3) Baked manifest fallback (local/dev only; never in production).

Caching:
- Redis cached indefinitely by default.
- Allow TTL via env (optional).
- Invalidation will be triggered by the deploy tool via an admin endpoint (preferred for prod).

## Route Changes
- Move `/manifest` handler into a dedicated route file.
- Route calls `LibraryService.getManifest()` and attaches backend metadata.
- Route should be `no-store` regardless of manifest caching.

## Backend Integration
- `services` plugin constructs `LibraryService`, decorates fastify.
- `app.ts` registers a mismatch listener that calls `fastify.restart()`.
- `games` plugin uses `LibraryService.getTitles()` (replace `titles.ts`).

## Dynamic Logic Loading (future)
- Logic bundles must be self-contained ESM (no bare imports).
- LibraryService loads logic from:
  `/mnt/gcs/games/<gameId>/logic/<version>/index.js`
- Compute and verify a SHA-256 hash before import using the manifest-provided hash.
- Maintain a small in-memory module cache:
  - key: `gameId@version`
  - keep current + previous (or LRU) to avoid churn.

## Manifest Hash Fields (proposed)
- Use `logicHash` per game for backend verification.
- Defer `uiHash` and `frontend.hash` until a frontend integrity check is implemented.
- Hash values are prefixed with `base64:sha256:` to allow algorithm changes without schema changes.

Example:
```json
{
  "frontend": {
    "version": "2025.01.16-1"
  },
  "games": {
    "bridges": {
      "logicVersion": "1.4.2",
      "uiVersion": "1.4.2",
      "logicHash": "base64:sha256:..."
    }
  }
}
```

## Build/Bundle Changes (planned)
- Add a `bundle` script for each game logic package to emit the single-file ESM bundle.
- Deploy tool should run logic bundle builds (in addition to UI bundles) when logic versions change.

## Restart Strategy
- On mismatch event, fastify listener triggers `fastify.restart()`.
- Minimum restart interval: 30s (no backoff for now).

## Open Questions
- Should UI version changes also trigger restart?
- Logic bundle format: single file vs multi-chunk.
- Admin endpoint for cache invalidation: `POST /admin/manifest/invalidate` (200 OK; auth uses existing admin checks).
- When to add manifest signing (KMS/offline) and how to rotate keys.
