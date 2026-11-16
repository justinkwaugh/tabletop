# Rules interpretations

Choices made where the [rules](https://www.gipf.com/dvonn/rules/rules.html) (Rio Grande 2017, which gipf.com matches word for word) are silent, where table talk would decide, or where online play needs a firm rule. Tests in `src/definition/game.spec.ts` and `src/definition/competition.spec.ts` cover them.

## Versions

- **Standard and Random placement** are offered, Standard by default. Random placement is not in the rulebook: all 49 spaces, the 3 DVONN pieces included, are filled at random, stacking starts at once and White moves first.

## Who plays White

- **The White option** chooses at game creation: Random (the default, standing in for the rulebook's drawing of lots), the game creator, or the opponent. The creator is the seat whose user created the game; in a local game, where every seat belongs to that user, it is the first seat. If the creator does not play, White is drawn by lot.
- **Tournaments** seat players in order: seat one plays White whatever the option says.

## Placing

- **Placement order is fixed** (D1): White, Black and White place the three DVONN pieces, then each player places their own colour, alternately. White places the last piece and also makes the first move (E1).

## Moving

- **A lone DVONN piece never moves** (E7), but a stack holding one moves with whoever controls it.
- **An edge stack is never surrounded** (E6): it has fewer than six neighbours, however full they are.
- **A stack moves exactly its height** onto an occupied space; a stack one space short of a landing has no move there.

## Losing pieces

- **Every stack cut off from the DVONN pieces leaves the board**, whoever owns it (F1, F2). An isolated DVONN piece stays on the board (F3).

## Passing and the end

- **Passing is automatic** (E8, G1): a player with no legal move is passed, and the action that ended the turn records the player passed over. A player who was passed moves again once a move opens up. When the board fills and White has no first move, White is passed and Black moves first. A Random placement start that leaves White no move passes White too, with no action to record it.
- **The game ends when neither player can move.** Each player's total is every piece in the stacks they control, DVONN pieces included (G2); the higher total wins, and equal totals draw (G3). A drawn game names both players as winners, as the site's results expect.
- **Scores.** DVONN is won or lost: the winner scores 1 and the loser 0, and a draw gives both 1. The stack totals stay on the player cards and in the end panel.
