# Helpers for ordinary title rules

The rule callbacks stay the seam between a title and the family. This adds plain
functions that compute the ordinary answers, so a title states only what differs:

- `openShares(state, companyId)` and `presidentCertificate(state, companyId)`;
- `sharesStillToFloat(state, companyId, soldPercent, unsold)`: how many more shares must
  leave the certificates the title counts as unsold;
- `fullCapitalizationPayments(state, companyId, sharesStillToFloat)`: nothing until the
  company can float, then par times its share count from the bank, once;
- `allSharesHeld(state, companyId, held)`: the sold-out test, with the title saying which
  holdings count;
- `marketSaleTerms(state, companyId, terms)`: a sale to a bank pool at the market price;
- `floatedCompaniesInMarketOrder(state)`: operating order by stock price;
- `certificateWealthItem(state, certificate, value)`: a final-wealth line;
- `RailwayMap.reservedLocationIds(companyId)` and `RailwayMap.stationReservations()`;
- `createCompanyStations(companyId, count)` and `homeStationId(companyId)`: a company's
  station markers, with the home first;
- `requiresStationRoute(map, tileSet)`: a company must own a train once it has a route.

## Evidence surveyed

`capitalization-method`, `capitalization-amount`, `capital-release-condition`,
`flotation-condition`, `flotation-counting-basis`, `stock-price-movement` and
`final-valuation` in `data/title-traits.json`.

- **Capital.** Full capitalization in 71 titles, always par times share units, released
  at flotation in 73; incremental in 84, where each share purchase pays the company and
  no flotation payment is due. `SharePurchaseTerms.recipient` already covers the second.
- **Flotation.** A percentage sold: 20 (53 titles), 50 (51), 60 (49), 100 (30), 40 (23),
  30 (11); by phase in 20 and by formation in 17. It is counted as shares outside the
  initial offering in 116, outside offering and market in 5, and with reserved shares
  counting in 2 — which certificates are "unsold" is the title's.
- **Sold out** moves the price in 110 titles; holdings in the market or in other pools
  count differently by title (22 move on market holdings).
- **Final value** is cash plus holdings in 82; debt, penalties, excluded privates or
  half-value trainless shares adjust it in about 30.

Before this, 1889 and TOP each wrote out the sold-out test, the flotation count, an
identical flotation payment with a literal 10 for the share count, the president
certificate lookup, market sale terms (1889 twice), operating order, the final-wealth
label, home locations, station markers under an `:home` id convention, and built a
`RailwayMapState` by hand to ask whether a company has a route.

## Shared behaviour and title-owned choices

