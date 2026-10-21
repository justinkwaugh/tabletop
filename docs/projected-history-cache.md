# Projected history cache

Status: built on 2026-10-21 (`ProjectedHistoryCache` in `libs/backend-services/src/games/projectedHistoryCache.ts`); not released.

## Problem

A full load of a protected Game (`GET /game/get/:id`, `projection.response.game`) projects the
whole Canonical Action History for the requesting Perspective. Only the current State and each
Action's undo patch are stored, so `projectActionHistory` walks back from the current State,
rebuilds every historical State and projects each one. The work is synchronous and grows with the
length of the game.

On 2026-10-21 one Reef Encounter load (224 Actions) held the backend worker for 6.3 s, long enough
to fail the gateway's 1 s readiness probe and delay every other request on that instance; 43 loads
that day spent over a second projecting. Commit 7ba235635 cut the per-State cost (Reef Encounter
1.55 s to 0.10 s locally, Sol 0.55 s to 0.38 s), but the cost still grows with history length, is
paid again by every reload, and Sol remains around 1.5 s at production CPU speed.

Every Action already projects its new transitions for each Perspective (the acting Player's
response and `publishActionResults` for each Player and the spectator) and then discards them.

## Why a cached prefix stays valid

The projected record of Action `k` is a function of the canonical States before and after it, the
Action itself, the Perspective and the Game configuration (`ProjectionContext` is `{ config }`;
policies evaluate against the State being projected, and end-of-game disclosure uses each
historical State's phase, see [hidden-information.md](hidden-information.md)). Later Actions never
change it. Therefore, for any `P <= M`:

- the history projected when the Game had `P` Actions equals the first `P` records of the history
  projected at `M`, and
- `projectActionHistory({ currentState, startIndex: P, actions: actions.slice(P) })` equals records
  `P..M` of the full projection.

Checked on the three exported production games for every Perspective at sampled split points:
1,670 checks (Fresh Fish every `P`, Reef Encounter every 3rd, Sol every 7th), all byte-identical.
Script: `/workspace/tmp/health-probes/prefix-check.mjs`.

## Storage

`ProjectedHistoryCache` (`libs/backend-services/src/games/projectedHistoryCache.ts`) keeps one
Redis list per Game, Perspective, title logic version and record format, keyed in
`gameCacheKeys.ts` beside the other Game keys:

```
projected-history-<gameId>:<perspectiveKey>:<logicVersion>:<recordFormat>
perspectiveKey = player:<playerId> | spectator
```

Each list element is a gzipped JSON array of projected `GameAction` records. A record carries its
canonical `index` and `id`, which is what the read validates; `recordFormat` is a constant in the
store, bumped when the backend changes the shape of a projected record, since the logic version
only tracks the title. Decoding goes through `Value.Convert` and `Value.Assert` against the
`GameAction` schema, which revives the dates; a segment that does not decode ends the usable
prefix.

Every list carries a 24-hour TTL, refreshed by every load and append. Production Redis is Redis
Cloud, 250 MB, `volatile-lru`, so these keys are eviction candidates and, being large and idle,
are the ones LRU drops first; an evicted list only costs one full projection. Measured size per
Perspective for long games: Reef Encounter 324 KB JSON (28 KB gzipped), Sol 762 KB (68 KB), Fresh
Fish 280 KB (23 KB). With five Perspectives per four-player Game, the 58 protected Games active on
2026-10-21 come to about 15 MB, and all 148 started Games to about 40 MB. Decoding a cached Sol
history costs about 3.5 ms locally against 380 ms to project it.

Segments make an append independent of history length: after an Action, each Perspective gains one
small segment with `RPUSHX`, without reading, decompressing or recompressing the rest.

The cache holds derived data only. It is validated against the consistent read on every use, so it
takes no write markers and is outside the cache-coherence contract: a stale, reordered, partial or
evicted list costs projection work and never produces a wrong history. Only fully projected
records are stored: a load whose projected tail contains a redacted record (an undo patch that
could not be applied) stores nothing, so a later load after that Action is undone projects afresh
instead of serving the redaction.

Errors follow the other caches: a Redis transport failure on read is a miss and on write is
logged; a protocol error on read propagates, since it signals a defect; writes never fail a load or
a committed Action.

## Full load

1. Read Game, State and Actions through `readGameData` exactly as today (the consistent read).
   Loads that do not project (Host View, hotseat, titles without visibility, `includeActions=false`
   or an empty history) skip the cache entirely; `historyProjection` in `gameRepresentation.ts` is
   the one guard for that, shared with the ETag and the representation.
2. `LRANGE` the Perspective's list and decode it. Walk the segments in order, accepting records
   while each record's `index` is the next expected one and its `id` equals the canonical Action
   id at that index. Stop at the first mismatch or undecodable segment. `P` is the number of
   records accepted.
3. Project only `actions.slice(P)` with `startIndex: P`. The walk back covers `M - P` Actions, and
   the result includes the projected current State.
4. Store, then respond with the accepted records plus the tail:
    - all segments accepted and an empty tail: refresh the TTL only;
    - all segments accepted and a non-empty tail: `RPUSH` the tail as one segment;
    - a mismatch (Undo, reordered or lost append), an undecodable segment or more than 32 segments:
      replace the list with one segment holding all `M` records (`MULTI`: `DEL`, `RPUSH`,
      `EXPIRE`);
    - a tail with a redacted record: store nothing.

The store is awaited before the response so a following load sees it; its compression runs on the
request either way, and it adds one Redis round trip. Counters `projection.history.cached` and
`projection.history.projected` record how many records each load took from the cache and
projected.

One accepted difference from an uncached load: when the tail projection fails and redacts, an
uncached load would also redact everything before the failing cascade, whereas the cached prefix
keeps its patches. Those records were projected for this Perspective when they were cached, and the
client stops its history at the redacted boundary either way.

## Action time

After `publishActionResults` has projected and published the new transitions for a Perspective,
`RPUSHX` one segment with the published records and refresh the TTL. `RPUSHX` only appends to an
existing list, so the cache never holds a list that starts mid-history. The append runs after
publication and never surfaces a failure to the Action.

Concurrent Actions on one Game commit in order, but their appends can arrive out of order; the
index check in step 2 rejects the misplaced segment and the next load rewrites the list.

Undo appends nothing. Redone Actions keep their ids but always take a lower index than before,
because the undone Action ahead of them is removed, so the next load sees the removed Action ids no
longer match and rewrites the list. The validation therefore assumes an id never reappears at the
same index with different content.

With both paths, a reload after ordinary play projects only the current State. A new Perspective
(new spectator, replacement Player), an evicted or expired list, a logic or record-format change,
or an Undo costs one full projection on the next load.

## Other callers

Sync (`createGameSyncRepresentation`), Undo responses and missing-Action recovery already project
short tails and stay as they are. Host View and hotseat Games do not project and are unaffected.

## Not chosen

- **One blob per Perspective.** An append would read, decompress, extend and recompress the whole
  history for every Perspective inside the Action request.
- **In-process LRU in each backend child.** No network or Redis memory, but an Action warms only
  the instance that ran it, and every replacement (each logic release) empties it.
- **Moving projection to a worker thread.** Stops one load from stalling other requests, but
  spends the same CPU on every load. Could still be added later for the full-projection path.
- **Caching the canonical State at the prefix and going forward.** Forward patches are stripped
  before storage and re-running Actions needs the rules engine and randomness; the backward walk
  from the current State already costs only `M - P` steps.
- **Storing projected history in Firestore.** Adds writes per Action per Perspective and a
  migration story for every logic release.

## Verification plan

- Spec: for a fixture protected Game, the published per-Action records concatenated equal the full
  history projection for each Perspective (Action-time path matches the load path).
- Spec: prefix plus tail equals the full projection at every split, including across Undo and
  Undo-then-new-Actions (ids diverge).
- Spec, real Redis (`projectedHistoryCache.spec.ts`): out-of-order appends, an Undo, an
  undecodable segment, compaction past 32 segments, an append to a missing list and a Redis
  transport failure all fall back to correct output.
- Spec, emulator and Redis (`projectedHistoryLoad.spec.ts`): cold, warm, partial, post-Undo,
  other-logic-version and Redis-down loads equal the uncached projection, with the counters
  showing what was cached; published moves for each Player and the spectator make the next load a
  full hit.
- Production: `projection.response.game` p50/p99 and readiness probe failures before and after;
  timing counters for full hits, partial hits with tail length, and misses; Redis `used_memory`
  after a day.

## Release

Backend only. The Game Clients receive the same response shape, so no UI Artifact needs
republishing. The projector still comes from each title's logic, so the speedups in 7ba235635 reach
a title only when its logic is re-released.
