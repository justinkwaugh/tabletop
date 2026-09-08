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

## Production follow-up, 2026-09-07

The supplied captures from revision `backend-00517-tvw` confirm overlapping initial reads and one Game/State batch followed by a chunk batch. Compared with the four previous captures from `backend-00516-4gt`:

| Fresh Fish request | Previous mean | New mean | Samples, previous/new |
| --- | ---: | ---: | ---: |
| Undo | 385 ms | 302 ms | 2 / 3 |
| PlaceDisk | 396 ms | 365 ms | 2 / 2 |

Undo's mean guarded load fell from 165 to 122 ms and its transaction callback from 103 to 71 ms. PlaceDisk still varied: one request had an 80 ms chunk read, another a 131 ms State read. Projection also became faster between captures, which the database batching change does not explain. These small samples establish that the intended read sequence is deployed, but do not isolate an exact overall speedup attributable to batching.

All six new requests completed in one transaction attempt, with no reported cache conflicts or consistency fallbacks. This counter covers application transaction callbacks; it does not count retries internal to an individual SDK RPC.

### What the slow intervals include

In the installed Firestore SDK (7.11.6), document converters execute when `.data()` is called. Our chunk reader calls `.data()` after the awaited `readAll` completes. Thus the slow `firestore.getAll` spans include SDK/network work and receiving documents, but exclude our chunk JSON parsing.

The SDK's `runTransactionOnce` awaits the application callback, then awaits commit. In the supplied Löwenherz `negotiationMove` capture, the transaction took 355 ms: 0.76 ms before the callback, 140 ms in the callback, and 214 ms after it. The callback included a 37 ms Game/State batch and a 92 ms chunk batch. For the five Fresh Fish captures, the corresponding post-callback interval ranged from 49 to 81 ms. This identifies the commit path as the large remaining interval without separating its client, network, and server costs.

### Local payload experiment

An offline profile used the real storage converters, Firestore WriteBatch preparation, and protobuf encoding with the checked-in legacy rehearsal exports. It measured 150 iterations after 30 warmup iterations on Node 24.19.0. No database requests were made. The largest available chunk from each export was paired with its final State; these are representative fixtures, not the documents from the production captures.

| Measurement | Fresh Fish | Sol |
| --- | ---: | ---: |
| Actions in measured chunk | 183 | 200 |
| Chunk JSON bytes | 153,031 | 229,898 |
| State JSON bytes | 11,922 | 22,839 |
| Encoded chunk + State commit bytes, excluding Game update | 170,144 | 258,326 |
| Chunk JSON decode median / p95 | 0.44 / 0.61 ms | 0.69 / 0.91 ms |
| Prepare both writes median / p95 | 1.24 / 1.58 ms | 2.01 / 2.98 ms |
| Encode commit protobuf median / p95 | 0.15 / 0.32 ms | 0.23 / 0.40 ms |

This weakens the serialization-CPU hypothesis for these fixtures. It does not measure production payload size, Cloud Run CPU contention, network transfer, or database processing. Each action still reads and rewrites its affected chunk, so payload growth remains worth measuring before considering a chunk-size or storage-format change.

### Indexing and next measurement

The operator confirmed that Ascending and Descending indexing are disabled for `actionChunks/actionsData` and `states/*`. The two large serialized fields therefore already have the expected automatic-index exemptions. Preserve `actionChunks.actionIds` array indexing: Undo uses it to locate the target chunk. Large JSON strings are single fields, not automatically indexed JSON trees; indexed values are also truncated at 1,500 bytes. A large JSON payload alone is not evidence of proportionally large index fanout. See [Firestore index limits](https://firebase.google.com/docs/firestore/quotas#indexes).

Before changing the storage model, inspect `firestore.googleapis.com/api/request_latencies` in Cloud Monitoring for the database, filtered to `api_method = Commit` and successful responses, around the capture window (18:09–18:11 UTC). Compare the server latency distribution with the application post-callback intervals. Similar high server latency points toward database commit work; substantially lower server latency warrants client/network tracing. Do not subtract unrelated percentiles as if they represented the same request.

The per-database metric covers non-streaming RPCs and should not be assumed to expose the latency of streaming `BatchGetDocuments` chunk reads. Firestore's server metrics exclude the client/network round trip. If finer attribution is needed, the installed Node SDK supports OpenTelemetry tracing of transactions and commits, with optional gRPC instrumentation. No additional tracing integration or production configuration change was made in this investigation. See [Firestore metric definitions](https://docs.cloud.google.com/monitoring/api/metrics_gcp_d_h#firestore), [performance monitoring boundaries](https://docs.cloud.google.com/firestore/native/docs/understand-performance-monitoring), and [client-side tracing](https://docs.cloud.google.com/firestore/native/docs/client-side-traces).

## Projection optimization: compiled union checks

A CPU profile of a four-player Fresh Fish PlaceDisk response plus spectator/player notifications found repeated TypeBox schema validation during union matching. The state projector walks board cells and calls the interpreted `Value.Check` for each candidate branch. That call checks the schema as well as its value on every invocation.

Union matching now reuses compiled branch validators. A weak cache is keyed by both the reference-definition set and branch schema, so a shared reference can resolve differently in different schemas. Each value is still checked on every projection. Privacy policies, canonical/projected validation, all matching-branch comparisons, and both cascade replay proofs remain in place. No canonical or projected values are cached.

The local benchmark used one fixed generated four-player state, 10 warmup requests and 60 timed requests. Each request generated the acting player's response and five notification payloads, using the real backend representation functions with an in-memory notification sender. Median total time fell from 33.8 ms to 25.9 ms, about 23%. One instrumented request attributed approximately 14 ms to the 18 State projections before compilation and 3.5 ms afterward; these breakdown samples are illustrative, not independent production estimates. Response and notification payloads matched after excluding generated notification IDs and Action creation timestamps. Cloud Run improvement still needs measurement.

Regression coverage checks shared union references under different definition sets, changing values and viewer policies, and ambiguous matching branches. Existing privacy, replay, and hosted-representation tests continue to apply.

This change lives in the shared projector implementation bundled into each Game Runtime. Existing Logic/UI Artifacts retain their old projector. Republish a game's Logic and matching UI Artifacts to adopt the optimization; a backend-only or Site Frontend-only deployment does not update those bundled projectors. Response shapes, stored schemas, and host bridge contracts are unchanged, so existing artifacts remain compatible.
