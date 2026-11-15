# 1822: The Railways of Great Britain — title design

Rules authority: _1822 Rules of Play_ v2.0 (1 May 2018), saved with a text copy in
`/workspace/artassets/1822`. Section numbers below are the rulebook's. The research engine
(`g_1822`) supplied hex coordinates, terrain, borders, tile track layouts and counts only, checked
against the rulebook; where the two differ the rulebook wins and the difference is listed under
"Data notes".

Scope: the base game for 3–7 players (minors M1–M24, privates P1–P18, ten majors), and as game
options the 1822+ expansion (§2.1.7, §6.2.2: minors M25–M30, privates P19–P21, a stack for each
private bidding box), its two setup choices (§6.1.3: all 21 privates; one mixed private stack),
the tax haven variant (§6.1.2) and the six scenarios of §6.2.1. See "Game options" and
"Scenarios" below.

Not built:

- **The hidden-stack variants** (§6.1.1: stacks not inspected, or only the next batch seen). They
  would make 1822 a hidden-information title: a canonical state with the stack order protected,
  secret shuffles, a sampler for exploration, and a ruling on what P17's holder sees. The family
  has that path (1846 uses it for its draft), but nothing in 1822 uses it yet.

## Game options

`definition/gameConfig.ts` offers five options; `variants` in the title state records the ones in
play, and the two 1822+ setup choices count only with 1822+.

- **1822+** (`plus`): the six further minors join the minor stack under the S&MR; P19–P21 join the
  privates. One "track" private other than P5 and two of the "other" privates are removed at
  random and recorded in `removedPrivateIds` (they exist as closed companies with no certificate,
  so nothing that asks after a private by id needs to know it was removed). Each private bidding
  box has its own stack, named for its box (`private:1` trains, `private:2` track, `private:3` the
  rest), P1 on top of the first: a box fills only from its own stack and private certificates do
  not move down the boxes. P17 moves a certificate within the stack it lies in.
- **All 21 privates** (`allPrivates`): no removals.
- **One private stack** (`mixedPrivates`): the privates left after the removals are shuffled into
  the one `private` stack under P1 and fill the boxes as in the original game. The removals still
  happen unless "all 21" is also chosen, as the research engine has it; §6.1.3 does not say.
- **Tax haven buys further shares** (`taxHavenShares`): the haven's first share is bought with its
  owner's money as always. After that its own money, and only that, buys further shares: one a
  stock round (`taxHavenPurchaseRound`), never a second certificate of a company, each purchase
  being the owner's stock action. That the owner's money buys no further share is the research
  engine's reading of "the cash that accumulates in the tax haven can be used".

- **Scenario** (`scenario`): one of the six scenarios of §6.2.1; see "Scenarios" below.

P21 (the Humber bridge): up to two lays, one in Hull and one in Grimsby, each adding track across
the Humber, free of terrain and estuary costs; yellow tiles, and from phase 3 one of the two may be
a green upgrade of a tile already there (a tile laid with the power that turn is not upgraded with
it). The company needs a station in either city, must not have laid track that turn, and lays no
ordinary track after it; P12 may still add its lays. P21 closes with its second lay, or with the
track step if it made one. The lay need not join the company's route: the rule asks for a station
in either city and nothing else.

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
  can be withdrawn, sealed bids. Each bid is one `PlaceBids` Action (one press, one Action): the
  turn stays open until it has placed the title's `bidsPerTurn` (§4.9.1's three), counted in
  `bidBoxes.turnBids` and dropped as the turn ends; the stock turn record is every title's, so the
  count lives with the boxes. A `PlaceBids` may still carry several bids, as earlier saved games
  do. The UI prepares one bid at a time, inside its box.
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
- **Naming a run subsidy** (`TitlePresentation.runSubsidyName`). Ten catalogue titles compute a
  payment to the treasury for a run beside its revenue (the engine's `routes_subsidy` in 1822,
  1837, 1860, 1862, 1866, 1888, 18ESP, 18Mag, 18VA and 18ZOO); what each calls it was not
  surveyed beyond 1822's mail and 1862's subsidy. Shared: where the amount shows (run table,
  messages, history). Title: the name; "subsidy to the treasury" where it gives none.
