# 1833NE: title plan and design

1833NE (Tom Lehmann, GMT 2026) is the seventh executable 18xx title. Its rulebook
says it "shares the same rules as 1846 except" for an auctioned private opening, small
cities with N+s trains, ferries, and direct and interconnection route bonuses. This note
records the evidence, the family changes those differences need, and the slices, under
the standing [18xx design rule](../../docs/agents/18xx-design.md).

## Authority and sources

**The GMT rulebook is the rules authority.** Unlike 1830 and 1817, the research site's
1833NE is prealpha: it has the map, tiles, entities and auction, but no ferries, bonuses,
golden spike or takeovers, and its takeover step is an explicit placeholder. Its data is
evidence for geometry only, checked against the rulebook's planning map.

Sources, in `/workspace/artassets/1833ne` (see `SOURCES.md` there):

- The GMT rulebook PDF (24 pages, 2026-04-07) from the link in the research site's 1833NE
  metadata, with its text, page renders and high-resolution crops of the planning map
  (p. 24), the tile manifest (p. 21) and the setup picture (p. 3: private certificates,
  ferry markers, corporate mats, train cards).
- The research site's 1833NE code at tobymao/18xx `b858a37f9a` (2026-10-28), newer than
  the research snapshot `715567bd`.

The game is unpublished (the research site holds it back until 1 December 2026), so no
counter sheet or corporate mats are available beyond what the rulebook pictures show.

### Evidence gaps

- **Last ferry bonus.** The New ferry bonus markers are +20 (setup picture). The value on
  their Last side is not printed in the rulebook; it is +10, as the marker reads (confirmed
  by the user, 2026-10-29, matching GMT's 2020 sample token sheet).
- **Golden spike.** The A&StL mat reads: "President receives $100 from bank upon first
  Montreal and Portland track connection if this Corporation has laid at least 1 yellow
  track tile." The StL&A mat is hidden in the picture; the user confirmed both mats carry it
  (2026-10-29): when Montreal and Portland are first joined by track, each of the two
  corporations that has launched and laid a yellow tile pays its president $100.
- **Takeover game.** The five Variable Start corporations are not named in the rulebook
  (the end-game spreadsheet example mentions "Era" and "B+M"), and their mats are not
  shown. GMT's 2020 sample token sheet prints five tokens beyond the nine Standard
  corporations: Boston and Maine, New York New Haven & Hartford, New Era, Uncertain
  Prospects and LSL. The implementation uses those five; LSL's full name is unknown.

### Corrections to the research site's data

- **Train counts and prices** follow the corporate mats: 8 phase I, 5 phase II, 6 phase
  III, 3 phase IV (5 in the Takeover game) and unlimited phase V; the 7+3 costs $1,000
  (the research site has $950).
- **Tile counts** follow the manifest: six #6 (research: 4), #7 4 plus the reverse of the
  unlimited #8/#9 sheet.
- **Boston's and Portland's triangles** are terminals worth their city's value (§6.62
  note), not $0 offboards.
- **Brown 50-value city tiles** (N51–N53) may replace a green city only when no 60/70
  tile fits or none is left (manifest footnote, §6.46).

## Scope

1. **Standard game, all rules.** Auction, stock rounds, operating rounds with
   issue/redeem, ferries, bonuses, every private power, golden spike, Sherbrooke's joint
   token, reservations and the first operating round's reverse order, bankruptcy and
   receivership, bank-broken ending.
2. **Takeover game** after the Standard game, once the Variable Start corporations'
   identities are known. Its rules (train limits, takeover step, $80/$120 variable homes,
   certificate-limit marker) are recorded here so the Standard game's interfaces leave
   room for them.

Hosting: the 18xx playground and the title's own dev harness, Beta visibility in
`games.json` only when the user asks for publication.

## Family survey and decisions

The [title traits](/workspace/research/18xx-2026-09-08/data/title-traits.json) record
1833NE as incremental capitalization, a one-dimensional market, waterfall auction,
`node-type-allowances` distance (31 titles) and `node-type-pools` payment (70 titles),
and half payout: the 1846 family. 1846 is executable here but its 1846-flavoured
policies are module constants bound to 1846's market and ids, and no title package may
import another. So the shared mechanisms move into `@tabletop/18xx` and
`@tabletop/18xx-ui` first, and 1846 switches to them with unchanged behaviour.

