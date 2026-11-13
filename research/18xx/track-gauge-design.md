# Track gauge design

Family support for track of more than one gauge, built for 1849 (Sicily). The
title itself is built separately; this note covers the shared libraries only.

## Evidence surveyed

- 1849 rulebook §10.1, §10.3, §10.3.1, §10.5.1 (`/workspace/artassets/1849/rules.txt`).
- Research package `18xx-game-variation-catalog.md` (1840–1858 section, the
  1860/1862 and gauge-games distance note, the shared-graph note) and
  `18xx-domain-model-study.md` (network types, upgrade preservation, running
  permissions, distance units).

| Title                                                                                            | Gauge mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                 | Covered now                                                                                            |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1849 (Sicily)                                                                                    | Standard, narrow, dual. Gauge changes only at a town or city; dual track takes the gauge it is entered on. Narrow meeting standard at a hex side may be laid but does not connect. Hex trains weigh standard and narrow hex sides differently (ordinary 1/2, R6H 2/1); an all-dual stretch counts 1. Upgrades keep each path's gauge (dual keeps either). Terrain costs a quarter when all new track is narrow. Routes need two non-port stops. | Yes, except the per-hex-side extra count noted under limits.                                           |
| 1849 Kingdom of the Two Sicilies                                                                 | Inherits the Sicily gauge and distance model with a new map.                                                                                                                                                                                                                                                                                                                                                                                    | Same as 1849.                                                                                          |
| 1858 (Iberia, India)                                                                             | Broad and metre trains may run only their own gauge (and dual); incompatible gauge is prohibited rather than weighted.                                                                                                                                                                                                                                                                                                                          | Connectivity and the stretch rule fit; a per-train allowed gauge set is a later extension (see below). |
| 18ESP                                                                                            | Northern/southern networks restrict trains by gauge and region; combined trains change gauge.                                                                                                                                                                                                                                                                                                                                                   | Not covered: needs per-train gauge permission and train composition.                                   |
| 18India                                                                                          | Crossing gauges consumes route capacity through an inserted zero-value stop.                                                                                                                                                                                                                                                                                                                                                                    | Not covered: a different distance rule at gauge changes.                                               |
| 18Ireland                                                                                        | Narrow gauge is a separate feeder network paying broad-gauge runs.                                                                                                                                                                                                                                                                                                                                                                              | Not covered: a different meaning of the same label.                                                    |
| 18Norway                                                                                         | Narrow paths model water/ships.                                                                                                                                                                                                                                                                                                                                                                                                                 | Not covered: a transport mode, not a gauge.                                                            |
| 1848                                                                                             | Gauge-border crossings affect route allowances.                                                                                                                                                                                                                                                                                                                                                                                                 | Not covered.                                                                                           |
| All other implemented titles (TOP, 1889, 1830, 1832, 1846, 1817, 1833NE, 1850, 1862, 1870, 1894) | No gauge: every path is standard.                                                                                                                                                                                                                                                                                                                                                                                                               | Unchanged behaviour (verified by their suites and the autorouter specs).                               |

As the study notes, a gauge label has no universal business meaning. The shared
part is the physical vocabulary (standard/narrow/dual on `TilePath.gauge`) and the
1849/1858 notion that a route is legal only on track of one gauge between stops.
Feeder networks, water modes and capacity-consuming gauge breaks stay title
mechanisms built on other extension points.

## Shared behaviour

- `tiles/trackGauge.ts`: `RunningGauge` (`standard` | `narrow`), `StretchGauge`
  (adds `either` while a stretch is all dual), `pathRunningGauges`,
  `continueStretch` (the one place the stop-to-stop gauge rule lives), and
  `keepsTrackGauge` (upgrade preservation).
- Running (`RouteNetwork.trace`/`walk`/`extensions`): the stretch gauge resets at
  every stop and must continue along every path; junctions do not reset it.
  `RouteTrace.stretches` records each stop-to-stop stretch's gauge and hex sides.
- Distance: `TrainDistance.gaugeWeights { standard, narrow }` for `hex-edges`
  trains; an `either` stretch costs the lesser weight, which is the rulebook's
  "all-dual counts one" for both 1849 train kinds and the general reading that
  a train may pick either gauge where gauge is free. Without weights every hex
  side counts one.
- Route shape: `RouteRules.minimumCitiesAndTowns`, declarative so the autorouter
  enforces it natively (it refuses `routeAllowed`).
- Reach (`reachRoutes`, used by station placement, train requirement, stop
  rights, destination connection and construction): hex sides and junctions get a
  matched pair per gauge; dual track touching a stop joins both gauges' pairs;
  dual track between two non-stops is a pair per gauge. Titles without gauges
  build exactly the old graph.
- Construction: `ConstructionReachability` records the gauge each route enters a
  hex by, and `connections()` follows a replacement face from those entries
  under the same stretch rule. Laying narrow against standard stays legal.
- Upgrades: `preservesPath` keeps a path only through track whose gauge keeps it.
- Added track: `addedTrack(before, after, mapping)` and
  `layAddedTrack(state, rules, request)` list the laid tile's new paths with their
  gauges (a gauge change to dual is new track), for a title's
  `TrackRules.terrainCost`; the 1849 quarter-cost policy stays title-owned.
- Autorouter (protocol 8): arcs carry a gauge; the compiler carries the stretch
  gauge from stop to stop, so compiled connections never break the rule; each
  train has `crossing_costs` by connection gauge (replacing `counts_crossings`);
  interconnection extensions search per stretch gauge; routes must reach
  `minimum_cities_and_towns`.
- Rendering: narrow track draws as the printed tiles show it, a ladder of ink
  rails along a paper band with ink ties across it (owner's direction,
  2026-11-12, from tiles 661 and 694); dual track as ink with a paper centre line, in tile strokes, crossing patches
  and map seam joins (`trackGaugeStrokes.ts`).

## Limits recorded

- Reach may overstate where track of both gauges meets at one hex side or
  junction: the per-gauge pairs let a route use one dual path or hex side once on
  each gauge (for example reversing through a stop onto the other gauge's track
  at the same hex side). Exactness would need a two-commodity search, which the
  matching formulation cannot express. Route evaluation and the autorouter are
  exact; titles without gauges are unaffected.
- 1849's hex counting as two hexes (a line across the hex north-east of Messina)
  needs a per-hex-side or per-path crossing weight; not built.
- 1849 prints narrow towns as dots and standard towns as bars; the renderer's
  town marker still comes from the appearance, not the gauge.
- Per-train gauge permission (1858, 18ESP) is not modelled. The stretch model
  supports it as a later `TrainDistance`/`RouteRules` member restricting the
  allowed `RunningGauge`s, with the autorouter treating a forbidden gauge as an
  infinite crossing cost.
- Offboard spikes and port piers draw without a gauge.

## Verifying examples

- §10.5.1: an ordinary train counts the standard Palermo–Partinico line as 2 and
  the narrow line as 2; the R6H counts them 4 and 1; a dual hex counts 1 for both
  (`libs/18xx/src/routes/trackGauges.spec.ts`).
- Narrow → dual → standard without a stop does not connect; through a town it
  does (`libs/18xx/src/construction/trackGauges.spec.ts`, Rust
  `routes_change_gauge_only_at_stops_and_weigh_each_stretch`).
- Random mixed-gauge lines: the autorouter matches exhaustive TypeScript route
  enumeration (`libs/18xx-autorouter/src/autorouter.spec.ts`).
