# 1894 UI

`@tabletop/1894-ui` is the Svelte Game Client for 1894. It consumes the title logic from
`@tabletop/1894`, the shared table from `@tabletop/18xx-ui`, and the Game Client support.

The table opens on the Board view: the boardless map, with the market to its east and the depot
in the market's empty corner. Company heralds come from the research implementation; there is no
published board artwork. `EighteenNinetyFourMapView` supplies station colours, the layouts of
Paris, the partly built double towns and the split brown cities, and the board areas. The cover
is the rulebook's engraving of the 1895 Montparnasse derailment.

`pnpm --filter @tabletop/1894-ui dev` serves the standalone harness on port 4197, with the
prepared positions described in [src/scenarios](src/scenarios/README.md). The
[18xx Playground](../../apps/18xx-playground/README.md) also hosts it.
