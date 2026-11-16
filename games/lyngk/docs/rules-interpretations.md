# Rules interpretations

Choices made where LYNGK's published rulebook is silent, where table talk would decide, or where online play needs a firm rule. Tests in `src/definition/game.spec.ts` and `src/definition/competition.spec.ts` cover them.

## Variants

- **Standard and Stack of 6** are offered, Standard by default. Standard: a stack of 5 topped by your claimed colour leaves the board and scores. Stack of 6: stacks of 5 stay, a joker also counts as white, and a stack of 6 topped by your claimed colour wins at once; a neutral top does not.

## Turn order

- **First player.** The seeded turn order draws who goes first; a tournament's seat one moves first.

## Claims

- **One claim per turn, before the move**, at most two per player.
- **A claim must leave the player a move**: a colour whose claim would leave them none is not offered.

## Moves

- **Jokers** come down to "no two real pieces of one colour in a stack", so jokers may share a stack.
- **The LYNGK-rule.** A stack topped by your claimed colour may chain through stacks topped by the same colour. Only the moving stack's own claimed colour links: a stack of the opponent's claimed colour is landed on, never chained through. Each LYNGK-point is used once.
- **The point the stack leaves counts as empty** during a chain, so a chain can run back across it.
- **The route.** The route through LYNGK-points never changes a move's outcome, so one tap on a landing makes the move along the shortest route.

## Passing and the end

- **Passing is automatic** (rule E12): a player with no move, even after a claim still open to them, is passed, and the move that ended the turn records the player passed over.
- **The game ends when neither player can act.** The ranking compares stacks scored (in Stack of 6, stacks of 5 on the board), then stacks of 4, 3, 2 and singles. Each count is of stacks topped by a colour the player claimed; neutral tops count for no one. A neutral-topped stack of 5 whose colour is claimed later stays on the board as an obstacle and never scores.
- **A full tie is a draw**, naming both players as winners, as the site's results expect.
- **Scores.** LYNGK is won or lost: the winner scores 1 and the loser 0, and a draw gives both 1. The cards and the end panel show the ranking.
