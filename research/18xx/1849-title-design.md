# 1849: The Game of Sicilian Railways — title design

Rules authority: _1849 Rules of Play_, rules version 6 (Jason Begy and Scott Petersen), with the
1.1 and 1.0 player aids. PDFs and text copies are in `/workspace/artassets/1849`. Section numbers
below are the rulebook's. The research engine (`g_1849`) supplied hex coordinates, terrain, tile
track layouts and counts only, checked against the rulebook.

## What makes 1849 different

| Mechanism                                                                                     | Rulebook                | Family support                                                                                             |
| --------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| Narrow, standard and dual gauge track; gauge changes only at stops                            | §10.1, §10.3, §10.5.1   | New: `TilePath.gauge`, gauge-aware reach, routes, upgrades and the autorouter; see `track-gauge-design.md` |
| Hex trains weighting gauges (R6H reversed)                                                    | §10.5.1                 | `'hex-edges'` measure plus per-gauge weights (gauge work)                                                  |
| Two non-port stops per run; ports only at a run's ends                                        | §10.1, §10.5.1          | Ports are offboards (terminal); declared minimum non-offboard stops (gauge work)                           |
| Terrain cost by gauge of new track, paid again on every upgrade; SIGI halves standard gauge   | §10.3.1                 | Title `TrackRules.terrainCost` with the family new-track helper                                            |
| Grey cities' three revenue values                                                             | §10.5.2                 | Staged revenue by phase (`revenueStagesByPhase`)                                                           |
| Incremental capitalization, 20% float                                                         | §9.3, §9.4              | `treasuryShareStockRules` / `treasuryShareCompanyRules` (1846)                                             |
| President buys 20–40% in the start                                                            | §9.4                    | New: `CompanyRules.additionalStartCertificates`, `StartCompany.additionalCertificateIds`                   |
| Fixed, dealt start order; Garibaldi chooses its home; closed corporations go last             | §2.2, §9.4, §9.4.1, §11 | Title order in state, gated by `startMarketSpaces`; Garibaldi through `startHomes`                         |
| Token fee paid by the corporation at start                                                    | §9.4                    | Home placed on float with the fee (others), `StartHome.cost` (Garibaldi)                                   |
| Two-share "last certificate"                                                                  | §9.3, §9.6              | Certificates already sized by shares; purchase rule in `purchaseTerms`; sales pick ten-percents first      |
| Market blue zone closed until phase 16                                                        | §5                      | Title: a second chart without the blue spaces drives dividend and round-end moves                          |
| Dividend ≥ price → right; withheld or no train → left; otherwise no move                      | §10.5.3                 | Title `EarningsRules.marketEffect`                                                                         |
| Financial activities after buying trains: issue any treasury certificates or redeem one       | §10.8                   | New: `CorporateFinanceRules.timing: 'after-trains'`; certificates move by shares                           |
| Closed box, closure and restart with home reserved                                            | §5, §11                 | Zero-price closure with new restartable `closeShareCompany(…, restart)`, `keepsAllStations`                |
| Emergency money raising closes the corporation, president may take a loan or leave            | §10.7                   | New: `TrainFundingRules.insolvency`, `DeclareBankruptcy.choice`                                            |
| L.750 per loan off final wealth                                                               | §13                     | New: `ValuationRules.playerItems`                                                                          |
| Ends after a corporation reaching L.377 operates; bank broken ends the set; no start possible | §13, ruling 15          | Title trigger; `bankExhaustionAtSetEnd`                                                                    |
| Messina earthquake at the first 12H                                                           | §6, §12                 | Title `PhaseRules.changes`                                                                                 |
| Waterfall private sale with bids; SCE price falls                                             | §8                      | `waterfallAuction` as 1830                                                                                 |
| RSA gives the first corporation's president's certificate, par 68/100, treasury from the bank | §8.1                    | `awardCertificates` + `requirePar`; title funding on par                                                   |

## Family surveys for the new family assets

- **Start with further certificates.** Researched titles that sell more than the president's
  certificate in the start action: 1849 and its Two Sicilies sibling (up to 40%); most titles
  sell one certificate (1830, 1846, 1889, TOP), 1862 sells a three-share director's certificate
  as one. Shared: each further certificate is an ordinary purchase evaluated on the state the
  earlier ones leave (limits, ownership cap, price). Title: how many. Not done: buying from the
  market pool in the start.
