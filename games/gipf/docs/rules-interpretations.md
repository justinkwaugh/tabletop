# Rules interpretations

Choices made where the rules ([tournament rules](https://www.gipf.com/gipf/rules/rules.html), [complete rules](https://www.gipf.com/gipf/rules/complete_rules.html)) are silent, where table talk would decide, or where online play needs a firm rule. Tests in `src/definition/game.spec.ts` and `src/definition/competition.spec.ts` cover them.

## Versions

- **Basic, Standard and Tournament** are offered, Standard by default. Basic: 15 pieces each, three single pieces of each colour start on the board, and there are no GIPF-pieces. Standard: 18 pieces each, three GIPF-pieces of each colour start on the board. Tournament: 18 pieces each, an empty board, and a player brings in GIPF-pieces until their first single piece.
- **Starting corners.** White starts on e2, b5 and h5, Black on e8, b2 and h2, so dot e1 faces White. The rules' diagram gives the pattern but not which colour takes which corners.

## Turn order

- **White moves first.** The first player in turn order plays White; a tournament's seat one is that player.

## Rows

- **The mover resolves first.** After a push, the mover takes every row of four or more of their colour they choose to, then the opponent takes the rows of the opponent's colour that must go.
- **Rows of only GIPF-pieces wait for their owner.** A row made only of GIPF-pieces is never forced. Its owner may take it at the start of their own turn, before pushing, or after their push.
- **GIPF-pieces in a taken row.** The player taking a row decides, piece by piece, whether their own GIPF-pieces in it stay; they stay unless taken. The rules let the taker leave the opponent's GIPF-pieces too. The logic accepts that, but the UI always takes them. This difference is under review.

## End of the game

- **Losing the last GIPF-piece.** A player with no GIPF-piece on the board loses at the end of a turn. In Tournament this applies only once that player has moved, since the board starts empty. If one turn takes both players' last GIPF-pieces, the mover wins.
- **No move.** A player who cannot bring in a piece at the start of their turn loses: either their reserve is empty, or every push line is full.
- **Scores.** GIPF has no points: the winner scores 1 and the loser 0.
