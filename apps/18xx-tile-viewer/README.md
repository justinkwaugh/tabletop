# 18xx tile viewer

Standalone development host for shared 18xx tiles, maps, and economic inspection.
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

`/economy` loads each title's three-player finance example through its real
`UiDefinition`, Game Session, and existing local harness services. Examples are
saved locally and restored on revisit. The screens expose cash, shares
and certificate-limit contributions, private ownership, presidents, and controlling owners. They implement no
stock actions or full-game initialization.

The current schema uses a new versioned local example. Earlier inspection examples
are preserved; current examples are reused on reload.
