# 1817 board presentation and private tile lays

1817's board puts a tall market above the map, as 1846's does. That needed four presentation
options in the shared 18xx UI and one change to when the family offers a private tile lay.

## Surveyed

The presentation and map views of every implemented title: TOP, Shikoku 1889, 1830, 1817, 1832
and 1846. For the market, their `marketZones`. For the map, their `terrainPositions` (was
`terrainHeights`) and tile `layouts`. For private lays, every title's `PrivatePowerRules.trackTerms`
and the shared `companyDecisionsHandler` and `AutomaticTrackCompletionHandler`.

## Market zones

- **Variations.**
    - 1817's printed market starts with a red Liquidation space, then three grey Acquisition
      spaces drawn as a group a little apart from the rest.
    - 1846 heads its Par and Triple-jump zones with banners.
    - 1832 colours whole zones, ledges included.
    - TOP, 1889 and 1830 have no zones.
- **Shared.** `MarketZone` adds three options:
    - `label`: text printed sideways down each of the zone's spaces.
    - `setApart`: a gap either side of the zone's columns.
    - `MarketZoneFill.ink`: the text colour on a solid fill.

    `marketGeometry` (`marketTokenLayout.ts`) works out the columns, gaps and size once. The scene,
    the token stacks, the lower-right corner the table uses, and the playground's board-area check
    all read it, so every cell keeps its width and the gaps are columns of their own.

- **Title-owned.** The zones' colours, names, labels and banners. Only 1817 sets `label`,
  `setApart` or `ink` today.
- **Later.** A gap between rows, and a set-apart zone that is not a run of whole columns; no
  surveyed title prints either.

## Map placement

- **`terrainPositions`.**
    - Before, a hex's terrain cost could only be moved up or down. 1817's Detroit and New York put
      their lakes beside their cities, so a position now takes x and y.
    - 1830's and 1889's settings were moved over as x = 0.
    - Unlike the other layout positions, these are not turned with a pointy tile.
- **`TileLayout.slotRowTurns`.**
    - This turns a city's row of station circles by degrees.
    - Cleveland's two stations lie level, clear of its revenues.
    - No other title needs it yet. A title sets it per hex, in its map view.

## Private tile lays

- **Shared.**
    - A tile-laying private power is offered in a company's turn only when it has a legal, affordable
      placement (`hasLegalPrivateTrackUse`). Out-of-turn lays and the map's highlights already used
      that test.
    - A power with nowhere to lay no longer keeps a finished track step open. 1817's coal mines count
      as one of the company's two lays, so a company that had used both waited on a lay it could not
      make.
- **Title-owned.** The terms of each private's power: its hexes, its tiles, and whether it counts
  as an ordinary lay.
- **Intentional limit.** A private lay the company cannot yet afford is not offered until it
  borrows. The track step stays open while ordinary lays remain and a loan is possible.

## Examples

- **`marketTokenLayout.spec.ts`:** sets 1817's zones apart and keeps each cell's full width.
- **`maps.spec.ts`:** keeps 1817's market and depot clear of every hex using its real cells and
  zones.
- **`privatePowers.spec.ts`:** a company holding a coal mine finishes its track step after two
  ordinary lays.
- **`table.spec.ts`:** the operating strip keeps private actions on a second line at every width.
