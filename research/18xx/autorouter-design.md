# Shared client autorouter

The current private wire protocol is **version 12**. All route search and fleet
selection for 1862 and 1860 run in Rust. TypeScript encodes declared policy and
validates the returned operation, including exact revenue and subsidy agreement.
The sections below retain the development history; the last sections describe
the current connected-fleet policy and algorithm, the passing rules 1860 adds,
the route bound, fleet outline and pair search that 18USA's last phase needed,
and the limits on routes into a stop group that its Mexico needs.

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
(`TitlePresentation.manualRoutes`) lets the director start from this run and change
it on the map; the drawn run is validated the same way. Those titles draw for rule
reasons of their own: 1822 chooses among its best runs, or runs for less where
mail income rises (§5.13.6); an 1860 or 1862 director need not run for the most,
though a receiver (and 1860 under nationalisation) must. Their `drawnRunsEarnMost`
keeps deciding what a drawn run must reach.

The run step searches for 5 s (`RunStepTimeLimitMs`). Where that search ends without
proving its best run, as in some 18USA phase-8 fleets, any title's director may draw,
held to earning at least the best run found: the most-earnings rule (18USA §12.4,
and the titles that require it) cannot be enforced past what the search proved. A
drawn run that beats the best found shows that the search stopped short. This covers
companies run for the most by rule, such as those in receivership. A proved best
leaves nothing to draw. A stop group's limit on routes (18USA's two routes to
Mexico) is held inside the one search, so its proof is the search's own.

Verification: `routesModule.svelte.spec.ts` (no drawing after a proved search; drawing
after an unproved one, refused below and accepted at the best found; title rules kept
when the search stopped short), `autorouter.spec.ts` (a stop-group limit held and
proved in one search), and the 18USA harness's Phase 8 run (two 8-trains not proved in
5 s) beside its Pullman run (proved at once).

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

## Passed stops, halts, hex reentry and blocked passes

1860 (Railways on the Isle of Wight) adds five route rules to the family, each a
`RouteRules` hook or tile trait in `routes/routeEvaluation.ts`, and declares
`fleet.connectivity.at` as a list of stop kinds. Wire version 11 encodes them;
worker and WASM are rebuilt together.

| Rule                | Canonical semantics                                                                                                                     | Encoding                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Halts               | A `halt` town never begins or ends a route.                                                                                             | The stop's `endpoint` flag is false.                      |
| `stopOptional`      | A train may pass a middle stop without calling at it; ends are always called. Called stops alone count toward distance and pay.         | Per train, `optional[stop]`.                              |
| `stopSubsidy`       | Each called stop pays the treasury beside revenue; the route's `subsidy` is their sum, added to the run's.                              | Per train, `subsidies[stop]`; only with a declared fleet. |
| `forbidsHexReentry` | A route may not leave a hex and enter it again; consecutive paths in one hex are one stay.                                              | `no_reentry`.                                             |
| `blockedCityPasses` | Routes may run through this many tokened-out cities (never offboards), all routes of the run together; ends at blocked cities are free. | `blocked_passes`; only with a declared fleet.             |

A leased train (`leasedTrain`) needs no encoding of its own: it is one of
`runnableTrains`, and its running definition and stop values come from the
title's `extendedDefinition` and `stopRevenue`.

**Called stops.** `RouteEvaluation.calledStops` starts from the required stops,
the ones the train may not pass and both ends, rejecting the route when those
alone exceed its distance. It then adds optional stops in order of revenue plus
subsidy, descending, ties by revenue and then by visit order, skipping stops
worth nothing, keeping each only while the distance still holds. Rust's
`Train::called` makes the same choice over the same order: the route as the
game will run it, reversed where the candidate is stored reversed. Each addition
costs a fixed amount of the distance budget and of the N+s major budget, so
the incremental check equals the canonical whole-set check. With unit-cost
optional stops the greedy choice is also the best one for the route; where it is
not (mixed costs), the solver still reproduces the game's choice, which is what
the run will be paid.

**Search.** While walking, an optional stop costs nothing and pays nothing; only
required stops and the start count toward the distance pruning and the token
distance bound, which therefore stay admissible. On recording a route its end
is charged if optional and the route is dropped if over budget, then the called
set is chosen, and revenue and subsidy are computed from it; connection bonuses
and paying-stop limits see only called stops, as `payingRouteStops` does. The
walk counts tokened-out cities and towns it runs through and stops at the
limit; offboards are never passed. When reentry is forbidden, the compiler drops
connections whose own hex sequence reenters a hex and keeps each connection's
sequence of hexes beside it; the walk marks the hexes the route has been in,
starting with the start's, and rejects a connection entering any of them. These
apply to ordinary searches as well as fleets.

