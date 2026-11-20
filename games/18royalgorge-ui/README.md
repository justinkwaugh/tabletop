# 18RoyalGorge UI

`@tabletop/18royalgorge-ui` is the Svelte Game Client for 18RoyalGorge. It uses the logic in
`@tabletop/18royalgorge` and the shared 18xx table from `@tabletop/18xx-ui`. The map is the
boardless presentation: there is no board artwork. Companies are drawn in their colours with their
logos. The board's own panel holds CF&I's steel market and VGC's gold track; the operating
railroad picks its steel columns there. The debt marker hangs as a tab under its space on the stock
market from setup until the Treaty of Boston, then while debts are owed. Mines, gold cubes, ghost towns and the St. Cloud Hotel are drawn as markers on their hexes.

`pnpm --filter @tabletop/18royalgorge-ui dev` serves the standalone harness on port 4238.

The company logos in `src/lib/images/logos` are 18xx.games's 18RoyalGorge logos, as 18Chesapeake's
are, with CF&I's renamed `CFI`. Their colours are toned so the two greens (CM, CSCC), the two
blacks (NO, CS) and the two grays (KP, CF&I) read apart. The cover is the 18Wood / Mr. B Games box
art from BoardGameGeek.
