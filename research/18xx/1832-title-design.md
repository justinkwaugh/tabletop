# 1832: title plan and slice designs

1832: The South is the sixth executable 18xx title, after TOP, Shikoku 1889, 1830,
1817 and 1846. This note records the delivery plan and each slice's design review,
following the standing [18xx design rule](../../docs/agents/18xx-design.md).

## Authority and scope

**Project decision (2026-10-07):** the 1832 rulebook, version 4.2c (W. R. Dixon,
27 September 2006), defines the rules. The PDF, a column-ordered text extraction
and a photograph of the owner's Golden Spike map are in the research package's
`reference/` directory (`1832-the-south-rules-v4.2c.pdf`, `…txt`,
`1832-golden-spike-map-photo.jpg`). Section numbers below cite the rulebook.

The research implementation (`g_1832`, pinned at
`715567bdc7e5cc68a68a286b21dc8edd1a125e50`) is prealpha. Its map, market and
entity data are the only machine-readable source for the board, the stock market
grid, charters and token costs, none of which the rulebook prints. Use that data,
checked against the map photograph and every rule the rulebook does state. Its
procedures are evidence only; the open upstream merger PR (#12835, unwired) and the
closed fuller version (#12761) were read but do not define behavior.

- **Hosting:** 18xx playground only, like 1830 and 1846. Not added to `games.json`.
- **Players:** two to seven (Table 2 prints capital and limits for 2–7).
- **Coordinates:** the printed board's (rows O–AA, columns 14–35; Miami is AA28,
  §8.4). The research data uses A–N/1–24; printed = research row + 13 letters,
  column + 12.
- **Artwork:** boardless map. Railroad and System heralds from the research
  implementation's `public/logos/1832` directory, as the user requested. No
  physical-board artwork is claimed.
- **Systems:** the rulebook's physical procedure overlays two companies' certificates
  to represent a 20-share System (§11.6). By user decision, a System is instead a new
  company with its own 5% shares and its own tokens; its certificates replace the
  component companies' certificates one for one. The five Systems use the research
  implementation's names and logos — Amtrak (AMTK), Burlington Northern Santa Fe
  (BNSF), Illinois Central (IC), CSX and Norfolk Southern (NS) — standing for the
  rulebook's Systems A–E, whose names "have no bearing on game play".
- **Optional rules:** $400 Finish (§17.1), 1830 Diesels (§17.2) and No Mergers
  (§17.6). The Southern Bank (§17.3), Historical Order (§17.4) and The Civil War
  (§17.5) are deferred.

## Trait comparison

Of the 70 compared traits, the research profile of 1832 matches 1870 and 1850 in 55
and 1830 in 47 ([title traits](/workspace/research/18xx-2026-09-08/data/title-traits.json)).
The profile reflects the prealpha engine, so it records no treasury-share
transactions and unresolved reorganizations; the rulebook adds redemption and
reissue (§5.10–5.11), price protection (§5.9) and Systems and takeovers (§11).

Against 1830, the executable sibling closest in data: sell-buy or buy-sell turns
(§5.3.4) instead of sell-buy-sell; half dividends; a certificate limit that falls as
companies close or are taken over (Table 2); two yellow lays or one upgrade (§6);
semi-restrictive usefulness (§6.1–6.2); medium cities (§6.4.2); company-form train
limits for Systems (§11.6.7); revenue modifiers from the Port, Cotton and Key West
tokens and the WVCF rights (§7.5–7.6, §8.4); another actor's response for price
protection; and merger rounds.

## Delivery slices

Each slice ends with a code review whose findings are fixed before the next begins.

1. **Title data and ordinary play.** Packages, the printed map, tiles and market,
   the ten railroads and six privates, trains and phases; the opening's waterfall
   sale with P7's CoG par and the all-pass income round; stock turns, certificate
   limits, flotation at six shares with capital at the end of the stock round;
   ordinary construction, stations, routes, half dividends, trains and forced
   purchases; bankruptcy and bank endings; the market's soft ledge. A complete shared-table
   UI.
2. **Map specials and private powers.** Medium cities, Atlanta's three cities and
   its special tiles, the #611/#193 restrictions and Tampa's brown limit, free home
   terrain, Miami's first run, the WVCF rights and P5, the Key West, Port and Cotton
   tokens, London Investment's share and its closure, CoG's P7 closure, and the
   private-token removals at phases 6 and 8.
3. **Market completion and price protection.** Black-area closure and its
   certificate-limit effect, and price protection after stock turns and forced sales.
4. **Redemption and reissue.**
5. **Mergers.** Merger rounds after phase 4 and 5 stock rounds and the special
   phase 6 round; System formation, presidency, vice-presidents, price, tokens,
   trains, construction, dividends and redemption; takeovers.
6. **Variants and completion.** $400 Finish, Diesels and No Mergers; a complete
   scripted game; competition coverage and readiness.

## Rulings on gaps and ambiguities

Each ruling is encoded in tests when its slice lands.

- **Physical board data.** The map, market grid, token costs and charters come
  from the research data, checked against the photograph. The rulebook's train
  table (6-train $630) overrides the map's printed $600 (§19: rules beat
  components).
