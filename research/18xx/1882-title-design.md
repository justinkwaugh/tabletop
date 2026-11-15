# 1882: Assiniboia — title design

Rules authority: the All-Aboard Games rulebook of 2020-08-12 (the published file, the same as BGG
filepage 206629) and the AAG errata, saved with text copies in `/workspace/artassets/1882`
(`rulebook-aag-published/`, `errata-gdoc/`). Section numbers below are the rulebook's. Rulings
from the BoardGameGeek forums (thing 282435) are collected, with their authors and links, in
`/workspace/artassets/1882/rulings.md`; the designer, Marc Voyer, posts as thethrax and the
publisher as scottredracecar. The research engine (`g_1882`) supplied hex coordinates, terrain,
river costs and tile track layouts, checked against the rulebook and its tile chart (§17).

Scope: the whole game for 2–6 players. There are no variants.

## What makes 1882 different

| Mechanism                                                                                         | Rulebook        | Family support                                                                   |
| ------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------- |
| Waterfall auction; when all pass the cheapest unsold private falls by $5, to nothing              | §9              | Waterfall auction, new `allPass: 'discount-next'`                                |
| Canadian Pacific brings the CPR presidency and its par; Trestle Bridge a 10% share drawn at setup | §3, §7.1.4–5    | Waterfall award, `requirePar`                                                    |
| Neutral stations: free, one a hex, never blocking; held on five charters; the CN runs from them   | §4, §10.4, §11  | New neutral stations (`StationFields.neutralStations`)                           |
| The CN may start only while a neutral station stands on the board, and has no home                | §10.4           | Title `startTerms`                                                               |
| The Saskatchewan Central exchanges for the SCR presidency, as a stock turn's purchase             | §7.1.2          | Title action `ConvertCentral` in the stock round (`StepActionsHandler`)          |
| The SC adds an extra train on top of the bank's stack when a 3, 4, 5 or 6 is next                 | §3, §7.1.2      | Title: the four extra trains are in the supply, set aside at setup               |
| The North-West Rebellion: the first train of a drawn kind removes the yellow tiles in its hexes   | §3, §8          | Title system action `NorthWestRebellion` (`SystemActionFirstHandler`)            |
| The NWR private moves a station into a rebellion city, then lays or upgrades a tile there         | §7.1.3          | Title action `MoveRebellionStation`; family private track lay for the extra tile |
| A yellow tile laid in a rebellion hex earns $20                                                   | §11.3.1         | `TrackRules.afterLay`                                                            |
| Two yellow tiles (the second $20) or one upgrade                                                  | §11.3           | Title `allowance`                                                                |
| River crossings paid only when completed; the Trestle Bridge earns $10 a crossing                 | §7.1.4, §11.3.3 | `completedCrossingCost`, `TrackRules.afterLay`                                   |
| Hudson Bay with Northern Alberta or Western Canada adds $100                                      | §11.5           | Connection bonus                                                                 |
| The fishing exit: a stop that need not count against a train                                      | §11.5           | `uncounted` offboard                                                             |
| Privates close at phase 5, the SC at phase 6                                                      | §8              | `PrivateCatalog` closure, new `{ closurePhaseId }`                               |
| A price on the top-right space ends the game, at once or after the operating round                | §12             | Title `EndingRules`                                                              |
| Trains over the limit leave the game                                                              | §11.7           | `discardDestination: 'removed'`                                                  |

## Family additions

Surveyed against the research catalogue (`/workspace/research/18xx-2026-09-08`): the station
blocking and reservation traits ("Neutral-token treatment"), the variation catalogue's 1882 and
event sections, and the waterfall auctions of 1830, 1889, 1894 and 1833NE.

