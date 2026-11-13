# 1822: The Railways of Great Britain — title design

Rules authority: _1822 Rules of Play_ v2.0 (1 May 2018), saved with a text copy in
`/workspace/artassets/1822`. Section numbers below are the rulebook's. The research engine
(`g_1822`) supplied hex coordinates, terrain, borders, tile track layouts and counts only, checked
against the rulebook; where the two differ the rulebook wins and the difference is listed under
"Data notes".

Scope: the base game for 3–7 players (minors M1–M24, privates P1–P18, ten majors). Not built: the
1822+ expansion (its minors, privates and trains are in the data, flagged `expansion`, with nothing
switching them on), the regional scenarios, the tax haven variant (§6.1.2) and the hidden-stack
variants (§6.1.1).

## What makes 1822 different

| Mechanism                                                                                    | Rulebook          | Family support                                                                                                        |
| -------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| Bidding boxes: bids placed in stock turns, lots bought when the round ends                   | §4.5, §4.9, §4.10 | New: `auctions/bidBoxes.ts` (`BidBoxRules`, `PlaceBids`, `SettleBidBoxes`, `BidBoxStockRoundHandler`)                 |
| Minor companies: one 50% certificate, half the earnings stay with the company                | §3.3, §5.14.9     | A four-share company whose second half never leaves its treasury pool; `EarningsRules.holderDividend`                 |
| Concessions converted to a director's certificate for £100 off, from phase 2                 | §3.2, §4.8        | Concessions are private-kind companies; conversion is the family `StartCompany` with title `startTerms` and `onStart` |
| Director's certificate bought outright from phase 5; float at 50%; full capital from 6       | §3.4.4–§3.4.7     | `CompanyRules.flotationPayments` and `onFloat`; treasury-share trading as 1846                                        |
| Stock round order by cash; P9 may declare double                                             | §4.10.5, §3.1.9   | `StockRoundRules.nextPlayerOrder`; title `DeclareCash`                                                                |
| Player loans at 50% interest for forced train purchases                                      | §4.2, §5.17       | New: `TrainFundingRules.recordLoan` (a contributor borrows the shortfall); title `playerLoans`, `RepayPlayerLoan`     |
| Unsold minors remove trains at each stock round's end; a train removed may start a phase     | §4.10.3           | Title settlement uses `TrainDepot.export` and `preparePhaseChange` back into the stock round                          |
| L trains: one station, optionally one small station; one per station token                   | §5.5.3            | New: `TrainDistance.stationRun`; routes with no track                                                                 |
| E trains: stop only at own stations, doubled, on track other trains use                      | §5.5.8–§5.5.11    | New: `RouteRules.stopsAt`, `TrainDefinition.sharesTrack`; `stopRevenue`                                               |
| Pullman carriages attached to a train each run                                               | §5.5.6, §5.5.14   | New: `TrainDefinition.attachment`, `TrainRoute.attachmentIds`, `RouteRules.attachedDefinition`                        |
| Destination tokens; one train a turn doubles the destination                                 | §5.11             | Title `ReachDestination`; new `PaidConnectionBonus.oncePerRun` and `nodeIds`                                          |
| Mail contracts pay the treasury half a run's two ends                                        | §3.1.12           | New: `RouteRules.runSubsidy` (`OperatingResult.subsidy`)                                                              |
| L/2 and 7/E double-sided cards; an L flipped to a 2 for £80                                  | §5.5.7, §5.5.8    | Depot `variantDefinitionIds`; `exchangePrice`; new exchange destination `'depot'` (`TrainDepot.restock`)              |
| 2P, LP and Pullman neither count for the limit nor as the train a company must own           | §5.5.13, §5.5.14  | `countsForLimit`; new `TrainRules.satisfiesRequirement`                                                               |
| Grey terminus cities with station spaces                                                     | §5.4.4            | New: `TilePath.terminus`                                                                                              |
| Merthyr Tydfil–Pontypool: the far city ends the route                                        | §5.4.7            | The same terminus track, on one physical connection                                                                   |
| Mid Wales and English Channel–France: parallel tracks across one hex side                    | §1.2.4, §5.9.2    | New: lanes on edge endpoints (`lane`)                                                                                 |
| The English Channel station counts as one stop with France                                   | §5.4.6, §5.13.7   | New: `TileNode.uncounted`                                                                                             |
| London: six stations in one hex, a route includes London once                                | §5.4.2, §5.10     | Location `stopGroup`; the London "upgrades" are tiles X20–X23 laid without rotation                                   |
| Metropolitan Railway's home beside a London station; destination tokens beside a full city   | §5.10.3, §5.11.8  | A station at the slot after a city's own; station counting now ignores such stations (`cityIsBlocked`, `hexSpaces`)   |
| Swansea's printed small station goes under the first yellow tile; P2 removes a small station | §5.8.4, §3.1.14   | New: `TrackRules.removedStops`, `PrivateTrackTerms.removedStops`                                                      |
| P11 lays the next colour early; P12 lays extra tiles                                         | Table 3           | Family `LayPrivateTile`; new `PrivateTrackTerms.colors`                                                               |
| Major acquires a minor for shares and cash, with exchange tokens                             | §5.18, §5.19      | Title `AcquireMinor`; `closeShareCompany`; ownership exemptions                                                       |
| Issue or redeem shares after buying trains                                                   | §5.20             | `CorporateFinanceRules` with `timing: 'after-trains'`                                                                 |
| Six-exit city tiles before five-exit ones                                                    | §5.8.17           | `TrackRules.mostExits`                                                                                                |
| Game end: share value 700, bank broken, nothing sold in the first stock round                | §1.3              | `EndingRules.trigger` with `finalOperatingRound`                                                                      |

