# Shared client autorouter

## Placement and interface

`@tabletop/18xx-autorouter` owns the independent Rust solver, WASM build, and a
TypeScript interface over existing family models. It depends on `@tabletop/18xx`
and Common, with no title dependencies. Callers supply `TrainRunningState`, a
title's existing `RouteRules`, and the operating company. The result contains an
ordinary `OperatingResult`, completion status and timing/search metrics.

Game state, Actions and state handlers do not change. Loading and running the
solver is a client concern. It neither mutates state nor commits `RunTrains`.
The table UI keeps automatic routes as a local preview in the Game Session
until the player submits Run trains. The Rust crate is the maintained solver;
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

## Table integration

The existing family survey above also governs the worker protocol, action panel,
and map preview. Route and fleet restrictions remain in title-provided
RouteRules; the UI does not assume equal train distance, revenue per stop,
a nonempty fleet, or that every owned train can run. The action panel lists all
owned trains, including unused trains with zero revenue, and pairs their incomes
with the same colors as the map paths. More specialized routing policies in the
survey remain unsupported by the solver until encoded explicitly.

Each title owns a module-worker entry that supplies its rules. The shared
autorouter serves a canonical state snapshot and company ID, returning an
evaluated fleet with completion status. No title dependency enters a shared
package. Vite and the UI Artifact Rollup build both package the worker and WASM;
Rollup's shared module-worker plugin emits entry chunks and referenced assets.

The RunningTrains panel starts a worker only for a live actionable state and
terminates it on state transition, history navigation, teardown, or completion.
An in-flight response must still belong to the same state before the session
revalidates it through RouteEvaluation and exposes the preview. Only the session's
Run trains method submits the ordinary RunTrains Action. Automatic calculation
never adds an action or consumes an Undo step. The manual route editor remains
available only in the separate logic workbench.

Verification includes real browser workers for both titles, map/panel revenue
agreement, commit and Undo, abandoning an in-flight calculation, and execution of
the packaged worker with its emitted WASM. Time-limited results are labeled;
this integration does not claim that a nonexhaustive search found the optimum.

## Native non-additive revenue

1846 adds a revenue policy shared by the canonical evaluator and the encoder:
maximum paying stops, whether the paid subset must include a company station,
and bonuses for paid connections between two location sets. Bonuses choose the
highest-value paid location on each side, and pay only when both sides occur.
The native search enumerates paid subsets independently of visit capacity and
maximizes payments plus connection bonuses. Ordinary trains retain their additive
fast path. Company state supplies the longest-route bonus per visited stop; 1846
uses this for Mail Contract ownership. Fleet selection pays it once, not per train.

This follows the full-catalog visit/payment and fleet survey above. Express payment
limits are distinct from train distance (1846, 1825, 1858), and 1846's longest-route
bonus is distinct from 1862 service groups, 1860 fleet connectivity and shared-stop
payment. Those latter mechanisms are not claimed as supported. Titles without
these features supply no revenue policy or longest-route bonus.

Rust remains the only route search and fleet optimizer. No TypeScript callbacks execute during native search. Train profiles include payment/connection policy
when sharing candidates. Single-train selection considers the longest-route bonus;
resource dominance retains different visit counts when that bonus is active.
Fleet upper bounds include the longest remaining candidate, so pruning cannot
discard a lower-base-revenue route that wins through its fleet bonus. Final routes
are checked by the canonical evaluator, including exact total revenue agreement.
The private wire protocol is version 4; workers and WASM are rebuilt together.

Verification covers the recorded Erie OR 6.2 position ($850), canonical replay of
the full 1846 game, paid-station selection, paid-only connection bonuses, identical
and distinct train profiles, and longest-route bonus assignment. The independent
native permutation oracle now also checks 200 graphs with payment limits,
connection bonuses and fleet bonuses, in addition to their ordinary profiles.

## Exact fleet selection

