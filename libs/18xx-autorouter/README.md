# @tabletop/18xx-autorouter

Client-side route optimization for the shared 18xx models. The Rust core runs in
WebAssembly; the TypeScript interface encodes a company's map and fleet, solves,
and checks the returned routes with `RouteEvaluation`. It returns an
`OperatingResult` without mutating state or submitting an Action.

The package depends on Common and the 18xx family package. Game definitions are
supplied by the caller. Neither the solver nor its dependencies import a title.

## Use

Build the package, then load the exported WASM asset once in the client. With Vite:

```ts
import { Autorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { TheOldPrinceRouteRules } from '@tabletop/the-old-prince'

const response = await fetch(solverUrl)
const router = await Autorouter.create(await response.arrayBuffer())
const { result, exhaustive, metrics } = router.solve(state, TheOldPrinceRouteRules, companyId, {
    timeLimitMs: 30_000
})
```

Pass `Shikoku1889RouteRules` for 1889. The company must be in its running-trains
step. `result.routes` are ordinary `TrainRoute` inputs with evaluated visits,
payments and distances. They can populate a local route draft; submitting the
operation remains the Game Session's responsibility.

`create` also accepts a compiled `WebAssembly.Module`. Instances can be reused.
`solve` is synchronous; run it in a Web Worker to keep longer searches off the UI
thread. Import the title's rules inside that worker and send it the state data.

`exhaustive` means the encoded search finished. One time limit covers the whole
search. With exactly two distinct train profiles, the solver stores the
shorter-distance train's routes, sorted by revenue, then streams the other's
routes through a partner search. A tighter major-stop limit breaks distance ties;
input order breaks remaining ties. This is a candidate-count heuristic, including
when the trains use different distance measures; the choice does not affect
exactness. The stored profile gets half the remaining time, and streaming gets
the rest, including time the first train did not use. Only an improving streamed
route is copied. Either train may run alone. Resource bitsets include extension
track, and bounds account for the longest-route bonus once for the fleet.

Identical-profile pairs and fleets of three or more keep candidate enumeration
followed by branch-and-bound selection: enumeration may use three quarters of
the deadline, shared between distinct profiles, and selection the rest. Selection
always completes its first descent; streaming similarly completes its first
partner search and starts with the best stored route alone. An interrupted search
returns the best legal operation found with `exhaustive: false`. The limit is
checked periodically; it is not a hard wall-clock deadline.

The solver also limits the memory its compiled track paths, candidates and
selection tables use to 40 MiB. Compilation stops at a quarter of it. Ordinary
fleet selection reserves another quarter for cached compatibility rows; streaming
needs no such rows or resource-to-candidate matrix, so its stored profile can use
the remaining budget. A train whose candidates reach their share first discards
duplicates; if the remainder still exceeds half its budget, it keeps the most
valuable half. Cutting candidates or compiled connections is reported with
`metrics.memoryLimited` and `exhaustive: false`. Streaming alone does not make a
completed enumeration non-exhaustive.

A two-train fleet cut for memory, with time left, is solved again exactly above
what its first answer proves. A better pair needs a route worth more than half
the first answer when the trains are alike, or a stored route worth more than the
first answer less the other train's best route (known once its streaming pass
finished). Only those routes are stored, and every route of the other train is
streamed through them; route values include the longest-route bonus, so the
bound holds with it. When that pass completes, the result is exhaustive and not
memory-limited; if it is cut or interrupted, the first answer stands.
The WebAssembly instance is built with a 64 MiB memory maximum, so an
allocation beyond it traps instead of growing the tab. WebAssembly memory never
shrinks, so after a solve that left the instance above 32 MiB, or one that
failed, the `Autorouter` replaces its instance. Either way
an interrupted search returns the best legal operation found. Metrics separate
encoding, solving, final validation and the Rust search stages, and report the
instance's memory after the solve. In streaming mode, path-search time includes
partner searches performed during enumeration; combination time excludes those
searches. Candidate counts still count enumerated routes, including those
discarded immediately by streaming.

## Rules supported by the repository encoder

- TOP: 2H–6H boundary-crossing capacity, 2+–4+ city/offboard capacity with paying
  intermediate and trailing towns, the required city, seven-stop trains,
  unlimited diesels, and phase revenue values.
- Shikoku 1889: all-stop capacity, unlimited diesels, and diesel-only gray offboard
  values. A 6-train still uses ordinary offboard values during the diesel phase.
- 1846: express visit/payment limits with a paid company station, connection
  bonuses on paid stops, and a per-stop bonus on the fleet's longest route.
- N+s trains (`extraTowns`): at most N+s stops, of which at most N are not towns.
  Only revenue-center trains may carry extra towns.
- Revenue policies chosen from the state and operating company, and connection
  bonuses whose destination pays only at a route's first or last stop
  (`destinationAtEnd`).
- Interconnections: a route may continue past its counted stops on track of its
  own, through any stops except an offboard, to a destination location, and earns
  the best interconnection from one of its paid stops. The solver may reverse a
  route so the extension leaves either end. It tries only the shortest extension
  (fewest paths) from each end of each route to each destination location, over
  track the route does not use; it skips one that would reuse its own track or
  revisit a junction between stops, and never tries a longer extension that would
  leave track free for another train. `exhaustive` covers this encoding only.
- All: station inclusion, continuous track, no edge reversal or track/border
  reuse within or between routes, no repeated revenue center or repeated junction
  between consecutive stops, blocked cities at endpoints only, and terminal offboards. Station reservations do not block runs.

These mechanisms come from `RouteRules`, `TrainDefinition`, `RouteNetwork` and
station state. The encoder does not maintain a second title configuration.
Map locations that share a `stopGroup` (1830's Canada) are encoded as the native
core's exclusive stop groups, so a route visits one of them. The core's additive
traversal/first-stop bonuses have no consumer in the current repository models and
are not invented as title policies here.

The internal wire format is version 6. It is private to this package; callers use
the shared game models. Other distance, gauge, payment-selection or fleet-coupled
rules need explicit encoding support before another title can use this solver.
See the [design review](../../research/18xx/autorouter-design.md).

## Build and verification

Install Rust through rustup. The pinned compiler, rustfmt, clippy and
`wasm32-unknown-unknown` target are declared in `rust/rust-toolchain.toml`.
From the workspace root:

```sh
pnpm install
pnpm --filter @tabletop/18xx build
pnpm --filter @tabletop/18xx-autorouter build
pnpm --filter @tabletop/18xx-autorouter test
pnpm --filter @tabletop/the-old-prince test
pnpm --filter @tabletop/shikoku-1889 test
```

Run `cargo test --locked` and `cargo clippy --all-targets -- -D warnings` from
`rust/` for native correctness checks. `cargo build --release --locked` also
builds a native executable that reads an encoded problem on stdin and writes a
solution as JSON. The WASM asset and build fingerprint are generated under
`esm/`; Rust build products are ignored. `CARGO_BIN` selects an alternate Cargo
executable and `CARGO_TARGET_DIR` selects a build-output directory.

Tests exercise the public interface, compare with exhaustive enumeration on
small maps, and use both titles' actual maps and every train definition. The
native suite includes a separate unpruned permutation oracle. Build the package
before running title tests so they use the current WASM artifact.
