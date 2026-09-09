# Semantic maps (M1)

`RailwayMap` holds an immutable, serializable map definition and uses Common's
`HexGrid` for adjacency. A `MapLocation` has a stable game-facing ID and separate
axial coordinates. Its preprinted tile supplies the same track, stop, revenue,
and label model used by movable tiles. The map owns names, construction status,
terrain, borders, home reservations, future upgrade labels, and persistent markers.
Replacing a tile changes the inventory placement, never these original map facts.

TOP supplies 110 locations and Shikoku 1889 supplies 52. Both title packages export
their map and a complete location-to-preprinted-tile index derived from it. The
shared packages contain no title imports. Their schemas and geometry tests use
synthetic maps; the standalone viewer app exercises the title compositions.

## Interfaces and ownership

- `RailwayMapDefinition` is JSON-compatible data; `RailwayMap` validates topology,
  coordinate uniqueness, marker/border identity, and reservation references before
  freezing a private copy. `location` and `neighbor` resolve stable map identities.
- `letterNumberHexCoordinates` and `createLetterNumberLocationFactory` simplify
  conventional title data. A title explicitly supplies orientation, number offset,
  and fixed colors. The factory's home shortcut targets a single `city` node;
  maps with different conventions or multiple cities author `MapLocation` directly.
- Terrain has one cost and one or more kinds, allowing a combined water/mountain
  cost without charging it twice. Kinds are descriptive IDs, not rule dispatch.
  Borders identify an edge and an impassable, water, or mountain boundary, with an
  optional cost. Construction legality and cost settlement are later work.
- Home reservations reference city nodes, independently of currently occupied
  token slots. They describe initial map facts; future runtime state must resolve
  active reservations and any node correspondence after upgrades.
- Future labels specify the tile color at which an upgrade label applies. Markers
  carry stable IDs, visible labels, and descriptive text. Neither enforces private
  company powers or computes whether a restriction is currently active.
- Staged revenue retains explicit stage IDs and values. Rendering can show the
  schedule without a phase engine. The title will resolve current revenue later.

Hex adjacency is geographical only. Railway connectivity needs tile paths, edge
connections, station access, and title rules. There is no route solver, legal lay
calculation, token migration, Game State, Action, or Game Session in M1.

## Family design review

This note covers the map model, title map data, authoring helpers, drawing,
annotations, hit targets, token/route examples, and viewport composition.
The full catalog survey covered 1,631 trait assignments across 128 title profiles
for network types, resource processes, station placement/blocking, upgrade
preservation, destructive map changes, and construction allowance/connectivity.
The 18WE, 18West, and 2038 profiles remain evidence gaps, not negative evidence.
Entry points are the local study's `data/title-traits.json`, `notes/tiles-routing.md`,
and this repository's [tile evidence survey](../../research/18xx/tile-library-evidence.md).

Relevant counterexamples include parallel lanes (16 profiles), broad/narrow track
(11), dual gauge (7), water and feeder networks, future station capacity,
resource locations, persistent rights, destructive upgrades, and boundary or
partition restrictions. Titles without ordinary railway maps must remain able to
use unrelated family mechanisms without instantiating a map.

The resulting choices are deliberately small: map identity is independent of
coordinate labels; both hex orientations use Common geometry; a hex may have many
independent paths/stops; buildability is title data; persistent geography is separate
from a replaceable tile; markers do not imply a resource engine; viewport state
stays outside the model. Token and route presentation consumes explicit node/slot
and path identities instead of treating a hex as one junction.

M1 supports the two initial maps' ordinary track and annotations. It does not yet
model gauges, parallel lanes, internal partitions, grouped offboards, alternate
network types, resource state, or map destruction. These require explicit model
extensions when implemented, rather than pretending marker text supplies their
logic. Physical board images and their alignment remain M2 presentation data.

## Title evidence and verification

The supplied TOP prototype rulebook §§9.1 and 12 and Shikoku 1889 rulebook §§8.3,
9, and 15 establish map features, construction markings, and private powers.
Available track/city figures on page 20 of each rulebook were checked against the
boardless artwork. The complete map facts were independently compared with the
pinned title definitions: [TOP map](https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1871/map.rb)
and [1889 map](https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1889/map.rb).
The comparison covers location sets, colors, names, stop kinds, values, capacity,
track endpoints, labels, future labels, and terrain costs. Rule definitions provide
facts only; this repository's implementation uses its own schemas and Common APIs.

One intentional discrepancy: TOP G11 Malpeque Shipyard has zero station slots.
The supplied prototype rulebook explicitly prohibits tokens while counting it as
a city for routes; the pinned map's default city capacity does not express that
restriction. TOP's older prototype remains the declared edition. No claim is made
that it represents a reconciled current production edition.

Shikoku I4 and F9 record the rulebook's dense urban construction cost. H5 and I6
have a single combined water/mountain cost. TOP future X/T/CX labels and Vernon
River Bridge, and 1889 private-company/port markers, remain inspectable after a
prepared tile replacement. Conditional marker descriptions are reference facts,
not a claim that those restrictions are active in every game state.

Unit tests cover serialization, immutable geography, both coordinate orientations,
adjacency, invalid map data, shared border alignment, placement composition, and
invalid overlays. Browser tests cover both complete maps, edge stations, internal
path/slot identities, terrain and labels, prepared overlays, and desktop/mobile
fit, focus, zoom, and pan. See the [map presentation interface](../18xx-ui/maps.md).
