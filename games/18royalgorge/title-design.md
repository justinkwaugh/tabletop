# 18RoyalGorge — title design

Rules authority: the published 18Wood / Mr. B Games rulebook (2025), whose text is saved in
`/workspace/artassets/18royalgorge/rulebook-rulespal.txt`, and the designer's rulings on the
BoardGameGeek forums (thing 381671, 89 threads). The rulings are digested, with links, in
`/workspace/artassets/18royalgorge/rulings.md`; the co-designer Denman Scofield posts as
Maglinkinpark. Ruling ids below (SR-4, ST-2, …) are that digest's. Where a designer ruling
contradicts the rulebook the ruling wins. The research engine (`g_18_royal_gorge`) supplied hex
coordinates, terrain, tile layouts, the market row, the private cards' preliminary texts, train
prices and the debt penalties, none of which the rulebook text prints; the rulings correct it in
several places (digest §4).

Scope: the whole base game for 2–4 players, with the two-player 70% limit at two-player tables
and these rulebook variants as game options: Shorter Game, No Privates, and Alternate Gold and
Steel Prices. Not built: the Auction (company rights), Hand-Picked and alternate gold-track or
gorge-tile variants, and the expanded privates (their data is not published; digest §6).

## What makes 18RoyalGorge different

| Mechanism                                                                                                                                 | Rules             | Family support                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------- |
| SF, RG and three drawn railroads, released in Yellow/Green/Brown by establishment year                                                    | Setup, SC-1       | Title opening, `CompanyRules.startMarketSpaces` by phase             |
| Florence and Fountain are cities only when their company is drawn                                                                         | Rule 1, SC-6      | A white city overlay placed at setup                                 |
| Selection auction of 2+2+1 drawn privates in draw order; an all-pass removes only that card; most cash takes priority, ties by seat order | AU-1–AU-5         | Selection auction, new `allPassClosesLot`; `firstStockOrder`         |
| Incremental capitalization, 20% president's certificate floats                                                                            | SC-2              | `treasuryShareTrading`                                               |
| One-row market, pars by colour phase, red end zone                                                                                        | Fig. 2            | `createLinearStockMarketSpaces`                                      |
| A president's sale drops one space per share; no sales in SR1; 50% pool                                                                   | SR-1, SR-4        | Title `saleTerms`                                                    |
| CF&I and VGC: ten 10% shares, no president, sold back to the board                                                                        | SR-5–SR-7         | New `StockRules.presidentless`                                       |
| Dividend moves right once per multiple of the price, at most three                                                                        | Pay Dividends     | Title `marketEffect`                                                 |
| Spike off-boards end a route; two-legged off-board cities may be run through, blocked by another company's station; one group counts once | TR-7, RT-11       | Offboard nodes are terminal; red `city` nodes; `stopGroup`           |
| Six lays or upgrades per turn; a hex may be laid then upgraded                                                                            | TR-1, TR-2        | Title `allowance`                                                    |
| Each lay buys steel from CF&I: one column of each colour per turn, cheapest cube first, $40 when empty                                    | ST-1–ST-5         | New `allowance` recipient; title steel state and `ChooseSteelColumn` |
| Gold cubes placed with yellow tiles on mines; one shipped per turn for +$50                                                               | GO-1–GO-3         | Title gold state, `ShipGold`; new `EarningsRules.revenueAddition`    |
| End of each OR: debt marker moves; end of the set: VGC pays, export, CF&I pays, steel refills                                             | EG-1              | Title `SettleOperatingRound` before the family export                |
| Treaty of Boston at the 2nd 3+: green gorge, two free RG stations, debts                                                                  | DB-1–DB-4         | A phase with title `PhaseChanges`                                    |
| RG and SF buy one debt token per OR at the marker's price; unpaid debt moves the price left at the end                                    | DB-5, DB-6        | Title `PayDebt`; valuation at the moved price                        |
| The gorge: three hexes upgraded as one brown tile by anyone                                                                               | RG-1              | Title restriction and `afterLay`                                     |
| Train limit 2, exceeded only by a purchase that rusts one's own train                                                                     | RT-4              | New `TrainRules.limitExemption`                                      |
| Phases start when the last train of a rank leaves (or the first, for rusting events)                                                      | Phase cards, RT-6 | Title `phaseAfterPurchase` on the depot count                        |
| A train is exported after every set, all 2+ after the first                                                                               | RT-7              | `OperatingRules.trainsToExport`                                      |
| A company must own a train only if it has a route                                                                                         | RT-8              | `requiresStationRoute`                                               |
| Track Engineer and coal cubes lengthen trains for a run                                                                                   | B5, Y3, G6        | New `RouteRules.extendedDefinition`; title `ExtendTrain`             |
| Hanging Bridge Lease: run through RG's gorge stations, paying RG 10% of that route                                                        | G3, RG-3          | Title route blocking hook; `PayBridgeLease`                          |
| Three game ends: bankruptcy at once, the red zone after the set, the first 6x2 after one more SR and set                                  | EG-2, EG-4        | `EndingRules.trigger`                                                |

