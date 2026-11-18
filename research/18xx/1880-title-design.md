# 1880: China — title design

Rules authority: the Lookout English rulebook v1.15 (2022), saved with a text copy in
`/workspace/artassets/1880` (`rules-en.pdf`, `rules.txt`). Section numbers below are the
rulebook's roman numerals. The designers (Helmut Ohley, Leonhard Orgler) said the Lookout edition
changes no rules. Rulings from the BoardGameGeek forums (thing 69601, all 141 threads) are collected
with authors and links in `/workspace/artassets/1880/rulings.md` (R1–R77, U1–U10); the designers
post as `Lonny` and `Double O Games`. Board images, the Lookout correction-sticker sheet and the
cover are in `/workspace/artassets/1880/bgg-images`. The research engine (`g_1880`) supplied hex
coordinates, edges, terrain and tile track, checked against the rulebook's tile manifest (p. 23)
and the board. Its known departures from the designers (R39, R53) are not followed.

Scope: the whole game for 3–7 players. There are no variants.

## What makes 1880 different

| Mechanism                                                                                                                                         | Rulebook         | Family support                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| Privates auctioned in order from P0; the next lot's starter follows the last lot's starter; whoever passes is out of that lot                     | §V               | Selection auction, new `passesWithdraw`, `nominationFollowsOpener`                            |
| All pass on P0/P1: its price falls ¥5, to a free award; on a later lot the privates pay their income and the lot is offered again                 | §V               | `allPassDiscount`, new `allPassIncome`                                                        |
| Players reseated by cash, least first, after the auction                                                                                          | §V               | New `SelectionAuctionRules.firstStockOrder`                                                   |
| Each player chooses a foreign investor, free                                                                                                      | §V, §VII         | Title state `ChoosingInvestors`                                                               |
| A 20/30/40% director's certificate chosen at start, with building permits by its size and a par slot                                              | §VIII, §XII      | New `presidentShareSizes`, `startChoices`, `applyStartChoices` on `StartCompany`/`ParCompany` |
| P6 brings the BCR's 20% certificate at ¥100; its owner chooses the slot and permits                                                               | §VI, R5          | `parAfterAward` (now also in the selection auction) with start choices                        |
| Operating order by par then slot, never by price; investors before majors                                                                         | §IX              | Title `companyOrder`                                                                          |
| Float only as the share round ends, at 20/30/40/60% by phase or with no share on sale                                                             | §XII, R23        | New `CompanyRules.floatsAtRoundEnd`                                                           |
| Half the capital at float, the second half once ≤5 shares remain in the bank after the first 3-train                                              | §XII, R26        | Title `flotationPayments`, `afterSharePurchase`, phase change                                 |
| No bank pool; sales at market less ¥5 a share, one row down per share                                                                             | §XII, §XIII      | Title `saleTerms`                                                                             |
| Operating rounds never stop; a stock round interrupts the turn of the company buying the last train of a kind, which then resumes                 | §IX, §XII, R36   | New stock-round interruption and endless operating set                                        |
| Train marker; trains removed when a whole round passes unbought, at the marker company's finish                                                   | §X, R39–R43, R48 | New `TrainRules.declineResumes`/`declineTrains`; title marker                                 |
| Game ends three rounds after the last 8-train, after the marker company's turn                                                                    | §XV, R76         | New `GameEnding.finalCompanyId`                                                               |
| Foreign investors lease the train on sale, lay one tile, always withhold, stop at B3, merge when joined to their company                          | §VII, R14–R19    | Title system actions, merge decision between companies                                        |
| Building permits by phase letter; BCR always two yellow; others two yellow from phase B                                                           | §VIII, §X        | Title `TrackRules.allowance`                                                                  |
| Medium cities: town or city tile; double ones two towns or OO                                                                                     | §X, R67          | Title `preservesStops`, `relabels`                                                            |
| Beijing's printed starting sections kept by every tile                                                                                            | §X               | Title `restriction`; UI printed track                                                         |
| Share-price bonus added to income                                                                                                                 | §X, R73–R74      | New `RouteRules.runBonus`, `OperatingResult.bonus`                                            |
| Ferry fee ¥10 a ferry unless the director owns P2                                                                                                 | §VI, §X          | Hex bonus with the company, now allowed negative                                              |
| Taiwan +¥20 for P3's owner; Trans-Siberian +¥50                                                                                                   | §VI, §X          | Stop bonus; connection bonus                                                                  |
| E-trains count their best N stops, one their own; plus trains                                                                                     | §X, R71–R72      | `payingStopLimit`, `extraTowns`                                                               |
| Communist Takeover: no price moves, no director sales (also in emergencies), privates pay nothing, investors stop                                 | §XIV, R55–R56    | Title earnings, sale terms; private catalogue income                                          |
| Emergency purchase: director's cash, optional sales without change of directorship, then a 50% debt charged again each share round; no bankruptcy | §X, R57–R60      | Player loans lifted from 1822; new `TrainFundingRules.salesOptional`                          |
| P0 payment at the last 2+2/3/3+3; P5 D permit; P7 free exchange, forced at the first 4                                                            | §VI, R52–R53     | Title actions; new `PhaseRules.decisionState`                                                 |
| 2R trains from C2: never rust, one a company, not a required train                                                                                | §X               | `satisfiesRequirement`, `limitReason`                                                         |

