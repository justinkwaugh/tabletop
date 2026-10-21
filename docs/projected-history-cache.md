# Projected history cache (proposal)

Status: design agreed on 2026-10-21 (Redis, segmented entries); not built.

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

One Redis list per Game, Perspective and title logic version, keyed in `gameCacheKeys.ts` alongside
the existing Game keys:

```
projected-history-<gameId>:<perspectiveKey>:<logicVersion>
perspectiveKey = player:<playerId> | spectator
```

Each list element is one gzipped segment:

```ts
interface ProjectedHistorySegment {
    startIndex: number // canonical index of the first record
    actionIds: string[] // canonical Action ids, in order
    actions: GameAction[] // projected records for those Actions
}
```

Every list carries a 24-hour TTL, refreshed on each read and append. Production Redis is Redis
Cloud, 250 MB, `volatile-lru`, so these keys are eviction candidates and, being large and idle,
are the ones LRU drops first; an evicted list only costs one full projection. Measured size per
Perspective for long games: Reef Encounter 324 KB JSON (28 KB gzipped), Sol 762 KB (68 KB), Fresh
Fish 280 KB (23 KB). With five Perspectives per four-player Game, the 58 protected Games active on
2026-10-21 come to about 15 MB, and all 148 started Games to about 40 MB.

Segments make an append independent of history length: after an Action, each Perspective gains one
small segment with `RPUSH`, without reading, decompressing or recompressing the rest.

The cache holds derived data only. It is validated against the consistent read on every use, so it
takes no write markers and is outside the cache-coherence contract: a stale, reordered, partial or
evicted list costs projection work and never produces a wrong history.

## Full load

1. Read Game, State and Actions through `readGameData` exactly as today (the consistent read).
2. `LRANGE` the Perspective's list and decompress it. Walk the segments in order, accepting records
   while each segment starts at the next expected index and its ids equal the canonical Action ids
   at those indices. Stop at the first mismatch. `P` is the number of records accepted.
3. Project only `actions.slice(P)` with `startIndex: P`. The walk back covers `M - P` Actions, and
   the result includes the projected current State.
4. Respond with the accepted records plus the tail.
5. Repair the list after responding:
    - all segments accepted and a non-empty tail: `RPUSH` the tail as one segment;
    - a mismatch (Undo, reordered or lost append) or more than 32 segments: replace the list with
      one segment holding all `M` records (`MULTI`: `DEL`, `RPUSH`, `EXPIRE`).

A Redis transport failure in step 2 is a miss (`P = 0`); a failure in step 5 is logged and ignored.
Neither fails the request.

## Action time

After `publishActionResults` has projected and published the new transitions for a Perspective,
`RPUSHX` one segment `{ startIndex: priorState.actionCount, actionIds, actions }` with the
published records and refresh the TTL. `RPUSHX` only appends to an existing list, so the cache never
holds a list that starts mid-history. The append runs after publication, and its failure is logged,
never surfaced to the Action.

Concurrent Actions on one Game commit in order, but their appends can arrive out of order; the
index check in step 2 rejects the misplaced segment and the next load rewrites the list.

Undo appends nothing. The next load sees the removed Action ids no longer match and rewrites the
list.

With both paths, a reload after ordinary play projects only the current State. A new Perspective
(new spectator, replacement Player), an evicted or expired list, a logic release or an Undo costs
one full projection on the next load.

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
- Spec, real Redis: out-of-order appends, a list from another logic version, a mismatched id, an
  evicted list and a Redis transport failure all fall back to correct output.
- Production: `projection.response.game` p50/p99 and readiness probe failures before and after;
  timing counters for full hits, partial hits with tail length, and misses; Redis `used_memory`
  after a day.

## Release

Backend only. The Game Clients receive the same response shape, so no UI Artifact needs
republishing. The projector still comes from each title's logic, so the speedups in 7ba235635 reach
a title only when its logic is re-released.