### Lifted from 1846 into the family

| Mechanism                                                     | 1846 now                         | Family form                                                                                 |
| ------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| One-row market with `up`/`down` aliases                       | `Market1846`                     | `linearStockMarket(prices, zoneColor)`                                                      |
| Dividend jumps (−1/0/+1/+2/+3, −2 trainless receiver)         | `EarningsRules1846.marketEffect` | `payoutJumpMarketEffect({ market, tripleJumpColor })`                                       |
| Issue/redeem shares (`CorporateFinance`)                      | title action + handlers          | family action and `CorporateFinanceRules` on the title rules; handlers wired by the runtime |
| Track and stations in one step                                | `layingTrack1846`                | `operatingSteps` without `PlacingStation` plus `stationsWithTrack: true`                    |
| Lay allowance: one yellow plus a second yellow or one upgrade | `TrackRules1846.allowance`       | `twoLaysOneUpgradeAllowance`                                                                |
| Hexside cost charged on completing the crossing               | `TrackRules1846.borderCost`      | `completedBorderCost`                                                                       |
| $20 minimum, terrain once                                     | `TrackRules1846.terrainCost`     | `minimumTerrainCost(20)`                                                                    |
| Emergency issuance below the marker, never under $20          | `TrainFundingRules1846`          | shared `slidingIssuanceTerms`                                                               |

Stored 1846 games keep their Action types (`CorporateFinance`) and state fields
(`financeStep`), so the move is a refactor with no logic major.

The 1846-ui finance panel, construction mode switch and "nothing to build" prompt move
into `@tabletop/18xx-ui` with the same reasoning.

### Waterfall auction (§3)

Survey: the family `ReserveBidAuction` serves 1830 and 1889. 1833NE differs in three
places, each an optional `WaterfallAuctionRules` field so 1830/1889 are unchanged:

- `bidMultiple: 5` (§3.21) — the same name as the 1894 branch's field.
- `firstBidAtPrice: true` — the first bid may equal the printed price; later bids beat
  the last by the increment.
- `allPass: 'resolve-bids-then-income'` with `incomeRounds: 2` (§3.24): pending bids
  resolve in lot order as if each lot had become available, then income is paid twice,
  then play resumes left of the last passer. 1830's discount never applies.
- `firstStockPlayer: 'after-last-purchase'` (§3.25): priority goes left of the last
  player who bought a certificate on their turn, recorded as `lastPurchaserId`.

### Trains: N/M and N+s (§6.64)

N/M is already `payingStopLimit` with `requirePayingStation` (1846). N+s needs a second
allowance: `TrainDistance.extraTowns` — the same field as the 1894 branch. A route may
visit `maximum + extraTowns` stops of which at most `maximum` are not towns. 31
researched titles use node-type allowances; 1858/1822-style "+s" trains have the same
shape. The autorouter's Rust core gains a second budget (`major_limit`).

### Direct connection bonuses (§6.66)

Survey: 1846's east–west bonus is `PaidConnectionBonus` (a pair of location sets, paid
stops only). 54 researched titles have destination/direction modifiers; most are
static. 1833NE's values change by phase and double for the Ogdensburg owner, so:

- `RouteRules.revenuePolicy(train, state, companyId)` — two new arguments; 1846 ignores
  them.
- `PaidConnectionBonus.destinationAtEnd` — the destination must be a paid end of the
  route ("Montreal ending at New Haven or Norwich"). The Rust core receives the flag.

Each 1833NE pair is one bonus whose amount is the rulebook's chart total (the direct
arrow plus both interconnection arrows of the pair), so a direct run of Montreal–Boston
in phase I earns $150 as one bonus. The D&H offboard's Montreal-dependent value is a
pair bonus between A12 and Montreal sourced to the D&H private, with A12 printed at $0.

### Interconnection extensions (§6.66)

No other researched title runs a route past its counted stops to collect a bonus. The
mechanism still belongs to the family route evaluation, which owns tracing, resource
disjointness and the autorouter encoding; a title-side copy would duplicate all three.

- `TrainRoute.extension?: RoutePath[]` continues from the route's end node along track
  of any length. It may pass through blocked cities and other stops without counting
  them, must not pass through an offboard, and ends at a revenue center. Its track
  counts toward the fleet's disjointness like the route's own.
