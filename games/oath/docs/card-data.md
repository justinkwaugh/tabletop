# Oath card data

The printed cards as static data in `src/data/`: `denizens.<suit>.data.ts` ×6 (33 each), `sites.data.ts` (23),
`relics.data.ts` (21) and `visions.data.ts` (5). `edifices.data.ts` holds the six edifices, each one card with
two sides (R-2.9); `cardPowers.ts` registers each side's power, the intact side's first.

Bandit Rampart, the ruined side of Sprawling Rampart, is recorded as a defender battle plan. The card-text
export lists it as a Campaign modifier, but the printed card shows a blue power box with a crown round the
Campaign icon, which Law 7.5 makes a battle plan only the defender may use; the printed card is followed.

The engine reads each card's power fields through `cardPowers.ts`, so an edit to a power's text is
an engine change.

Game state stores card ids only, never card data. Ids are permanent.
