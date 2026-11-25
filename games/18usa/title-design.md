# 18USA — title design

Rules authority: the 2022 rulebook, saved as text in `/workspace/artassets/18usa/rules-rulespal.txt`
(RB below; § numbers are its sections). The title is an 1817 derivative; 1817's rulebook is
alongside it (`rules-1817-rulespal.txt`), and the BoardGameGeek forum digest for thing 219717 is in
`bgg-all.txt`. The research engine's `g_18_usa` (`map.rb`, `entities.rb`, `game.rb`, pinned in
`/workspace/research/18xx-2026-09-08`) supplied hex coordinates, terrain costs, printed track,
revenues, tile track layouts and labels, metropolis tile rotations, the market row and the train and
phase tables; everything it supplied was checked against RB, and every disagreement is listed below.
Its procedures and representations are evidence only.

Scope: the 2022 rules for 2–7 players with the three variants of §17 as options (1817 trains; the
$300 start price from phase 5 with its liquidation of companies less than half held; no 60%
president share limit). Rulings come from the BoardGameGeek forum digest
`/workspace/artassets/18usa/rulings.md` (ids PR-, TR-, …); the designer (Shawn Fox) and the
publisher settle questions RB leaves open.

## Data modules

| Module                           | Exports                                                                                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mapFeatures.ts`                 | `ResourceKinds`, `ResourceLocationIds`, `resourcesAt`, `BridgeCityIds`, `SubsidyCityIds`, `SmallCityIds`, `MexicoLocationIds`, `GreatNorthernBorderIds`, `GreatNorthernBonusCities`, `RequiredTileEdges`, `NewYorkId`, `ClevelandId` |
| `redAreas.ts`                    | `RedAreaIds`, `RedAreas` (name, hexes, route-end flag), `redAreaOf`, `RedAreaTokens` (10), `ImportExportHubToken`, `redAreaToken`, `PhaseValues`, `phaseValuesRevenue`, `PhaseValueStages`, `assignRedAreaTokens(prng)`              |
| `map.ts`                         | `createEighteenUSAMap(redAreaAssignment)`: the 114-hex pointy `RailwayMap`                                                                                                                                                           |
| `tiles.ts`                       | `EighteenUSATileSet`, `EighteenUSATiles`, `EighteenUSATitleTiles`, `PlainCityTileIds`, `RuralJunctionTileIds`, `CompanyTownTileIds`, `RegionalHeadquartersTileId`, `ClevelandBrownTileId`                                            |
| `metropolis.ts`                  | `MetropolisCandidates` (hex, yellow tile, rotation, upgrade label, Denver's chosen orientation), `MetropolisCount`, `selectMetropolises(prng)`                                                                                       |
| `resources.ts`                   | `ResourceTokens` (value, raised value and when, waived terrain cost, whether the tile upgrades), `BridgeTokenValue`                                                                                                                  |
| `subsidies.ts`                   | `Subsidies` (16), `assignSubsidies(prng)`, `resourceSubsidyKinds(privateIdsInPlay)`                                                                                                                                                  |
| `stockMarket.ts`                 | `EighteenUSAMarket`, `MarketZoneColors`, `ParPriceRange`, `isLiquidationSpace`, `isAcquisitionSpace`, `isSafeParSpace`                                                                                                               |
| `trains.ts`                      | `EighteenUSATrainDepot` with variants `TrainVariantIds`, `trainSupplyVariant(playerCount, roster)`, `EighteenUSAPhases`, `EighteenUSACompanySizes`, `ObsoleteTrainIds`, Pullman constants                                            |
| `corporations.ts`, `charters.ts` | `EighteenUSACorporations` (20: id, name, abbreviation, colours), `CompanyShareCounts`, `EighteenUSACharters`                                                                                                                         |
| `privates.ts`                    | `EighteenUSAPrivateCatalog`, `EighteenUSAPrivates` (30), `guaranteedPrivateIds`, `PrivatesDrawnByFaceValue`, `selectPrivates(playerCount, prng)`                                                                                     |
| `setup.ts`                       | `startingCash`, `certificateLimit`, `ShareLimits`                                                                                                                                                                                    |
| `loans.ts`                       | `LoanValue`, `LoanSupply`, `LoanMarketSteps`, `loanTiers(playerCount)`, `loanInterestRate(tiers, outstanding)`                                                                                                                       |

The random-setup functions take Common's `Prng` and draw with Common's `shuffle`, as 1817's
Volatility opening does; each is independent, so the setup step chooses their order.

## Map

Pointy hexes, letter rows, `numberOffset: 1` (A15 … K13). 95 white, 3 gray (B30 track, Detroit,
Toronto), 1 yellow (New York), 3 blue (B24, C21 lakes; F28, below) and 12 red hexes.

- **Red areas.** Seven areas: Winnipeg, Seattle, San Francisco and Florida are small cities that
  routes pass through; Montreal, Mexico (six hexes) and the Port of New Orleans are route ends
  (offboards). Their values come from a token dealt at setup, so the map is built by
  `createEighteenUSAMap(assignment)`: each red stop gets staged revenue keyed `yellow`, `green`,
  `brown`, `gray` (phases 2, 3–4, 5–6, 7–8, the newest tile colour of the phase, as the family's
  stage-keyed revenue reads it). The six Mexico hexes share `stopGroup: 'mexico'` so a route
  counts Mexico once. A later slice may instead build one map and read the assignment from State
  through `RouteRules.stopRevenue`; the builder serves either.
- **Small cities** (§4) are city nodes with zero station slots, as TOP's Malpeque Shipyard: always
  open, no stations, counted as cities for distance and Pullman bonuses. Detroit and Toronto are
  gray with printed phase values (30/40/50/60, 20/30/40/40).
- **Semantic features** live in `mapFeatures.ts`, not in artwork: resource hexes per kind (B10
  coal+ore, B12 coal+oil), bridge cities, subsidy cities, small cities, Mexico, the northern
  border for P17, P17's bonus cities, and the printed stubs. The map's location markers (coal,
  oil, ore, bridge, Great Northern) are generated from the same lists for the boardless view.
- **Stubs.** D26 and E27 have printed track into New York (BGG: "Do hexes D26 and E27 start with
  track running into New York"), recorded as `RequiredTileEdges` (D26 edge 4, E27 edge 3), the
  same shape as 1867's `YellowTileStubs1867`.
- **F28** is a printed track from Norfolk into the Atlantic. It exists so Norfolk can be upgraded
  without a dead-end exit (BGG thread 2852406). It is a blue hex whose face is a dead-end junction
  on edge 0: track may point at it, and it is never a stop.
- **Cleveland** carries `upgradeLabels: [{ color: 'brown', label: 'CLE' }]`: its brown tile is
  X13 (§ manifest; the reference allows only X13 there).
- **Metropolis candidates** stay plain cities on the map. The chosen three receive their yellow
  tile at setup (`MetropolisCandidates[].yellowTileId`, `rotation`), then upgrade by
  `upgradeLabel`.

## Tiles

47 definitions: 22 shared (`18xx:`) and 25 title (`18usa:`).

- Plain tiles are unlimited (§12.2): 5, 6, 57; 14, 15, 619; 63, 448, 611; 7, 8, 9; 80–83;
  544–546; 60; X17.
- B tiles 592, 593, 597 have their printed count, 4 each ("0+4"): they are labelled, not plain,
  and serve at most the four B metropolises.
- One each of X01–X16, X18–X23 and X30.
- **Metropolises**: Atlanta (X01 ATL), Chicago (X02 CHI), Denver (X04 DEN) and New Orleans (X06
  NO) upgrade with the B tiles; Dallas-Fort Worth with X03→X10→X14→X18 (DFW); Los Angeles with
  X05→X11→X15→X19 (LA). New York: printed two-city yellow → X12 (two cities, 2+1 slots) → X16 →
  X30. Cleveland: a plain yellow and green city, then X13 CLE, which only tile 15's exits fit.
  The specs check every chain keeps its exits under some rotation.
- **Denver** has one X04, its `orientationChosen` flag recording that the first company to start
  in or connect to Denver turns it (§12.2.3). The reference keeps a hidden duplicate X04s for this.
- **Rural junctions** X07–X09: yellow, a $10 city node with no station slots and `uncounted`
  (none of a train's distance), label `R.J.`. RB treats a rural junction as a city except for
  distance and route ends (P26); the reference draws it as a town.
- **Company towns** X20–X22: gray, one station slot, worth 30/40/50 by the newest track colour,
  label `C.T.`.
- **Regional HQ** X23: gray, 3 slots, $50, six exits (three may point at water: a rule of P16).
- **Resource tokens are not tiles.** The reference represents coal, oil and ore by ~60 labelled
  variants of 7/8/9, 80–83, 544–546, 60 and X17 with a hidden offboard carrying the token's
  revenue (and `7ore20` … for the ore upgrade, `coalore`/`coaloil` for B10 and B12). This
  repository's 1817 models its coal mines as an ordinary tile plus a `LocationMarker`, and 18USA
  follows that: a resource token is a marker on the hex with the value in `ResourceTokens` (coal
  $10; oil $10, $20 from phase 5; ore $10, $20 after an upgrade action from phase 3, the tile
  itself unchanged). Upgrade restrictions (ore tiles never upgrade) are `tileUpgradable`.

## Market, companies, trains

- **Market**: one row of 70 spaces, `0l 0a 0a 0a 42 … 800` as RB §5 and the reference, par 50–200
  with safe par spaces 53, 74, 120 (the least price at which a 2-, 5-, 10-share company taking all
  its loans avoids acquisition). Moves as 1817's: right is up, left is down, never into
  liquidation.
- **Corporations**: the reference's twenty (ATSF, B&O, C&O, DRG, GN, IC, KCS, MILW, MKT, MP, NYC,
  N&W, NP, PRR, SP, SR, SLSF, TP, UP, WP), different from 1817's. Ids drop the ampersand;
  abbreviations keep it. Colours are the reference's, as hex. Charters count each as two shares
  until its size is chosen, as 1817's.
- **Trains** (§12.6): one depot, the five-or-more-player supply as its base, a `2-4-players`
  variant (one fewer 2+, 4, 5, 6) and a `1817-trains` variant (§17: 1817's 2+ ×4, 4 ×8, 5 ×5, 6 ×4,
  no 3+ or 4+). The Pullman `P` ($200, unlimited, an `attachment` like 1822's) is in every
  roster; its availability from phase 5, $50 scrap and +$20 per stop are constants for the rules.
  2+, 3+ and 4+ rust on the 4, 6 and 8 like their base trains and are listed in
  `ObsoleteTrainIds` (they run once more).
- **Phases**: RB's seven, 2–8, with tile colours, limits 4/4/3/3/2/2/2, two operating rounds each,
  and company sizes 2 / 2,5 / 5 / 5,10 / 10 / 10 / 10. The 1817-trains variant uses the same table.
- **Loans**: 70 × $100. Two to four players: 14 rows of five, 5%–70% (1817's mat). Five or more:
  four at 5% and six on each row to 60% (§2.2), as the family's `LoanRateTable` now allows
  (`loansPerRow` per row, `LoanRateTables` for the mat's side by player count).
- **Players**: starting cash $630/$420/$315/$300/$250/$225 and certificate limits
  32/21/16/16/13/11 for 2–7 (§2, same in the reference); share limits 2/3/6 by company size.

## Privates and random setup

- **Privates**: P1–P30 at RB's face values, the power text condensed from RB's appendix, place
  references for Fargo, Helena, Seattle, Chicago and the border hexes. All pay nothing and never
  close by phase. P25 is discarded as a company buys the first 6-train, not as one is exported
  (`privatesClosedByPurchase`).
- **Selection** (§2.3): P1–P4 always, P10 too from five players, then 1/2/3/2/2/1 of the others at
  $30/40/60/80/90/120; 15 privates below five players, 16 from five. The reference's procedure is
  the same.
- **Metropolises** (§2.4): three of the six candidates; the other three go with P10 when in play.
- **Subsidies** (§2.5, appendix): 16 tiles (7 none, Boomtown, Free Station, +10, +10/+20,
  Resource, $30 ×2, $40, $50), 14 dealt to the 14 subsidy cities, two to the box. The reference's
  `SUBSIDIES` list is the same sixteen and draws fourteen the same way. The Resource subsidy's
  kinds follow from the privates in play (`resourceSubsidyKinds`: ore without P24, oil without
  P12, coal without P18 or without P28; none makes it a "No subsidy").
- **Red areas** (§2.6): seven of the ten value tokens, one per area; the 30/40/50/80 token is
  P6's.

## Disagreements between the rulebook and the reference

| Subject                            | Rulebook                                                                     | Reference                                                            | Followed                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------- |
| P3 Reece Oil and Gas               | $40                                                                          | $30                                                                  | RB. P3 is always in play, so the draw is unaffected.          |
| Red-area tokens                    | 10 dealt tokens + the reserved P6 token (11 markers; 27 = 16 subsidies + 11) | 11 dealt values (20/30/50/60 twice) + P6's separately                | RB                                                            |
| P17 border hexes                   | B4, B6, B8, B10, B12, B14, B16, B18                                          | the same plus C19 and D20, with Great Northern icons printed on them | RB; open question 3                                           |
| Phases                             | 2–8                                                                          | 2, 2+, 3, 3+, 4, 4+, 5, 6, 7, 8 (the + phases change nothing)        | RB                                                            |
| Phase 8 new companies              | table: 10-share; text: "No new companies may be started"                     | 10-share (as 1817)                                                   | table and reference; open question 2                          |
| 2-train supply                     | unlimited                                                                    | 40                                                                   | 40: more than the players' money buys, and exportable         |
| Pullmans with the 1817 roster      | not stated (unlimited in §12.7)                                              | 20                                                                   | unlimited                                                     |
| 592/593/597                        | 0+4 each                                                                     | unlimited                                                            | 4                                                             |
| X30                                | 0+1                                                                          | unlimited                                                            | 1                                                             |
| X17, 60                            | 3 each                                                                       | unlimited                                                            | unlimited (plain track, §12.2)                                |
| New Orleans metropolis tiles       | §12.2.3: dedicated tiles; the manifest has none                              | upgrades X06 with the B tiles                                        | reference and manifest; open question 1                       |
| Company Town                       | one bonus station; "the open station slot"                                   | two slots, one filled by a neutral token                             | one slot                                                      |
| Rural junction                     | a city, except distance and route ends                                       | a town                                                               | a city node, no slots, `uncounted`                            |
| Detroit, Toronto, red small cities | cities always open, no stations                                              | towns                                                                | cities with zero station slots                                |
| Bridge sites                       | cities with a bridge icon (8), and a Company Town on a $10 river hex         | P2/P21/P22 assign to all 13 river hexes                              | `BridgeCityIds` (8); river hexes are those with water terrain |
| Resource placement                 | tokens on a yellow lay                                                       | labelled tile variants with hidden revenue                           | markers on ordinary tiles, as 1817 here                       |
| New York's name                    | New York                                                                     | New York City                                                        | RB                                                            |

The reference supplied, without an RB counterpart to check: hex coordinates and printed track,
the metropolis tiles' setup rotations (RB says only "north arrow up"), the Mexico hexes'
internal borders (drawn only; replaced here by the stop group), and corporation colours.

## Open data questions

1. **New Orleans' upgrades.** RB §12.2.3 says New Orleans has dedicated metropolis tiles, but the
   manifest lists none and the reference uses the B tiles. Is §12.2.3 an error, or are tiles
   missing from the manifest?
2. **Phase 8.** May 10-share companies still be started (table, reference, 1817) or none (text)?
3. **P17 on C19 and D20.** Are Great Northern icons printed on C19 and D20, and does the extra lay
   apply there?
4. **The P6 token without P6.** §2.6 deals "one of the 11 red area value tokens"; the appendix
   reserves the 30/40/50/80 token for P6. When P6 is not in play, does that token join the draw?
5. **Company Town slots** and the printed values beyond brown: the reference gives only
   yellow/green/brown values; the phase-7 value is taken as the brown one.
6. **Denver's orientations.** X04's exits (1, 3, 5) allow two distinct orientations; which
   rotations count as "north up" for a player's choice is for the rules slice.

## Family candidates

- Tile **60** (gray six-way junction) is title-scoped here, as in 1822; it belongs in the standard
  catalogue. **X30** repeats 1817's X30 face (the same physical tile, "0+1" from 1817).
- The one-row market construction repeats 1817's `stockMarket.ts`; both are candidates for a
  family helper when 1817's mechanisms are lifted.

## Verification

`pnpm --filter @tabletop/18usa test`: every printed track meets a buildable hex or matching track
on a fixed one; stubs point into New York; terrain, names, cities, small cities, resources,
bridges, the border and red-area values; the tile manifest, counts, colours and upgrade chains;
the market; train rosters by player count and variant; phases; loans; starting cash and limits;
the private draw and the metropolis, subsidy and red-area deals with fixed seeds.

## Rules

The rules compose the family's sized-company modules (`libs/18xx/src/sizedCompanies`, lifted from
1817 for this title; `research/18xx/1817-family-mechanisms-design.md`) with 18USA's data and
hooks. The shared hooks it added are covered in `research/18xx/18usa-shared-hooks-design.md`.
What differs from 1817, and where it lives:

| Rule                                                                                                                                                              | Rules            | Where                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------- |
| Random privates, metropolises, subsidies and red-area tokens at setup                                                                                             | §2               | `openingAuction.ts`; red values dealt into `tileInventory.dealtRevenues`   |
| Private auction from half face value ($5 for P14), $5 steps, no seed money; bids above face value                                                                 | §10, AU rulings  | `EighteenUSAAuctionRules`                                                  |
| Company auction from $100 by $1, no cap; start price half the bid within $50–$200; treasury twice the start price less privates                                   | §11.6            | `EighteenUSACompanyAuction` (`capital`, `startPrices`)                     |
| A city's cash subsidy counts as the winner's equity, the opener's opening bid included                                                                            | §11.6.1          | `homeEquity`; family `maximumBid(home)`                                    |
| Subsidies claimed at formation, the rest removed after the first stock round; Boomtown, Free Station and Resource held as privates of no value                    | §11.6.1          | `subsidyRules.ts`, `S-*` privates, `afterRound`                            |
| P10 lays a candidate's metropolis tile; P14 closes; P29's 2-train in a No-subsidy city before 2s rust                                                             | P10, P14, PR-29b | `stockRules.ts`, `bankruptRailroad.ts`                                     |
| Each pool share drops the price two spaces at the stock round's end                                                                                               | §11.8            | `EighteenUSAStockRoundRules.poolDrop`                                      |
| Loans move the price two spaces; no repayment in a turn with a loan; P15's extra loan at $5                                                                       | §9, §12.9, P15   | `EighteenUSALoanRules`                                                     |
| Dividends move 1–4 spaces at 50/100/150/200% of the price ($40 in the acquisition zone)                                                                           | §12.5            | `EighteenUSAEarningsRules`                                                 |
| Exports: all 2s, all 2+s, none, all 3s, then the next train; phase 3 after the second round                                                                       | §12.10, §8       | `EighteenUSAOperatingRules` (`phaseAtRoundEnd`, a family hook)             |
| 2+/3+/4+ obsolete (run once more, outside the limit, not tradeable)                                                                                               | §8, §6.3         | `EighteenUSAPhaseRules`, `trainRules.ts`, `transferRules.ts`               |
| Pullmans from phase 5, one a company, before the run or with the trains, +$20 a stop (not rural junctions), $50 scrap wherever the company acts                   | §12.7            | `pullmans.ts`, `routeRules.ts`, family `ActingCompanyActionsHandler`       |
| Phase 5+: a green city on an empty city hex as a lay; a brown home city free before the company operates; plain track skips colours at $10 each, as an upgrade    | §12.2.4          | `trackRules.ts` (family `colorSkip`)                                       |
| Metropolis upgrades by label; New Orleans with the B tiles; Cleveland's X13; Denver turned by its first company                                                   | §12.2.3          | `trackRules.ts`, `trackActions.ts` (`TurnDenver`)                          |
| Resource tokens with the hex's first yellow tile, pointing into a city; coal/ore waive $15; ore to $20 by an upgrade action from phase 3; ore tiles never upgrade | §13              | `privatePowerRules.ts`, `trackActions.ts` (`UpgradeOre`)                   |
| A train passes a resource tile once, however many exits it has                                                                                                    | §13, RT-5        | `routeRules.ts` (family per-hex `forbidsHexReentry`, solver too)           |
| Bridges: +$10 to the city, a route needed, one a city, not New Orleans as a metropolis                                                                            | §13.4            | `privatePowerRules.ts`, `routeRules.ts`                                    |
| Red small cities pass-through; Montreal, Mexico, Port of New Orleans route ends; at most two routes to Mexico                                                     | §12.4.1          | map; family `stopGroupRouteLimits` (evaluation and autorouter)             |
| Rural junctions: uncounted $10, never a route end                                                                                                                 | P26              | tiles; family `RouteRules.endsRoutes` (autorouter endpoint flag)           |
| Company Town: a bonus station on it, −$10 to others, never blocks routes or track, no other station ever                                                          | P27, PR-27       | `routeRules.ts`, `trackRules.ts` (family `TrackRules.passesStations`)      |
| P7 three lays for $20; P11 two upgrades (one city), plain track a colour ahead                                                                                    | P7, P11          | `trackRules.ts`                                                            |
| P9, P16, P17, P26 lays, keeping the turn's track rules; P20 into full cities; the Free Station's extra station from the supply into any reachable city            | privates         | `privatePowerRules.ts`; `sharesFullCities`, `PrivateTokenTerms.fromSupply` |
| P13 saves a train from a rust until its next run (still counting for the limit, RB)                                                                               | P13              | `boneyard.ts` (phase-change decision)                                      |
| P19 one train passes one city uncounted and unpaid; P30 one non-permanent train one more city                                                                     | P19, P30         | `trainAssignments.ts` (`AssignTrainPower`)                                 |
| P25 10% off bank trains (Pullmans too, RB "all trains"), early purchase before the run; closes as the first 6-train is bought                                     | P25              | family `TrainRules.bankPrice`, `earlyTrainCompany`                         |
| P6 lays its 30/40/50/80 token over a reachable red area; P8 marks one, +$10 a train there, counting as one of the eight stations; over eight, it may go with P8   | P6, P8, PR-8     | `owedStations.ts` (family `limitMarkers`, `RemoveStationMarker`)           |
| P17's $30 for Fargo and Helena, $30 more on the train that also runs Seattle and Chicago                                                                          | P17              | family `PaidConnectionBonus.requires` (evaluation and solver)              |
| $300 variant: companies less than half held as their stock round ends are liquidated                                                                              | §17              | `unsoldCompanies.ts` (family reason `unsold-shares`)                       |
| No 60% variant: a president may pass 60% in stock rounds; others buy from a president past 60% at 110%, rounded up, while no other share is for sale              | §17, VA-2, MA-4  | `stockRules.ts` (`ownershipLimit`, `purchaseTerms`, `sellsFromPlayers`)    |
| Game end after the first 8-train: two or three more operating rounds; privates count nothing                                                                      | §16              | `endingRules.ts`                                                           |

### Readings

- **New Orleans uses the B tiles** (publisher's errata); **coal tiles upgrade** (§13.1, the table);
  **phase 8 still starts 10-share companies** (designer: the text's line was an accident).
- **P13's saved train counts for the limit**, as RB says; 18xx.games treats it as obsolete.
- **P25's discount includes Pullmans** (RB "all trains"); open question OQ-4 in the digest.
- **P19** is modelled as one more stop for the train, its lowest-paying stop unpaid (the city it
  treats as plain track). That city may be one other companies' stations fill, which the
  train then passes through (PR-19a), but never the train's only station city, as in the
  reference.
- **Denver** is turned by a company homed there or one that laid track into the hex this turn,
  in its track step, before the tile is first upgraded; the first to use it fixes it.
- **Dual-resource hexes** (B10, B12): a lay names its token as an option of the private's power
  (`PrivateTrackTerms.options`, `LayPrivateTile.option`). The options are one of its kinds, or
  both of the hex's kinds at once when another of the company's resource powers supplies the
  other. One lay places both tokens and uses both privates (§13: "either or both").

### Limits

- **P8's marker over the limit** is kept when unplaced stations can go instead: the family trims
  unplaced stations first, then the president chooses between a placed station and the marker.
- **No 60% variant in M&A**: the limit stays 60% outside stock rounds (MA-4), so a president's
  share past 60% is sold to others only in a stock round.
- **Denver** when another company lays into it before the homed company's first track step: the
  homed company may still turn it while the rotation keeps that track connected.