## Family surveys for the new family assets

Surveyed against the researched catalogue (`/workspace/research/18xx-2026-09-08`); TOP and 1889
remain the executable baseline and every existing title's suites still pass.

- **Bid boxes** (`BidBoxRules`). Lots bid on through a stock round and bought as it ends appear
  in the whole 1822 family (1822, CA, MX, PNW, Africa and the regional scenarios); the Lawson
  auction's ancestors (1848) auction once at the start, which the waterfall and selection auctions
  cover. Shared: boxes holding lots drawn from stacks, a bid as a turn's alternative to a purchase,
  bids topping bids in fixed increments, a bidder's tokens, cash committed by highest bids, and
  settlement in highest-bid order before the round completes. Title: which lots, face values,
  tokens, what winning a lot gives, what happens to unsold lots, refilling. Not done: bids that
  can be withdrawn, sealed bids.
- **Lanes** (`lane` on an edge endpoint). Parallel tracks across one hex side appear in the 1822
  family, 18Mag, 1860's ferries and others. Shared: a lane meets the same lane across the side
  and is its own track resource; reach, route tracing, the autorouter and construction all follow
  it. Title: where they are printed. Not done: a tile whose single track should join a specific
  lane other than the first.
- **Terminus track** (`TilePath.terminus`). Stops a route may start from but not run through,
  while still holding station tokens, are common as "terminal" paths in the catalogue (1822
  family, 1867/1861 offboards with tokens, 18Chesapeake's none). Shared: arrival ends the route;
  departure is free; reach opens a terminus stop's exits only for a company that starts there or
  passes the stop on other track. Title: which paths. Limit recorded in `routeReach.ts`: a route
  that passes a stop to leave on its terminus track is not checked against the track it came by.
- **Uncounted stops** (`TileNode.uncounted`). Stops that use none of a train's distance appear as
  `visit_cost: 0` across the catalogue (1822 family, 18Mag, 1867). Shared: distance and the
  autorouter's visit costs. Title: which nodes.
- **Station runs** (`TrainDistance.stationRun`). Trains that run at a single station appear in
  the 1822 family's L trains and 1860-style locals differ (they need two stops). Shared: a route
  with no track at a company station, one such train per station. The autorouter lists a
  station-run train's few runs and routes the rest of the fleet beside each choice that could
  still win. Limit: runs are searched from the station outward, which is exact while such a train
  has at most one stop other than towns.
- **Trains that pass stops** (`RouteRules.stopsAt`, `TrainDefinition.sharesTrack`). 1822's E
  train, 1826's TGV and E trains, 18Ireland's are the catalogue's examples of trains that stop at
  a subset of the route's stops; track sharing between a company's own trains exists in 1862 for
  the whole fleet. Shared: unpaid, uncounted passed stops, ends at stopping stops, a per-train
  exemption from track conflicts. Limit: such a train must share track, since the autorouter
  routes it in a search of its own.
- **Attached rolling stock** (`TrainDefinition.attachment`, `TrainRoute.attachmentIds`). Pullmans
  and similar carriages appear in the 1822 family and 1873-style wagons. Shared: stock that never
  runs alone, attached per run, the title saying how the train then runs. The autorouter tries
  each distinct attachment.
- **Once-a-run bonuses** (`PaidConnectionBonus.oncePerRun`, `nodeIds`). Destination bonuses that
  one train earns appear in the 1822 family; 1870's destinations are a different mechanism
  (connection runs). Shared: the route worth most keeps the bonus. The autorouter first gives it
  to every train and, if more than one route earns it, routes each train as its only earner.
- **Run subsidies** (`RouteRules.runSubsidy`). Money paid to the treasury for a run beside its
  revenue: 1822's mail contracts, 1862's local subsidies (which stay in its fleet settlement).
  Shared: the subsidy on the operating result. The autorouter optimises revenue and reports the
  subsidy of the run it found (§5.13.6 lets a director run for mail instead; they can by drawing
  the route).
- **Borrowing in emergency funding** (`TrainFundingRules.recordLoan`). Player loans appear in the
  1822 family and 1873; 1817 and 1849 lend to companies through `LoanRules`. Shared: a
  contributor whose cash and sales are spent borrows the rest instead of going bankrupt. Title:
  interest and repayment.
- **Removed stops** (`TrackRules.removedStops`). Tiles that drop a stop: 1822's Swansea and P2;
  1860 and 18Ireland-style town removal. Shared: the replaced face is kept without the removed
  stops, track through one running on between its other ends.
- **Stations beside a full city**. 1894 already lets a set-aside station join a full city
  (`sharesFullCities`); 1822 adds the Metropolitan Railway's roundel space and overflowing
  destination tokens. Shared: a station at a slot past the city's own takes none of its spaces
  when counting free spaces and blocking; when an upgrade adds a space the station is within it.

## Rulings and interpretations to confirm with the owner

1. **London's six neighbouring hexes** (§5.10.7): a yellow tile there must join the London
   station's track. The rulebook instead asks for the adjoining company's director or concession
   holder to agree; no consent step is built.
2. **A company acquires only its own director's private companies** (§3.1.2 allows any
   consenting player's). A major acquiring a minor that another player directs makes an offer on
   its chosen terms, which that director accepts or declines; a declined minor takes no second
   offer that turn (§5.18.1 asks only that the directors agree).
3. **2P revenue is pooled** with the other trains' for the dividend decision; §5.14.2 lets it be
   paid, split or kept separately.
4. **Cash committed to highest bids cannot be spent on shares** or a director's certificate
   (§4.9.3 states the commitment only for bidding).
5. **A run from an English Channel station to France alone** is accepted as a route of two stops,
   though the Channel station counts as none (§5.4.6, §5.13.1).
6. **An unpaid loan is deducted from final wealth** (§1.3.2 is silent).
7. **Loans are repaid automatically from income during operating rounds** (§4.2.2 example) and by
   a player's choice in a stock turn (§4.1.3).
8. **A minor company reaching the game end value ends the game** as a major does (§1.3.1 says "a
   company's").
9. **The train removed with an unsold box-1 minor** counts as an L while L/2 cards remain, so it
   starts no phase; once they are gone it is the next train and may start one (§4.10.3).
10. **A destination token is placed on the company's own turn** after its track step, also when
    another company's track made the connection earlier (§5.11.1, §5.11.2).
11. **P9's declaration is asked for only when doubling would change the order.**
12. **P8's and P10's tokens are declared before the lay** they pay for (`UseDiscountToken`);
    P10's estuary tokens pay for as many crossings of that lay as the company holds tokens for.
13. **P5's upgrade-and-token** use when the Channel has no free space (§3.1.17) and **P2 with
    P11 in one lay** (§3.1.13) are not built.
14. **A second station of one company in London** by ordinary placement is not possible (the
    family allows one station of a company in a hex); exchange tokens taking over London minors
    are placed.
15. **No route-maximisation check** (§5.13.6), as in the other titles.
16. **Merthyr Tydfil–Pontypool** is one track through E32 that ends the route at the city it
    reaches; the research engine's second, direct track is left out.

## Data notes

- M9 East Lincolnshire's home is Grimsby N23 (the rulebook's table prints N29); M29's is Mid Wales
  E28 (printed F28); M2's is E2; M23's is Cornwall A42 (the table calls it Plymouth).
- M16 is the London & Birmingham Railway, as rulebook v2.0 names it.
- Folkestone is spelled correctly.
- Private initials for P16 and P19–P21 are not in the rulebook; company colours are approximate.

## Verification

- `games/1822`: map, tile, market, train and company data specs; bidding, stock, operating,
  route and acquisition specs with the rulebook's examples (Table 5; §5.18.4's terms; §5.20.2's
  issue; §5.8.4's Swansea and Mumbles runs; §5.17.2's loan); conformance specs; whole games played
  by a seeded bot for 3–7 players.
- `libs/18xx`: reach and tracing specs for terminus track and lanes.
- `libs/18xx-autorouter`: specs for terminus track, lanes, uncounted stops, station runs, trains
  that pass stops and share track, attachments, once-a-run bonuses and run subsidies.
