# Published artwork (The Old Prince, Boda Games edition)

Extracted from the publisher print files with `tools/art-extraction/extract_top.py`. The tokens
(`mapView.ts`, `publishedStations`), the private cards and the second-variant PEIR certificates
(`presentation.ts`, `publishedCardImages`) are shown while the published artwork toggle is on, the
cards as a viewport-sized lightbox when clicked and inside the auction bidding panel;
the shares and tile references are not wired yet.

| Folder | Contents | Source |
| --- | --- | --- |
| `tokens/` | `<companyId>.svg` for C, So, A, MS, MR, S, Gt, PEIR and the six branches CB, SB, MB, BB, WB, HRB. Coloured disc (wood-spec Pantone, as converted by the spec sheet) plus the Pantone 9200 C icon path, 100 x 100 viewBox | `wood/15 mm/token-15mm-charter-*.pdf` and `wood/wood-specification-05-add-on.pdf` |
| `privates/` | The 13 private company cards, 966 x 1600 px JPG | `privates+peirs/private companies` |
| `shares/v1/`, `shares/v2/` | `<company>-share.jpg` and `<company>-president.jpg` for all 13 charters in both printed art variants, 793 x 1100 px | `shares/shares variant 01|02` |
| `peirs/v1/`, `peirs/v2/` | `peir-<n>-<town>.jpg` for the seven numbered PEIR certificates plus `peir-back.jpg`, both variants, 966 x 1600 px | `privates+peirs/peir variant 01|02` |
| `tiles/reference/` | Sixteen representative die-cut tiles (one or two per colour tier and marker type) as PNG with hex alpha, half resolution | `hexes/PUNCH-TILES-*.tiff` |
| `tiles/style.json` | Measured palette, ink, track width and marker conventions for the hand-inked tile style, pre-scaled to the shared tile renderer | same |

The lettered tokens in `../tokens/` remain the generic presentation.

## Tiles

The publisher tiles exist only as raster punch sheets, so there are no per-tile vectors. The
deliverable is the rendering style in `style.json` plus the reference crops. The physical sheets are
a later edition than the `the-old-prince:prototype` tile set, so individual tiles were not matched
to catalog ids.
