# Correctness fixes for the existing cache mechanism

Status: slices 1–7 implemented; slices 8 and 9 deferred by user decision, 2026-09-07. No required implementation slices remain. The design keeps one mechanism for entity and derived caches, including multi-key WATCH transactions. The earlier proposal to replace the cache with mandatory database revision reads was rejected; the existing mechanism is retained.

## Slice 1 implementation and validation

The cache now revokes intervening reader tokens during writer cleanup, removes exact writer owners without duplicating them, deduplicates keys, and safely handles absent cleanup keys. Cleanup WATCH conflicts retry the batch and propagate on exhaustion instead of being silently dropped. Conditional fills and read acquisition still drop contention safely; read acquisition also preserves already populated entries. Malformed JSON becomes a miss while `N:` remains a valid cached absence.

All watched operations use one connection-lifecycle helper. It sends UNWATCH on exit, including errors before EXEC. If that fails, it closes the connection; a subsequent borrower reconnects and clears residual client WATCH state before use. Slice 1 addressed connection reuse and left the lifetime/error policy for slice 2 below.

Validation: backend TypeScript build and 102 backend tests passed, including 11 real-Redis tests among the 22 cache tests. The original Firestore/Redis audit passes its three controls and F1; its ten remaining failures are F2–F9, assigned to later slices. No application server was started. Run the Redis tests explicitly against test infrastructure:

```bash
cd libs/backend-services
CACHE_TEST_REDIS_HOST=cache pnpm exec vitest run
```

Without `CACHE_TEST_REDIS_HOST`, Redis-dependent tests are skipped. They use a one-connection pool to exercise reuse, unique keys, and automatic cleanup. Database calls in these protocol tests are callbacks; the separate audit exercises the real Firestore store.

## Slice 2: failure and expiry contract

The user selected **automatic expiry** rather than retaining uncertain write markers until manual recovery. The existing mechanism and callback return type remain in place.

| Event                                                                  | Behavior                                                                                                                                        |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Reported Redis transport failure during GET/MGET                       | Return a miss; the caller can read the database                                                                                                 |
| Reported transport failure or contention during read-token acquisition | No fill permission; the caller can still read the database                                                                                      |
| Redis programming/protocol error such as WRONGTYPE                     | Propagate it, rather than disguise a defect as ordinary unavailability                                                                          |
| Database read fails after a cache miss                                 | Preserve the database error                                                                                                                     |
| Write protection cannot be acquired                                    | Never invoke the writer; preserve the acquisition error                                                                                         |
| Writer rejects                                                         | Preserve the exact error and leave its ownership in the marker until expiry; no early unlock based on an assumed abort                          |
| Writer resolves and cleanup succeeds                                   | Return the original result                                                                                                                      |
| Writer resolves and cleanup fails                                      | Return the original result; emit an error diagnostic with `writerOutcome: completed` and `cacheCoherence: unconfirmed`; never replay the writer |

`completed` describes the callback: it can represent a committed database transaction or a successful no-op. A rejected generic callback does not prove that no database write committed. Treating all rejections conservatively means that even a validation failure can leave temporary cache misses. No database error classification is inferred inside the cache, and no new HTTP error/result shape is introduced.

Recognized read failures include the installed Redis client's connection/offline/socket/timeout errors and standard network/DNS error codes. No new transport retry loop is added. Existing WATCH retries affect cache operations only. Initial cache command queuing and connection timeout settings remain the existing client's policy; this slice handles reported failures rather than adding a request latency guarantee.

### Lifetime

Read tokens and released empty markers keep their **32-second** lifetime. Write markers use **120 seconds**, including a marker left behind by an uncertain writer. Removing one writer preserves the long lifetime for surviving owners. Marker changes refresh this shared TTL: abandoned ownership can persist while other writers keep updating that key, then expires after the key becomes quiet. It is not a separate expiry clock per writer.

