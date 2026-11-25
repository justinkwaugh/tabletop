# 1867: The Railways of Canada — title design

Rules authority: the Grand Trunk Games combined _1861 & 1867_ rulebook (2020), transcribed in
`/workspace/artassets/1861/grand-trunk/rulebook-rulespal.txt`, read with the designer's rulings. The
designer (Ian D. Wilson) rules that his original 1867 Rules of Play (v1.0, 5 March 2017; RoP below)
are definitive where the Grand Trunk text differs (18xx.games issue 9536, 2023); those rules are
saved in `/workspace/artassets/1867/rules-of-play-2017/`. Every ruling found on BoardGameGeek (games
184524, 227143 and 292187) and in the 18xx.games issues is compiled in
`/workspace/artassets/1867/rulings.md` (55 rulings, 10 open questions); section numbers below are
the Grand Trunk rulebook's (GTG). The research engine (`g_1867`) supplied hex coordinates, terrain,
tile layouts and counts, checked against the rulebook and the rulings.

Scope: the base game for 2–6 players with the Column Market, and the Grand Trunk optional rules
that apply to 1867 (§14). Cover: the 1867 half of the Grand Trunk combined box art (the same
image 1861 uses its half of).

## What makes 1867 different from 1861

1867 is 1861's system on a Canadian map. 1861 was already implemented, so this work moved the
mechanisms the two share out of `games/1861` into the family and built 1867 on them.

| Mechanism                                                                                                                  | Rulebook                | Where                                                                           |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| Minors' stations go in any city with no station, chosen at auction; Toronto's and Montreal's separate cities each take one | §7.2.1, ruling A7       | Title `minorHomes1867`                                                          |
| Montreal's floating city and Timmins take no station before phase 3                                                        | §7.2.1                  | New family `StationRules.cityClosed`                                            |
| Majors started in a stock round: an unconnected city in an empty hex, or any empty hex if none; never Toronto              | §7.4, ruling A8         | Family `UnconnectedCityHomes` (`connectedWhereNone`, `wholeHex`)                |
| Column market, one row above the map                                                                                       | §4                      | Title market on family `createLinearStockMarketSpaces`                          |
| The CN never operates: from phase 4 to 7 it exports the next train at the end of every operating round                     | §8.13                   | Family `OperatingRules.trainsToExport`                                          |
| The CN's station in Toronto from setup, one kept for Montreal (placed with the grey tile)                                  | §2.H, §8.13, ruling A10 | New family `NationalStations`                                                   |
| Nationalisation: a space and two a loan; money to the bank, trains out of play, the CN takes stations                      | §10.1                   | Family `nationaliseCompany` (`stepsPerLoan: 2`, no national id, trains removed) |
| Phase 8 trade-in: a major gives a train for half its face value off a train from the yard                                  | ruling A6               | Family `TrainRules.exchangePrice`                                               |
| Timmins doubled with Toronto, Montreal or Quebec                                                                           | §8.8.2                  | Connection bonus                                                                |
| Yellow triangles at G15, K13, L10 that a yellow tile must connect to                                                       | §8.6.2                  | Title track restriction; new family `TileLayout.printedShapes` to print them    |
| Granby (M13) locked until phase 3                                                                                          | §8.6                    | Title track restriction                                                         |
| Grey tiles from phase 7; off-boards brown in 5–6                                                                           | §11                     | Title phases                                                                    |
| First 8-train: finish the set, a stock round, three operating rounds                                                       | §12.1                   | Title ending                                                                    |

## Family additions (lifted from 1861)

Each was 1861 title code; 1861 now uses the family module, its behaviour unchanged (its 286 specs
pass) apart from the renames listed under "1861 contract".

- **Merger round** (`mergerRound/`): `MergerRounds` with `MergerRoundRules` (market, convert range,
  start space, minimum price, merge limits, ownership and certificate limits). State `mergerRound`,
  machine state `MergerRound`, the eight merger Actions.
- **Phase nationalisation** (`company/phaseNationalisation.ts`): `PhaseNationalisation` with
  `PhaseNationalisationRules` (phase ids by effect, hooks for the national company's start, final
  phase and reserved stations). `ApplyPhaseEffects`, `DecideTrainlessMajor`, `NationaliseCompany`;
  state `trainlessMajors`, `finalPhaseAt`.
- **Loan settlement** (`loans/loanSettlement.ts`): `LoanSettlements` and `SettleLoans`.
- **National stations** (`company/nationalStations.ts`): taking over a nationalised company's
  stations by city value, one a hex, within a limit outside the kept cities; placing a kept
  station (`PlaceStateStation`).
- **Shared rule helpers**: `minorAndMajorEarnings`, `minorAndMajorTrains`,
  `nationalCompanyTransfers`, `ownsNoTrain`, `poolRedemptionFinance`,
  `loanDiscountedValuation`, `bankBrokenRoundEnding`, `perHexStationCost`/`hexDistance`,
  `UnconnectedCityHomes`, `cityBlockedForCompanies`.
- **UI** (`libs/18xx-ui`): `NationalRailwaySession` (the title session with both modules),
  `MergerRoundModule`, `TrainlessMajorModule`, the `MergerRound` and
  `TrainlessMajor` panels and `describeNationalRailwayAction` history rows, all from 1861-ui.
