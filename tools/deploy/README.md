# Tabletop Deploy

Command-line tool for releasing and deploying games, the site frontend, and the backend. It
owns the site manifest in the bucket, which is the only record of what production serves; the
repository keeps a game catalogue (`config/config-games/src/games.json`) and package versions.
See `docs/adr/0006-site-manifest-lives-in-the-bucket.md`.

## Install and build

```bash
pnpm install
pnpm --filter @tabletop/deploy run build
node tools/deploy/esm/cli.js --help
```

The root `pnpm run deploy -- <command>` runs the compiled file.

## Releasing and deploying a game

Publishing is split into a release, which changes versions in git, and a deploy, which builds
and uploads whatever HEAD is. Both run non-interactively and exit non-zero on the first failure,
printing each step's log path.

```bash
node tools/deploy/esm/cli.js release-game --game=<gameId|packageId> [--logic] (--major | --minor | --patch) [--no-deploy]
node tools/deploy/esm/cli.js deploy-game --game=<gameId|packageId> [--logic]
```

`release-game`:

1. refuses to run on a dirty working tree or a detached HEAD;
2. bumps the UI package version, and the logic package version too with `--logic`;
3. commits those files, tags the commit per artifact, and pushes the branch and tags to `origin`;
4. runs `deploy-game` for the same artifacts unless `--no-deploy` is given.

Release tags are `<packageId>-v<version>` for logic and `<packageId>-ui-v<version>` for UI, for
example `the-old-prince-v0.12.0` and `the-old-prince-ui-v0.59.0`.

`deploy-game` checks, before building anything, that the working tree is clean and that HEAD
carries the release tag for every artifact being published. An artifact whose version directory
already exists in the bucket is reused rather than rebuilt, so a failed deploy can be rerun. It
then builds and bundles, uploads the artifacts, and publishes the manifest: it reads the bucket
manifest, copies it to `config/manifest-backups/site-manifest.<timestamp>.<operation>.json`,
uploads the changed copy with only this game's versions updated, and invalidates the backend
manifest cache. `deploy-ui` and `deploy-logic` apply the same flow for a single artifact.

Building locally is not gated: `build-ui` and `build-logic` work on any tree.

The frontend follows the same model with `release-frontend (--major | --minor | --patch)
[--no-deploy]` and `deploy-frontend`. There is no `--logic` flag; the release bumps
`apps/frontend/package.json`, tags `frontend-v<version>`, and the deploy uploads the build to
`frontend/<version>` in the bucket before publishing the manifest.

The backend follows the same model with `release-backend (--major | --minor | --patch)
[--no-deploy] [--no-traffic] [--service=backend|tasks]` and `deploy-backend`. The release bumps
`apps/backend/package.json` and tags `backend-v<version>`. The deploy builds the backend,
produces the pruned image context with `pnpm --filter @tabletop/backend run docker-context`,
submits it to Cloud Build tagged `<backend.image>:<version>`, and deploys that image to the
`tasks` and then the `backend` Cloud Run services, in that order because backend depends on
tasks, with traffic as revisions named `<service>-v<version>`
with dots replaced by dashes, setting `BACKEND_VERSION`, `GIT_SHA`, and `BUILD_TIME` so the
manifest reports what is running. A rerun that finds the revision already present reuses it. `--no-traffic` stages a revision
without serving it, `promote-backend` shifts both services to their latest revision, tasks first, and
`rollback-backend` restores the earlier ready revision of both services;
`rollback-backend <revision> --service=backend|tasks` selects a particular service revision. No Docker is needed
locally. The image tag is immutable: a version already in Artifact Registry is refused.

### History, rollback, and switch

Every manifest change appends to a publication history: per game a list of logic and UI
version pairs, for the frontend a list of versions, newest first with the deploy time, commit,
and tags. Only the five most recent are kept, which is also how far `rollback` can reach; the
artifacts themselves stay in the bucket. A manifest written before history existed is seeded
with its current publication.

```bash
node tools/deploy/esm/cli.js list (--game=<id> | --frontend | --backend)
node tools/deploy/esm/cli.js rollback (--game=<id> | --frontend | --backend)
node tools/deploy/esm/cli.js switch --game=<id> --ui-version=<v> [--logic-version=<v>]
node tools/deploy/esm/cli.js switch --frontend --version=<v>
node tools/deploy/esm/cli.js switch --backend --version=<v> [--service=backend|tasks]
```

