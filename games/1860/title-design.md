# 1860 — title design

Rules authority: the second-edition rulebook (JKLM/Z-Man 2010), saved as text in
`/workspace/artassets/1860/rules-2nd-edition-rulespal.txt`, which was reprinted in 2022 as the third
edition "with the minimum number of changes" and a handful of clarifications (the designer, Mike
Hutton, on BoardGameGeek). The third edition's text is known through forum quotations and the
18xx.guide player aid (`18xx-guide-player-aid.txt`). The BoardGameGeek rulings for thing 12750 (257
threads, 2,233 posts) are digested, with links, in `/workspace/artassets/1860/rulings.md`; ids below
(AU-3, TR-6, …) are that digest's. Section names in the code (Running Trains, Insolvency, …) are the
rulebook's. The research engine (`g_1860`) supplied the hex coordinates and the tile manifest's
track layouts, checked against the rulebook and the player aid's manifest; its procedures are
evidence only.

Scope: the second/third edition game for 2–4 players on the extended (3–4 player) map, with
these optional rules as game options: simplified insolvency revenue, no passing small stations
(the first edition's rule), re-entering hexes, full price for shares of companies that have not
operated, and two 7+4 trains.

## What makes 1860 different

| Mechanism                                                                                     | Rules                      | Support                                                                    |
| --------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------- |
| Six auctions for the right to choose one of four privates or the C&N/IOW director's share     | Initial Auction, AU-1–7    | Title `ChoiceAuction` state; bid, pass, choose (with par)                  |
| Companies available by layer: the next after one of the layer before operates or sells out    | Major Companies, LY-2      | Derived `openLayer`; `CompanyRules.startMarketSpaces`                      |
| Privates exchanged for a reserved IPO share; sold to the bank (face − £30) and bought back    | PV-2, PV-5, PV-9           | Family private exchange; title `SellPrivateToBank`/`BuyPrivateFromBank`    |
| The Fishbourne Ferry for sale from the first 6+3, closing the other privates                  | PV-3, PV-4                 | Title `BuyPrivateFromBank`                                                 |
| Full capitalisation at 50% in players' hands; the director lays a bare home hex's tile        | Flotation, SR-15, TR-10    | Family flotation; title `LayingHomeTile` state                             |
| A zig-zag market: a sale moves one place, a dividend a space on the tier (two places)         | Share Price Movement, DV-2 | Family `createLinearStockMarketSpaces` `zigzag`; title earnings effect     |
| Train-less companies' shares sell and score at half; red-letter zones ignore a sale's first   | SR-4, SR-7, EG-3           | Title `saleTerms`, `saleMovement`, ending valuation                        |
| The director's share sold into the pool: receivership, claimed by the first second share      | SR-11, SR-12               | Family `presidencyLapses`, presidency claim; title `ReceivershipRules`     |
| Two yellow tiles (no large station), or one large station, or one upgrade within train reach  | TR-1, TR-6                 | Title `allowance`/`restriction`; `TrainReach` search                       |
| M+N trains; small stations and halts may be passed; halts pay a £10 subsidy, never route ends | RT-1–RT-3                  | Family optional stops, stop subsidy, halts                                 |
| Runs meet at a station, one through the home; one tokened-out pass a run; no hex re-entry     | RT-5–RT-7                  | Family fleet connectivity, blocked passes, hex re-entry                    |
| Insolvency: a leased train earning £40 + £20 a stop, withheld                                 | IN-1–IN-9                  | Family leased train; title `ChangeInsolvency`, `stopRevenue`, earnings     |
| Bankruptcy at price 0: shares back to the IPO, bases flipped, assets kept for a refloat       | BK-1–BK-7                  | Title `BankruptCompany`, flipped bases via `passesStations`                |
| Excess trains go back to the bank at the start of the company's next turn                     | TN-8                       | Title `ReturningTrains` state                                              |
| The Southern Railway (first 9+5), then British Rail: endless ORs closing the lowest payers    | SO-1–SO-9                  | Title `BeginSouthernStockRound`, `FormBritishRail`, `NationaliseCompanies` |
| Separate player money (£10,000) and company credits; the bank breaks on player money          | MI-1, EG-1, EG-2           | Unlimited bank cash; title ending trigger on players' money                |

## Family additions

Surveyed against the research catalogue (`18xx-game-variation-catalog.md` §"1860/1862 and gauge
games"; `18xx-shared-engine-design.md`), which already named 1860's fleet connectivity and halts as
anticipated consumers of 1862's fleet rules and track stops.

- **Halts** (`TileNode` town `halt`): a stop that earns nothing, pays its company a subsidy, and
  where no route begins or ends. Every halt is a town, so tile upgrades treat halts and small
  stations alike (TR-5); titles without halts are unchanged.
- **Optional stops and stop subsidies** (`RouteRules.stopOptional`, `stopSubsidy`;
  `RouteResult.subsidy`): a train may pass an optional stop without counting it toward its
  distance or being paid for it; a route calls at the optional stops worth most to it, revenue and
  subsidy together, while its distance allows. Route subsidies add to the operating result's
  subsidy, which the family pays to the treasury. 1862's Express trains, which visit and then
  choose paid stops, keep their own policy.
- **No hex re-entry** (`RouteRules.forbidsHexReentry`), **blocked city passes**
  (`RouteRules.blockedCityPasses`, counted over the whole run), **leased trains**
  (`RouteRules.leasedTrain`, run without being owned), and **fleet connectivity at several stop
  kinds** (`FleetRules.connectivity.at` as a list; `FleetRoute.stops`).
- **Inter-company price steps** (`TransferRules.priceRange` `multipleOf`): 1860's trains change
  hands for multiples of £10.
- **Tile #115** joins the standard catalogue (a yellow city with one exit; also 1825's).

`RouteResult.subsidy` is an optional field in the canonical state, so every 18xx title's
runtime-contract snapshot gains it, and each needs a logic major at its next release.

## Phases

| Phase | Started by | Tiles  | ORs | Limit | Effect                                                     |
| ----- | ---------- | ------ | --- | ----- | ---------------------------------------------------------- |
| `2`   | —          | yellow | 1   | 4     |                                                            |
| `3`   | first 3+2  | green  | 2   | 4     |                                                            |
| `4`   | first 4+2  | green  | 2   | 3     | 2+1s rust                                                  |
| `5`   | first 5+3  | russet | 3   | 3     |                                                            |
| `6`   | first 6+3  | russet | 3   | 2     | 3+2s rust; the Fishbourne Ferry for sale                   |
| `7`   | first 7+4  | russet | 3   | 2     | 4+2s rust                                                  |
| `8`   | first 8+4  | russet | 3   | 2     | 5+3s rust; no certificate limit; sales no longer move      |
| `9`   | first 9+5  | russet | 3   | 2     | the Southern Railway forms; British Rail when all have one |

## Readings

Where the rules and rulings leave a choice, this is what the code does.

1. **Insolvency after a refloat** (BK-7, OQ-2): a bankrupt company that floats again starts
   solvent, becoming insolvent only at the end of its first turn, as the rulebook's bankruptcy
   section says and the designer's 2015 answer confirmed. 18xx.games keeps the marker.
2. **Run choice**: a route calls at the optional stops worth most to it, revenue plus subsidy, ties
   to revenue. A director cannot choose to call at a halt in place of a better-paying small
   station (RT-4 allows it); see Limits.
3. **The bank breaks** when the players' money reaches £10,000, its last note gone (MI-2, OQ-12).
4. **Nationalisation blocks** on every started, unbankrupt company with a director and no train,
   floated or not (OQ-5), as 18xx.games does.
5. **A company floated after the Southern's stock round** places its home base but lays no home
   tile (OQ-4).
6. **The receiver** of a company in receivership is its largest holder, ties from the priority
   holder; the rules leave it to the players' agreement (SR-12).
7. **Priority after the auction** on a tie for the most money goes to the least face value of
   privates among the tied players holding any, else to the first tied player in turn order
   (AU-6, OQ-14).
8. **The leased train's £40** is paid at the home station its run must include, so that a run is
   needed to earn it (IN-6).

## Limits

- The original (2–3 player) map is not offered: titles' rules hold one map, and the extended map
  is the rulebook's standard. The original insolvency revenue (half, rounded up to £10, with full
  subsidies) is not built: it rounds over a whole run, which the per-stop revenue model cannot
  express. The destinations and historical-order variants and the Locomotives expansion are not
  built.
- A director's run calls at the best-paying optional stops; choosing subsidy over revenue stop by
  stop is not offered.
- Several companies sold in one sale action are checked for bankruptcy after the action, not
  share by share (SR-5); a bankruptcy still ends the stock round at once.