- **Stacks by box, and lots not in the game** (`BidBoxGroup.boxStacks`, `removed`). Only the
  1822 family has bid boxes (1822, Africa, CA, MX, PNW, MRS). 1822+ fills each private box from
  its own stack; how the other family titles stack their boxes was not surveyed. Eleven
  catalogue titles' rules announce components removed from the game. Shared: the list of what
  is still to come, one list a box where the title says so, and the removed lots named beneath.
  Title: which stack fills which box (`sharedStack1822`, `boxStack1822`), and what was removed.
- **What a held private keeps** (`TitlePresentation.privateHoldings`). The tax haven, which
  holds shares and money for its owner, appears in every 1822-family title and nowhere else in
  the catalogue; other privates that hold things were not surveyed. Shared: one line under the
  private on its holder's card. It stands apart from `privateStatus`, which replaces a private's
  income on a company card.
- **Printed connections** (`TileLayout.printedPaths`, `printedTrack`). Spikes for off-board
  entries are catalogue-wide; the layout option already let a title print a named track as a
  spike or a port's pier. Added for 1822: a spike on a track that runs from side to side, and
  `hidden` for a track the print does not draw, both used by the Southwest England overlay,
  whose second hex prints two arrows that stand for tracks running on to the station; and
  `printedTrack`, track the print shows that no route uses, for Merthyr Tydfil and Pontypool,
  whose one connection prints as two pointed tracks. Not surveyed beyond 1822.
- **Tile set variants** (`TileSetVariant`, `TileInventory.variantId`). A supply chosen at setup
  that also prints tiles on the board: 1822's scenarios, whose overlays stand on the map and
  whose games play without part of the tile manifest. The train depot already had
  `supplyVariants` and `depotId`. Shared: the inventory records the variant's id; its board tiles
  stand under whatever play lays and are definitions of the set with no pieces in its supply, so
  no lay can offer them; its removed pieces, the last of each definition, are never available.
  Title: each variant's board and removals. Nothing of either is stored in a game.
- **Board tiles** (`MapViewDefinition.boardTiles`). Tiles on the map from setup that are not of
  the supply: 1822's scenario overlays. Nineteen catalogue titles vary their board's hexes by
  option (the engine's `optional_hexes` and `game_hexes`, among them 1824, 1825, 1840, 1860,
  1873, 18Mag, 18MEX and 18USA); how each does it was not surveyed. Shared: such a tile is left
  out of the manifest, may name its hex, and may mark it out of play (not drawn, board fitted
  without it). Not done: a board that adds hexes or moves its panels by option; 1822's panels
  keep their places.
- **Borrowing in emergency funding** (`TrainFundingRules.recordLoan`). Player loans appear in the
  1822 family and 1873; 1817 and 1849 lend to companies through `LoanRules`. Shared: a
  contributor whose cash and sales are spent borrows the rest instead of going bankrupt. Title:
  interest and repayment.
- **Removed stops** (`TrackRules.removedStops`). Tiles that drop a stop: 1822's Swansea and P2;
  1860 and 18Ireland-style town removal. Shared: the replaced face is kept without the removed
  stops, track through one running on between its other ends.
