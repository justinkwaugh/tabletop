# Known deviations

Where this implementation still differs from the rules or a component's published text. `rulings.md` holds readings, which are not deviations. Each line names the rule or component, what the engine or UI does instead, and what governs.

## Rules

- **R-4.6.3, R-4.6.4 The hidden-bead draw:** the game picks one of the two beads at random; the rules have an opponent hide one in each hand and the actor pick a hand. Governs: R-4.6-H2.

## Component text

None yet.

## Not covered by specs

One line for each entry of the provisional registry (`src/data/provisional.ts`), which `provisional.spec.ts` checks both ways. Confirming a value deletes its entry and its line in the same change.

- **`route.road.*` The road routes:** those of the community map aid. Settled by a clear picture of the board. Governs: R-1.2-H1.
- **`route.ship.*` The ship routes:** those of the community map aid. Settled by a clear picture of the board. Governs: R-1.2-H1.
- **`route.submersible.*` The submersible routes:** those of the community map aid. Settled by a clear picture of the board. Governs: R-1.2-H1.
- **`route.flying-machine.*` The flying-machine routes:** those of the community map aid. Settled by a clear picture of the board. Governs: R-1.2-H1.
- **`guild.monk.rosary` The rosary's capacity:** unlimited. Settled by the printed board or a designer ruling. Governs: R-1.4-H3.
- **`guild.farmer.chicken.*` The chicken spaces:** 4, the setup bead on the first. Settled by the printed board or a designer ruling. Governs: R-1.4-H3.
- **`guild.*` Each guild's charity:** Farmer, Merchant and Alchemist pay the church coffer; Knight, Noble and Monk the farmer's purse. Settled by the designer's ruling. Governs: R-4.6-H3.
- **`card.action.repeat` The either/or mark on Repeat:** none. Settled by the Repeat card at legible size.
- **`writ.charter.northern-kingdom` Two dots on the Northern Kingdom:** read as badlands-2 and mountain-1. Settled by the physical card beside the board.

## Platform limits

None yet.