## Family additions

Surveyed against the research catalogue (`/workspace/research/18xx-2026-09-08`): the trait and
variation entries for track costs, train limits, private auctions, revenue components and
non-operating companies.

- **A lay's cost paid to a company** (`TrackRules.allowance` may return a `recipient`, recorded
  as `TrackLayDetails.allowanceRecipient`). Terrain still goes to the bank. Royal Gorge's steel
  goes to CF&I; other titles keep paying the bank.
- **Presidentless share companies** (`StockRules.presidentless`). Purchases, sales and emergency
  sales skip presidency for such a company instead of asserting a president's certificate.
- **A one-lot all-pass in the selection auction** (`SelectionAuctionRules.allPassClosesLot`),
  and **the winner opening the next lot** (`winnerNominatesNext`). An all-pass used to close
  every remaining lot; `close-unsold` now completes the auction only when none remain.
- **A train-limit exemption for a depot purchase** (`TrainRules.limitExemption`), here a
  purchase that rusts the company's own train (RT-4).
- **A revenue addition before distribution** (`EarningsRules.revenueAddition`, recorded as
  `EarningsDetails.added`), the counterpart of `revenueDeduction`, for shipped gold.
- **A train lengthened for one run** (`RouteRules.extendedDefinition`), applied in
  `RouteEvaluation.runningDefinition` and so in the autorouter's fleets, for the Track Engineer
  and coal.
- **Passing full cities** (`RouteRules.passesStations`) for the Hanging Bridge Lease, in route
  evaluation and the autorouter only; track and station reach still stop at blocked cities.
- **Tiles 87, 88, 204, 911 and a plain 171** join the standard catalogue. 1861 and 1867 keep
  their own copies of the first four, whose ids their saved games use.
- **The autorouter keeps a route on the first train of its type that can run it** where the
  run earns just the same, so a train lengthened for the run, or any later train, does not
  take a route from an earlier one (`Autorouter.routesOnFirstTrains`).
- **Tiles laid as one piece** (`TrackRules.companionTiles`): the brown gorge laid on one hex
  places the other two, for one lay and one steel, in the game and in the placement preview.
- **`RouteEvaluation.passageBlocked`**, the one test of whether a route may run through a stop,
  which route evaluation and the autorouter share.

The shared UI gained, all optional and used here first:

- **Market markers** (`TitlePresentation.marketMarkers`): a title's own marker hung as a tab
  under its space below the market, here the debt marker.
- **Every phase change marked in the history** (`historyMarksEveryPhase`), for phases that
  change within a colour as events, here the deck's cards.
- **Tile groups** (`MapViewDefinition.tileGroups`): hexes one tile covers, chosen, highlighted
  and drawn in the picker as one piece, here the gorge.
- **A lead in a title prompt** (`TitlePrompt` `lead`), such as the indebted railroad's token.
- **A private's holdings on a company's card** (`privateHoldings`), as on a player's.
- Across every title: export rows show each exported train, and phase changes and exports in
  the history name no player.

