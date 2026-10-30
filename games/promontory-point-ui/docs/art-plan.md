# Promontory Point art plan

Every visual, its source, and the budget it must meet. What is an image and what is drawn from data is fixed by the UI contract (`ui-interaction-visual-contract.md`, "Images and data", and choices O-1 to O-11). Component counts and ids are in `games/promontory-point/docs/components.md`.

**Two sources, nothing else:**

- **The supplied art**, made for this title: the map, the four share card faces, the eight town tile faces (and a share back and a tile back, which are not used, O-7).
- **Drawn in code from data**, as SVG: track pieces (R-X.4), price and money markers, the bag, every count, all pick chrome, the seat cards and the end tracker.

No other art is drawn to stand in for a supplied image, and no supplied image is redrawn.

## Palette

Colours are CSS custom properties in `src/app.css`, declared on `:root` and rewritten to `[data-game-ui="promontory-point"]` by the scope plugin, as Oath does. Components use these tokens and never a raw colour; `palette.spec.ts` fails on a raw colour anywhere else in the package. Seat colours are not tokens: they come from `gameSession.colors` (see [Seat colours](#seat-colours-and-colour-blindness)).

The table keeps the map's colours in both site themes, so Light and Dark are the same. Railroad colours are sampled from the four home hexes on the map.

| Token             | Meaning                                                                                    | Light             | Dark |
| ----------------- | ------------------------------------------------------------------------------------------ | ----------------- | ---- |
| `--pp-table`      | The table behind the board: the map's sea, deepened                                        | `#24393C`         | same |
| `--pp-column`     | The side column, a shade darker                                                            | `#1D2F31`         | same |
| `--pp-panel`      | Panels and tab bodies, a shade lighter                                                     | `#2D474A`         | same |
| `--pp-line`       | Rules and panel borders                                                                    | `#48686B`         | same |
| `--pp-text`       | Text on the dark surfaces                                                                  | `#ECE6D3`         | same |
| `--pp-muted`      | Secondary text, captions, reasons                                                          | `#A9B3AD`         | same |
| `--pp-paper`      | The map's border tan: seat cards, buttons                                                  | `#E4D7A8`         | same |
| `--pp-paper-line` | Seat card rules, button borders                                                            | `#7F7043`         | same |
| `--pp-ink`        | Text on tan                                                                                | `#2B2A24`         | same |
| `--pp-ink-sub`    | Secondary text on tan ("$4 ea", "shares worth")                                            | `#6A5F42`         | same |
| `--pp-accent`     | **Yours to act on**: lit ring, picked ring, primary button, Undo, the deciding seat's ring | `#F5A524`         | same |
| `--pp-accent-ink` | Text on amber                                                                              | `#1D1404`         | same |
| `--pp-cost`       | **Costs or threatens**: Repairs chips, "short $3"                                          | `#E11D48`         | same |
| `--pp-cost-ink`   | Text on rose                                                                               | `#FFFFFF`         | same |
| `--pp-gain`       | The neutral Dividend chip ("you +$4")                                                      | `#E9F2E4`         | same |
| `--pp-ok`         | "paid ✓", "enough"                                                                         | `#9FD59B`         | same |
| `--pp-halo`       | The dark halo under every ring, outline and chip                                           | `#111111`         | same |
| `--pp-veil`       | The veil over the board outside the lit hexes                                              | `#0A0C0C` at 50 % | same |
| `--pp-decided`    | The neutral dashed outline (being decided, this turn's placements)                         | `#E8E6E1`         | same |
| `--pp-hidden`     | A concealed hand piece                                                                     | `#8D8A7E`         | same |
| `--pp-cp`         | Central Pacific: pieces, price marker, tags                                                | `#6A95A4`         | same |
| `--pp-up`         | Union Pacific                                                                              | `#7E6479`         | same |
| `--pp-kp`         | Kansas Pacific                                                                             | `#923626`         | same |
| `--pp-sp`         | Southern Pacific                                                                           | `#ECD775`         | same |
| `--pp-rr-ink`     | Text and rail marks on a railroad colour (`--pp-sp` takes `--pp-ink`)                      | `#FFFFFF`         | same |

Two meanings are fixed across titles: amber (`--pp-accent`) says "yours to act on" and rose (`--pp-cost`) says "costs or threatens". Nothing else is amber or rose. Kansas Pacific's red and the red Repairs and Dividend tiles are game colours, not the rose role: a rose chip always carries a label and the dark halo, and a railroad colour never carries a chip colour.

## Fonts

| Family                                             | Use                                                                                                                                                                     | Licence file                                               |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Oswald, 500 and 600, Latin subset, woff2           | The seat card's name and money, the turn header, prices in the panel and the status strip, the score totals, the end tracker; close to the map's own condensed numerals | `src/lib/fonts/Oswald-OFL.txt` (SIL Open Font License 1.1) |
| The site's own text font, not shipped by the title | Everything else: prompts, buttons, chips, the log                                                                                                                       | none (the site's)                                          |

## Board

- **Geometry source.** One `boardGeometry.ts` holds every position in map-image units (3571 × 2302): hex centres from the logic package's axial coordinates (`x = 2228.73 + 188.09·(q + r/2)`, `y = 1152.09 + 153.45·r`, Promontory at 0,0, pointy-top; half-width 94.05, vertical radius 102.3), measured off the map as recorded in `src/lib/images/board/README.md`; the 30 price-track spaces with one slot per railroad per row (spaces 25 to 3 in the left column, then 2, 1 and the five 0 spaces in the right column); the 100 border-track spaces (0 at the bottom-left corner, clockwise); the sea slots (share decks, bag, end tracker) in the open sea. `boardGeometry.spec.ts` checks that every space in the logic's data has a centre, no centre names a space the data lacks, the four homes are placed, the track tables have 30 and 100 entries in printed order with an even pitch, and no two slots or spaces overlap. The dev harness's `/geometry` page draws every position over the map.
- **Layers, back to front:** map image; town tiles (each clipped to a hex at 0.8 of the cell, over the printed village hex); track pieces; this turn's outlines and badges; price markers; money markers; the sea (four share decks, bag, end tracker); the veil; the being-decided outline; lit rings; hit targets (transparent hex polygons carrying space ids); chips, which take no press, so a chip's overhang never steals one. A chip sits above its hex, below it when a hex in the row above is lit, and inside its hex when both rows are, so it never covers another lit hex.
- **What each layer owns:** only what it draws and its pick chrome, from the board offer (contract, "Coexistence and precedence"). The veil is one path, owned with the lit rings.
- **Full screen and phones:** the same surface in the shared scaling wrapper; `coverBelowScale` on phones rests it fitted to the hex field's width.

## Pieces and tokens

| Element                              | Drawn how                                                                                                                               | Defs or shape module                                                              | Colour source                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Track piece                          | a disc (radius 0.5 of the hex half-width) with a dark rim, a lighter inner ring and two short rail marks; a drop shadow                 | `board/TrackPiece.svelte`, `utils/boardLayout.ts`                                 | `--pp-cp` … `--pp-sp`                                                |
| Concealed hand piece                 | the same disc in `--pp-hidden` with "?"                                                                                                 | `board/TrackPiece.svelte`                                                         | `--pp-hidden`                                                        |
| Price marker                         | a disc with a dark rim and the railroad's initials                                                                                      | `board/PriceMarkerLayer.svelte`                                                   | railroad token, `--pp-rr-ink`                                        |
| Money marker                         | a rounded square with the seat's initials (each word's first letter, at most two); 2×2 when sharing a space; "+100" mark at 100 or more | `board/MoneyMarkerLayer.svelte`                                                   | `gameSession.colors`                                                 |
| Bag                                  | a drawn sack with the count                                                                                                             | `board/BagArt.svelte`                                                             | `--pp-paper`, `--pp-ink`                                             |
| End tracker                          | a dark plate in the sea: the Dividend face clipped to a hex for "red towns open (≤ 1)", a dark hex for "Promontory open / taken"        | `board/EndTracker.svelte`                                                         | tokens                                                               |
| Rings, chips, veil, outlines, badges | SVG strokes and labels over the dark halo                                                                                               | `board/PickChrome.svelte`, `board/ThisTurnLayer.svelte`, `board/ChipLayer.svelte` | `--pp-accent`, `--pp-cost`, `--pp-gain`, `--pp-decided`, `--pp-halo` |

## Cards and tiles

- **Share card** (4 faces). The supplied face is the whole card: "ONE SHARE" and the railroad's home-hex emblem. On the seat card it is a stack of up to four faces 30 px wide with the count and price beside it; in the panel a 38 px face; in the sea a deck at about 45 px with its count; enlarged 300 px on a desktop and the screen width less 32 px (up to 343 px) on a phone. The same image at every size; no second asset.
- **Town tile** (8 faces). The supplied face is a square; the board clips it to a pointy-top hex a little larger than the printed village hex, so the red tiles keep their red border. The +1 to −3 faces are turned a quarter turn clockwise so the number reads upright (O-6); Dividend and Repairs are drawn as supplied. Enlarged at 160 px.
- **Backs.** Neither the share back nor the tile back is used (O-7): decks and tiles are face up (R-1.3), and a concealed hand piece is drawn in code.

## Icons and symbols

- **Railroads in text:** a small pill in the railroad's colour with its initials (CP, UP, KP, SP), the same vocabulary as the price markers, in panels, the status strip and the log (the `TokenText` pattern).
- **Dividend and Repairs in text:** the supplied tile face at 16 px, clipped to its hex, so the log and the board share one symbol.
- **Money:** "$" in text; no coin art.
- No other icon is drawn.

## Seat colours and colour blindness

Seats and railroads must never be confused (O-1). The title's colour list is green, orange, black, white, then pink and brown; it leaves out blue, purple, red and yellow, the railroad colours. Seat colour appears only on seat things (seat card headers, money markers, seat-strip chips); railroad colour only on railroad things. Colour is never the only cue: every money marker carries the seat's initial, every price marker its railroad's initials, and every piece carries its railroad's colour on a hex connected to its home. Colour-blind presentation follows `gameSession.colors`.

## Cover

`cover.webp`, 544 × 680, composed once from the supplied art: a crop of the map around Promontory and two home hexes, the four share cards fanned across the lower half, and "PROMONTORY POINT" in Oswald on a tan band across the top, sized so the title reads at 150 px and 340 px tall. Laid out in a browser, captured at 2× and exported once; the composition file is not committed.

## Supplied assets

Rendered sizes are the largest ordinary render, in CSS px. Every file is opaque lossy WebP: the PNGs carry an alpha channel but their corners are opaque, so it is dropped.

| File                                         | Source                                                                      | Rendered size                                                                                                            | Natural size                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `board/map.webp`                             | `Map.jpg` (3571 × 2302)                                                     | about 1550 wide: a desktop full screen at 1920 × 1080, height-bound; the phone's pick framing renders it about 1470 wide | 3100 × 1998 (resized from 3571, 2× the full-screen render), at most 800 KB |
| `cards/share.{cp,up,kp,sp}.webp`             | `CP Share.png`, `UP Share.png`, `KP Share.png`, `SP Share.png` (675 × 1050) | 343 wide (phone enlarge), 300 (desktop enlarge)                                                                          | 675 × 1050 (as supplied, under 2× of 343), at most 70 KB each              |
| `tiles/tile.price.{plus,minus}-{1,2,3}.webp` | `+1.png` … `-3.png` (300 × 300)                                             | 160 (enlarge); about 70 on a full-screen board                                                                           | 300 × 300 (as supplied, under 2× of 160), at most 20 KB each               |
| `tiles/tile.red.{dividend,hammer}.webp`      | `$.png`, `Hammer.png` (300 × 300)                                           | as above                                                                                                                 | 300 × 300, at most 20 KB each                                              |
| `cover.webp`                                 | composed from the map and share cards (above)                               | 340 tall (catalogue)                                                                                                     | 544 × 680, at most 120 KB                                                  |

Not shipped: `Share Back.png`, `Back.png` (O-7).

**Budget.**

| Group           | Files   | Ceiling          |
| --------------- | ------- | ---------------- |
| Map             | 1       | 800 KB           |
| Share faces     | 4       | 280 KB           |
| Town tile faces | 8       | 160 KB           |
| Cover           | 1       | 120 KB           |
| Font            | 2 woff2 | 60 KB            |
| **Total**       | **16**  | **about 1.4 MB** |

The ceilings are limits, not estimates. Each image folder's README records the measured bytes and how the file was made. Images are imported by URL, so none is in the UI entry chunk.

**Extraction.** Only resizing and re-encoding; nothing is cropped or retouched. The map is resized to 3100 wide with a Lanczos filter, then every file is encoded with libwebp, lossy, quality about 82, `-sharp_yuv`, alpha dropped. The tools run outside the repository and are not committed; only the images and their READMEs are added.

**Lookups and their specs.** `boardImages.ts`, `cardImages.ts` and `tileImages.ts` index their folders, as Oath's `cardImages.ts` does. An image coverage spec checks that every railroad id has a share face, every town tile kind has a face, and no file is orphaned.

## Gate notes

- **Untrusted code, assets (gate 1).** The drawn SVG is markup in Svelte components; no SVG file carries script, an event attribute, `foreignObject` or an external reference. The only binaries added are the WebP images above and two woff2 fonts. No image is inlined as a `data:` URI. The resizing tools are not committed.
- **Image assets (gate 2).** Every raster is lossy WebP and opaque. No file is more than 2× its largest ordinary render: the map is 3100 for a 1550 full-screen render; the share faces 675 for a 343 phone enlarge; the tiles 300 for a 160 enlarge. The board README records the measured renders.
- **Catalog title image (gate 3).** `cover.webp`, 544 × 680, composed from the supplied art, title readable at 150 and 340 px.
