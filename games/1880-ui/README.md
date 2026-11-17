# 1880 UI

`@tabletop/1880-ui` is the Svelte Game Client for 1880: China. It uses the logic in
`@tabletop/1880` and the shared 18xx table from `@tabletop/18xx-ui`. The map is the boardless
presentation: there is no board artwork. Companies are drawn in their charter colours with the
rulebook's abbreviations; foreign investors are grey, numbered tokens. Medium cities print as a
town within a city, Beijing's starting sections as printed track, rivers as a wave and ferries
with their ¥10 fee. The stock market, with its income bonuses marked, and the depot stand east of
the tall map.

Title panels: the choice of foreign investors, an investor's merger, the Rocket of China's forced
exchange, the privates' powers (P0's payment, P5's D permit, P7's exchange) and a director's
debt. Starting a major asks its director's certificate size, its par, then its slot and permits.

`pnpm --filter @tabletop/1880-ui dev` serves the standalone harness on port 4234.

The cover is the Lookout Games front cover (publisher image on BoardGameGeek).
