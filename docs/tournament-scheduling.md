# Tournament scheduling

Slice 4 of [the tournament roadmap](https://github.com/justinkwaugh/tabletop/issues/57) previews and saves a Mini Tournament's tables after registration locks. Saving changes the Stage from `awaitingSchedule` to `scheduled`; the Tournament stays `locked`. Slice 5 now [provisions managed Games](tournament-provisioning.md) from these assignments; durable dispatch follows in slice 6. Their normal fill-based flow automatically generates/saves the schedule and launches Games after a one-minute withdrawal window; this slice’s administrator preview/save is not a required approval step. See [automatic start](tournament-registration.md#automatic-start-after-filling-the-roster).

## Assignments and balance

`TournamentSchedule` records the locked roster revision, algorithm version, seed, ordered entrant roster, table size, games per entrant, concurrency, quality measurements, and Tables. A Table's `entrantIds` are in Starting Position order. These are User Account identities; game creation maps each to its Game Instance Player identity when passing a `StartingPositionAssignment` to the existing initializer. No Game Instance or result exists merely because a Table is scheduled.

Version 1 requires equal games and equal counts in every Starting Position. The existing registration validator therefore requires games per entrant to be a multiple of table size. Generation also rejects a roster smaller than a table and a total participation count that cannot fill whole tables, with an explanation. Position balance is the fixed policy for this version; there is no configurable alternative yet.

The scheduler sorts the locked roster before applying the seeded shuffle. Cyclic offset blocks assign every entrant once to every position per block. This construction guarantees valid tables, distinct entrants within a table, and equal appearances without an unbounded feasibility search.

The accepted mini presets use exact difference designs:

| Table size | Entrants | Games each | Meetings per opponent | Offset blocks   |
| ---------- | -------- | ---------- | --------------------- | --------------- |
| 2          | 5        | 4          | 1                     | `0,1` and `0,2` |
| 3          | 7        | 3          | 1                     | `0,1,3`         |
| 4          | 7        | 4          | 2                     | `0,1,2,4`       |
| 5          | 11       | 5          | 2                     | `0,2,3,4,8`     |

Other configurations compare bounded candidates, keeping all hard constraints intact. Candidate count is capped at 96 and decreases with table count and size. Opening selection also uses a bounded set of greedy orders. Candidate comparison prefers opening participant coverage, then simultaneously usable table count, then fewer repeated table groups, then lower squared pair counts. This policy explicitly trades some opponent uniformity for a more usable opening. The exact presets retain their promised opponent balance. These are candidate schedules, not claims of global optimality.

The eight-player, four-seat, four-game case includes the witness `ACEG, BDFH, EABF, CGHD, DBAC, FHGE, GFDA, HECB`. Everyone occupies each position once, no table group repeats, pairs meet zero or twice, and two disjoint tables can open at concurrency one. In contrast, cyclic offsets `0,1,2,4` give pair counts of one or two but every table overlaps: only four players can start at concurrency one.

Quality records a histogram of meetings across **all** unordered entrant pairs, including pairs that never meet; repeated unordered table groups; and the number of tables and distinct entrants in a feasible opening. The first `openingTables` assignments form that opening witness. This is not a round boundary or a dispatcher instruction to wait for the entire opening to finish. Future dispatch starts further tables as their entrants become available. New Mini Tournaments default concurrency to games per entrant, so all Tables can start together. Administrators can choose a lower limit. Opening statistics remain scheduler metadata; the schedule UI does not display an Opening summary or markers.

The preview shows aggregate game, position, and opponent counts alongside the table assignments. Individual player balance is verified by scheduler tests and is not displayed in the UI. Position balance remains hard even when opponents or complete table groups must repeat. A player has `gamesPerEntrant × (tableSize − 1)` opponent encounters to distribute over the other entrants; repeated opponents are unavoidable when that exceeds roster size minus one. The preview reports actual counts and does not claim that a particular amount of repetition is the minimum possible outside the exact presets.

## API and persistence

All paths are under `/api/v1/tournaments`, require the existing active session, and return `Cache-Control: no-store`.

| Method | Path                    | Access and input                                                                 |
| ------ | ----------------------- | -------------------------------------------------------------------------------- |
| POST   | `/:id/schedule/preview` | Admin; `{ revision, version: 1, seed }`                                          |
| POST   | `/:id/schedule`         | Admin; the same input plus the preview's `scheduleId`                            |
| GET    | `/:id/schedule`         | Active User with visibility of the Tournament; reads only the committed schedule |

The server regenerates the schedule on save and checks its content hash against the preview ID. Clients cannot submit assignments. Stale tournament revisions, a changed preview, cancellation before publication, and replacement of a saved schedule are rejected. Repeating the same successful save is idempotent. The final transaction rechecks the stored Account's active status and Admin role.

The Tournament document embeds its `entrants` and `stages` arrays. One schedule document lives at `tournaments/{id}/schedules/{stageId}`. There are no entrant, Stage, individual Table, candidate-schedule, or per-user membership documents. Mine uses the Tournament's indexed `entrantIds` field, derived from the roster on writes. Entrant count is derived rather than stored.

Within the schedule document, all Table assignments are stored as one flat `positions` array of integer references into its `entrantIds` roster. Each consecutive `tableSize` entries forms a Table in Starting Position order. Table IDs derive from their stable sequence. The persistence adapter expands this into the unchanged `TournamentTable[]` API representation; this is a storage encoding, not another scheduling model.

At the configured maximum, there are 256 × 256 = 65,536 position entries. Firestore counts integers as 8 bytes, so the assignment array uses 524,288 bytes, plus the one roster and small schedule metadata. Tests save/reload the maximum 32,768-table schedule with 1,500-byte entrant IDs. It fits within the 1 MiB document limit without chunks or compression. See the [Firestore storage calculation](https://firebase.google.com/docs/firestore/storage-size) and [document limits](https://firebase.google.com/docs/firestore/quotas). Schedule fields and unqueried roster/stage/configuration fields are exempt from indexing in `firebase/firestore.indexes.json`.

Saving reads the current Account and Tournament, rechecks authorization/revision/lock state, creates the schedule document, and updates the embedded Stage in the same transaction. This is two transactional reads and two writes, independent of the number of Tables, excluding transaction retries. A failure commits neither record. Competing saves cannot replace the winning schedule; the same committed ID returns idempotently. There are no partially published schedules or orphan candidates to reconcile. Automatic startup uses the same schedule commit transaction to lock an open roster and select the initial Tables. It checks the pre-start Tournament revision and deadline, so it does not persist a separate awaiting-schedule state on that path.

| Operation                             | Tournament storage operations                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Read tournament/roster/stage state    | Zero when cached; one document read on a miss                                                    |
| Read a saved schedule through the API | Zero when both are cached; otherwise one read per uncached object                                |
| Join or leave, including roster lock  | Account and Tournament reads; one Tournament write                                               |
| Save a schedule                       | Account and Tournament transaction reads; two writes, plus the service's initial Tournament read |
| List Mine                             | Zero when cached; otherwise one query over Tournament documents                                  |

Tournament objects, packed schedules, list pages, and the next 100 dated open events use the existing shared Redis cache. Warm unchanged reads do not access Firestore. Cache entries have no periodic expiry; eviction or Redis unavailability falls through to Firestore. Writes protect and invalidate affected object and list keys before committing, including both old and new membership/status lists. List pages carry a generation token so an earlier query cannot repopulate a valid stale page after a mutation. Deadline checks filter cached timestamps against the current time; opening, closing, or changing a deadline invalidates that queue. Mutations still read canonical records transactionally for authorization and concurrency checks. Browser responses remain `no-store`; realtime notifications trigger reads backed by Redis.

These counts exclude authentication middleware, detail-page username cache misses, pagination lookahead, deadline reconciliation and retries. Current usernames still come through the existing cached User Service. Preview, schedule reads and schedule saves do not fetch usernames. The detail response contains `{ tournament, usernames }`, without duplicating the embedded roster or Stage. Schedule payloads are loaded separately so list and registration reads do not transfer every assignment.

Publication uses the existing Tournament Realtime Update with only `{ tournamentId, revision }`, avoiding a broadcast of the embedded roster. The detail screen reconciles the Stage and loads its immutable schedule, including in other player sessions and after reconnect. The admin preview is compact and separate from the rendering of tournament registration. Tables paginate locally in groups of twenty. No polling or manual refresh control was added.

This changes site-owned schemas, backend services, and the Site Frontend. It does not change the Game UI host bridge, bundled Game Client, or runtime initialization contract; no Game UI Artifact republication is needed for scheduling alone. The capability adoption requirements from slice 3 still apply when automatic game creation is implemented.

## Verification

From `libs/backend-services`:

```sh
CACHE_TEST_REDIS_HOST=localhost FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm exec vitest run src/competitions/tournamentScheduler.spec.ts src/competitions/tournamentService.integration.spec.ts src/persistence/firestore/tournamentCache.spec.ts
```

Algorithm tests cover the exact presets, rosters of 6–10 and 16/23/32, table sizes 2–5, repeated position blocks, reproducibility independent of roster storage order, infeasibility explanations, the eight-player opening counterexample, and the maximum configured 256-entrant/256-game workloads. Firestore tests cover visibility before publication, reload, concurrent identical/different saves, stale and altered requests, current-role authorization, cancellation, atomic rollback, cancellation/save races, exact read/write counts, a 640-table schedule, and the maximum 32,768-table schedule with long entrant IDs. Redis/Firestore tests verify zero database reads across independent cache clients, mutation invalidation of objects and filtered/paged lists, cached missing records, stale fill races, and deadline passage without another query. HTTP tests cover admin authorization and request validation. Hosted verification uses separate administrator/player sessions for preview, save, realtime appearance, reload, and mobile layout.

## Existing local data

This is an unreleased storage change. The emulator-only `tools/scripts/migrate-tournament-storage.mjs` migrates existing local Tournament/Entrant/Stage/Table records into the aggregate documents and removes the old subcollections and membership copies. It requires explicit `FIRESTORE_EMULATOR_HOST` and `GCLOUD_PROJECT`, and refuses to run without them. Build Common and Backend Services first. Local fixtures were migrated; no production data or indexes were deployed.
