# Published artwork (The Old Prince, Boda Games edition)

Extracted from the publisher print files with `tools/art-extraction/extract_top.py`. The tokens
(`mapView.ts`, `publishedStations`), the private cards and the second-variant PEIR certificates
(`presentation.ts`, `publishedCardImages`) and the train cards (`publishedTrainImages`) are shown while the published artwork toggle is on, the
cards as a viewport-sized lightbox when clicked and inside the auction bidding panel;
the tile style (`tileAppearance.ts`, `publishedTileAppearance`, with `tiles/paper-grain.png` as
the grain overlay) draws laid tiles in the punch-tile look, and the second-variant share and
president certificates (`presentation.ts`, `publishedShareImages`) appear beside share purchases
and sales in history and the position summary.

| Folder | Contents | Source |
| --- | --- | --- |
| `tokens/` | `<companyId>.svg` for C, So, A, MS, MR, S, Gt, PEIR and the six branches CB, SB, MB, BB, WB, HRB. Coloured disc (wood-spec Pantone, as converted by the spec sheet) plus the Pantone 9200 C icon path, 100 x 100 viewBox | `wood/15 mm/token-15mm-charter-*.pdf` and `wood/wood-specification-05-add-on.pdf` |
| `privates/` | The 12 private company cards as WebP, 1200 px tall for the lightbox plus a `-600` thumbnail for inline use | `privates+peirs/private companies` |
| `shares/v2/` | `<company>-share.webp` and `<company>-president.webp` for all 13 charters (second printed art variant), 1100 px tall with `-600` thumbnails | `shares/shares variant 01|02` |
| `peirs/v2/` | `peir-<n>-<town>.webp` for the seven numbered PEIR certificates plus `peir-back.webp` (second variant), 1200 px tall with `-600` thumbnails | `privates+peirs/peir variant 01|02` |
| `trains/` | `<id>.webp` train cards (plus trains as `2plus` etc.), 480 x 346 px, shown in place of purchase buttons | `trains/TRAIN-*.pdf` |
| `tiles/reference/` | Sixteen representative die-cut tiles (one or two per colour tier and marker type) as PNG with hex alpha, half resolution | `hexes/PUNCH-TILES-*.tiff` |
| `tiles/style.json` | Measured palette, ink, track width and marker conventions for the hand-inked tile style, pre-scaled to the shared tile renderer | same |
| `tiles/paper-grain.png` | Seamless 240 px paper-grain overlay (white and black with low alpha) cut from a track-free area of a punch tile, used by the published tile appearance | `hexes/PUNCH-TILES-03.tiff` |

The lettered tokens in `../tokens/` remain the generic presentation.

## Tiles

The publisher tiles exist only as raster punch sheets, so there are no per-tile vectors. The
deliverable is the rendering style in `style.json` plus the reference crops. The physical sheets are
a later edition than the `the-old-prince:prototype` tile set, so individual tiles were not matched
to catalog ids.
