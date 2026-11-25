# 1882 UI

`@tabletop/1882-ui` is the Svelte Game Client for 1882: Assiniboia. It uses the logic in
`@tabletop/1882` and the shared 18xx table from `@tabletop/18xx-ui`. The map is the boardless
presentation: there is no board artwork. Companies are drawn in their colours with the rulebook's
initials; neutral stations are
striped, unlabelled tokens. The Canadian Pacific and the Trestle Bridge carry the token of the
company whose certificate comes with them. The Saskatchewan Central's exchange is a stock-round panel
(Exchange SC: its par, then its home on the map), and the North-West Rebellion Company's station
move an operating mode (the station, then its rebellion city on the map), after which the family's
private tile lay offers the extra lay.

`pnpm --filter @tabletop/1882-ui dev` serves the standalone harness on port 4226.

The rebellion and fishing icons in `src/lib/images/icons` are 18xx.games's 1882 icons. The cover
sets the title over the American Bank Note Co. map of the Canadian Pacific's prairie section (1880s,
public domain); `tools/cover-art` renders it.
