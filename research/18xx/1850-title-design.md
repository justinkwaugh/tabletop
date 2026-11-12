# 1850: title plan and design

1850: The MidWest (Bill Dixon, Deep Thought Games) joins 1870 and 1832 as the third of the designer's
trilogy on the shared family. This note records the evidence, the family changes, and the rulings,
under the standing [18xx design rule](../../docs/agents/18xx-design.md).

## Authority and sources

**The designer's rulebook, version 4.0e (25 January 2006), is the rules authority.** Section numbers
in the code and below refer to it.

- `/workspace/artassets/1850/rulebook.pdf`; its font does not extract as text, so
  `rulebook-rulespal.txt` beside it holds a text copy, compared by eye against pages of the PDF.
- BGG's image gallery, saved to `/workspace/artassets/1850/bgg`: the Cyberboard map (334228) for hexes,
  rivers and printed marks, the components photo (243290) for the market's colours and par boxes, and
  the box cover (784602) for the UI's cover.
- The research site's `g_1850`: evidence for data and a source of real games, never the rules.
  `fixture-conversion/convert1850.spec.ts` in the research package converts its five recordings.

## Family survey and decisions

| Mechanism                       | Elsewhere                | Decision                                                                                                                                                         |
| ------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Soft ledge, protection, reissue | 1832, 1870               | Reused as they stand. The market's rows are 1832's, confirmed against the photo of the printed board.                                                            |
| Stop needing a bought right     | 1832's coal fields, 1850 | `StopAccess` and `StopRights` lifted into the family, with `BuyStopRights` for new titles. 1832 uses them and keeps its `BuyCoalRights` action for stored games. |
| A charge on a private's lay     | Gant Brothers            | `PrivateTrackTerms.layFee`. Only this title sets it.                                                                                                             |
| Private income to someone else  | Crédit Mobilier          | `OperatingRules.privateIncomeRecipient`. Absent, a private still pays its owner.                                                                                 |
| Train needed with a closed stop | 1850, 1832 (not adopted) | `requiresStationRoute` takes an optional `stopAllowed`. 1832 has the same gap and is left alone, as a change could alter stored games: a ruling for its owner.   |
| Printed river paths             | 1870                     | `smoothLinePath` lifted from 1870's river. 1850's river is traced in map rows and columns and split by hex.                                                      |
| Initials token mark             | 1870's destinations      | `companyInitialsMark` lifted from 1870.                                                                                                                          |
| One off-board across two hexes  | 1830, 1833NE             | The family's `stopGroup` and `joinedEdges`: the Northwest's A2 and B1, one value and no border. It replaces the site's two track lanes, with the same meaning.   |
| Cities joining in brown         | 1832's Atlanta           | `preservesStops` allows Chicago's two cities to become one.                                                                                                      |

## Family additions from this title

Surveyed in `/workspace/research/18xx-2026-09-08` (`data/title-traits.json`, the variation catalog) and the
implemented titles. 1870 and 1850 are the only consumers of each logic asset below unless stated.

- **Stock with price protection (`priceProtectedStock`).** The traits list protection for exactly 1832,
  1850 and 1870. 1832 keeps its own stock rules, as its Systems, mergers and coal rights change sales and
  the certificate limit; adopting this later would need those as hooks. The name undersells it: it also
  holds redemption, the 60% limits and certificate zones.
- **Market dividends (`marketDividendEarnings`, `marketDividendEntitlements`, `requiredShareCount`).**
  1832, 1870 and 1850 pay full, half or none, with market shares paying nobody. 1832 uses the
  entitlements and share count, and keeps its own rules for Systems' twentieths. 1817, 1846 and The Old
  Prince have their own half-pay rules, so a title sets what a half dividend leaves the company.
- **Ending at market value (`marketValueEnding`).** 1830, 1832, 1833NE and 1846 share
  `bankExhaustionAtSetEnd` with this and keep their own rules, as their endings differ. A finish price
  is optional, which only 1850's $400 variant and 1870's equivalent use.
- **Diesels over numbered trains (`dieselVariant`, `createDieselPhaseChart`).** 1830 and 1832 use the
  narrower `dieselTrains`, which this composes. The variant removes trains from the depot, which theirs
  do not. Its `terms` feed the chart, so the two cannot disagree. The traits also list diesels for
  1836Jr56, 1873, 18 Ireland, 18MS, 18NY and System18, none built, so their fit is unproven.
- **Leaving-state records (`clearsOnLeaving`).** Records of one step that end with it: 1870's and 1850's
  track and station steps. Titles with no such record do not need it.
- **Closure at zero price (`closesAtZeroInPlace`).** The soft ledge's closed section: 1870 and 1850.
  1832 shares the ledge and closes through its own rules. The family's `CloseCorporation` now ends the
  turn when the funding company closes, which fixes a throw for every title and is covered in 1870.
- **Revenue stages by phase (`revenueStagesByPhase`).** Off-boards printing a value per phase colour: 1870
  and 1850. Titles with a fixed value or per-tile stages do not call it.
- **Share-title action panel (`ShareTitleActions`, `TitlePrompt`).** Shared by 1832, 1870 and 1850, whose
  actions are auction, par, share panel and operating. A title adds its own decision through snippets.
  Titles with other first-round shapes (1846, 1817) keep their own panels.
