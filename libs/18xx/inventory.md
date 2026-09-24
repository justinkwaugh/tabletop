# Title tile sets and physical supply (T3)

`TileSet` resolves a title's manifest into immutable shared definitions and stable
physical pieces. It creates and validates serializable inventories, reports
availability, and applies a prepared tile replacement atomically. Catalog identity,
physical piece identity, and map location identity remain separate.

## Interface and ownership

- `TileManifest` contains a set ID and entries with independent counts and one or
  two face-definition IDs. Two faces consume one physical piece. Counts are positive integers or `unlimited`; conditional supply remains title-owned.
- `TileSet.definitions` retains the frozen definitions owned by its catalogs.
  Title sets reuse the same shared definition objects. `pieces` gives each finite copy
  an identity within the selected set. Callers do not parse those IDs.
- `createInventory()` returns a new inventory for one game. Its placements refer
  to a location, physical piece, selected face, and rotation. Retired pieces are
  separately recorded. Availability is derived, never maintained as a second
  mutable count that could drift from placement state.
- `parseInventory(value)` validates schema, set membership, face ownership, and
  unique physical occupancy before returning an independent copy.
- `counts(inventory)` reports total and available pieces per definition.
  Opposite faces report availability of the same pieces; summing those face
  counts is not a physical-piece total. `pieces.length` is the finite-piece total; unlimited counts use the literal `unlimited`.
- `availablePieces(inventory, definitionId)` gives eligible supply references, including one deterministically allocated free identity per unlimited entry. Returned identities are reused; placed and retired identities are never allocated again until returned.
- `replace(inventory, { locationId, placement, returnPrevious })` returns a new
  inventory. It rejects unavailable pieces and mismatched faces before changing
  anything. A returned piece restores availability for all its faces. An old
  piece can instead be retired. Reorienting or flipping the same placed piece
  neither creates stock nor retires itself.

The caller has already prepared this exchange. Construction legality, operating
permissions, cost payment, upgrade topology, and station migration belong to later
Actions and rules. The inventory module does not infer legality from colors or
numbers. It never receives or rewrites terrain, location names, reservations,
tokens, or persistent map rights. A preprinted tile belongs to its map location and
does not enter the supply when covered.

## Family design review

Reviewed the [full-family tile survey](../../research/18xx/tile-library-evidence.md),
the [tile/routing comparison](/workspace/research/18xx-2026-09-08/notes/tiles-routing.md),
and all 922 assignments across tile supply, destructive map changes, station
placement, and station blocking in the [trait dataset](/workspace/research/18xx-2026-09-08/data/title-traits.json).
They cover 128 classified titles; the three unresolved profiles remain evidence
gaps. Supply assignments include 123 finite, 37 unlimited, 12 conditional, five
paired-face, and two not-applicable records; these categories overlap.

| Asset                   | Variation considered                                                                                  | T3 decision                                                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog and manifest    | Same numbers may differ by title; identical definitions have independent counts.                      | Qualified definition IDs; title-owned manifests; standard and beginner sets are separate.                                                                                                                       |
| Physical inventory      | Paired tiles in 18Cuba and other paired-face profiles; finite, unlimited, and conditional supply.     | Implement finite and unlimited single/paired pieces. Do not simulate unlimited stock with an arbitrary large count.                                                                                                           |
| Replacement             | Ordinary returns, destroyed/removed track in 1849 and 18FL, persistent stations and map rights.       | Explicit return/retire choice; immutable exchange result; leave rule and map consequences to callers.                                                                                                           |
| Stops and artwork       | Separate towns, junction towns, labeled cities, ports, face-dependent costs.                          | Explicit node identity; derive separate through-town positions from their own tracks; junction towns are round dots. Port symbols and upgrade costs are face data, independent of map-owned terrain and rights. |
| Viewer and map examples | Definitions versus available pieces, same-number variants, paired alternatives, and preprinted tiles. | Optional caller-supplied counts; no inventory mutation from browsing. Preprinted tiles and replacement stages are inspection fixtures, not a game-screen design.                                                   |

Tile #437 carries a port symbol. #438 and #439 each carry a cost of 80 to upgrade
that face; #492 does not. This cost must not become a permanent location charge.
Conversely, the location's original terrain and persistent rights must not be
erased by replacing its face. The scalar `upgradeCost` records this demonstrated
case; conditional construction pricing remains later rules work. The `symbols`
field uses semantic names, with port rendering implemented now. Unknown renderer
symbols fail explicitly. Gauges, lanes, terminals, and general symbol artwork
remain outside this slice.

## Verified title coverage

| Set                    | Definitions | Physical pieces |
| ---------------------- | ----------: | --------------: |
| TOP current prototype |          62 | Mixed finite/unlimited |
| Shikoku 1889 standard  |          40 |              63 |
| Shikoku 1889 beginner  |          40 |              71 |

The shared catalog now has 65 definitions, including the earlier junction
specimen #81. TOP adds all sixteen PEI definitions and four yellow labeled city curves. The two actual title sets
share 18 definitions. The gallery also retains separate synthetic layout examples
and the documented 1832 #611 variant; those are not added to either game's supply.

All selected shared and TOP special definitions were independently checked for
color, revenue, station capacity, labels, symbols, and unordered semantic
connections against the pinned definition evidence. Every standard inventory
entry and count was reconciled. The 1889 rulebook's page 29 manifest agrees with
the 40 standard definitions and 63 pieces.

The 1889 rulebook §14.1 and page 29 explicitly add eight beginner pieces:
2 × #6 and 1 × each of #7, #8, #9, #23, #24, and #57. The pinned implementation
omits the beginner #57. T3 follows the supplied rulebook and reuses the standard
definitions with additional physical copies instead of inventing different faces.

TOP's older prototype rulebook provides the T/X/CX restrictions but no comparable
complete count manifest. The current prototype follows the requested September 16 supply revision: yellow tiles are unlimited except #9 (one) and double-dit #1/#56/#630–633 (two each). Yellow X/T tight and gentle cities pay 20 and match X/T locations starting in yellow. This title-owned revision does not change 1889 supplies or other researched titles. It is not a claim that a later physical edition has been reconciled.

Evidence: [1889 rulebook](</workspace/Shikoku 1889 Rulebook.pdf>),
[TOP comparison](/workspace/research/18xx-2026-09-08/top-rulebook-comparison.md),
[shared definitions](https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/config/tile.rb),
[TOP manifest](https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1871/tiles.rb),
[1889 manifest](https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1889/map.rb).
Research code supplied factual evidence, not implementation templates. These
classes, schemas, algorithms, and SVG assets were designed for this repository.
No source references appear in implementation or tests.

## Verification

Logic tests cover independent inventories, paired faces, returned and retired
pieces, rejected partial exchanges, serialization, set/face identity, and preserved
map-owned facts. Title tests check full counts and specials. Both titles provide
representative immutable preprinted tiles; complete semantic maps remain M1.
The specimen page shows a preprinted tile, a placed #5, and a replacement that returns
#5 to supply for each title. Browser checks cover full title selection, counts,
beginner extras, symbols, and every catalog tile in six rotations, two
orientations, and both appearances.

Unlimited supplies preserve the existing serialized inventory shape and stable ID format.
Previously allocated finite IDs remain valid when their entry becomes unlimited.
Logic and UI artifacts consuming the changed manifest/count contract must be published together.
Tests exercise more copies than the former stock, paired faces, retirement, reuse,
serialization, finite exceptions, and yellow X/T construction before green availability.
