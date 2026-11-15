# Images

`cover.webp` is the catalog title image: 544 × 680, lossy WebP, shown at 150 px and 340 px high.
It is drawn in code, with no supplied or publisher art: `scripts/render-cover.mjs` builds an SVG
in the board's flat chart look (a hatched sea in a navy frame, cream hexes on their warm grid with
mountain patches, a grey city with its Red and Blue start band, the board's natural-wood passenger
meeple, a $5 pill, and lines of flat Red and Blue cubes meeting there), colours it with the palette
tokens of `src/app.css` for the palette `BOARD_LOOK` picks (`src/lib/utils/boardLook.ts`), and stops
on any token that palette does not declare. The meeple's shape, edge, place and scale are read from
`src/lib/utils/cityMarks.ts`, so the cover's passenger is the one the board draws. The title is
set on a cream card in the board's serif, the family `src/lib/definitions/fonts.ts` names, loaded
from the file the table loads it from. The script renders it in Playwright's Chromium and encodes
the result as WebP.

To redraw it, change the SVG in the script and run, from the repository root:

    node games/ride-the-rails-ui/scripts/render-cover.mjs