`rollback` selects the publication that served before the current one. `switch` selects
specific versions; logic can only be selected together with the UI that embeds it. Both verify
the artifacts still exist in the bucket, back up and rewrite the manifest, invalidate the cache,
and report the serving versions before and after like a deploy. Selecting older logic prints a
caution, because games whose state was written by newer logic need explicit reverse
compatibility. A UI's `catalog.json` identifies its embedded logic through
`metadata.version`. Multiple UI-only releases can pair with the same logic version;
the UI published with the following logic version cannot. Both game switch and
rollback validate this metadata before writing the manifest. Missing metadata or
an incompatible pair leaves the publication unchanged, even if both bundles exist.

Backend history comes from Cloud Run. `list --backend` marks revisions receiving
traffic and shows readiness; `switch --backend --version=1.5.1` switches both services
to their existing `v1-5-1` revisions. Use `--service=tasks` or `--service=backend` to
narrow any backend history operation. `rollback --backend` (also `rollback-backend`)
selects the most recently created ready revision older than the currently serving
revision; newer staged revisions are not rollback targets. Cloud Run revision
history does not prove that an older staged revision previously served traffic.
Use an explicit version or revision when that distinction matters. Automatic
rollback rejects split traffic or differing release histories across selected services;
choose a version or one service explicitly in those cases. Every service's target is checked before any
traffic changes, then each change is verified against Cloud Run traffic status.
Switching is not atomic across services; an error after the first switch is a
partial operation and requires inspecting the reported traffic state.

Backend deployments configure HTTP startup, readiness and liveness probes on
port 8081 at `/__health/ready`, separately from the HTTP/2 ingress. The endpoint
requires the public listener and an answering child. Session affinity is disabled
because it bypasses failed readiness checks. Startup allows 240 seconds, readiness
fails after one unsuccessful two-second check, and liveness allows roughly two
minutes for child recovery. The public `/__health/ready` endpoint also exposes the
child check for direct revision verification. These checks require the supervised
backend image; selecting an existing older revision retains that revision's own
probe settings.

`preflight (--game=<gameId|packageId> | --frontend | --backend) [--json]` is read-only. It reports the serving versions
from the backend manifest, the local versions, the release baseline per artifact (the release
tag, or the commit that set the current version when no tag exists yet), the files and commits
changed since that baseline, and whether logic and UI or only UI need a release. Changes are
counted in the package and its workspace dependencies except the platform packages every game
shares (`@tabletop/common`, `@tabletop/frontend-components`), so a family library such as
`libs/18xx` counts as part of an 18xx title's logic while a platform fix does not. Agents use it to decide `--logic` and to report the
serving state before and after a deploy; see `.agents/skills/release/SKILL.md`.

## Commands

```text
status                       Print the manifest the bucket currently serves
list (--game=<id> | --frontend | --backend)
                             Print the publication history, newest first
rollback (--game=<id> | --frontend | --backend)
                             Select the publication that served before the current one
switch --game=<id> --ui-version=<v> [--logic-version=<v>] | --frontend --version=<v>
                             Select specific published versions
preflight (--game=<id> | --frontend | --backend) [--json]
                             Report serving/local versions and changes since the last release
release-game --game=<id> [--logic] (--major | --minor | --patch) [--no-deploy]
                             Bump versions, commit, tag, push, then deploy
deploy-game --game=<id> [--logic]
                             Build and deploy a tagged HEAD, publish the manifest, invalidate cache
build-ui <gameId>            Build a game UI bundle (rollup)
deploy-ui <gameId>           deploy-game for the UI only, with the same guards
build-logic <gameId>         Build a game logic bundle (rollup)
deploy-logic <gameId>        Build + bundle game logic and deploy to GCS, with the same guards
release-frontend (--major | --minor | --patch) [--no-deploy]
                             Bump the frontend version, commit, tag, push, then deploy
build-frontend               Build the frontend
deploy-frontend              Build and deploy a tagged frontend HEAD, with the same guards
release-backend (--major | --minor | --patch) [--no-deploy] [--no-traffic] [--service=backend|tasks]
                             Bump the backend version, commit, tag, push, then deploy
build-backend                Build the backend
deploy-backend [--no-traffic] [--service=backend|tasks]
                             Cloud Build the tagged image and deploy it to Cloud Run, with the same guards
promote-backend [--service=backend|tasks]
                             Shift traffic to the latest revision after a --no-traffic deploy
rollback-backend [revision] [--service=backend|tasks]  Restore an earlier ready revision
```

