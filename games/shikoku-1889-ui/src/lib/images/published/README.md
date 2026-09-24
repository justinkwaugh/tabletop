# Published artwork (Shikoku 1889, Boda Games edition)

Extracted from the publisher print files with `tools/art-extraction/extract_shikoku.py`.
Nothing in this folder is imported yet except as noted; Rollup only bundles imported assets,
so unused files cost repository space only.

| Folder | Contents | Source |
| --- | --- | --- |
| `shares/` | `<companyId>-share.jpg` (10%) and `<companyId>-president.jpg` (20%) for KO, TR, KU, UR, AR, IR, SR, 1081 x 750 px | 63.5 x 44 mm mini card sheet |
| `trains/` | One card per train type: `2`, `3`, `4`, `5`, `6`, `D` | same sheet |
| `privates/` | `A`..`G` private company cards, 1081 x 1497 px | 63.5 x 88 mm card sheet |
| `tiles/plain/` | Vector SVG of every distinct tile face (40), named by printed number, plain style | punchboards, seating-order side |
| `tiles/patterned/` | The same 40 tiles in the ornamental style printed on the other side | punchboards |
| `tiles/style.json` | Measured colours and stroke widths for both tile styles, with values pre-scaled to the shared tile renderer | punchboards |

Tokens: the existing `../tokens/*.svg` already trace the published company emblems (compared
against the board's Initial Offering column); no replacement was extracted.

## Tiles

The tile SVGs keep the printed tile number and orientation as cut, so they are reference art for a
`TileAppearance` rather than drop-in map artwork. Both styles use the same 108 pt flat-to-flat hex
and ink `#231f20`; see `style.json` for the palette and the plain/patterned differences (white casing
vs tile-colour casing, white vs tinted station circles, the lattice pattern). The shared renderer can
approximate the plain style with its existing fields; the patterned style additionally needs a
pattern fill and per-colour city fills.
