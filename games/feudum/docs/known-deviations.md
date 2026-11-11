# Known deviations

Where this implementation still differs from the rules or a component's published text. `rulings.md` holds readings, which are not deviations. Each line names the rule or component, what the engine or UI does instead, and what governs.

## Rules

- **R-4.6.3, R-4.6.4, R-4.6.5 The hidden-bead draw:** the game picks one of the two beads at random; the rules have an opponent hide one in each hand and the actor pick a hand. Governs: R-4.6-H2.
- **R-4.10.1 Nourishing's feeding order:** a later seat that the game feeds pays its food when nourishing starts, before an earlier asked seat answers. With an empty haversack, food the earlier seat's play would have added cannot feed the later seat, and a later seat's payment can take food the earlier seat might have used. The rulebook feeds every pawn but gives no order; feeding strictly one seat after another waits on the designer's ruling. Governs: R-4.10-H4.

## Component text

None yet.

## Not covered by specs

One line for each entry of the provisional registry (`src/data/provisional.ts`), which `provisional.spec.ts` checks both ways. Confirming a value deletes its entry and its line in the same change.

- **`guild.monk.rosary` The rosary's capacity:** unlimited. Settled by the printed board or a designer ruling. Governs: R-1.4-H3.
- **`guild.farmer.chicken.*` The chicken spaces:** 4, the setup bead on the first. Settled by the printed board or a designer ruling. Governs: R-1.4-H3.
- **`guild.*` Each guild's charity:** Farmer, Merchant and Alchemist pay the church coffer; Knight, Noble and Monk the farmer's purse. Settled by the designer's ruling. Governs: R-4.6-H3.
- **`writ.charter.northern-kingdom` Two dots on the Northern Kingdom:** read as badlands-2 and mountain-1. Settled by the physical card beside the board.

## Reached in play

The scripted games of `completeGame.spec.ts` are held to reach the asks, the dawns, a feudum, a tamed monster and a tended landscape by name. These are proved by their own rule specs only:

- **R-4.2.3 A ferry crossing:** no scripted game takes one. `move.spec.ts`, `media.spec.ts`.
- **R-4.6.6 A krud barrel:** no scripted game invents one. `alchemist.spec.ts`, `knight.spec.ts`.
- **R-4.6 The 18 guild functions:** the scripted games are not held to reach each one by name. `guildTrade.spec.ts`, `guildFunctions.spec.ts` and the Merchant, Alchemist, Knight, Noble and Monk specs.

Reaching them means steering the seats' choices, which changes every scripted game.

## Platform limits

None yet.
