# 18USA's hooks in the 18xx family library

18USA composes the 1817 family's sized-company modules
([1817-family-mechanisms-design.md](1817-family-mechanisms-design.md)) and needs some hooks the
family library did not have. This note covers the hooks it added to `libs/18xx` and
`libs/18xx-autorouter`, or changed materially, as the
[18xx design rule](../../docs/agents/18xx-design.md) step 5 requires. The title's rules and
readings are in [games/18usa/title-design.md](../../games/18usa/title-design.md). Every hook
is optional. A title that sets none of them behaves as before.

## Survey

The reference implementation is pinned at `715567bdc7e5cc68a68a286b21dc8edd1a125e50`.

- [18xx-domain-model-study.md](/workspace/research/18xx-2026-09-08/18xx-domain-model-study.md):
  track construction (`upgrade-preservation`, `construction-allowance`), stations and access
  (`station-blocking`, `station-placement`), routes and revenue (`route-distance-metric`,
  `visit-pay-limits`, `route-track-reuse`, `fleet-route-constraints`), trains
  (`train-acquisition`), technology progression, loans (`interest-rule`) and stock
  transactions.
- [18xx-game-variation-catalog.md](/workspace/research/18xx-2026-09-08/18xx-game-variation-catalog.md):
  the 18USA entry (`g_18_usa`, which extends 1817).
- [data/title-traits.json](/workspace/research/18xx-2026-09-08/data/title-traits.json): the
  profiles for the traits above, searched across the catalog. Reference source was read where
  a profile left a variation unclear.

## 1. Colour skips: `TrackRules.colorSkip` and the lay's `upgrade`

**Hook.** `colorSkip(state, locationId, before, after)` returns `{ cost, upgrade }` for a tile
more than one colour above the face it replaces, or `undefined` to forbid it. Track
construction asks for it only when the colour step is 2 or more, and
`replacesColorAndStops(…, skipsColors)` then accepts the step. The cost is added to the lay.
`upgrade` is passed to `allowance` and written to the lay metadata (`TrackLayDetails.upgrade`)
and to the track step's lay (`TrackStep.lays[].upgrade`). Both fields are written only when
`colorSkip` applied. Otherwise the lay records no `upgrade`, and a title judges upgrades by
tile colour, as every other title does.

**18USA.** From phase 5, plain track skips colours at $10 for each colour skipped, and counts
as an upgrade. A green city on an empty city hex counts as a lay, and so does a company's
brown home city before it first operates. A Company Town or Regional HQ tile is allowed in any
phase (§12.2.4, P16, P27). 18USA's allowance reads `lay.upgrade` first and falls back to
colour.

**Survey.** The shared reference rule advances one colour. Only four titles override it:

- 18USA skips colours as above ([reference][usa-colors]).
- 18GB lets special green construction skip yellow at named places, and allows blue to blue.
- 18Zoo skips colours on home hexes.
- 21Moon puts yellow on its special colours.

The 18GB and 18Zoo profiles record their skips under `upgrade-preservation`. The upgrade
count is never decided by colour alone. 18USA counts some skips as lays and others as
upgrades, which is why the title returns `upgrade`.

**Shared versus title-owned.** The family owns the colour arithmetic, keeping stops on a
skip, the cost sum and the recorded flag. The title owns which skips are allowed, their price
and whether each one counts as an upgrade.

**Later.** 18GB's and 18Zoo's skips would be `colorSkip` returns limited to their hexes.
Private-power lays (`extraLays`) do not record `upgrade`, because no allowance counts them.

**Verified by.** `games/18usa/src/operations.spec.ts`: "lays a green city on an empty city hex
and skips colours of plain track for $10 each" and "lets a company yet to operate lay a brown
home city as a free action".

## 2. Passing full cities: `passesStations` for track, routes and station placement

