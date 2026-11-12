# Images

`cover.webp` is the catalog title image: 544 × 680, lossy WebP, shown at 150 px and 340 px high.
It is drawn in code, with no supplied or publisher art: `scripts/render-cover.mjs` builds an SVG
from the map's vocabulary (pointy-topped hexes, mountain peaks, route lines over their halo, a
station, a passenger and two locomotives in the Red and Blue railroad colours), colours it with
the palette tokens of `src/app.css` in their dark values, sets the title in Big Shoulders Display
Bold (`src/lib/fonts/BigShouldersDisplay-Bold.woff2`, SIL Open Font License 1.1), renders it in
Playwright's Chromium and encodes the result as WebP.

To redraw it, change the SVG in the script and run, from the repository root:

    node games/ride-the-rails-ui/scripts/render-cover.mjs
