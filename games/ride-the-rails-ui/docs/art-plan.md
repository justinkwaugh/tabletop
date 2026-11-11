# Ride the Rails art plan

Every visual, its source, and the budget it must meet. What players see and press is fixed by the UI contract (`games/ride-the-rails-ui/docs/ui-interaction-visual-contract.md`); ids and counts are those of `components.md`.

**One source: drawn in code from data.** The title ships no publisher art and no supplied images. The map is drawn from the hex and city tables the logic package transcribes from `components.md`, never from an image of the printed board. Locomotives, passengers, money, markers, the round track, the seat cards and the cover are SVG and CSS built from a small shape vocabulary. MarraCash (`games/marracash-ui`) is the model for a title drawn wholly in code, and Magna Grecia's board layers (`games/magna-grecia-ui/src/lib/components/board/`) for a hex map.

## Palette

Colours are CSS custom properties in `src/app.css` of the UI package, scoped to `[data-game-ui="ride-the-rails"]`. Components use these tokens and never a raw colour; `palette.spec.ts` fails on a raw colour anywhere in the package.

Two meanings are fixed across titles: **amber says "yours to act on"** (`--rtr-accent`) and **rose says "costs or threatens"** (`--rtr-cost`). Neither is ever a seat colour or a railroad colour.

| Token                   | Meaning                                                          | Light       | Dark        |
| ----------------------- | ---------------------------------------------------------------- | ----------- | ----------- |
| `--rtr-table`           | The table behind the board                                       | `#DCD3BE`   | `#1E2328`   |
| `--rtr-sea`             | The board's ground around the land                               | `#B9CDD6`   | `#22343D`   |
| `--rtr-plain`           | A plain hex                                                      | `#EFE6CF`   | `#3A3A33`   |
| `--rtr-mountain`        | A mountain hex's fill                                            | `#C9B593`   | `#57503F`   |
| `--rtr-mountain-ink`    | The mountain glyph's peaks                                       | `#7A6648`   | `#9C8B6C`   |
| `--rtr-hex-edge`        | Hex edges and the coast outline                                  | `#CDBF9F`   | `#4A4638`   |
| `--rtr-station`         | A city's station disc                                            | `#FFFFFF`   | `#E8E2D2`   |
| `--rtr-station-ink`     | The station glyph, capacity marks, city names on the station     | `#2B2B2B`   | `#1B1B1B`   |
| `--rtr-panel`           | Panels, popups, the margin's boxes                               | `#F6F1E4`   | `#2A2F35`   |
| `--rtr-panel-raised`    | A raised chip or button on a panel                               | `#FFFDF7`   | `#343A41`   |
| `--rtr-line`            | Rules and panel borders                                          | `#BDB29A`   | `#4B525A`   |
| `--rtr-ink`             | Text on the table, panels and map                                | `#2A2A2A`   | `#ECE7DC`   |
| `--rtr-ink-muted`       | Secondary text, disabled buttons                                 | `#6B6458`   | `#A8A193`   |
| `--rtr-accent`          | Yours to act on: lit and picked rings, the acting seat's outline | `#D18E0F`   | `#F2B33D`   |
| `--rtr-accent-fill`     | The soft fill inside a lit hex                                   | `#E8A31733` | `#F2B33D33` |
| `--rtr-cost`            | Costs or threatens: the mountain "−1" mark                       | `#C8506A`   | `#E36F88`   |
| `--rtr-halo`            | The dark halo under every ring, pip, mark and route line         | `#1B1B1B`   | `#0D0D0D`   |
| `--rtr-scrim`           | The dimming scrim over the map                                   | `#1B1B1B73` | `#00000099` |
| `--rtr-coin`            | Money: coins, the Chicago "$2"                                   | `#D7B44A`   | `#E2C25E`   |
| `--rtr-five`            | The $5 cities' banner and mark                                   | `#3F8F4F`   | `#5DB26C`   |
| `--rtr-gold`            | The Transcontinental: its ends, mark and claim                   | `#B9851F`   | `#D9A43A`   |
| `--rtr-railroad-red`    | Red railroad                                                     | `#C8372D`   | `#D9473C`   |
| `--rtr-railroad-blue`   | Blue railroad                                                    | `#2F6DB5`   | `#4A86CF`   |
| `--rtr-railroad-orange` | Orange railroad                                                  | `#E5892A`   | `#EE9A3E`   |
| `--rtr-railroad-yellow` | Yellow railroad                                                  | `#EBCB3C`   | `#F0D555`   |
| `--rtr-railroad-purple` | Purple railroad                                                  | `#7E4FA3`   | `#9668BC`   |
| `--rtr-railroad-black`  | Black railroad                                                   | `#24262B`   | `#24262B`   |

