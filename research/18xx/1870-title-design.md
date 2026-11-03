# 1870: title plan and design

1870 (Bill Dixon, Mayfair) is the eighth executable 18xx title. It is the family's first title with
connection runs, and the second with price protection and redemption, which moved out of 1832 into
the family for it. This note records the evidence, the family changes, and the rulings, under the
standing [18xx design rule](../../docs/agents/18xx-design.md).

## Authority and sources

**The Mayfair rulebook is the rules authority.** Page numbers in the code and below refer to it.

- The Mayfair rulebook, `/workspace/artassets/1870/dl/MFG_1870.pdf`, with its text beside it.
- The published map, `/workspace/artassets/1870/web/map_1870.gif`, checked hex by hex for the river's
  course and the printed markers.
- BGG's 1870 rules forum, saved to `/workspace/artassets/1870/bgg/all-forums.json`, including
  answers from the designer.
- The designer's own 1870 rules, archived in `/workspace/artassets/1870/dixon-rules` (sections 3, 9 and
  16 could not be fetched). `1870dif.html` lists how Mayfair's edition differs from them.
- The research site's `g_1870` at the research snapshot: evidence for data and a source of real
  games, never the rules. Seven of its games were converted and replayed through this engine.

## Family survey and decisions

| Mechanism                        | Elsewhere                     | Decision                                                                                                                                               |
| -------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Soft ledge market                | 1832, 1850, 1870              | `SoftLedgeMarket` in the family, built from rows and zones. 1832 now uses it.                                                                          |
| Price protection                 | 1832, 1850, 1870              | `PriceProtectionProcedure`, lifted from 1832. Titles differ in `newPresidentProtects`, `mayProtect`, `sellerStillRaising` and `resumesWithoutPlayers`. |
| Redemption and reissue           | 1832, 1850, 1870              | `ShareRedemptionProcedure`, lifted from 1832. Titles differ in `mayRedeem`, `redemptionsPerRound`, `reissueParPrice` and `reissueNeedsEmptyOffering`.  |
| Holdings above 60%               | 1832, 1850, 1870              | `OwnershipExcess`, lifted from 1832.                                                                                                                   |
| Their UI                         | 1832, 1870                    | `ShareActions`, `CompanyShareActions`, `PendingShareDecision`, `describeShareAction` in `@tabletop/18xx-ui`.                                           |
| Connection runs                  | 1870, 1850 (similar)          | `DestinationRunProcedure`, with `routesBetween` and `connectedWithin`. The title supplies destinations, homes and where a station goes.                |
| A route that must use given ends | connection runs               | `RouteRules.requiredRouteEnds`; the autorouter's `solveRequired` enumerates such routes per train type and solves the rest of the fleet beside each.   |
| Offboard homes                   | SP                            | `routeReach` lets a route leave an offboard origin through a fresh matched pair.                                                                       |
| Printed river lines              | 1870                          | `printedLines` on the map view, drawn in one layer above the hexes; marks placed in a hex keep clear of a line's `points`.                             |
| Acting company                   | any title interrupting a turn | `actingOperatingCompany`: a connection run acts for a company other than the next in order. Private exchanges, headers and panels read it.             |
| Two powers on one private        | Gulf Shipping                 | `TitlePrivatePower.label` distinguishes them. Lists used to key on the private and crashed the table.                                                  |
| Bankruptcy with held sales       | 1870                          | `sellerFinished` counts a bankruptcy as finishing; a title wraps `Bankrupt` to let presidents decide. Below.                                           |

## What is built

- Logic: `games/1870`. The auction of six privates, the Frisco's par at purchase and its 20% float,
  the Katy's share, the stock round with redemption, reissue and protection, operating rounds,
  connection runs, the river until the bridge sells, Port and Cattle tokens, gray tiles, eight
  phases, forced sales, bankruptcy and the broken bank.
- Variants: `$400 finish`, `1830 diesels`, `Station marker wars` (pp. 24-25). Not built: Historical
  Order and the 1850/1832 market.
- UI: `games/1870-ui`, on `GameTable`, with no title-side table of its own beyond `ConnectionRun`.
  Harness port 4209. Scenarios: bridge for sale, price protection, company shares, connection run,
  connection route, port token, late game.
- 2 to 7 players, in beta (`beta: true`, `GameVisibility.Beta`), in the 18xx series. Mayfair prints 2 to 6; the seventh is the designer's row (certificates 9, then 7) with $300 each, by the owner's ruling (2026-11-03).

## Rulings

Where the rulebook is silent or contradicts itself.

### Differences from the research site, on purpose

