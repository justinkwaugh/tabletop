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
const { result, exhaustive, metrics } = router.solve(
    state,
    TheOldPrinceRouteRules,
    companyId,
    { timeLimitMs: 30_000 }
)
```

Pass `Shikoku1889RouteRules` for 1889. The company must be in its running-trains
step. `result.routes` are ordinary `TrainRoute` inputs with evaluated visits,
payments and distances. They can populate a local route draft; submitting the
operation remains the Game Session's responsibility.

`create` also accepts a compiled `WebAssembly.Module`. Instances can be reused.
`solve` is synchronous; run it in a Web Worker to keep longer searches off the UI
thread. Import the title's rules inside that worker and send it the state data.

`exhaustive` means the encoded search finished. If the time limit interrupts
candidate generation or fleet selection, the best found legal operation is
returned with `exhaustive: false`. The limit applies separately to each search
stage and is checked periodically; it is not a hard wall-clock deadline. Metrics
separate encoding, solving, final validation and the Rust search stages.

## Rules supported by the repository encoder

- TOP: 2H–6H boundary-crossing capacity, 2+–4+ city/offboard capacity with paying
  intermediate and trailing towns, the required city, seven-stop trains,
  unlimited diesels, and phase revenue values.
- Shikoku 1889: all-stop capacity, unlimited diesels, and diesel-only gray offboard
  values. A 6-train still uses ordinary offboard values during the diesel phase.
- Both: station inclusion, continuous track, no edge reversal or track/border
  reuse within or between routes, no repeated revenue center, blocked cities at
  endpoints only, and terminal offboards. Station reservations do not block runs.

These mechanisms come from `RouteRules`, `TrainDefinition`, `RouteNetwork` and
station state. The encoder does not maintain a second title configuration.
The native core additionally supports exclusive stop groups and additive
traversal/first-stop bonuses. Those mechanisms have no consumer in these two
titles' current repository models and are not invented as title policies here.

The internal wire format is version 2. It is private to this package; callers use
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
