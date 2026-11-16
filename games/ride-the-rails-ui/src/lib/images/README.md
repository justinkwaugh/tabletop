# Images

`cover.webp` is the catalog title image: 482 × 680, lossy WebP, shown at 150 px and 340 px high,
in the style of John Bohrer's other titles here (Preußische Ostbahn, South African Railroads): a
cream title band with "Ride the / Rails" in the board's bold serif and a muted line under it, a navy
rule, and below it the board. It holds no supplied or publisher art. The board is the table's own:
`scripts/render-cover.mjs` loads a position into the running dev harness, with railroads built out
of Chicago and the East, and photographs that part of the map at four times its size. The title is
set in the family `src/lib/definitions/fonts.ts` names, loaded from the file the table loads it
from. The script composes the two in Playwright's Chromium and encodes the result as WebP.

To redraw it, start the harness (`pnpm dev` in this package), then run, from the repository root:

    node games/ride-the-rails-ui/scripts/render-cover.mjs
