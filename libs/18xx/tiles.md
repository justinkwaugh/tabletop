# Tile foundation (T1)

The tile library supplies semantic faces, a catalog of numbered definitions, and
rotation/endpoint queries. It has no rendering or Game Session dependency.
T1 introduced specimen selections. [T3](inventory.md) now supplies complete TOP
and 1889 title manifests, physical inventory, and representative preprinted tiles.

[Preprinted tiles](CONTEXT.md) belong to map locations. Their content uses the
same `TileFace` model as supply tiles, without a physical supply-piece identity.

The implementation follows this repository's TypeBox schemas, immutable catalog
data, explicit endpoint records, and Common hex types/utilities. Research informed
the tile facts and variation checks. No external tile decoder, mutable part-class
hierarchy, or graph implementation was copied or translated into T1. Future slices
follow the same [independent design rule](../../docs/agents/18xx-design.md).

## Research and design scope

The [family-wide evidence survey](../../research/18xx/tile-library-evidence.md)
covers all recorded title profiles, including known evidence gaps. Its inventory,
track, station, routing, and resource comparisons inform every asset here:

| Evidence                                                                                     | Decision in T1                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TOP/1889 reuse #7/#8/#9 with different quantities.                                           | Shared immutable definitions; title specimen arrays reference the same objects. No quantities on definitions.                                                                                                                  |
| 1832's #611 adds Y to the standard #611.                                                     | Qualified catalog IDs are distinct from printed numbers. Number/alias lookup returns all matches. A conformance fixture preserves both definitions.                                                                            |
| TOP PEI1 and standard #14 have matching paths but different revenue.                         | TOP owns PEI1. Geometry equivalence cannot collapse catalog identity or stop values.                                                                                                                                           |
| Multiple cities, towns, offboards, and junctions occur across the family.                    | Stable local node/path IDs and explicit endpoint references; junctions have no revenue or station slots. Crossing curves do not introduce a connection.                                                                        |
| TOP's printed G11 has yellow/brown revenue values; longer color sequences occur in System18. | Unnumbered faces reuse the same topology. Colors and revenue-stage keys are title-owned strings, with no built-in color ladder or stage-selection algorithm.                                                                   |
| 18ESP lanes/dual gauge, 1840 terminals, and 18Norway water paths.                            | T1 supports ordinary single-lane, undirected track only. Specialized endpoints/path semantics need an explicit extension before importing these tiles. Do not infer vehicle compatibility from color or future stroke styling. |
| Paired faces, unlimited/conditional supply, persistent map rights, and destructive upgrades. | Physical pieces, supply, map placement, terrain, reservations, and upgrade procedures remain separate consumers. They are not fields on catalog faces.                                                                         |

This work implements the first five rows and preserves the distinctions needed by
the last two without adding unused rule engines. Halts, gauges, lanes, terminals,
future labels, revenue modifiers, borders, partitions, and special markings remain
unsupported except for T3's port symbol and scalar face-upgrade cost. Closed schemas reject extra properties instead of silently discarding
them. The face schema can express the topology of a printed map hex; it does not
claim to describe the whole location. M1 must add map-owned facts and extend the
supported face vocabulary as needed.

Source data is pinned to the research implementation at
`715567bdc7e5cc68a68a286b21dc8edd1a125e50`. Provenance belongs in this document and
the linked evidence note, not in checked-in implementation or test code. The
standard specimens come from the shared tile catalog, PEI1 from TOP's tile list,
the 1832 #611 variant from its map definition, and G11 from TOP's map definition.
TOP's source remains a prototype, not a claim
that the older rulebook and current editions have been reconciled. New edition
differences require explicit catalog variants rather than replacing a definition
under an ID already used by a title.

## Interface

- `TileFace`: rule-significant color, nodes, paths, and labels. A face has no
  printed number, supply, coordinates, tokens, or visual layout.
- `TileDefinition`: a face plus qualified ID, printed number, aliases, and human-readable
  scope. Node and path IDs are local to their face and survive rotation.
- `TileCatalog`: accepts trusted typed definitions, checks topology/ID invariants,
  and owns deeply frozen copies. `get(id)` throws for unknown IDs;
  `findByPrintedNumber(number)` returns all exact number/alias matches in insertion
  order. `entries()` returns a fresh array of the immutable definitions.
- `parseTileFace` / `parseTileDefinition`: validate unknown serialized data against
  TypeBox schemas and topology invariants, then return deeply frozen copies.
  Invalid schemas, duplicate node/path IDs, missing node references, identical
  path endpoints, and duplicate revenue-stage keys throw. Static types are deeply
  readonly; parsing does not modify input.
- `rotateTileFace(face, rotation)`: derives paths with rotated boundary endpoints.
  Internal node references, path IDs, values, and labels remain unchanged.
  `TileRotation` is an integer from 0 through 5, measured in clockwise 60-degree
  steps from the definition. Rotate from the catalog face to apply an absolute
  placement rotation; rotating an already rotated face composes the rotations.
- `tilePathsAtEndpoint`: returns paths incident to an explicit edge or internal
  node. This is topology inspection, not route reachability or legality. Future
  network traversal should use Common graph interfaces with the relevant rule policy.

`TileRevenue` distinguishes fixed values from a schedule keyed by title-defined
revenue stages. The schedule records printed values; it does not choose a stage,
compute route income, or impose ordering on phase names. Station capacity is a
city fact, distinct from current occupancy and future reservations.

## Common hex integration

The explicit `tileEdgeDirection` mapping matches the pinned source's
[`Hex::DIRECTIONS`](https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/hex.rb).
It returns Common direction enums for direct use with `HexGrid`,
`hexNeighborCoords`, and Common geometry:

| Tile edge | Flat      | Pointy    |
| --------- | --------- | --------- |
| 0         | South     | Southwest |
| 1         | Southwest | West      |
| 2         | Northwest | Northwest |
| 3         | North     | Northeast |
| 4         | Northeast | East      |
| 5         | Southeast | Southeast |

The edge opposite an edge is `rotateTileEdge(edge, 3)`. T1 adds no coordinate
system, hex graph, or pixel geometry. Later renderers must use the same mapping;
they must not derive track connectivity from drawn intersections.

## Specimens and verification

`StandardTileCatalog` currently includes 3, 5, 6, 7, 8, 9, 14, 16, 81, and 611.
TOP adds PEI1 in its own package, with T/X/CX specimens added for T2 rendering.
Shared #81 exercises explicit junctions, while
the 1832 #611 variant is a test fixture rather than a new title implementation.
The tests also exercise an unnumbered TOP G11 topology/revenue example and
synthetic separate-city and invalid-input cases.

Run the three package tests after building Common and the family library:

```sh
pnpm --filter @tabletop/common build
pnpm --filter @tabletop/18xx build
pnpm --filter @tabletop/18xx --filter @tabletop/the-old-prince --filter @tabletop/shikoku-1889 test
```

Acceptance covers schema round-trips, all six rotations, node/path identity,
crossing versus junction incidence, same-number variants, immutable catalog data,
shared title references, and neighbor/geometry agreement in both Common hex
orientations. T2 supplies rendering and the tile-library viewer; T3 supplies
complete title tile sets and physical inventory.
