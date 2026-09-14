# 18xx tile viewer

Standalone development host for shared 18xx tiles, maps, and playable title prototypes.
This app composes `@tabletop/18xx-ui`, TOP, and Shikoku 1889. Shared libraries must
not depend on game packages, including through development dependencies or tests.
Title definitions remain in their game packages; the app supplies them to the
reusable viewer through its public interface.

Build the workspace dependencies, then start the gallery:

```sh
pnpm exec turbo run build --filter=@tabletop/18xx-tile-viewer^...
pnpm --filter @tabletop/18xx-tile-viewer dev
```

The server uses port 4188. `/` shows the tile library; `/specimens` shows rotations,
preprinted tiles, and replacement examples. `/maps` shows both complete maps with
selection/inspection and prepared tile, token, and route overlays. The existing
`ScalingWrapper` provides fit, focus, pan, zoom, and full screen. `src/demo` composes title definitions
and inspection fixtures. The renderer and viewer component live in
[`libs/18xx-ui`](../../libs/18xx-ui/README.md).

```sh
pnpm --filter @tabletop/18xx-tile-viewer check
pnpm --filter @tabletop/18xx-tile-viewer test
pnpm --filter @tabletop/18xx-tile-viewer build
```

Unit tests exercise the public renderer with complete title catalogs. Browser
tests verify browsing, inventory counts, mobile layout, and the specimen sheet.
The production build writes a static app to `build`.

`/table` loads each title's `UiDefinition` and canonical runtime, with player panels,
actions, map, market, tile manifest, spreadsheet and grouped history. `/economy`
loads `PrototypeUiDefinition`, the earlier workbench for inspecting the same rules.
Both use Game Sessions and local harness services. Games are persisted locally and
restored on revisit. The position selector includes focused scenarios and real
opening auctions; TOP also has a finished-game fixture for forward/backward history.

TOP supports 3–4 players and standard Shikoku 1889 supports 2–6. Stock and operating
Actions run through the canonical engine, including complete-game replay and Undo.
See [complete-game verification](../../research/18xx/complete-game-verification.md)
and [client autorouting](../../research/18xx/autorouter-design.md). These are still
development interfaces; physical-board artwork and mobile polish remain deferred.

Versioned local examples preserve older saved positions while keeping current
examples reusable on reload.
