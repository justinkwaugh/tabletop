# Ride the Rails art plan

Every visual, its source, and the budget it must meet. What players see and press is fixed by the UI contract (`games/ride-the-rails-ui/docs/ui-interaction-visual-contract.md`); ids and counts are those of `components.md`.

**One source: drawn in code from data.** The title ships no publisher art and no supplied images. The map is drawn from the hex and city tables the logic package transcribes from `components.md`, never from an image of the printed board. Cubes, passengers, money, markers, the round track, the seat cards and the cover are SVG and CSS built from a small shape vocabulary. A railroad's piece, which the rules call a locomotive, is drawn as a wooden cube. MarraCash (`games/marracash-ui`) is the model for a title drawn wholly in code, and Magna Grecia's board layers (`games/magna-grecia-ui/src/lib/components/board/`) for a hex map.

## Palette

**The look is chosen in one place.** It is a light board (paper palette, a ring of start colours, city groups tinted, coin bonuses, wooden cubes, a navy passenger figure), and every one of those six picks is a named constant in one module, `src/lib/utils/boardLook.ts` (`BOARD_LOOK`). Switching a pick is a one-line change there; the module lists the other options considered and where each would be drawn.

Colours are CSS custom properties in `src/app.css` of the UI package, scoped to `[data-game-ui="ride-the-rails"]`. The tokens every palette shares (railroad colours, coins, cubes, passenger, the pick colours) sit on the title root; each palette's own (land, sea, city tints, panels, ink) sit in a block `[data-rtr-palette='<name>']`, and the table carries `data-rtr-palette` from `BOARD_LOOK.palette`. A new palette is a new block and a new column in the table below. The board is a printed board on the table: it keeps one look in the site's light and dark themes, and the panels and seat cards take its paper. Each token is also a Tailwind colour of the same name (`bg-rtr-panel`). Components use these tokens and never a raw colour; `palette.spec.ts` fails on a raw colour in any component.

Two meanings are fixed across titles: **amber says "yours to act on"** (`--rtr-accent`) and **rose says "costs or threatens"** (`--rtr-cost`). Neither is ever a seat colour or a railroad colour.

