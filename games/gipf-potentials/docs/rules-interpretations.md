# Rules interpretations

Choices made where the rules are silent, where table talk would decide, or where online play needs a firm rule. The rules are GIPF's ([tournament rules](https://www.gipf.com/gipf/rules/rules.html)) with the potentials of the GIPF project ([introduction](https://www.gipf.com/project_gipf/potentials/introduction.html)); "General use" and each potential's rules are numbered as on those pages. Tests in `src/definition/game.spec.ts` and `src/definition/competition.spec.ts` cover them.

## Versions and setup

- **Standard, Tournament and Ultimate** are offered, Standard by default. Standard: 18 pieces each and three GIPF-pieces each on the board. Tournament: 18 pieces each and an empty board. Ultimate: a Tournament start with 21 pieces each (the 3 extra basic pieces) and 3 potentials of every kind.
- **Starting corners.** As GIPF: White starts on E2, B5 and H5, Black on E8, B2 and H2.
- **Which potentials.** Each of the five kinds is off or 3 to 6 per player, the same for both (General use 1 sets the minimum of 3). The rules set no total, so none is imposed. With no kind chosen the game uses 6 YINSH, the default. Ultimate fixes every count at 3.
- **White moves first.** The game's creator chooses who plays White: chosen at random, the creator, or the opponent. In a tournament, seat one plays White.

## Bringing pieces in

- **Loaded pieces first, but not only.** General use 3 asks for every potential to be loaded before the first plain piece, and says potentials not in play by then are lost. A player may therefore push a plain piece while potentials remain in hand; those potentials then leave the game. The table offers the plain piece last.
- **GIPF-pieces in Tournament and Ultimate.** A player's first piece is a GIPF-piece, and GIPF-pieces may come in, as many as the reserve allows, until their first loaded or plain piece.

## Potentials

- **TAMSK, your own push.** Pushing your TAMSK-loaded piece onto E5 earns the extra move at once, before any row is taken, since the two moves are one turn (TAMSK 4). An extra move not made loses the potential.
- **TAMSK, the opponent's push.** The extra move opens your next turn, once the rows of the opponent's turn are taken (TAMSK 3). It is made only if your TAMSK-loaded piece still stands on E5 when your turn begins. Rows it makes are taken after your regular move.
- **ZÈRTZ and YINSH** never land on a dot. ZÈRTZ jumps a line of adjacent pieces to the first empty spot; YINSH slides along empty spots.
- **DVONN onto a cover.** A DVONN-potential may jump onto the opponent's basic piece that covers your own GIPF-piece (after their PÜNCT); your GIPF-piece stays covered.
- **PÜNCT onto a GIPF-piece** needs at least one piece in reserve. The player chooses to cover with one piece or, with two in reserve, with a GIPF-piece of their own; the potential leaves the game.

## Rows

- **Rows are taken after the regular move, the mover first.** The mover takes their rows one at a time, then the opponent takes the rows of their colour that must go. Rows are found again after each removal, since taking a piece can uncover one beneath it. A row the opponent's removal uncovers for the mover waits until after the opponent's next move; one the mover's removal uncovers for the opponent is the opponent's to take at once. This is the order PÜNCT 7 and DVONN 6 set, with the start of each turn's removals made at the end of the turn before it.
- **What may stay.** GIPF-pieces and loaded pieces may stay; plain pieces and used potentials must go (General use 7 and 9). A row of four holding a loaded piece must be broken: at least one of its four goes (General use 8).
- **Rows of GIPF-pieces alone wait for their owner.** They are never forced. Their owner may take one before pushing or after. A row it frees for either player waits until after the move.
- **Which pieces stay.** The player taking a row decides piece by piece. Their own pieces stay and the opponent's go unless they choose otherwise.
- **What a removal does.** Own basic pieces return to the reserve, a GIPF-piece as two; the opponent's are captured. Potentials, loaded or used, leave the game either way.

## End of the game

- **Losing the last GIPF-piece.** A player with no uncovered GIPF-piece on the board loses at the end of a turn (PÜNCT 7). In Tournament and Ultimate this applies only once that player has moved. If one turn leaves both players without one, the mover wins.
- **No move.** A player who can neither push a piece nor use a potential when their regular move is due loses (General use 10).
- **Scores.** The game has no points: the winner scores 1 and the loser 0.
