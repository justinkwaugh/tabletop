# Routes and operating revenue

## Evidence and scope

The full title-trait catalog was surveyed: route distance (249 assignments / 126
profiles), visit/payment limits (259/127), track reuse (157/128), repeated-center
payment (141/128), fleet constraints (165/128), and revenue modifiers (416/128).
Unverified profiles remain gaps. The domain study's routes section and complete
route assignments distinguish path use, visits, payments and whole-set constraints.

Examples challenging a universal rule include 1849 weighted gauge distance,
1862 end-to-end freight groups and train-group track reuse, 1877 Stockholm shared
track with restricted repeat payment, 1860 fleet connectivity, and express trains
with separate visit/pay allowances. The local 1862 freight grouping and 1877
Stockholm revenue/overlap rules were inspected. Rolling Stock titles have no train
routes. These are evidence for seams, not implementation templates.

TOP prototype §§13.2–13.3 establishes H border counting, + city/offboard capacity
with trailing towns and a required city, 7 revenue-center counting, and unlimited
diesels. Shikoku 1889 §§8.5.1–8.5.3 establishes numbered train capacity and diesel-only
gray offboard values. Both forbid reusing track within or between runs, require a
company station and two revenue centers, disallow skipping/revisiting a revenue
center, and permit a blocked city only at an endpoint. 1889 explicitly prohibits
reusing a hex border. Both permit different trains to pay the same center using
different track. These rules are implemented independently for this repository.

## Shared assets and title choices

TrainRoute stores a start revenue center and ordered semantic tile-path identities,
not a list of adjacent hexes or client-computed revenue. RouteNetwork follows the
actual rotated path endpoints and Common-backed map connections, counting crossings
and identifying shared track arms. Crossing tracks without a shared node do not
connect. City blocking is shared with TrackNetwork; reservations do not block trains.

RouteEvaluation validates a submitted route set and derives visits, distance,
per-center payments, per-train revenue and OperatingResult. Visit and payment
arrays remain distinct even though every visit pays in these first consumers.
RouteRules supplies title map/depot data, applicable revenue stages and the + train
city requirement. Existing title track-color tables supply phase color stages;
1889 adds its diesel value stage only for the running diesel. The present evaluator
implements the no-track-reuse, station-required rule family; alternative overlap,
express payment, fleet connectivity, gauge/lane and retained-income rules require
explicit extensions when another consumer needs them. No silent universal policy
or empty plugin framework is implied.

RunTrains accepts paths only, calculates authoritative results, and records them
in RouteStep and action metadata. Trains that run retain a hasRun fact for later
retirement rules; absent means the train has never run. It transfers no money. FinishStations initializes
RouteStep directly and advances to RunningTrains; RunTrains reaches TrainsRun
pending the earnings slice. A new prepared Routes example provides track, stations
and two owned trains for each title. No start-route bookkeeping action is added.

This slice validates the submitted routes, not a maximum-revenue obligation or
optimal use of every train. Empty submissions calculate zero; the future client-only optimizer helps players find maximum earnings without
adding search or optimality certification to authoritative Action processing.
A benchmark-only enumerator in the development harness yields individual legal
candidates and prunes invalid prefixes;
it is not used to auto-select routes, claim an optimal set, or block the editor.
It is not exported by the shared logic package. A late-board benchmark records
enumeration cost separately from validation.

## Prototype contract

The session owns all manual route drafts: selected train, starting center, ordered
paths and saved uncommitted routes. Map path clicks or extension buttons append
connected paths. Saving a route stages it in the whole set; only Confirm routes
commits RunTrains. Back removes the last path, then start, then train selection.
Undo clears a draft set before committed undo. History and visible-state updates
hide drafts and beforeNewState clears them. Viewport/style changes preserve drafts.

Route overlays use the existing MapRoute path renderer; the draft and saved routes
have distinct colors. Route overlays take precedence over reachability coloring
while drafting or showing a committed operating result. Map inspection remains
available for selections that are not valid next paths. Itemized revenues and
whole-set errors use the same evaluator as the action. Controls remain disposable.


## Enumeration measurement

A deterministic prepared TOP phase-D board contains 34 placed tiles reached by
55 valid lays/upgrades evaluated through TrackConstruction. The serialized board
is retained with `scripts/benchmark-routes.mjs` in the viewer; it preserves the
title's tile inventory and migrated station identities. It is a prepared topology
benchmark, not a replay of a complete game's finances and train events.

`pnpm --filter @tabletop/18xx-tile-viewer benchmark:routes` enumerated 1,936 legal
oriented diesel candidates in approximately 2.2 seconds in this workspace; first
candidate arrived in 5.5 ms. Revalidating a selected route averaged 0.051 ms over
1,000 iterations. Reverse traversals are currently counted separately. These are
observations, not timing assertions or evidence of optimal fleet selection.
Synchronous full enumeration is unsuitable for the interactive editor; slice 18
needs reversal deduplication, incremental graph search and cancellation/worker
execution in the client before comparing train combinations on larger late positions.

## Verification

Passed 136 shared logic tests and 114 harness tests, including title revenues,
station access, crossing-track separation, blocked endpoints, track/center reuse,
ownership, authorization, stale paths, replay, hydration, determinism and Undo.
All logic/UI builds and shared/title/harness Svelte checks passed. Twenty browser
checks covered route, train, stock, track and station flows. The four route/station
checks passed again after adding direct map clicks and fixing draft serialization:
map selections carry presentation fields, so RouteEditor stores only canonical
location/node/path IDs. Both titles now confirm routes selected on the map or
through controls. The TOP draft and route overlays were inspected visually.


## Operation naming

Companies run trains along selected routes. RunTrains is the Action; RunningTrains
is the active Machine State and TrainsRun records completion pending earnings
distribution. RouteEvaluation owns path legality and revenue calculations. Route
editor, TrainRoute and route selection continue to describe the chosen paths.
The prototype fixture is version 15 so earlier saved actions remain in
their existing examples without being replayed as the renamed action.
