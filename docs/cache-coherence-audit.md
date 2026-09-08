# Cache/store coherence audit

Status: audit of `feature/hidden-information` at `4b783f63` plus the uncommitted lobby fixes, 2026-09-06. This audit adds documentation and a reproducible diagnostic script; it does not implement further production fixes. The proposed mandatory database revision reads were rejected. The implemented approach and accepted deferrals are documented in [correctness fixes for the existing mechanism](./cache-coherence-correctness-plan.md).

**The audited baseline did not meet the requirement that cached data remain coherent with the database.** Fixing Redis WATCH retries does not establish that guarantee. There are protocol failures, incomplete dependency tracking, and reads that assemble multiple database versions.

Follow-up: [slice 1](./cache-coherence-correctness-plan.md#slice-1-implementation-and-validation) repairs F1 and the empty-cleanup, pooled-WATCH and malformed-value defects. Its verification run passes all three controls and F1, with ten remaining failures across F2–F9. The findings below describe the original audited baseline unless explicitly qualified.

[Slice 2](./cache-coherence-correctness-plan.md#slice-2-failure-and-expiry-contract) adds read-failure fallback and distinct writer/cleanup outcomes, with the user's choice of automatic expiry. Write markers now last 120 seconds; read tokens remain 32 seconds. The optional `--real-expiry` audit mode reads the actual Redis TTL and therefore now waits approximately 120 seconds. Default probes continue to shorten only their own test key's TTL. Cache recovery remains subject to the documented writer-drain/invalidation policy. The user selected 120 seconds as an operating assumption; current database SDK settings do not enforce that bound.

Slice 3 adds `locks.addKeys(...)` to the existing write callback, retaining one owner and the union of dynamically discovered keys across transaction retries. Scope tests include real Redis and synthetic Firestore transactions. Slice 4 applies conditional Game list dependencies before commit, using authoritative transaction reads and preserving lists whose membership does not change. It closes F2–F4. Slice 5 protects Account password updates and coordinates parent deletion with chat/bookmark writers and descendant cache protection, closing F5–F6. Slice 6 guards Game/State/history assembly with the existing revision key and falls back once to a read-only Firestore snapshot, closing F7. Slice 7 replaces manifest SET with the existing conditional-fill API, closing the reproduced F8 delayed-fill defect. The original F9 key-collision finding is deferred by user decision; publication visibility and deployment/recovery verification are also deferred by user decision. The subsequently reproduced local refresh race is fixed by serializing each instance’s refreshes. See the correctness plan for failure handling and deployment assumptions.

## Required guarantee

The request is: a cache miss is acceptable; stale data is not.

For current-value keys, after a database change commits, an entry must either describe that committed state or be unavailable. Negative results and lists are data too: a cached absence after creation, or a cached list excluding a newly qualifying Game, is stale. The guarantee must cover failures and overlapping operations, not only successful, sequential requests.

At the store interface, a successful read must correspond to one committed snapshot during that read. A read concurrent with a write may legitimately observe the state before the write; a read starting after the write completes must not observe that earlier state. An assembled Game response must not combine metadata and State that never belonged to the same committed snapshot. No system can promise that a response remains current after it has been delivered and another write occurs.

## Scope and method

Reviewed all RedisCacheService consumers in backend services and backend routes; every Firestore store; Game mutation and listing paths; Account/password updates; Conversation Read Positions and revisions; Publication manifest loading/invalidation; the Redis client pool implementation; and the supplied local Redis configuration. Notification counters and scheduling tokens are distinguished from database caches.

The diagnostic exercises the actual compiled cache and Firestore store implementations against Redis and the Firestore emulator. It uses synthetic documents, unique key/document names, and controlled interleavings. It does not depend on a Game package, start the hosted site, or mock Redis's transaction/expiry behavior. Store-level State fixtures do not execute Game rules.

```bash
pnpm --filter @tabletop/backend-services build
REDIS_HOST=cache FIRESTORE_EMULATOR_HOST=firebase:8080 \
  GOOGLE_CLOUD_PROJECT=demo-tabletop \
  node tools/scripts/audit-cache-coherence.mjs
```

Use infrastructure hostnames appropriate to the environment. An explicit Firestore emulator host is required. The script cleans up its synthetic documents, cache keys, and temporary manifest files. It reports violated invariants and intentionally exits nonzero while those defects remain; it is a diagnostic, not an added failing default test suite. For the real lease duration, append `--real-expiry`; otherwise only that case shortens its own Redis key's expiry to make the same interleaving fast.

The actual 32-second expiry case reproduced F1. The complete fast run reproduced eleven invariant violations across F1–F9, with three passing controls. The existing backend suite still passes all 83 tests: those tests do not establish this stronger guarantee.

## How the current protocol works

[RedisCacheService](../libs/backend-services/src/cache/cacheService.ts) stores protocol state and data in the same Redis string key:

| Stored form                 | Meaning                                  | Lifetime                                    |
| --------------------------- | ---------------------------------------- | ------------------------------------------- |
| `V:<JSON>`                  | Cached value                             | No default expiration                       |
| `N:`                        | Cached absence                           | No default expiration                       |
| `L:R:<token>`               | One reader may fill this key             | 32 seconds                                  |
| `L:W:.<writer>...`          | One or more writers prohibit cache fills | 32 seconds, reset by lock/unlock operations |
| Missing key or empty string | Miss                                     | Empty strings expire after cleanup          |

A read checks Redis first. On a miss it tries to obtain a unique read token, then reads Firestore. It can still read Firestore if another reader/writer owns the marker. Its asynchronous fill succeeds only if the exact token still occupies the key. Values are serialized before returning control to the caller, so mutating the returned object is not the delayed-fill defect here.

A write first replaces every supplied key with a write marker using WATCH/MULTI/EXEC. This removes old values and prevents earlier readers from filling. Overlapping writers append their IDs to one marker; this is a cache-fill barrier, not mutual exclusion for database writers. Firestore transactions are responsible for database concurrency.

After the writer callback returns or throws, cleanup removes that writer's ID. The final writer leaves a miss. A WATCH conflict during a read fill safely drops that fill. A cleanup WATCH conflict leaves a marker until it expires. The pending lobby fix retries write-marker acquisition and refuses the writer callback if acquisition cannot succeed.

Redis WATCH makes only the Redis transaction conditional. It neither coordinates Firestore's commit nor extends the marker's lifetime. Redis documents that expiry/eviction can invalidate watched keys and that aborted WATCH transactions apply none of their queued writes. [Redis transactions](https://redis.io/docs/latest/develop/using-commands/transactions/).

### When this protocol is sound

If every affected key is marked before the commit, every writer remains represented until its database operation has definitively settled, Redis retains the markers, and no writer bypasses the protocol, an earlier reader cannot refill an old value. Readers during a write may consult Firestore but cannot fill Redis. The overlap and read-token controls verify these useful properties.

Those assumptions are not enforced by this implementation. In particular, timeout is being used to infer that a writer has finished; separate store methods must remember all derived keys; and some keys are cleared only after commit.

## Cache ownership and dependencies

| Cache key family           | Cached data / authority                                            | Readers                                       | Writers that must affect it                                                      |
| -------------------------- | ------------------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------- |
| `game-<id>`                | Game metadata, excluding State / Game document                     | Single/batch Game lookup                      | Create, full write, metadata changes, Action/Undo metadata changes, delete       |
| `csum-<id>`                | Action checksum / State document                                   | Synchronization                               | Initialization, Actions, Undo, State replacement, checksum backfill, delete      |
| `etag-<id>`                | Random Redis-resident revision, not a persisted database revision  | Conditional Game GET                          | Every change to the represented Game data                                        |
| `games-active-<user>`      | Matching Game IDs / query on `userIds` and status                  | Active lists and cached-presence optimization | Membership changes, creation/deletion, all status transitions into/out of active |
| `games-completed-<user>`   | Matching Game IDs / same query with finished status                | Completed lists                               | Membership changes, completion, Undo of completion, deletion, finished imports   |
| `games-public-<title>`     | Matching Game IDs / public + Recruiting query                      | Open Game discovery                           | Publicness, recruiting status, creation/fork/import, deletion                    |
| `user-<id>`                | Sanitized Account, including derived `hasPassword` / User document | Account lookup by ID                          | Account creation/update, external identities, password presence                  |
| `etag-<game>-chat`         | Random Redis-resident Conversation revision                        | Conditional Conversation reads                | Message writes and parent deletion                                               |
| `bookmark-<game>-<player>` | Read timestamp or default epoch / bookmark document                | Read Position lookup                          | Read Position writes and parent deletion                                         |
| `site-manifest`            | Publication manifest / configured file and deployment selection    | LibraryService                                | Publication change; currently raw GET/SET/DELETE outside the barrier protocol    |

`csum-<game>-chat` is invalidated by Conversation writes but has no cache reader in the reviewed code. Game State, Action chunks, Conversation content, username/email/external-ID queries, authentication-token records, and notification subscription records are otherwise read directly from Firestore. NotificationStore uses Redis only for database-read counters. The `turn-notification-...` values are scheduling/deduplication state, not cached database records.

## Findings

### F1 — Expiring write barriers allow stale values after a successful write (high)

Locations: [write/cleanup protocol](../libs/backend-services/src/cache/cacheService.ts:214), [32-second expiry](../libs/backend-services/src/cache/cacheService.ts:294), [cleanup ownership handling](../libs/backend-services/src/cache/cacheService.ts:318).

Reproduced sequence:

1. Writer installs its marker and pauses long enough for it to expire.
2. Reader obtains a new read token and reads database revision 0; its cache fill is delayed.
3. Writer commits revision 1 and completes cleanup.
4. Cleanup sees the new reader's token, fails to find its own writer ID, and preserves that token.
5. The delayed reader successfully caches revision 0. The database is revision 1 and the writer has completed.

That stale value has no default TTL. The original cleanup preserved the intervening reader marker. Slice 1 fixes this after-completion stale fill by clearing that marker during late writer cleanup; it does not require replacing the write-marker model.

There is also a stale-read window across commit and cleanup if a reader fills after marker expiry and before the writer commits. Eviction of a live marker has the same logical effect as expiry. Longer TTLs and heartbeats do not alone prove safety under process pauses or lost markers.

Firestore permits transactions lasting longer than 32 seconds, and retries can lengthen the outer writer callback further. Its documented transaction limit is 270 seconds with a 60-second idle limit. [Firestore limits](https://firebase.google.com/docs/firestore/quotas). Redis's locking guidance explicitly warns that process lifetime does not imply retained lock ownership and discusses fencing. [Redis lock consistency](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/#disclaimer-about-consistency).

### F2 — Derived membership lists are invalidated after commit (high)

Locations: [updateGame key selection and post-commit invalidation](../libs/backend-services/src/persistence/firestore/gameStore.ts:313), [completion handling](../libs/backend-services/src/persistence/firestore/gameStore.ts:649).

The pending lobby fix correctly derives membership from the transaction's current document, but the pre-commit key list still comes from the earlier Game argument. A newly joining user's list is invalidated by a second Redis operation after the commit. Readers can observe a cached empty list during that interval. A Redis failure or process crash there leaves it stale indefinitely, even though Firestore committed the join. Both the window and the failure were reproduced.

Action completion has the same post-commit pattern for active/completed lists. Comparing a transaction result to a pre-transaction Game also makes invalidation depend on an earlier observation rather than the actual before/after transition. Post-commit cleanup, notifications, or a durable outbox can provide eventual repair, not the requested invariant.

### F3 — Undo and other lifecycle changes do not cover list dependencies (high)

Location: [undoActionsFromGame](../libs/backend-services/src/persistence/firestore/gameStore.ts:898), [its cache keys](../libs/backend-services/src/persistence/firestore/gameStore.ts:936).

Undo changes a Finished Game back to Started but invalidates only Game metadata, checksum and ETag. With both lists primed, the resumed Game remains absent from the active IDs and present in the completed IDs. This was reproduced through the actual Undo store method.

The service's active-list filter cannot add an omitted ID. The completed-list path does not filter out a now-active Game. More generally, `updateGame` invalidates user lists only for a `players` update, and creation/full-write invalidation assumes the active category. Status-only store updates and finished imports are not covered by a general dependency rule.

### F4 — Public discovery misses publicness changes and full creation (high)

Locations: [updateGame](../libs/backend-services/src/persistence/firestore/gameStore.ts:324), [writeFullGameData](../libs/backend-services/src/persistence/firestore/gameStore.ts:191).

Making an Invite-Only lobby public checks the old `game.isPublic` to choose keys, so a previously cached empty public listing survives. Full Game creation/fork/import never marks the public-title key. Both omissions were reproduced. `findOpenGamesForTitle` trusts cached IDs without re-evaluating its query predicate.

### F5 — First-password setup leaves `hasPassword` stale (medium)

Locations: [updatePassword](../libs/backend-services/src/persistence/firestore/userStore.ts:208), [sanitize](../libs/backend-services/src/persistence/firestore/userStore.ts:504).

`updatePassword` writes Firestore without the Account cache barrier. The cache omits the password hash but includes `hasPassword`, derived from it. After an Account with no password is cached, its first password can be written successfully while ID lookup continues to return `hasPassword: false`. Reproduced. Password verification itself queries Firestore, so this finding does not establish stale password authentication.

### F6 — Parent deletion leaves cached descendants (medium)

Location: [deleteGame](../libs/backend-services/src/persistence/firestore/gameStore.ts:123), [Read Position cache](../libs/backend-services/src/persistence/firestore/chatStore.ts:89).

Recursive deletion removes Conversation/Read Position documents but does not invalidate their cache keys. A previously cached bookmark is still returned after the whole Game has been deleted. Reproduced. The Conversation ETag is also omitted from deletion's key set. Parent existence checks at some routes may hide the result, but do not make the cache coherent or protect every store caller.

### F7 — A Game read can combine different committed snapshots (high; store-read consistency)

Location: [findGameById with State](../libs/backend-services/src/persistence/firestore/gameStore.ts:372).

The method obtains metadata from Redis/Firestore, then fetches State in a separate read. An atomic update between those reads produces old metadata with new State. The reproduction commits matching `name`/`machineState` values together and receives the impossible pair `before`/`after`.

State-only writes are legitimate; mismatched timestamps or independently meaningful fields alone do not prove a defect. The production concern is coupled fields and consumers: completion status/result can disagree with State result, and protected projection can receive a pre-Action State plus post-Action history and fail its Action-count check.

This is distinct from an invalid Redis entry: even flawless per-key cache invalidation cannot make separately timed reads one coherent snapshot. State and Action History are also fetched separately by higher-level representation construction. Firestore's transaction isolation applies to reads in the same transaction; it does not automatically extend across these calls. [Firestore isolation](https://firebase.google.com/docs/firestore/transaction-data-contention).

**Resolved in slice 6:** Game/State pairs and full, bounded or Undo history reads now share an optimistic WATCH scope. An active writer, intervening change or unavailable guard selects one cache-free read-only Firestore snapshot. This preserves metadata caching and legitimate State-only updates without adding a combined cache entry. See the [implementation and failure contract](./cache-coherence-correctness-plan.md#slice-6-consistent-game-data-reads).

### F8 — A delayed manifest load can undo deployment invalidation (high; non-Firestore source)

Locations: [manifest invalidation](../libs/backend-services/src/games/libraryService.ts:74), [load/fill](../libs/backend-services/src/games/libraryService.ts:229).

A loader reads the old manifest and pauses before its unconditional Redis SET. Publication replaces the file, invalidates Redis, and another loader caches the new manifest. The first loader then overwrites it with the old manifest. Reproduced with two real LibraryService instances and a temporary file.

There is no content revision or conditional fill here. A periodic refresh can keep reading the stale shared value; the `cacheSeconds` option is declared but not applied. This is a separate authority (Publication), but the same design mistake: Redis can advertise an unverified mutable value as current.

**Resolved in slice 7 (shared delayed fill):** manifest file reads use `cachingGet`, and deletion revokes their read tokens. Packaged and local fallbacks stay outside the producer and cannot enter the shared cache. The audit still interposes publication before a delayed fill and now passes. A subsequent regression also proved that an older refresh could overwrite a newer local snapshot despite correct Redis contents; refreshes on each instance are now serialized. Publication/mount visibility still requires verification. See the [slice 7 implementation](./cache-coherence-correctness-plan.md#slice-7-conditional-manifest-fills) and [local refresh proof and fix](./cache-coherence-correctness-plan.md#slice-7-follow-up-ordered-local-refreshes).

### F9 — Cache key construction is not injective (medium)

Location: [bookmark key construction](../libs/backend-services/src/persistence/firestore/chatStore.ts:90).

`bookmark-${gameId}-${playerId}` gives the same key for `(g, x-p)` and `(g-x, p)`. These are distinct valid Firestore document paths. Priming one caused the other lookup to return its timestamp; reproduced. Usual randomly generated identifiers reduce the chance of encountering this accidentally, but the accepted string IDs do not establish an unambiguous encoding. Game and Conversation ETag families similarly overlap for IDs ending in `-chat`.

Authority/project identity and cache-format identity are also absent from existing keys. Those are deployment/compatibility assumptions, not encoded cache invariants.

**Deferred by user decision, 2026-09-07:** the bookmark reproduction uses constructed identifiers and has not established an ordinary application-flow failure. The Game/chat ETag overlap causes extra invalidation, not a demonstrated stale-data failure; both writers protect the shared revision key. Chat does not populate the similarly overlapping checksum key with a competing value. The key-format migration is therefore deferred. The F9 probe remains unchanged and still reports its synthetic bookmark collision; this is an accepted limitation, not a repaired defect. See the [slice 8 decision](./cache-coherence-correctness-plan.md#slice-8-deferred-key-format-work).

### Recovery limitation — Redis rollback can restore obsolete values (high; documented scenario, not a failover experiment)

The repository's [local Compose configuration](../docker-compose.yml:7) enables periodic RDB snapshots and retains Redis data. A snapshot may contain a value from before a successful Firestore write. Restoring that snapshot restores the old value without restoring Firestore to the same instant. The application has no authoritative cache-generation check on reads. Production persistence, eviction, and failover configuration was not supplied and was not inferred from the local setup.

Redis documents the potential loss of changes since an RDB snapshot and asynchronous replication behavior. [Persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/), [replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/). An old Redis image must not be sufficient evidence that a database value is current. An atomic Lua script would still operate within Redis and would not solve this problem.

## Secondary implementation observations

- Raw `set`/`delete` coexist with conditional fills and writer barriers in one public interface. Correctness depends on callers knowing which combinations are permissible.
- Cache misses expose lock strings in `CacheResult.value`; callers must obey `cached`. Malformed `V:` JSON is logged but still classified as a hit with an undefined value. A replacement should expose only a validated value or a miss.
- Cleanup WATCH conflicts are swallowed. This normally causes temporary cache misses rather than stale hits while the barrier is valid; it is not an independent stale-data proof.
- The Redis pool returns connections after rejected callbacks without resetting WATCH state. An error between WATCH and EXEC can leave extra watched keys on a reused connection. This can produce unrelated conflicts; the current acquisition retry does not correct the ownership model.
- Cache failures can turn a successfully committed database change into a failed request during cleanup. That creates an ambiguous client outcome. Notifications must not be dispatched inside retryable database transaction callbacks, and mutation idempotency remains a store responsibility.
- `setChecksum` invalidates only the checksum key, although it changes the persisted State used by Game representations. No complete ETag dependency rule exists. The audit did not establish a separate user-visible failure for legacy checksum backfill.
- External writes and maintenance tools can bypass every Redis invalidation rule. Correctness requires an explicit, enforceable writer contract, not an assumption that scripts will remember the right keys.

## Follow-up outcome

The reproduced baseline failures identified protocol transitions, incomplete dependency protection and inconsistent snapshot assembly. Slices 1–7 repair these within the existing mechanism: conditional fills and write markers, transaction-owned dependency protection, consistent Game data reads and ordered manifest refreshes.

The [correctness plan](./cache-coherence-correctness-plan.md) records the implemented behavior, tests and operating assumptions. Key-format changes and further deployment/recovery verification are deferred by user decision. The synthetic F9 bookmark collision remains reproducible and is an accepted limitation; the audit must not be reported as entirely passing.
