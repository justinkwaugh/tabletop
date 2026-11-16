# 1856 UI

`@tabletop/1856-ui` is the Svelte Game Client for 1856. It uses the logic in `@tabletop/1856`
and the shared 18xx table from `@tabletop/18xx-ui`. The map is the boardless presentation: there
is no board artwork. Companies are drawn in their colours with their logos; destinations show the
company's initials beside the place until reached, and the Great Lakes port token its +$20.
The CGR's formation has its own panel: presidents settle their companies' loans, and the CGR's
president keeps stations and trains where there is a choice.

`pnpm --filter @tabletop/1856-ui dev` serves the standalone harness on port 4230.

The company logos in `src/lib/images/logos` are 18xx.games's 1856 logos, as other titles' are.
The cover is the Mayfair box art (BGG image 159311).