- **P4 closure.** Any paid dividend, full or half, is the company's "first
  dividend" (§16.2 P4).
- **Medium-city upgrade.** Upgrading a medium city's yellow town tile to a yellow
  city tile is the turn's upgrade (§6, §6.4.2).
- **Historical order.** Deferred with its variant; §17.4's self-contradiction (CoG
  first, then ACL, against its own list) need not be resolved yet.
- **Key West token cost.** §7.5 states none; it costs nothing beyond using the
  FEC's token placement for the round.
- **Takeover renaming.** §11.3's broken cross-reference ("assume its name") has no
  rule text; the purchasing company keeps its identity.
- **Reissue rounding.** "75% of the current market price rounded to the nearest
  available par price" (§5.11) rounds a tie upward, as §11.6.3 does for System
  prices.
- **System half dividends.** §11.6.4 rounds a System's payment per holder ("round
  only odd 5% shares up"); a half dividend pays each holder half of the full
  per-holder amount, rounded up. Ten-share companies round the per-share half
  dividend up (§9.1.2: $130 pays $7 a share, the company keeps $60).
- **Merger involvement.** "A company may only be involved in one merger of each
  type" (§11.5). A System begins with its components' takeover involvement.

## Slice 1 design: title data and ordinary play

### Package and identity

Logic in `games/1832` (`@tabletop/1832`), UI in `games/1832-ui`, title ID `1832`, exports
prefixed `EighteenThirtyTwo`. Like 1830 and 1817 the title composes family rule modules
into `EighteenXXTitleRules` and builds its runtime with `createEighteenXXRuntime`; its own
rounds (mergers) will arrive as title state handlers, as 1817's do. The UI renders the shared
`GameTable` through `createEighteenXXSessionClass`; its entry exports only metadata and the
cover, and the playground reads the map view from a separate `./playground` entry, as 1846's
does.

### Data

- **Map.** The 102 hexes of the research map, at printed coordinates, checked hex by hex
  against the photograph: names, homes, terrain costs, the two double towns, the six medium
  cities, the WVCF hex (40/60), offboards (Kansas City 30/50/60, Louisville and Richmond
  30/50, Miami 20/30/50), gray Norfolk and New Orleans, and the gray track strips beside New
  Orleans and Miami. Port anchors and medium cities are persistent location markers.
  Atlanta's printed yellow tile has three one-slot cities; Georgia reserves the east city and
  the Atlanta & West Point the southwest one. Charleston and Jacksonville carry a brown Y
  label and Savannah a brown S label, so only #611 and #193 can upgrade them. Tampa's brown
  ban is a construction restriction.
- **Stations.** Charter token costs; the family gains `charterStationCost`, which 1830 now uses
  too, for prices taken from a per-company cost schedule.
- **Tiles.** The §23 manifest. The family catalog gains the standard town tiles #141, #142,
  #145, #146 and #147 (defined as in the research configuration, and used by 25 researched
  titles including 1850, 1870, 1822 and 18TN); 1832 adds Atlanta's #190 and #191 and its
  labelled #193 and #611.
