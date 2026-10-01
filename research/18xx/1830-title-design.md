# 1830: title plan and slice 1 design

1830 is the third executable 18xx title after TOP and Shikoku 1889. This note
records the title's delivery plan and the design review for its first slice,
following the standing [18xx design rule](../../docs/agents/18xx-design.md).
Later slices add their own sections or notes before implementation.

## Authority and scope

**Project decision (2026-10-01):** the research site's 1830 implementation defines
the rules. Its metadata names the Lookout 1830-RE rulebook. No 1830 rulebook is in
the workspace, so the [game configuration][game], [entities][entities],
[map][map] and [stock step][stock] are the primary evidence. Citations pin
`715567bdc7e5cc68a68a286b21dc8edd1a125e50`. Where the reference engine and a
printed 1830 rule may differ, follow the engine and record the difference.

- **Hosting:** 18xx playground only, like 1889. Not added to `games.json`.
- **Artwork:** none. Boardless map, generic share and private presentation.
- **Optional rules now:** the extra 6-train and buying multiple brown shares from
  the initial offering, both from the [metadata][meta].
- **Verification target:** the three recorded games in
  `/workspace/research/18xx-2026-09-08/source/public/fixtures/1830` (3 and 4
  players; one with `multiple_brown_from_ipo`). The 1889 conversion in
  `fixture-conversion/` is the precedent.

## Trait comparison

Of the 70 compared traits, 1830 matches 1889 in 61
([title traits](/workspace/research/18xx-2026-09-08/data/title-traits.json),
`g_1830` against `g_1889`). Trains, phases, rust timing, the D trade-in, full
capitalization, ledges and bankruptcy are numerically identical to 1889.

The differences are 60% float, sell-buy-sell turns, permissive track usefulness,
whole-tile reservations, D&H's remote construction and station, B&O's pending par,
and D&H's two-step power. Further title differences outside the trait set:
a $12,000 bank, pointy hexes, two-city OO and NY tiles, multi-hex offboard
groups, brown-zone multiple purchases, and interplayer private sales after the
first stock round.

## Delivery slices

1. **Title data and ordinary play** (this note). The package, complete data, the
   1830 tile set and map in the playground, with ordinary family rules.
2. **Two-city hexes:** whole-tile reservations and Erie's home choice, and
   station migration when an OO/NY upgrade has more than one valid node mapping.
3. **Stock-round rules:** sell-buy-sell, multiple brown-zone purchases, the
   brown-from-IPO option, and interplayer private sales.
4. **Private powers:** C&A and B&O awards, B&O's par before the first stock round,
   B&O closing on its first train, C&StL's lay, D&H's tile-then-station power, and
   M&H's exchange window.
5. **Routes, emergency purchases and verification:** offboard groups (Canada
   A9/A11, Gulf I1/J2) in route validation and the autorouter encoding; emergency
   train purchases from other companies at no more than face value; then replaying
   the recorded games.
6. **Title UI:** prompts and panels the shared table lacks for slices 2–4.

## Slice 1 design

### Package and identity

Logic in `games/1830` (`@tabletop/1830`), UI in `games/1830-ui`
(`@tabletop/1830-ui`), title ID `1830`, exports prefixed `EighteenThirty`. The
package follows 1889's anatomy: one module per data set or rule area, composed
into `EighteenXXTitleRules` in `definition/gameDefinition.ts`. The title's rule
modules compose family helpers. They are not shared with 1889 even where the
numbers agree; the common numbers are coincidence of lineage, and the family
survey shows many descendants vary them.

### Map: first pointy-hex consumer

**Survey:** 67 of the reference titles declare a pointy layout and 40 declare
flat. Common's `HexOrientation`, `letterNumberHexCoordinates` and the map
renderer already accept both, but no executable title has used pointy hexes.

**Decision:** no new orientation abstraction. The 1830 map exercises the
existing path end to end. Acceptance: neighbor tests across representative
pointy edges (including the impassable borders at D12, C11, C13, C17, B16, E7
and F8), offboard edges, and rotation of a placed tile matching its drawn track.
Any orientation defect found is fixed in the family code with a regression test.

### Tile catalog additions

1830 uses 46 tile numbers. Sixteen are not yet in `StandardTileCatalog`: 2, 4,
18, 53, 54, 55, 59, 61, 62, 63, 64, 65, 66, 67, 68 and 69.

