# Images

`cover.webp` is the catalog image, drawn by `scripts/make-cover.mjs` from the palette, the colorizer's seat colours and the shape module. It is our own work. Rerun the script after changing any of those; it keeps the image at 544 × 680, lossy WebP, at most 120 KB.

## The supplied cover

The catalog's supplied cover is the publisher's box front, and it is owed: until it arrives, the rulebook's cover stands in for it through the same path. To drop the box front in:

1. Save it as `box-front.png` (or `.jpg`, `.webp`) in `src/lib/art/cover-source/`. That folder is git-ignored; nothing in it is committed. The `cover.webp` the script writes is.
2. Run `node scripts/make-cover.mjs --titled` from `games/feudum-ui`.

The script takes `box-front.*` when it is there and `rulebook-cover.*` otherwise, and writes `src/lib/art/supplied/cover.webp` at 544 × 680, lossy WebP, at most 120 KB. The asset map prefers that file to `cover.webp` when it is there.

**The crop rule** (`coverPlacement` in `src/lib/utils/coverPage.ts`): the image is scaled to the cover's full width, so a title printed across it is never cut at the sides, and centred top to bottom. A source taller than 4:5 loses equal strips above and below; a wider one stands whole between two bands of the page's ground (`surface`). Nothing is drawn over it, since it prints its own title. The rulebook's cover (613 × 859) loses about 5 % of its height at each end, and its title stays whole.

`--art <image>` names another source. Without `--titled`, a supplied scene with no title of its own fills the page behind the same title band as the drawn cover.
