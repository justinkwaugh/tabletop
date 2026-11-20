# Rules interpretations

Hex has no publisher; its rules are the short set Piet Hein (1942) and John Nash (1948) arrived at, as [HexWiki](https://www.hexwiki.net/index.php/Rules) states them. Choices made where those rules leave room or where online play needs a firm rule are below. Tests in `src/definition/game.spec.ts` and `src/definition/competition.spec.ts` cover them.

## Board

- **Five sizes**: a rhombus of hexagons 9, 11, 13, 14 or 19 to a side; 11 (Hein's classic board, played at the Computer Olympiad) is the default. 13 is the size most played online, 14 the size Nash suggested.
- **Cells are named as HexWiki names them**: a letter for the column, A at the left edge, and a number for the row, 1 at the top edge. A1 is the top-left corner; each row sits half a cell further right than the one above.
- **Each player owns two opposite edges**: Red the top and bottom, Blue the left and right. A corner cell lies on one edge of each player and counts for both.

## Play

- **Red places first**, then the players alternate, one stone on any empty cell. Stones never move.
- **Joining your edges wins at once**: the player whose stone completes one chain of their stones touching both of their edges wins. Two cells are in one chain only if they share a side. A full board always holds exactly one such chain, so there are no draws.

## Swap rule

- **The swap rule is an option, on by default**, as in all serious play, since the first move is otherwise a large advantage.
- **Swapping trades colours**: Blue may answer Red's first stone by swapping. The stone stays red, the swapping player becomes Red, and the other player, now Blue, places next. The swap is open only on that one turn and cannot be swapped back. (HexWiki also describes the equivalent "swap pieces" form, which mirrors the stone across the long diagonal and changes its colour so each player keeps theirs; trading colours avoids moving a stone.)

## Who plays Red

- **The Red option** chooses at game creation: Random (the default), the game creator, or the opponent. The creator is the seat whose user created the game; in a local game, where every seat belongs to that user, it is the first seat. If the creator does not play, Red is drawn by lot.
- **Tournaments** seat players in order: seat one plays Red whatever the option says.

## Scores

- **Hex is won or lost**: the winner scores 1 and the loser 0.
