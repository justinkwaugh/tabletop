# Tile rendering and library viewer (T2)

The package exports `Tile`, `TileArtwork`, `TileLibraryViewer`, `createTileDrawing`,
layout/drawing types, and two appearance presets. These assets have no Game Session
dependency. The [visual contract](ui-interaction-visual-contract.md) owns their
interaction and overlay semantics.

## Using the library

```svelte
<script lang="ts">
    import { StandardTileCatalog } from '@tabletop/18xx'
    import { Tile, TileLibraryViewer, MutedTileAppearance } from '@tabletop/18xx-ui'

    const tile = StandardTileCatalog.get('18xx:14')
</script>

<Tile
    face={tile.face}
    printedNumber={tile.printedNumber}
    rotation={1}
    appearance={MutedTileAppearance}
    size={160}
/>
<TileLibraryViewer tiles={StandardTileCatalog.entries()} />
```

A viewer accepts any catalog selection as a readonly definition array. It exposes
search, color/track/stop filters, rotations, flat/pointy orientation, Classic/Muted
style choices, and enlarged inspection. Optional `onchoose` receives only an
explicit Use tile choice: `{ definitionId, rotation }`. It does not create Actions.
Custom appearances can be passed directly to `Tile` or `TileArtwork`.

`Tile` accepts unnumbered faces for printed map content. `TileArtwork` renders an
SVG group for composition in a board SVG, using the result of `createTileDrawing`
for the same face. Both support track and object overlay snippets. See the
development specimen page for an example using rotated path and token-slot positions.

Layout coordinates use the canonical flat hex, centered at zero with radius 50.
The drawing applies orientation and rotation consistently. Explicit node positions
are required for faces with multiple nodes; there is no generic guess about which
city belongs where. Optional path controls and annotation positions solve dense
layouts without modifying the logical definition. Single two-edge towns receive a
continuous curve, split into identifiable logical paths at the town.

`revenuePositionsByOrientation` and `revenuePositionsByRotation` can override
individual revenue positions while keeping automatic placement elsewhere.
Orientation hints take precedence over rotation hints, then base revenue hints.
These hints use the same canonical coordinates as other layout positions.
Revenues are placed before automatic labels. Circular revenues use corners, with
more clearance for cities containing three or more slots in either orientation.
Tile numbers appear in viewer metadata and accessible names, not in tile artwork.

Ordinary edge-to-edge track uses circular SVG arcs with tangents perpendicular to
the hex edges. Opposite edges use straight lines. Two-edge towns split the same
circle into two identifiable arcs. Explicit path controls and paths to positioned
nodes use cubic curves. Annotation clearance samples the actual path geometry.
The geometry is independently constructed from our model and Common hex geometry.
Style presets change colors, stroke weight, and town
marker treatment. They do not select a different rule model or color progression.
Classic uses through-town bars; central towns and Muted use dots. Unknown color keys require a supplied
palette entry rather than silently receiving an unrelated fill.

## Family design review

The [family-wide tile survey](../../research/18xx/tile-library-evidence.md) remains
the requirements baseline: independent paths versus junctions, multiple cities,
same-number variants, varying token capacity, labels and staged revenue, longer
color sequences, lanes/gauges/terminals, paired supply, and map-owned rights.
The renderer supports T1's single-lane face vocabulary. Unsupported logical
mechanisms must first be modeled explicitly; a drawing style cannot invent them.
Halts, gauge/lane markings, partitions, and future labels remain later extensions.

Colors are presentation data keyed by semantic color names, not a four-color
upgrade algorithm. Caller-supplied layout handles different city arrangements;
caller-owned overlays keep map names/tokens/routes outside catalog definitions.
Same-number definitions remain separate viewer entries. The initial TOP additions
cover green/brown T, green/brown/gray X, and gray CX with up to three token spaces.
The gallery also includes separate-city and staged-revenue layout examples.
[T3](../18xx/inventory.md) adds both complete title sets, the beginner inventory,
optional caller-supplied `inventory` counts, port artwork, face-upgrade costs,
preprinted tiles, and prepared replacement examples. Unlimited supply remains deferred.

`StandardTileLayouts` contains shared visual hints keyed by qualified definition
ID. The viewer uses these by default. Direct `Tile` callers pass the appropriate
layout when rendering a definition that needs it. `townTrackPositions` moves a
town along its unchanged circular track using a fraction from the first endpoint;
#56 uses mirrored outer positions, outside the other track's circle, with mirrored
revenue badges. Independent two-edge towns
can derive their own track positions without manual node coordinates. Central
junction towns use round dots in both styles, while Classic through-town markers
remain bars.

Visual references reviewed:

- Supplied Shikoku 1889 rulebook, page 29: actual printed track curves, city
  groups, town dots, revenue, and identifiers.
- [The user's older tile views](https://github.com/justinkwaugh/18www/tree/master/web/views/tiles):
  white-bordered black track and title-specific city arrangements.
- [18xx Maker's rendered tile gallery](https://18xx-maker.com/elements/tiles):
  the leading reference for Classic's bold track, town bars, revenue badges, and
  compact identifiers; it also demonstrates useful variation in palette and layout.
- The pinned research renderer described in the family evidence note: visual
  separation of track, stops, annotations, and map-owned overlays.

These references establish visual expectations. No external renderer code,
templates, paths, or assets are copied or translated. The local implementation is
Svelte, TypeScript, SVG, and Common geometry. Reference links belong in this document,
not implementation or tests.

## Running and checking

The gallery is a separate app at
[`apps/18xx-playground`](../../apps/18xx-playground/README.md). It owns title imports,
collections, routes, and title integration/browser tests. Shared libraries have
no game dependencies, including development dependencies. The app consumes the
library's public exports; no game or app source enters the library build.

```sh
pnpm --filter @tabletop/18xx-ui check
pnpm --filter @tabletop/18xx-ui test
pnpm --filter @tabletop/18xx-ui build
pnpm --filter @tabletop/18xx-playground dev
pnpm --filter @tabletop/18xx-playground test
```

The gallery runs at port 4188. `/` provides standalone catalog inspection;
`/specimens` shows all six rotations and board-overlay composition. The development
host and title fixtures belong to the app, outside the shared library package.
Browser checks use Playwright Chromium; unit checks cover endpoint geometry and
filter semantics. Visual review is required alongside geometry tests: screenshots
alone do not establish logical connectivity.
