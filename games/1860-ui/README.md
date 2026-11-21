# 1860 UI

`@tabletop/1860-ui` is the Svelte Game Client for 1860: Railways on the Isle of Wight. It uses the
logic in `@tabletop/1860` and the shared 18xx table from `@tabletop/18xx-ui`. The map is the
boardless presentation of the second edition's extended map, with the zig-zag stock market along
the island's south coast and the train depot in the empty sea to the south-west.

The title adds the opening's six auctions for the right to choose a certificate, the bank's
private sales in the stock round, the home tile a director lays as a company floats on a bare
hex, and the return of trains over the limit. Halts print as grey stops carrying a £, insolvent
companies' leased trains are marked in the run panel, and bankrupt companies' bases lie face down
on the map until the company is started again.

`pnpm --filter @tabletop/1860-ui dev` serves the standalone harness on port 4256.

The company logos in `src/lib/images/logos` are drawn for this package in the charters' colours.
The cover is the All-Aboard Games box art from BoardGameGeek.
