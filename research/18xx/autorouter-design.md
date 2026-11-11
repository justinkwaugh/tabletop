# Shared client autorouter

The current private wire protocol is **version 7**. All route search and fleet
selection for 1862 run in Rust. TypeScript encodes declared policy and validates
the returned operation, including exact revenue and subsidy agreement. The
sections below retain the development history; the final section describes the
current connected-fleet policy and algorithm.

## Compact candidate storage

Candidate storage preserves the full route-trait survey below: counted visits,
paid stops, route orientation, extension track, and the fleet's longest-route
bonus remain distinct. This changes representation and partner lookup within the
existing encoding; fleet connectivity and track sharing use the separate native
selector described below. TOP, 1889, 1846, and 1817 still
supply their existing rules.

Each candidate records scoring metadata, a resource fingerprint, and an arena
span. Connection and extension-arc IDs share a narrow arena with a checked wide
fallback; resources are recovered from the existing compiled network. Equal
fingerprints require exact resource-set equality before dominance removes a
candidate. Arena compaction recovers cut and duplicate spans without another
arena allocation. Capacity, reallocation peaks, and temporary exact-comparison
storage count against the working budget.

Streaming can use the ordinary selector's resource-column representation for a
bounded prefix of its stored list, with connection-level conflict caching beyond
that prefix. This offsets the CPU cost of reconstructing resource usage while
retaining the first-partner-search and second-pass proof guarantees. Exhaustive
oracles cover mixed profiles, extensions, fleet bonuses, and wide connection IDs;
focused tests force hash collisions, repeated cuts, and partial index coverage.

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
never adds an action or consumes an Undo step. A title that turns on drawn routes
(`TitlePresentation.manualRoutes`, 1862 only) lets the director start from this
run and change it on the map; the drawn run is validated the same way.

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
payment. Those mechanisms now have their own declared fleet policy, described
below. Titles without these features supply no revenue policy or longest-route bonus.

Rust remains the only route search and fleet optimizer. No TypeScript callbacks execute during native search. Train profiles include payment/connection policy
when sharing candidates. Single-train selection considers the longest-route bonus;
resource dominance retains different visit counts when that bonus is active.
Fleet upper bounds include the longest remaining candidate, so pruning cannot
discard a lower-base-revenue route that wins through its fleet bonus. Final routes
are checked by the canonical evaluator, including exact total revenue agreement.
This extension introduced wire version 4; workers and WASM are rebuilt together.

Verification covers the recorded Erie OR 6.2 position ($850), canonical replay of
the full 1846 game, paid-station selection, paid-only connection bonuses, identical
and distinct train profiles, and longest-route bonus assignment. The independent
native permutation oracle now also checks 200 graphs with payment limits,
connection bonuses and fleet bonuses, in addition to their ordinary profiles.

## Exact fleet selection

For ordinary exclusive-track titles, the encoded fleet problem is partitioned
maximum-weight set packing: each route
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

## Two-train streaming

For exactly two distinct candidate profiles, the solver materializes the train
with the smaller distance (then the tighter major-stop limit, then input order)
and streams the other through the stored routes in descending revenue order.
Distance is a heuristic for candidate count, especially across different distance
measures. Choosing the less favorable side affects memory and runtime, not the
completed search's optimum. The stored list retains the existing deduplication and
memory-cut policy, with no reservation for unused compatibility matrices or rows.
Identical profiles and larger fleets retain the previous selection algorithm.

This uses the same route generation and scoring as the full-catalog survey above:
TOP's crossing and zero-cost-town measures, 1889's revenue profiles, and 1846's
paid-stop and longest-route policies remain distinct. Profiles include whether
connection bonuses apply along the route or only at paid stops. Interconnection
extensions use the same encoded alternatives and consume their track during
partner selection. No additional family rules or wire fields are introduced;
this optimization used wire version 6. Declared fleet policies use the separate
selector below; ordinary two-train streaming remains unchanged.