- **Curved name turns (`nameTurns`).** Other titles keep the automatic least turn; `namesBelow` already
  places a name under a city in 1832, 1846 and The Old Prince. A title sets a turn only where that
  automatic choice reads badly, such as 1850's Cedar Rapids and St. Louis.
- **Marker `at` for local lines.** `above` and the low default cover 1830, 1833NE, 1846 and 1889. St. Louis
  is the one hex whose printed layout leaves neither free.
- **Station logo and outline (`stationLogo`, `SpecialStationOutline`).** Lifted from 1870 once 1850 needed
  them, with 1846's and 1833NE's token art left as it is.
- **Printed lines clipped to their hex.** 1870 and 1850 are the only titles with printed lines. A line's
  round cap and width used to reach a tiled neighbour.

Examples that verify these: each title's specs, the 1832 and 1870 suites, and 1850's recorded games.

## What is built

- Logic: `games/1850`. The auction of seven privates, the stock round with redemption, reissue and
  protection, operating rounds, the Mesabi Range, edge tokens, Chicago and Milwaukee's own tiles, the
  extra lays of CM, MRBC, GBCC and WLGC, eight phases, forced sales, bankruptcy and the broken bank.
- Variants: `$400 finish`, `1830 diesels`, `Reduced tokens` (§16). Not built: Historical Order Start.
- UI: `games/1850-ui`, on `GameTable`. Harness port 4210. Scenarios: bridge held by a player, price
  protection, company shares, Mesabi token, edge token, extra lay, late game.
- 2 to 6 players, in beta (`beta: true`, `GameVisibility.Beta`), in the 18xx series.

## Rulings

Where the rulebook is silent or contradicts itself, for the owner to confirm.

- **A president made by the sale may not protect it.** §5.9 is silent; 1870 forbids it (p. 16) and the
  site agrees, though 1832 allows it.
- **A president who sold the company earlier in the round may protect** (§5.3.3, §5.9.10), unlike 1870.
- **Bankruptcy with undecided sales** waits for the presidents, as 1870 was ruled. The site ends at once
  and leaves the prices, so its `1850_game_end_bankrupt` game differs: two players end on $1793 and
  $1054 here against $1823 and $1074, the order unchanged.
- **Which private lays first.** §6.1.2 excepts CM from laying after the ordinary lay; §15.1 and §15.2 except
  MRBC. The later, more specific sections are followed.
- **An extra lay needs an ordinary lay first**, or a Mesabi token bought with it. A company with no ordinary
  lay to make gets no extra one, as on the site.
- **The bridge's lay is extra for every owner.** §15.2 says so only of the Missouri Pacific; §6.1.2 lists it
  among the extra lays.
- **CM and WLGC stay open and paying until the first 5-train once their lays are spent.** The rulebook closes
  them only then, if the lays are used; the site closes WLGC as its third lay goes down.
- **An edge token needs track reaching its area.** §7.3 speaks of station tokens and §7.4 is silent; the
  site requires it.
- **A Mesabi token bought uses an ordinary yellow lay only.** The site also lets the Land Grant pay for one;
  nothing in the rulebook does, and §15.2 calls its lay a tile. None of the five recordings does it.
- **A closed company's Mesabi token returns to the supply**, as 1832's does; the rulebook says only that its
  tokens leave the map.
- **Tile upgrades follow the tiles' track, not the §22 chart**, by the owner's ruling (2026-11-04), so 29→43 and 58→144 are allowed and 27→43 is not, as in the sibling titles.
- **Reissue with reissued shares unsold** is allowed, once the original offering has sold out (§5.11), unlike 1870.
- **A private may not be sold between players in the initial stock round** (§5.7).
- **One new train a turn limits the depot, and open-market trains.** The family's allowance counts both, as
  the site does. §10.3 says "new" and "from other companies", leaving the market unclear.
- **Reissue pars** follow the printed par boxes, read from the photo: 76 (100), 82 (110), 90 (120), 110 (140),
  120 (160), 140 (180), 160 (225), 180 (250), 200 (275). $200 is the highest par (§5.1.2), unlike 1870's table.
- **A half dividend rounds each share up**, the company keeping the rest (§9.1.2), the reverse of 1870.

## Verified by tests

- `finishedGame.spec.ts` replays recording 115810 to the broken bank with exactly the site's final wealth
  for all three players ($10256, $10301, $7757), and `1850_game_end_bankrupt` to its bankruptcy.
- `pres_transfer_price_drop` and `pres_proctect_moves_priority` convert in full. Recording `1`, ended by
  hand on the site, converts as far as it goes.
- `operations.spec.ts` plays each private's power, the Mesabi Range, edge tokens and Chicago.
- `boardAreas.spec.ts` for the map layout, `scenarioFiles.test.mjs` for scenarios.

## Known limits

- Historical Order Start (§16.4) is not offered, like 1870's, by the owner's ruling (2026-11-04).
- `apps/18xx-playground` has no 1850 entry, like 1870 and 1833NE.
- The river is drawn for reading the map; rules use the list of hexes west of the Mississippi.