## Configuration

### Public game catalog

Every UI bundle build writes `bundle/catalog.json` from the built `UiDefinition.info`, retaining
only the title ID, metadata, and resolved cover URL. The build evaluates the UI entry in Node;
the entry must keep browser-dependent UI initialization inside its lazy `runtime()` loader.
Configuration and runtime code are not included in the JSON. The existing bundle upload and
local staging commands include this file automatically.

The public `/api/v1/catalog` endpoint reads the files selected by the current manifest at
`$STATIC_ROOT/games/<packageId>/ui/<uiVersion>/catalog.json`. Successful entries and complete
catalogs are cached in backend memory. Manifest changes select a new catalog, reusing unchanged
entries; this path makes no Firestore reads. Complete HTTP responses may be cached for 60 seconds.
Entries are checked against the shared catalog schema and expected game ID before caching.
Missing or invalid entries affect only that title, are retried on the next request, and prevent
HTTP caching of the partial result.

For the initial rollout:

1. Publish a new UI version containing `catalog.json` for every currently listed title, using
   the existing UI-only publication flow. Retain the selected logic versions.
2. Deploy the backend with `/api/v1/catalog` and verify that its response includes every
   manifest title with working cover URLs.
3. Deploy the Site Frontend. Anonymous pages use the catalog; game UI imports start after sign-in.

Older Site Frontends continue to use the unchanged UI entry points. The shared LibraryService
methods and UI host bridge remain compatible with existing UI Artifacts. Rolling a title back
to a UI version without `catalog.json` removes it from discovery until a catalog-bearing version
is selected. Do not roll out the new frontend before the initial catalog publication is complete.

Subsequent game publications update discovery through the normal manifest publication and cache
invalidation flow; no Site Frontend deployment is needed. Browser caching can delay visibility by
up to 60 seconds. For local artifacts already staged before this change, generate just the missing
JSON with `node config/config-rollup/write-game-catalog.mjs <staged-ui-version-directory>`.

### Deployment settings

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
        "tasksService": "your-cloud-run-tasks-service",
        "region": "us-central1",
        "project": "your-gcp-project",
        "deployCommand": []
    }
}
```

`gcloudCredentialFile` points at a service account key, relative to the repository root. When
set, every `gcloud` call the tool makes uses that key instead of a user login, through the Cloud
SDK's credential file override. Keep the key under `.secrets/`, which is gitignored and visible
inside the devcontainer at `/workspace/.secrets/`. The account only needs object admin on the
bucket. From a host shell logged in to gcloud as yourself:

```bash
PROJECT=your-gcp-project
BUCKET=your-gcs-bucket
SA=tabletop-deploy@$PROJECT.iam.gserviceaccount.com
gcloud iam service-accounts create tabletop-deploy --project=$PROJECT --display-name="Tabletop deploy"
gcloud storage buckets add-iam-policy-binding gs://$BUCKET --member=serviceAccount:$SA --role=roles/storage.objectAdmin
mkdir -p .secrets && gcloud iam service-accounts keys create .secrets/gcloud-deploy-key.json --iam-account=$SA
chmod 600 .secrets/gcloud-deploy-key.json
```

For backend deploys the same account also needs, once:

```bash
REGION=us-central1
RUNTIME_SA=$(gcloud run services describe backend --project=$PROJECT --region=$REGION --format='value(spec.template.spec.serviceAccountName)')
RUNTIME_SA=${RUNTIME_SA:-$(gcloud projects describe $PROJECT --format='value(projectNumber)')-compute@developer.gserviceaccount.com}
gcloud projects add-iam-policy-binding $PROJECT --member=serviceAccount:$SA --role=roles/cloudbuild.builds.editor
gcloud projects add-iam-policy-binding $PROJECT --member=serviceAccount:$SA --role=roles/serviceusage.serviceUsageConsumer
gcloud projects add-iam-policy-binding $PROJECT --member=serviceAccount:$SA --role=roles/run.admin
gcloud artifacts repositories add-iam-policy-binding images --project=$PROJECT --location=$REGION --member=serviceAccount:$SA --role=roles/artifactregistry.writer
gcloud storage buckets add-iam-policy-binding gs://${PROJECT}_cloudbuild --member=serviceAccount:$SA --role=roles/storage.admin
gcloud iam service-accounts add-iam-policy-binding $RUNTIME_SA --project=$PROJECT --member=serviceAccount:$SA --role=roles/iam.serviceAccountUser
```

`roles/run.admin` is granted project-wide because Cloud Run service-level bindings do not cover
creating revisions. The Cloud Build staging bucket `<project>_cloudbuild` is created by the first
build; if the binding fails because it does not exist yet, run one build as yourself first or
create the bucket. Storage admin on that one bucket is needed rather than object admin because
`gcloud builds submit` reads the bucket's metadata, and the build logs are written there too so
they stream without the account being a project viewer. Verify with `node tools/deploy/esm/cli.js preflight --backend`, which reads
the serving revision, and with `gcloud builds list --project=$PROJECT --limit=1`.

`investigateCredentialFile` is read only by `tools/investigate` (see its README) and names the
separate viewer-only key used for production investigation.

Verify from inside the container with `gcloud storage ls gs://$BUCKET/config/` after setting
`CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE=/workspace/.secrets/gcloud-deploy-key.json`, or simply
run `node tools/deploy/esm/cli.js preflight --game=<gameId>`.

