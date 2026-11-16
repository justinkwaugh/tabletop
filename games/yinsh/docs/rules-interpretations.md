# Rules interpretations

Choices made where the [rules](https://www.gipf.com/yinsh/rules/rules.html) (Rio Grande 2016, which gipf.com agrees with) are silent, where table talk would decide, or where online play needs a firm rule. Tests in `src/definition/game.spec.ts` and `src/definition/competition.spec.ts` cover them.

## Versions

- **Standard and Blitz** are offered, Standard by default. Standard: the first player to remove three rings wins. Blitz: the first ring removed wins.

## Turn order

- **First player plays White** (rule C2), whatever the seating. The game's seeded turn order draws who goes first, and a tournament's seat one moves first.

## Passing

- **A player who cannot move passes.** If none of a player's rings can move, their turn is skipped and the other player moves again. The action that ended the turn records the player passed over.
- **Neither player can move.** The game ends as it does on an empty pool: most rings removed wins, and equal counts draw.

## Rows

- **The mover resolves their rows first.** After a move the mover takes each of their rows, with a ring for each, then the opponent takes any rows the move made for them, before the opponent moves.
- **Crossing rows.** Where two rows share a marker, the player chooses which to take. Taking one may break the other.
- **A run longer than five.** The player chooses any five adjacent markers of it.
- **The mover wins first.** The mover wins on their third ring (first in Blitz) even if a winning row of the opponent's formed in the same move.

## End of the game

- **Empty pool.** The check comes after the move and every row and ring removal it caused, for both players. A row made with the last marker returns its markers, and play goes on.
- **Draws.** A drawn game names both players as winners, as the site's results expect.
- **Scores.** YINSH has no points: the winner scores 1 and the loser 0, and a draw gives both 1.