- **Test bot** (`libs/18xx/test/mergerTitleBot.ts`): 1861's whole-game bot, parameterised by the
  title's rules.

Surveyed against the research catalogue's 1861/1867 and nationalisation sections. Merger rounds
of this kind (minors converting or merging into majors in a round of their own) appear in 1861 and
1867 only among the researched titles; 1841-style mergers and 1817's acquisitions are different
procedures and were left alone.

### 1861 contract

The lift renamed three serialized names: `phaseEightAt` is now `finalPhaseAt`, and
`ApplyPhaseEffects` metadata `rsrStarted`/`rsrStationLocationIds` are `nationalStarted`/
`nationalStationLocationIds`. 1861's runtime-contract fixture and two harness scenarios were
updated. **1861 needs a logic major at its next release.** No other title's contract changed.

## Rulings followed

From `/workspace/artassets/1867/rulings.md`; the numbers are that file's.

- A1–A2: merger order, the owner's choice of 2026-11-17 for both titles. The player with the most
  shares directs, even with one, a tie going to the owner of the merging minor earliest in operating
  order; the director buys first and a larger holding takes over (RoP §12.3, 1861 §12.3), not GTG
  §9.2C's active owner first.
- A6: phase 8 trade-in at 50% of the old train's face value, the new train from the yard, the old
  one to the bank pool, allowed at the train limit. RoP calls it an upgrade, so the new train must
  cost more than the old one: an 8 is never traded for another 8 (or a 5+5E for an 8). Only in phase
  8 (RoP "In Phase 8 (only)"), so not for the first 8-train.
- A7, A8: minor homes per city in Toronto and Montreal; majors need an empty hex (never Toronto); a
  connected empty city only where no unconnected one exists. "Unconnected" (GTG §7.4, RoP §9.3:
  "cannot trace a legal route to another city") is read as no track to any other revenue centre,
  town and off-board included: a legal route is any two revenue centres, as the 1861 rules forum
  reads it (BGG thread 1051637, uncontradicted by the designer).
- A9, A10: the CN holds one station a hex, absorbs in operating order, and places its Montreal
  station only with the grey tile (RoP §7.4), the owner's choice of 2026-11-17 for both titles: not
  at phase 8 as GTG §8.13 adds. If Montreal never turns grey, the CN has a station there only by
  taking over a nationalised company's.
- A13–A18: brown cities take the most exits; Montreal keeps every city's edge connections; the
  yellow triangles and the Granby lock are enforced; Ottawa upgrades as a Y city until its grey O.
- A22: minor start price half the bid, at most $135; minors never pass $165.
- A25, B40: privates nationalised at face value; two-letter minors from the start, three-letter
  ones from phase 3.
- Open question 10 / RoP §10.4: a company whose home hex has no track lays its first tile there. The
  Grand Trunk text is silent; RoP is definitive (A1). 1861 already does this.

## Questions for the owner

1. **Merger floor** (A27): $100 (designer 2021, the 1861 choice, built) or $70 (designer 2022).
2. **Two players** (A30, open question 7): built with the GTG §16 setup written for 1861S
   ($420, limit 21, 70%, 3×2/2×3/1×4/1×5/1×6/1×7 removed, two privates removed). The designer
   has not tested it in 1867 and suspects two 6s (or 7s) must stay. Keep, change, or drop 2p.
3. **1861 major start in a hex with a station elsewhere**: 1867's designer ruling (A8) treats a
   hex's cities as one for majors; 1861 still checks the city only. The ruling may apply to 1861.

## Not built

- The Grid Market option (GTG §4). The family reads one market chart per title; a game-time choice
  needs the market taken from the game's state (also not built for 1861's Column Market).

## Verification

- `src/fullGame.spec.ts`: bot games for 2, 3, 4 and 6 players (two seeds) and the no price
  floor, two special trains and long game options; `SWEEP=1` for more seeds.
- `src/rules.spec.ts`: the CN's Toronto station; two players' removed privates; minor homes, the
  green city spaces, the green minors; the lock, the yellow triangles and the home hex first;
  majors never in Toronto; nationalisation's price, payout and station; exports in phases 4–7;
  the phase 8 trade-in price; the 8-train ending.
- Data specs: `map.spec.ts`, `tiles.spec.ts`, `stockMarket.spec.ts`, `trains.spec.ts`,
  `companies.spec.ts`.
- `games/1867-ui/src/lib/boardAreas.spec.ts`: market and depot clear of every hex.

## Data notes

From the data pass; the rulebook wins where the engine differs.

- Upgrades follow track preservation, which the errata say governs: #16 and #28 to #70, #23 to
  #47 (not #25), #801 to Ottawa's X8; Montreal X4 to X5 and X6 (the manifest's X7 cannot keep
  X4's track with X7's printed layout).
- #637/#639 (Montreal) match 1861's faces and #120/#122/#124 (Toronto) 1856's; they are 1867
  title tiles for now.
- The lake ports E19 and H16 are $10 blue off-boards; the designer says they exist to let
  neighbouring tiles upgrade.
- Company colours: the engine reuses colours across companies; 1867 gives each its own, the CN
  1861's cream.
