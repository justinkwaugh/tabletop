# Rules interpretations

Choices made where the MATRX GIPF rules (Rio Grande Games, 2024) are silent, where table talk would decide, or where online play needs a firm rule. Section letters refer to the rulebook. Tests in `src/definition/game.spec.ts` and `src/definition/competition.spec.ts` cover them.

## Board and setup

- **Two boards.** The MATRX board (40 spots, column J of four dots) is the default. The 37-spot GIPF board is offered as an option for a denser, usually longer game.
- **White moves first.** The game's creator chooses who plays White: chosen at random, the creator, or the opponent. In a tournament, seat one plays White.
- **Reserves.** Each player starts with 3 GIPF pieces and 6 potentials of each kind in reserve, and an empty board. Potentials are kept as counts per kind; any two of a kind form a stack that can be brought in (rule G6).

## GIPF pieces

- **A GIPF piece that cannot come in.** Rule F5 says a GIPF piece in reserve must be played first. When no line has room for a push, the player makes any other legal move instead.

## Rows

- **Rows are taken after every move, the mover's first.** After a regular move, the mover takes their rows one at a time, then the opponent takes theirs. Rows are found again after each removal, since taking a piece can uncover one beneath it that completes a new row.
- **A row uncovered for the mover by the opponent's removal** stands through the opponent's next move, and its owner takes it after that move.
- **What a removal takes.** Every single piece in the row's reach goes. Stacks of two may stay, but at least one piece of the row of four must go (rule E1). A row of five stacks broken at one end leaves a row of four, which must be taken again.
- **Which stacks stay.** The player taking a row decides stack by stack. The table offers the player's own stacks as staying and the opponent's as going, and either can be switched.

## TAMSK extra moves

- **Your own TAMSK stack onto E5.** The extra move comes at once, before any rows are taken, since the two moves are one turn (rule H1.4).
- **An extra move not made.** The top TAMSK potential leaves the game, and the bottom one stays on E5 as a used single.
- **The opponent's push.** When the opponent pushes your TAMSK stack onto E5, the extra move opens your next turn, once the rows of the opponent's turn are taken (rule H1.3). It is made only if the stack still stands on E5 when your turn begins. Rows it makes are taken after your regular move.

## End of the game

- **Losing the last GIPF piece.** A player with no GIPF piece left, on the board or in reserve, loses at once, even if rows still stand. A removal captures only the opponent's pieces, so both players cannot lose their last GIPF piece together.
- **No move.** A player who can neither bring in a piece nor move a potential when their regular move is due loses.
- **Scores.** MATRX GIPF has no points: the winner scores 1 and the loser 0.
