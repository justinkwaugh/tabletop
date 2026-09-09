# 18xx tile viewer

Standalone development gallery for the shared tile renderer and title catalogs.
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
preprinted tiles, and replacement examples. `src/demo` composes title definitions
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