- **Printed hex art** (`TileLayout.inkGround`, `printedText`, `overhangs`, `slotSpacing`,
  `upgradeCostText`, `spikesTowardMiddle`). 1822's London is printed black with its name and
  upgrade cost in white and spikes reaching into the hexes beside it; the Metropolitan Railway's
  space overlaps the station it stands beside; the Highlands' station stands across its two
  hexes, so its spike points in from its side rather than at the station. Other titles' printed
  special hexes (1830's NYC, 1846's Chicago, 18Chesapeake's Baltimore) were looked at only in
  the family's existing layouts; none needs these yet. Shared: a hex in ink with its annotations
  in paper colour; text a tile prints; shapes past the hex drawn on the map over the board but
  under any tile laid beside it; two-space spacing; a bare upgrade cost with a currency sign;
  spikes aimed at the hex's middle. Title: the shapes and positions. Not done: overhangs in the
  tile manifest, which draws a tile alone.
- **Joined overlay tiles and draw order** (`MapViewDefinition.joinedTileEdges`, `drawnLast`).
  1822's southwest England overlay is one area across two laid tiles; printed areas spanning
  several hexes were already joined by location (`joinedEdges`). Shared: a laid tile's sides
  joined by its definition, and locations drawn after the rest so a station or values standing
  across a side stay above the hex beside it. Title: which tiles and locations.
- **Reserved cash** (`EighteenXXSession.reservedCash`). Cash a player's bids hold back: the bid
  boxes' highest bids (1822 family) and the opening waterfall auction's reserved bids (1830,
  1889 and the titles sharing that auction). Shared: one line under the player's cash on their
  card and their spreadsheet row; companies never bid. The waterfall panel already called it
  Reserved.
- **Unsold-lot notes** (`BidBoxGroup.unsoldNotes`). What a box's lot costs if no one bids on it:
  1822's minor boxes remove trains (§4.10.3). Only the 1822 family has bid boxes. Shared: a note
  in each box while it has no bid. Title: the words, from the trains left.
- **Place links that focus the map** (`GameTable` place links). Every 18xx title's place links
  outline the hex; an auto-zooming map now also zooms to it with about four hexes of context,
  and a second press returns the view. Title: which text names places.
- **Stations beside a full city**. 1894 already lets a set-aside station join a full city
  (`sharesFullCities`); 1822 adds the Metropolitan Railway's roundel space and overflowing
  destination tokens. Shared: a station at a slot past the city's own takes none of its spaces
  when counting free spaces and blocking; when an upgrade adds a space the station is within it.

## Scenarios

Source: the designer's print-and-play pack, "1822 Scenario Rules" version 1.0 of 15 July 2016
(sheets General, Cash and Shares, Train Mix, Tile Manifest, a read-me, and the overlays of 16 July
2016), supplied by the owner and kept in `/workspace/artassets/1822/scenarios`. The pack predates
rulebook v2.0 and 1822+; a scenario is played with the original companies and ignores the 1822+
option. `scenarios.ts` holds the table, each entry citing its sheet.

Three scenarios play on the whole map with companies removed at random (Medium, Short and Mini
Game), three on part of it with named companies removed (Large, Medium and Small Regional). Each
sets start money, bank, share limit, train counts and the share value that ends the game; all
take £10 off a minor's first-turn L train; four lower the price of flipping an L to a 2-train to
£70, two of them only from phase 2.

- **Companies removed** are never created; `removedCompanyIds` and `removedPrivateIds` name
  them. Random removal keeps P1 and the Metropolitan Railway. The majors are shuffled and taken
  in order, passing over one whose group (the four London companies; MR, L&YR and SWR; NBR, NER
  and CR) has already lost a company.
- **Track.** Medium and Short Game: a major lays two yellow tiles from phase 2, and from phase 3
  two yellow tiles or a yellow tile and an upgrade. Mini Game: from phase 3 three tiles, of which
  at most two are upgrades, and two upgrades in one turn are neither of a city.
- **The Metropolitan Railway** (Short and Mini Game) may take the station space of a London
  major that was removed: choosing that London station gives it the space itself rather than the
  roundel's.
- **Overlays** are grey tiles printed by the scenario (`overlays.ts`): Glasgow and Edinburgh,
  Southwest England and South Wales, each a station with values by phase reached along terminus
  track where the overlay prints an arrow. Southwest England is one station over two hexes with
  four arrows: its second hex carries two tracks that run on to the station side by side. Hexes
  an overlay covers or cuts off carry an out-of-play tile, which the board does not draw. A
  regional scenario's reduced tile manifest plays without the surplus pieces.

Each scenario that changes the board or the supply is a variant of the tile set
(`TileSet1822Variants`): its overlays, its out-of-play covers and its removed pieces follow from
the variant, and a game records only the scenario as its inventory's `variantId`. None of it is
in the supply manifest, so no lay can ever offer an overlay.

The pack calls the game end value a "Max Price", but markers are not stopped at it: a two-space
rise, or play to the end of the operating round, can carry one past. Every space of the value
or more counts as reached.

Readings of the pack that are mine:

1. **The share value that ends the game** follows the overlay, which colours four bands and is
   dated a day after the sheets: Small Regional £400, Mini Game £450, Large and Medium Regional
   and Short Game £500, Medium Game £550. The Cash and Shares sheet prints £500 for the Medium
   Game and £400 for the Mini Game. Any space of the value or more ends the game.
2. **Which hexes are out of play** is not listed anywhere; it is read off the overlays' hex
   labels. The northern Scotland overlay stands on G10 and J7 (with H9 and I8); everything north
   is out, and so is Galloway, whose only ways south are Carlisle's red-bordered side and G10.
   The southern Scotland overlay stands on H17 and K16 (with I18, J17 and L15); everything north
   of that line is out, Scarborough staying in. Southwest England stands on E38 and E40;
   everything west is out. South Wales stands on F35 with F33 and E34; Swansea, Fishguard and
   E36 are cut off behind it.
3. **Where the arrows enter**: Glasgow and Edinburgh from the hex south of each; Southwest
   England from F37, F39 (twice) and F41; South Wales from Newport alone.
4. **The Medium Regional starts with the Metropolitan Railway in the first box** though it keeps
   the S&MR, as the General sheet prints.
5. **"L&YR" and "LYR"** on the sheet are the one company.

## Rulings and interpretations

Checked against the research engine's 1822 (`g_1822`, the checkout dated 2026-09-08) on
2026-11-13. Where the two differed and the rulebook sided with the engine, this title was changed
to match; the owner confirmed those changes.

Readings this title keeps, each as the research engine has it unless noted:

1. **Cash committed to highest bids cannot be spent on shares** or a director's certificate, and
   those bids count toward the certificate limit (§4.9.3 states the commitment only for bidding).
2. **An unpaid loan is deducted from final wealth** (§1.3.2 is silent).
3. **A minor company reaching the game end value ends the game** as a major does (§1.3.1 says "a
   company's").
4. **The train removed with an unsold box-1 minor** counts as an L while L/2 cards remain, so it
   starts no phase; once they are gone it is the next train and may start one (§4.10.3).
5. **A destination token is placed on the company's own turn** after its track step, also when
   another company's track made the connection earlier (§5.11.1, §5.11.2).
6. **P9's declaration is asked for only when doubling would change the order.**
7. **P8's and P10's tokens are declared before the lay** they pay for (`UseDiscountToken`);
   P10's estuary tokens pay for as many crossings of that lay as the company holds tokens for
   (the engine spends one a lay).
8. **Every run earns the most possible** (§5.13.6): a company runs the best routes found. One
   that holds a mail contract, a permanent train or a Pullman may redraw its routes and move the
   Pullman to another train. A drawn run runs only if it earns as much as the best found, or,
   earning less, pays more mail income than the best found does: the rule's leave to reduce a
   run for mail. This is held by the game's screens; the logic accepts any legal run. The mail
   income compared is that of the one best run found, not of every run that ties with it.
9. **Merthyr Tydfil–Pontypool** is one track across the side the two share, ending the route at
   the city it reaches; with one track, only one train crosses a turn. The board prints the
   connection as two pointed tracks, one from each city into the other's hex (the illustration
   at §5.4.7), and E32 is off the map. The research engine models the two as one direct track
   and one through E32, and lets a company's trains use one of the two in a turn; the same runs
   are legal. An earlier version of this title had only the track through E32. A route runs on
   across the link only with a station of its company at or before the city it leaves: "the
   train starts at the token", so M20 at Pontypool cannot run Cardiff–Merthyr Tydfil–Pontypool
   (designer, BGG article 44435154, 2024). In the family this is `RouteVisit.leavesAlongTerminus`,
   and the autorouter's `departs_terminal` arcs (protocol 10).
10. **Agreement between two players is asked for in the game**: a major's offer for a minor
    another player directs (§5.18.1) and a company's request for a private another player holds
    (§3.1.2) wait for that player to accept or decline, and a refusal ends the matter for the
    turn. The engine takes the agreement on trust.
11. **A Pullman is never attached to an L-train.** The rulebook bars only the E-train (§5.5.6);
    the designer also bars the permanent L (BGG article 34859364, 2020), and this title bars the
    ordinary L too. Earlier versions of this title allowed both.
12. **A company's station already in its destination city becomes its destination station**
    when it connects, and its destination token stays off the map, as the LNWR's Manchester
    station does (§5.11.3). A company reaches its destination city before joining it to home only
    through an acquired minor company: an exchange token in the minor's home (§5.12.4; M28 in
    Carlisle, M1 in Aberdeen, M3 in Edinburgh), or a station traced from one. The rulebook does not
    say what happens then; this reading moves no placed station (§5.12.8) and never puts a second
    station of one company in a city (§5.12.6). Confirmed by the user 2026-11-14.
