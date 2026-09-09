# @tabletop/18xx-ui

Shared Svelte presentation and interaction support for 18xx Game Clients, using
`@tabletop/18xx` and `@tabletop/frontend-components`. The implemented
[tile rendering and library viewer](tiles.md) provide reusable SVG artwork,
layout helpers, and standalone/embedded catalog inspection. Further shared
interactions will grow alongside TOP and Shikoku 1889.

The shared SVG tile renderer is a lasting library asset from the start. It consumes
the family tile catalog/model and serves board tiles, inventory thumbnails,
placement previews, and detailed inspection. See the [tile development slices](../../research/18xx/development-slices.md#t2-build-a-lasting-svg-tile-renderer-and-inspection-gallery).

T2 includes an exported, reusable tile-library viewer using that renderer. It
browses the catalog or a title's selected set with search, filters, rotation,
and enlarged inspection, preserving same-number variants. It can serve a standalone
development gallery or an embedded game view without requiring a Game Session.
Classic and Muted appearances share the same semantic geometry.
T3 adds optional caller-supplied inventory counts and full title collections. The viewer is a lasting
component; its development host page may be disposable.

The standalone gallery lives in [`apps/18xx-tile-viewer`](../../apps/18xx-tile-viewer/README.md).
That app imports the title packages and supplies their definitions to this library.
Shared libraries must not depend on games, including in development dependencies
or tests. This package's tests use shared definitions and synthetic fixtures.

The implemented [map scene and inspector](maps.md) provide boardless rendering
for complete title maps, composed with the existing `ScalingWrapper` in the app.
Shared map rendering is also lasting library work: physical-board artwork with
tile overlays, and a generic boardless presentation of the same semantic map.
Both share tile rendering, live overlays, and map-object interaction. Titles
supply matching artwork and alignment data for physical presentation. A possible
per-player display preference belongs outside Game State and Action history.
See the [map development slices](../../research/18xx/development-slices.md#m1-build-the-lasting-map-scene-and-boardless-presentation).

Early game screens and controls may be disposable prototypes in the title/harness
UI. The final desktop/mobile layouts have a separate design stage; other visual
modules are promoted here when their shared use is demonstrated.

Rules and legality calculations belong in the logic package. UI components render
Game State, collect local Action Draft input, and call Game Session methods to
initiate Actions. Each title owns its layout, artwork, Game Session composition,
and `GameUiDefinition`.

Run `pnpm --filter @tabletop/18xx-ui build` to package the library into `dist`,
or `pnpm --filter @tabletop/18xx-ui check` to run Svelte and TypeScript checks.
Run `pnpm --filter @tabletop/18xx-ui test` for shared geometry and filtering checks.
Run `pnpm --filter @tabletop/18xx-tile-viewer dev` for the tile gallery at port 4188,
or `pnpm --filter @tabletop/18xx-tile-viewer test` for title integration and browser checks.

The [economic inspection slice](../18xx/finance.md) adds shared financial fields and queries
and portfolio inspection, with title-owned examples in the standalone app.
