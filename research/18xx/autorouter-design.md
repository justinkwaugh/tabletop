# Shared client autorouter

## Placement and interface

`@tabletop/18xx-autorouter` owns the independent Rust solver, WASM build, and a
TypeScript interface over existing family models. It depends on `@tabletop/18xx`
and Common, with no title dependencies. Callers supply `TrainRunningState`, a
title's existing `RouteRules`, and the operating company. The result contains an
ordinary `OperatingResult`, completion status and timing/search metrics.

Game state, Actions and state handlers do not change. Loading and running the
solver is a client concern. It neither mutates state nor commits `RunTrains`.
Future UI integration should populate a local route draft through the Game
Session; it is not part of this change. The Rust crate is the maintained solver;
the separate research harness consumes its built artifact.

## Rule evidence and family review

The family route/distance/payment/track-reuse survey is recorded in the external
[domain study](/workspace/research/18xx-2026-09-08/18xx-domain-model-study.md#traits-routes-revenue),
[trait catalog](/workspace/research/18xx-2026-09-08/18xx-trait-catalog.md), and
[full title profiles](/workspace/research/18xx-2026-09-08/data/title-traits.json).
These distinguish TOP's H/+ distance, 1849's weighted gauge crossings,
visit-versus-payment allowances, 1822 sharing groups, 1862 freight sets/track
sharing, 1860 fleet connectivity, 18GB joint revenue, and 1877 Stockholm shared
stop payment. Standard all-stop routing is a supported policy, not a universal
family assumption. Unknown mechanisms need an explicit extension before use.

TOP prototype §§13.2–13.3, pp. 21–22, establishes boundary crossings for H trains;
city/offboard capacity for + trains; paying intermediate/trailing towns; a city
and a second center for + routes; all-stop 7 trains; and unlimited diesels. The
rulebook also requires station inclusion, unblocked continuous track, and forbids
repeated centers and shared track. The source's H-distance helper has a documented
signature defect, so it is not used as a canonical oracle for TOP. The supplied
rulebook and repository evaluator provide that evidence.

Shikoku 1889 §§8.5.1–8.5.3, pp. 21–22, counts every visited center, permits shared
centers across trains with distinct track, allows blocked cities only at ends,
and reserves gray offboard values for diesels. A regular train during the diesel
phase still uses ordinary values. Title-local `RouteRules` already capture the
revenue-stage distinction. Its policy agrees with ordinary 1830 distance rules,
but its revenue stages are supplied by its own definition.

Research code was consulted for definitions and prior benchmarking, not copied
into the implementation. No research adapters, references or fixture data occur
in checked-in implementation or tests. The promoted Rust code was independently
written in the preceding experiment. External benchmarks stay outside the
application and consume the package; their source engine remains unmodified.

## Reuse and extensions

`RouteNetwork` exposes its existing rotated faces. The encoder uses Common-backed
`RailwayMapState.connections` for actual adjacency and impassable borders.
Track-resource identity and revenue-stage selection were extracted into shared
helpers used by both evaluation and encoding. Title train capacity and
`requiresCity` come directly from the existing definitions.

Directed track arcs permit a hex exit to continue only through the matching
neighbor entry, never reverse at an edge. The core compresses corridors between
revenue centers while preserving original path identities, track resources and
crossing counts. Version 2 adds per-train visit costs (including zero for towns or
all stops), crossing capacity, and a city requirement. Token-distance bounds are
computed per train profile; identical profiles still share candidate generation.
Zero-cost visits remain finite because centers and track cannot be reused.
Unlimited capacity receives a proven finite bound from the supplied graph, not a
fixed magic train distance.

Final routes are reconstructed as existing `TrainRoute` data and checked through
`RouteEvaluation`, including an exact revenue comparison. Exhaustiveness refers
to the encoded policy; final validation alone cannot establish completeness.
Tests also enumerate routes independently through the canonical evaluator and
compare with the search optimum. Native tests use a separate permutation oracle.

## Verification

- TOP's actual map: all ten train definitions plus its prepared fleet.
- 1889's actual map: all six train definitions plus its prepared fleet.
- Focused H crossings through track-only hexes; + intermediate/trailing towns;
  mixed fleets; blocked cities/reservations; unlimited trains; staged revenue;
  repeated calls and unchanged input state.
- Native coverage for zero-cost visits, independent city/station requirements,
  explicit edge transitions, resource conflicts, terminal track, bonuses,
  interrupted searches and 200 generated graphs compared with an unpruned oracle.
- The extended core reproduces the exact route connections and revenue of all
  606 previously validated external 1830/1817/1850 problems, after converting
  their numeric-distance encoding to wire version 2. Those fixtures and adapters
  remain outside the repository.
