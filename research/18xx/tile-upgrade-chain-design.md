# Tile upgrade chain

The Tiles tab shows, for a chosen tile, the tiles it may become and the tiles that may become
it. `TileUpgrades` (`libs/18xx/src/construction/tileUpgrades.ts`) builds that graph from a
title's `TrackRules`, and `TileManifest` shows it in a modal.

## Surveyed

The track rules of every implemented title: TOP, Shikoku 1889, 1830, 1817, 1832 and 1846, and
the shared construction rules in `TrackConstruction`.

## Shared behaviour and title choices

One upgrade test serves both play and the chain (`tileReplacement.ts`): the colour step, the
title's stop rule (`preservesStops`) or within-colour upgrade (`upgradesWithinColor`), the hex's
labels (`upgradeLabels` from that colour on, else the replaced tile's), and track kept in some
rotation, where a town may become a city only within its colour.

The chain asks this on every buildable hex, starting from the printed hex, so a label a hex takes
in one colour constrains only that colour and later ones. TOP's yellow X and T hexes therefore do
not let unlabelled yellow tiles become labelled green ones. A title's most-exits rule (`mostExits`,
1817) keeps only the tiles of the colour with the most exits among those that keep the track.

`upgradesWithinColor` judges tiles only; when it becomes allowed is the title's `restriction`
(1832: from phase 3).

## Considered for later

- Game state: phases, private powers (`relabels`, X00), a title's `restriction` (Tampa's brown),
  and a hex's neighbours and map edges, which also narrow `mostExits` on a real hex.
- Printed hexes as starting points: tiles that only replace a printed tile (1830 NY, B and OO,
  1889 440, 1846 298, 1832 190) show no predecessor.

## Examples

`tileUpgrades.spec.ts` covers the colour step, hex labels by colour, an unlabelled tile kept off
a hex labelled in an earlier colour, a within-colour upgrade, and most exits. `mediumCities.spec.ts`
keeps 1832's phase-3 promotion. A comparison over all six titles found no upgrade the chain shows
that a hex would refuse, apart from 1832's within-colour upgrades, which the comparison did not
model.