- **After-train corporate finance.** 1846, 1833NE and 1894 issue and redeem before running;
  1849 does it after buying trains. Shared: one action and one choice list; the step is the
  title's timing, and once used the company buys no more trains. Certificates now move by share
  count, so a two-share certificate works; single-share titles are unchanged.
- **Restartable closure.** 1846, 1833NE, 1850 and 1870 retire a closed corporation; 1862 and 1817
  reset one through their own procedures; 1849 closes (assets lost, holders unpaid) and later
  restarts. Shared: `closeShareCompany` with a `restart` term that returns the certificates to a
  bank pool and clears the charter through `resetCompany`. Title: where the certificates go and
  the reservation of its home.
- **Insolvency.** 1830-style titles bankrupt the president (end of game); 1846 and 1817 eliminate
  the player; 1849 closes the company and keeps the player, who may take a loan or leave. Shared:
  `TrainFundingRules.insolvency` replaces bankruptcy and elimination, the president's choice is
  carried on `DeclareBankruptcy`, and the company's turn ends.
- **Player wealth items.** 1849's loans are the first player-level item beyond cash and
  certificates; `ValuationRules.playerItems` sees the other items so a title can floor a total.
- **Marking a certificate of several shares** (`TitlePresentation.multiShareCertificate`).
  Ordinary certificates of more than one share appear across the researched catalogue (1826,
  1835, 1844, 1854, 1858, 18GB, 18CZ, 1849 and others); 1849 prints one, its last certificate,
  and players must see who holds it because it sells and issues only after the singles (§9.3,
  §9.6). Shared: whether an owner, or a bank pool, holds one (`holdsMultiShareCertificate`) and
  the mark it shows (`multiShareMark`) on the company card, players panel and spreadsheet. Title:
  the letter, name and description. Not done: telling apart several multi-share sizes in one
  company (1835's Prussian 20% shares and 10% shares), which would need a mark per size.
- **Terrain icons by kind** (`MapViewDefinition.terrainIcons`). The catalogue's hex terrain is
  mostly `mountain` (617 hexes), `water` and `river`, then `hill` (115) and a few others; titles
  with several land costs print bigger mountains for bigger costs. Shared: the icon set (one,
  two and three peaks; water and lake as before). Title: which kind prints which. Every other
  title keeps the two-peak mountain.
- **Captions above a staged value row** (`TileLayout.revenueCaptionsAbove`). Staged values
  usually stack with captions before or after them (`revenueCaptionsAfter` for an east edge);
  1849's Terranova has track on five sides and room only below its two-space city, so its values
  run in a row with the phase captions above. Shared: the row with its captions and the space it
  keeps clear. Title: which hex uses it.
- **Terrain costs on laid tiles** (`MapViewDefinition.terrainKeptOnTiles`, `terrainCostsBelow`).
  Most titles pay terrain once and the cost leaves with the first tile; 1849 puts the token back
  and charges it on every upgrade (§10.3.1). Shared: each laid tile finds its own clear space
  nearest the hex's foot, as a row or with the cost under its symbols, clear of the tile's
  spaces, values, label and track (touching only where nothing is clear). Title: whether costs
  stay, and which printed hexes stack the cost (K9, whose track runs through its centre).
- **Title events in history** (`HistoryDescription.callouts`). Shared callouts so far are the
  bank breaking and certificate limits; 1849's Messina earthquake is the first title event of
  the same weight. Shared: a title's description may carry callouts, drawn as the shared ones
  in the history and the last action panel. Title: the earthquake under the phase change to
  12H, read from the phase change's recorded title changes (§12).
- **Markers the state implies** (`MapViewDefinition.stateMarkers`, the `lock` tile symbol).
  Location markers so far are printed or placed by private powers; Messina's lock after the
  earthquake is neither. Shared: a title derives markers from the displayed state, keyed so
  an unchanged set doesn't redraw the board, and on historical maps; a symbol marker may stand
  `at` a point. Title: the lock above Messina's city until after the next stock round (§12).

## Further family changes found by whole-game play

- `closeShareCompany(…, restart)` removes nothing from the round's operating order; 1849 removes a
  restarted company itself unless it is the one operating (its turn then ends normally).
- A company closing at zero on its own turn clears its train purchase step, and ends its turn only
  if the turn is still open (an end-of-turn issue can take it to zero as it finishes).
- After a closure ends a turn, the closed company's former president stays the turn's owner, as
  after any finished turn; before, no one was active, and a closure by the round's last company
  crashed the next decision window. This affects 1846, 1833NE, 1850 and 1870 only in that case.
- `resetCompany` returns certificates to the named pool's owner (a company's own treasury in
  1849); bank-held pools, as in 1862, are unchanged.