- `RouteRevenuePolicy.interconnections?: { from, to, amount, sourceId }[]` — paid when a
  paid stop of the route is in `from` and the extension ends in `to`. One per route
  (§6.66: "A given route can have only one interconnection extension").
- Autorouter: the Rust search offers, for each candidate route whose paid stops include
  an interconnection origin, the shortest disjoint extension from either end to each
  destination as an extra candidate. **Limit:** only the shortest extension per end and
  destination is tried, so a fleet whose best plan needs a longer extension to free
  track for another train may be missed. Players can still draw it by hand.

### Ferries (§6.56–6.57) and the Luxury Ferry

Survey: 1894's ferry markers are access rights (paid to enter), not revenue. 1833NE's are
asset-dependent income (86 titles record asset-dependent route income, mostly via
privates or tokens). Title state: `ferries: { locationId, companyId?, luxury? }` plus
`ferryBonus: { locationId?, side: 'new' | 'last' }`. A title action `BuyFerry` in the
construction step, once per turn, $40. Revenue is the family `stopBonus` hook: a paid
stop with a ferry owned by the running corporation adds its value plus the New/Last
bonus if it carries it, doubled by the Luxury Ferry. A title action `AssignLuxuryFerry`
records the assignment.

### Joint token (§6.53)

The StL&A/A&StL token in Sherbrooke is one piece in one slot used by two corporations.
Family `PlacedStation.sharedWith?: string[]`; every "station of this company" check goes
through `stationServes(station, companyId)`. Some other titles have co-owned tokens via
mergers; none needed it before.

### Private powers

- P1 Granite, P2 Lowell, P3 C&StL block hexes while player-owned (family blocks).
- P2: free tile in G20 in the operating round it is bought (title `terrainCost`).
- P3: two extra free tiles in C4 and C6 at any time while operating; C4 must connect to
  Montreal, the two must connect, no token connection needed (family private tile lay
  with `count: 2`).
- P4 Ogdensburg and P6 D&H: the owner may lay track and run routes from A6/A12 as if a
  station (family `RouteRules`/`TrackRules` hooks for virtual stations), not place
  stations. Only the D&H owner may enter A12 (`stopAllowed`). D&H costs its buyer an
  extra $40 to the bank and is never removed.
- P5 Luxury Ferry: doubles one assigned ferry.

## Slices

1. **Family extensions** above, with 1846 moved onto them; autorouter support.
2. **Title logic:** data, opening, stock, operating, privates, ferries, bonuses,
   golden spike, joint token, endings; scenarios and runtime contract.
3. **Title UI:** `games/1833ne-ui` on the shared `GameTable`; board areas, bonus chart,
   ferry purchase and Luxury assignment, extension drawing in route building.
4. **Takeover game**, after its corporations are known.

## Acceptance examples (from the rulebook)

- OR2 example (§6.56): B&P's 2+1 to Boston earns $90 and its 2 train to Stonington $80;
  B&W's 2+1 earns $60 and its 2 $80.
- Fitchburg example (§6.66): two 2+1s earn $160 as two routes, or $170 with Troy–Fitchburg
  interconnecting to Boston ($120) plus Fitchburg NE ($50).
- Phase IV Montreal–Boston–St Jean with an extension back to Boston earns $290 in bonuses.
- Half pay (§6.71): $250 revenue with three treasury shares retains $120 and pays $13 per
  share, $159 to the treasury.
- Price moves (§6.74): $500 revenue at $165 moves to $212 paying full, $180 half, $150
  withholding; at $124 full or half both reach $150.
- Issue example (§6.31): at $60 with 40% held by players and 20% in the market the
  Fitchburg may issue two shares at $50.

## Implementation notes (2026-10-28)

Built on branch `feat/implement-1833ne`. Family changes beyond the plan above:

- **More 1846 rules moved to the family:** zero-price closure (`zeroPriceClosure`,
  `ClosingOperatingCorporation`), issue-first train funding, market receivership and the
  bankrupt player's forced sales (`issueFirstTrainFunding`, `marketReceivership`,
  `sellBankruptHoldings`), and treasury-share stock and launch rules
  (`treasuryShareStockRules`, `treasuryShareCompanyRules`). 1846 selects all of them.
  A later sale of a company in the same turn or funding extends its first block
  (2026-10-31; see [1846 personal emergency funding](1846-personal-emergency-funding-design.md#repeat-sales-2026-10-31)).
- **Terminals:** Boston's and Portland's triangles are offboard nodes worth their city's
  value. An offboard terminal may become a city of a tile with fewer terminals
  (`tileUpgradeMappings`), which is how Portland's two triangles become a city and a triangle
  in green and every tile's cities and triangles merge in brown. The title's
  `preservesStops` lets only the B, Mo and Po tiles combine stops.
- **Station access** (`StationFields.stationAccess`): the A&StL's use of the joint
  Sherbrooke token, and a corporation's use of the Ogdensburg or D&H offboard, which may not
  be used to trace new stations (`placesStations: false`). A closing St. Lawrence corporation
  leaves the joint piece to the other.
- **Several homes per hex** in the location factory (Boston: B&W and B&L).
- **Purchase charges** (`PurchaseEffects.charges`) record the D&H's $40 to the bank.
- **Lays made together** (`PrivateTrackTerms.together`): the C&StL starts only when C4 and C6
  both have a lay, and once one is laid the other is a required `privateTrackLay` the player may
  not decline.
- **Bonuses along the route** (`RouteRevenuePolicy.bonusesAlongRoute`): §6.66 keeps stops an
  N/M train passes without counting on its route for direct, interconnection and D&H bonuses,
  and drops those skipped off an end, which then no longer end it. Evaluation and the solver
  share the reading; 1846's east–west bonus keeps counting paid stops only.
- **Printed bonus arrows** (`BonusArrows`) are the rules' source: each pair's direct total is
  its listed direct value plus its interconnections both ways, and the map draws the arrows
  from the same values.
- **Autorouter wire version 5:** N+s budgets, end-only destinations and interconnection
  extensions; the shortest extension per end and destination is tried.
- **UI:** route overlays draw extensions. 1846's finance panel and construction modes are
  being lifted into `@tabletop/18xx-ui` so the shared table offers them to 1833NE.

Every 18xx title's runtime contract gained only optional fields, so each title's next logic
release is a major.

### Verified by tests

- Rulebook p. 8: OR1 in reverse price order with the top of a column first; OR2 runs of
  $60/$80 (B&W) and $90/$80 (B&P) with ferries and the moving New bonus.
- §6.66: the Fitchburg's two routes earn $160, or $170 with Troy–Fitchburg interconnecting
  to Boston; an extension may not share another route's track; the Albany/Troy–Boston total
  applies only in phases I–II.
- Auction: first bid at the printed price, $5 multiples, all-pass resolution with two income
  payments, priority left of the last buyer.
- Phase-out and removal timing, private removal at III and IV, the joint token, brown 50
  cities only where no 60/70 fits.

### Known limits

- **Routes come from the autorouter only**, as for every 18xx table; the debug route builder
  can draw an extension by hand.
- **Not yet in the 18xx playground or `games.json`**; the harness has three scenarios.

## Takeover game (2026-10-30)

The `takeover` game option (§2.4, §5.34, §6.82–6.83, §11).

### Survey

Family takeovers so far: 1832's takeover (§11.7 there) pays every outside share in cash at the
market price, the buyer's president making up a shortfall by selling shares; 1817 and 1846
acquire through acquisition rounds and private sales. 1833NE differs: shares are redeemed one
for one with the acquirer's unissued shares or cash, at the acquirer president's choice; the
target may refuse unless it is vulnerable; the acquirer's price moves one box toward the
target's; tokens are replaced, duplicates and unplaced ones discarded. The shared pieces are
`transferCompanyAssets`, `moveCompanyStations` (now with `duplicates: 'discard'`),
`closeShareCompany`, `evaluatePresidency` and the `SystemActionFirstHandler` step pattern 1817
and 1832 use; the step, offer and settlement are title-owned.

**Home chosen at start.** The research traits record 35 titles under
`home-establishment: eligible-location-choice` (`data/title-traits.json`, "Companies using
the home-selection procedure"); the research snapshot lists 1833NE as `fixed-home` because it
predates the Takeover game. Their variations:

- _When the home is chosen._ As the company starts (1861, 1867 minors, 18USA, 18Hiawatha,
  1877, 1817's family through its auction opening), or before its first operating turn
  (1849's designated company, here `StationRules.homeChoice`, used by 1830's variant hook).
- _Which cities._ Any tokenable city (1817, 18FR, 18USA), a listed candidate set (1824, 1837,
  18Dixie, 18LosAngeles), cities on existing track (18Ireland, 1868WY), cities without other
  tokens or unconnected ones (1861, 1867, 1807), regions by phase (1841, 18OE).
- _Cost._ Free in every surveyed title but 1833NE, whose $80/$120 depends on the hex's track
  and whose $120 home needs a starting price of at least $60.
- _Counterexamples._ 18CZ and 1862 lay the home tile before choosing; 1858 and 18EU derive
  the choice from a predecessor; 1817 chooses within an auction rather than at a price.

`CompanyRules.startHomes(state, companyId, marketSpaceId)` returns the cities offered with
their cost to the treasury. Keying it by the starting price covers 1833NE's price minimum; a
cost of 0 covers the free titles; the city set is title policy. `StartCompany` carries an
optional `home`, placed after the purchase and paid from the treasury. The stock round's Start
menu asks for the home on the map before the price. **Limit:** a home tile laid as part of the
start (18CZ, 1862) and predecessor-derived homes are not covered; 1817's auction keeps its own
home stage. Every 18xx title's runtime contract changed (the `StartCompany` hash), so each
title's next logic release is a major.

The step's train turn-in is the family's `DiscardMergedTrain`, lifted from the copies 1817
and 1832 had; each title supplies `MergedTrainDiscardRules` (whose discard is due, and what
follows once the company is within its limit).

### What is built

- Five Variable Start railroads in the Takeover game, startable from phase II in any open city
  spot: not reserved and not the home of a corporation yet to start. A home in a gray hex or a
  hex without track costs $80, otherwise $120 with a starting price of at least $60.
- Five phase IV trains; train limits 3/3/2/1/1, plus one per takeover the corporation has done.
- The takeover step after the second operating round of each set from phase II, in stock price
  order: `OfferTakeover` (target and swaps per holder), `AnswerTakeover`, `PassTakeover`,
  `DiscardMergedTrain` for an acquirer over its new limit.
- Settlement (§11.5): shares redeemed by swap or cash, presidency rechecked, price moved, tokens
  replaced (duplicates and unplaced discarded), cash, trains, privates, ferries and station
  access transferred, an unsold phase IV train removed on the 1st, 3rd, 5th takeover. The
  certificate limit counts corporations not closed, so it drops a row with each takeover.
- §11.6–11.7: the joint Sherbrooke token stays in place with the target's share passing to the
  acquirer; reserved spaces, terrain discounts and the B&W's $40 Worcester token follow the
  acquirer (`successorOf`, transitively).

### Rulings (not settled by the rulebook)

- A refused offer ends that corporation's attempt for the step (§11: "may attempt one
  takeover").
- The step's order is the stock price order when it begins.
- A share in the Stock Market may be redeemed by swap; the acquirer's share then goes to the
  Stock Market.
- A target with no president (receivership) cannot refuse.
- Only takeovers a corporation does itself raise its train limit; rights (§11.7) pass on
  through later takeovers.
- The golden spike payment does not pass to an acquirer.
- No takeover step follows the last set: the game ends after the round sequence (§10.1).
- No step is held when no corporation can attempt a takeover.
- A corporation whose President certificate is in the Stock Market cannot attempt a takeover
  (§7.4: it does not redeem shares).
- When one player presides over both corporations, the offer needs no answer.
- Sherbrooke's city spot is not offered as a Variable Start home: the joint token is placed
  there free with the city's yellow tile (§6.53).

### Verified by tests

`src/takeovers.spec.ts`: the rulebook example played through the engine with its figures
(B&W $80 with $40, Hartford $30 with $19, the president $126; after the takeover the B&W at
$70 with 2, 2+1, 2+1 and 3/5, the president with 6 shares, the certificate limit 25 and a
phase IV train removed). Two of the example's figures do not follow from its own: it gives the
B&W "4 unissued shares, $69 cash" afterwards, where it had 4 and $40, swapped 2 and took the
Hartford's $19 (2 and $59). Also: cash redemption, offer limits, refusal and acceptance,
vulnerable targets, turning in trains, Variable Start homes and costs, train limits, and the
joint token, reservations and discounts passing on. Harness scenarios: Takeover step, Variable
Start railroads.