The railroad colours are rule colours: they name the railroads in the rules (R-1.1) and appear only on railroad things (locomotives, pips, route links, strip entries, share rows). Seat colours come from the session.

## Fonts

| Family                                               | Use                                                                                                                    | Licence file                                                            |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Big Shoulders Display, Bold 700, Latin subset, woff2 | The seat card's departure board (name, money figure, share counts), the round track's numerals, the title on the cover | `src/lib/fonts/BigShouldersDisplay-OFL.txt` (SIL Open Font License 1.1) |
| The site's own text font, not shipped by the title   | Everything else: city names, panels, chips, popups, the log                                                            | none (the site's)                                                       |

The file is `src/lib/fonts/BigShouldersDisplay-Bold.woff2`, declared under the title's own family name and loaded through `CustomFont`.

## Board

**Geometry from data.** One `utils/boardGeometry.ts` with a spec turns the logic package's map data into board units. Hexes are pointy-topped with size `s` (centre to corner): a hex's centre is `x = dcol × (√3 s / 2)`, `y = row × 1.5 s` (`components.md`, Coordinates), plus a margin. Each city also has a label anchor (above, below, left or right of its station) in a small table in the same file, chosen so no two labels overlap at the fitted desktop scale; the spec checks every city has one. Nothing is measured from a picture.

**The coast** is the outer boundary of the hex set, computed once from the geometry and drawn as one path over the sea ground. No state borders, rivers or lakes are drawn: the map data has none and no rule uses them.

**Margin.** On desktop the board's empty lower corners hold the margin (UI contract, The table): the lower left (the Pacific, below row 12) the round track and the turn order track; the lower right (the Atlantic, below row 13) the railroad strip and the Transcontinental claim. The geometry spec checks that no margin box covers a hex.

**Layers**, back to front, as the contract's render ownership sets them: ground and coast; hexes (plain, mountain with its glyph); cities (station, name, capacity mark, start-colour pips, bonus banner, Transcontinental end); passengers; track and this turn's bars; the last journey line; the scrim; the staged route; rings, pips and marks; the flight layer; hit targets. All in one SVG.

**Hit targets** are transparent hex polygons carrying the hex id, one per hex, in the top layer.

## Pieces and tokens

| Element                | Drawn how                                                                                                                                                       | Defs or shape module                                    | Colour source                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| Locomotive             | A side-view steam locomotive: boiler, cab, chimney, cow-catcher, two wheels; the railroad's monogram (R, B, O, Y, P, K) on the cab; a dark edge, light on Black | `LocomotiveDefs.svelte`, `utils/locomotiveShape.ts`     | `--rtr-railroad-*`; monogram ink by contrast                           |
| Locomotive slots       | Two per ordinary hex side by side; one, central, on an East Coast city; Chicago up to six in two rows around its station                                        | `utils/trackLayout.ts` (with a spec for every capacity) | —                                                                      |
| Passenger              | A small standing figure (head disc, body) at the station's upper right                                                                                          | `PassengerDefs.svelte`, `utils/passengerShape.ts`       | `--rtr-ink` with a `--rtr-station` edge                                |
| Station                | A disc with a station-roof glyph                                                                                                                                | `CityDefs.svelte`                                       | `--rtr-station`, `--rtr-station-ink`                                   |
| Capacity mark          | "×1" or "∞" badge on the station's edge                                                                                                                         | `CityDefs.svelte`                                       | `--rtr-station-ink`                                                    |
| Start-colour pips      | One dot per start colour around the station (four on an East Coast city, two on a West Coast city, three on Chicago)                                            | `CityDefs.svelte`                                       | `--rtr-railroad-*`                                                     |
| $5 banner              | A green pennant with "$5", greyed once the bonus is gone                                                                                                        | `CityDefs.svelte`                                       | `--rtr-five`                                                           |
| Chicago $2             | A coin with "$2" beside the station                                                                                                                             | `CoinDefs.svelte`                                       | `--rtr-coin`                                                           |
| Transcontinental end   | A small gold rail tie under the station of each West and East Coast city                                                                                        | `CityDefs.svelte`                                       | `--rtr-gold`                                                           |
| Transcontinental claim | A gold medallion in the margin with the claimant's seat marker and the amount                                                                                   | `CoinDefs.svelte`                                       | `--rtr-gold`, seat colour                                              |
| Mountain               | Two peaks, drawn once and placed with `<use>`                                                                                                                   | `TerrainDefs.svelte`                                    | `--rtr-mountain-ink`                                                   |
| Seat marker            | A disc with the seat's initials (two letters where two seats share one), on the turn order track                                                                | `MarkerDefs.svelte`                                     | `gameSession.colors`; ink and edge by contrast                         |
| Round marker           | A punched-ticket shape on the round track                                                                                                                       | `MarkerDefs.svelte`                                     | `--rtr-ink`, `--rtr-panel`                                             |
| Coin chip              | A coin with an amount, for bonuses, dividends and fares in flight and in text                                                                                   | `CoinDefs.svelte`                                       | `--rtr-coin`                                                           |
| This turn's bar        | A thin bar under a locomotive placed this building turn                                                                                                         | inline                                                  | seat colour                                                            |
| Route line             | A polyline through hex centres, each link in its railroad's colour, over a wider halo; station dots at the cities visited                                       | `utils/routePath.ts`                                    | `--rtr-railroad-*`, `--rtr-halo`                                       |
| Rings, pips, marks     | Lit and picked rings, railroad pips (hollow for a start), gain and cost marks, each over the halo, sized by `viewScale()`                                       | `PickDefs.svelte`                                       | `--rtr-accent`, `--rtr-cost`, `--rtr-five`, `--rtr-coin`, `--rtr-gold` |
| Scrim                  | One even-odd path with holes at the lit hexes                                                                                                                   | inline                                                  | `--rtr-scrim`                                                          |

