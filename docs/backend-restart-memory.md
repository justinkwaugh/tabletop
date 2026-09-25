# Backend restart memory

Before the supervised handoff, the backend's manifest-triggered restart rebuilt
Fastify inside the existing Node process. The production incident on 2026-09-24 killed that process for exceeding
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

## Supervised process replacement

`apps/backend/src/main.ts` now runs a small supervisor and a stable HTTP listener.
It imports no application services, game definitions or validators. The complete
Fastify application runs in `worker.ts`, a child process listening on an ephemeral
loopback port. Production backend ingress remains HTTP/2; tasks and local ingress
remain HTTP/1. Both stream requests to the child over HTTP/1, preserving request
bodies, authorization, cookies, status codes and streaming responses. The parent
sets the forwarded client address; the child trusts only its loopback proxy.

On a manifest mismatch, the child sends an IPC reload notification. The supervisor
starts a replacement while the current child continues serving. Only after the
replacement finishes Fastify registration, loads game definitions and starts
listening does the parent switch new requests to it. Game loading failures now
fail startup instead of silently creating a server without game routes.

Requests already assigned to the old child retain it until their upstream
connections close, including uploads still being forwarded. A downstream client
disconnecting after uploading its request does not cancel backend work: the proxy
consumes the eventual response without forwarding it. Incomplete uploads and
disconnected SSE streams still release their upstream sockets.

When the proxy has drained, the child receives SIGTERM. A Fastify pre-close hook
waits for running route-handler promises, including handlers whose clients have
disconnected or whose responses were sent early. Only then does Fastify close its
owned resources and the process exit. Handler success and rejection both release
the work reference; detached work that a handler does not await is outside this
contract. A 30-second drain deadline bounds long-running
requests and SSE streams; at that deadline the supervisor kills the child. Stream
clients must reconnect. Killing a child releases its whole heap and ESM cache.
Requests interrupted by a crash or the drain deadline are never replayed by the
proxy, because doing so could duplicate a mutation.

Only one replacement runs at a time, including the old child's drain and exit.
Reloads arriving during a replacement are coalesced into one pending replacement.
Signals from an already-retired child are ignored. There are at most two backend
children, plus the lightweight parent. The overlap shares the container's existing
memory limit; this bounds version accumulation, not peak memory for two heaps.

Failed startup leaves the existing child serving and retries after 30 seconds.
Startup is bounded to 120 seconds. A serving-child crash also triggers replacement;
requests receive 503 while no child is ready, and a broken upstream request receives
502. Initial startup failure exits the container instead of exposing an empty app.
Container SIGTERM closes ingress and all children with an eight-second deadline,
inside Cloud Run's ten-second shutdown window. Children also exit if parent IPC
is disconnected.

Cloud Run request-based CPU allocation can throttle replacement work while the
instance has no active requests. This is not a new Cloud Run instance startup and
does not get startup CPU boost. Background replacement/retry timing requires
instance-based CPU allocation if it must progress predictably while idle. With
request-based allocation, traffic supplies CPU and the old backend keeps serving
during replacement. No Cloud Run resource or billing setting is changed here.

A game-only worker would require moving all version-owned imports, including
schemas and route registration, into its isolate. The complete-backend child
avoids introducing a separate message protocol for game actions and projections.

## Handoff verification

The runtime regression suite forks real child processes and uses real TCP/HTTP
connections. It covers overlapping startup, completing old requests and uploads,
startup failure and retry, startup timeout, repeated invalidations, an open SSE
stream, an unexpected child crash, shutdown during startup, and HTTP/2 session
reuse across handoff. Real Fastify child fixtures additionally cover interrupted
clients, handler errors, early responses and drain deadlines. Missing Host headers
receive 400; synchronous proxy-construction failures receive 502 and release their
request reference. Neither can terminate the public listener. Repeated replacements check that retired PIDs cease to exist
and that at most two children are alive. These are lifecycle checks, not a full
production load or container peak-memory measurement.

Run from the repository root:

```sh
pnpm --filter @tabletop/backend build
pnpm exec vitest run --project @tabletop/backend apps/backend/src/runtime/backendSupervisor.spec.ts
```

The public listener logs its ready address once. Each successful handoff logs
`Backend ready; routing requests to port ...`; each child uses a different PID and
port. A backend release updates both backend and tasks entrypoints. No game UI
Artifact needs republishing for process replacement alone.

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
