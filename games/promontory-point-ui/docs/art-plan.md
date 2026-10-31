# Promontory Point art plan

Every visual, its source, and the budget it must meet. What is an image and what is drawn from data is fixed by the UI contract (`ui-interaction-visual-contract.md`, "Images and data", and choices O-1 to O-11). Component counts and ids are in `games/promontory-point/docs/components.md`.

**Two sources, nothing else:**

- **The supplied art**, made for this title: the map, the four share card faces, the eight town tile faces (and a share back and a tile back, which are not used, O-7).
- **Drawn in code from data**, as SVG: track pieces (R-X.4), price and money markers, the strip's cards (the bag, the decks' prices and counts, the end tracker), every count, all pick chrome and the seat cards.

No other art is drawn to stand in for a supplied image, and no supplied image is redrawn.

## Palette

Colours are CSS custom properties in `src/app.css`, declared on `:root` and rewritten to `[data-game-ui="promontory-point"]` by the scope plugin, as Oath does. Components use these tokens and never a raw colour; `palette.spec.ts` fails on a raw colour anywhere else in the package. Seat colours are not tokens: they come from `gameSession.colors` (see [Seat colours](#seat-colours-and-colour-blindness)).

The table is drawn as the map's own paper and keeps the map's colours in both site themes, so Light and Dark are the same. Every chrome colour is sampled from the map: the olive of its hexes, its paper, the sea, the decade markers' brown and Promontory's charcoal. Railroad colours are sampled from the four home hexes on the map; each has a darker rim of the same hue for the drawn pieces.

| Token             | Meaning                                                                                  | Light             | Dark |
| ----------------- | ---------------------------------------------------------------------------------------- | ----------------- | ---- |
| `--pp-table`      | The table surround: the olive of the map's hexes, with a faint dot texture               | `#4B4733`         | same |
| `--pp-column`     | The side column, a little darker                                                         | `#3F3C2B`         | same |
| `--pp-panel`      | The control bar, the active tab, the action area and the history: the map's paper        | `#E6D9B1`         | same |
| `--pp-line`       | Rules on the surround                                                                    | `#5E5940`         | same |
| `--pp-text`       | Text on the surround (tabs, captions)                                                    | `#E6D9B1`         | same |
| `--pp-muted`      | Secondary text on the surround                                                           | `#B8AD8A`         | same |
| `--pp-paper`      | The map's paper: seat cards, the strip's cards, secondary buttons                        | `#E9DDB6`         | same |
| `--pp-paper-deep` | The deeper paper of a coupon (cash, share price)                                         | `#DCCD9D`         | same |
| `--pp-paper-line` | Hairline rules on paper                                                                  | `#B4A47A`         | same |
| `--pp-ink`        | Text on paper                                                                            | `#2F2D27`         | same |
| `--pp-ink-sub`    | Secondary text on paper ("$4 ea", "shares worth", the italic lines)                      | `#5A5545`         | same |
| `--pp-teal`       | The sea: the turn header's whose-turn tab                                                | `#5B8984`         | same |
| `--pp-teal-deep`  | The deep sea: the tab's lower edge                                                       | `#3F6763`         | same |
| `--pp-brown`      | The decade markers' brown: Undo, "No. n", the strip's headings, coupon dashes            | `#86684D`         | same |
| `--pp-charcoal`   | Promontory's charcoal: the primary button, count badges, outlines on markers             | `#484741`         | same |
| `--pp-accent`     | **Yours to act on**: lit ring, picked ring, the acting or deciding seat's ring and tag   | `#F5A524`         | same |
| `--pp-accent-ink` | Text on amber                                                                            | `#1D1404`         | same |
| `--pp-cost`       | **Costs or threatens**: Repairs chips, "short $3"                                        | `#E11D48`         | same |
| `--pp-cost-ink`   | Text on rose                                                                             | `#FFFFFF`         | same |
| `--pp-gain`       | The neutral Dividend chip ("you +$4")                                                    | `#E9F2E4`         | same |
| `--pp-ok`         | "paid ✓", "enough", on paper                                                             | `#3D7A3A`         | same |
| `--pp-halo`       | The dark halo under every ring, outline and chip                                         | `#111111`         | same |
| `--pp-veil`       | The veil over the board outside the lit hexes                                            | `#0A0C0C` at 50 % | same |
| `--pp-decided`    | The neutral dashed outline (being decided, this turn's placements)                       | `#E8E6E1`         | same |
| `--pp-hidden`     | A concealed hand piece                                                                   | `#8D8A7E`         | same |
| `--pp-cp`         | Central Pacific: pieces, price marker, tags                                              | `#6897A6`         | same |
| `--pp-cp-rim`     | Central Pacific's darker rim on pieces                                                   | `#3F6875`         | same |
| `--pp-up`         | Union Pacific                                                                            | `#806679`         | same |
| `--pp-up-rim`     | Union Pacific's rim                                                                      | `#56424F`         | same |
| `--pp-kp`         | Kansas Pacific                                                                           | `#9B3A2A`         | same |
| `--pp-kp-rim`     | Kansas Pacific's rim                                                                     | `#62221A`         | same |
| `--pp-sp`         | Southern Pacific                                                                         | `#E3CB6E`         | same |
| `--pp-sp-rim`     | Southern Pacific's rim                                                                   | `#A8903C`         | same |
| `--pp-rr-ink`     | Paper ink on a railroad colour: rail marks, rings, initials (`--pp-sp` takes `--pp-ink`) | `#F3EAD0`         | same |

Two meanings are fixed across titles: amber (`--pp-accent`) says "yours to act on" and rose (`--pp-cost`) says "costs or threatens". Nothing else is amber or rose: the primary button is charcoal and Undo brown. Kansas Pacific's red and the red Repairs and Dividend tiles are game colours, not the rose role: a rose chip always carries a label and the dark halo, and a railroad colour never carries a chip colour.

## Fonts

| Family                                                             | Use                                                                                                                                                                                                                                                   | Source                                                                                     |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Oswald, 500 and 600, Latin subset, woff2                           | Names, figures and caps labels: the seat card's name and cash, the turn header's tab and line, the tabs, prompts, buttons, the strip's headings and counts, prices, chips, the score totals, history names; close to the map's own condensed numerals | Oswald, shipped with `src/lib/fonts/Oswald-OFL.txt`                                        |
| Libre Caslon Text, regular 400 and italic 400, Latin subset, woff2 | Small secondary lines in italic: "No. 2", "hand: 3 hidden", "shares worth $18", "pieces left", "at most 1", "Last: …", notes, the end reason, history interstitials                                                                                   | Libre Caslon Text, from Google Fonts, shipped with `src/lib/fonts/LibreCaslonText-OFL.txt` |
| The site's own text font, not shipped by the title                 | Everything else: running text in the panels, the log's lines                                                                                                                                                                                          | the site's                                                                                 |

## Board

- **Geometry source.** One `boardGeometry.ts` holds every position in map-image units (3571 × 2302): hex centres from the logic package's axial coordinates (`x = 2228.73 + 188.09·(q + r/2)`, `y = 1152.09 + 153.45·r`, Promontory at 0,0, pointy-top; half-width 94.05, vertical radius 102.3), measured off the map as recorded in `src/lib/images/board/README.md`; the 30 price-track spaces with one slot per railroad per row (spaces 25 to 3 in the left column, then 2, 1 and the five 0 spaces in the right column); the 100 border-track spaces (0 at the bottom-left corner, clockwise); the strip left of the map (`STRIP_SLOTS`: the bag card, the shares card with its four decks in a 2×2 grid, the end tracker card), at negative x in the same units, and `BOARD_BOUNDS`, the strip, a gap and the map together, which the board's view box and every drawn-unit rect (pick framing, the hex field, flights) are measured from. `boardGeometry.spec.ts` checks that every space in the logic's data has a centre, no centre names a space the data lacks, the four homes are placed, the track tables have 30 and 100 entries in printed order with an even pitch, no two slots or spaces overlap, and the strip's cards stack inside the strip, off the map. The dev harness's `/geometry` page draws every position over the map.
- **Layers, back to front:** map image; town tiles (each clipped to a hex at 0.8 of the cell, over the printed village hex); track pieces; this turn's outlines and badges; price markers; money markers; the strip (the bag, the four share decks, the end tracker); the veil; the being-decided outline; lit rings; hit targets (transparent hex polygons carrying space ids); chips, which take no press, so a chip's overhang never steals one. A chip sits above its hex, below it when a hex in the row above is lit, and inside its hex when both rows are, so it never covers another lit hex.
- **What each layer owns:** only what it draws and its pick chrome, from the board offer (contract, "Coexistence and precedence"). The veil is one path, owned with the lit rings.
- **The strip.** Three paper cards in a column directly left of the map, about 0.18 of its width, inside the board's one scaled surface, so full screen, the phone's panning view and the flight layer need no second layout: "The bag" (count, "pieces left"); "Shares for sale" (each deck's face with its price in a dashed coupon at top left and its count in a charcoal badge at bottom right; buying stays in the panel); "Game ends when both" (red towns open, "at most 1"; Promontory open or taken). Draws leave the bag card's count; bought shares leave their deck.
- **Full screen and phones:** the same surface in the shared scaling wrapper; `coverBelowScale` on phones rests it fitted to the hex field's width, the strip off to the left like the price track.

## Pieces and tokens

| Element                              | Drawn how                                                                                                                                                                                                                                                         | Defs or shape module                                                              | Colour source                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Track piece                          | a disc (radius 0.5 of the hex half-width) in the railroad's colour with a darker rim of the same hue, a thin paper inner ring and a small rail-and-tie mark in paper ink (dark ink on SP); a soft drop shadow. Hand, panel and flight copies use the same drawing | `board/TrackPiece.svelte`, `utils/boardLayout.ts`                                 | `--pp-cp` … `--pp-sp`, their `-rim`, `--pp-rr-ink`                   |
| Concealed hand piece                 | the same disc in `--pp-hidden` with a charcoal rim and "?"                                                                                                                                                                                                        | `HandPiece.svelte`                                                                | `--pp-hidden`                                                        |
| Price marker                         | a hex badge like the home hexes: the railroad's colour, a charcoal outline, a thin inner ring and its initials in Oswald                                                                                                                                          | `board/PriceMarkerLayer.svelte`                                                   | railroad token, `--pp-charcoal`, `--pp-rr-ink`                       |
| Money marker                         | colour only, no letter: a seat-colour disc with a charcoal outline and a thin paper inner ring, a drop shadow; 2×2 in seat order when sharing a space; "+100" mark at 100 or more                                                                                 | `board/MoneyMarkerLayer.svelte`                                                   | `gameSession.colors`                                                 |
| Bag                                  | the strip's first paper card: "THE BAG", the count, "pieces left"                                                                                                                                                                                                 | `board/BagArt.svelte`, `board/StripCard.svelte`                                   | `--pp-paper`, `--pp-brown`, `--pp-ink`                               |
| Share deck                           | the supplied face with a stacked shadow, its price in a dashed coupon and its count in a charcoal badge; an empty deck leaves a dashed outline                                                                                                                    | `board/ShareDeck.svelte`                                                          | `--pp-paper-deep`, `--pp-brown`, `--pp-charcoal`                     |
| End tracker                          | the strip's last paper card: the Dividend face clipped to a hex for "red towns open / at most 1", a charcoal hex for "Promontory open / taken"                                                                                                                    | `board/EndTracker.svelte`                                                         | tokens                                                               |
| Rings, chips, veil, outlines, badges | SVG strokes over the dark halo; chips are fully rounded pills in Oswald                                                                                                                                                                                           | `board/PickChrome.svelte`, `board/ThisTurnLayer.svelte`, `board/ChipLayer.svelte` | `--pp-accent`, `--pp-cost`, `--pp-gain`, `--pp-decided`, `--pp-halo` |

## Cards and tiles

- **Share card** (4 faces). The supplied face is the whole card: "ONE SHARE" and the railroad's home-hex emblem. On the seat card it is a stack of up to four faces 30 px wide with the count and price beside it; in the panel a 38 px face; in the strip a deck about 55 px wide on a desktop board, with its price and count; enlarged 300 px on a desktop and the screen width less 32 px (up to 343 px) on a phone. The same image at every size; no second asset.
- **Town tile** (8 faces). The supplied face is a square; the board clips it to a pointy-top hex a little larger than the printed village hex, so the red tiles keep their red border. The +1 to −3 faces are turned a quarter turn clockwise so the number reads upright (O-6); Dividend and Repairs are drawn as supplied. Enlarged at 160 px.
- **Backs.** Neither the share back nor the tile back is used (O-7): decks and tiles are face up (R-1.3), and a concealed hand piece is drawn in code.

## Icons and symbols

- **Railroads in text:** a small pill in the railroad's colour with its initials (CP, UP, KP, SP), the same vocabulary as the price markers, in panels, the status strip and the log (the `TokenText` pattern).
- **Dividend and Repairs in text:** the supplied tile face at 16 px, clipped to its hex, so the log and the board share one symbol.
- **Money:** "$" in text; no coin art.
- No other icon is drawn.

## Seat colours and colour blindness

Seats and railroads must never be confused (O-1). The title's colour list is four: green, orange, black and white; it leaves out blue, purple, red and yellow, the railroad colours. Seat colour appears only on seat things (the seat card's double rule and dot, money markers, seat-strip chips); railroad colour only on railroad things. Every price marker carries its railroad's initials and every piece its railroad's colour on a hex connected to its home. A money marker is colour only: on a shared space the 2×2 grid keeps seat order, and the colour-blind palette carries through. Colour-blind presentation follows `gameSession.colors`.

## Cover

`cover.webp`, 544 × 680, composed once from the supplied art: a crop of the map around Promontory and two home hexes, the four share cards fanned across the lower half, and "PROMONTORY POINT" in Oswald on a tan band across the top, sized so the title reads at 150 px and 340 px tall. Laid out in a browser, captured at 2× and exported once; the composition file is not committed.

## Supplied assets

Rendered sizes are the largest ordinary render, in CSS px. Every file is opaque lossy WebP: the supplied faces carry an alpha channel but their corners are opaque, so it is dropped.

| File                                         | Source                                             | Rendered size                                                                                                            | Natural size                                                               |
| -------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `board/map.webp`                             | the supplied map (3571 × 2302)                     | about 1550 wide: a desktop full screen at 1920 × 1080, height-bound; the phone's pick framing renders it about 1470 wide | 3100 × 1998 (resized from 3571, 2× the full-screen render), at most 800 KB |
| `cards/share.{cp,up,kp,sp}.webp`             | the supplied share faces (675 × 1050)              | 343 wide (phone enlarge), 300 (desktop enlarge)                                                                          | 675 × 1050 (as supplied, under 2× of 343), at most 70 KB each              |
| `tiles/tile.price.{plus,minus}-{1,2,3}.webp` | the supplied price tile faces (300 × 300)          | 160 (enlarge); about 70 on a full-screen board                                                                           | 300 × 300 (as supplied, under 2× of 160), at most 20 KB each               |
| `tiles/tile.red.{dividend,hammer}.webp`      | the supplied Dividend and hammer faces (300 × 300) | as above                                                                                                                 | 300 × 300, at most 20 KB each                                              |
| `cover.webp`                                 | composed from the map and share cards (above)      | 340 tall (catalogue)                                                                                                     | 544 × 680, at most 120 KB                                                  |

Not shipped: the supplied share back and tile back (O-7).

**Budget.**

| Group           | Files   | Ceiling                                  |
| --------------- | ------- | ---------------------------------------- |
| Map             | 1       | 800 KB                                   |
| Share faces     | 4       | 280 KB                                   |
| Town tile faces | 8       | 160 KB                                   |
| Cover           | 1       | 120 KB                                   |
| Fonts           | 4 woff2 | 100 KB (Oswald 60, Libre Caslon Text 40) |
| **Total**       | **18**  | **about 1.5 MB**                         |

The ceilings are limits, not estimates. Each image folder's README records the measured bytes and how the file was made. Images are imported by URL, so none is in the UI entry chunk.

**Extraction.** Only resizing and re-encoding; nothing is cropped or retouched. The map is resized to 3100 wide with a Lanczos filter, then every file is encoded with libwebp, lossy, quality about 82, `-sharp_yuv`, alpha dropped. The tools run outside the repository and are not committed; only the images and their READMEs are added.

**Lookups and their specs.** `boardImages.ts`, `cardImages.ts` and `tileImages.ts` index their folders, as Oath's `cardImages.ts` does. An image coverage spec checks that every railroad id has a share face, every town tile kind has a face, and no file is orphaned.

## Checks

- **Untrusted code, assets.** The drawn SVG is markup in Svelte components; no SVG file carries script, an event attribute, `foreignObject` or an external reference. The only binaries added are the WebP images above and four woff2 fonts. No image is inlined as a `data:` URI. The resizing tools are not committed.
- **Image assets.** Every raster is lossy WebP and opaque. No file is more than 2× its largest ordinary render: the map is 3100 for a 1550 full-screen render; the share faces 675 for a 343 phone enlarge; the tiles 300 for a 160 enlarge. The board README records the measured renders.
- **Catalog title image.** `cover.webp`, 544 × 680, composed from the supplied art, title readable at 150 and 340 px.
