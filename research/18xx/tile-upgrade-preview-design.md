# Tile upgrade preview

A player taps a hex track has reached and sees, in a ring like the track-laying picker's, every
tile that may one day upgrade it; trying one lays it on the hex as a preview and adds its own
upgrades to the ring, colour after colour. Nothing is an Action. The logic is
`TrackConstruction.futureLays`, `hasFutureLay`, `meetsTrack` and the `placementRestriction`
hook (`libs/18xx/src/construction/trackConstruction.ts`); the UI is `TilePlanModule` and
`TilePlanPicker` in `libs/18xx-ui`.

## Surveyed

- The research package (`/workspace/research/18xx-2026-09-08`): `18xx-domain-model-study.md`
  "Track construction and physical tile supply" and its trait table; the `title-traits.json`
  traits `upgrade-preservation` (paths-and-stops-preserved, specified-upgrade-transformations,
  gauge-conversion, extended-color-sequence), `tile-supply` (finite, unlimited, paired faces,
  conditional inventory), `destructive-map-changes`, `construction-usefulness`,
  `construction-allowance`, `construction-connectivity` and construction `power-effect-families`;
  `18xx-shared-engine-design.md` §6 "An upgrade preserves rights as well as track";
  `notes/tiles-routing.md` "What tile definitions can express"; and the upgrade-check extracts in
  `data/trait-track-trains-complete-upgrades.txt`.
- Every `TrackRules` hook of the 23 implemented titles (all but South African Railroads),
  classified as permanent (the hex, the tile, its rotation and node mapping, and the tile it
  replaces) or as depending on the game (phase, round, turn, company, ownership, privates,
  events, markers, cash, this turn's lays).
- The multi-hex pieces of 18MEX (Mexico City–Puebla) and 18RoyalGorge (the green and brown
  gorge), through `companionTiles` and the map views' `tileGroups`; the catalogue lists no other
  title's multi-hex tile.

## Variations and counterexamples

- Legal only from a phase or event (1856 town upgrades in gray, 1849 Messina's earthquake,
  1894's purple-phase green cities, 18Rhl Osterath before phase 5, 18USA's colour skips from
  phase 5, 1858 mountain tiles): these stay in `restriction`, so the preview offers the tile;
  a rule that ends a tile's legality later (18Rhl, 1858) would make the preview offer a tile the
  game no longer allows, which no implemented title has.
- Depending on neighbours or ownership (18NY tile 448 needs four neighbours, TOP's tile 9 needs
  the SBC owner, 1822 Africa's reserve tiles): neighbour rules that never change could join
  `placementRestriction` by reading the map; ownership stays in `restriction`.
- Rotation changing after placement (18USA's Denver workaround), colour skips and any-colour
  upgrades (1825, 18GB, 18ZOO, 18Texas, 18Hiawatha, 21Moon, 1840, System18 colours): the
  preview offers colour by colour from the title's colour order, so a direct skip is reached one
  level later rather than in the first ring.
- Label changes (1862, 18Mag, 1868WY, 18OE, 1880's OO) and reconfiguring upgrades (1873, 1840,
  18JP-T, 1847AE, 1829, 18NY, 18Neb, 18FR, Steam Over Holland) pass through the shared
  replacement test and `reconfigures`, as real lays do.
- Destructive map changes (1837, 1849, 1882, 18FL, 1868WY) restore printed tiles; the preview
  starts from the current board, so it follows them.
- Paired faces and conditional inventories (18Cuba, 18ESP, 18Mag, 18Carolinas, 1868WY; 1824,
  1825, 1841, 1873, 18GB, 18Tokaido) decide only which tiles are dimmed.
- Evidence gaps: 18WE, 18West and 2038 are unresolved for every construction trait; fixed printed
  rotations and preserved printed stubs have no dedicated trait, only the general rotation and
  preservation checks.

## Shared behaviour and title choices

- A lay offered by `futureLays` passes the shared replacement test with the full colour order,
  keeps the hex's track, keeps its track on the map, across passable borders and onto fixed
  hexes' track, and passes the title's `placementRestriction`. It ignores `allowance`,
  `availableColors`, `restriction`, reach and cash, so later phases' tiles are offered.
- `placementRestriction` holds a title's permanent rules, and real lays check it before
  `restriction`, so play and preview cannot disagree. Rules permanent only from a phase (18USA's
  empty city from phase 5, 1832's medium cities from phase 3) stay in `restriction`; so do tiles
  laid only through a private or event power (18RoyalGorge's specials, 18USA's Company Town and
  RHQ, 1889's port, 18MEX's Copper Canyon, 1817's X00), which the preview offers on purpose.
- Titles moved rules: 1822 (London unrotated), 1828 (the tunnel's #4), 1832 (Tampa has no
  brown), 1833ne (arrow tiles unrotated), 1850 (Chicago's yellow), 1860 (fixed rotations,
  Cowes), 1867 and 1880 (printed stubs), 1894 (Paris keeps city 0), 18MEX (pair tiles from
  Mexico City, unrotated), 18RoyalGorge (gorge tiles, Salida) and 18USA (B tiles, New York).
  No private power had been exempt from a moved rule.
- A tile the supply has run out of is offered without a placement, shown dimmed and never
  tried. `mostExits` ranks only tiles the supply still has, as a real lay's
  `hasMoreExitsElsewhere` does.
- A piece covering several hexes is planned from the hex its title lays it from; its companions
  come from `companionTiles`, which takes only the hex, tile and rotation, and need tiles in the
  supply too. 18RoyalGorge's green gorge, which the treaty lays across all three hexes at once,
  is a piece as well, so the preview never shows a part-green gorge.
- A lay is offered when any way of keeping the replaced tile's stops passes
  `placementRestriction`, as real lays try every node mapping (1850's Chicago, 1894's Paris).

## Considered for later

- Stations: whether a hex's stations fit the upgraded tile is not judged.
- The preview during the player's own track step: undecided, so it is not offered there.
- 18USA's direct colour skips from phase 5 are not shown in the first ring; the same tiles appear
  one colour later.
- `hasFutureUpgrade` (station facing) still asks a narrower question without borders; it was
  left as it is to keep play unchanged.

## Examples

`tilePlanModule.svelte.spec.ts` covers the hexes a plan may open on, trying and turning tiles,
closing, a run-out tile, a forbidden rotation, most exits among supplied tiles, a two-hex piece,
closing while another map choice is open, and a rotation offered through any passing node
mapping. The titles' rule specs keep each moved rule.