Shadows are offset shapes, never filters (`docs/phone-rendering.md`). There are no textures, so no rasters.

## Cards and tiles

The game has no cards or tiles. Two drawn faces stand in for "enlarging":

- **Hex detail** (a popup): the hex's name or terrain, its capacity, its locomotives as the same locomotive shape at a larger size, its start colours, bonus, and passenger.
- **Seat card** (a departure board): a seat-coloured header with the name and turn position, rows of locomotives per railroad held, and the money as the large figure.

## Icons and symbols

One vocabulary for the map, the panel and the log (token text, as Oath's `TokenText` does): `$` amounts as coin chips, the locomotive in a railroad's colour, the passenger, the station, the mountain, and a link glyph (two rail ties joined) for link counts. Each is an SVG symbol from the defs above, named so a sentence can say "3 {link} on {railroad.red}".

## Seat colours and colour blindness

- **One source.** Every seat-coloured element reads `gameSession.colors`; no seat colour is written in the title. The platform's colour-blind setting reaches every seat element.
- **Railroads never rely on colour alone.** Every locomotive and pip carries its monogram, the railroad strip and share buttons carry its name, and the hex detail lists railroads by name. Red against Orange and Blue against Purple are the pairs at risk; the monograms settle them.
- **Seats and railroads never share a shape.** Seats are discs, bars, chips and card headers; railroads are locomotives, pips and route links.
- **Ink by contrast.** A monogram or initials on a fill is dark or white, chosen from the fill's luminance so contrast is at least 4.5:1; Black's locomotive has a light edge on dark ground.
- **Checks.** `ink.spec.ts` checks the monogram contrast on every railroad fill in both themes; `palette.spec.ts` checks that no two railroad colours are closer than a set colour difference.

## Cover

The catalog title image is `src/lib/images/cover.webp`, read by `info.thumbnailUrl`, shown at 150 px and 340 px high: 544 × 680 (4:5), lossy WebP, at most 120 KB. Composition: a band of hexes drawn from the map vocabulary crossing the image, a Red and a Blue locomotive meeting at a station, one passenger waiting, and "Ride the Rails" in Big Shoulders Display across the top third, readable at 150 px. It is rendered once from an SVG by `scripts/render-cover.mjs` in the UI package and committed with a README beside it stating how it was made.

## Supplied assets

| File | Source | Permission | Rendered size | Natural size |
| ---- | ------ | ---------- | ------------- | ------------ |
| none | —      | —          | —             | —            |

## Specs that guard it

- `palette.spec.ts`: every colour is a declared token; railroad colours stay apart.
- `boardGeometry.spec.ts`: every hex and city in the logic's map data has a position and a label anchor, no position names a hex the data lacks, and no margin box covers a hex.
- `trackLayout.spec.ts`: every capacity has slots for its locomotives.
- `ink.spec.ts`: monogram and initials contrast.
- Readiness gates 1 and 2 pass on the first run.