**Survey:** the research catalog defines each as a shared numbered tile. Titles
override some numbers with different definitions: 1858 and its variants (2, 4,
55, 69), 1817 variants and 1850 JR (54, 62, 63), 18FL and 18USA (63), 1804,
1822 PNW and 1868 WY (18), 1850 JR (53, 61). This is the #611 pattern already
recorded in the [tile evidence](tile-library-evidence.md).

**Decision:** add all sixteen as `18xx:<number>` shared definitions matching the
research's base catalog. Title variants stay separate definitions when a later
title needs them. Multi-city faces (54, 59, 62, 64–68) get explicit node
layouts in `standardTileLayouts.ts`; the renderer refuses to guess city
positions. Multi-town faces place their towns along their own track, so only
those whose tracks cross (55, 69) need town positions. Each new face is checked so its
drawn paths and hit targets match the logical topology in both orientations,
as earlier catalog additions were.

1830 places green #59 on the preprinted yellow OO hexes, and brown 64–68 upgrade
it. Label-matched upgrades (`trackConstruction.ts`) and node mappings
(`trackUpgrade.ts`) already handle these when no station makes the mapping
ambiguous. Slice 2 resolves the ambiguous cases.

### Home stations on multi-city hexes

`createLetterNumberLocationFactory` reserves every home on node `'city'`. NYNH's
home is the first city of New York (G19). Erie's home is the whole Buffalo hex
(E11); the reference engine places a hex-wide reservation and lets Erie choose a
city when it places its home.

**Decision:** let the factory's `homes` entries optionally name the node. This
is the smallest change that serves NYNH, and 1889 and TOP keep their data
unchanged. Erie's whole-hex reservation needs a new reservation kind and a home
choice, so it belongs to slice 2. Until then Erie cannot be started; the
playground records this as an intentional limit, rather than inventing a fixed
city.

### Privates in slice 1

All six privates are data in a `PrivateCatalog`: face value, revenue, the hexes
they block while player-owned, and closure at the first 5-train. B&O's sale terms
are `'never'`, so it cannot be sold to a corporation. Their powers and awards arrive in slice 4.

The opening is the reserved waterfall auction with a $5 increment. The
reference's [waterfall step][auction] resolves a contested lot starting with
the lowest current bid, so 1830 uses `bidOrder: 'lowest-bid-first'`. 1889 keeps
its rulebook order; this difference is recorded in the
[1889 evidence](1889-slice-evidence.md).

### Bank, market, trains and phases

