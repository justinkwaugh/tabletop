# @tabletop/18xx

Shared deterministic logic for the 18xx family, built on `@tabletop/common`.
The first implemented module is the [tile foundation](tiles.md): serializable
faces and catalog definitions, explicit variants, rotation, and topology queries.
The [physical supply module](inventory.md) adds complete title manifests,
independent inventories, paired faces, and prepared tile replacements.
The [semantic map module](maps.md) adds immutable geography and preprinted tiles,
using Common hex adjacency. Further models, calculations, Actions, and reusable decision procedures will be
developed alongside TOP and Shikoku 1889.

The first lasting asset is the shared tile model and catalog: reusable definitions,
printed identifiers and explicit variants, composed into independent title tile
inventories and map placements. See the [tile development slices](../../research/18xx/development-slices.md#t1-establish-the-shared-tile-catalog-and-logical-model).

The semantic map also supports lasting rendering: the same locations, terrain,
preprinted track, and live placements can appear on physical-board artwork or in
a generic boardless view. Presentation choice and artwork alignment belong in
the UI; they do not change the railway graph or game rules.

Titles compose the mechanisms they need and own their rule choices, setup data,
special procedures, and `GameDefinition`. This package has no browser or UI dependencies;
serialized Game State and Actions remain JSON-compatible.

Run `pnpm --filter @tabletop/18xx build` to emit JavaScript and declarations into `esm`,
or `pnpm --filter @tabletop/18xx check` to check types without emitting files.
Run `pnpm --filter @tabletop/18xx test` for the tile conformance tests.

## Initial title pair

Every design follows the [18xx design rule](../../docs/agents/18xx-design.md),
considering the relevant functionality across all researched titles. The pair
below supplies the first implementation consumers, not the limit of that review.

[The Old Prince 1871](../../games/the-old-prince/README.md) and
[Shikoku 1889](../../games/shikoku-1889/README.md) are the first consumers. Their
READMEs identify the supplied rulebooks and pinned research source. The following
map identifies candidate shared behavior, not an implemented interface or a
requirement for every title to use every mechanism.

| Candidate module    | Shared behavior                                                                                                  | Differences exercised by these titles                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cash and holdings   | Explicit asset ownership, transfers, identifiable certificates, economic interests, and human decision authority | 1889 has ordinary player shareholdings; TOP also has Union Bank investments and numbered PEIR shares with changing payout fractions.                                                  |
| Stock transactions  | Purchase/sale settlement, presidency exchanges, and separate start, funding, and flotation facts                 | 1889 floats at 50% remaining in the Initial Offering and receives ten times par (rulebook §§7.2.2, 7.4); TOP has reserved exchanges, tranches, and separately funded branches (§6.7). |
| Track and stations  | Hex/path connectivity, physical tile inventory, rotation, and preservation of station rights                     | 1889's ordinary construction step permits one lay or upgrade (§8.3); TOP permits a second yellow lay for a fee, plus title-specific restrictions (§7.2).                              |
| Trains and routes   | Train ownership, route validation, service results, and event consequences                                       | 1889 counts revenue locations (§8.5); TOP distinguishes H-train boundary crossings, later distance metrics, and delayed rusting for eligible 4+ trains (§13.2).                       |
| Dividend settlement | Compute payments and retained income from a service result                                                       | 1889 ordinary corporations pay or withhold (§8.6); TOP also gives PEIR half-pay and rounded payments per surviving right (§7.7).                                                      |
| Decision procedures | Explicit current actor, pending obligations, completion, and continuation                                        | Both need forced train-discard decisions; TOP adds splits and Union Bank choices, while 1889's Ehime Railway power gives its seller a placement decision (§15).                       |

After the tile foundation, cash ownership and certificate holdings provide the
first financial components. A stock-purchase Action can then exercise those components
under each title's eligibility, funding, and flotation rules. Sharing an Action
requires compatible input meaning, validation, and consequences, not just a
matching name. Schemas, hydration, availability, and System Action consequences
will be added together through the existing Game Runtime contracts.

The map foundation is the existing `@tabletop/common`
[`HexGrid`](../common/src/graph/grids/hex/grid.ts), with its `AxialCoordinates`,
`HexDefinition`, orientation/direction types, neighbor lookup, and geometry
utilities. Common also supplies graph traversal and pathfinding interfaces.
The family library adds railway meaning: paths within a tile, edge connections,
station access/blocking, and route legality. Adjacent hexes alone do not establish
a connected railway route. Shared map rendering can use Common's hex geometry.

Existing Common auction, turn, round, phase, and PRNG mechanisms remain available
for reuse where their semantics match. Titles compose decision procedures and
supply differing rules; they do not inherit one canonical 18xx game. Shared
presentation belongs in `@tabletop/18xx-ui`.

The [economic inspection slice](../18xx/finance.md) adds shared financial fields and queries
and portfolio inspection, with title-owned examples in the standalone app.