| Token                   | Meaning                                                                               | Paper       |
| ----------------------- | ------------------------------------------------------------------------------------- | ----------- |
| `--rtr-table`           | The table behind the board, and the full-screen bar                                   | `#EFE8D8`   |
| `--rtr-panel`           | Panels: the margin boxes, the strip, the log, popups                                  | `#F9F5EC`   |
| `--rtr-panel-raised`    | A raised card or button: seat cards, chips, the hex detail                            | `#FFFDF7`   |
| `--rtr-line`            | Rules and panel borders                                                               | `#D9CFB8`   |
| `--rtr-ink`             | Text on the table, the panels and the map                                             | `#2A2722`   |
| `--rtr-ink-muted`       | Secondary text, captions, disabled buttons                                            | `#6E665A`   |
| `--rtr-sea`             | The board's ground around the land                                                    | `#CFE3EA`   |
| `--rtr-sea-shelf`       | The pale shelf along the coast                                                        | `#E2EEF1`   |
| `--rtr-coast`           | The coast line                                                                        | `#54808F`   |
| `--rtr-plain`           | A plain hex, and the halo under city names                                            | `#F5EDD8`   |
| `--rtr-mountain`        | A mountain hex's fill                                                                 | `#E0CBA3`   |
| `--rtr-mountain-ink`    | The mountain glyph's peaks                                                            | `#8C6D45`   |
| `--rtr-hex-edge`        | Hex edges                                                                             | `#DACBA8`   |
| `--rtr-hex-city`        | A city hex outside the four groups                                                    | `#FFFCF3`   |
| `--rtr-hex-city-rim`    | Its rim                                                                               | `#BFA77A`   |
| `--rtr-hex-east`        | An East Coast city hex (rose)                                                         | `#F4D8CF`   |
| `--rtr-hex-east-rim`    | Its rim                                                                               | `#A9503B`   |
| `--rtr-hex-west`        | A West Coast city hex (lilac)                                                         | `#E8DCF0`   |
| `--rtr-hex-west-rim`    | Its rim                                                                               | `#6E43A0`   |
| `--rtr-hex-chicago`     | Chicago's hex (amber)                                                                 | `#F9E1BF`   |
| `--rtr-hex-chicago-rim` | Its rim                                                                               | `#B86C12`   |
| `--rtr-hex-five`        | A $5 city's hex (green)                                                               | `#DCEBCF`   |
| `--rtr-hex-five-rim`    | Its rim                                                                               | `#3F7F48`   |
| `--rtr-station`         | A station disc, the white of the start ring, the passenger's outline                  | `#FFFFFF`   |
| `--rtr-station-ink`     | The station glyph, its capacity, the start ring's outline                             | `#2B2B2B`   |
| `--rtr-ink-light`       | Letters and initials on a dark fill                                                   | `#FFFFFF`   |
| `--rtr-accent`          | Yours to act on: lit and picked rings, the acting seat's outline                      | `#D18E0F`   |
| `--rtr-accent-fill`     | The soft fill inside a lit hex                                                        | `#E8A31733` |
| `--rtr-accent-start`    | The fainter ring on a city lit for a start only                                       | `#D18E0F80` |
| `--rtr-cost`            | Costs or threatens: the mountain "−1" mark                                            | `#C8506A`   |
| `--rtr-halo`            | The dark halo under every ring, pip, mark and route line, the last journey's included | `#1B1B1B`   |
| `--rtr-scrim`           | The dimming scrim over the map                                                        | `#2A272240` |
| `--rtr-coin`            | Money: coins, the Chicago "$2" coin                                                   | `#E2B33C`   |
| `--rtr-coin-rim`        | A gold coin's rim                                                                     | `#9A7316`   |
| `--rtr-coin-ink`        | The amount on a gold coin                                                             | `#2B2205`   |
| `--rtr-five`            | The $5 coin and mark                                                                  | `#357F45`   |
| `--rtr-five-rim`        | The $5 coin's rim                                                                     | `#25633A`   |
| `--rtr-coin-used`       | A $5 coin once its bonus is gone                                                      | `#D9D3C5`   |
| `--rtr-coin-used-rim`   | Its rim                                                                               | `#A39C8D`   |
| `--rtr-coin-used-ink`   | Its amount and the stroke through it                                                  | `#5C564B`   |
| `--rtr-gold`            | The Transcontinental: its mark, claim and claimed line                                | `#B9851F`   |
| `--rtr-passenger`       | A waiting passenger (navy)                                                            | `#1E3A5C`   |
| `--rtr-passenger-gone`  | The dashed outline a taken passenger leaves                                           | `#9A9384`   |
| `--rtr-cube-edge`       | A cube's outline                                                                      | `#2B1D10`   |
| `--rtr-cube-shade`      | The shade over a cube's sides and its grain                                           | `#3A1F05`   |
| `--rtr-cube-sheen`      | The light on a cube's top and its worn edge                                           | `#FFFFFF`   |
| `--rtr-railroad-red`    | Red railroad                                                                          | `#C8372D`   |
| `--rtr-railroad-blue`   | Blue railroad                                                                         | `#2F6DB5`   |
| `--rtr-railroad-orange` | Orange railroad                                                                       | `#E5892A`   |
| `--rtr-railroad-yellow` | Yellow railroad                                                                       | `#EBCB3C`   |
| `--rtr-railroad-purple` | Purple railroad                                                                       | `#7E4FA3`   |
| `--rtr-railroad-black`  | Black railroad                                                                        | `#24262B`   |

The scrim is the paper's ink at 25% (`#2A272240`): on a light board it greys the land without turning it dark, a cube's dark edge still stands at least 1.5:1 from the dimmed plain, and the lit hexes, undimmed and ringed in `--rtr-accent`, stand clear of the rest.

The railroad colours are rule colours: they name the railroads in the rules (R-1.1) and appear only on railroad things (cubes, start rings, pips, route links, strip entries, share rows). Each has its letter ink as a token too, `--rtr-railroad-<name>-ink`, set to `--rtr-ink-light` or `--rtr-halo`, whichever meets the contrast (Seat colours and colour blindness); the $5 coin's amount takes `--rtr-five-ink`, set to `--rtr-ink-light`.