**Objective and fleet selection.** As for 1862's Local hex subsidy, the fleet
search maximises revenue plus subsidy, reported as two amounts. A route's stop
subsidy is part of its choice's `add` and kept apart for the reported split. The
run-wide blocked-pass budget is a side constraint like track: each choice
carries its pass count, a choice that would exceed the budget is not taken,
dominance requires no more passes, and idle branches are searched whenever
passes or track can make one unit's choice exclude another's. Bounds ignore the
budget, so they stay admissible. Among fleets of equal total value the first
found is kept (strict improvement), as before. Connectivity uses every visited
stop of the declared kinds, called or passed, and the root is any visit of the
home station, matching `settleFleetRoutes`.

**Limits.** Stop subsidies and blocked passes are rejected without a fleet
policy: the ordinary selector weighs revenue alone and does not share a pass
budget between trains. A passed stop may not carry a stop bonus, since the game
chooses calls by value without it. Interconnection extensions ignore reentry, as
the canonical rule reads only the route's own paths.

**Verification.** A native oracle extends the fleet permutation oracle with
optional stops (its own greedy), halts, subsidies, pass budgets and hex
sequences; 240 generated fleets agree. TypeScript compares the WASM solver with
exhaustive canonical enumeration on 48 generated maps with halts, halts joined to
towns and tokened-out cities, without a fleet policy on 24 more, and for a leased
train. 1860's `autorouter.spec.ts` checks played positions and prepared ones
against a bounded exhaustive canonical search, which asserts that every fleet it
evaluates earns the sum of its routes.

## Route bound, alike connections and two trains kept apart

18USA's last phase runs trains of seven and eight stops, with a Pullman's
uncounted stops or the P19's pass through a tokened-out city, over a map where a
company reaches thirty to forty stops. Recorded play is the evidence: 100
finished games from 18xx.games give 10,835 runs. The solver as 18USA first used
it left 66 of them at a 5 s cap and 175 at 1 s, single trains for the most part,
and paid less than the players' own run in about 30 of the capped ones. Wire
version 11 is unchanged; the changes are in the search.

### Problem class