Each streamed route is paired with the best compatible stored route or runs
alone. With no fleet bonus, the first compatible partner in revenue order is
optimal. With a longest-route bonus, suffix maxima bound the remaining partners;
the search can continue past the first compatible one to find a longer partner.
Bounds add the maximum route length's bonus once. Only incumbent improvements
copy the streamed route. Stored routes alone seed the incumbent; the first
partner search finishes even if the deadline passes. Later partner scans and DFS
steps check the same solve deadline. Interruptions and stored-candidate cuts
remain non-exhaustive.

Verification covers both input orders, trains running alone, memory cuts and a
previously memory-limited fixture that now completes, longest-route bounds after
a compatible partner, deterministic interruption during partner selection, the
200-graph permutation oracle, and canonical exhaustive extension tests. Recorded
1817 positions compare both completed and deadline-interrupted results.

## N+s trains, end-only destinations and interconnections

The family route model added three mechanisms that the encoder and native core
now carry, so final `RouteEvaluation` agrees with the solver's revenue. The
extension introduced wire version 5; workers and WASM are rebuilt together.

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

## Declared fleet settlement and native search

The family survey identifies several distinct mechanisms: 1862 shares track,
pays each stop once per company, chains freight, connects runs through large
stations to a home run, and subsidizes Local coverage (§7.4, §7.8); 1860 requires
fleet connectivity; 18GB has joint revenue; 1877 Stockholm shares stop payments;
1825 double-headers combine trains. These examples informed optional traits,
not title-name branches. 1862 is the first consumer. The other titles are not
implemented, and combining trains into a double-header still needs its own
explicit model.

### One policy definition

`RouteRules.fleet` is data (`routes/fleetRules.ts`), consumed by the canonical
family settlement and by the autorouter encoder:

