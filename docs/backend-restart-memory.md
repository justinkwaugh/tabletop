# Backend restart memory

The backend's manifest-triggered restart rebuilds Fastify inside the existing Node
process. The production incident on 2026-09-24 killed that process for exceeding
its 512 MiB container limit immediately after a manifest mismatch. Local probes
identified two sources of retained memory; they do not establish the exact
allocation breakdown at the production OOM.

## Resource ownership

The services plugin creates a Redis client, two cache pools, and, when Ably is
disabled, a Redis subscriber connection. Each now has a shutdown hook registered
when it is created. Fastify closes these resources after draining the old
application. The subscriber releases its subscriber references and its duplicate
connection; it does not own the shared publisher connection.

The restart regression test exercises the actual services plugin, restart wrapper,
Redis clients and active pools against a local TCP handshake stub. Other service
factories are stubbed. It covers both Ably and Redis pub/sub, repeated replacement,
and final shutdown. Before the fix, the first replacement left the old connection
open; now each replacement retains only its own connections and shutdown leaves
none.

With forced garbage collection after every restart, the isolated services probe's
heap grew from 17.76 to 27.50 MiB over 30 restarts before cleanup. With the production
cleanup hooks, it measured 17.77 to 18.84 MiB, with one main Redis connection across
restarts and zero after shutdown. These figures include the local test harness;
they are not measurements of a complete production instance.

## Validator source retention

The pinned patch in `patches/typebox@1.0.79.patch` changes only how TypeBox joins
generated validator source. Its template literal retained a tree of concatenated
strings through `Validator.code`. Joining the same pieces into one flat string
lets V8 collect those construction trees. It does not disable validation, defer
validation, change schemas, or change generated JavaScript.

The Old Prince's 63 eagerly compiled validators have identical source lengths
and SHA-256 hashes before and after this change. Its actual logic bundle's steady
retained heap per additional artifact URL fell from **8.65 to 5.91 MiB (32%)** on
Node 22.23.3, matching production's Node major version, and from **6.62 to 3.86 MiB
(42%)** on Node 24.21.0. The patch is independent of title rules and applies to every title
using this TypeBox version. Keep the patch version-pinned and recheck behavior and
memory when upgrading TypeBox. The pruned backend Docker build context includes
the patch before dependency installation.

Reproduce the bundle measurement from the repository root with Node 22:

```sh
pnpm --filter @tabletop/the-old-prince run bundle
node --expose-gc tools/deploy/scripts/measure-game-memory.mjs \
  games/the-old-prince/bundle/index.js --max-retained-mib=7
```

The benchmark copies the self-contained artifact to six distinct module URLs,
imports them without keeping caller references, and forces GC between samples.
It excludes the first three imports from the per-version calculation to reduce
warmup effects. It reports raw heap, external, array-buffer and RSS measurements.
The optional 7 MiB threshold fails on the old artifact and passes on the patched
one under Node 22. Use 5 MiB for the equivalent Node 24 check; absolute heap
measurements are engine-version-dependent.
RSS includes allocator reservations and must not be treated as retained heap.

## Process replacement versus worker isolation

These changes reduce memory use but do not evict older ES modules. A Fastify
restart still shares the process's module cache. A complete process replacement
would reclaim that cache, the old validators and all remaining process resources.
It is the smaller next lifecycle change for this 512 MiB service. It must finish
the invalidation response, stop accepting new work, and drain pending requests
before exit; deployment verification must tolerate replacement startup.

A worker architecture could keep the HTTP server alive while terminating the
worker that owns the old logic. To reclaim modules, *all* version-owned imports
must live in that worker. The current host imports definitions to register action
schemas and handlers and retains runtimes in services, so moving only action
execution into a worker would not solve retention. It requires a message interface
for initialization, action processing, projections and returned state/errors,
plus request draining and budgeting for overlapping old/new workers. Workers share
the same container memory limit.

Process replacement is the recommended next step. Worker isolation remains an
option if keeping the HTTP host alive during logic updates justifies that larger
boundary change. Neither lifecycle change is implemented here, and these local
measurements do not prove that the production OOM is eliminated.

## Validation and release scope

- Backend and backend-services builds pass; changed production files and the
  restart regression pass lint.
- Common, 18xx, TOP, 1889, backend-services and backend suites: 836 passing tests;
  149 Redis/Firestore integration cases skipped because their services were not
  configured. The new socket lifecycle tests run without those services.
- All 63 generated TOP validator sources are unchanged; the rebuilt bundle passes
  the retained-memory threshold.

Redis cleanup requires a backend release (including its tasks service). The
dependency patch reaches server-loaded game logic only when that game's Logic
and matching UI Artifacts are rebuilt and republished. Existing immutable game
artifacts retain their old validators. No action/state schema, game rule or host
bridge contract changed. No production deployment is part of this change.