One train's best route is a maximum-weight simple path under a budget of visits,
in a multigraph whose nodes are stops and whose parallel edges are the compiled
connections, each using track. This is the orienteering problem, which is
NP-hard; see [the survey by Vansteenwegen, Souffriau and Van Oudheusden](https://doi.org/10.1016/j.ejor.2010.03.045).
Depth-first branch and bound stays the exact method. The search had no bound on
what the rest of a route can earn: it kept every route a train could run and so
listed millions of them to find one. Two trains' best pair adds the track they
may not share, the setting of
[conflict-based search](https://doi.org/10.1016/j.artint.2014.11.006) for
several agents' paths, whose branching the pair search below borrows.

### What the rest of a route can earn

`rust/src/outlook.rs` bounds a partial route by relaxing the track and the order
of its further stops: any stop not yet visited, not in a group already used and
within the train's remaining distance may follow, the distance between two stops
being the least any chain of connections uses (all pairs, computed once for the
train). The search drops a partial route when this bound would not be kept:
below the best route so far, a floor, or what a streamed pair needs. Each rule
keeps the bound admissible as follows.

| Rule                                  | Bound                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distance                              | The best further stops, no more than the remaining distance divided by the least any stop uses.                                                         |
| Stops that use no distance            | Every one in reach counts; they are never part of the distance limit.                                                                                   |
| Blocked stops                         | A route ends at one, so one further blocked stop counts, and one more for each pass of the run's allowance left.                                        |
| A train's own pass (P19)              | The stop passed pays nothing, so those passes add no blocked stop, and what the stops passed would have paid is taken off the route so far.             |
| Major-stop limit                      | The best stops within the distance and the blocked ends, or within the distance and the major stops left: either alone bounds both, so the lesser.      |
| Paying-stop limit                     | The best of the stops so far and the further ones together, as many as the limit; stops outside the limit are chosen apart, on a distance of their own. |
| Hex bonuses                           | What the route has collected, and every positive bonus of a hex it has not yet run through.                                                             |
| Connection bonuses                    | A bonus whose every list of stops has one visited or in reach. Where lists name single stops, an even share of it for each of them visited or in reach. |
| First-stop bonus and interconnections | The greatest of each.                                                                                                                                   |
| Longest-route bonus                   | As many visits as there are stops not yet visited.                                                                                                      |

There is no bound where the game chooses which stops a train calls at (optional
stops), where stops pay a subsidy, or under a declared fleet policy, whose
selection weighs more than each route's revenue: those searches run as before.

The bound's sums are wasted where it drops few routes: a listing above a low
floor keeps most of them, and so does a diesel, whose distance reaches every
stop. The bound is tried over the first 4,096 stops of each 65,536 a search
walks and left out for the rest of them when it dropped fewer than one route in
eight of a listing, or one in 64 of a search for one best route, which each drop
shortens more.

### Alike connections

Between two stops the compiled track often gives dozens of connections, which
differ in what follows only by the track they use and the hexes they close.
`rust/src/alike.rs` groups a stop's connections on to another stop into classes
of equal distance, terminus track and bonus hexes. Within a class, after
everything that follows one connection has been walked, another is walked only
for what the first kept out. Each connection the search cannot take notes one
piece of track or one hex in its way, against the connection that holds it. A
later connection of the class is then skipped when it holds all the noted track
and hexes of one walked before it; when the only noted track it frees belongs to
the stop it reaches, only the connections that leave that stop on that track are
walked.

One note for each rejected connection is enough. Take the best route through the
later connection and replace that connection by the earlier one. If the result
is no route, something after it needs track or a hex of the earlier connection
that the later one leaves free; the walk after the earlier connection rejected
that connection for exactly such an obstacle, or for another that the later one
holds as well, and noted it. A class pays the same, so with nothing noted the
replaced route is as good. Classes apply to a search for one best route without
interconnections, whose extensions use track of their own.

The search for one best route also orders its work: the stops that pay most
first, as starts and as next stops, the classes of a stop by what they add, and
the connections that leave on the same track together, so that one piece of
track in use rules a whole run of them out. A listing keeps the compiled order
and the earlier loop, which costs less at each stop.

### A fleet's outline

A fleet without a fleet policy was selected from every train's listed routes.
That stays the first step, for a fiftieth of the time: it settles nearly every
fleet, and for an easy fleet the outline costs about as much again. A fleet it
does not settle is outlined (`Outline` in `rust/src/lib.rs`):

1. Each train's best route alone is found with the bound, within three tenths
   of the time. Their sum is the most any operation earns.
2. A first operation routes one train after another, each beside the track of
   those before it, the most valuable first; two trains that differ are tried in
   both orders. Each train in turn then takes its best route beside the others'
   while that earns more. This may run to four tenths of the time, so that a
   train whose best route took all of step 1 still leaves the others routed. The
   operation the first step's listing had found is taken instead where it earns
   more, and improved the same way.
3. If the first operation earns the sum, it is the answer. Otherwise a better
   one needs of each train a route worth more than the first operation less the
   other trains' best routes. Only those routes are listed, with the first
   operation as the selection's incumbent.

Two alike trains are not listed whole, which overflowed memory for two 8-trains
long before the routes that matter were paired. One route of a better pair is
worth more than half the first operation: only those are stored, and every route
is streamed through them. This is the second pass that a fleet cut for memory
already had, run from the start and from the outline's operation. A stored list
that the time cuts short still pairs, without proving anything.

### Two trains kept apart

For exactly two trains and no longest-route bonus, `Network::settle` proves the
pair without lists. A split holds the track closed to each train and each
train's best route clear of its closed track; the two routes' sum bounds every
operation that keeps to the closed track, and when they share no track they are
the best such operation. Otherwise the first piece both run on is closed to each
train in turn, since in any operation one of them keeps off it, and that train is
routed again above what a better operation needs of it. Each new route also
makes an operation with the other train's best route clear of all of it. Alike
trains are told apart only by the first piece closed.

Splits are taken up best bound first, which proves the answer soonest: the
search ends when no split left could earn more than the best operation. To find
better operations it follows each split down instead, the better of its two
parts at once. It runs twice: before the listing, until four routings pass
without a better operation or 35% of the time is up, and only where that leaves
time for six routings; and after the listing, in the time left. A listing takes
85% of the time left to it. Where finding the trains' best routes took more than
a fifth of that, a listing would not finish: it is skipped if the pair search
then has time for six routings, and takes all the time if not. An operation a
listing leaves when it is cut short is first improved one train at a time, as in
step 2.

### Faults found

Generated two-train cases showed two bounds in the earlier selection assuming
that a train's best stored route earns something. With every stored route of one
train at a loss, the streamed partner bound and the selection's bound for the
trains left both went below what leaving that train idle earns, and cut the
best operation. Both bounds now count an idle train as nothing.

A stream cut short by the deadline in the second pass discarded the best pair it
had found, and a stored list cut short ended the pass. Either leaves legal
operations, which are now kept; the result stays non-exhaustive.

The interface runs each way of attaching rolling stock as a search of its own.
A way whose trains are routed together is now skipped when another such way is
the same search but for paying every train at least as much at every stop, and
the remaining ways share the time left evenly instead of the first taking all of
it.

### Verification

`rust/src/pruning.rs` generates networks of four to seven stops (nine on
request) with shared track, hex bonuses and closures, groups, terminus track,
blocked stops and passes, paying limits with and without uncounted stops,
connection bonuses, major limits, optional stops and the longest-route bonus. It
compares the solver with a listing of every route that drops none for its worth:
1,500 single trains; 500 pairs, a third of them alike, each through `solve`,
through the outline alone, and through the outline with a longest-route bonus so
that the trains' routes are listed above the floors; and 500 pairs settled by
the pair search alone. `PRUNING_CASES`, `PRUNING_SEED` and `PRUNING_STOPS` run
more: 80,000 cases of each kind over four seeds, and 4,000 on larger networks,
agree. `rust/tests/pruning.rs` holds the cases a class must not lose: a second
way into a stop that the way out needs, a lesser connection where the better one
closes a hex the route needs, a connection bonus that outweighs better stops, and
a pass through a blocked city.

### Recorded play

The 100 games' 10,835 runs were solved in WebAssembly through the `Autorouter`,
eight games at a time, before and after:

|                               | 5 s before | 5 s after | 1 s before | 1 s after |
| ----------------------------- | ---------- | --------- | ---------- | --------- |
| Runs at the cap               | 66         | 25        | 175        | 50        |
| At the cap below the recorded | 28         | 1         | 82         | 4         |
| Above the recorded run        | 1,354      | 1,376     | 1,311      | 1,374     |
| 99th percentile               | 2,348 ms   | 392 ms    | 1,007 ms   | 324 ms    |
| Solver time in total          | 766 s      | 326 s     | 376 s      | 196 s     |
| Memory-limited                | 24         | 6         | 32         | 1         |

No single train is left at the cap at 5 s, and one 7-train with a Pullman at
1 s. The rest are pairs of long trains: 6+8, 5+8, 8+8 and 7+8 for the most part.
At 5 s 45 runs earn more and one earns less: 273905 run 77, a 5-train and an
8-train, was proved in 4.3 s of listing, which the outline and the pair search's
share of the time now cut short, $10 under. At 1 s 119 runs earn more and four
pairs at the cap earn $10 to $30 less. Results at the cap depend on what a
search reaches first and move by such amounts from run to run.

The other sets keep every revenue and every proof: 1817 (2,745 runs) and 1870
(2,020) at 30 s and 1 s, and 1862's 5,232 dumped problems at 5 s. 1817's solver
time falls from 23.3 s to 14.3 s at 30 s.

A fleet that the first listing does not settle in its fiftieth of the time, and
that a longer listing would have, pays for that listing again and for the
outline. The 120 18USA fleets proved in 50 to 850 ms before take 39% longer in
total at 5 s and 23% at 1 s; all are still proved at 5 s and one is cut at 1 s
with the same revenue. Four 1870 fleets of a diesel and a 5- or 6-train take 120
to 200 ms at a 1 s limit where they took 29 to 57 ms. At 30 s the first listing
has 600 ms, which is longer than all but about ten of these took. The games,
tools and results are outside the repository at
`/workspace/tmp/autorouter-bench/`.

## Two trains in slices of steps

The outline and the pair search left three faults in two-train fleets. Answers
at the cap moved by $10 to $30 between identical runs. A few capped runs earned
less than before, and one proof was lost. Fleets the earlier solver proved in 50
to 850 ms took a third longer. Wire version 11 gains one optional field,
`pace_ms`; the other changes are in the search.

### Why the answers moved

Every stage ended on the clock: the first listing after a fiftieth of the time,
the outline after three tenths, the pair search after 35%, and a listing was
skipped when the trains' best routes had taken more than a fifth of the time
left. A stage that ends a few milliseconds earlier or later hands the next one a
different list and a different operation to improve. Nothing else varied: the
searches are deterministic.

Stages now end on a count of steps (`Limit` in `rust/src/lib.rs`). A step is one
stop walked to; trying the connections on from a stop counts one more for every
16 of them, and looking for a partner counts one for every eight words of the
stored routes' index, or eight routes beyond it. The weights keep a step about
as long on a map with sixty connections at a stop as on one with six. A solve is
paced at 5,000 steps for each millisecond of its time, about what the slowest
searches take in WebAssembly, and a stage's share is a share of those steps. The
clock still ends the solve, and on a machine too slow for the pace it ends a
stage at twice its share of the time. Two runs of the same problem therefore
take the same course until the time limit cuts the last stage.

The interface gives each way of attaching rolling stock its own search and
shares the time left between those still to run. `pace_ms` carries what each was
planned with, the whole limit divided by the number of ways, so a search's
stages do not depend on what the searches before it used.

### The slices

`rust/src/pair.rs` runs two trains without a fleet policy:

1. The stored train's routes are listed outright for 500,000 steps, or a quarter
   of the time on a machine too slow for them. Two alike trains keep the earlier
   first step: one list and a selection, for a fiftieth of the time.
2. The outline finds each train's best route alone and a first operation, as
   before, in shares of the steps.
3. The trains are kept apart while that finds better operations: until four
   routings pass without one, to 35% of the steps, and only where six routings
   fit.
4. Slices follow, the first of 200,000 steps and each twice the last. A slice
   lists on; once the list is whole it streams the other train's routes through
   it, and a stream that comes through proves the answer. Beside it two searches
   take a quarter of the slice each: a stream through the 4,096 most valuable
   routes of the list as far as it has come, and keeping the trains apart, once
   it is owed the steps of one routing. Either takes half as much after each
   slice in which it found nothing better, down to a sixteenth of its part. A
   list of 100,000 routes that is not yet whole, or one that memory has cut, is
   far from proving anything: beside it the stream begins from as many steps as
   the listing, and keeping the trains apart, the one search that can still
   prove the answer, takes as many whatever it found.

Every search is taken up where its last slice stopped. A search that runs out of
steps records the connection it had come to at each stop of its route, and the
next slice walks that route again, which counts no steps, and goes on from
there. A listing keeps its routes and a stream its best pair, so nothing is
searched twice. A better operation raises the floor of a listing under way: the
routes already listed below it are dropped and the listing goes on above it.

A stream through part of a list proves nothing, but its pairs are operations,
and few stored routes leave few of the other train's routes worth walking. One
that comes through begins again with four times as many routes. Through no more
than 16,384 routes its partner search runs at every stop of a streamed route,
not only where a route could end: a route with no stored route clear of its
track goes no further. Through a whole list that search costs more than it
drops.

A list that fills its memory first waits for a higher floor, which the outline
or a better operation gives. With none to come it drops the routes that run on
the same track as a better one, a quarter to a half of an 18USA list, and goes
on whole if that freed a quarter. Otherwise it keeps the more valuable half each
time it fills. Dropping takes about a tenth of a second for 450,000 routes. It
is left out, and the list cut at once, when the solve's pace leaves fewer than
six times the steps that stands for: such a list would not be finished and
streamed through in what is left.

### What a search skips

Four changes make each search shorter.

- The next stop is checked before it is walked to. A connection whose stop the
  route could only end at is taken only where the route would be recorded there
  and, for a train that every stop pays, be kept at its exact worth. One it
  could go on from is taken only if the bound at the present stop would still be
  kept once reduced by what the next stop is short of the least stop that bound
  counted.
- Pieces of track that the same arcs run on count as one piece. Routes share one
  of them exactly when they share the others, so conflicts are unchanged, and
  the 500 to 640 pieces of a late 18USA map become about half as many.
- A streamed route looks for partners from where its earlier stops' searches
  came to. Stored routes are in order of worth, so the first word of the index
  with a route clear of a route's first stops bounds every route that goes on
  from them.
- For each connection the index gives the most a stored route clear of its
  track is worth, among the 65,536 most valuable. The least of those over a
  streamed route's connections bounds its partner before any search.

Keeping the trains apart looks a train's best route clear of some track up in
the list once that is whole, instead of searching for it.

### Measured and dropped

- Prices on shared track (a Lagrangian bound for the pair): the bound stalls
  far above the best operation, 980 against 880 on one fleet, because the two
  routes must cross and no price says where.
- Two half lists. Any two floors that add up to the operation prove it: each
  train's routes above its floor, and the other train streamed through them. On
  the fleet tried, the two halves together took as many steps as the one list.
- A table of positions already searched. Different connections through a
  junction reach the same stop with the same track used. Skipping them saved 15
  to 28% of the steps with an unbounded table, before the table's own cost.
- Keeping each stop's clear routes as a bitmap carried along the route. The
  partner search is 1 to 5% of a solve.
- Streams through 65,536 routes or through all of an unfinished list: no better
  than through 4,096, and worse on two fleets.
- A second stream, through the other train's most valuable routes kept in a
  sixteenth of the memory. With the trains' parts exchanged outright, three
  capped fleets earn $20 to $70 more, since their better pairs have the longer
  train near its best route. The small list covers too little of that train's
  search in the steps a slice can spare: nothing gained, and three fleets lost
  $30 to $50 at 1 s.

### Verification

The pair cases of `rust/src/pruning.rs` also run in slices of five steps after
an outright listing of seven, with a longest-route bonus, and with 6,000 and
12,000 bytes of memory, where a list that memory cuts must prove nothing it
should not. A listing taken up in slices of one, three and eight steps lists
what one run lists. A stream through the leading routes of a list, whole and in
slices of four steps, finds the best pair of any of them with a route of the
other train. 20,000 cases of each kind over two seeds agree.

### Recorded play

The same 10,835 runs in WebAssembly, eight games at a time: the solver as 18USA
first used it, the outline and pair search of the section above, and the slices.

|                               | 5 s first | 5 s outline | 5 s slices | 1 s first | 1 s outline | 1 s slices |
| ----------------------------- | --------- | ----------- | ---------- | --------- | ----------- | ---------- |
| Runs at the cap               | 66        | 25          | 16         | 175       | 50          | 42         |
| At the cap below the recorded | 28        | 1           | 1          | 82        | 4           | 1          |
| Above the recorded run        | 1,354     | 1,376       | 1,377      | 1,311     | 1,374       | 1,377      |
| 99th percentile               | 2,348 ms  | 392 ms      | 249 ms     | 1,007 ms  | 324 ms      | 235 ms     |
| Longest                       | 5,020 ms  | 5,020 ms    | 5,017 ms   | 1,047 ms  | 1,017 ms    | 1,023 ms   |
| Solver time in total          | 766 s     | 326 s       | 275 s      | 376 s     | 196 s       | 172 s      |
| Memory-limited                | 24        | 6           | 6          | 32        | 1           | 7          |

A second run of all 10,835 at each limit returned the same revenue and the same
proof for every run, the capped ones included.

At 5 s no run earns less than under either earlier solver and none loses its
proof; seven earn more than with the outline and nine more are proved, among
them 273905 run 77, in 3.1 s. The 16 left at the cap are pairs: 6+8 six times,
and 7+8, 5+8, 5+7, 5+7 with a Pullman and 8+8 twice each. One is below the
recorded run, as before: 267388 run 97, two 8-trains, at 1,070 against 1,080.
More than 300,000 of an 8-train's routes there are worth over half the
operation, so the list is not whole in 5 s, and the pair search comes on 1,080
only after about 7 s. A 30 s limit proves it at 1,090 in 14 s.

At 1 s no proof is lost and 133 more runs are proved than at first. Four capped
pairs earn less than under one of the earlier solvers: 261796 run 108 (6+8,
1,090 to 1,080) and 270150 run 102 (6+5, 930 to 920) against both, and 258492
run 126 (6+8, 1,090 to 1,050) and 273905 run 82 (8+8, 990 to 980) against the
outline alone. In each the earlier stream ran through a list the clock had cut
and came on the pair there; those answers were among the ones that moved from
run to run. The list is not whole in a second, and the stream through its
leading routes and the pair search reach $10 to $40 less. Three of the four are
proved at 5 s. More lists count as memory-limited at 1 s because a full list is
now cut at once where it used to be put in order first; all seven are runs the
time caps.

The 120 fleets the first solver proved in 50 to 850 ms take 26.5 s in total at
5 s and 26.1 s at 1 s, against 28.5 s at first and 39.3 s and 35.0 s with the
outline; all are proved at both limits. 23 of them are still more than a fifth
slower than at first, the worst from 359 to 586 ms: the outline and the first
pair search come before a list that would have been whole without them.

With 30 s, six of the 175 runs that the first solver capped at 1 s stay at the
cap, against nine with the outline. One of them earns less than with the
outline: 257272 run 104, a 5-train and a 7-train with a Pullman, earns 960
where the outline had 990. The outline had begun its exchange of routes from a
pair that its first stream came on. The slices begin from the outline's own
first operation, and their streams and the pair search reach 960, at 5 s as at
30 s; at 5 s the outline had 900.

The other sets keep every revenue and every proof. 1817 (2,745 runs) takes
10.2 s in total at 30 s, against 23.3 s at first and 14.3 s with the outline,
and proves all its runs at 1 s; 270394 run 106 takes 421 ms, against 746 ms and
1,226 ms. 1870 (2,020 runs) takes 1.75 s at 30 s and 1.76 s at 1 s; its four
fleets of a diesel and a 5- or 6-train take 35 to 71 ms at 1 s, against 29 to
57 ms at first and 120 to 200 ms with the outline. 1862's 5,232 runs, solved
through the title's own bench again, are proved with the same revenue and
subsidy by all three solvers, in 7.7 s, 7.8 s and 7.9 s.

## Stop-group route limits in the search

18USA lets no more than two of a company's routes in one run stop in Mexico
(§12.4.1). The family declares it as `RouteRules.stopGroupRouteLimits`, a limit
on routes for a `stopGroup`, and `RouteEvaluation` refuses a run that breaks it.
The solver did not know the limit. The interface searched without it in half
the time and, where that run broke it, searched again for every set of no more
trains than the limit allowed into the group, the others kept out through a
suffix on their definition ids: eleven sets for four trains, in even slices of
the other half. The answer was proved only where every search was, and a second
limited group was not supported. Wire version 12 gives the solver the limits as
`group_route_limits`, a list of `{ group, routes }` over the stops' existing
group indexes, and one search holds the run to them.

### Problem class

Choosing a route for each train on track no two share is maximum-weight set
packing, as "Exact fleet selection" says: a piece of track is a resource that
one route may use. A group that at most N routes may stop in is the same kind
of resource with room for N, which makes the selection a packing with
capacities. It needs no outer loop over the trains let in: branch and bound
over one route for each train already carries what each resource has left, and
a resource that is full takes its routes out of the later trains' choices.

### A quota is a piece of track

`Problem::limit_groups` gives each limited group a piece of its own after the
track's pieces: a quota (`Quota` in `rust/src/lib.rs`). A limit of at least as
many routes as the problem has trains cannot bind and gets none, so 18USA's
fleets of one or two trains are searched exactly as before. A connection runs
on the quotas of the stop it reaches, and a route also on those of the stop it
was walked from, so a route's pieces say which limited groups it stops in.
Every stop a route runs through counts, called at or not, as the evaluation
counts a route's visits; an interconnection's extension does not.

- **No route.** The group's stops are closed to every search.
- **One route.** Two routes that share the piece conflict as two that share
  track do. The selection's compatibility rows, a stream through stored routes,
  the routes kept clear of some track and the search that keeps two trains apart
  all read pieces, and need nothing more: keeping two trains apart closes the
  quota to each in turn where both want it.
- **More routes.** Routes may share the piece, so it is left out of the
  compatibility rows and counted. The selection keeps, for each such quota, the
  routes that run on it as one row of bits over every train's routes and how
  many of the routes chosen do. When a choice fills the quota, its row is
  taken out of what the later trains may choose, so no descendant looks at
  those routes. The bound sums the best routes still available and stays
  admissible. Such a quota only binds a fleet of three trains or more, which the
  selection and the outline route; the pair search never meets one.

A search for one train's route with some pieces closed, as the outline runs
them, closes a group's stops when its quota's piece is closed. The stops then
count for nothing in the bound on what the rest of a route can earn.

### The outline under a quota

A fleet of three trains or more that listing does not settle is outlined: each
train's best route alone, a first operation, and then only the routes that a
better operation needs. Routing a train beside the others closes a quota's
piece to it when the others already fill the quota, and leaves it open when
they do not.

The first operation routes the trains in an order, the most valuable first.
Under a quota the order also decides which trains take its places, and a train
routed late may find them gone. Where a quota binds, each train is therefore
also tried before the others, the rest in the same order, each order in an even
part of the steps the first operation has. The best of the orders is the
operation the listing starts from.

The outline's bounds leave the quotas out. The sum of the trains' best routes
alone still bounds every fleet, and the floor it gives each train's listing is
still one no better operation can go under: a quota only takes routes away.
A tighter bound was built and measured: each train's best route clear of a
quota's piece, so that a quota of N routes lets only N trains earn more than
that, and a route on the piece has a higher floor. On the synthetic fleets
below it changed no proof, and three capped answers of 384 by a little either
way. The trains' best routes clear of Mexico are worth $0 to $30 less than
their best routes, so the limit takes little from the bound; and with Mexico
made to pay every train $150 more it still proved nothing more. A fleet that
listing does not settle falls short of the sum of its best routes by the track
they share, $200 to $600 on the late boards, which no bound on the quota
recovers. It was dropped.

### What the interface keeps

`Autorouter.solve` no longer branches on the limits. The encoder passes them
with the group indexes it already gave the stops, and the route problem's key
names them. The run that comes back is evaluated by `RouteEvaluation` under the
title's rules as every run is, so the logic still decides what is legal.

The solver counts a quota among the trains of one search. Three ways of
splitting a fleet over searches are therefore refused beside a limit: a fleet
policy, whose selection (`fleet.rs`) weighs payments and chains and counts no
quota; a required route; and station-run or track-sharing trains, which are
routed apart. No researched title pairs any of them with a limit.

### Verification

`rust/tests/correctness.rs`: the permutation oracle counts the routes that stop
in each limited group. "only so many routes stop in a limited group" has a hub
with six spokes, two of them in a group limited to one route and three in a
group limited to two, for fleets of four and five trains: the unlimited best
breaks both limits, and the limited best is the oracle's, with and without the
longest-route bonus. A limit of no routes closes its stops, and a limit on a
group that does not exist is refused. "limited groups agree with the
permutation oracle on generated graphs" runs 150 graphs of two to four trains
with two groups and limits from none to all but one of the trains.

`rust/src/pruning.rs`, "trains earn what listing every route finds within
limits on stop groups": generated networks of one to four trains with a stop
group on half the stops and limits from none to as many routes as trains,
against every choice of the listed routes with the groups counted from their
stops. Pairs are also outlined whole and in slices of five steps, with a
longest-route bonus and with 6,000 and 12,000 bytes; fleets of three and four
are also outlined as fleets that listing did not settle. 80,000 cases over four
seeds agree.

`rust/src/lib.rs`: a stream pairs no route with a stored one that begins under
the same quota, among the indexed routes and beyond them.

`autorouter.spec.ts`: four trains under limits of one and two routes are held
and proved in one solver call that carries `group_route_limits`; fleets of two
to four trains match the exhaustive enumeration; a search cut short proves
nothing and keeps the limits; the route problem's key names the limits.

### Recorded play

Both 18USA sets in WebAssembly, eight games at a time: the 10,835 runs of the
100 games and the 5,441 runs of the 50 held-out games, against the same commit
with the interface's split (da703856e, the solver of "Two trains in slices of
steps").

|                                   | 100 games, 5 s   | 100 games, 1 s   | Held-out, 5 s    | Held-out, 1 s    |
| --------------------------------- | ---------------- | ---------------- | ---------------- | ---------------- |
| Runs at the cap                   | 16 → 16          | 42 → 42          | 39 → 40          | 62 → 62          |
| Revenue lower / higher            | 0 / 0            | 0 / 0            | 0 / 0            | 0 / 0            |
| Proofs lost / gained              | 0 / 0            | 0 / 0            | 1 / 0            | 0 / 0            |
| Runs over the limit               | 0                | 0                | 0                | 0                |
| Longest                           | 5,022 → 5,018 ms | 1,019 → 1,019 ms | 5,033 → 5,029 ms | 1,034 → 1,031 ms |
| Proved in under 1 s before, total | 129.1 → 127.9 s  | 129.2 → 127.9 s  | 75.8 → 75.2 s    | 75.4 → 74.9 s    |
| The same, 95th percentile         | 24.4 → 24.3 ms   | 24.6 → 24.5 ms   | 30.4 → 30.5 ms   | 30.8 → 30.4 ms   |
| Three trains or more, total       | 5.00 → 3.99 s    | 5.09 → 4.03 s    | 2.88 → 2.23 s    | 2.98 → 2.28 s    |
| The same, longest                 | 64 → 33 ms       | 65 → 66 ms       | 93 → 29 ms       | 91 → 22 ms       |

The answers are the same run for run. Recorded play holds no fleet that the
limit makes hard: the train limit is two from phase 6, so the 1,600 runs of
three trains or more are small trains on early maps, proved in milliseconds
either way and a fifth sooner in one search.

The proof lost is 253728 run 108, a switched 5-train and an 8-train, whose
proof takes the whole 5 s: the split has no part in it, as two trains cannot
break the limit. The earlier checkout proved it with 1 ms to spare in the run
tabled here, and in none of five later runs. With the two checkouts run turn
about three times on each set at 5 s, neither proves it, every run of both
sets has the same revenue and the same proof, and the runs that take 1 to 5 s
take the same time to within 0.6%. On a processor slowed 2.8 and 5.1 times the
capped two-train runs move both ways by as much as between two runs of one
build, since the slowdown is a shared processor and not a count of steps.

### Synthetic fleets

The limit only bites a fleet of three trains or more, and 18USA allows those
only up to phase 5. Its cost was therefore measured on fleets set on recorded
boards, through the interface in WebAssembly at full speed and on a processor
shared four ways (2.8 times slower):

- **Late boards**: 16 boards of phase 8 on which the recorded company ran two
  routes to Mexico, each with six fleets (4+5+6, 6+7+8, three 8-trains,
  5+6+7+8, two 7s and two 8s, and 6+7+8 with a Pullman): 96 problems. No rule
  allows these fleets there; they stand for what another title could ask.
- **Mid-game boards**: 16 boards of recorded fleets of three trains or more
  that ran two routes to Mexico, phases 4 to 6, each with twelve fleets from
  three 5-trains to two 7s and two 8s: 192 problems.

|                            | 5 s              | 1 s              | 2.8× slower, 5 s | 2.8× slower, 1 s |
| -------------------------- | ---------------- | ---------------- | ---------------- | ---------------- |
| Late boards: proved        | 18 → 21          | 13 → 17          | 14 → 18          | 10 → 13          |
| Revenue, of the best known | 98.5% → 99.3%    | 97.2% → 99.3%    | 98.2% → 99.0%    | 93.8% → 98.9%    |
| Runs lower / higher        | 4 / 27           | 3 / 31           | 3 / 29           | 3 / 41           |
| Runs with no routes        | 0 → 0            | 1 → 0            | 0 → 0            | 2 → 0            |
| Longest                    | 5,482 → 5,071 ms | 1,275 → 1,072 ms | 5,631 → 5,150 ms | 1,645 → 1,140 ms |
| Mid-game boards: proved    | 187 → 189        | 180 → 187        | 184 → 187        | 174 → 183        |
| Runs lower / higher        | 0 / 1            | 0 / 4            | 0 / 3            | 0 / 5            |
| Time of those both prove   | 24.8 → 14.9 s    | 17.7 → 9.5 s     | 34.2 → 17.1 s    | 21.0 → 11.0 s    |

No proof is lost in either set. The unlimited best breaks the limit in about a
quarter of the late-board problems; in the rest the split returned its first
search at half the time, proved or not.

On the mid-game boards both ways prove nearly every fleet, and the one search
takes 40 to 50% less time on those both prove. It proves seven more at 1 s and
nine more on the slowed processor, where the split's slices were too thin.

On the late boards most fleets stay unproved either way: three or four long
trains share so much track that the first operation is $200 to $600 below the
sum of the trains' best routes, the floors that sum gives are too low to list
above, and the lists overflow memory. That holds with the limit taken out of
the problem, and is the fleet search's own limit, not the quota's. What the one
search gains there is the whole time and the orders of the first operation:
without the orders 15 of the 96 earn less at 5 s and 17 at 1 s. At 1 s the
split returned no routes at all for one fleet with a Pullman, and for two on
the slowed processor, each of its slices ending before a first operation; and
it ran up to 0.6 s past the limit, each of its searches a little over its
share.

The runs that earn less, 13 over the four columns, are capped both ways, and
in each the split had answered from its first, half-time search. Ten are on
one board, 254449 run 98, whose own two-train run is capped: there even one
train's best route is not found within the outline's steps, the first
operation is built from where those searches stopped, and at half the pace
they stopped on routes that leave the other trains more track (1,260 against
1,040 with 6+7+8). The same build with the limit removed gives 1,260 at 1 s
and 2.5 s, 1,030 at 5 s and 1,050 at 30 s, so the fault is the outline's for
three long trains, not the limit's.