- **Market.** The research grid, with its colors renamed to the rulebook's areas (par, yellow,
  green, brown, black) and the cells below the soft ledge marked as the lower area. Moves
  follow §5.8: up at the top row is right-and-down, $400 holds, a left move at the edge
  follows the down arrow, and a right move blocked by the soft ledge goes up. A sale falls a
  space per share but stops on the soft ledge when exactly one space remains, as 1870's
  research implementation does. The shared market scene draws a title's ledge along the
  bordering sides of its spaces, with a legend entry, and shows the up and down arrows wherever
  a right or left move is diverted.
- **Trains, phases and revenue.** Table 1, with the rulebook's $630 6-train. Offboard and
  coal-field values use the first value until phase 5, the second until phase 8, then the
  last (the research data's gray stage, which no phase reached, is fixed here).

### Rules

- **Opening.** The shared waterfall auction, $5 increments, bidding from the left of the
  highest bidder, P1's $5 reduction and forced free take; P7 brings the CoG president's
  certificate and a pending par. The first stock round forbids sales. Starting capital is
  $2100 split among two to seven players; the family initializer gains a seventh player
  colour.
- **Stock round.** Sell-buy or buy-sell, one certificate per turn, several open-market shares
  of one brown-area company, no repurchase after a sale in the same round, 60% and 50% limits
  waived as the areas say, and a certificate limit taken from Table 2 by the number of
  companies still active.
- **Flotation and capital.** A company floats when its sixth share leaves the initial
  offering and receives ten times par only as the stock round ends (§5.6.4). Of the 73
  researched titles releasing capital at flotation, most pay at once; 1832 pays a
  `CapitalizeCompany` system action at the start of the operating set, using the family's
  system-action-first wrapper. That wrapper moves from 1817 into `@tabletop/18xx`, unchanged,
  since two titles now need it.
- **Operating.** Two yellow lays or one upgrade; usefulness is new track, a city or town of the
  new tile on the company's route (the family's usefulness test gains a connected-town flag for
  this), or the home hex; a company's own home terrain is free. Stations cost from the charters. Full,
  half and withheld dividends: a half dividend rounds the per-share payment up (§9.1.2) and
  does not move the price; initial-offering shares pay the company and open-market shares
  pay nobody. Train limits, scrapping and discards to the open market follow Table 1 and
  §10.2.1. A compulsory purchase uses the shared president funding: no presidency change in
  the buying company, sales down to 60% where required, and the remaining operating order
  recalculated after sales, since share price order is dynamic.
- **Privates.** Income, the phase-5 closure, P7 closing when the CoG buys a train, and company
  purchases: only P5 in phase 2 for up to face value, then half to double face value in
  phases 3 and 4; P4 and P7 never. Players trade privates for at least $1.
- **Ending.** Bankruptcy ends the game at once; a broken bank after the operating set; privates
  count at face value.

### Limits after slice 1

Medium cities upgrade only as towns, and the WVCF, Miami, Key West, Port, Cotton and London
Investment powers wait for slice 2. A company can enter the black area without closing until
slice 3, which also adds price protection. Systems, redemption, reissue and the optional rules
are not yet available, and prepared scenario positions use three or four players.

### Acceptance examples

`map.spec.ts` checks coordinates, neighbours, printed track, homes, staged values and markers;
`stockMarket.spec.ts` the areas, soft ledge and edge moves; `opening.spec.ts` starting cash,
certificate limits, P7's par, P1's reduction, the no-sale first round and capital at the end of
the round; `operations.spec.ts` the construction allowance, home terrain, the special city
tiles, half dividends, entitlements, private purchase prices and P7's closure. The
playground's board test fits the market and depot clear of every hex.

## Slice 2 design: map specials and private powers

### Survey

