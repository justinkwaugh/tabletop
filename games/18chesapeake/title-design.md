# 18Chesapeake — title design

Rules authority: the All-Aboard Games rulebook of 2020-08-12 (the published file from the AAG
shop) and the AAG errata, saved with text copies in `/workspace/artassets/18chesapeake`
(`rulebook-aag-published/`, `errata-gdoc/`). The 2020-06-25 Dropbox rulebook is kept beside it for
its map page. Section numbers below are the published rulebook's. Rulings from the BoardGameGeek
forums (thing 253608, 282 threads) are collected, with their authors and links, in
`/workspace/artassets/18chesapeake/rulings.md`; the designer and publisher, Scott Petersen, posts
as scottredracecar. The research engine (`g_18_chesapeake`) supplied hex coordinates, terrain,
tile track layouts and the stock market grid, checked against the rulebook, its tile chart (§18)
and the Dropbox map.

Scope: the whole game for 2–6 players, with the two-player variant (§14) at two-player tables, and
the Off the Rails expansion as a game option. Its rules are the AAG rule sheet
(`/workspace/artassets/18chesapeake/otr-rules/`) with the community readings in `rulings.md` §10:
orange and brown zones apply to every player, and "sell before" means sell-buy-sell.

## What makes 18Chesapeake different

| Mechanism                                                                                                                                                                     | Rulebook      | Family support                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------- |
| Waterfall auction; only the D&R falls by $5 while nothing is sold, then all-pass pays income                                                                                  | §9            | Waterfall auction, default all-pass                               |
| The all-pass income round counts as a set: its export follows, phase change and all                                                                                           | §9, §11.9     | New `WaterfallAuctionRules.incomeExports`                         |
| Cornelius Vanderbilt brings a president's certificate drawn at setup; its buyer sets par                                                                                      | §3, §7.1      | Waterfall award, `requirePar`; title state `corneliusCompanyId`   |
| Cornelius Vanderbilt closes when that company buys its first train; companies cannot buy it                                                                                   | §7.1          | `privatesClosedByPurchase`, `sale: 'never'`                       |
| The B&O private brings a 10% B&O share                                                                                                                                        | §7.1          | Waterfall award                                                   |
| C-P and B&S: two tiles 8/9, joined across their shared side, besides the lay, forfeited by any other tile                                                                     | §7.1          | Private track terms `together`, `recordsLay`, a title restriction |
| C&O Canal: #57 in Berlin as the lay, paying $80, then a free station that is the turn's station                                                                               | §7.1          | Private track terms `countsAsOrdinaryLay`, `stationPrivateIds`    |
| The next 2, 3 or 4 is exported at the end of each set, starting its phase                                                                                                     | §11.9         | `OperatingRules.trainsToExport` (as 1817 and 1861)                |
| D-trains $900, or $700 trading in a 4, 5 or 6, from the first 6                                                                                                               | §11.7         | `dieselTrains`                                                    |
| DC and OO tiles; the OO cities join in brown; Baltimore pays its water again on the green upgrade                                                                             | §11.3, §18    | Title tiles X1–X9, `preservesStops`; preprinted-tile terrain      |
| PLE's home in red Pittsburgh, one location with B2; West Virginia Coal one location over two hexes                                                                            | §10.4, map    | A red city with staged revenue; `stopGroup`                       |
| Yellow-zone shares free of the certificate limit, and buyable at the limit                                                                                                    | §10.1, errata | `marketZoneHoldingLimits`                                         |
| Two players: triple presidents but Vanderbilt's, unsold shares to the pool on float, a pool share removed before a non-president's pool purchase, sold out with an empty pool | §14           | `onFloat`, new `StockRules.purchaseRemoval`, `soldOut`            |

## Off the Rails

| Change                                                                 | How                                                                     |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Its own market: 11 rows, yellow, orange and brown zones, $300 game end | Both grids in one chart, Off the Rails's spaces under `otr:` ids        |
| $12,000 bank                                                           | Opening                                                                 |
| Sell–buy–sell turns                                                    | `StockRules.turnOrder` may now depend on the game                       |
| Companies float at 50% sold                                            | Title `sharesToFloat` and `flotationPayments` by option                 |
| Two fewer 2-, 3- and 4-trains and one fewer 5; no exports              | Depot supply variant; one export rule for the set's end and the auction |
| D-trains $1,100, $800 with a 4, 5 or 6 traded in                       | A second D definition, sold only by the Off the Rails supply            |
| A price reaching $300 ends the game, at once after a stock round       | Title `EndingRules`                                                     |

