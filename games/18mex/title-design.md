# 18MEX — title design

Rules authority: the rulebook, version 1.63 (17 August 2005), which was reprinted in 2020 without
gameplay changes, saved as OCR text in `/workspace/artassets/18mex/rules.txt` (Table IV's page is
`table-iv-tiles.png`), and the BoardGameGeek rulings for thing 18485 (62 threads, 508 posts). The
rulings are digested, with links, in `/workspace/artassets/18mex/rulings.md`; ids below (MG-4, TR-8,
…) are that digest's. The designer, Mark Derrick, posts as mderrick; his erratum closing the KCM&O
when its tile is laid overrides Table III (TR-8). The research engine (`g_18_mex`) supplied the hex
coordinates, the tile manifest's track layouts and the market grid, all checked against the board
photo (gallery 9272072) and Table IV; the digest's §4 lists where the rules and it differ.

Scope: the base game for 3–5 players, with the rulebook's four optional rules (8(a)–(d)) as
game options. Not built: the designer's Baja-Copper Connection variant pack (Compagnie du
Boleo, Santa Rosalia) and the 5% NdM change-making trades (3.2(a)(6), 3.2(c)(5)).

## What makes 18MEX different

| Mechanism                                                                                    | Rules             | Family support                                                         |
| -------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------- |
| Seven numbered items, privates and minors, sold 1830-style; bids clockwise from the highest  | 3.1, 3.1.1        | Waterfall auction, `clockwise-from-highest`, `rebidAfterPass`          |
| MCAR falls $5 a stock round while unsold; an all-pass with items unsold runs an income round | 3.1.2, AU-3       | Waterfall `discount-or-income`; title income pays each minor its run   |
| MIR brings a CHI share; MNR the NdM presidency and its par                                   | Table III         | Waterfall `award`, `requirePar`                                        |
| Minors A, B, C: one share charter, built-in 2-train, one yellow lay, half pay, never sold    | 1.3.3, 4.2        | 1846-style one-share minor; title allowance, earnings, transfers       |
| Phase 3½ (fifth 3-train) closes the minors for trade-in shares, their money to NdM/UdY       | 5.2, MI-4         | `PhaseRules.changes`, `exchangeCertificate`                            |
| NdM: 5% certificates, unavailable before 3½, +1 train limit, trains at face value            | 1.3.2, 5.1, 4.3.4 | A 20-unit company as 1856's CGR; title pricing and limits              |
| The NdM merger at the first 5-train: offers, the NdM president's choice, exchange tokens     | 5.3, MG-1–MG-9    | `PhaseRules.decisionState`, a title machine state and three actions    |
| Mail contract: a major with a train collects its home city's value before laying track       | 4.3.1, ML-1–ML-3  | Title `CollectMail` system action in the track step                    |
| Two yellow lays or one upgrade; a third yellow on a first turn under 8(a)                    | 4.3(c), 8(a)      | Title `allowance`                                                      |
| Mexico City and Puebla: one double tile, $60 then $40, two separate lanes east on brown      | 4.4.1(g), TR-4–5  | `companionTiles`, lanes, UI `tileGroups` and joined edges              |
| Seaport towns at the end of a spur from Mazatlán, Tampico and Veracruz                       | 4.4.1(e)          | A node-to-node path between city and town                              |
| Copper Canyon: the KCM&O's owner lays tile 470 for $60, unconnected, beside its lays; closes | Table III, TR-7–9 | `PrivatePowerRules.trackTerms` with `terrainDiscount`, `afterTrackLay` |
| Towns never count toward length; a 4D doubles cities and red areas, not towns                | 4.4.2(i), 4.4.2.1 | `cities-and-offboards`; title `stopRevenue`                            |
| One bank train a turn until the first 4-train                                                | 4.3.4(f), TN-2    | `TrainRules.purchaseLimit`                                             |
| 4-trains obsolete at the second 6-train, running once more; 8(d) rusts them at once          | 4.3.4.1, 8(d)     | `rustTiming` `after-operation`                                         |
| Red areas, Matamoros, Nogales and San Antonio pay their higher value from the first 5-train  | 4.4.2.1           | Staged revenue by tile colour                                          |
| Mérida is a red area with UdY's home circle; a route only begins or ends there               | 4.3(a), 4.4.2(h)  | Red city with `terminus` paths                                         |
| The game ends after the current operating round at a broken bank or a $200 price             | 6, EG-1           | `bankBrokenRoundEnding`; title market ending                           |

