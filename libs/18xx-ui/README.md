# @tabletop/18xx-ui

Shared Svelte presentation and interaction support for 18xx Game Clients, using
`@tabletop/18xx` and `@tabletop/frontend-components`. This package starts with an
empty public interface; shared rendering and interactions will grow alongside
`@tabletop/the-old-prince-ui` and `@tabletop/shikoku-1889-ui`.

The shared SVG tile renderer is a lasting library asset from the start. It consumes
the family tile catalog/model and serves board tiles, inventory thumbnails,
placement previews, and detailed inspection. See the [tile development slices](../../research/18xx/development-slices.md#t2-build-a-lasting-svg-tile-renderer-and-inspection-gallery).

T2 also plans an exported, reusable tile-library viewer using that renderer. It
will browse the catalog or a title's selected set with search, filters, rotation,
and enlarged inspection, preserving same-number variants. It can serve a standalone
development gallery or an embedded game view without requiring a Game Session.
Optional caller-supplied inventory counts follow in T3. The viewer is a lasting
component; its development host page may be disposable.

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