| Trait                                  | Semantics                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sharedTrack`                          | Different trains may share track; each route still cannot reuse its own. Absent means exclusive track.                                                                                                                                                                                                  |
| `payOnce.groups`                       | A center pays at most once per company; centers in a group share payment identity. With no `payOnce`, payment is per route. If profiles offer different values for one identity, the highest selected offer pays. Freight chains between the same two identities share one distance bonus, the highest. |
| `connectivity.at`, `root`              | Runs form a connected intersection graph through stops of the declared kind. `root: 'home'` requires a run through the placed home station.                                                                                                                                                             |
| `routeShape.endKinds`, `minimumCities` | Allowed endpoint kinds and minimum number of cities, independent of train distance.                                                                                                                                                                                                                     |
| `trains[id].payingKinds`               | Which nonfreight visited kinds can pay; absent means all kinds.                                                                                                                                                                                                                                         |
| `trains[id].payingStopLimit`           | Limit a nonfreight route’s paid subset of specified kinds; other payable kinds are unlimited. Visit capacity stays on the train definition.                                                                                                                                                             |
| `trains[id].hexSubsidy`                | Treasury subsidy for distinct visited hexes. Overlapping profiles pay the maximum subsidy per hex once.                                                                                                                                                                                                 |
| `trains[id].freight`                   | `required` runs must form one simple endpoint chain. When any `optional` runs also run, exactly one extends that chain. Remaining optional runs choose their best partition into simple chains, including singletons.                                                                                   |
| `freightChains`                        | Pay the outer ends of each chain and a crow-flies bonus for hexes between them. `endRates` increases the rate at named ends. `offboardDistance: 'adjacent-hex'` measures from the adjacent route hex with one extra hex per off-board end.                                                              |

1862's `routeRules.ts` declares these traits, off-board payment groups, port rates,
and per-depot-train policies. Its remaining functions supply phase revenue,
permits, and train-specific stop access. London access and Local off-board
exclusion are precomputed into each encoded profile's `allowed_stops` array.
No title function executes while Rust searches. The WASM's only imported
function is the deadline clock.

`RouteEvaluation` still validates each individual path, including its company
station, visit capacity, run shape and access. Family `settleFleetRoutes` then
checks connectivity, enumerates freight groupings and paid-stop choices, and
returns the canonical payments, bonuses and subsidy. The encoder reads the same
policy; Rust independently implements its semantics. This deliberately gives
differential tests different settlement algorithms rather than a shared search
oracle. `Autorouter.solve` decodes only the native answer and requires exact
revenue **and** subsidy equality with the canonical evaluator. `RunTrains` pays
the subsidy to the treasury independently of revenue distributed as earnings.

The former `settle`, `routeKey` and `bound` callbacks, `solveFleet`, and
`fleetSolver.ts` are removed. `routeProblemKey` includes the encoded fleet policy
and every train's access and payment policy. The 1862 bot and module worker use
`Autorouter`, like other titles. Worker and WASM must be rebuilt together for
version 7. No state schema or host bridge contract changes in this migration.

### Problem class and exact algorithm

This is weighted maximum coverage under a partition constraint. The fleet takes
one choice for each unit, a unit being a train or a chain of freight trains, and
every payment group, Local hex and pair of chain ends pays its best amount once.
Connectivity through stops of the declared kind is a side constraint, and freight
adds endpoint-path constraints. The problem is NP-hard. Exact branch and bound
with admissible bounds is the appropriate technique; there is no universally
fastest exact algorithm. The bound is the Lagrangian relaxation of the cover,
lowered by subgradient steps, the standard treatment of covering integer
programs.

The native solver (`rust/src/fleet.rs`) works as follows:

1. Enumerate legal individual paths with the existing native compiler and path
   search. Fleet candidates retain stop identities, Local hex coverage, freight
   endpoints and adjacent off-board hexes, and track resources when exclusive.
   Ordinary resource-dominance pruning is inapplicable to fleet coverage and is
   disabled. Trains of one profile share a candidate list.
2. Turn each candidate into choices. A choice is one way to run a unit. Its
   `add` is what no other route could pay instead: every stop and every chain's
   distance bonus when those pay per train. Its `cover` lists an amount for each
   item it pays that another route could pay instead. The items are the payment
   groups, then the hexes, then the pairs of payment groups that chains run
   between, and each pays its best amount once across the fleet. A fleet scores
   the sum of `add` plus that weighted cover: revenue and treasury subsidy
   together, returned as two amounts. A route whose train has a paying-stop
   limit becomes one choice for each way of spending the limit. Within a
   profile, a choice is dropped when another pays at least as much for every
   item, reaches every connecting stop it does, and uses no track it leaves
   free.
3. Split the trains into units in every way the freight policy allows. Each
   split is a pattern. A nonfreight train is a unit of its own. Any of the
   required freight trains run as one chain; when optional ones run beside
   them, exactly one joins that chain at an end, and the other optional ones
   group freely. Patterns are searched in turn, and one whose units' best
   scores cannot beat the incumbent is skipped. Identical trains can take the
   same path: two N/M trains may pay different stops of one route.
4. Chains are costly to build, so a pattern with chains is searched first over
   outlines of them: for two trains, one choice for each pair of ends their
   routes can join between; for more, one choice that scores the most any two
   ends could. An outline scores at least what the chains it stands for do.
   Only when a fleet of outlines could beat the incumbent are the chains built.
   A chain grows from one end, never returns to a stop it has joined at, and
   is rejected when its routes would share track they may not. Chains are
   pruned by the same dominance rule. Under `payOnce` a chain's distance bonus
   is a cover item, the pair of its ends' payment groups, so chains between the
   same two identities pay the best bonus once. Without `payOnce` the bonus is
   part of `add`.
5. Search a pattern depth first, one choice for each unit. The cover is
   submodular: a choice's gain over the choices already taken only falls as
   more are taken. Each depth therefore keeps, for each class of unit, the
   choices that could still be part of a better fleet with their gains then,
   best first, and deeper levels look only at those. A branch is cut when the
   value taken plus the best remaining gain of every later unit cannot beat the
   incumbent. Counting every item in full for every unit would put that bound
   far above any fleet, since units that would pay the same stop all count it.
   Each item's amount is therefore capped at a multiplier per choice, with the
   rest held once for the whole fleet, and 60 subgradient rounds lower the bound
   before the walk. Units of one class take their choices in order, so
   interchangeable trains are not permuted. Idling a train is branched on only
   where trains exclude each other's track or no choice of the unit is worth
   taking.
6. Judge connectivity when a fleet is complete. Routes are nodes, joined where
   they share a stop of the connecting kind. Each component, holding the root
   when one is required, is offered as a fleet, so a partial fleet is a
   complete legal answer. A chain only partly inside a component is dropped
   whole; the pattern that splits it keeps the routes that are inside. The
   bound ignores connectivity, which can only overstate, so the search stays
   complete.
7. A deadline or the memory budget can cut the search short. The search valued
   its fleet under the paid stops and the chain grouping it came to, while
   canonical settlement chooses both afresh for the routes it is given, so the
   same routes can be worth more than the search reported. The returned routes,
   at most one for each train, are therefore searched again alone and to the
   end. The reported revenue and subsidy then equal the canonical settlement of
   those routes, which `Autorouter.solve` requires.

Limits remain explicit. Path storage and the fleet stage share the existing
memory budget; the fleet stage takes an even share for each profile from what
the candidates leave. Chain building stops at four million steps or when the
chains outgrow the memory left. Any of these cuts, a candidate cut or the
deadline makes the result non-exhaustive. Ordinary additive titles retain the existing set-packing
and two-train-streaming selectors. Fleet policies cannot yet combine with legacy
connection/interconnection or longest-route bonuses, or required-route
enumeration; unsupported combinations are rejected explicitly.

### Regression evidence

The saved WStI position has five BL, one BF, two AL and two AF trains. The old
train-by-train TypeScript search evaluated only leaves, visited routes before
idling, and applied connectivity only at settlement. It returned £0 with 150 ms,
2 s and 20 s budgets despite a legal £140 singleton. The native search offers
the connected part of every fleet it completes, so its first complete fleet is
already a legal incumbent. Measurements and outstanding proof costs are recorded
in [the 1862 design note](1862-title-design.md#native-autorouter-verification).

Coverage includes the rulebook's route examples through WASM, the saved WStI
regression, generated-map comparisons against canonical TypeScript evaluation,
and a native oracle that independently enumerates stop permutations, per-train
route products including idling, paid subsets and freight chain orders. Native
cases include 160 generated fleet graphs, sparse networks dominated by
unconnected combinations, connected and disconnected six-, eight- and ten-train
fleets, repeated N/M paths, permanent repeats, anchors, cycles, off-board distance,
port rates, subsidies, run shapes, access, memory cuts and deadlines. Two
freights between the same two places are checked with and without `payOnce`.
An opt-in run (`FLEET_CASES=3000`) compares 3,000 larger generated fleets with
chains and shared stops against the oracle; the same-two-ends bonus decides the
answer in 154 of them. A unit test cuts a search short on hand-built candidates
whose routes pay more at other stops, and requires the canonically settled
value.

Recorded play is the second check. 100 finished 1862 games from 18xx.games give
5,263 runs with fleets of up to seven trains. Each was replayed in the research
engine, set up on our board and solved with a 5 s cap. All 5,232 positions that
set up are proved optimal, the slowest in 156 ms, and none pays less than the
run the players recorded. The first native solver, a seeded connected expansion
with matching for paid stops, left 610 of them at the cap. The other 31 runs are
one game whose board cannot be set up: the research engine counts its
small-station variants of tile 16 apart from the tile. The games, tools and
results are outside the repository at `/workspace/tmp/autorouter-bench/`.

All 1,434 recorded ordinary-title problems (1817, 1830, 1832, 1846, 1889 and TOP)
completed exhaustively with identical route output and revenue before and after
this change. The fixture corpus and timing scripts remain outside the repository
at `/workspace/tmp/1862-autorouter/`; the WStI state is a checked-in regression.