## Family additions

Surveyed against the research catalogue (`/workspace/research/18xx-2026-09-08`): the variation
catalogue's round-order section (1822 Africa, 1840, 1866, 1868 Wyoming, 1880), the auction titles
(1830, 1861, 1867, 1882, 1894) and the titles with player loans (1822).

- **Stock rounds interrupting an operating turn** (`operating/stockRoundInterruption.ts`,
  `EighteenXXTitleRules.stockRoundInterruptions`): a title records `interruptForStockRound`
  (company, step to resume); once the triggering action has run its course — any phase change
  resolved — play passes through `InterruptingOperatingTurn` to a stock round, and when it ends
  through `ResumingOperatingTurn` back to the step, the companies still to operate reordered.
  Both actions record the company. A wrapper over every handler does the routing, so phase
  changes, discards and the Rocket's exchange all lead into it. Other titles are untouched.
- **Endless operating sets** (`OperatingSet.endless`, `OperatingRules.roundCount` answering
  `'endless'`, `hasLaterRound`/`onLastRound`): rounds follow one
  another with no stock round between; headings, the stock-round status and history number such
  rounds alone ("OR 6"); round snapshots carry `endless`.
- **Ending after a company's turn** (`GameEnding.finalCompanyId`).
- **Start choices** (`company/startChoices.ts`): `presidentShareSizes` (a larger president's
  certificate replaces ordinary ones, which leave the game), `startChoices` and
  `applyStartChoices`, carried by `StartCompany` and `ParCompany`; the stock UI asks size, price,
  then each choice. `defaultStartChoices` lets offers be priced before the choices.
- **Floats at the end of the stock round** (`CompanyRules.floatsAtRoundEnd`).
- **Selection auction**: `passesWithdraw`, `nominationFollowsOpener` (the lot's `openerId`),
  `allPassIncome` (a new `income` resolution), `firstStockOrder`; the selection auction now awaits
  a par after an award.
- **Declining trains** (`TrainRules.declineResumes`, `declineTrains`): finishing the train step
  without buying may instead decline the trains on sale; a phase it starts is advanced.
- **Phase decisions** (`PhaseRules.decisionState`): a phase change waits in a title state before
  its discards.
- **Run bonus** (`RouteRules.runBonus`, `OperatingResult.bonus`), outside the solver's search;
  the autorouter compares route revenue without it.
- **Negative hex bonuses** (`RouteRules.hexBonus(state, locationId, companyId)`, `RouteBonus.amount`
  any integer): a charge; a route whose charges exceed its revenue is refused. The Rust solver's
  check against negative hex bonuses was removed: they only lower a route's exact value.
- **Player loans** (`loans/playerLoans.ts`, `RepayPlayerLoan`, `PlayerLoanRepayment.svelte`),
  lifted from 1822, which now uses them; `TrainFundingRules.salesOptional` lets a director borrow
  rather than sell; `StockRoundRules.afterRound` charges interest.
- **Standard tiles** 455, 887, 888, 895.

Every other 18xx title's runtime-contract snapshot changed additively; their test suites pass.

## Board

The board view draws the rulebook's turn order list as an Operating order panel below the depot (`OperatingOrder.svelte`, the family's
board panel): four slots at each par price, each holding the major that took it, faded until it
floats; a tick on majors that have operated this round, a ring on the one whose turn is under way
(also through the share round it brought), and the train marker beside the company that last
bought a train from the bank, with the round the game ends in once the last 8-train has gone.

Owner's presentation choices (2026-11-17): foreign investors show as F1–F7 with their
countries' flags (the rulebook numbers them A1–A7), and a major's token carries the flag of the
investor that will join it; investors withhold without a click (`EarningsRules.automaticChoice`);
company cards list under Powers the privates of the director that serve their companies (P2, P3,
P4, P5, P7; `companyPowers`) and show permits under the figures, the par slot left to the board;
player cards leave out the privates' value (`privatesWithoutValue`), worthless by §XV.