13. **P12's extra lays all come before the turn's own track or all after it.** The rulebook does
    not say so; this is the designer's ruling (BoardGameGeek thread 2425653, article 34793831).
    It forbids an own tile, an extra tile and then another own tile in one turn.

Changed to follow the rulebook as the engine reads it:

- **The hexes beside London** (§5.10.7): the director of the adjoining company, or the holder of
  its concession, lays there freely; another company's yellow tile needs that player's agreement
  (the family's track consent); with no such player the tile must join the London station's
  track. Upgrades are free of all this. The Metropolitan Railway's director shares the rights of
  the station its home stands beside: either of the two may be asked, and the layer chooses
  which.
- **Privates from any consenting player** (§3.1.2), not only the company's own director.
- **A permanent train's revenue may be decided apart** from the other trains': paid, split or
  kept; two halves are halved as one sum, and the price moves on the whole dividend (§5.14.2,
  §5.14.3).
- **The English Channel and France alone are no route**: the two count as one stop (§5.4.6).
- **Loans are repaid by choice, in any amount, in a stock turn** (§4.1.3). The example after
  §4.2.4, where income pays a loan as it is earned, is not a rule and is not applied.
- **P5 upgrades the English Channel** for the standard cost, as the turn's track, where the
  Channel has no free station space and an upgrade would make one (§3.1.17, §5.12.10).
- **P2 with P11 in one lay** (§3.1.13): P2's plain track may be of the colour P11 brings early,
  which closes both.
- **Several London stations** may each hold a station of one company, never two in one (§5.4.2,
  §5.12.6).

Found by review and corrected:

- **The bidding boxes close their gaps and refill as each stock round starts** (§4.5.2), not only
  as one ends, so a minor bought from the boxes in the operating rounds is replaced.
- **A destination token never takes a space kept for another company's home**: with no space
  to spare it stands beside the city, and is one of the city's own once an upgrade adds a space
  (§2.1.11, §5.11.8). An exchange token placed for a minor bought from the boxes follows the
  same rule.
- **The Metropolitan Railway lays no track in the turn it places its home**, London's upgrade
  included (§5.6.7).
- **A token standing beside a full station stays there through an upgrade** unless the upgrade
  adds a space no other company's home still awaits, when it moves into it (§5.10.3, §5.11.8).
  The family used to seat it in any free space, which could take a home's reserved one.

The engine also lets P2, P8, P10, P11 and P12 share one lay in further pairs. Nothing is missing
for want of that: the same results are reached in sequence. P8's and P10's discount tokens apply
to any lay, one made with a private included; P2 and P11 take the company's normal track, after
which P12 adds its extra lays (`acquisition.spec.ts`, "P12 with P2 or P11 in one turn").

One difference was found in making that comparison and corrected. **P12's extra lays all come
before the turn's own track or all after it** (the designer's ruling the engine cites,
BoardGameGeek thread 2425653; the rulebook is silent). Once an extra lay follows any of the turn's
own track, the company lays no more of its own; and P12's second tile is given up once the turn's
own track follows its first. A private's lay made in place of the normal track (P2, P11, P21)
counts as the turn's own.

