# Images

`cover.webp` is the catalog image, drawn by `scripts/make-cover.mjs` from the palette, the colorizer's seat colours and the shape module. It is our own work. Rerun the script after changing any of those; it keeps the image at 544 × 680, lossy WebP, at most 120 KB.

## The supplied cover

The catalog's supplied cover is the publisher's box front (2400 × 1618). To make it again:

1. Save the box front as `box-front.png` (or `.jpg`, `.webp`) in `src/lib/art/cover-source/`. That folder is git-ignored; nothing in it is committed. The `cover.webp` the script writes is.
2. Run `node scripts/make-cover.mjs --titled` from `games/feudum-ui`.

The script takes `box-front.*` when it is there and the rulebook's cover, `rulebook-cover.*`, otherwise, and writes `src/lib/art/supplied/cover.webp` at 544 × 680, lossy WebP, at most 120 KB. The asset map prefers that file to `cover.webp` when it is there.

**The crop rule** (`coverPlacement` in `src/lib/utils/coverPage.ts`): nothing is drawn over the image, since it prints its own title, so the crop keeps that title whole.

- **The box front** is landscape, and FEUDUM in its frame runs across 58 % of its width (`BoxFrontTitle`). A full-height 4:5 crop would show only 54 % of the width and cut the title, so the title and a 16-unit margin on each side fill the cover's width instead, centred across it. That shows the middle 62 % of the scene (the ship, the monster and the two figures at the front), and the image stands centred top to bottom between two bands of the page's ground (`surface`), about 43 units each. A source whose title fits in a full-height crop fills the height and loses its sides.
- **Without a known title** (the rulebook's cover, or any `--art` image): the image is scaled to the cover's full width, so a title printed across it is never cut at the sides, and centred top to bottom. A source taller than 4:5 loses equal strips above and below; a wider one stands whole between two bands of the page's ground. The rulebook's cover (613 × 859) loses about 5 % of its height at each end, and its title stays whole.

`--art <image>` names another source. Without `--titled`, a supplied scene with no title of its own fills the page behind the same title band as the drawn cover.
