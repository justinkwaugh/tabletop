# 1830 UI

`@tabletop/1830-ui` is the Svelte Game Client for 1830. It consumes the title
logic from `@tabletop/1830`, shared family presentation from `@tabletop/18xx-ui`,
and the existing Game Client support.

There is no published artwork: the map is the boardless presentation, and
companies, shares, privates and trains use generic presentation. `EighteenThirtyMapView`
supplies the station colors and the node layouts for the printed two-city hexes.
The [18xx Playground](../../apps/18xx-playground/README.md) hosts it at `/table`
and `/maps`; `pnpm --filter @tabletop/1830-ui dev` serves the standalone harness
on port 4191.