The supported contract requires database work to settle within that write-protection window, including acquisition delay, transaction retries, callback work and any in-flight commit whose response was lost. This is an explicit operating assumption, not an automatically enforced Firestore cancellation deadline. The user selected 120 seconds after inspection showed that the installed SDK does not enforce a two-minute bound: it defaults to five transaction attempts, and a single Firestore transaction can last 270 seconds. The previous 30-minute value was also only an operating assumption. The chosen value is **not** a proven upper bound for SDK RPC retries, recursive deletes, callbacks or process pauses; overrun diagnostics do not make writes beyond the window safe. [Firestore transaction lifetime](https://firebase.google.com/docs/firestore/quotas#time_limit_for_a_transaction), [installed SDK attempt policy](../node_modules/.pnpm/@google-cloud+firestore@7.11.6/node_modules/@google-cloud/firestore/build/src/index.js).

The wrapper refuses to start the writer if acquisition has already consumed the budget. It checks elapsed monotonic time when the writer scope settles and logs an overrun on either success or failure. There is no per-write diagnostic timer; a writer that never settles does not emit this warning. The user selected this simpler reporting behavior. Redis marker expiry and acquisition lifetime checks remain unchanged. The wrapper does not pretend that an overdue database write has been cancelled. Cleanup also diagnoses missing ownership while still attempting safe invalidation.

If a marker expires before its database operation settles, coherence is outside this contract. Longer TTLs and diagnostics do not turn that case into a proven guarantee. Normal completion releases the marker promptly; a successful game action does not leave its cache blocked for 120 seconds.

### Recovery and deployment assumptions

Markers must not be evicted while their writers can still mutate the database. Use `noeviction` for the Redis instance supporting this contract, and treat allocation failures as failed write protection. The local instance was checked read-only: it currently has `maxmemory-policy=noeviction`, `save=20 1`, and `appendonly=no`. Production configuration was not inspected or changed.

Redis must not resume serving mutable cached values from an older persistence/replica image while Firestore remains current. Before admitting a restarted/restored/promoted instance:

1. Stop/drain all cache-participating writers, including maintenance writers. If database outcomes are uncertain, allow the supported settlement window to elapse after the last possible submission.
2. Remove the mutable cache values and markers from that instance after outstanding writes have settled. Do not flush a live instance while writers remain active: that loses their protection. Preserve unrelated Redis responsibilities when choosing the recovery command.
3. Start/resume participants against the empty mutable cache. A namespace change alone is not a solution while older writers remain active.

Uncoordinated snapshot restoration or asynchronous replica promotion is outside the contract. Redis documents that asynchronous replication can lose acknowledged updates, including invalidation markers. [Redis replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/).

This runbook is an operating requirement, not an automatic recovery implementation or a change to live Redis configuration. Deployment rehearsal was deferred by the user, who accepts these operating assumptions for the current traffic level; production recovery behavior has not been verified. Older backends also refresh write markers with the old 32-second lifetime, so the new lifetime contract cannot be claimed during mixed old/new backend operation. Drain those writers before relying on it. Frontend artifacts do not own these markers.

Diagnostics surface in backend logs through `console.warn`/`console.error`. Cleanup failure after a completed writer, an unknown writer outcome, an exceeded lifetime and missing ownership are distinguishable messages with cache keys and outcome metadata, without logging cached payloads. The store-dependency defects in later slices still prevent a site-wide coherence claim.

Validation after slice 2: the TypeScript build and all **119 backend tests** passed, including **39 cache tests / 13 real-Redis tests**. Tests cover transport failure fallback, non-transport errors remaining visible, uncertain writers retaining markers, successful results surviving failed cleanup, finite write TTLs and short reader TTLs, and overdue-operation diagnostics. The slow-writer diagnostics use a controlled clock; the real Redis tests inspect TTLs and shorten only their own keys to verify expiry recovery. The default Firestore/Redis audit still passes its three controls and F1, with the same ten remaining failures in F2–F9. That validation used the original 30-minute marker value; the full `--real-expiry` wait was not run. Slice 3 below validates the subsequently selected 120-second value.

## Scope

Retain `lockWhileWriting(keys, writer)`, overlapping write markers, unique reader tokens, conditional fills, negative caching, cached query results, and cache hits without database reads. Batch contention is not a reason to change the mechanism. No per-key rewrite, Lua migration, generic persistence framework or database revision check on every hit is proposed.

The changes below repair incorrect transitions and incomplete use of that mechanism. Small interface changes are justified only where they prevent incorrect usage.

## 1. Repair cache transitions and connection cleanup

In [cacheService.ts](../libs/backend-services/src/cache/cacheService.ts):

- Late writer cleanup must clear an intervening read marker or cached value. Only other write owners justify preserving a nonempty marker. This closes audit F1 without changing the lifetime of the reader's WATCH connection.
- Retry WATCH conflicts for cleanup as well as acquisition, rereading and recomputing the entire batch. Acquisition exhaustion must continue to prevent the database writer from running. A read-token acquisition or fill conflict can safely become a miss/dropped fill; it need not retry. Cleanup exhaustion must be treated as incomplete cleanup, not silently declared successful. Transport errors are a different case, below.
- Deduplicate keys. Adding the same owner to a marker must be idempotent; releasing it must preserve all other owners. This becomes especially important when transaction retries discover overlapping key sets.
- When every cleanup key is absent, perform no write. The original code called `mSet([])`, which the installed Redis client rejected after the database callback had succeeded.
- Release WATCH state on every exit from a pooled operation, including exceptions before EXEC and early no-op exits. If a connection cannot be reset safely, discard it rather than return it for unrelated work. Keep this connection lifecycle in one internal helper used by all watched operations.
- Do not classify malformed `V:` JSON as a hit with `undefined`. Return a miss and permit conditional replacement. Legitimate cached absence remains a distinct `N:` hit. Any removal of malformed bytes must be conditional, so it cannot delete a newer writer's marker or value.

The review executed three additional probes against the actual compiled implementation and Redis: disappearing markers cause `empty toSet Argument` after a successful writer; that failure leaves WATCH state on a pooled connection and causes an unrelated transaction to abort; malformed JSON is returned as `cached: true, value: undefined`. These provide additional evidence beyond the original audit. They used unique temporary keys and cleaned them up.

Slice 1 also changed read acquisition to acquire only from current miss states, preserving a value populated after an earlier miss. The earlier-observation argument is retained for interface compatibility. No watched connection is held across the database read.

## 2. Let the existing writer acquire additional keys

Implemented in slice 3: the callback receives a `CacheWriteLocks` interface with one method, `addKeys(keys)`:

```typescript
cache.lockWhileWriting(initialKeys, async (locks) =>
    firestore.runTransaction(async (transaction) => {
        const before = await readCurrentGame(transaction)
        const after = applyUpdate(before)
        await locks.addKeys(gameWriteCacheKeys(before, after))
        writeUpdatedGame(transaction, after)
        return after
    })
)
```

Slice 4 implements the Game-specific dependency calculation described below. Existing callbacks that need no extra keys can ignore the argument. An empty initial key list also receives a working scope. `addKeys` uses the existing batch-acquisition primitive; database transaction ownership remains with the caller.

The scope owns one writer identity and retains the key union outside `runTransaction`, across every attempt. Concurrent additions are serialized. Each addition watches the full union, checks that previously acquired keys still contain this owner, and atomically adds the same owner to the expanded batch. Repeated keys do not duplicate ownership. Keys enter the recorded union before acquisition is attempted, so a lost EXEC response cannot leave a possibly acquired key unaccounted for. A failed acquisition poisons the scope: later additions reject with the same error rather than continuing with uncertain protection.

Each database attempt must compute dependencies from its authoritative reads and **await `addKeys` before returning control for commit**. A failed addition must abort the attempt; never catch it and continue to commit. The wrapper cannot prevent a database commit when its callback ignores this requirement. It drains pending acquisitions before cleanup or failure reporting and rejects additions after closing. If the writer propagates an error, all possibly acquired markers remain until expiry. If the writer reports success despite a failed acquisition, the wrapper preserves that completed result, retains markers, and logs `cacheCoherence: unconfirmed`; it does not turn a possibly committed write into an ordinary retryable failure.

Additions check the original scope deadline before and after acquisition. Marker updates refresh Redis TTLs but do not grant the scope a fresh 120-second budget. Missing ownership during an addition aborts it rather than silently recreating an expired marker and claiming uninterrupted protection. This check cannot repair a coherence violation that has already occurred after marker loss.

Do not release inside a Firestore transaction callback: the SDK commits after the callback returns. Do not release between retries while later attempts are still using the outer scope. A record that a key was acquired earlier is also not proof that its marker has survived expiry; the lifetime and Redis recovery assumptions above still apply.

Validation after slice 3: backend TypeScript build and all **130 backend tests** pass, including **50 cache tests**, of which **19 use real Redis** and **2 also use the Firestore emulator**. The default coherence audit passes its three controls and F1, with the same ten failures in F2–F9 assigned to later slices. The full `--real-expiry` wait was not run; tests inspect the 120-second TTL and force expiry only on their own keys. New tests cover concurrent/repeated additions, overlapping writers, revoked reader tokens, lost acquisition responses, missing ownership, closed scopes, draining pending work, and the 120-second deadline. Two synthetic Firestore tests use the real SDK: one changes membership between transaction attempts and verifies both attempts' dependencies remain protected through commit; the other queues an update, fails additional protection, and verifies the database remains unchanged. They add no Game dependency to backend services. Enable both integrations with:

```bash
cd libs/backend-services
CACHE_TEST_REDIS_HOST=cache FIRESTORE_EMULATOR_HOST=firebase:8080 pnpm exec vitest run
```

The Firestore tests are skipped without `FIRESTORE_EMULATOR_HOST`; all Redis integration tests are skipped without `CACHE_TEST_REDIS_HOST`.

## 3. Conditional Game dependencies (slice 4)

Implemented in [gameCacheKeys.ts](../libs/backend-services/src/persistence/firestore/gameCacheKeys.ts) and [gameStore.ts](../libs/backend-services/src/persistence/firestore/gameStore.ts). Following the user's refinement, list invalidation is conditional on query membership rather than every Game mutation.

`GameCacheKeys` centralizes existing key formats for both reads and writes. Its dependency calculation enumerates the cached ID lists containing the Game before and after the change, then takes their symmetric difference. These lists depend on:

- User lists: the flattened player user IDs and statuses from `getGameStatusesForCategory`, including Active, Completed, Deleted and Archived.
- Public lists: `typeId`, `isPublic === true`, and `status === WaitingForPlayers`, matching `findOpenGamesForTitle`.

Only lists whose membership changes need protection. A joining or departing user's applicable list changes; a continuing member's list does not. Status transitions within Active preserve the active ID list. Completion/Undo changes Active and Completed membership. Publicness, title and lobby-status transitions protect the old/new public lists only when eligibility changes. Creation and physical deletion treat the absent side as belonging to no lists. Timestamp, active-player, name and other payload changes still invalidate the Game entry; cached ID lists subsequently hydrate current Game metadata.

The Game document, checksum and response-revision keys are acquired before the transaction. Metadata/membership updates, Actions and Undo use their existing transaction reads to calculate before/after membership, then await additional protection before commit. An empty list difference issues no additional Redis acquisition. Retries retain the full union through the outer scope. Creation and full creation/fork/import know their dependencies without a database read. All post-commit user-list invalidation calls have been removed.

The same player-user-ID extraction is used for cache dependencies and persisted `userIds`. All Game update paths apply it when a validator changes players. Metadata updates determine their changed-field list after validation so fields added by a validator are actually persisted and protected. State-only updates and checksum backfill use shared checksum/revision keys without fetching Game metadata. Slice 6 reuses the revision key to guard assembled reads; it adds no combined cache entry.

Deletion now reads the current Game and deletes the parent document in a Firestore transaction after acquiring its list dependencies. This prevents stale caller metadata or a concurrent membership update from escaping the dependency calculation. The outer scope remains active through recursive descendant cleanup. This adds one Game read per deletion attempt; the other migrated write paths add no Firestore reads. Slice 5 below adds child-writer coordination and descendant cache coverage; slice 4 alone did not close F6.

Existing key bytes and serialized cache values are unchanged, and no frontend or Game artifact publication is needed for this slice. Old backend writers retain the demonstrated omissions, so mixed backend operation cannot claim the new correctness coverage. Previously stale list entries also need invalidation during any future coordinated cutover; correct future writes do not automatically repair unrelated old entries.

Validation uses real Redis and the Firestore emulator with synthetic Games, without adding any Game package dependency. The regression suite checks pre-commit barriers, failed acquisition preventing commit, changed memberships across retries, stale caller snapshots, every supported category, public creation/import and eligibility changes, completion and Undo, and preservation of unaffected cached lists. The F2 fault probe now accepts removal of the post-commit operation while preserving its committed-database and non-stale-cache assertions. Validation: backend TypeScript build and **148 backend tests passed**, including **18 new Game store tests against Redis and Firestore**. The audit now passes its three controls and all F1–F4 probes. Five failures remain, one each in F5–F9, assigned to later slices. No development servers were started.

`updatePassword` now uses the same Account write protection as other Account writes: the cached Account contains `hasPassword`. Password hashing happens before cache acquisition, and the scope covers the database transaction and its commit. Failure to acquire protection prevents the password write. Password hashes remain excluded from cached Account data.

## 4. Correct deletion and snapshot assembly locally

### Slice 5: Account coverage and deletion coordination

The user accepted one parent-existence read per chat/bookmark transaction attempt. Both `addGameChatMessage` and `setGameChatBookmark` require the Game document within their own Firestore transaction, before writing a descendant. A missing parent throws the existing Game `NotFoundError`. There is no cached existence check: the database read establishes the conflict relationship with parent deletion. Parent existence is sufficient here; physical deletion does not introduce a new logical-delete state or schema.

The deletion sequence is now:

1. Acquire Game/checksum/revision and chat checksum/revision cache protection in the existing outer scope.
2. In a Firestore transaction, read the current Game, acquire conditional list dependencies, and delete the parent document.
3. After that transaction commits, query bookmark document IDs using an empty field projection. Enumerate actual documents, including former players, rather than deriving keys from the current player roster.
4. Await additional cache protection for all enumerated bookmark keys.
5. Recursively delete descendants, retaining the entire scope until cleanup finishes.

A child transaction that reads the parent before deletion either commits before the parent is removed or must retry and observe absence. A child transaction starting after parent removal rejects. Therefore, after step 2, compliant writers cannot add bookmark documents that would escape enumeration in step 3. Empty bookmark results need no extra cache acquisition. Cached default bookmarks for absent documents remain valid because deletion does not change their database-derived value.

If bookmark acquisition fails, recursive deletion does not start. The parent can already be gone while descendant documents remain; their cached values still describe those existing documents. If recursive cleanup fails partway, the scope retains its ownership until expiry rather than exposing pre-deletion cached values for removed documents. A subsequent deletion call can proceed with an absent parent and enumerate remaining descendants. No automatic deletion retry loop or background cleanup job is added; incomplete cleanup is reported to the caller and still requires another deletion attempt. The 120-second settlement and Redis recovery assumptions remain applicable, including to recursive cleanup.

Chat/bookmark cache-key construction is now shared with deletion through `GameCacheKeys`, and the Firestore bookmark path is also shared. Existing cache key bytes, document schemas and bookmark read defaults are unchanged. Parent/descendant guarantees require draining older backend writers that omit the parent check; frontend and Game artifacts require no changes. This does not address reuse of a deleted Game ID while its old descendants are still being cleaned up; new Game creation must use a fresh ID during that interval.

Tests use the real Redis protocol and Firestore emulator to exercise both race orderings for chat and bookmark writes, missing-parent rejection, bookmarks belonging to former players, late fills, protection visible before recursive deletion, acquisition failure and deletion retry, and partial recursive cleanup failure. Account tests verify that first password setup updates cached `hasPassword`, excludes the hash from cache, and cannot write without protection. Shared Redis test setup has been extracted for the protocol and store suites.

Validation: backend TypeScript build and **160 backend tests passed**, including **12 new Account/deletion integration tests**. The coherence audit passes its controls and all F1–F6 probes. Three failures remain: F7 (combined Game/State snapshot), F8 (manifest caching), and F9 (cache-key collisions). No development servers were started.

### Slice 6: consistent Game data reads

Game metadata and State do not have to change together on every write. State-only writes are valid. The requirement is that consumers receive a committed combination of the fields they use together. Completion couples Game status/result with State result; protected projection, sync and historical forks couple State with Action History. A reproduced protected load fetched State before an Action commit and history afterward, then failed projection because the history contained more Actions than State's `actionCount`.

The store now owns that consistency boundary:

```ts
const data = await store.loadGameData(gameId)

const selected = await store.readGameData(gameId, async (reader) => ({
    game: reader.game,
    actions: await reader.actionRange(startIndex, reader.game.state?.actionCount ?? 0)
}))
```

`loadGameData` returns Game with current State and complete history. `readGameData` supplies Game with State and methods for complete history, a bounded range, or an Undo window. Callers choose only the history they need. The callback must be read-only, await every reader operation, and keep the reader within its scope. It can execute twice: external writes, notifications and other side effects belong after the read resolves. The store returns `undefined` if the Game does not exist in the accepted read.

Both APIs use the same algorithm:

1. WATCH the existing Game revision key, `etag-${gameId}`, and read its marker. All metadata, State, Action, Undo, checksum and deletion writers already protect this key. One key therefore covers these database dependencies, regardless of the number of Action chunks read.
2. If a writer marker is present, skip the optimistic read. Otherwise use the existing metadata cache and ordinary State/history reads, then validate WATCH with a read-only Redis EXEC. This detects intervening changes even if the key returns to its original bytes.
3. If a writer was active, WATCH fails, or Redis reports a transport failure, discard the optimistic result and run the requested reads once in a read-only Firestore transaction. Every document, query and adaptive Undo chunk read then uses that same snapshot. The fallback bypasses Redis data and does not repopulate caches from its snapshot.

There is no application retry loop. A stable optimistic read error propagates; if its guard was invalidated, the error is discarded and the snapshot fallback gets a chance to read coherent data. Fallback errors propagate. Unexpected Redis protocol/programming errors also propagate. Existing SDK connection and transaction policies remain unchanged.

The Redis primitive is `readConsistently({ keys, read, fallback })`. It deduplicates keys and requires at least one. Its guard connections use a separate pool because a callback can borrow ordinary cache connections; sharing a bounded pool could deadlock those nested operations. `destroy()` closes both owned pools. WATCH cleanup follows the existing connection-lifecycle helper. The installed Redis client rejects a watched EXEC after reconnect; loss of the original connection cannot silently validate a read.

Normal successful reads add Redis guard commands but no Firestore reads. The fallback rereads the required database data, including Game metadata even if it was previously cached. It reads only the Action documents/chunks requested by the callback. Neither a combined Game/State cache payload nor additional writer keys are introduced.

Full loads and forks use `loadGameData`. Sync and Undo use tailored readers. `findGameById(id, true)` delegates to the same mechanism for a coherent Game/State pair; metadata-only callers keep existing caching. The fallback shares the normal read's legacy normalization and supports both individual and chunked Action storage. Checksum backfill retains the checksum calculated from the loaded history in its response, even if the database already has a newer checksum by the time backfill runs.

This closes F7 under the existing write-lifetime and Redis-retention assumptions. It does not force unrelated fields to change together or replace write-time transaction validation. Cache formats, database schemas and frontend response shapes are unchanged; no Game UI Artifact publication is needed. Old backend readers retain the original assembly race, so these guarantees apply only after those readers are drained.

Validation: backend-services and backend application TypeScript builds pass, and all **178 backend tests** pass with Redis and the Firestore emulator enabled. The 18 new tests cover stable reads without nested-pool deadlock, active and completed writers, multiple guard keys, expiry, transport failures, error handling, State-only writes, completion, deletion, snapshot isolation, legacy defaults/history, bounded history and Undo reads, checksum backfill, and protected load/sync across concurrent Action and Undo commits. The coherence audit passes its controls and F1–F7; only the previously assigned F8 (manifest fills) and F9 (cache-key collisions) probes still fail. No development servers were started.

## 5. Close bypasses and key collisions

Database-derived fills use the existing conditional-fill interface. The proposed key-format changes are deferred; see the slice 8 decision below.

### Slice 7: conditional manifest fills

The user narrowed this slice to the demonstrated shared-cache race and reuse of the existing cache service. `LibraryService.loadManifest()` now calls `RedisCacheService.cachingGet()` with a producer that reads and parses the manifest file. The producer's read token is acquired before file access, and the existing conditional fill checks that token before writing Redis. `invalidateManifestCache()` continues deleting the key, which revokes outstanding tokens as well as removing cached values. An older load cannot refill an invalidated empty key or overwrite a newly cached manifest. This closes the reproduced F8 delayed-fill defect without a new cache protocol, key format, retry loop or Firestore read.

Only file-derived manifests enter the shared cache. A missing, unreadable, malformed or null manifest fails the producer instead of returning cacheable absence. Existing packaged and last-local-snapshot fallbacks remain available to the caller outside that producer and cannot be cached as authoritative data. File errors retain their warning and existing `Manifest unavailable` outcome when no fallback exists. Redis protocol errors still propagate. A failed producer can leave a read token until its existing 32-second expiry; subsequent misses still read the file but cannot fill until a token becomes available. Successful cache fills use the cache service's existing asynchronous behavior.

Uncached local loading and manifest response shapes are unchanged. Normal cache hits read Redis; misses read the file. The eight regression tests exercise invalidation with and without a replacement fill, shared hits without file access, packaged/local fallback exclusion, recovery after source failure, uncached loading and protocol errors. The audit intercepts both the old unconditional SET and the new conditional fill so its F8 race remains meaningful across implementations.

Publication visibility remains a separate follow-up concern. Production already refreshes before API and task requests; it is inaccurate to describe it as having no refresh mechanism. Verification of source-file visibility across instances and the ordering of publication versus invalidation was deferred by user decision. Retaining a local snapshot on file failure is existing availability behavior, not proof that the snapshot is current. Conditional filling alone does not establish coherence throughout an unprotected file replacement or make an outdated mounted file authoritative. No move of Publication into Firestore is proposed.

Older backend loaders still use unconditional SET and can violate the new fill rule. Cache values and key bytes remain compatible, but this guarantee requires draining those loaders and invalidating the manifest key afterward. No frontend or Game Artifact publication is needed to adopt this backend change.

Validation: backend-services and backend application TypeScript builds pass, and all **186 backend tests** pass with Redis and the Firestore emulator enabled, including **eight new manifest integration tests**. The coherence audit passes its controls and F1–F8; only F9 (cache-key collisions) still reproduces a violation. No development servers were started.

### Slice 7 follow-up: ordered local refreshes

The user authorized a small fix after proving the local refresh race. A real-Redis test paused the first refresh after its cache read returned version `1.0.0`, then replaced the file, invalidated Redis, and completed a second refresh with `2.0.0`. Releasing the first read reverted the local snapshot to `1.0.0` and emitted mismatch notifications for `2.0.0` followed by `1.0.0`, while Redis still contained `2.0.0`. The reproduction failed twice in under a second per run, isolating the local assignment from Redis fill correctness and file visibility.

`LibraryService.refreshManifest()` now queues its complete read-and-publish operation behind the previous refresh on that instance. Each caller performs its own read once its turn starts. A refresh requested after invalidation therefore cannot share the result of an earlier in-flight read. The queue observes failures so later callers can proceed, while each original caller still receives its own result or error. Notifications and snapshot/signature updates remain inside the ordered operation. There are no new database reads, cache keys, dependencies, retries, distributed locks, or changes to response shapes and artifact requirements.

The permanent regression uses the same held cache read and publication/invalidation boundary. It asserts that the later read waits, then observes version `2.0.0`, with no backward notification or final snapshot regression. It failed before the queue was added and passed afterward. Another test verifies recovery of the queue after a failed read. Run the focused suite with:

```bash
cd libs/backend-services
CACHE_TEST_REDIS_HOST=cache pnpm exec vitest run src/games/libraryService.spec.ts
```

Validation: both backend TypeScript builds and all **188 backend tests** pass, including ten manifest tests. The coherence audit still passes its controls and F1–F8; F9 remains the only failing probe. No development servers were started.

### Slice 8: deferred key-format work

The user chose to defer key-format changes after reviewing the concrete collision examples. The bookmark probe uses deliberately constructed identifiers; it demonstrates ambiguous encoding, but no ordinary application-flow bookmark failure has been established. The Game/chat revision overlap does not demonstrate stale data: both writers invalidate the shared opaque revision key, causing extra invalidations and potentially guarded-read fallbacks. Chat only invalidates its checksum key, so it does not fill a colliding Game checksum key with competing data.

The create API accepts client-supplied Game IDs, so this is a scoped deferral rather than a claim that every possible identifier is collision-free. Existing key formats remain unchanged. F9 stays available in the diagnostic script as a reproducer and still reports its synthetic collision; it is no longer required implementation work for this project. The final verification must report that accepted limitation rather than claim that F9 was fixed.

If key-format work is resumed, coordinate the backend cutover: old writers do not protect new-format keys. Use a drained replacement or staged dual protection before enabling new-format reads. No such migration is currently planned.

## 6. Make failure outcomes explicit

- Recognized cache transport failures during reads become misses. A failed acquisition confers no fill permission. Database read failures still propagate.
- Failure to establish write protection prevents mutation; do not fall through to the writer.
- Preserve the database error when database work fails; a cleanup exception must not replace it.
- Distinguish a committed mutation with failed cleanup from a failed mutation. Do not present it as an ordinary retryable write failure, and do not silently imply coherence has been restored. Cache cleanup can retry without replaying the database callback.
- Do not equate every rejected Firestore promise with a definitively aborted write. The installed SDK submits rollback asynchronously; source inspection does not establish which transport failures have ambiguous commit outcomes. That distinction must guide release and error reporting.

Slice 2 above implements the selected automatic-expiry policy with a supported write lifetime, explicit outcomes and marker-loss diagnostics. The prior lost-marker/failed-cleanup trace remains possible outside the lifetime/retention assumptions, and serving an old Redis image remains unsafe without the documented recovery procedure. The user deferred the final deployment verification and accepts these operating assumptions for the current traffic level; this does not establish their verification. This is a conditional coherence contract, not a claim that a longer TTL proves safety under arbitrary pauses or cache rollback.

## Implementation order and acceptance

1. **Complete:** cache transition/connection fixes, including deterministic conflict and expiry tests against real Redis.
2. **Complete:** define cache failure and lifetime behavior, including database outcomes and the selected automatic-expiry/recovery assumptions.
3. **Complete:** add protected keys within the existing writer scope. Tests cover retries with changing dependencies, failed acquisition and rollback, and acquisition preceding commit.
4. **Complete:** centralize conditional Game dependency rules and remove post-commit list invalidation.
5. **Complete:** protect password updates and coordinate Game deletion with chat/bookmark writers and descendant caches.
6. **Complete:** guard Game/State/history reads with the existing revision key and fall back once to a read-only database snapshot.
7. **Complete:** use existing conditional manifest fills and order local refreshes; publication visibility remains part of deployment verification.
8. **Deferred by user decision:** key-format changes and their migration are not required for this project.
9. **Deferred by user decision:** further deployment and recovery rehearsal. Publication visibility, backend rollout, Redis recovery and the write-lifetime assumptions remain documented operating assumptions rather than verified deployment guarantees.

The [original audit script](../tools/scripts/audit-cache-coherence.mjs) provides F1–F9 regressions. Slice 1's tests include disappearing markers, leaked WATCH state, cleanup conflicts, duplicate ownership, malformed values and negative entries. Slice 4 also verifies empty cached lists and all supported lifecycle categories. Slice 5 verifies concurrent child creation/deletion. Further old/new backend overlap verification is deferred. Application dependencies are unchanged; no development servers were started.