Same-colour upgrades: the research maps mark medium cities ("boomtowns") only in 1832 and
1868 Wyoming, whose boomtowns likewise turn a town into a city before the next colour.
Access rights to a stop: the assignment catalog records private access grants (1830, 1846,
1822 and others), permits (1862, 1880), regional rights (1841, 1866, 18OE) and marker access
(1862, 18ESP, 18 Royal Gorge); 1832's WVCF token is a per-company right to one stop. Stops whose
value depends on game history (Miami's first run) and route bonuses owned by a company (Port,
Cotton, Key West, 1846's revenue markers) fall under route-revenue modifiers. Extra placements
in the token step occur in 1846 (C&WI) and 1830 (D&H) as private powers.

### Shared changes

- **Track.** `TrackRules.upgradesWithinColor` admits a same-colour replacement the title
  allows, which it then judges itself; the upgrade mapping lets a town become a city only for
  such a replacement. `allowance` learns whether the lay replaces a tile, so a medium city's
  promotion counts as the turn's upgrade. Titles that ignore the flag are unchanged.
- **Routes.** `RouteRules.stopAllowed` excludes a stop for a company, enforced by the evaluator
  and by the autorouter's existing per-stop `allowed` flag; `stopRevenue` sets a stop's own
  value, shared by both through `stopValue`, since bonuses cannot be negative.
- **Steps.** `StationRules.holdsStationStep` keeps the token step open while a title placement
  remains; `EighteenXXTitleRules.additionalConstructionActions` does the same for the track
  step's automatic completion.
- **Purchases.** A share may be acquired for $0, for the London Investment Company's free share,
  through the shared acquisition checks (ownership and certificate limits, presidency, no
  repurchase after a sale).
- **Presentation.** A `townRing` marker art rings a hex's towns, as medium cities are printed.

### Decisions

- **Medium cities** are the six ringed hexes. From phase 3 a yellow town tile there may become
  #5, #6 or #57 (whichever keeps its track), the turn's one upgrade; or a green town as for any
  town. The ring is drawn until the tile is upgraded.
- **WVCF.** Rights are a list of companies. A company buying P5 takes one; others, once P5 is
  company-owned or closed, buy one in their track step for $80 ($40 to P5's owning company while
  it is open), using a yellow lay, when their track reaches the coal fields. Only holders may
  visit or pass through O26: routes, the runs that reach new track (§6.1) and those that
  reach cities for stations all stop there, through `stopAllowed` hooks on the route, track and
  station rules. The purchase is recorded as the turn's WVCF purchase, which the allowance counts
  as a yellow lay without showing a tile laid. **Ruling:** P5 blocks no hex; "no company may
  connect to the coal fields" is enforced through the rights alone.
- **Port, Cotton, Key West.** Tokens record kind, company, location and city node. P3's Port goes
  on any anchored revenue location (towns and Miami included, as the anchors are printed there)
  and P2's Cotton in any non-coastal city on the current map, with Atlanta's city chosen by
  clicking it on the board (the shared location choice now passes the clicked city); a
  Cotton token follows its city through Atlanta's upgrades. Each is placed once in the owning
  company's token step and stays after its private closes. Port and Cotton stop counting at
  phase 6, Key West at phase 8. Key West, from phase 3, is the FEC's token placement for that
  turn.
- **Miami.** Before phase 5 Miami is worth $0 until a run reaches it; a system action records
  that run. **Ruling:** every train of the company making that first run counts it at $0.
- **London Investment.** As the turn's purchase, P4's owner takes a free initial-offering share
  of a company whose president's certificate was bought in this stock round (CoG's in the first).
  P4 stays open, cannot then change hands, and closes after that company's first paid dividend.

### Limits after slice 2

Mergers' WVCF and token consequences wait for slice 5. Prepared positions do not include placed
tokens; tests cover them.

### Acceptance examples

`mediumCities.spec.ts`, `coalFields.spec.ts`, `revenueTokens.spec.ts` and
`londonInvestment.spec.ts` cover the promotion and its allowance, the ring's lifetime, buying
and enforcing WVCF rights, token choices and values, Miami's first run, Key West and London
Investment's share and closure.

## Slice 3 design: closure and price protection

### Shared changes

- `closeShareCompany` (company/companyClosure.ts) closes a share company: treasury to the bank,
  certificates and owned privates retired, stations and reservations removed, trains to the
  market or out of play, market marker removed. 1846's railroad closure now uses it.
- Sales report their details to `StockRules.afterSale` and `TrainFundingRules.afterShareSale`,
  and record the company's place in its market stack before the sale (`fromStackIndex`, an
  optional metadata field); `restoreStockMarker` puts a marker back at that place.