## BoardGameGeek rulings

Every thread of BGG's 1822 forums (object 193867, 207 threads; dump and report in
`/workspace/tmp/1822-bgg-forums`) was checked against this title on 2026-11-14. About ninety
answered questions match it. Changed to follow them, at the owner's direction:

- **No Pullman on an L-train** (reading 11).
- **No route to an English Channel the company is tokened out of**: the Channel and France are
  one stop, so a company that cannot run through the Channel to France cannot run to it either
  (designer, article 32242130, 2019; §5.4.6 reads otherwise). `RouteRules1822.stopAllowed`.
- **Merthyr Tydfil–Pontypool is run from the token** (reading 9). The autorouter also used to miss
  a legal route ending across the link when the far city came first in its stop order.
- **The roundel space the Metropolitan Railway leaves is open to any company** when the major
  acquiring it takes no exchange token there (§5.10.4; asked on BGG, article 23978336, unanswered).
  `vacatedRoundelNodeId` in the title state; the family's `StationRules.opensBesideCity`.

Kept as the research engine has them, at the owner's direction:

- **P2 counts as one of a major's lays**, so a second yellow tile may follow it. A forum answer
  (article 31854300) reads "counts as the company's normal track laying step" as the whole step.
- **The six-exit rule covers city tiles only** (§5.8.17 names plain track and small stations
  too; the forum, on a later printing, says cities). One difference from the engine is left: this
  title lets the five-exit tile be laid where the six-exit one is unaffordable, which the rule
  and the engine forbid, but no hex of the board can take a six-exit tile at an estuary cost.

