# 18Chesapeake UI

`@tabletop/18chesapeake-ui` is the Svelte Game Client for 18Chesapeake. It uses the logic in
`@tabletop/18chesapeake` and the shared 18xx table from `@tabletop/18xx-ui`. The map is the
boardless presentation: there is no board artwork. Companies are drawn in their colours with
their logos. The B&O private and Cornelius Vanderbilt carry the token of the company whose
certificate comes with them. The privates' tile lays and the Canal's station use the family's
private tile lay and private station.

`pnpm --filter @tabletop/18chesapeake-ui dev` serves the standalone harness on port 4228.

The company logos in `src/lib/images/logos` are 18xx.games's 18Chesapeake logos, as 1830's are.
The cover is the All-Aboard Games box art.