- A half dividend leaves the company half rounded **up** to $10; the site rounds down (p. 20).
- Reissue prices follow the table on p. 18, which is not uniform on exact ties: $140→$110 rounds up,
  $200→$140 and $350→$250 round down. The site rounds every tie up ($200→$160, $350→$275). The board
  confirms the table to $200: its par boxes print 110 (140), 120 (160), 140 (180), 160 (225) and
  200 (275), read from two BGG photos in `/workspace/artassets/1870/board` (pic7284967, pic857319).
  $300→$225 corrects the table's $220, which is not on the chart.
- Plain river hexes allow track along either bank before the bridge sells (p. 9); the site's code
  effectively blocks them.
- **Bankruptcy with undecided sales.** The rules say the game ends immediately, but also that all
  sold shares may be protected, and the example on p. 25 prices the T&P at $90 "*if not protected",
  or $120. So the presidents of a bankrupt player's sales decide first, then the game ends. The site
  ends at once and leaves the prices where they are, so its `1870_game_end_bankrupt` game stops here
  at the decision instead of reaching its recorded result. Finishing that game: IC and MKT sales were
  held, and the deciding president ends on $2,330 declining or $2,360 protecting against the site's
  $2,410, and another player on $5,082 against $5,092. The order of the players does not change.

### The bridge (p. 9, BGG)

- The power is one use, either the free home lay or the $40 discount. Using it does not close the
  company. Reported Dixon ruling, repeated on BGG.
- The discounted lay is extra, besides the ordinary lays, by the owner's ruling (2026-11-03). The
  rulebook calls only the first-round lay "in addition", but a forum answer and the site both make
  the discount extra too, so a company may lay two yellows and then the river tile.
- In a river company's first round, with its home empty, the power offers only the free home lay.
  If the home is built, it offers the discount. It does not offer both choices at once: a player
  wanting the discount elsewhere uses it in a later round.
- A tile laid with the power, free or discounted, cannot be upgraded by that company that round (p. 9 for the free tile, BGG for the discount).

### Stock and protection

- A new president cannot protect a sale that passed them the presidency (p. 16, BGG).
- A president who sold the company this stock round cannot protect (p. 13).
- A forced sale above 60% must sell down to 60% (Dixon, BGG); priority does not move on a forced
  sale's protection.
- Reissue money comes only as the shares sell.

### Map and tiles

- Gray tiles: Kansas City has 3 slots and St. Louis 2. The physical tiles are confirmed on BGG; the
  manifest is transposed.
- Cattle and port lists are large cities only, following the printed anchors and Thomasson's page.
  The glossary's "city" is broader. The owner agreed (2026-11-03).

### Holdings above 60%

- **The designer's rule, not Mayfair's, by the owner's ruling (2026-11-03).** A holding above 60% is
  kept wherever the price goes, may not be added to outside green and brown, and sells down to 60%
  the next time its holder sells that company outside them, a forced sale too. Mayfair's p. 6 and its
  ruling make the holder sell on the next stock turn once the price leaves those zones. The designer
  writes that they "always treated shares purchased in this way the same way as shares acquired
  through share price protection" (`1870dif.html`, 5.9). 1832 §5.4.1 and §5.9.8 say the same, and the
  site never forces the sale. BGG players are split.

### Left as they are

- Rightward moves at the ledge go up, by the owner's ruling, though p. 8's wording reads otherwise.
- P hexes take only #170 in brown (p. 19), refusing #63, and #28/#29→#43 and #58→#144 are allowed
  although p. 30 omits them. The site does the same on both, which the owner was content with.
- Nothing checks that a run is the best one (p. 20). The autorouter finds the best, by the owner's
  ruling that this is enough.

### Connection runs

- Checked after each company's turn.
- A destination station is a full station, usable as a route's station.
- The check is bounded, as it runs on the backend after each turn: `reachRoutes` settles unconnected
  pairs and unlimited trains exactly, and the shortest-route search stops after `RouteSearchSteps`
  (10,000), a count so replays agree. A company whose route lies past that waits a turn. The recorded
  games stay far below it: their worst check takes about 7 ms.
- Station Marker Wars is the designer's untested variant. Eligibility re-evaluates after each run, so
  a blocked company waits.

## Verified by tests

- `forcedSale.spec.ts` plays p. 25's Ima Swindler example: the same sale limits on each company,
  $920 raised, the same game-end prices, $942 net worth, and $120 if protected.
- `finishedGame.spec.ts` replays a converted four-player game to the broken bank, through seven
  connection runs, protection, redemption and all eight phases.
- By hand, replaying with the site's rounding: `1870_game_end_bank` and `game-end-market-400`
  (diesels and $400) reach `GameOver` with exactly the site's final wealth. The other games convert
  fully and end by manual game end, except the bankruptcy game above.
- `boardAreas.spec.ts` for the map layout, `scenarioFiles.test.mjs` for scenarios.

## Known limits

- The harness's scenarios beyond 300 actions open with no history, to keep their files small.
- `apps/18xx-playground` has no 1870 entry, like 1833NE.
- The cover is BGG's box scan, 800×655.
