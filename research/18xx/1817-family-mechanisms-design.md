# The 1817 family's company mechanisms in the 18xx family library

1817's companies start by auction at a chosen size, borrow against that size, are shorted,
convert and merge between operating rounds, and are sold to one another or liquidated. Until
now those mechanisms lived in the 1817 title package, bound to 1817's constants. 18USA is
next, and six more titles reuse the same procedures (see [Survey](#survey)), so they move into
`libs/18xx/src/sizedCompanies` and `libs/18xx-ui`, composed by each title with its own rules.
1817 composes them now, with unchanged behaviour. This note follows the
[18xx design rule](../../docs/agents/18xx-design.md) and extends
[1817's title design](1817-title-design.md), whose slices 3–6 and 9 record the rules.

## Terms

- **Sized company**: a company started at one of several sizes (2, 5 or 10 shares) that grows
  by conversion or merger. The family module is named for it.
- **Closing zones**: the acquisition and liquidation zones of its market.
- **Conversion round**: the family name for 1817's "merger and conversion round". The family
  already has a merger round, 1861's and 1867's minor-to-major round, so the 1817 family's is
  named for what distinguishes it. Its stored field and Action types keep 1817's published
  names (`mergerRound`, `StartMergerRound`, `PassMerger`, `EndMergerRound`); their TypeScript
  names are `ConversionRound`, `StartConversionRound`, `PassConversion` and
  `EndConversionRound`, so the two rounds never share an identifier.
- **Acquisition round**, **company excess** and **acting company action**: see
  [libs/18xx/CONTEXT.md](../../libs/18xx/CONTEXT.md).

## What moved

| From `games/1817/src`                                                                                                                                                                                                                                              | To `libs/18xx/src/sizedCompanies`                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `marketZones.ts`, `liquidation.ts` (`liquidate`, `isLiquidated`), `stockRules.ts` (`marketSale`, purchase terms, presidency guard), `roundRules.ts` (sold out, pool drop), `loanRules.ts` (interest default), `shorts.ts` (market pool, closing shorts against it) | `SizedCompanyMarket`                                                                                    |
| `liquidation.ts` (`LiquidateCompany`, the trainless liquidation)                                                                                                                                                                                                   | `Liquidations`                                                                                          |
| `owedStations.ts`, `stockRules.ts` (stations owed, `buyOwedStations`), `mergerRules.ts` (station purchase, trimming, removable stations)                                                                                                                           | `SizedCompanyStations`                                                                                  |
| `stockRules.ts` (the company auction)                                                                                                                                                                                                                              | `SizedCompanyAuction`, a `CompanyAuctionRules`                                                          |
| `shorts.ts` (`ShortShare`, `CloseMarketShorts`, the stock-round wrapper)                                                                                                                                                                                           | `ShortSelling`                                                                                          |
| `corporateActions.ts` (`BuyBackShares`, the corporate turn)                                                                                                                                                                                                        | `CorporateBuyBacks`                                                                                     |
| `bankruptcy.ts` (elimination, its record)                                                                                                                                                                                                                          | `sizedCompanyElimination`, `SizedCompanyGoBankrupt`                                                     |
| `mergerRules.ts` (conversion, merger, previews, train limit)                                                                                                                                                                                                       | `CompanyConversions`                                                                                    |
| `mergerRound.ts`                                                                                                                                                                                                                                                   | `ConversionRounds`                                                                                      |
| `acquisitionRules.ts`, `acquisitionSettlement.ts`                                                                                                                                                                                                                  | `CompanySales`                                                                                          |
| `acquisitionRound.ts`, `endingRules.ts`'s round-pending hook                                                                                                                                                                                                       | `AcquisitionRounds`, `acquisitionRoundPending`                                                          |
| `companyExcess.ts`                                                                                                                                                                                                                                                 | `CompanyExcess`                                                                                         |
| `state.ts` (round schemas, `formerPresidents`, accessors, validator)                                                                                                                                                                                               | `sizedCompanyState.ts`: `SizedCompanyFields`, `SizedCompanyMachineStates`, `validateSizedCompanyRounds` |

In the UI, 1817's merger, acquisition, excess, corporate-action and short panels, its round
panel and facts, the session's derived round state and its Action methods, and the history rows
of these Actions move to `libs/18xx-ui`: `SizedCompanySession` with five modules
(`ConversionRoundModule`, `AcquisitionRoundModule`, `CompanyExcessModule`,
`ShortSellingModule`, `CorporateBuyBackModule`), the panels in `sizedCompanies/`
(`ConversionRoundPanel`, `AcquisitionRoundPanel`, `CompanyExcessPanel`, `CorporateActionsPanel`,
`ShortSellingPanel`, `CompanyRoundPanel`), `companyRoundFacts.ts` and
`describeSizedCompanyAction`. This follows 1861's lift in d718edaff (`NationalRailwaySession`,
`MergerRoundModule`).

1817 keeps its data and its choices: market spaces and zone colours, certificate and
ownership limits, charters, privates and their Volatility powers, map, trains, phases and
sizes by phase, the options (Short Squeeze, 5 Shorts, Modern Trains, Volatility), dividend
moves, the table layout and its own facts, and the Loan Shark history row.

## Interfaces

Each class takes the title's rules object; a title builds them in dependency order and passes
the instances to the next.

- `SizedCompanyMarket(rules)`: `market`, `charters`, `marketPoolId`, `charterShareCount`,
  `isLiquidationSpace(space)`, `isAcquisitionSpace(space)`. Queries for size, price, zone,
  liquidation, the pool, market sales, purchases, sold out, oversold and pool shares; the
  liquidating interest default.
- `SizedCompanyStations(market, rules)`: `bySize`, `price`, `limit`, and the hooks
  `afterStationsBought(state, companyId)` (1817's Train Station) and
  `conversionDiscount(state, companyId)` (Station Subsidy). `BuyOwedStations`, and the handler
  wrappers `buysOwedStations` and `liquidatesUnpaidStations`.
- `SizedCompanyAuction(rules)` implements `CompanyAuctionRules`: `openingBid`, `increment`,
  `bidCap?`, `startPrices?` (`{ minimum, maximum }`), `privateFaceValue`, `shareCounts(state)`,
  `homes`, `atCertificateLimit`, and the hooks `capital?(price, startPrice)`,
  `homeEquity?(state, home)` and `formed?(state, formation)` (Loan Shark, Ponzi Scheme).
- `ShortSelling(rules)`: `market`, `stockRules`, `maximumShorts(state, companyId)`,
  `closedPhaseIds`. `ShortShare`, `CloseMarketShorts`, `shortsInStockRound(handler)` and
  `buysOutMarketShorts(handler)`.
- `CorporateBuyBacks(rules)`: `market`, `loanRules`, `stockRules`. `BuyBackShares` and
  `corporateActionsHandler(handler, titleActions?)`, whose extra entries are the family's
  `CorporateStockAction`s.
- `Liquidations(market)`: `LiquidateCompany` and `liquidatesTrainlessCompanies(handler)`.
- `CompanyConversions(rules)`: `market`, `stations`, `trainRules`, `conversions` (1817:
  `{ 2: 5, 5: 10 }`), `mergerPresidencyPercent` (40).
- `ConversionRounds<S>(rules)`: `market`, `conversions`, `stockRules`, `loanRules`,
  `valuationRules`, `companyActions?`. `actions()`, `stateHandlers(continuation)` and
  `starts(handler)`.
- `CompanySales(rules)`: `market`, `conversions`, `loanRules`, `trainRules`, `increment`, and
  the hooks `acquisitionPayment?(state, companyId, buyerId)` and
  `liquidationPayment?(state, companyId)` (Golden Parachute).
- `AcquisitionRounds<S>(rules)`: `sales`, `valuationRules`, `companyActions?`. `actions()`,
  `stateHandlers(continuation)`, `starts(handler)`.
- `CompanyExcess<S>(rules)`: `conversions`, `trainRules`, `conversionRounds`,
  `acquisitionRounds`. `RemoveStation`, `DiscardMergedTrain` and the handler of
  `ReducingStations` and `DiscardingMergedTrains`.
- `ActingCompanyAction<S>`: `{ type, available(state, playerId, companyId),
isValid(action, state, companyId) }`, offered by the conversion round's deciding and
  borrowing steps and the acquisition round's loan step; such an action leaves the step where
  it is, and its availability holds back the step's automatic pass or finish.
- `LoanRules.noRepaymentAfterBorrowing`: a company repays nothing in an operating turn in
  which it borrowed, and borrows nothing once interest is paid.
- `systemEvent(type, fields)`: an Action kit for system Actions that act for no player, the
  schema 1817's system Actions were published with.

A title composes the state with `SizedCompanyFields` and `SizedCompanyMachineStates`, the
validator `validateSizedCompanyRounds`, and the handlers and Actions above. 1817's composition
is in `games/1817/src/marketZones.ts`, `owedStations.ts`, `stockRules.ts`, `loanRules.ts`,
`roundRules.ts`, `bankruptcy.ts`, `companyRounds.ts`, `state.ts` and
`definition/gameDefinition.ts`; its UI in `games/1817-ui/src/lib/session.svelte.ts`,
`Table.svelte` and `history.ts`.

## Survey

The reference implementation pins `715567bdc7e5cc68a68a286b21dc8edd1a125e50`; the catalog is
[18xx-game-variation-catalog.md](/workspace/research/18xx-2026-09-08/18xx-game-variation-catalog.md).
Seven titles subclass 1817's game; no other researched title uses these procedures together
(slices 4–6 of the title design survey each mechanism across the catalog).

| Title      | Differences that touch the lifted mechanisms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1817       | The reference for every rule here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 18USA      | Loans move two spaces each way and a loan taken bars repayment that round (§9, §12.9); P15 adds a loan at $5 interest ([game][usa-loans]); bids rise by $1 with no cap, a city subsidy adds to the winner's means, the start price is half the bid between $50 and $200, and the company receives twice its start price ([stock step][usa-stock], §11.6); two pool drops per market share (§11.8); Pullman scrapping in every company step ([module][usa-scrap]); P8's marker counts toward eight stations ([reduce tokens][usa-reduce]); dividends move 1–4 steps (§12.5). |
| 1817NA     | Data only: cash, certificate limits, trains, seed money, four loans per rate step ([game][na]).                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1817WO     | Nieuw Zeeland: a home that starts closed, interest waived for its owner, sizes 5 or 10 there ([game][wo]).                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 18DE       | No shorts at all ([stock step][de]).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 1877       | Companies start at five shares; a short needs only a floated company, in any phase ([stock step][1877]).                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 18FR       | Sizes 2 and 5; a share-redemption round; each short raises the holder's certificate limit ([game][fr]).                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 18Hiawatha | Its own sizes and token counts; shorts as 1877's ([stock step][hiawatha]).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## 18USA's variations

1. **Market and loan moves.** Zones are the title's predicates on its own chart. Every loan
   price move goes through `LoanRules`: taking and repaying through the family's `takeLoan`
   and `repayLoan`, and the acquisition's unpaid inherited loans through `takeMove`, so 18USA's
   two steps apply there too (1817 moves one). The family test checks two steps.
2. **No repayment after borrowing.** `LoanRules.noRepaymentAfterBorrowing`. The operating
   turn records its loans (`turnLoans`) when the option is set, the loan step offers no
   further loan, and `canRepayLoan` refuses while the company has borrowed this turn.
3. **Shorts.** `maximumShorts` (1817: the share count, five with 5 Shorts; 18USA: the share
   count) and `closedPhaseIds` (both titles' last phase). Short Squeeze stays 1817's
   `squeezed` round rule, built on the market's `oversold`.
4. **Loan capacity.** Every borrowing limit reads `LoanRules.capacity`, including the
   acquisition buyer's limit and over-limit repayments; P15's fixed interest is
   `extraInterest` (5 less the rate per round while owing).
5. **Company auction.** `increment: 1`, no `bidCap`, `startPrices: { minimum: 50, maximum:
200 }`, `capital: (_, start) => 2 * start`, and `homeEquity` for the subsidy: it counts in
   the bidding power, the contribution range and the winner's payment. `formed` can close the
   subsidy tile.
6. **Pullman scrapping.** An `ActingCompanyAction` in the conversion and acquisition rounds
   and in the operating turn's steps before and after the run, and a `CorporateStockAction`
   passed to `corporateActionsHandler` in the stock round. Neither replaces a family Action.
7. **P8's marker.** `SizedCompanyStationRules.limitMarkers` names the markers that count toward
   a company's station limit. `limitedStations` counts them with its stations. Over the limit
   after a merger or an acquisition, the president may remove the marker with
   `RemoveStationMarker` in place of a station, and `giveUp` then discards P8.
8. **Dividend steps.** These are each title's `EarningsRules.marketEffect`; 1817's one or two
   steps stay in 1817 and nothing lifted assumes them.

## Intentional limits

- **Shorts before operating** (1877, 18Hiawatha) and **certificate limits raised by shorts**
  (18FR) are not options yet; `ShortSelling.shortReason` and the title's `certificateLimit`
  are where they would go. 18DE passes no short handler.
- **The president's certificate counts the charter's two shares**: `charterShareCount` sizes
  both a reset charter and the shares a formation leaves in the treasury, as in every surveyed
  title.

## Compatibility and verification

- 1817's runtime contract (`games/1817/test/fixtures/runtime-contract.json`) changes in
  three ways, all additive:
    - 1817 accepts `RemoveStationMarker`, though no 1817 marker counts toward its limit;
    - its liquidation reasons gain `'unsold-shares'`;
    - and the shared lay and map schemas gain optional fields that 1817 never writes:
      `upgrade` on a lay (18USA's colour skips) and `dealtRevenues` (18USA's red areas).

    Its stored games read as before. An older 1817 UI build cannot read a liquidation for unsold
    shares, which only 18USA's $300 variant makes, so 1817 needs no paired release.

- The playground's five recorded 1817 games (15528 to game over, the Volatility bankruptcy,
  16281, 16852 and 20758) replay to identical final states and identical processed Actions,
  metadata included, under the previous and the new code: 7,157 Actions compared.
- 1817's suite (205 tests) passes unchanged but for calling the composed instances.
- `libs/18xx/src/sizedCompanies/sizedCompanies.spec.ts` checks 18USA's start range, station
  growth, repayment after borrowing and two-step inherited-loan moves.

[usa-loans]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_18_usa/game.rb#L552-L582
[usa-stock]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_18_usa/step/buy_sell_par_shares.rb#L12-L62
[usa-scrap]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_18_usa/step/scrap_train_module.rb
[usa-reduce]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_18_usa/step/reduce_tokens.rb#L28-L56
[na]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1817_na/game.rb#L18-L26
[wo]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1817_wo/game.rb#L165-L202
[de]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1817_de/step/buy_sell_par_shares.rb#L9-L12
[1877]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1877/step/buy_sell_par_shares.rb#L99-L107
[fr]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_18_fr/game.rb#L286-L296
[hiawatha]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_18_hiawatha/step/buy_sell_par_shares.rb#L29-L37