## Family additions

Surveyed against the research catalogue (`/workspace/research/18xx-2026-09-08`): the trait and
variation entries for certificate denominations, sale proceeds, location labels and the phase
chart.

- **Sale proceeds where a share is worth no whole amount** (`ShareSaleTerms.proceeds`). The
  NdM's 5% unit is half a 10% share's price, the odd half rounded up on a sale (3.2(a)); other
  titles keep paying the price for each share.
- **A hex whose tiles carry no label from a colour on** (`MapLocation.upgradeLabels` entries
  without `label`): Guadalajara takes standard tiles, then only the brown G tile, then the
  unlabelled gray tile (Table IV).
- **Desert and swamp terrain icons** in the shared map renderer (`cactus`, `marsh`).
- **A town on one line of track is a bar** wherever its two tracks end, not only between two
  sides: Toluca between its side and Mexico City, and Copper Canyon's town before its fork.
  Drawing every title's tiles and printed hexes, at each rotation, with the old and new code
  changes no other title's town.
- **An auction pass that is not final** (`WaterfallAuctionRules.rebidAfterPass`): a bidder who
  passed may bid again after another's bid, the lot going to the high bidder once every other
  bidder has passed since (3.1.1). Other titles keep a pass final.
- **A phase chart's rusting train named by the title** (`createPhaseChart` `rustTrainIds`), for
  a phase started by a later purchase of a kind, here the second 6-train's obsolescence.

None of these change a serialized schema, so the other titles' runtime contracts are unchanged.

## Phases

| Phase | Started by   | Tiles  | ORs | Limit (NdM) | Effect                                         |
| ----- | ------------ | ------ | --- | ----------- | ---------------------------------------------- |
| `2`   | —            | yellow | 1   | 3 (3)       | the rulebook's phases 1 and 2, which are alike |
| `3`   | the first 3  | green  | 2   | 3 (3)       | majors may buy privates                        |
| `3½`  | the fifth 3  | green  | 2   | 3 (4)       | the minors close; NdM stock on sale            |
| `4`   | the first 4  | green  | 2   | 2 (3)       | 2-trains rust; several bank trains a turn      |
| `5`   | the first 5  | brown  | 3   | 2 (3)       | privates close; the NdM merger; high values    |
| `6`   | the first 6  | brown  | 3   | 2 (3)       | 3-trains rust                                  |
| `6½`  | the second 6 | brown  | 3   | 2 (3)       | 4-trains obsolete                              |
| `4D`  | the first 4D | gray   | 3   | 2 (3)       | the gray tile                                  |

## Readings of open questions

These are my readings, to confirm with the owner.

1. Only one non-home station is exchanged in a merger, even when the home's token is unused
   because the NdM already stands there (OQ-1, the rule's "its other exchange token").
2. Two 5% NdM certificates held together pay exactly a 10% share's dividend; an odd 5% holding
   rounds up (OQ-2).
3. Selling both 5% certificates at once drops the price a row, a full 10% (OQ-3, 3.2(a)).
4. Under 8(b) the early KCM&O costs $20–$40, the ordinary half-face minimum (OQ-4).
5. Toluca pays nothing until the brown Mexico City tile joins it by track (OQ-7).
6. Copper Canyon's tile is a town with track to one side and a stub to a fork on the other,
   whose branches and a curve reach the two far sides, so no two runs share the stub (TR-9).
7. While the auction is unfinished, an operating round pays the privates and each minor its
   run along its printed track, $30 split between owner and treasury. The minors cannot afford
   a tile lay in the first two such rounds, so the rounds a real game reaches lose nothing.
8. Obsolete 4-trains do not count toward the train limit (18xx.games's practice; the digest
   notes it never matters in 18MEX).
9. When the NdM's presidency changes, the exchange uses the new president's certificates in
   the family's default order; the rules let the new president choose (3.5(b)), which the
   family's exchange choice, made by the outgoing president, cannot express.

## Limits

- The 5% NdM change-making trades are not offered. A player may still sell a 5% alone or with
  10% certificates, and buy one from the Open Market.
- The Baja-Copper Connection variant is not built.
