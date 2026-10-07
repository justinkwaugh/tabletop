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
   purchases; bankruptcy and bank endings. A complete shared-table UI.
2. **Map specials and private powers.** Medium cities, Atlanta's three cities and
   its special tiles, the #611/#193 restrictions and Tampa's brown limit, free home
   terrain, Miami's first run, the WVCF rights and P5, the Key West, Port and Cotton
   tokens, London Investment's share and its closure, CoG's P7 closure, and the
   private-token removals at phases 6 and 8.
3. **Market completion and price protection.** The soft ledge, black-area closure
   and its certificate-limit effect, and price protection after stock turns and
   forced sales.
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
- **Tiles.** The §23 manifest. The family catalog gains the standard town tiles #141, #142,
  #145, #146 and #147 (defined as in the research configuration, and used by 25 researched
  titles including 1850, 1870, 1822 and 18TN); 1832 adds Atlanta's #190 and #191 and its
  labelled #193 and #611.
- **Market.** The research grid, with its colors renamed to the rulebook's areas (par, yellow,
  green, brown, black) and the cells below the soft ledge marked as the lower area. Moves
  follow §5.8: up at the top row is right-and-down, $400 holds, a left move at the edge
  follows the down arrow, and a right move blocked by the soft ledge goes up. A sale falls a
  space per share but stops on the soft ledge when exactly one space remains, as 1870's
  research implementation does.
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
- **Operating.** Two yellow lays or one upgrade; usefulness is new track, a connected city or
  the home hex; a company's own home terrain is free. Stations cost from the charters. Full,
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