### Seat colours

Seats take their colours from a set of their own, kept apart from the six railroad colours (Red, Blue, Orange, Yellow, Purple, Black) and from the amber pick colour, so a seat's bar, chip or marker is never read as a railroad or as "yours to act on". The game offers seats only these colours, and `gameSession.colors` assigns them; there are five, one per seat at the most (R-1.2). They are the platform colours Green (shown as Teal), Pink, White, Brown and Gray, given these values by `definitions/seatPalette.ts`, the runtime's `playerColorPalette`. Each is one value in both themes: initials and edges take their ink by contrast (Seat colours and colour blindness).

| Seat colour | Value     | Nearest fixed colour (CIE76 ΔE) | Initials ink, contrast | Contrast notes                                                               |
| ----------- | --------- | ------------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| Teal        | `#15736E` | Black, 39                       | white, 5.7:1           | 4.8:1 on a plain hex, 5.6:1 on a seat card                                   |
| Pink        | `#F2A0D6` | Purple, 40                      | dark, 8.8:1            | Light on a plain hex (1.7:1), so a dark edge there                           |
| White       | `#F4F4F0` | Blue, 69                        | dark, 15.6:1           | Barely shows on a plain hex or a seat card (1.1:1): always a dark edge there |
| Brown       | `#6E4126` | Black, 37                       | white, 8.6:1           | 7.4:1 on a plain hex                                                         |
| Grey        | `#8C939B` | Blue, 42                        | dark, 5.5:1            | 2.7:1 on a plain hex and 3.1:1 on a seat card, so a dark edge there          |

"Nearest fixed colour" is the closest of the six railroad colours and amber; the closest pair inside the set is Teal and Grey (ΔE 31). Contrast is WCAG contrast against the plain hex (`--rtr-plain`) and the seat card (`--rtr-panel-raised`). The seat card's disc and the turn order's markers carry a dark edge, so White and Pink still read on the paper.

## Fonts

| Family                                               | Use                                                                                                 | Licence file                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Big Shoulders Display, Bold 700, Latin subset, woff2 | The seat card's name, position and money figure, the round track's numerals, the title on the cover | `src/lib/fonts/BigShouldersDisplay-OFL.txt` (SIL Open Font License 1.1) |
| The site's own text font, not shipped by the title   | Everything else: city names, panels, chips, popups, the log                                         | none (the site's)                                                       |

The file is `src/lib/fonts/BigShouldersDisplay-Bold.woff2`, instanced at weight 700 from the family's variable font and subset to Latin. It is declared under the title's own family name, "Ride the Rails Display" (`definitions/fonts.ts`), and loaded through `CustomFont` in `GameTable`; the `rtr-display` class sets it.

## Board

**Geometry from data.** One `utils/boardGeometry.ts` with a spec turns the logic package's map data into board units. Hexes are pointy-topped with size `s` (centre to corner): a hex's centre is `x = dcol × (√3 s / 2)`, `y = row × 1.5 s` (`components.md`, Coordinates), plus the margin. Each city also has a label anchor (above, below, left or right of its station) in a small table in the same file, chosen so no two labels overlap at the fitted desktop scale; the spec checks every city has one. Nothing is measured from a picture.

**Extents from data.** The board's extents are the bounding box of the hex set in the logic package's map data, plus a fixed margin on every side, one constant in `utils/boardGeometry.ts` measured in hex sizes. Nothing else widens the board. The margin gives the outermost city labels, rings, pips and marks room at the map's edge, and gives popups an anchor that stays on the board; on desktop the margin panels sit in it, at the map's empty lower corners. The extents are the same at every width; on phones the margin panels move above the board and the margin keeps only its edge room.

**The coast** is the outer boundary of the hex set, computed once from the geometry and drawn twice: a wide pale stroke under the hexes, the sea's shelf, and a slate line over them. No state borders, rivers or lakes are drawn: the map data has none and no rule uses them.