The encoded fleet problem is partitioned maximum-weight set packing: each route
consumes track resources and one train slot. Equivalently, legal fleets are
cliques in a graph joining disjoint routes of different trains. Exact
branch-and-bound with bitset intersections and weighted independent-set bounds
is a practical algorithm family for this problem; see
[the independent-set-cover approach to maximum weighted clique](https://doi.org/10.1016/j.cor.2019.05.017).
There is no universally fastest algorithm for this NP-hard problem.

Selection indexes candidates by resource once. A candidate's compatibility row
is then the complement of the union of its resource indexes, computed on first
use and cached. Rows contain only the remaining train profiles. Each search depth
reuses its own available-candidate bitset, intersects it with the cached row, and
records the first occupied word for each profile. Conflict checks no longer scan
every route's resources on every visit to a branch.

Profiles are ordered by descending maximum revenue, then candidate count, with
stable input order breaking ties. A branch's upper bound sums the best remaining
candidate revenues for the remaining train slots, ignoring conflicts between
those candidates. This is an admissible weighted independent-set bound because a
train can select at most one route. Identical profiles share a domain; their bound
uses the best distinct candidates, and their choices have increasing candidate
indices. Any feasible assignment of identical trains can be permuted into this
order. Skipping a profile therefore skips its remaining identical train slots.
Original train identities and output ordering are restored when emitting routes.

The longest-route bonus remains a fleet maximum. Bounds include the greatest
possible remaining visit count, using precomputed suffix maxima in revenue order;
they never assume that the highest-revenue route is also the longest. The loop
over a profile reuses the bound for later profiles, taking the maximum visit
count across both parts before adding the bonus once. These bounds may
overestimate, but cannot discard a better fleet. Fixed ordering, bit iteration,
and strict incumbent improvement keep completed searches deterministic.
Deadline checks retain the existing
nonexhaustive-result contract. The wire format and TypeScript interface are
unchanged.

This changes selection procedure only. The full route-trait survey above still
governs the supported policy: TOP's H/+ distances, 1889's ordinary/diesel revenue,
and 1846's payment selection and longest-route bonus all produce the same candidate
data as before. Track sharing, repeated-stop payment, or connected service sets
in 1862, 1877 Stockholm, 1860 and 18GB would require a different encoded policy;
the compatibility graph does not add support for those mechanisms.

Verification adds mixed fleets with nonadjacent identical profiles, candidate and
resource sets crossing multiple bitset words, and a longest-route bonus that
outweighs higher-base-revenue routes. A large-bonus case checks that the bound
does not overflow by counting the fleet bonus twice. The recorded six-title corpus
provides an additional differential check against the preserved native executable; benchmark
inputs and generated measurements remain outside the repository.

## N+s trains, end-only destinations and interconnections

The family route model added three mechanisms that the encoder and native core
now carry, so final `RouteEvaluation` agrees with the solver's revenue. The
private wire protocol is version 5; workers and WASM are rebuilt together.

An N+s train (`TrainDistance.extraTowns`) keeps its single visit budget at N+s
and gains a second budget, `major_limit`, of N stops that are not towns. Stops
carry a town flag and their map location. Only revenue-center trains may carry
extra towns; the encoder rejects other measures rather than guessing what an
H or + train with extra towns would mean.

`RouteRules.revenuePolicy` receives the state and the operating company. A
connection bonus with `destinationAtEnd` is encoded with `ends_only`: its
destination side counts only for a paid stop that is the route's first or last
visit. The ends are the counted route's, not an extension's.

An interconnection pays a route that extends, beyond its counted stops and on
track of its own, from one end to a destination location. The extension passes
through any stops, blocked cities included, without counting them, but not
through an offboard; its track belongs to the route for fleet disjointness. For
each candidate route of a train whose policy has interconnections and whose stops
include an origin, the native search runs a breadth-first search over directed
track arcs from each end, avoiding the route's track. The first simple arrival at
each destination location, the fewest paths, becomes an extra candidate with the
best interconnection its paid stops earn, chosen together with the express paid
subset. An extension off the route's start reverses the route so that
`TrainRoute.extension` follows its last stop. A candidate is offered only when the
interconnection raises the paid revenue, which also guarantees that the canonical
evaluator's paid-subset choice earns it; an extension that earns nothing is invalid.

This is a deliberate limit. The breadth-first search relaxes the extension's own
track reuse and junction rule, checks them on the found path, and tries later
arrivals at that location only when the first is not simple. A longer extension
that leaves the shortest one's track to another train is never tried, so a fleet
that needs one is missed even when the search reports `exhaustive`; that flag
covers the encoded policy. Constrained shortest paths over all disjoint
alternatives would multiply candidate generation for one title's bonus.

Verification compares the solver with exhaustive canonical enumeration, extended
to enumerate every extension, for N+s limits, end-only destinations, an extension
through a blocked city, and two-train fleets where the best extension hangs off a
route's start and must stay clear of another train's track. The native suite adds
the second budget and end-only destinations to the 200-graph permutation oracle.