- **Bank:** $12,000. Starting cash 1200/800/600/480/400 for 2–6 players.
  Certificate limits 28/20/16/13/11. As in 1889, the bank keeps paying once
  broken, and the game ends after the current set of operating rounds;
  bankruptcy ends it immediately (the reference engine's shared defaults).
- **Market:** the 11-row grid from the [game configuration][game], with yellow,
  orange and brown zones keeping their certificate-limit and 60% exemptions.
  Brown-zone multiple purchases come in slice 3.
- **Corporations:** eight majors, 60% float, full capitalization, station
  schedules as in [entities][entities] (PRR/NYC/CPR 4, B&O/C&O/Erie 3, NYNH/B&M 2).
- **Trains and phases:** as 1889. The D-train costs $1,100, or $800 trading in a
  4, 5 or 6 from phase 6. Interplayer private sales, allowed from phase 2 after
  the first stock round, come with their action in slice 3.
- **Track:** permissive usefulness. A connected lay or upgrade is always
  useful, whereas 1889 requires new track or a higher city value. Mountains cost
  $120 and water $80.

### Extra 6-train option

The opening receives the game configuration and builds the initial train
inventory. With the option, it supplies three 6-trains instead of two. The
depot's definitions and the phase table stay static. Acceptance: after two
6-trains are sold, the next train offered is a third 6-train only with the
option; without it, only the D-train is offered.

The brown-from-IPO option is declared now but has no effect until slice 3 adds
brown-zone multiple purchases.

## Implementation notes for slice 1

Decisions made while implementing, beyond the design above:

- **Usefulness needs connectivity.** The family `TrackRules.useful` hook also
  decides whether a company can reach a hex, so "always useful" would allow lays
  anywhere. The hook now also receives `connected` (some path of the new tile
  touches the company's network). 1830 accepts `home || connected`; 1889 and TOP
  keep their checks. Any connected lay or upgrade remains allowed, matching the
  reference engine's permissive restriction.
- **The extra 6-train is removed, not added.** Train inventories are validated
  against the depot's fixed identities, so the depot supplies three 6-trains and
  an ordinary game marks the third as removed at setup.
- **Homes are placed when a company first operates**, as the reference engine
  does, rather than at the start of the operating round as in 1889. The
  `pendingHomes` hook now receives the operating set to support this.
- **Station costs** follow each company's schedule (0, 40, 100, 100): each
  placement costs the entry after the stations the company has already used.
- **Emergency presidency changes:** emergency sales may change the presidency of
  other companies, but never of the company buying the train.
- **Multi-city faces** use node ids `city-0`, `city-1` from a new
  `createSeparateCitiesTileFace`. Their positions are in `StandardTileLayouts`
  (catalog tiles) and the title map view (printed hexes).
- **Blocked-hex markers:** the map marks each hex a private blocks while
  player-owned.
- **Companies without a home cannot start.** This kept Erie out until slice 2
  gave it a whole-hex reservation; slice 2 removes the guard.

## Intentional limits after slice 1

- Erie cannot be started (slice 2).
- Stock turns are sell-then-buy or buy-then-sell, one purchase per turn (slice 3).
  A company's shares are sold in one block per turn; the reference engine allows
  separate sales at the moved price (slice 3).
- Emergency train purchases from other corporations, allowed up to face value by
  the reference engine, are not offered (slice 5).
- Private companies have no powers or awards (slice 4).
- A route may count both hexes of Canada or of the Gulf (slice 5).
- The table harness has no finished 1830 game until the recorded games are
  replayed (slice 5).
- The divider lines between the two hexes of Canada and of the Gulf, and the
  single revenue label per group, are drawn with the offboard groups (slice 5).
- The brown-zone IPO option is offered but not yet enforced (slice 3).

## Acceptance examples

- Opening positions for 2–6 players conserve the $12,000 bank and match the
  reference starting cash and certificate limits.
- The 1830 tile library view lists 46 numbers with the reference counts, and the
  sixteen new faces render correctly in both orientations.
- The boardless map draws all 1830 hexes in pointy orientation, including the
  preprinted OO and NY hexes, offboard revenues and impassable borders.
- A playground game runs the waterfall auction, a stock round, and operating
  rounds with track, stations, routes and train purchases through the D-train.
- NYNH's home station lands in New York's first city.
- An OO hex upgrades from preprint to #59 to a brown OO tile.
- Parring NYC and buying 60% floats it with $1,000 at a $100 par.

## Slice 2 design: two-city hexes

Slice 2 lets Erie start from its whole-hex home and makes upgrades of the two-city
hexes keep stations and reservations in the right city.

### Evidence

- **Reservations.** The [title-trait survey](/workspace/research/18xx-2026-09-08/data/title-traits.json)
  records station blocking as filled-city blocking (126 titles), slot reservations
  (94), whole-tile reservations (15, including 1830), outstanding-home blocking
  (13), single-slot reservation blocks (4) and future capacity (3). The reference
  engine's tile reservation with `TILE_RESERVATION_BLOCKS_OTHERS = :always` (16
  titles) stops other companies placing in any city of the hex until the home is
  placed; `:single_slot_cities` (3) and `:never` (2) differ.
- **Home choice.** Home establishment is a fixed home in 110 titles, a choice among
  eligible locations in 35, several homes in 10, and other forms in 17. The
  reference's [home-token placement][home-token] places a whole-hex home in the
  first city while the hex has no track, leaving the tile lay to settle which way
  that city faces; once the hex has track, the president chooses.
- **Upgrade mapping.** The reference's [hex lay][hex-lay] maps the cities of a tile
  whose cities have no track to the new tile by index, and otherwise keeps each
  city's exits as a subset of the new city's exits. Our family enumerates every
  path-preserving node mapping and offers each as a separate choice.

### Decisions

- **A whole-hex home reserves every city on the hex.** The map factory's string
  home already means "this hex"; it now reserves each city of the printed tile
  rather than a node named `city`. Single-city homes are unchanged, so TOP and 1889
  keep their data and reservations. Reserving each single-slot city has exactly the
  `:always` effect for 1830, whose OO cities have one slot at every stage.
  **Limit:** a whole-hex reservation over multi-slot cities, as in some `:always`
  titles, would need its own representation.
- **A trackless home hex uses its first city; a tracked one is the president's
  choice.** Until track reaches Buffalo its cities are interchangeable, so Erie's
  home goes in the first. After an upgrade gives them different connections, they
  are not, and Erie's president chooses by clicking a city on the map.
  `StationRules` gains an optional `homeChoice` hook returning the operating
  company's choice as city positions, possibly on several hexes. When a title
  supplies it, the runtime registers a `ChooseHomeStation` action and holds the
  operating set before the company's turn, including any between-company private
  requests, until the president chooses. A placed home, automatic or chosen,
  releases the company's other home reservations. Titles without the hook get no
  new action or state, so TOP's and 1889's runtime contracts are unchanged.
- **Cities without track keep their order.** Track is what distinguishes the
  cities of a hex, so when no city on the old face has any, an upgrade maps the
  first city to the first, and so on; the rotation of the new tile then decides
  which way each faces. The reference's tile lay does the same. No current TOP or
  1889 hex has several cities without track.
- **Identical construction choices are offered once.** Mappings that leave every
  station and reservation where an alternative would are the same placement; the
  track step keeps the first. This removes duplicate options for two-town hexes
  and for empty two-city hexes.

### Limits after slice 2

- Whole-hex reservations over multi-slot cities are not represented (no 1830 case).

### Acceptance examples

- Erie's opening reservation covers both Buffalo cities, and no other company can
  place a station in either while it stands.
- When Erie first operates on the printed Buffalo hex, its home goes in the first
  city, the other is released, and the turn begins.
- If Buffalo already has #59 when Erie first operates, the map highlights it and
  Erie's president clicks a city; the home is placed there.
- Upgrading Buffalo to #59 keeps Erie's station in its city, and each rotation
  of an empty two-city or two-town hex is offered once.
- Upgrading New York to #54 keeps NYNH's reservation on the city joined to its
  original track.

## Slice 3 design: stock-round rules

Slice 3 makes the 1830 stock turn follow the reference: sell-buy-sell, separate
sales of one company, several brown-zone purchases (with the IPO option), and
private-company sales between players.

### Evidence

- **Turn order.** The [trait survey](/workspace/research/18xx-2026-09-08/data/title-traits.json)
  records sell-buy in 88 titles, sell-buy-or-buy-sell in 25 (1889) and
  sell-buy-sell in 18 (1830). TOP is sell-buy.
- **Repeat sales.** The reference's `MUST_SELL_IN_BLOCKS` (1889: true) makes later
  sales of a company in the same turn extend the first block at its price; 1830
  leaves it false, so each sale is separate and moves the price again.
- **Several purchases.** In the reference's [stock step][stock-step] a second share
  purchase in a turn needs the company in a multiple-buy (brown) zone, no company
  started this turn, and no shares of another company bought this turn. Unless
  `multiple_brown_from_ipo` is on, it must come from the market and no share may
  have come from the IPO that turn.
- **Private sales between players.** 1830's stock step offers other players'
  privates from the phase that allows it, except in the first stock round and
  after the turn's purchase; a private bought this way is the turn's purchase, so
  only brown-zone shares may follow. B&O cannot be bought. The engine takes the
  agreed price without checking it; the rules call for the seller's agreement.
- **State shape.** A hosted TOP game is in progress, and the
  [state-shape backlog](state-shape-backlog.md) holds shared state changes until it
  ends.

### Decisions

- **Turn order and repeat sales are rule policies.** `StockRules.sellAfterBuying`
  becomes `turnOrder` (`sell-buy`, `sell-buy-or-buy-sell`, `sell-buy-sell`) and
  `extendSaleBlocks` becomes `repeatSales` (`extend-block` or `separate`; absent
  means one sale per company per turn). TOP and 1889 keep their behaviour. 1830
  uses `sell-buy-sell` and `separate`. Neither needs new state.
- **New state is additive and optional.** The turn's purchases are an optional
  family field, and the pending purchase offer gains a player-buyer variant beside
  the existing company shape. TOP and 1889 never write either, so every state they
  produce is unchanged and loaded clients keep accepting them; the new schemas
  accept a superset. Their runtime-contract snapshots were regenerated for this.
  The backlog's freeze covers changes to fields existing states already hold.
- **Several purchases.** `StockRules.multipleBuys` names when a further share may
  be bought: the title says whether the company's price allows it and whether it
  may come from the IPO; the family enforces the turn's earlier purchases. The
  turn's purchases are recorded in `stockTurnPurchases`, cleared when the turn
  ends. 1830 allows brown-zone companies, from the IPO only with the option, which
  the opening records in the state because rules see only state.
- **Private sales between players reuse the purchase offer.** The family's
  negotiated purchase (a company buying a private or train with its owner's
  consent) gains a player buyer. `StockRules.privateSales` names when a player may
  buy another player's private and its price bounds. The buyer's
  `OfferPrivatePurchase` creates the offer during their stock turn; the seller
  answers with the shared `RespondToPurchaseOffer` and prompt while the buyer's
  turn waits. Acceptance transfers the private and the cash and counts as the
  turn's purchase. 1830 allows it from the second stock round, for any privately
  agreed price of at least $1, except for B&O; its privates all close at phase 5,
  so no separate phase check is needed. A buyer over a holding limit may only
  sell, as in the reference, and the purchase must fit the buyer's certificate
  limit, which the printed rules require where the reference instead forces sales
  afterwards.
- **Emergency train purchases from other companies move to slice 5.** They belong
  to train funding, not the stock turn, and must precede replaying the recorded
  games.

### Limits after slice 3

- A buyer cannot withdraw a private purchase offer; the owner answers it.
- Standing buy instructions still buy one share per turn.
- The offer form starts at the minimum price, not the private's face value, which
  the family state does not hold.

### Acceptance examples

- An 1830 player sells, buys, then sells again in one turn, and sells the same
  company twice with the price moving each time; 1889 and TOP keep their order.
- In the brown zone a player buys several market shares of one company; a share of
  another company, a company started that turn, or (without the option) an IPO
  share ends the run.
- With the option, brown IPO shares can be bought several at a time.
- A player offers to buy another player's private; the seller accepts and both
  cash and private move, or declines and the buyer's turn continues. Neither is
  possible in the first stock round or for B&O.

## Slice 4 design: private powers

Slice 4 gives the six privates their reference powers and awards: C&A's PRR
share, B&O's presidency and par, B&O closing on its railroad's first train,
C&StL's extra lay, D&H's lay and station, and M&H's exchange for an NYC share.

### Evidence

The reference's [entities] define each private's abilities.

- **C&A** has a `shares` ability for `PRR_1`: the first buyer receives one PRR
  share free when the auction awards the private. The share counts as sold
  towards PRR's float and may be kept or sold under the ordinary rules.
- **B&O** has `shares` for `B&O_0`, the president's certificate. The auction
  then waits for its owner to set B&O's par before anything else happens. B&O is
  the last lot of the waterfall, so in practice the par comes just before the
  first stock round. B&O also has `close` `when: 'bought_train'` for the B&O
  railroad, which closes it on any train the railroad buys (from the depot or
  another company), and `no_buy`.
- **C&StL** has `tile_lay`, `owner_type: 'corporation'`, `when:
'owning_corp_or_turn'`, on B20 with tiles 3, 4 or 58, once. The lay comes in
  addition to the ordinary lay, needs no connection, and costs nothing (B20 has
  no terrain).
- **D&H** has `teleport`, `owner_type: 'corporation'`, with tile 57 on F16. The
  lay is the company's ordinary lay for the turn and pays F16's $120 mountain.
  The company may then place its next station on F16 free and without a
  connection, and that station is the turn's station. The station can be
  declined.
- **M&H** has `exchange`, `owner_type: 'player'`, `when: 'any'`, for an NYC
  share from the IPO or the market. The exchange is subject to the ordinary
  60% holding limit, is allowed before NYC has a par, and closes M&H.

### Family survey

The new family mechanisms were checked against the
[title traits](/workspace/research/18xx-2026-09-08/data/title-traits.json) and
the reference source.

- **Pending par** (`interrupting-decisions` = `pending-par`) appears in 39 titles,
  among them 1826, 1832, 1849, 1880, 1882, 18Chesapeake, 18Mex and 18NY. The
  family hook covers awards made by the waterfall auction; titles that award a
  presidency in another opening would wrap that opening's states the same way.
- **Closing a private on a train purchase** (`close` `when: 'bought_train'`)
  appears in 25 titles. Each names one corporation, as 1835 (SX), 1848 (CAR) and
  18NY (D&H) do, so a per-company list of privates fits all of them.
- **Remote lay with a station** (`teleport`) appears in 11 titles. 1830, 1836jr30,
  1894, 18Chesapeake and 18Texas match 1830: the company's own next token, free,
  as the turn's station. Counterexamples the hooks do not yet cover: 1822 and
  21Moon make the token an extra action (1822 also adds a token rather than
  using the company's), and 1828, 1829 and 18Rhl waive the lay's terrain cost.
  Those would need further optional terms.

### Decisions

- **Awards are title code.** 1830's auction `award` gives the private, then C&A's
  PRR share or B&O's president's certificate, through the family's
  `awardCertificates`, as TOP does.
- **An awarded presidency is parred at once.** `CompanyRules.parAfterAward`
  opts a title into the family's pending par. The award records `pendingPar`
  (company and player), an optional family field. The waterfall auction then
  holds in its current state while a wrapping handler offers only that
  player's `ParCompany` action, which chooses a starting space from
  `startMarketSpaces`. The action starts the company and makes the player
  president without a purchase, so the title's `onStart` purchase hook does not
  run. The auction then resumes, completes and starts the first stock round.
  Titles without the option register neither the wrapper nor the action; the
  optional `pendingPar` field is in every title's state schema but only written
  by titles with the option.
- **Closing on a train purchase is a train rule.**
  `TrainRules.privatesClosedByPurchase` names the open privates that close when
  a company buys a train. The family applies it to depot purchases, private-power
  train purchases and accepted intercompany offers. 1830 names B&O for the B&O
  railroad.
- **C&StL uses the family's private tile lay.** Its `trackTerms` apply while the
  company that owns C&StL is operating, in any operating step. The lay is free
  and unconnected, and the operating company is the payer.
- **D&H extends the private tile lay.** `PrivateTrackTerms.countsAsOrdinaryLay`
  makes the lay the company's ordinary lay, so 1830 offers D&H only before the
  company has laid a tile this turn. `PrivatePowerRules.stationPrivateIds` names
  the privates whose lay is followed by a station decision, which registers the
  station actions for those titles only. The decision is a new optional family
  field, `privateStation`. The president answers it with `PlacePrivateStation`
  (the company's next station on any open slot of the laid tile, free, no
  connection) or `DeclinePrivateStation`. A placed station opens the turn's
  station step with that station already placed, so the station step has no
  placement left. The decision is skipped when the company has no station left
  or the tile has no open slot.

- **M&H uses the family exchange.** Its `exchangeTerms` offer NYC's single
  shares from the IPO and the market, `any-turn`, with no stock action and the
  ordinary holding limit. 1830 sets `outOfTurnPrivatePowers`, so the exchange is
  also offered between other players' and companies' turns.
- **Interface.** A shared par prompt replaces the auction panel while a par is
  pending, with the starting prices as market-coloured buttons. The D&H station
  is chosen by clicking F16 on the map, with a Decline button; the track picker
  gives up map clicks while the decision is pending. The other powers use the
  existing private-lay and exchange controls.

### Limits after slice 4

- Private cards describe the powers in text only; there is no title artwork.

### Acceptance examples

- The C&A winner owns `PRR:share:1` without paying more, and it counts towards
  PRR's float.
- The B&O winner owns B&O's president's certificate and must set B&O's par
  before the first stock round. The par starts B&O with that player as president
  and no cash moved.
- B&O's first train purchase, of any kind, closes the B&O private.
- A company owning C&StL lays tile 3, 4 or 58 on B20 without a connection, in
  addition to its ordinary lay.
- A company owning D&H lays 57 on F16, which uses its ordinary lay and pays $120,
  then places a free station there that uses its station placement, or
  declines it.
- The M&H owner exchanges it for an NYC share in their stock turn, between
  turns, or during an operating round, within the 60% limit.

[game]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1830/game.rb
[meta]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1830/meta.rb
[entities]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1830/entities.rb
[map]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1830/map.rb
[stock]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1830/step/buy_sell_par_shares.rb
[auction]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/step/waterfall_auction.rb
[hex-lay]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/hex.rb#L115-L291
[home-token]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/base.rb#L1684-L1735
[stock-step]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/step/buy_sell_par_shares.rb
