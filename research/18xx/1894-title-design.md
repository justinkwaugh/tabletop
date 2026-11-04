# 1894: title plan and slice designs

1894 is the seventh executable 18xx title, after TOP, Shikoku 1889, 1830, 1817, 1846 and 1832. This note records the delivery plan and each slice's design review, following the
standing [18xx design rule](../../docs/agents/18xx-design.md).

## Authority and scope

**Project decision (2026-10-20):** the _1894 English Rules_, version 1.0.3 (Jan Kłos,
13 September 2024), define the rules. The PDF is public in the designer's repository
(`github.com/Galatolol/1894`, `1894_rules.pdf`); a copy and its `pdftotext -layout`
extraction are in `/workspace/tmp/1894-rules/`. Section numbers below cite the rulebook.

The research implementation (`g_1894`, pinned at
`715567bdc7e5cc68a68a286b21dc8edd1a125e50`, beta) supplies the machine-readable map, tile
manifest, market grid, charters and token costs. They were checked against the rulebook's map
(§18), market (§19), tile manifest (§20) and tables (§22) and agree with them. Its procedures
are evidence only.

- **Players:** three or four (§22.1).
- **Coordinates:** the printed board's (rows A–I, columns 1–18), which the research data uses.
- **Artwork:** boardless map. Company logos from the research implementation's
  `public/logos/1894`, as for 1832. No physical-board artwork is claimed.
- **Hosting:** the title's own dev harness and the 18xx playground; a `games.json` entry so it
  can be released. Not released by this work.

## Trait comparison

1894 is an 1830-framework, full-capitalization game (§17.1: "based on 1830 and 1832"), with a
gray market zone and London rules from 1828, train upgrades from 1824 and city splitting of
its own. Against 1830, its executable sibling: the opening deals shares of two companies and
sells their presidencies as privates whose buyers set par; priority follows pass order; a
president may buy two gray-zone shares; the sold-out rise can reach three steps; companies
redeem and reissue their own shares in the operating round; two track actions with one
upgrade; three companies have two homes; non-big green cities split into two cities on their
brown upgrade, setting their stations aside; trains upgrade to the next colour; ferry markers
open London; Luxembourg, London and the Netherlands have route-wide values; a 5+1 train; late
companies choose their home when parred; the last operating set builds nothing.

## Delivery slices

The slices were built in order on one branch, with a review of the whole before completion.