- `PrivatePowerRules.afterMarker`: what follows a private's map marker (CNM records its port and
  closes).
- `MapViewDefinition.terrainIcons`: which icon each terrain kind prints (one, two or three peaks);
  every title keeps the two-peak mountain unless it chooses.
- `MapViewDefinition.terrainKeptOnTiles`: a hex's terrain cost stays drawn on the tiles laid over
  it (§10.3.1 puts the token back), in each tile's own clear space nearest the hex's foot, as a
  row or with the cost under its symbols. `terrainCostsBelow` stacks a printed hex's cost the
  same way where its track leaves no room for a row (K9).

## Rulings to confirm with the owner

1. **Privates and the certificate limit.** Rulebook §7.1/§9.1 say privates count; player aid 1.1
   says they do not. Implemented as the rulebook.
2. **L. 144 start value.** Rulebook §6/§9.4: from phase 6; player aid 1.1: from phase 8.
   Implemented as the rulebook.
3. **Tile manifest.** One each of #655 and #656 (green and brown M), as the rulebook's manifest
   prints (72/72/24), where the research engine has two each.
4. **A Garibaldi from the Reale Società d'Affari** chooses its home as it first operates, among
   its cities with room, rather than at once in the initial stock round (§8.1 says the buyer
   places the home token). Its token fee is paid as it floats.
5. **A Garibaldi passed over** for want of a home (§9.4.1), as the research engine plays it (confirmed
   by the owner, 2026-11-12): it shows last as soon as its last city fills, and is set aside last
   in order as the next stock round begins; it may start again only from a stock round that
   begins with room in one of its cities, so room that opens during a stock round waits for the
   next. A corporation that closes while it is set aside goes ahead of it.
6. **A Garibaldi that itself buys the first 12H** and loses its only station closes when it next
   acts in its train step (its price goes to the Closed box), not mid-purchase.
7. **Presidency exchange with the last certificate** (§9.5): the new president always gives the
   last certificate when they hold it; the outgoing president's option to take two single
   certificates instead is not offered yet.
8. **Issuing into the Closed box** closes the corporation at once, ending its turn.
9. **The SMS** lays or upgrades a tile in a coastal city it need not reach, then may place a
   station there, and that turn places no other station; using it only to place a station
   without a tile is not offered.
10. **The bank broken**: payouts beyond the bank follow the family's broken-bank handling.
11. **No train left in the bank.** Once every train is sold and none is in the pool, a train-less
    corporation need not buy one (it may still buy from another corporation); the rules are
    silent and otherwise the game could not go on.
12. **Messina to Calabria** counts three hex edges through the two grey halves A15 and B16 of the
    double hex (§10.5.1), as the research engine models it.
13. **Privates in final wealth count nothing**, as §13 sums "money and corporation stock"; this
    also shows in net worth during the game, and matters only if the game ends before the first
    12H closes them.
14. **A run from a home to a port alone** needs no train: the must-own-a-train check follows the
    route rule of two cities, or a city and a town (§10.5.1, §10.6).
15. **No corporation can start** (confirmed by the owner, 2026-11-12): once no corporation is
    open, every private has closed and no player has the cash for a president's certificate at
    the lowest start price, nothing can change again, so the game ends there and is scored as
    usual. §13 is silent; without it such a game would pass every round forever.

## Implemented later or not at all

- Variants (§14): acquiring station tokens, bonds, Electric Dreams.
- The physical board view (no board artwork); the boardless map is the only presentation.

## Verification

- `games/1849/src/fullGame.spec.ts` plays whole seeded games to their end for three, four and five
  players (`SWEEP=1` for 40 seeds); a 36-game sweep reached the end every time, through
  closures, insolvencies with loans and players leaving, issues, the earthquake and phase 16.
- `games/1849/src/rules.spec.ts` covers starts, the last certificate, price moves and the blue
  zone, closure and restart, finance, the earthquake, terrain and loans.
- Harness scenarios in `games/1849-ui/src/scenarios` (port 4211).