Environment overrides:

- `TABLETOP_GCS_BUCKET`
- `TABLETOP_GCLOUD_CREDENTIAL_FILE`
- `TABLETOP_BACKEND_MANIFEST_URL` (or `TABLETOP_MANIFEST_URL`)
- `TABLETOP_BACKEND_ADMIN_URL`
- `TABLETOP_BACKEND_ADMIN_USER`
- `TABLETOP_BACKEND_ADMIN_PASSWORD`
- `TABLETOP_BACKEND_ADMIN_TOKEN`
- `TABLETOP_BACKEND_ADMIN_COOKIE`
- `TABLETOP_BACKEND_IMAGE`
- `TABLETOP_BACKEND_SERVICE`
- `TABLETOP_TASKS_SERVICE`
- `TABLETOP_BACKEND_REGION`
- `GCLOUD_PROJECT`
- `CLOUDSDK_PYTHON` (optional override for Cloud SDK Python runtime)
- `TABLETOP_GCS_ACCESS_TOKEN` (optional; used for directory-placeholder API calls)

Notes:

- `backend.image` is required for backend deploys; the release version becomes its tag.
- `backendAdmin` is required to invalidate the manifest cache after deploys; provide a cookie, token, or username/password.
- When `CLOUDSDK_PYTHON` is unset, deploy commands automatically pick the first supported local Python (`python3.12`, `python3.11`, `python3.10`, then `python3`) and use it for `gcloud`/`gsutil`.

## Notes

- UI build logs write to `/tmp/<gameId>-ui-build.log` and bundle logs to `/tmp/<gameId>-ui-bundle.log`.
- Logic build logs write to `/tmp/<gameId>-logic-build.log` and bundle logs to `/tmp/<gameId>-logic-bundle.log`.
- Backend/frontend build logs write to `/tmp/backend-build.log` and `/tmp/frontend-build.log`.
- Backend image logs write to `/tmp/backend-image-*.log`.
- Deploy logs write to `/tmp/*-deploy.log`.
- A frontend deploy publishes only the Site Frontend Artifact. Each game needs a separate UI-only Publication to adopt shared Game Client changes bundled into its UI Artifact; see the [Game UI Host Bridge Contract](../../docs/adr/0004-game-ui-host-bridge-contract.md).
- Package versions and release tags are the source of truth for what a checkout is; the bucket manifest is the source of truth for what production serves.
- GCS deploys create explicit placeholder objects for each destination directory path, including nested subdirectories under rsync sources (for non-HNS buckets / explicit-directory gcsfuse mounts).
- Placeholder creation uses a direct Cloud Storage API call and requests the current credential from `gcloud auth print-access-token` on every invocation unless `TABLETOP_GCS_ACCESS_TOKEN` is provided. The helper does not cache tokens across invocations, so `gcloud config configurations activate` takes effect on the next call. Explicit Cloud SDK environment overrides and `TABLETOP_GCS_ACCESS_TOKEN` still take precedence.
- Run credential-selection regression tests with `pnpm --filter @tabletop/deploy test`; these use fake credentials and do not contact Google Cloud.
