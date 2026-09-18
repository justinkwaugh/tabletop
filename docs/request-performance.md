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

## Fresh Fish game opening, 2026-09-18

A supplied `GET /api/v1/game/get/:gameId` capture from `backend-00524-jkh` took 2,663 ms: 308 ms loading Game data and 2,342 ms in `projection.response.game`. An earlier capture on the same revision spent only 3 ms projecting its response. The slow capture establishes server-side response preparation as the bottleneck for that request; the fast capture does not rule it out for other Games.

An offline reproduction used the supplied current State and 118 ordered Actions, restoring Action timestamps to Dates and substituting synthetic account metadata. The local CPU profile attributed roughly 80% of projection time to `canReplayCascade`. Its two replay proofs repeatedly execute Fresh Fish rules, including expropriation. The board search previously recomputed neighbors and looked up cells for every edge of every candidate's traversal.

Expropriation now builds indexed adjacency from the current board once per calculation, then counts reachable cells for each blocked candidate. Blocked candidates and hypothetical placements remain reachable endpoints but cannot be traversed through. Trucks and stalls retain the same endpoint behavior. The adjacency is discarded after the calculation so subsequent board changes are reflected. State projection, canonical validation, both replay proofs, Action patches, and visibility policies are unchanged.

Verification includes a deterministic lookup-budget regression (the old search made 71,581 cell lookups on a 100-cell empty board), board mutation and terminal-cell cases, all Fresh Fish tests, and 17,000 seeded board/placement comparisons with the original algorithm. The supplied State and Actions remain outside the repository. Five runs for each of the four player perspectives and a spectator produced identical complete response payloads before and after the change. Median projection times fell from 542–568 ms to 388–417 ms (26–29%) on Node 24.19.0 in the local workspace; these are not production latency estimates.

This is a reduction in measured work, not evidence that the entire deployed 2–3 second wait is eliminated. History replay and serialization still cost time, and production latency needs a new capture after publication. The change is bundled into Fresh Fish's Game Runtime: republish its Logic Artifact and matching UI Artifact. A backend-only deployment does not adopt it. No response schema or host bridge changes are required; existing UI Artifacts consume the same representations.

## Always supply projected transition patches, 2026-09-18

The board-search optimization did not address the main source of work. The same 118-Action snapshot caused 106 user-cascade execution attempts (34 threw during the replay probe), 64 processed-action applications, and 225 state projections each time its full response was generated. Those execution attempts existed to decide whether forward patches could be omitted.

Projection now retains every compatible transition's forward and undo patches and performs no execution proofs. The same snapshot makes zero `executeAction` or `applyProcessedAction` calls during response construction. Historical reconstruction, 225 state projections, canonical validation, and historical incompatibility handling remain. Player/spectator output matches the earlier response after excluding the newly retained forward patches; all 118 transitions round-trip through backward and forward navigation for every perspective.

Across five runs per perspective on the same local Node 24.19.0 environment, median response projection fell to 93–98 ms, compared with 542–568 ms before either optimization and 388–417 ms after the board-search change. This is approximately 82–83% less projection time than the original. Responses grew from 133,589–135,238 bytes to 174,188–174,273 bytes. Offline gzip sizes grew from 12,972–13,012 bytes to 15,715–15,751 bytes; this measures compressibility, not the deployed transfer configuration. Production improvement still requires a new capture.

Client reconciliation now compares the accepted patched state with the optimistic result instead of inferring agreement from Action identities and patch absence. Matching predictions retain their displayed state; corrections still apply from the confirmed starting state. Inherited hypothetical Undo establishes authoritative execution eligibility through canonical validation and replay at the point of use. It no longer treats forward patches or optimistic-execution flags as execution barriers. Projected simultaneous Undo remains speculative and is confirmed by the host.

### Publication and mixed artifacts

The backend must be rebuilt to adopt the simplified response projection. The shared Game Client and Exploration history changes are bundled into UI Artifacts: publishing only the Site Frontend does not update them. Rebuild and publish matching Logic/UI Artifacts for protected titles (currently Fresh Fish, Sol, The Estates, Santiago, Kaivai, and Lowenherz); rebuilding other titles adopts the shared reconciliation change as well. The Fresh Fish board-search improvement also requires its new Logic Artifact.