- `SystemActionFirstHandler` may choose its next state from the action's result, and offers
  players no actions while its system action is due, so the automatic train completion that
  wraps it waits.
- Market-zone holding limits ignore closed companies, which have no marker.

### Decisions

- **Closure.** A started company whose price is in the black area closes before the stock
  round, operating set, train funding or train purchase does anything else, unless a president
  other than the seller may still protect the sale that put it there. Its trains go to the open
  market, and its WVCF token and Port, Cotton and Key West tokens leave play. Closing during
  its own train funding, the president's cash goes to the bank too; closing on its own turn
  ends that turn. Sales cannot start from a black space.
- **Recording.** Every player's sales are recorded, merged per company in the order sold, with
  the price and stack place before the first sale. Selling a company ends any excess the seller
  kept by protecting it (§5.9.8); the family's sell-down then applies outside green and brown.
- **Deciding.** Once the seller finishes (the stock turn passes on, or the train is bought), a
  system action sets play aside for the presidents if any may protect; otherwise it discards
  the record. In the order sold, each company's player president other than the seller, with
  the cash and certificate room at the restored price, protects or declines. Protecting pays
  the sale's proceeds to the bank, takes the sold certificates from the open market and
  restores the price. **Ruling:** a president already over the certificate limit may still
  protect shares that do not raise their count.
- **Resuming.** In a stock round with a protection, play passes to the left of the last
  protecting president, whose shares were sold last; the open turn is reassigned, so players in
  between miss their turn and the protector is the last to act for priority. Otherwise play
  returns as it was.

### Survey

Price protection appears in 1832, 1850 and 1870 (research catalog; upstream `g_1870`, `g_1850`
price-protection steps). All three queue a seller's sales and let each company's president buy
them back at the sale price, restoring the price. They differ in who may protect (1870's original
rules bar a president who sold that company this round; 1832 allows it, §5.9.10), in the
certificate-room test, and in where play resumes. Black-area closure is shared with other
titles' closing zones (1817's liquidation, 1846's closure). The shared parts are in the family
library: sale details with the pre-sale stack place, `restoreStockMarker`, `closeShareCompany`
and the hooks. **Limit:** the decision flow (`ProtectingPrice`) stays in 1832 until a second
title needs it; it is written against those shared pieces so it can move with title hooks for
eligibility and resumption.

### Rulings

- A holding above 60% is never by itself a breach: purchases stop at 60% outside green and
  brown, a holding above it (from protection or green/brown purchases) is kept, recorded as an
  ownership exemption, and the next sale of that company outside green and brown must bring it
  to 60% in one block (§5.4.1, §5.9.8). Forced train sales sell down the same way (§5.5).
- A company in the black area counts as closed for certificate limits and its certificates
  count for nothing, from the sale that put it there (§5.3.5).
- A company whose sale no president can protect closes at once, during the decisions included.
- Operating-round protections restore the company's place in the operating order; play then
  returns to the train step, which ends the turn as the treasury is empty (§5.9.6).
- The protector pays what the seller actually received; split forced sales therefore cost the
  sum of their falling prices.
- The certificate limit applies to protections in operating rounds too, and a president already
  over it may protect shares that do not raise their count.
- Privates owned by a closing company close with it, and its Port, Cotton and Key West tokens
  leave the map ("all tokens of that company", §5.1.1).
- A company a forced sale sends into the black, whose president may protect it, closes only
  after the train is bought and the decisions are made.
- A seller kept over the certificate limit by a yellow-area sale that protection undoes sells
  down on their next stock turn.

### Release

The sale metadata's optional `fromStackIndex` changes every 18xx title's sale action schemas.
Stored games still load; a cached older UI artifact would reject the new metadata, so each title
republishes its logic and UI artifacts together when it next adopts the shared library.

### Limits after slice 3

Redemption (slice 4) moves no prices and needs no closure check.

### Acceptance examples

`priceProtection.spec.ts` covers stock-round protection and declining, sales of the seller's
own company, cash limits, the 60% exemption and its loss, ordering across presidents,
protection after a forced sale, immediate and deferred closure, and closure during a company's
own train funding.