**Margin.** On desktop the margin panels sit in the board's fixed margin, at the map's empty lower corners (UI contract, The table): the lower left (the Pacific, below row 12) the round track and the turn order track; the lower right (the Atlantic, below row 13) the railroad strip and the Transcontinental claim's medallion. The geometry spec checks that no margin box covers a hex. Phones leave the margin out: the round badge and the railroad entries form a strip above the board, ended by the claimed medallion, a gold disc with its amount ringed in the claimant's colour (UI contract, Phone layout).

**Layers**, back to front, as the contract's render ownership sets them: sea, shelf and coast; hexes (plain, mountain with its glyph, cities tinted by group with a rim); cities (station with its capacity, name, start ring, bonus coin); passengers and the outlines of those taken; track (cubes) and this turn's bars; the claimed Transcontinental line, then the last journey line over its halo; the scrim; the staged route; rings, pips and marks; the flight layer; hit targets. All in one SVG.

**Hit targets** are transparent hex polygons carrying the hex id, one per hex, in the top layer.

## Pieces and tokens

Every look below is one pick in `src/lib/utils/boardLook.ts` (Palette); the pick is named in brackets.

| Element                | Drawn how                                                                                                                                                                                                                                                                                                                                                                                | Drawn in                                                                                                                                      | Colour source                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Cube                   | (`piece: 'wood-cube'`) An isometric wooden cube, 10 units across: one outline in the railroad's colour with a dark edge, three gradients laid over its top (a sheen) and sides (shade), a few grain strokes and a light worn edge; its letter (R, B, O, Y, P, K) on top where the cube is at least 13 px wide on screen. `flat-cube` drops the gradients and grain for flat shaded sides | `board/RailroadPiece.svelte`, `board/RailroadCube.svelte`, `board/CubeShading.svelte`, `board/RailroadPieceIcon.svelte`, `utils/cubeShape.ts` | `--rtr-railroad-*`; `--rtr-cube-edge`, `--rtr-cube-shade`, `--rtr-cube-sheen`; letter ink by contrast |
| Cube slots             | Two per ordinary hex side by side (28 wide); two below an ordinary city's station (20); one, central, below an East Coast city's (21); Chicago up to six in two rows around its station (15)                                                                                                                                                                                             | `utils/trackLayout.ts` (with a spec for every capacity)                                                                                       | —                                                                                                     |
| Hex colouring          | (`hexFill: 'city-groups'`) Plain and mountain hexes by terrain; city hexes lighter with a rim, and tinted by group: East Coast rose, West Coast lilac, Chicago amber, the $5 cities green. `terrain` and `city-tint` are drawn too                                                                                                                                                       | `board/GroundLayer.svelte`, `utils/boardLook.ts` (`hexPaint`)                                                                                 | `--rtr-plain`, `--rtr-mountain`, `--rtr-hex-*`                                                        |
| Passenger              | (`passenger: 'figure'`) A navy standing figure (head disc, body) with a white outline, right of the station, about 12 px tall at the phone's zoom; once taken, a dashed outline where it stood                                                                                                                                                                                           | `board/PassengerFigure.svelte`, `utils/passengerLayout.ts`                                                                                    | `--rtr-passenger` with a `--rtr-station` edge; `--rtr-passenger-gone`                                 |
| Station                | A white disc; the capacity in it ("1" on an East Coast city, "∞" on Chicago), else a station-roof glyph                                                                                                                                                                                                                                                                                  | `board/CityLayer.svelte`                                                                                                                      | `--rtr-station`, `--rtr-station-ink`                                                                  |
| Start ring             | (`startMark: 'ring'`) A ring round the station, dark outline and white ground, with one segment per start colour (four on an East Coast city, two on a West Coast city, three on Chicago); two colours split top and bottom                                                                                                                                                              | `board/StartRing.svelte`, `utils/cityMarks.ts`                                                                                                | `--rtr-railroad-*`, `--rtr-station`, `--rtr-station-ink`                                              |
| Bonus coin             | (`bonus: 'coin'`) A coin up and left of the station (beside Chicago's), with an offset-shape shadow: green "$5", grey and struck through once a cube has used it up; gold "$2" on Chicago. 29.6 units across, about 14 px at the phone's zoom                                                                                                                                            | `board/BonusCoin.svelte`, `utils/cityMarks.ts` (`bonusCoin`)                                                                                  | `--rtr-five*`, `--rtr-coin-used*`, `--rtr-coin*`                                                      |
| Transcontinental claim | A gold medallion in the margin with the claimant's seat marker and the amount                                                                                                                                                                                                                                                                                                            | `board/TranscontinentalClaim.svelte`                                                                                                          | `--rtr-gold`, seat colour                                                                             |
| Transcontinental line  | A thin gold polyline through the hex centres of the claimed line, drawn from the claim to the end of the game, beside the medallion                                                                                                                                                                                                                                                      | `board/LineLayer.svelte`, `utils/routePath.ts`                                                                                                | `--rtr-gold`                                                                                          |
| Mountain               | Two peaks, drawn inline as paths in each mountain hex; raised and smaller once a cube stands there                                                                                                                                                                                                                                                                                       | `board/GroundLayer.svelte`                                                                                                                    | `--rtr-mountain-ink`                                                                                  |
| Seat marker            | A disc with the seat's initials (the shortest start of the name, up to three letters, that no other seat's name shares, else its first letter and seat number; a blank name shows the seat number), on the turn order track; the initials are drawn only from a set zoom level up, and below it the disc's colour alone names the seat                                                   | `board/SeatMarker.svelte`                                                                                                                     | `gameSession.colors`; ink and edge by contrast                                                        |
| Round marker           | A punched-ticket shape on the round track                                                                                                                                                                                                                                                                                                                                                | `board/RoundTrack.svelte`                                                                                                                     | `--rtr-ink`, `--rtr-panel`                                                                            |
| Coin chip              | A coin with an amount, for bonuses, dividends and fares in flight                                                                                                                                                                                                                                                                                                                        | `board/CoinChip.svelte`                                                                                                                       | `--rtr-coin`                                                                                          |
| This turn's bar        | A thin bar under a cube placed this building turn                                                                                                                                                                                                                                                                                                                                        | `board/TrackLayer.svelte`                                                                                                                     | seat colour                                                                                           |
| Route line             | A polyline through hex centres, each link in its railroad's colour, over a wider halo; station dots at the cities visited. The last journey is the same line, thinner, on the same halo                                                                                                                                                                                                  | `utils/routePath.ts`                                                                                                                          | `--rtr-railroad-*`, `--rtr-halo`                                                                      |
| Rings, pips, marks     | Lit, start-only (fainter) and picked rings, railroad pips (hollow for a start), gain and cost marks, each over the halo, sized by `viewScale()`                                                                                                                                                                                                                                          | `board/PickLayer.svelte`, `board/MarkPill.svelte`                                                                                             | `--rtr-accent`, `--rtr-accent-start`, `--rtr-cost`, `--rtr-five`, `--rtr-coin`, `--rtr-gold`          |
| Scrim                  | One even-odd path with holes at the lit hexes                                                                                                                                                                                                                                                                                                                                            | `board/ScrimLayer.svelte`                                                                                                                     | `--rtr-scrim`                                                                                         |