The response shape and host bridge interface are unchanged. New clients continue accepting legacy records without forward patches. Old clients already consume forward patches, so authoritative delivery remains supported, but they conservatively reject inherited hypothetical Undo when those patches are present and replace matching optimistic states unnecessarily. To preserve the complete experience, use the established frontend major-version forced-reload rollout with the updated UI publications before exposing unconditional patches to old sessions. Rehearse already-open clients as well as fresh navigation; this change does not modify versions, the site manifest, or deploy artifacts. The legacy `replay` projection input remains accepted for independently bundled callers; only its game configuration is used.

## State-first Game opening

The game route first requests `GET /api/v1/game/get/:gameId?includeActions=false`. The backend reads a consistent Game/State snapshot and validates and projects only the current State. It returns an empty Actions array with `historyComplete: false`; the default request retains its existing complete-history behavior. State-only responses use a distinct ETag. Legacy States lacking an Action checksum still require a history read to backfill that checksum.

A supporting Game UI Artifact displays that State and requests the ordinary full response after its notification listener starts. The initial State's Action count and checksum define a client history checkpoint. Subsequent Actions retain their absolute indices, and checksum validation starts at the checkpoint. Live submissions, optimistic processing, and notifications do not wait for the older history download. Initial synchronization covers updates between snapshot retrieval and notification subscription.

Background history is verified against the checkpoint and retained live Actions, then attached without replacing State or animating old Actions. Attachment waits for active submissions and visible transitions to finish. A response for a disposed session or obsolete perspective is discarded. An incompatible history branch triggers full resync. Undo/reconciliation that requires Actions before the checkpoint also falls back to full resync; notification payloads are unchanged.

History navigation and exploration remain unavailable until complete history is present. Undo can target eligible retained Actions. History-dependent descriptions may initially be incomplete. The history controls show loading/failure status and allow retry; a failed history request does not block live play. Failed synchronization pauses action submission until recovery succeeds.

Deploy the backend before the updated Site Frontend. Rebuild and publish each title's UI Artifact to adopt checkpoint-aware sessions and the history controls; no Logic Artifact change is required for this feature. The Site Frontend checks the session class's optional `supportsDeferredHistory` capability and fetches complete history before constructing an older session. An older Site Frontend continues constructing updated sessions with complete history. Local games continue loading their complete local data.

Measure time to visible board separately from time to complete history. This moves historical reads and projection off the initial page-load path; it does not remove UI Artifact loading, current-State projection, or the eventual full-history request.

### Scenario regression coverage

| Scenario | Regression coverage |
| --- | --- |
| Show the projected board before history arrives | `pageLoad.spec.ts` returns a modern session after only the State request; deferred-history browser tests compare its displayed State with the host projection |
| Initiate and optimistically execute Actions without earlier history | `gameReconciliation.spec.ts` checkpoint submission; browser delayed-history and failed-history scenarios |
| Receive ordinary notifications | Checkpoint tests exercise canonical execution and projected patches; the failed-history browser scenario receives a live notification |
| Duplicate, missing, or out-of-order notifications | Checkpoint tests cover retained duplicates, unknown duplicates before the checkpoint, and incremental recovery with complete and incomplete history |
| Undo within retained history | Replacement-notification tests exercise rollback boundaries available in complete and incomplete contexts |
| Undo crossing before the checkpoint | Reconciliation and browser tests require full reload; browser tests also initiate Undo of a retained Action whose server replay requires earlier history |
| Full resync failure and retry | The `resync-failure` browser scenario verifies that play pauses and resumes only after successful recovery |
| Partial action descriptions and unavailable old history | Browser tests verify an initially empty retained log, absent last Action and Undo candidate, and blocked history navigation |
| History navigation and exploration | Deferred-history browser tests verify gating and re-enabling; existing complete-history navigation, replay, exploration, and optimistic Undo browser tests remain in the run |
| Attach history while play advances | Tests cover attachment during a pending optimistic submission, older and newer history responses, branch mismatch, and no board transition on successful attachment |
| Session disposal or perspective change during loading | Deferred-history browser scenarios reject late attachment to disposed or differently represented sessions |
| Mixed UI Artifact versions and complete local results | Page-loader tests cover modern sessions, legacy sessions, and already-complete data without an additional request |
| State-only transport and privacy | Route, API, service, and representation tests cover the query flag, distinct ETag, skipped Action reads, and projected State |