1. **Title data and ordinary play.** Packages; the map, tiles, market, companies, privates,
   trains and phases; the opening (random French company and removed private, dealt shares,
   the waterfall sale with the all-pass reduction and income, major shareholdings' par);
   stock rounds (pass order, gray zone, two gray-zone shares, 50% pool, no sales in the first
   round, three-step sold-out rise); operating rounds with two homes, two track actions,
   station costs, Paris as one stop, pay or withhold with treasury entitlements, train
   purchase and discards removed from the game; private income, sales and closures;
   bankruptcy, 450 and final-set endings; the shared-table UI.
2. **Corporate finance and trains.** Redeem and reissue in a financial step before track;
   train upgrades; the 5+1 train.
3. **London, bonuses and private powers.** Ferry markers and London access; the London
   shipping station and London bonus; Luxembourg and Netherlands values in route evaluation
   and the autorouter; Ligne de Reims, Gare de Liège and Station Antwerpen powers.
4. **City splitting.** Brown upgrades of non-big green cities, set-aside stations and their
   return, hex-wide reservations.
5. **Late companies and the final set.** Home choice at par, no construction in the final
   set, no split upgrades in the purple phase.
6. **Completion.** Scenarios, a complete scripted game, competition coverage and readiness.

## Family extensions

Each extension below was surveyed against the researched titles in the
[variation catalog](/workspace/research/18xx-2026-09-08/18xx-game-variation-catalog.md) and
the family's executable titles. Research title names are evidence for the interface, not
requirements to implement them.

| Mechanism                                                 | Family addition                                                                                                                                                                      | Other consumers considered                                                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Sold-out rise of up to three steps (§10.2)                | `StockRoundRules.soldOutRises` returns the steps for a sold-out company; `squeezed` stays as 1817's two-step case                                                                    | 1817 squeeze, 1828/1894 president-and-treasury bonus, 18Chesapeake one-step                                            |
| Waterfall all-pass with income _and_ a reduction (§5.1)   | `WaterfallAuctionRules.allPass` chooses whether a pass round both reduces the first lot and pays income                                                                              | 1830 (reduce while unsold, else income), 1832, 1889, 1894                                                              |
| Bids in multiples of the increment (§5.1)                 | `WaterfallAuctionRules.bidMultiple` validates the bid step                                                                                                                           | 1894, 18Chesapeake, 1846 draft has none                                                                                |
| Corporate share operations in the operating turn (§7.3.2) | an optional `ManagingShares` operating step with `TreasuryShareRules` choices, `TradeTreasuryShares` and `FinishTreasuryShares`                                                      | 1846 issue/redeem (title code today), 1832 stock-round redemption, 1894 redeem/reissue, 1849/18Chesapeake-style issues |
| Train upgrade (§7.3.7.2)                                  | the existing exchange gains a destination for the traded train and records exchanges in the purchase step                                                                            | 1830/1832 diesels (to the market), 1889, 1824-style upgrades (removed)                                                 |
| 5+1 train (§13.4.2)                                       | `TrainDistance.extraTowns` on a revenue-centre distance, which 1833NE and 1870 share; the autorouter limits the train's non-town stops                                               | 1894; 1822/1858-style +towns trains                                                                                    |
| Route-wide stop values (§9, §11.2.2.6)                    | `RouteRules.bestStopBonuses(state, companyId, train)`: a stop on the route adds the best value of the route's other eligible stops, encoded as connection bonuses for the autorouter | 1894 Luxembourg and London; 18Ardennes-style "doubles another stop" values                                             |
| Paris as one stop (§13.3)                                 | a stop group may cover the separate cities of one hex                                                                                                                                | 1830 Canada/Gulf (multi-hex groups), 1894 Paris                                                                        |
| Province borders (§9)                                     | a passable `province` border kind, drawn by the map renderer                                                                                                                         | 1894 France/Belgium; 1835/1824 state borders                                                                           |
| Purchasable access rights (§14)                           | a family `AccessRights` module: limited rights a company buys during its turn, which open stops for running and building                                                             | 1894 ferry markers; 1832 WVCF coal rights (title code today)                                                           |
| Paid extra private lay (§11.2.2.1)                        | `PrivateTrackTerms.cost`, and `recordsLay` to keep the lay in the turn's `TrackStep.extraLays`                                                                                       | 1894 LRC; TOP's paid second yellow is an allowance                                                                     |
| City splitting with set-aside stations (§12.3.2, §7.3.8)  | `TrackRules.reconfigures`, a `displaced` station status, hex-wide reservations and a `ReturnStation` decision                                                                        | 1894; upgrades that remove or move stations elsewhere (1832 shared cities, 1817 removals)                              |
| Home chosen at par (§11.3.3)                              | `CompanyRules.startHomes`, shared with 1833NE, whose `claims` reserves the city or hex until the company first operates instead of placing the station as it starts                  | 1817 (auction homes), 1894 late companies, 1867/1861 minors                                                            |

Smaller additions: `CompanyRules.awardParSpaces` (the F100 par only a shareholding's buyer may
take, §5.3); `OperatingRules.privateIncome` sees the map (Saint-Quentin à Guise follows its hex's
tile, §11.2.2.5) and the shared table shows each private's income through the family
`privateIncome`; `requiresStationRoute` takes the title's `stopAllowed`, so London without a ferry
marker does not oblige a company to own a train (§13.3); a private token power,
`PrivatePowerRules.tokenTerms` with `PlacePrivateToken`, places London shipping's A12 station apart
from the turn's placement (§11.2.2.6), and could carry 1846's C&WI station later.

Hex-wide claims hold station spaces: a placement must leave a free space on the hex for each
other company's unanswered hex reservation and each station set aside there. That gives §7.3.4's
two limits on the acting company exactly: no station on a split city with two stations set aside,
or with one set aside on an unoperated company's home. A returned station may share a city's
space (§7.3.8); it takes the slot after the city's spaces and is drawn beside them.

Released titles keep their behaviour: every addition is optional and defaults to the current
procedure. 1846's corporate finance and 1832's coal rights and redemption can adopt the family
modules later; that is not part of this work.

## Rulings on gaps and ambiguities

- **Pass order.** A player who passes and later acts loses their place (§6.1, the cards are
  returned); the family's pass order already does this.
- **Opening floats.** The two shareholding companies float when the first stock round begins,
  before anyone acts. Nothing happens between the auction's end and that moment, so this is
  the rulebook's immediate flotation (§5.3).
- **Major shareholding closure.** Closes during its company's first operating turn; it has
  already paid that round's income, as §7.1 pays privates before companies operate.
- **Upgrade cost to purple.** §7.3.7.2 lets any train upgrade to purple for the purple price
  less half its own.
- **Ferry reach.** A company "able to trace a route" to London reaches London's hex through
  its track network, ignoring that London is otherwise closed to it.
