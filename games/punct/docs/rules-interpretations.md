# Rules interpretations

Choices made where the PÜNCT rulebook is silent, where table talk would decide, or where online play needs a firm rule. Where the rulebook leaves a question open, PÜNCT follows BoardSpace's implementation. Tests in `src/definition/game.spec.ts` and `src/definition/competition.spec.ts` cover them.

## Versions

- **Standard and Basic** are offered, Standard by default. In Standard, no new piece enters the central hexagon, and placing the last piece decides the game on the central spaces each player controls; equal counts draw. In Basic, only White's first piece stays out of the centre, and the last piece placed without a connection draws the game ("undecided").

## Who plays White

- **The White option** chooses at game creation: Random (the default), the game creator, or the opponent. White moves first. The creator is the seat whose user created the game; in a local game, where every seat belongs to that user, it is the first seat. If the creator does not play, White is drawn by lot.
- **Tournaments** seat players in order: seat one plays White whatever the option says.

## Moving

- **A piece is lifted before it moves**, so it never rests on itself.
- **Turning a piece in place is a move.** Putting it back unchanged is not. The straight piece with its PÜNCT in the middle, turned half round, counts as unchanged, though it keeps the way round it was put.
- **Any covered dot freezes a piece**, including a dot under the middle of a bridge.

## Bridges

- **Nothing may go into a space under a bridge**, at any level, whether it is a new piece or a moved one.
- **A PÜNCT can be the unsupported middle of a bridge** only if the top piece below it is the mover's (BoardSpace's reading).

## Passing and the end

- **Any completed connection ends the game at once.** If only the opponent's connection is complete, the opponent wins. If the move completes both, the mover wins (BoardSpace's reading).
- **A player with no legal action passes.** The action that ended the previous turn records them as `passedPlayerId`. If neither player can act, the game is a draw (`NoMoves`). A player keeps a piece in reserve until the game ends, and two sets of 18 can hardly cover the board enough to leave that piece no space, so neither is expected in play. The tests show both on boards filled with neutral pieces.
- **Scores.** PÜNCT is won, lost or drawn. The winner scores 1 and the loser 0, and a draw gives both players 1. The central counts stay on the player cards and in the end panel.

## Notation

- **Shown names count each column up from 1** at its bottom space (A1–A7, H1–H16). The logic keeps BoardSpace's names (`spaceName`) for tests and scenarios.