The proposed self-contained before/after Undo patch is not introduced by this change. Tests exercise the existing notification contracts and their resync fallback. Exploration before full history is deliberately unavailable in this implementation; its gate is tested rather than claiming history-independent exploration support.

For an interactive delayed-history rehearsal, run `LOCAL_GAME_HISTORY_DELAY_MS=3000 node tools/scripts/local-hosted-game.mjs fresh-fish`. In local backend mode only, full Game loads (including cache revalidation and full resync) wait three seconds; State-only requests, submissions, and notifications are unaffected. Omit the environment variable to restore normal timing.

Both Game response variants have explicit weak ETag suffixes: `:full` for Game, State, and Actions, and `:state-only` for Game and State. Older suffixless or `:state` validators receive a fresh `200` response once, then revalidate against the new tag.

### Production conditional-request comparison, 2026-09-18

An authenticated regular-account probe reproduced unchanged TOP responses returning
200 through `boardtogether.games`. Each conditional request sent the exact ETag
from its preceding response. Using the same session and validator against the
direct Cloud Run backend returned 304. Both paths reported Site Frontend version
22.1.0; that header does not identify the backend revision.

| Representation | Public site conditional response | Direct Cloud Run conditional response |
| --- | --- | --- |
| State-only | 200, 48,041 body bytes, unchanged ETag | 304, no body |
| Full history | 200, 89,543 body bytes, unchanged ETag | 304, no body |

The direct comparison initially used the `latest` revision-tag URL. Repeating the
state-only comparison against the untagged Cloud Run service also returned 304,
while the public site still returned 200. Explicit request `Cache-Control:
no-cache` did not change that result. Body sizes are decoded response sizes, not
compressed wire measurements. No Game Actions or preference writes were made.

This isolates a difference in the public hosting/proxy path; it is not evidence
of a broken ETag comparison in the route or of browser-only status normalization.
Whether the intermediary removes `If-None-Match` before forwarding or transforms
the origin response still needs origin-side evidence. Do not change private
Game responses to public caching to work around it. The hosting route must
preserve conditional revalidation, or use an authenticated API path that does.
No production routing or application changes were deployed by this investigation.

The subsequent production timing log reported 200 at the backend, ruling out
transformation of an origin 304 for that request. The Game GET route now records
one of `game.load.validator.missing`, `game.load.validator.matched`, or
`game.load.validator.mismatched` as a counter in the existing `request_timing`
log. These diagnostics require a backend deployment; no UI publication is needed.
They record neither validator values nor cookies and leave response behavior
unchanged. With request timings enabled, repeat a conditional request through
the public URL and inspect `jsonPayload.counters`: `missing: 1` means no
`If-None-Match` reached the route, `mismatched: 1` means one arrived but failed
the route's comparison, and `matched: 1` accompanies a 304. Compare the direct
backend request using the same validator. Remove these targeted counters once
the production forwarding behavior has been established.

### Subscription-first reads and unchanged synchronization

The Site Frontend now waits for the User notification subscription before the
initial Conversation and Read Position reads. Both reads run concurrently. An
already attached User subscription permits an immediate load. Reattachment still
reconciles; a relevant Message arriving during a read requests a follow-up
snapshot instead of being lost. Responses for a Game that has been left cannot
replace the current Conversation or Read Position.

The host advertises optional `synchronizesOnSubscribe` and `isUserChannelReady`
capabilities on its Notification Service. Updated Game Clients use the
subscription event as their startup synchronization trigger instead of issuing
an additional pre-subscription check. Projected Games synchronize on the User
channel that delivers their updates; canonical Games use the Game Instance
channel. Opening a projected Game with an already attached User channel performs
one immediate check. Older hosts retain the previous startup behavior, and older
UI Artifacts ignore the optional host capabilities.

History navigation no longer disables during a read-only sync check. It still
disables when synchronization applies changes or replaces State, during Action
processing, and during visible transitions. Action-submission guards are unchanged.
The host chat changes require a Site Frontend deployment. The Game Client changes
require UI-only republication for each adopting title, including TOP and 1889;
no Logic or backend changes are required. These changes are not deployed here.