Every other 18xx title's runtime-contract fixture changed additively (the `LayTile`,
`LayPrivateTile`, `RespondToTrackConsent` and `DistributeEarnings` digests and the
`earningsDistribution.added` field), so each one's next release needs a logic major.

Title-side compositions, all on family modules: the steel market and `ChooseSteel`; gold,
`ShipGold` and ghost towns; `ExtendTrain`; `PayDebt` and the Treaty (`PhaseRules.changes`);
`UseBridgeLease` and `PayBridgeLease`, paid after the payout; the round settlement (`SystemActionFirstHandler` on `OperatingSet`, held for
the ending by `EndingRules.roundPending`); and the discounted metal purchases, which reuse the
family's share purchase evaluation.

Limits: train sales between railroads need the buyer's track to reach a seller's station, but
not the seller president's consent beyond the family offer. The Auction, Hand-Picked,
alternate gold-track and gorge-tile variants and the expanded privates are not built.

## Phases

The rulebook's phases are colours, started by phase cards that lie under the last train of a rank,
so a phase begins when that last train leaves the depot, bought or exported (RT-6, RT-7). The
family runs rusting, private closures and title events only on a phase change, so every card in
the deck that has an effect is a phase, and the table names them by colour:

| Phase      | Started by  | Colour | Effect                                                  |
| ---------- | ----------- | ------ | ------------------------------------------------------- |
| `yellow`   | —           | Yellow |                                                         |
| `green`    | the last 2+ | Green  | Green tiles, steel and pars; companies may buy privates |
| `treaty`   | the 2nd 3+  | Green  | The Treaty of Boston                                    |
| `green-4`  | the 1st 4+  | Green  | 2+ trains rust                                          |
| `brown`    | the last 4+ | Brown  | Brown tiles, steel and pars; St. Cloud moves            |
| `brown-5`  | the 1st 5+  | Brown  | Privates close                                          |
| `silver`   | the last 5+ | Silver | Gray tiles; no more private sales                       |
| `silver-6` | the 1st 6x2 | Silver | 3+ trains rust; the game end is triggered               |

## Readings of open questions (digest §5)

These are my readings, to confirm with the owner. The tile supply is settled: the rulebook's
manifest plus 57 ×5, 58 ×5, 19, 20 and 144 ×2, which its upgrade chart shows, at 18xx.games's
counts (OQ-17).

1. Tile laying is permissive, as the family's ordinary rule (OQ-1).
2. Terrain is paid on a hex's first tile only (OQ-2).
3. CF&I and VGC prices do not drop when shares are sold (OQ-3).
4. Steel in a column is bought cheapest first (OQ-4).
5. Shipped gold is part of the revenue, paid out or withheld with it (OQ-5).
6. RG's debt payments go into SF's treasury whether or not SF has started (OQ-6).
7. Gold Miner counts toward the certificate limit like every private (SR-11, OQ-7).
8. The Hanging Bridge Lease is chosen before the run, for that turn. The payment is 10% of the
   revenue of each train run through the gorge, past its middle, rounded down, paid after the
   payout from the treasury or the president's cash, whole, as the president chooses, whichever
   way the run was paid; one of them can always pay it (OQ-8).
9. U.S. Mint Worker closes only when used (OQ-9).
10. Player-only privates: William Palmer, Local Jeweler, Doc Holliday, Florence Oil Fields,
    Metals Investor, Gold Miner and U.S. Mint Worker (OQ-10).
11. Only railroads end the game by reaching the red zone (OQ-11).
12. The Coal Depot's winner pays the full bid; cubes are the bid over $10, rounded down (OQ-12).
13. Coal Creek gives its owning company one cube per company run through Coal Creek (OQ-13).
14. The Sulphur Springs conversion is free and is not one of the six lays (OQ-14).
15. Salvage: $20 for a 2+, $45 for a 3+, to the owning company (OQ-15).
