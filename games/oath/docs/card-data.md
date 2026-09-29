# Oath card data

The printed cards as static data in `src/data/`: `denizens.<suit>.data.ts` ×6 (33 each), `sites.data.ts` (23),
`relics.data.ts` (21) and `visions.data.ts` (5).

The engine reads each card's power fields through `cardPowers.ts`, so an edit to a power's text is
an engine change.

Game state stores card ids only, never card data. Ids are permanent.
