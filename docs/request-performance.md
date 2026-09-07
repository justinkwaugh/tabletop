# Action request performance

Action submission and Undo routes emit one structured `request_timing` log when the response finishes. The diagnostics are enabled by default; set `REQUEST_TIMINGS_ENABLED=false` on the backend to disable collection. Deploying the backend is sufficient. Response bodies, frontend artifacts, database reads, cache locking, and retry policies are unchanged.

In Cloud Logging, use:

```text
resource.type="cloud_run_revision"
resource.labels.service_name="backend"
jsonPayload.event="request_timing"
```

Add a route or latency filter when useful:

```text
jsonPayload.route="/api/v1/game/freshfish/action/placeDisk"
jsonPayload.durationMs>=300
```

The log includes `reqId`, route, method, response status, and elapsed application time in milliseconds. It records operation names and counters, never action payloads, game state, seeds, cache keys, or error messages. Cloud Run supplies revision and instance labels. When `GCLOUD_PROJECT` and a valid incoming trace context are available, the `logging.googleapis.com/trace` field correlates the diagnostic with the Cloud Run request log. Both W3C `traceparent` and `X-Cloud-Trace-Context` are accepted. See [Cloud Run log correlation](https://docs.cloud.google.com/run/docs/logging#correlate-logs).

## Reading a timing report

`durationMs` starts at the first application request hook and ends in the response hook, before writing the timing log. Compare it with Cloud Run's `httpRequest.latency`, then with the browser's Network duration. The intervals have different boundaries: Cloud Run also includes time before the application hook, and the browser includes connection, transfer, and client scheduling costs.

Each span has an `id`, optional `parentId`, operation `name`, `startMs`, `durationMs`, and `status`. Offsets share the request start time. Parent durations include children. Parallel operations overlap; do not sum all spans to estimate request duration. Gaps between children expose work not separately instrumented.

| Operation | What it measures |
| --- | --- |
| `manifest.refresh`, `manifest.get` | Request-time manifest refresh and response version lookup; refresh runs only outside local mode |
| `auth.user` | Session user lookup, including cache/database work |
| `game.applyActionToGame`, `game.undoAction` | Service execution; each action collision retry has its own attempt span |
| `store.*` | Game, state, action history, and persistence operations |
| `redis.pool.wait`, `redis.guardPool.wait` | Waiting for a pooled connection |
| `redis.get`, `redis.mGet`, `redis.watch`, `redis.exec`, `redis.unwatch`, etc. | Individual awaited Redis client calls; `exec` covers a transaction batch, not each queued command |
| `cache.*` | Cache lookup, write protection, release, fill, and consistent-read fallback |
| `firestore.document.get`, `firestore.user.get`, `firestore.getAll`, `firestore.query.get` | Awaited SDK reads, including SDK-internal work/retries |
| `firestore.transaction` | The entire Firestore transaction, including callback attempts, commit, and retry backoff |
| `firestore.transaction.body` | One callback attempt; time outside these children includes SDK commit/retry overhead, not a separately measured commit RPC |
| `engine.*` | Canonical execution, Undo patches, and canonical validation |
| `projection.response.*`, `projection.publish.*` | Response preparation and notification representation/delivery dispatch |
| `game.notifyGamePlayers`, `game.scheduleTurnNotification` | Player notification preparation, including awaited notification-marker writes |

Counters include cache hits/misses, consistency fallbacks, WATCH conflicts, write acquisition/release attempts, Firestore transaction attempts/retries, game action attempts, and processed Action counts. Write acquisition attempts can also increase when a transaction adds more cache keys; they are not themselves a retry count. Inspect failed acquisition spans and WATCH conflicts to identify retry work. Absent counters mean zero occurrences.

Background cache fills may overlap the request. Work still running at response completion is marked `pending`, with its duration clipped to that point; later work cannot modify the report. Remote notification/task delivery already dispatched without awaiting completion remains outside the measured request critical path. These diagnostics do not start awaiting that delivery.

A report retains at most 256 spans and includes `droppedSpans` if the limit is reached. Error responses are reported, and observed aborts/timeouts finalize the report once. There are no reporting timers, telemetry network requests, or new database reads. Async request context separates concurrent requests; operation wrappers preserve values and errors.

## First production comparison

Collect a few warm `placeDisk`, `drawTile`, and Undo requests on the same revision. Compare totals and the largest spans. Look for a slow individual read, many serial calls, a manifest refresh, pool wait, or transaction retries. Separate the first request on an instance from subsequent requests. Change the identified bottleneck only after measuring it; cache coherence does not need to be weakened to gather this evidence.

## Slice 1: overlap and batch database reads

The guarded load starts the Game lookup and State read together. The Game lookup still uses its existing cache. The revision guard covers both reads and any requested history; a concurrent write still discards that result and falls back once to a read-only Firestore transaction.

Action persistence, Undo persistence, and the read-only fallback fetch Game and State in one `getAll` batch. Action chunks remain a subsequent read because their references depend on the authoritative Game's stored chunk size. Validators still see transaction-current documents before writes, and cache protection and retry policies are unchanged.

For an existing Game, this reads the same documents. A missing Game now also incurs a State read because its absence is not known when the pair starts. No response or storage schema changes are involved; deploy only the backend.

After deployment, compare warm requests with the earlier revision. Inside `store.readGameData`, the Game lookup and State read should overlap. Inside `firestore.transaction.body`, the two initial `firestore.document.get` spans become one `firestore.getAll`; chunk reads remain separate. Compare load, transaction body, and total durations, keeping cache hits and transaction attempts comparable. Production savings still require measurement; local emulator timings do not estimate multi-region Firestore latency.