Shadows are offset shapes, never filters (`docs/phone-rendering.md`). The wood is gradients and strokes, not a texture, so there are no rasters. Each SVG that draws cubes (the board, the phone's flight layer, each cube icon) defines the three cube gradients once, under an id of its own (`$props.id()`), and every cube inside it shares them.

## Cards and tiles

The game has no cards or tiles. Two drawn faces stand in for "enlarging":

- **Hex detail** (a popup): the hex's name or terrain, its capacity, its cubes as the same cube at a larger size, its start colours, bonus, and passenger.
- **Seat card** (a paper card): edged and marked with a disc in the seat's colour, the name and turn position, a row of cubes per railroad held, and the money as the large figure.

## Icons and symbols

The panel and the log name things in words: a railroad by its name in its colour (`RailroadName.svelte`), a seat by its player name, an amount as plain `$` text, and link counts as "Red ×2". The board's shapes (cube, passenger, station, mountain, coins) are drawn by the components above; none is an SVG symbol shared with the text.

## Seat colours and colour blindness

- **One source.** Every seat-coloured element reads `gameSession.colors`, whose values come from the seat set (Palette, Seat colours); no seat colour is written anywhere else in the title. The platform's colour-blind setting reaches every seat element.
- **Colour alone, zoomed out.** Below the zoom level where seat initials are drawn, colour is all that tells seats apart, which is why the set keeps its members well apart from one another as well as from the railroads and amber.
- **Railroads never rely on colour alone.** Every pip, and every cube large enough to read it, carries its letter, the railroad strip and share buttons carry its name, and the hex detail lists railroads by name. Red against Orange and Blue against Purple are the pairs at risk; the letters settle them. At the phone's zoom a cube's letter would be about 4 px, so there the railroad strip and the hex detail carry the second cue.
- **Seats and railroads never share a shape.** Seats are discs, bars, chips and card headers; railroads are cubes, start rings, pips and route links.
- **Ink by contrast.** A letter or initials on a fill is dark or white, chosen from the fill's luminance so contrast is at least 4.5:1. Letters take `--rtr-railroad-<name>-ink`. Seat initials take the seat palette's `text`, white or `#1B1B1B`. Text on the table, the panels, every hex tint and every coin meets WCAG AA (4.5:1), a used $5 coin's included; the passenger and a cube's edge stand at least 3:1 from every ground they sit on.
- **Checks.** `ink.spec.ts` checks the letter contrast on every railroad fill in every palette, the text, coin, passenger and cube-edge contrasts above, and the initials contrast on every seat colour; `palette.spec.ts` checks that no two railroad colours are closer than a set colour difference (CIE76 ΔE 30), and that every seat colour keeps that difference from each railroad colour, from amber and from the other seat colours.

## Cover

The catalog title image is `src/lib/images/cover.webp`, read by `info.thumbnailUrl`, shown at 150 px and 340 px high: 544 × 680 (4:5), lossy WebP, at most 120 KB. Composition: a band of paper hexes drawn from the board's vocabulary below a light sea, a Red and a Blue wooden cube either side of a station in its start ring, one passenger waiting, a $5 coin, and "Ride the Rails" in Big Shoulders Display across the top third, readable at 150 px. It is rendered once from an SVG by `scripts/render-cover.mjs` in the UI package, in the palette `BOARD_LOOK` picks, and committed with a README beside it stating how it was made; switching the palette means rendering it again.

## Supplied assets

| File | Source | Permission | Rendered size | Natural size |
| ---- | ------ | ---------- | ------------- | ------------ |
| none | —      | —          | —             | —            |

## Specs that guard it

- `palette.spec.ts`: every colour of the Palette is a declared token in every palette, and every declared colour is in the Palette; every palette declares the same tokens; no component names a raw colour; railroad colours stay apart; seat colours stay apart from them, from amber and from each other.
- `images.spec.ts`: the title ships no image or font but the cover and the display font; the cover's size, encoding and weight; no base64 image; no SVG with a script, event attribute, `foreignObject` or external reference.
- `boardGeometry.spec.ts`: every hex and city in the logic's map data has a position and a label anchor, no position names a hex the data lacks, the extents are the data's bounding box plus the fixed margin, and every margin box lies inside the board and covers no hex.
- `trackLayout.spec.ts`: every capacity has slots for its cubes, each at its size and the cube's proportions, inside its hex and clear of the station.
- `ink.spec.ts`: letter, text, coin, passenger and initials contrast, and every railroad's cube told from the plain under the scrim (by its fill or its edge, at least 1.5:1).
- `utils/boardLook.spec.ts`: the six picks, each one of the options drawn; a palette block for every palette option, and the table carrying the pick; the hex colouring of every scheme.
- `utils/cityMarks.spec.ts`: the $5 coin green until used up, then grey and struck through; Chicago's $2 never used up; the coin's size at the phone's zoom; the start ring's arcs; where the coin and passenger sit.
- `tests/lightBoard.spec.ts` (Playwright, desktop and phone): the table, sea and seat cards are paper and the board is light in the site's light and dark themes; every piece is a cube, every taken passenger an outline; cities carry their start rings and coins.