- **Neutral stations** (`NeutralStation`, `StationFields.neutralStations`, `neutralStation`,
  `stationPlacer`, `placeableStations`, `cityHasNeutralStation`). 18xx.games treats neutral
  tokens as a shared token type in its City (18GA, 1882 and others); their placement and use
  differ by title. Shared: a neutral station fills a city space and blocks no route through the
  city; its company (1882's CN) runs from it like any of its stations; one held by another
  company is placed by that company in its station step, priced by the title. The station keeps
  its company, so "one station per company per hex" makes "one neutral station per hex". A
  neutral station with no holder waits in the supply for a title power. `cityIsBlocked` and the
  autorouter, which uses it, follow.
- **Neutral stations in the UI**: `MapViewDefinition.neutralStation`, drawn wherever a placed
  neutral station stands; charter tokens and counts list the stations a company places
  (`placeableStations`), the neutral one in its own art; the station step keeps the company's own
  stations as the automatic choice and offers a "Neutral station" button. `stationMapTokens` now
  takes the view's station art as one argument.
- **All-pass discount on the next private** (`WaterfallAuctionRules.allPass: 'discount-next'`).
  1830 and 1889 lower only the first private and then pay income; 1894 lowers the first private
  while it is unsold and pays income; 1882 lowers whichever private is cheapest unsold, the
  discount ending when it sells, and never pays income (§9; community ruling: no payout while
  privates remain unsold). A private forced on a player at $0 counts as their purchase for the
  priority deal under `firstStockPlayer: 'after-last-purchase'`.
- **A private's own closing phase** (`PrivateDefinition.closure: { closurePhaseId }`), for 1882's
  Saskatchewan Central, which outlives the other privates by a phase.
- **A token near its printed point** (`TokenPlacement: { near }`): a marker stands at the clear
  spot nearest where the board prints it, as 1882's rebellion markers on each hex's right side,
  moving only as far as a laid tile's track and stops make it.
- **A train a company may count as obliged to own** (`TrainRules.mayRequireTrain`,
  `EmergencyTrainFunding.optional`): a trainless company not obliged to buy a train may still
  have its president fund one through the ordinary emergency procedure, and may finish without
  it; the train panel says "may buy". 1882's fishing exit is the first use.
- **Auction hooks typed by the title's state** (`WaterfallAuctionRules<State>`): a title's
  award and income hooks read its own fields, as 1882's award reads the Trestle Bridge's drawn
  share.
- **Train marks in the roster** (`PhaseChartData` train `marks`, `TrainMark`): an icon, short
  label and description beside a train in the depot and phase chart for what buying it brings,
  as 1882's rebellion.
- **A pending private lay fixed to one hex** (`PrivateTrackLay.locationId`): a power that
  chooses the hex before the lay records it with the pending lay, which the family clears on the
  lay or its decline, as 1882's NWR lays in the hex its station moved to.
- **Title operating modes in the train step**: the operating mode switch also shows in
  `BuyingTrains` when the title offers a mode there, as 1882's NWR power may be used at any time
  in the turn.

Considered and not built: a family "train event" mechanism (1882's rebellion, 1849's earthquake,
Wyoming's busts). The rebellion is a title system action keyed to the train supply; a second
title with a train-keyed event would be the time to lift it.

## Rulings

Made while implementing; the forum sources are in `rulings.md`.

1. **The rebellion's train is public** (the owner's ruling, 2026-11-15). The rulebook hides the
   NWR card in the train stack (§3); 18xx.games announces the drawn train at setup. Followed: the
   depot and phase chart mark the drawn train with the rebellion icon from the start, "2nd" once
   the SC's extra train puts the card under the second. The title therefore has no hidden
   information and draws the train from the public PRNG.
2. **Emergency purchases buy the cheapest bank train** (§11.8), as 18xx.games. The designer's
   older answer (any legal train, 2020-05-19) predates the published rules.
3. **A player may raise their own bid** on a private, as the family's waterfall auction and
   18xx.games allow. The AAG text dropped v14's "increase their current bid"; there is no ruling.
4. **Over 60% after leaving the orange zone** follows the family's zone holding limits, as for
   1830; the rules are silent, and 18xx.games is reported to force a sale.
5. **Companies buy privates from phase 3 until they close** (§8), so the SC also in phase 5 (§11
   says phases 3 and 4; 18xx.games allows 3–5).
6. **The NWR power** may be used in the track, station, run and train steps, not while choosing
   the dividend (§7.1.3 says any time; 18xx.games also bars the dividend step).
7. **The CN cannot use the NWR private**: neutral stations are not "its existing station markers"
   to move, though they are the CN's to run from (unruled; 18xx.games might offer it).
8. **A route to the fishing exit alone obliges no train** (§11.5: the president chooses whether it
   counts), but the president may count it and raise money for a train as a company that must,
   selling shares if needed (§11.8), as 18xx.games allows. The family's
   `TrainRules.mayRequireTrain` offers that funding while letting the company finish without a
   train.
9. **The rebellion follows the purchase that reveals it**, before the phase change it may also
   bring; its yellow tiles return to the supply and stations stay in their cities (§8).
10. **The SC's extra train** is added when the next train in the bank is a 3, 4, 5 or 6, of that
    kind, on top of the stack: where the rebellion's card lies under the first of that kind, it
    then comes with the second (the designer's ruling, BGG 34119273).
11. **The second yellow tile costs $20 even in rebellion hexes** (the designer, BGG 34745384).
12. **River costs** are paid by the lay that completes a crossing (§11.3.3, the designer); the
    Trestle Bridge's owner earns $10 for each, whoever lays.
13. **Station counts**: CNoR, GTP and HBR have three stations and a neutral one, CPR four and none,
    QL two and one, SCR one and one, CN none (§10.4); the sixth neutral station is the supply's.
14. **The SCR's home** goes in any open unreserved city, Regina's included while one of its cities
    stays free for the QL, or on a neutral station (§7.1.2, §11.4).

## Data notes

- **Map**: the research engine's coordinates (letters are rows, numbers columns, flat hexes),
  river costs on both sides of each hexside, and impassable sides around Prince Albert, Candle
  Lake and C7. Location names follow 18xx.games; Regina (J10) is printed "Pile o' Bones &
  Lumsden" on the board.
- **Tiles**: the chart's counts (§17). #59 is green with two 40 cities and #66–68 brown OO tiles
  with 50s, as the family's standard catalogue already has them; R1 and R2 are title tiles.
- **Market**: 18xx.games's grid; par $67–$100 (§10.4); yellow, orange and brown zones (§10.1);
  the top-right $350 ends the game (§12).
- **River costs** match the printed board hexside by hexside; each shows until track meets
  across it from both sides (the family's rule, checked on a finished game in
  `games/1882-ui/src/lib/riverCosts.spec.ts`). Names that would sit under a river cost on a
  hex's top side are moved below it or under their cities, as the board prints them.
- **Cover**: the All-Aboard Games box lid, from BoardGameGeek's image of the published edition.
- **Company abbreviations** follow the AAG rulebook (CNoR, GTP, QL, SCR), not 18xx.games's (CNR,
  GT, QLL, SC). Tokens are drawn in the companies' colours with these initials rather than with
  18xx.games's logos, which print the other abbreviations.

## Verification

- `src/fullGame.spec.ts`: seeded bot games (`test/bot.ts`) for 2, 3, 4 and 6 players play to the
  end, exercising the SC exchange, neutral stations, the CN, the NWR move and the rebellion;
  `SWEEP=1` plays thirty seeds of each.
- `src/opening.spec.ts`: starting cash, the extra trains set aside, the setup draws, the all-pass
  discount moving to the next private, the CP and TB awards.
- `src/track.spec.ts`: the rebellion-hex bonus, river costs on completed crossings and the Trestle
  Bridge's income, the two-yellow-or-one-upgrade allowance, private blocks.
- `src/central.spec.ts`: the SC exchange (price, presidency, home, purchase used), its home on a
  neutral station, the extra train and the rebellion moving to the second train; the CN's start.
- `src/rebellion.spec.ts`, `src/nwr.spec.ts`, `src/ending.spec.ts`: the rebellion, the NWR move
  and extra lay (laid or declined), the game end, the privates' closing phases; rulings 5, 6, 7,
  11 and 13 each have a test naming them.
- `src/competition.spec.ts`: assigned seats for 2–6 players, and a seeded game from assigned seats
  ending with a valid result ranked by final scores.
- `libs/18xx/src/stations/stationPlacement.spec.ts`, `libs/18xx-ui/src/tests/sharedStations.spec.ts`:
  neutral stations in the family.
- Harness scenarios: `src/scenarios.build.spec.ts` with `SCENARIOS=1` writes positions into
  `games/1882-ui/src/scenarios`.
