# 1828 UI

`@tabletop/1828-ui` is the Svelte Game Client for 1828. It uses the logic in `@tabletop/1828` and
the shared 18xx table from `@tabletop/18xx-ui`. The map is the boardless presentation: there is
no board artwork. Companies are drawn in their colours with their logos; the stations of closed
companies (absorbed shells, companies removed unparred, the C&P railway) print as blocking
markers, and the coal markers stand on the Virginia Coalfields and its tunnel.

The title adds a Merge stock panel with the merger's outcome, the merger's consent, blocking
station and odd-share decisions, a system's shell arrangement at the start of its train step,
and the C&P buyer's station replacement.

`pnpm --filter @tabletop/1828-ui dev` serves the standalone harness on port 4236.

The company logos in `src/lib/images/logos` and the blocking and coal markers in
`src/lib/images/tokens` are 18xx.games's 1828 art, as 18Chesapeake's and 1830's logos are. There
is no box art: the cover is cropped from the designer's map art (`1828-Map-rot.png`).
