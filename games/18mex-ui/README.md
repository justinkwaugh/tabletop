# 18MEX UI

`@tabletop/18mex-ui` is the Svelte Game Client for 18MEX. It uses the logic in `@tabletop/18mex`
and the shared 18xx table from `@tabletop/18xx-ui`. The map is the boardless presentation: there
is no board artwork. Companies are drawn in their charters' colours with their logos. Mexico City
and Puebla print as one double hex, laid and highlighted as one piece. The NdM merger's offers and
the NdM president's choices appear in the action area.

`pnpm --filter @tabletop/18mex-ui dev` serves the standalone harness on port 4252.

The company logos in `src/lib/images/logos` are 18xx.games's 18MEX logos, with FCP's renamed
`PAC`, the rulebook's initials for the Pacific Railroad. The cover is the All-Aboard Games box
art from BoardGameGeek.
