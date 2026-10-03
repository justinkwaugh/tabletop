# 1817 UI

`@tabletop/1817-ui` is the Svelte Game Client for 1817. It consumes the title logic from
`@tabletop/1817`, shared family presentation from `@tabletop/18xx-ui`, and the existing Game
Client support.

There is no published artwork: the map is the boardless presentation, and companies, shares,
privates and trains use generic presentation. The opening's selection auction and the stock
round's company auctions use the shared auction panels; a company's home is chosen by clicking a
highlighted city on the map. The [18xx Playground](../../apps/18xx-playground/README.md) hosts it
at `/table` and `/maps`; `pnpm --filter @tabletop/1817-ui dev` serves the standalone harness on
port 4192.