Shared: the computations above. Title-owned: every parameter — the percentage, which
certificates count as unsold or as held, the pool, limits and price movement of a sale,
the value of a certificate, who else operates (TOP's PEIR), and whether the ordinary
answer applies at all (TOP's PEIR needs no train).

## Support now and later

Now: full capitalization and percentage flotation. A title with incremental
capitalization returns no flotation payments and needs none of this. Flotation by phase
or formation stays a title's own `sharesToFloat`.

Intentional limits: `fullCapitalizationPayments` pays par times the company's share
count; partial capitalization and escrow (3 titles) are a title's own payments.

## Compatibility

Nothing serialized changes and no rule changes its answer: both titles have ten-share
companies, so par times share count equals the literal ten. Seeded setups, runtime
contracts and the deployed game's transitions must be unchanged. Logic Artifacts only.

## Examples that verify the decision

Each helper at its boundary: a company one share short of floating and exactly floated,
at 50 and 60 percent; capital paid once; a sold-out company with a share in a pool the
title counts or does not; sale terms; operating order skipping unfloated and closed
companies; station markers and the home id; the playground's flotation, sold-out,
funding and ending tests for both titles.

## The map, tile set and depot

`TrackRules`, `StationRules` and `RouteRules` each carry the map and tile set, and
`RouteRules` and `TrainRules` the depot. They keep them: a mechanism's rules are what its
procedure needs, which is why `TrackConstruction`, `StationPlacement`, `RouteEvaluation`
and `TrainPurchase` can be constructed from a State and one rule object — as they are in
about a hundred places, most of them tests — and used without a title's other rules.

What was wrong was narrower. `EighteenXXTitleRules` repeated the map and tile set a
fourth time only so hydration could read them, while hydration read the depot from
`trainRules`; and nothing checked that the copies agreed, so a title giving track one map
and routes another would have failed far from the cause. `titleComponents(rules)` now
takes the three from the mechanism rules and refuses rules that disagree; the runtime and
initializer use it, the top-level `map` and `tileSet` are gone, and the UI session checks
that its map view presents the same map and tile set.

## Composed ordinary policies (2026-10-03, design finding A3)

1830 and 1889 still duplicated complete policy procedures after the lower-level
helpers were introduced. The family now supplies five opt-in policy implementations:

- `payOrWithholdEarningsRules`: proportional pay/withhold, no rounding or bonus,
  ordinary dividend market movement for floated companies, with explicitly named
  unpaid pools and pools whose dividends go to the company.
- `fullCapitalizationCompanyRules`: IPO president purchase at the selected par,
  flotation by percentage outside the IPO, and full capital paid once. Pool identity,
  par-space color and flotation percentage are explicit. Starting consideration uses
  the president certificate's share units, not a literal two.
- `ipoMarketTrading`: bank-held IPO purchases at par, market purchases at market price,
  market sale pricing/capacity, stock sales after the first stock round and emergency
  sales without that timing gate. Pool identities and market capacity are explicit.
- `marketZoneHoldingLimits`: certificate and ownership exemptions from separately
  named market colors, with a supplied ordinary ownership percentage.
- `presidentTrainFundingRules`: president contribution without treasury issuance,
  market trains available, pending operating order refreshed after sales, and required
  excess-share sales using `purchaseOwnershipCeiling` with the title's actual ownership
  policy. The title supplies sale terms, operating order and presidency protection.

These compose the existing focused `EarningsRules`, `CompanyRules`, `StockRules` and
`TrainFundingRules` interfaces; neither title inherits another title's rules. Both
consumers use them. 1830 keeps its 60% flotation, par after the B&O award, sell-buy-sell,
brown-zone multi-buy option, private sales and operating-company-only presidency
protection. 1889 keeps 50% flotation, sell-buy-or-buy-sell, block-extension sales and
protection of every presidency. Certificate-limit tables remain title data. Emergency
sales query the same ownership policy as purchases after each price change, so a
market-zone exception cannot drift between the two paths.

### Catalog survey and limits

Rechecked every assignment in the research snapshot's `data/title-traits.json` for
ownership limits, share-sale eligibility, capitalization, flotation and its counting
basis, emergency funding order, dividend choices and dividend entitlements. The
profiles cover 130 titles (129 for capitalization), including scoped/mixed rules.
They distinguish 57 after-first-stock-round sale assignments from 31 after-operation
sale assignments; 71 full-capitalization and 84 incremental-capitalization assignments;
51 half-payout assignments; and 12 emergency funding procedures. These counts
overlap and are evidence of variation, not mutually exclusive classifications.

The domain study's finance sections and local primary source at snapshot
`715567bdc7e5cc68a68a286b21dc8edd1a125e50` challenge each combined policy:

- 1846's `step/dividend.rb` pays half and moves prices by revenue relative to price;
  its policy cannot be inferred from "payout" alone.
- 1856's `game.rb` releases escrow and changes capitalization; 1824's `game.rb`
  requires regional exchanges or formation for some flotations. Neither is a fixed
  outside-IPO percentage plus full bank payment.
- TOP's separate Union Bank contributor and PEIR half payout/rounding, and 1817's
  loans, short positions and variable dividend units, require their existing policies.
- Ownership ceilings in the catalog include 50, 60, 70, 75, 100 and percentages above 100. Compulsory sales must call the title's policy, not assume six shares. TOP's
  grandfathered ownership exemptions are a different procedure and do not use this
  president-funded policy.

These combined implementations represent the two current consumers' ordinary policy
choices. They are not new family defaults: titles with different timing, dividend
movement, capitalization or funding procedures continue to supply their own callbacks
and reuse the lower-level mechanisms. No new variation switch or inherited title tree
is introduced for unimplemented games.

### Verification and compatibility

`ordinaryPolicies.spec.ts` crosses the shared policy interfaces with custom pool IDs,
IPO versus market prices, first-round versus emergency sales, 50/60% flotation,
market-held shares counting toward flotation, capital paid once, pay/withhold cash
recipients and price movement, and a non-60% ownership policy with market-zone changes.
The existing title stock-turn and emergency tests protect their different procedures;
finished-game replay verifies their canonical state and history against recorded games.

Serialized State, Action schemas and runtime contracts are unchanged. 1889's stale
"not available in this example" president-purchase rejection now directs the player to
start the company, matching 1830. Diagnostics for a missing share price are title-neutral.
No allowed action or settlement changes. Both Logic Artifacts and their UI Artifacts
(which embed the runtime) need a new publication to adopt this shared logic; no host
bridge or coordinated Site Frontend change is required.
