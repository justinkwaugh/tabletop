# Evidence for a durable 18xx tile library

## Survey coverage

Surveyed all 16,171 assignments in [the title-trait dataset](/workspace/research/18xx-2026-09-08/data/title-traits.json), selecting 2,892 assignments across 14 construction, supply, station, network, route, and resource traits. These cover 128 classified profiles of 131 recorded title profiles. Reviewed the three remaining profiles' unresolved records: 18WE, 18West, and 2038 have incomplete implementations; their inherited defaults are not verified tile rules. Reviewed the [tile/routing comparison](/workspace/research/18xx-2026-09-08/notes/tiles-routing.md) and [mechanism study](/workspace/research/18xx-2026-09-08/18xx-domain-model-study.md#traits-track-tiles), then inspected primary source for the examples below. This is a family-wide variation survey, not an audit of every printed tile or every definition. All source links pin `715567bdc7e5cc68a68a286b21dc8edd1a125e50`.

## Shared numbers are useful, but not globally unique definitions

**Observed:** TOP and 1889 directly reuse 18 numeric entries from the [shared catalog][catalog]: 3, 5, 6, 7, 8, 9, 16, 25, 28, 29, 39, 40, 41, 42, 45, 46, 47, 58. Their [manifests][top] assign separate quantities: TOP has 12/25/1 of #7/#8/#9; [1889][shikoku] has 2/5/5. These are identical shared definitions with independent game inventories.

**Actual collision:** [1889][shikoku] uses shared brown #611. [1832 overrides #611][collision] with the same city, revenue, slots and paths **plus label Y**. The label affects upgrade semantics. A global lookup keyed only by printed number would silently give one game the wrong definition. [Initialization][init] explicitly supports both shared-number lookup and title-supplied color/code under a number.

**Same topology, different definition:** Shared #14 and TOP PEI1 both have a two-slot city connected to edges 0,1,3,4, but revenues are 30 and 20. Sharing drawing geometry is valid; collapsing their economic identity is not. [Catalog][catalog]; [TOP][top]. 1889's source also declares `Beg7` with the same path as #7: internal identifiers need not equal an edition's printed numbering.

**Design inference:** retain a stable qualified definition ID, visible printed identifier/aliases, and source/edition provenance. Titles select shared definitions or explicit variants. Search and display numbers naturally; never treat a familiar number as proof of complete semantic equality.

## Distinctions the foundation should preserve

| Concept                         | Evidence and implication                                                                                                                                                                                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog definition/face         | Immutable description of paths, nodes, capacity, values, labels and relevant markings; many pieces can use it. Shared [catalog][catalog] and custom [initialization][init] establish both reuse and overrides.                                                                                                  |
| Physical piece and inventory    | Counts belong to a game. Opposite faces can be one resource: [double-sided accounting][paired] removes both alternatives when either is placed and restores them on return. Unlimited and conditional inventory are also represented in the survey.                                                             |
| Placement                       | A particular piece/face on a stable map location, rotated by a specific amount. [Tile source][tile] separately holds name, index, rotation, preprinted status, hex, reservations, and opposite face. Our design need not reproduce its mutable class structure.                                                 |
| Map facts and persistent rights | Original terrain, locations, stations, reservations, assignments and replacement effects cannot all be immutable face data. [Hex replacement][hex] migrates cities/tokens/reservations; changing a face does not create a new geographical location.                                                            |
| Semantic topology               | Explicit internal nodes and paths, edge/lane endpoints, terminal behavior and path types. [Path source][path] matches lanes/types; graphical crossings alone do not define intersections.                                                                                                                       |
| Visual geometry                 | Coordinates, curves, spacing and text placement render that topology. [Track geometry][geometry] chooses curves/regions; [tile rendering][render] composes track, stops, revenue, labels and overlays. A renderer may reuse geometry across distinct definitions while preserving their values and identifiers. |

## Family checks that affect both model and rendering

Surveyed assignments include finite/unlimited/conditional supply and five paired-face profiles; multiple cities and future reservations; gauge conversion; track destruction/downgrades; extended color sequences; parallel lanes; water and feeder networks; train/phase-dependent values; and resource-linked locations. Keep these as extension checks rather than implementing every procedure immediately.

Representative primary checks: [18ESP map][esp] explicitly has dual-gauge parallel lanes and lane-specific endpoints. [18Norway][norway] uses source `narrow` paths for ships, illustrating that stroke appearance/source terminology must not dictate universal train compatibility. [Double-sided utility][paired] establishes shared physical supply. [Tile decoder][tile] includes labels, future labels, location hints, icons, borders, partitions and multiple node kinds. These are reasons to avoid a renderer consisting only of six edge connections and one central city.

## Recommended durable deliverable

**Design inference:** make the reusable tile model, initial numbered catalog and SVG rendering library deliberate early assets in `18xx`/`18xx-ui`. Use Common hex geometry underneath. Build a tile gallery that shows TOP/1889 inventories, identifiers, rotations and overlay examples, with representative family fixtures for lanes, paired faces and same-number variants.

**Project decision:** export the tile-library viewer itself as a lasting component
from `@tabletop/18xx-ui`, usable for standalone catalog inspection and embedded title
tile browsing. Only the thin development host page may be disposable. Retain the
viewer, verified definitions, renderer and semantic-to-visual correspondence checks.
Catalog inspection does not require game state; title subsets and optional inventory
are supplied by the caller. T2 establishes the viewer; T3 adds verified title sets
and supply information.

Acceptance should demonstrate all six rotations, matching path endpoints/hit targets, readable identifier/value/label placement, shared definitions with independent stock, #611 variant isolation, and state-free catalog reuse. Cosmetic redraws must not change route legality; semantically distinct paths must remain selectable even where curves cross. Construction legality, game-specific upgrades, inventory mutation, and route policies remain consumers of the foundation. Responsive final game-screen composition can be designed later without replacing this tile library.

[catalog]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/config/tile.rb
[top]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1871/tiles.rb
[shikoku]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1889/map.rb
[collision]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1832/map.rb#L117-L121
[init]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/base.rb#L2834-L2870
[paired]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/double_sided_tiles.rb
[tile]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/tile.rb
[hex]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/hex.rb#L72-L206
[path]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/part/path.rb
[geometry]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/assets/app/view/game/part/track_node_path.rb
[render]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/assets/app/view/game/tile.rb
[esp]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_18_esp/map.rb#L779-L781
[norway]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_18_norway/game.rb#L285-L291
