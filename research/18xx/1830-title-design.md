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
5. **Routes and verification:** offboard groups (Canada A9/A11, Gulf I1/J2) in
   route validation and the autorouter encoding, then replaying the recorded games.
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
title needs them. Multi-city faces (54, 59, 62, 64–68) and multi-town faces (2,
55, 69) get explicit node layouts in `standardTileLayouts.ts`. The renderer
already refuses to guess multi-node positions. Each new face is checked so its
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
  4, 5 or 6 from phase 6. Phase 2 allows interplayer private sales; that status
  is recorded but its action comes in slice 3.
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

## Intentional limits after slice 1

- Erie cannot be started (slice 2).
- Stock turns are sell-then-buy or buy-then-sell, one purchase per turn (slice 3).
- Private companies have no powers or awards (slice 4).
- A route may count both hexes of Canada or of the Gulf (slice 5).

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

[game]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1830/game.rb
[meta]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1830/meta.rb
[entities]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1830/entities.rb
[map]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1830/map.rb
[stock]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1830/step/buy_sell_par_shares.rb
[auction]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/step/waterfall_auction.rb
