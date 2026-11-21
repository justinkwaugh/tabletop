# Rules interpretations

Choices made where Kadon's [rules of play](https://gamepuzzles.com/gameofy.htm) leave room, where table talk would decide, or where online play needs a firm rule. BoardSpace's long-running implementation ([rules](https://www.boardspace.net/y/english/rules.html), source `ddyer0/boardspace.net`, `ygame`) settled the same questions the same way. Tests in `src/definition/game.spec.ts` and `src/definition/competition.spec.ts` cover them.

## Board

- **Kadon's 93-point board by default**: 24 points on the three sides, 9 to a side, 69 inside, of which three (the pentads) have five neighbours. Each corner belongs to both of its sides.
- **Hex boards as an option**: the Board option also offers a regular triangle of hexagons 9, 13 or 19 to a side (45, 91 or 190 cells), the grid Y was long played on before Kadon's board. Every cell touches six others, fewer on the sides; the rules are the same.
- **Hex cells are named as on a Hex board**, by the two lines of cells through them: a letter for the line rising to the right from the bottom side (A at the bottom-left corner), a number for the line rising to the left, counted up the left side. A1 is the bottom-left corner, A13 the top corner of the 13 board and M13 its bottom-right corner.
- **Point names follow BoardSpace**: A1–I1 along the bottom side; rows 2–8 run from the left side round to the right, each inside the one before; row 9 runs from the top corner, A9, down to the pentad E9. [`coordinates.svg`](coordinates.svg) names every point; the game shows the same guide from the ? button by the turn header.

## Play

- **Black places first**, then the players alternate, one stone on any empty point. Stones never move.
- **A Y wins at once**: the player whose stone completes one chain touching all three sides wins. A chain from a corner to the opposite side counts. The board can never fill without a Y, so there are no draws.
- **No handicap stones**: Kadon's handicaps for unequal players are not offered.

## Swap rule

- **The swap rule is an option, on by default**, as Kadon calls it customary between equal players. Kadon describes it as one player choosing the opening stone for the other; online, as on BoardSpace, Black places the first stone and White decides.
- **Swapping trades colours**: White may answer Black's first stone by swapping. The stone stays black, the swapping player becomes Black, and the other player, now White, places next. The swap is open only on that one turn, and cannot be swapped back.

## Who plays Black

- **The Black option** chooses at game creation: Random (the default), the game creator, or the opponent. The creator is the seat whose user created the game; in a local game, where every seat belongs to that user, it is the first seat. If the creator does not play, Black is drawn by lot.
- **Tournaments** seat players in order: seat one plays Black whatever the option says.

## Scores

- **The Game of Y is won or lost**: the winner scores 1 and the loser 0.
