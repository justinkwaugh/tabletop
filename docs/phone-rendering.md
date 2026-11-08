# Phone rendering

Every browser on an iPhone runs WebKit, and WebKit draws SVG and CSS effects into offscreen bitmaps the size of the effect's area at device pixels. A bitmap costs width × height × DPR² × 4 bytes: a 1200 × 900 board on a 3x phone is about 39 MB per copy, and it is drawn again in full whenever anything inside it changes. When a tab passes its memory limit, iOS kills it and the page reloads silently. Only WebKit shows these costs, so design every game UI to the budget of a 3x phone and measure it in WebKit.

Three words carry the rules below:

- **piece-sized**: every effect covers one piece, never the board or a container of it;
- **pre-rendered**: texture and decoration are images, generated once by a script;
- **still**: whatever repaints every frame is small and carries no effect.

## Drawing rules

### Effects stay piece-sized

An effect is anything WebKit draws offscreen: an SVG `filter`, a CSS `filter` or `backdrop-filter`, a `mask`, `mix-blend-mode`, and `opacity` below 1 on a group, including a fade. Apply each to the single piece that needs it.

- Give every SVG filter an explicit region in `filterUnits="userSpaceOnUse"` sized to its piece, as Medina's tint filter for each recent wall does (`games/medina-ui/src/lib/components/Board.svelte`). The default region is the element's bounding box plus 10%, and that box can be far larger than what shows.
- Clip a sprite to its frame. A frame of a sprite sheet shown through a nested `<svg>` reports the whole sheet as its bounding box, so every filter and fade on it was sheet-sized until `games/medina-ui/src/lib/components/Sprite.svelte` clipped each image to its frame.
- Bound a glow or blur to its piece (MarraCash's route and halo glows), and keep the number of filtered pieces on screen small.

A filter that is piece-sized, still, and used on a handful of pieces is fine.

### Shadows and depth are shapes

Draw a shadow as an offset shape with lowered opacity, a two-step shape, or an image of the outline placed behind the piece. `games/fresh-fish-ui/src/lib/utils/landShape.ts` replaced a CSS `drop-shadow` on the board that cost about 280 MB on a 3x phone and reloaded iPhones on Place Disc.

### Textures are pre-rendered

Generate grain, noise, weave, and paper as small WebP tiles with a script in the UI package (`games/marracash-ui/scripts/generate-textures.mjs`, `games/hill-country-grocers-ui/scripts/generate-images.mjs`) and fill with a pattern of the image. A live `feTurbulence` made MarraCash's full redraws 40–55% slower.

### Motion stays still around it

An animating element repaints its area every frame, together with every effect it sits under. Animate `transform` or `opacity` of a small element that carries no effect; show a waiting target with a static highlight. HCG's prompt rose from 10 to 62 fps on a phone once its pulsing target rings stopped and its filter shadows became shapes; MarraCash's animated route dash repainted a board-sized halo filter every frame.

### One board surface

Draw the board as one SVG. Each extra full-board layer, whether a stacked SVG or an element `will-change` promotes, adds a full-board bitmap: MarraCash crash-looped iPhones with three full-board layers at 1.5x. For a board shown well below its layout size, set `renderAtViewScale` on its `ScalingWrapper` so WebKit draws it at the size on screen, and keep `maxFitScale` × layout width × DPR within reach (MarraCash zoomed to 1.5 draws 5526 px wide).

### Listeners are permanent

Adding or removing a `touchstart`, `touchmove`, or `wheel` listener anywhere restyles the whole page in WebKit, about 50 ms on the 18xx table. Register touch and wheel listeners once and dispatch to a set of active handlers, as `libs/frontend-components/src/lib/utils/touchFling.ts` does.

## Correct drawing across browsers

- **Centred SVG text**: use the alphabetic baseline with a measured `dy` per font (`games/marracash-ui/src/lib/utils/textBaseline.ts`; 18xx board text uses `0.35em`). WebKit ignores a `dominant-baseline` set on a group and mis-scales `central` under CSS zoom, so iOS draws the text too high or too low.
- **Images in SVG**: size an `<image>` to cover its box yourself, scale = max(boxW/artW, boxH/artH), and clip it to the box; browsers disagree on `preserveAspectRatio="slice"`. Give exported SVG art `width` and `height` on its root.
- **Moving SVG under zoom**: tween a plain point and write `translate(...)` yourself. GSAP writes SVG `x`/`y` as `matrix(...)`, whose offset Firefox 140 leaves out of CSS zoom, so pieces inside a `renderAtViewScale` board spread apart.

## Measure in WebKit

Measure a board before calling it done: a new title, a new effect, a larger board, or a heavier interaction. `tools/webkit-probe` opens a harness in Playwright WebKit as a 3x phone and reports the web process's memory and the board's repaint time:

```bash
node tools/webkit-probe/src/cli.mjs http://localhost:<port> --scenario <name|file.json> \
  --board 'svg.board' --steps /workspace/tmp/<topic>/steps.mjs
```

- Drive the heaviest interaction in a steps module (`--help` gives its signature): `mark` the moments to measure, and `time` an interaction to see every frame it causes, not only the first; a first-frame measure once overstated a win tenfold. Marks and timings run with full motion, so every animation is paid for; wrap setup such as playing a game forward in `quietly`.
- To find the cost, add a `--css` run per suspect that removes it, with `!important` (`--css 'svg.board { display: none !important }'`), since a component's scoped style wins without it. Each run is reported against the first.
- Compare runs of one harness; the dev harness alone adds about 270 MB. One board-wide filter cost 280 MB; a Medina game adds about 190 MB over the harness.

Done means the open and heaviest-interaction memory and the repaint time are recorded, and every effect the board draws is piece-sized, pre-rendered, or still.

## Phone reports

| Symptom                                                 | Cause                           | Next step                                                                                                           |
| ------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Page reloads, with no Action posted and no error logged | Tab killed for memory           | Measure RSS around the reported step and remove suspects one at a time                                              |
| Long frames with no slow script                         | Restyle or paint                | Ask the user for a Safari Web Inspector timeline export; read what precedes each long `recalculate-styles` or paint |
| Board or pieces vanish for a moment                     | Offscreen bitmaps exhausted     | Find fades and filters whose area is a sheet or the board                                                           |
| Text sits high or low; pieces spread when zoomed        | Baseline or `matrix` under zoom | Apply [Correct drawing across browsers](#correct-drawing-across-browsers)                                           |

Playwright WebKit reproduces the memory and repaint costs; the user's iPhone confirms the fix.