**Hooks.** `RouteRules.passesStations` came before 18USA: 18RoyalGorge's Hanging Bridge Lease
(G3) and 1860's bankrupt companies' stations use it. 18USA adds the same predicate to
`TrackRules`. `ConstructionReachability` takes it as a fifth argument, so a full rival city it
names no longer stops the company's construction network. `trackReachability(state, rules,
companyId)` builds that network from the track rules, so track construction and title code
that checks reach (18USA's private powers and `TurnDenver`) trace the network the same way.

**18USA.** A Company Town never blocks another company's routes or track (P27, BGG ruling
PR-27). The reference gets this by filling one of its two slots with a neutral token. Both
rules objects name the Company Town.

**Survey.** Under `station-blocking`, "blocks" depends on what is being decided. 1866, 1873
and 18ESP ignore blocking for one named graph. 18SJ's electric trains pass through
SJ-controlled cities. The reference's shared city rule never lets a neutral token block
([city][city-blocks]).

**Shared versus title-owned.** The family owns the blocking rule and where each graph asks
for its exception. The title owns which cities are passable, and for whom.

`StationRules.passesStations` gives station placement the same exception: its `TrackNetwork`
continues through a city the title passes. 18USA passes a Company Town there too, so a full
Company Town never blocks another company's reach to a city beyond it.

**Verified by.** `libs/18xx/src/construction/trackNetwork.spec.ts`: "builds through a full
rival city the rules let the company pass". `games/18usa/src/routes.spec.ts`, "Company Town
(P27)": "never blocks another company's routes or track".

## 3. Dealt revenues: `TileInventory.dealtRevenues`

**Hook.** This optional record maps location ids to a `TileRevenue`. `RailwayMapState` sets
that revenue on every stop of a printed face that is not a junction. A placed tile ignores it.
`TileSet.replace` carries the record forward, and the map renderer draws the dealt value.

**18USA.** Each red area's value token is dealt at setup (§2.6). P6 Import/Export Hub later
overwrites one area's entry with its own token. The field is therefore "revenue dealt onto
printed stops", and a power can deal it in play as well as at setup.

**Survey.** Under `setup-variation`, 18USA's `random-selection` is the only randomized
offboard value in the catalog. Other titles that vary printed values do so by phase or colour
(`phase-stop-values`), which the face's staged revenue already handles. The value belongs to
the inventory, not the map definition: the map stays the title's constant, and the inventory
is already the state that setup varies (`variantId`).

**Limit.** Only printed faces take dealt revenue, which is enough for unbuildable red areas.
A title that deals revenue onto buildable hexes would need the value to survive an upgrade.

**Verified by.** `games/18usa/src/map.spec.ts`: "values each red area from its dealt token".
`games/18usa/src/setupData.spec.ts`: "deals a different value token to each red area".

## 4. Route shape: `stopGroupRouteLimits`, `endsRoutes`, `forbidsHexReentry`, `uncounted`

**Hooks.**

- `stopGroupRouteLimits: Record<group, number>` caps how many of a run's routes may stop in a
  stop group. `RouteEvaluation.overStopGroupLimit` checks it per run. The autorouter encodes
  the caps as the solver's `group_route_limits`, and the solver holds the run to them in its
  one search, for any number of groups; see "Stop-group route limits in the search" in
  [the autorouter design](autorouter-design.md).
- `endsRoutes(state, companyId, center)` returns false where a route may pass a stop but may
  not begin or end there. It drives the evaluation and the solver's `endpoint` flag.
- `forbidsHexReentry(state, locationId)` now takes the hex. The evaluation checks only the
  hexes it names. The solver gets `no_reentry` when every hex forbids re-entry and
  `no_reentry_hexes` otherwise. 1860's one-argument function is still valid.
- A stop's existing `uncounted` flag (1822's English Channel) now also sits outside the
  paying-stop limit. `payingRouteStops` chooses its best set among counted stops, and
  uncounted stops always pay. The solver's train gets `uncounted` when a paying limit applies.

**18USA.** At most two routes run to Mexico (§12.4.1). A rural junction is an uncounted $10
stop that never ends a route (P26). A train passes a resource tile only once, however many
exits it has (§13, BGG ruling RT-5).

**Survey.**

- Cross-route limits (`fleet-route-constraints`): 18USA's Mexico cap is the only one keyed to
  a place. 1822 and 1866 limit L trains per station token, and 1877 Stockholm pays a shared
  stop once. These are differently shaped, and none of them fits a per-group count.
- Route ends: 1860's halts are already a fixed family check (`isHalt`), and 1822's E trains
  use `stopsAt`.
- Hex re-entry (`route-track-reuse`): the 1817 family's check is on stop hexes (the reference
  uses `route.hexes`), which this repository models as `oneStopPerHex`. True per-hex re-entry
  is 1860 (every hex, by option) and 18USA, which forbids it on resource tiles and rural
  junctions. A route that re-enters a rural junction already fails, because it would visit
  the junction's one stop twice.
- Distance (`route-distance-metric`): the many "towns free" metrics belong to the train. An
  uncounted stop belongs to the stop.

**Limits.**

- The solver counts a cap among the trains of one search. A title that pairs a cap with a
  fleet policy, a required route, or station-run or track-sharing trains, which are routed
  in searches of their own, is rejected until the count is carried across those searches.
  No researched title pairs them.
- Halts could become an `endsRoutes` default, but they stay a fixed check for now.

**Verified by.**

- `games/18usa/src/routes.spec.ts`: "allows no more than two of a company's routes to Mexico
  in a run" and "lets a train pass a resource tile only once, however many exits it has".
- `libs/18xx-autorouter/src/autorouter.spec.ts`: "holds a run to its stop group limits in one
  search, which proves it" and "proves the best run of %s trains within the limits %o".
- `libs/18xx-autorouter/rust/tests/correctness.rs`: "only so many routes stop in a limited
  group" and "limited groups agree with the permutation oracle on generated graphs".
- `libs/18xx/src/routes/routeEvaluation.spec.ts`: "forbids re-entering only the hexes the rules
  name".
- `libs/18xx-autorouter/src/passingStops.spec.ts`: "keeps routes out of only the hexes that
  forbid entering them again" and "turns back a route only where it would enter a forbidden
  hex again".
- `libs/18xx/src/routes/routeScoring.spec.ts`: "choose among the stops that count, paying
  uncounted ones besides and blocked passes never".
- `libs/18xx-autorouter/src/routedApart.spec.ts`: "passes an uncounted stop without using the
  train's distance".
- `games/18usa/src/tiles.spec.ts`: "makes rural junctions uncounted stops without stations".
- `games/18usa/src/routes.spec.ts`: "lets no route begin or end at a rural junction".

Related: `PaidConnectionBonus.requires` lists places a route must also stop at for a bonus,
as P17 Great Northern's second $30 does. It is checked by "pays $30 for Fargo and Helena, $30
more when the same train also runs Seattle and Chicago".

## 5. Blocked-city passes: `RouteRevenuePolicy.passesBlockedCity` and `blockedCityPasses`

**Hooks.**

- `RouteRules.blockedCityPasses(state, companyId)` already existed for 1860. It is a fleet
  allowance: how many tokened-out cities all the company's routes may run through in one run.
  A city passed this way still counts toward distance and still pays.
- `RouteRevenuePolicy.passesBlockedCity` is new and belongs to one train. That train may run
  through one tokened-out city, which is marked `blockedPass`, pays nothing and is left out of
  the paying-stop choice. The solver receives it as the train's `blocked_passes: 1`.

**18USA.** P19 switching makes the switched train one stop longer, pays all of its stops but
one, and lets the city it treats as plain track be a full one (P19, BGG ruling PR-19a). The
title sets `passesBlockedCity` together with `payingStopLimit` for that train.

**Survey.**

- 1860 lets one train in a run bypass one tokened-out city, and that city pays as usual
  ([1860][1860-bypass]).
- In the 18USA reference, the switcher's skipped stop is the blocked one when there is one,
  and is otherwise the stop whose loss costs least ([18USA][usa-switcher]).
- 18Zoo's Wings passes a blocked city that pays nothing and counts no distance
  ([18Zoo][zoo-wings]).

**The relationship, stated honestly.** The two hooks overlap. Both relax `passageBlocked`
for intermediate cities, both count passes in the same loop in
`RouteEvaluation.evaluateFleetRoute`, and the solver has a `blocked_passes` field at both the
problem level and the train level. They differ in scope (the fleet or one train) and in
payment (the city pays, or it pays nothing).

When a train has both, the first blocked city always uses the train's own pass, whichever
assignment would earn more. No surveyed title has both, so this order is an intentional
limit, not a rule. `passesBlockedCity` also leaves the passed city counting toward distance.
That is right for P19, whose extra stop covers it, but 18Zoo's Wings would also need the
passed city uncounted.

**Follow-up.** Merge the two into one blocked-pass declaration with its scope (fleet or
train), its count, and whether the city pays and counts. The merge was deliberately left out
of this slice.

**Verified by.** `libs/18xx/src/routes/routeEvaluation.spec.ts`: "lets a train run through
one blocked city on its own allowance, which pays it nothing".
`libs/18xx-autorouter/src/autorouter.spec.ts`: "runs a switched train through one blocked
city unpaid, paying an uncounted junction beside its limit". The fleet allowance:
`passingStops.spec.ts`, "rejects subsidies and shared blocked passes that no fleet policy
weighs", and `games/1860/src/autorouter.spec.ts`.

## 6. Markers counted as stations: `SizedCompanyStationRules.limitMarkers` and `RemoveStationMarker`

**Hook.** `limitMarkers: { held(state, companyId), giveUp(state, companyId, marker) }`.
`SizedCompanyStations.limitedStations` counts held markers with the company's stations. Every
limit check reads that count: buying owed stations, conversion and merger previews, and
trimming. In `ReducingStations`, the president may give up a marker instead of a station by
sending `RemoveStationMarker { companyId, locationId, kind }`. `giveUp` applies the title's
consequence.

**18USA.** P8 Express Freight's marker in a red area counts as one of the company's eight
stations. Giving it up removes it from the map and discards P8 (P8, PR-8). P23 Bailey Yard,
P27 Company Town and the Free Station subsidy all check the same count.

**Survey.** No other surveyed title counts a non-station marker toward a station limit. The
1817 family's limit counts only stations. The hook stays a single optional object, not a
general asset model.

**Limit.** The family trims unplaced stations first. The marker can go only when a placed
station is the alternative ([title design](../../games/18usa/title-design.md), Limits).

**Verified by.** `games/18usa/src/stationLimit.spec.ts`: "counts toward the eight stations,
so P8 places it only below eight" and "may be given up when a merger takes its company over
eight, discarding P8".

## 7. Bank train price: `TrainRules.bankPrice`

**Hook.** `bankPrice(state, companyId, definitionId, printed)` sets the price of a train
bought from the depot or the open market. An exchange keeps its own `exchangePrice`.

**18USA.** P25 American Locomotive takes 10% off the bank's trains, Pullmans included, as the
rulebook's "all trains" says. `pullmans.ts` calls the same hook.

**Survey.** Under `train-acquisition`, the reference's `train_discount` ability appears in
18JPT, 18Norway, 18NY, 18Mag, 18USA, 1848, 18MO, 1858 India, 1812, 18MS, 18MT, Steam Over
Holland, 18AL, 18VA and 18SJ ([18USA's][usa-discount]). The discounts are a fixed amount or a
percentage, and they apply to listed train kinds, sometimes once. Trade-in discounts are
schedules on the exchange, which `exchangePrice` already covers.

**Shared versus title-owned.** The family owns where the price is fixed. The title owns the
discount, which trains it applies to and any once-only use.

**Verified by.** `games/18usa/src/privatePowers.spec.ts`: "takes 10% off its company's bank
trains, Pullmans too, and no other company's".

## 8. Phase at round end: `OperatingRules.phaseAtRoundEnd`

**Hook.** `phaseAtRoundEnd(state)` returns `{ phaseId, definitionId }` or `undefined`. It is
read as the operating round ends, with that round's exports. If the exports have not already
started a phase, `ExportTrains` prepares the named phase change (`round-end:<set>.<round>`)
and records `toPhaseId` in its metadata. The system Action now runs when either an export or
a phase is due (`exportAwaited`).

**18USA.** Phase 3 begins as the second operating round ends if no 3-train has started it
(§8). The 1817 Trains option turns this off ([reference][usa-export]).

**Survey.** Phases usually start with a train's first purchase or export. Phases that start
without a train are rare: 1840 at fixed operating rounds ([1840][1840-phase]), 18MS as OR2
starts ([18MS][ms-phase]), 18Mag after rounds without a train purchase ([18Mag][mag-phase]),
1873 after a stock round, and 18Carolinas on its own trigger.

**Limit.** The hook covers changes at the end of an operating round, which fits 18USA and
18Mag, and 1840 and 18MS once read as "after the previous round". Phases that begin after a
stock round, like 1873's, would need their own point in the round sequence.

**Verified by.** `games/18usa/src/exports.spec.ts`: "exports every 2 and 2+ in the first set
and begins phase 3 as it ends".

## 9. Loan rate tables: `LoanRateTable.loansPerRow` per row and `LoanRateTables`

**Hook.** `loansPerRow` may be a number or an array with one count per row. `rate` may be a
table, a function or `{ tableFor(state) }`, which picks the printed table from game state.
`loanRateTableRowLoans`, `loanRateTableRowStart` and `loanRateTable` give the shared UI the
rows it draws.

**18USA.** The Bank of New York mat has one side by player count. With five or more players,
its first row lends four loans at 5% and every other row lends six (§2.2,
[reference][usa-loans]).

**Survey.** Under `interest-rule`, only the 1817 family uses a debt-dependent schedule
(`system-wide-variable-rate`): 1817 lends five per band, 1817WO three, and 1817NA four. Other
titles charge a fixed amount per loan (1807, 1812, 1866, 18NY), a player-debt rate (1822,
18CZ) or no periodic interest (1848), and use the function form or no loans at all.

**Verified by.** `games/18usa/src/operations.spec.ts`: "uses the five-player mat: four loans
at 5%, six on each other row". `libs/18xx-ui/src/lib/loans/loanRateTable.spec.ts`: "fills
rows of different sizes, as a mat lending four at its first rate".

## 10. Selling from players: `StockRules.sellsFromPlayers`

**Hook.** `sellsFromPlayers(state, companyId)` tells the shared stock module which
player-held certificates of a company to list for purchase. The family logic does not read
it. A purchase stays legal or illegal by `purchaseTerms`, which prices the certificate and
names who receives the money.

**18USA.** Under the no-60% variant, a president may pass 60% in stock rounds. Others may buy
a president's share above 60% at 10% over the price, rounded up, while no other share is for
sale (§17, VA-2, MA-4). The title derives `purchaseTerms` and `sellsFromPlayers` from the same
predicate, so the list and the rule agree.

**Survey.** The reference has two flags. `BUY_SHARE_FROM_OTHER_PLAYER` is used by 1835 and 1841. `CORPORATE_BUY_SHARE_ALLOW_BUY_FROM_PRESIDENT` is used by 1832, 1850, 1870, 18CO and
18MT, and 18Neb has its own rule ([base][gain-from-player]).

**Limit.** The predicate is per company, not per buyer. For 1870-style purchases, where a
company buys from its own president, the list would also show certificates other buyers
cannot take. `purchaseTerms` refuses those, and the UI shows them as unavailable.

**Verified by.** `games/18usa/src/companyAuction.spec.ts`, "no 60% president limit (§17)":
"sells a president's share at 10% above the price once no other share is for sale" and
"sells nothing from a president without the variant".

## 11. Stations from the supply: `PrivateTokenTerms.fromSupply` and `addCompanyStations`

**Hooks.**

- `PrivateTokenTerms.fromSupply: true` makes `PlacePrivateToken` add a new station to the
  company's charter and place it, instead of placing the company's next unplaced station.
  Without the flag, the power still needs an unplaced station, as before.
- `PlacePrivateToken` now also refuses a power already used (`privatePowerUsed`) for every
  title. Before, each title's `tokenTerms` had to check this itself.
- `addCompanyStations` now returns the ids it adds. Callers that ignore the return value are
  unaffected.

**18USA.** The Free Station subsidy places one extra station from the supply into any
reachable city, full cities included, and is unavailable at eight stations. P20 Suem & Wynn
places one of the company's own stations. The Company Town's bonus station is also added and
placed through the returned id.

**Survey.** The reference's token ability has the same split: `from_owner` takes the
company's own token, and its absence creates a new one ([ability][token-ability]). Powers
that place the company's own token include those of 1835, 1856, 1882, 1894, 18GA, 18MEX, 18MO
and 18NL. Powers that add a new token include those of the 1817 family (Train Station), 1822,
18FL and 18VA (`special-stations` "with an extra slot"). Some titles, 18FL among them, have
both kinds.

**Later.** Extra slots, teleport prices and discounts in the reference's token ability are
not modelled. 18USA's full-city placement uses the existing `sharesFullCities`.

**Verified by.** `games/18usa/src/privatePowers.spec.ts`, "the Free Station subsidy": "places
one extra station from the supply, so a company holding only its home uses it". The returned
ids are also used by the Company Town placement.

## Compatibility

Every new field is optional. A stored game in another title never writes `upgrade`,
`dealtRevenues`, a per-row `loansPerRow` or `RemoveStationMarker`, and its runtime contract
changes only by these additive schema fields
([1817 note](1817-family-mechanisms-design.md#compatibility-and-verification)).
`PlacePrivateToken`'s used-power check rejects only Actions that each title's `tokenTerms`
already refused.

## Resolved since review

- **Company Town and station placement:** `StationRules.passesStations` (§2), verified by
  `libs/18xx/src/stations/stationPlacement.spec.ts` "reaches past a full city the title lets
  the company pass through".
- **P19 and the company's only station:** a switched train's policy sets
  `requirePayingStation`, so its unpaid stop is never its only station city. Verified by
  `games/18usa/src/routes.spec.ts` "never treats the train's only station city as the plain
  track it passes".
- **Untested hooks:** `endsRoutes` (§4) and `bankPrice` (§7) now have specs.

[usa-colors]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_18_usa/game.rb#L514-L531
[city-blocks]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/part/city.rb#L37-L44
[1860-bypass]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1860/game.rb#L935-L962
[usa-switcher]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_18_usa/game.rb#L840-L895
[zoo-wings]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_18_zoo/game.rb#L1390-L1400
[usa-discount]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_18_usa/entities.rb#L515-L519
[usa-export]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_18_usa/game.rb#L646-L662
[1840-phase]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1840/game.rb#L412-L414
[ms-phase]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_18_ms/game.rb#L231-L234
[mag-phase]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_18_mag/game.rb#L458-L464
[usa-loans]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_18_usa/game.rb#L209-L216
[gain-from-player]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/base.rb#L1270-L1273
[token-ability]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/ability/token.rb#L8-L20
