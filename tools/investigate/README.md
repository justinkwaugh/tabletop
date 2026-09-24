# Production investigation (read-only)

`tools/investigate` reads production without being able to change it: Cloud Run logs and
revisions, Cloud Tasks queues and pending tasks, and Firestore documents. It authenticates with
its own service account key, which holds viewer roles only, so a mistake in a query cannot
become a write. The agent-facing procedure lives in `.agents/skills/prod-investigation/SKILL.md`.

Run it from the repository root:

```bash
node tools/investigate/src/cli.mjs --help
node tools/investigate/src/cli.mjs check
```

## Configuration

Project, region and Cloud Run service names come from `tools/deploy/deploy.config.json`
(`backend.project`, `backend.region`, `backend.service`, `backend.tasksService`). The key file
path is `investigateCredentialFile` in that file, defaulting to
`.secrets/gcloud-investigate-key.json`. Environment overrides: `GCLOUD_PROJECT`,
`TABLETOP_BACKEND_REGION`, `TABLETOP_BACKEND_SERVICE`, `TABLETOP_TASKS_SERVICE` and
`TABLETOP_INVESTIGATE_CREDENTIAL_FILE`, the first four matching `tools/deploy`.

## Create the service account (once, from a host shell logged in as yourself)

```bash
PROJECT=your-gcp-project
SA_NAME=tabletop-investigate
SA=$SA_NAME@$PROJECT.iam.gserviceaccount.com
gcloud iam service-accounts create $SA_NAME --project=$PROJECT --display-name="Tabletop read-only investigation"
for ROLE in roles/logging.viewer roles/run.viewer roles/cloudtasks.viewer roles/datastore.viewer; do
  gcloud projects add-iam-policy-binding $PROJECT --member=serviceAccount:$SA --role=$ROLE --condition=None
done
mkdir -p .secrets && gcloud iam service-accounts keys create .secrets/gcloud-investigate-key.json --iam-account=$SA
chmod 600 .secrets/gcloud-investigate-key.json
```

`.secrets/` is gitignored and visible inside the devcontainer at `/workspace/.secrets/`. Then
`node tools/investigate/src/cli.mjs check` reports each capability as `ok` or names the missing
role. Rotate or revoke the key with `gcloud iam service-accounts keys list|delete`.

Every role is a viewer role. `roles/datastore.viewer` reads Firestore; it cannot write, and the
CLI issues no writes either.

## Commands

| Command                                                                                                                                                          | Reads                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check`                                                                                                                                                          | Credentials, project, and one probe per capability                                                                                                                                                |
| `logs [--service backend\|tasks\|all] [--since 1h] [--until t] [--severity ERROR] [--grep text] [--request reqId] [--filter raw] [--any-resource] [--limit 100]` | Cloud Logging entries, oldest first. `--filter` appends a raw Logging filter; `--any-resource` drops the Cloud Run scoping so the raw filter can target any resource                              |
| `services`                                                                                                                                                       | Cloud Run services with serving revisions and traffic split                                                                                                                                       |
| `revisions <service> [--limit 10]`                                                                                                                               | Revision history of one service, newest first                                                                                                                                                     |
| `tasks [--queue name] [--limit 50]`                                                                                                                              | Queues, or the still-pending tasks in one queue with decoded bodies; `stuck` marks a task more than five minutes past its schedule; `moreRemain` is true when the queue holds more than `--limit` |
| `collections [docPath]`                                                                                                                                          | Root collections, or the subcollections under a document                                                                                                                                          |
| `doc <path>`                                                                                                                                                     | One Firestore document, secrets masked                                                                                                                                                            |
| `list <collection> [--group] [--where f,op,v]... [--order f[:desc]] [--limit 20] [--select a,b] [--count]`                                                       | A collection query; `--group` spans every subcollection with that name; `--count` returns the aggregate count instead of documents                                                                |
| `find-user <username\|email\|id>`                                                                                                                                | The user record plus their push topic and subscriptions                                                                                                                                           |
| `game <gameId> [--actions 10]`                                                                                                                                   | The game record, its state summary and the latest actions                                                                                                                                         |

Every command accepts `--json` for machine-readable output. Times accept `30m`, `2h`, `3d`, or
an ISO timestamp. Output masks fields such as `auth`, `p256dh`, `keys`, `passwordHash` and
`token`, and converts Firestore timestamps to ISO strings. Documents in `tokens` are keyed by the token
value, so their IDs are masked too. `check` fails when the key file is the deploy key.