Each edition's settings are one record (`EditionChesapeake`: bank, market, turn order, float,
train supply, D-train and credit, exports, market-top end), chosen from the game's
`offTheRails` flag.

A game uses one market. The chart holds both grids unconnected, so every family use of
`StockRules.market` moves markers within the game's own grid; the title starts companies only on
its own par spaces, and the table draws only its own grid (the title session's
`stockMarketChart`). The board's market area is tall enough for either at TOP's scale.

## Family additions

Surveyed against the research catalogue (`/workspace/research/18xx-2026-09-08`): the auction and
train-export entries of the variation catalogue, and the share-purchase traits.

- **A certificate taken out of play before a purchase** (`StockRules.purchaseRemoval`,
  `SharePurchaseDetails.removedCertificateIds`, `purchaseForfeited`). Only 18Chesapeake's
  two-player game does this among the researched titles, so the hook is the smallest that keeps
  the rule inside `BuyShares` instead of a title action replacing it. The title names the removed
  certificate; when it is the bought one, the buyer pays nothing and gets nothing, and the turn's
  purchase is made (§14.3, designer ruling 39979196). `BuyShares.expectedPrice` may now be 0, an
  additive change to every 18xx title's action schema. History and the company trade popover say
  what was removed.
- **Exports after an all-pass income round** (`WaterfallAuctionRules.incomeExports`, recorded as
  `exports` on the `ResolveAuction` income metadata). 1830, 1889 and 1882's all-pass rounds only
  pay; 18Chesapeake counts its round as an operating round and exports a train (§9; publisher's
  18xx.games issue #1092). The auction runs the family's own export (`exportDepotTrains`, shared
  with `ExportTrains` and its `TrainExport` metadata), so a 3-train exported there starts phase 3
  through `AdvancingPhase` and the auction resumes, as 18xx.games does.
- **A stock turn order that depends on the game** (`StockRules.turnOrder` may be a function of the
  state): Off the Rails allows sales after the purchase where the printed game does not.
- **Tile 915** (gray, 50, three spaces) joins the standard catalogue; 1844, 1848 and 18Tokaido
  use it too.

## Rulings and decisions

1. **Paired lays only in the track step, both at once.** The card says "in addition to the
   company's tile placement action"; the publisher confirmed the track-step reading (18xx.games
   #524). Once one tile is down the second must follow; the pair needs a lay open in each hex
   before it starts.
2. **Forfeit is read from the board.** A tile in either hex not laid by the power ends it; the
   power's own first tile is recognised from the turn's recorded extra lays.
3. **The Canal's station is the turn's station** (designer 35454838; published card).
4. **Cornelius Vanderbilt closes at phase 5 too** (§7.1 "All private companies are removed").
5. **No private sales between players** (no rule allows it; community 34382313).
6. **Trains over the limit go to the bank pool** (§11.7); traded-in trains go to the pool.
7. **Two-player removal applies only to bank-pool purchases** (§14.3). 18xx.games also removes
   a pool share when a non-president buys from the IPO while a pre-float pool share exists; the
   rules do not, and we follow the rules.
8. **No sales in the first stock round, even after an all-pass income round in the auction**
   (§10.2). 18xx.games allows them then; the rules do not.
9. **Selling a company's presidency in two-player games** needs a holder of at least as many
   shares as the 30% certificate, as the family requires for any certificate size.

10. **Track is semi-restrictive** (§11.3, designer 42707035): new track must extend a route of the
    company, or the lay must raise a reachable city's value.
11. **A president funds another company's train only when the treasury cannot buy the cheapest
    from the bank or the bank pool** (§11.8), and then for up to its face value.

12. **Tournament seating may change the company drawn for Cornelius Vanderbilt** (the owner's
    ruling, 2026-11-15): with assigned seats the rest of the setup matches the ordinary game, and
    at two players the president's certificate sizes follow the drawn company (§14.1).

## Open questions for the owner

- A player raising their own standing bid in the auction is unruled; the family's waterfall
  auction treats it as for 1830.