The red and blue hexes with a stop print arrows, not track (§X Laying Track), and their stops only
start or end a route. Russia, French Indochina and Hong Kong stay cities for their investors'
tokens, and Taiwan and Haikou stay towns because a harbour counts as a small station, so all five
keep terminus track and take their spikes from the layout's `printedPaths`. A town whose every
track prints as a spike or pier now draws no marker, the rule junctions already followed. Across
the titles using `printedPaths` (1822, 1833 New England, 1849) those stops are junctions or
off-boards, so only 1880's harbours change. A harbour chosen as a route's start keeps the start
ring, the one sign of the choice.

Every investor's home is a printed reservation (`InvestorHomes1880`), so the map shows the flags
from the start of the game. An investor left out by the random variant has none, a chosen
investor's is used by its station, and the rest go when the last player has chosen (§VII).

The phase strip shows the director's share needed to float (Float 20%/30%/40%/60%), and during
the Communist Takeover a banner under it opens the takeover's rules (`phaseNotice`).

## Rulings followed

- R14: an investor joins when a route, never reversing, runs from its home to any station of its
  company, other companies' stations no obstacle (Helmut's email; the Lookout box says home to
  home, U2).
- R19: inactive investors still merge at their turn.
- R39: a trainless train-marker company may decline, removing the trains and bringing the share
  round, then must buy (both designers, 2026).
- R42, R48–R49: removal at the marker company's next finish; 8E removal starts D2 with no share
  round; 10s and 2Rs are never removed; no share round after the last 8.
- R43: removing the first trains of a kind starts their phase.
- §XII Inauguration: a major's home station goes down as the share round floating it ends, the
  QSR's or SCR's director choosing the city then; after an interrupting share round, before play
  resumes (18xx.games places homes as the round sets up). Family: the resume handler places pending
  homes and holds a home choice first.
- §IX / R36: a company floated in an interrupting share round operates in the resumed round when its
  par and slot place it after the resuming company, as 18xx.games rebuilds the round; one placed
  before it waits for the next round (`reorderPendingOperatingCompanies({ admitsLaterCompanies })`).
- R53: when the 4s are removed, the Rocket still takes a 4 (Lonny); the others leave. One 4 stays
  in the bank for the forced exchange, the first removed starting B3; with no major, its owner
  loses that 4 (`rocket.spec.ts`).
- R46 / §X Forced Purchase: an emergency purchase is the cheapest new train, never a restored
  2-train; a trainless company may still buy a 2R from its treasury first (`forcedTrains.spec.ts`).
- §VII: the investor's owner chooses where its treasury goes; "the Share company" chooses whether
  its cheapest station replaces the investor's, so its director decides, after the owner, when
  another player directs it (as 18xx.games; `merger.spec.ts`).
- §VI P0: the Rocket taking the last 3+3-train is as its purchase: P0's last ¥100 is paid and a
  share round follows.
- R5: the P6 owner chooses the BCR's slot.
- R61: QSR/SCR block their hex while its cities are separate (reservations); see open questions.

## Owner decisions

- **Price before float** (2026-11-17): the rulebook puts a company's marker on the share price
  chart only as it becomes operational (§XII Inauguration), so until it floats its price stays
  at its par: shares sold before then move nothing. The marker still shows at the par space.
  No BoardGameGeek thread discusses it; 18xx.games moves it.
- **Trans-Siberian with an E-train** (U8, 2026-11-17): the train runs normally, the ends counting
  among its best stops like any other; the bonus is the ¥50 alone. 18xx.games pays both ends on
  top of the best stops; not followed.
- **Par slots** (2026-11-17): the player chooses any free slot (R5), as built; not the rulebook
  game-helper's "uppermost free row".
- **P0 at ¥0** (U3, 2026-11-17): when everyone passes it down to nothing, it goes to the player
  who started its auction, as on 18xx.games (its `all_passed!` advances from the last passer back
  to the starter).
- **P5** (2026-11-17): assigned only during an operating turn of a major its owner directs, as on
  18xx.games (`owning_player_or_turn`), never in a share round, though the card says "at any
  time"; share-round use is not needed for now.
- **QSR/SCR home spaces** (R61), checked 2026-11-17 (`sharedHomes.spec.ts`): while the hex's two
  cities are separate, both are closed to other companies; once they join in brown, their two
  reservations fall on the one city, which then admits one other company's station and keeps the
  other space for the home.

## Following 18xx.games where the designers have not ruled (owner's choice, 2026-11-17)

- U4: when the 8E-trains leave unbought in the final turns, the train-marker company goes on in
  its train step, free to buy a 10 or a 2R; there is no share round. (The rulings file said
  18xx.games ends the turn; its `pass!` does not.)
- U6 and U9 already matched: a player over the certificate limit after a merger share sells in
  their next share turn; the ferry fee is ¥10 per ferry on each route unless the director owns P2.