Open: whether the London major beside the Metropolitan's home may take the roundel space with an
exchange token (designer, article 23964153, says the acquirer may; this title offers only
"available" to a company already in that station, §5.12.6), whether loan repayments return to the
bank, and what the Kickstarter fix pack corrected on the Y and T city tiles and on P15 and P20.

## Data notes

- M9 East Lincolnshire's home is Grimsby N23 (the rulebook's table prints N29); M29's is Mid Wales
  E28 (printed F28); M2's is E2; M23's is Cornwall A42 (the table calls it Plymouth).
- M16 is the London & Birmingham Railway, as rulebook v2.0 names it.
- Folkestone is spelled correctly.
- Private initials for P16 and P19–P21 are not in the rulebook; company colours are approximate.

## Verification

- `games/1822`: `variants.spec.ts` for the options, the 1822+ setup over twelve seeds, the
  per-box refill, P21 and the tax haven with and without its variant; whole bot games under each
  way of dealing the privates.
- `games/1822`: map, tile, market, train and company data specs; bidding, stock, operating,
  route and acquisition specs with the rulebook's examples (Table 5; §5.18.4's terms; §5.20.2's
  issue; §5.8.4's Swansea and Mumbles runs; §5.17.2's loan); conformance specs; whole games played
  by a seeded bot for 3–7 players.
- `libs/18xx`: reach and tracing specs for terminus track and lanes.
- `libs/18xx-autorouter`: specs for terminus track, lanes, uncounted stops, station runs, trains
  that pass stops and share track, attachments, once-a-run bonuses and run subsidies.
