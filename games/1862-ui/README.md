# 1862 UI

`@tabletop/1862-ui` is the Svelte Game Client for 1862: Railway Mania in the Eastern Counties. It
consumes the title logic from `@tabletop/1862`, the shared table from `@tabletop/18xx-ui`, and the
Game Client support.

The table opens on the Board view: the boardless map, with the market's single row of 67 spaces
above it and the depot to its east. There is no published board artwork. Company station tokens
are drawn from each company's printed colours by `scripts/generate-logos.mjs`. The cover is the
rulebook's coloured engraving of an early station.

`pnpm --filter @tabletop/1862-ui dev` serves the standalone harness on port 4195, with the
prepared positions described in [src/scenarios](src/scenarios/README.md).
