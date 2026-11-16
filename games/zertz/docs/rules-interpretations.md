# Rules interpretations

Choices made where the [rules](https://www.gipf.com/zertz/rules/rules.html) are silent, where table talk would decide, or where online play needs a firm rule. Tests in `src/definition/game.spec.ts`, `src/model/board.spec.ts` and `src/definition/competition.spec.ts` cover them.

## Setups

- **Standard, Blitz and Tournament** are offered, Standard by default. Standard: 37 rings and 6 white, 8 grey and 10 black marbles; a player wins with 4 white, 5 grey, 6 black or 3 of each. Blitz: 37 rings, 5/7/9 marbles, and a win with 3 white, 4 grey, 5 black or 2 of each. Tournament: 48 rings, with the standard marbles and win, as the rules keep both on an enlarged board.

## Turn order

- **First player.** The rules draw lots; the game's seeded turn order does, and a tournament's seat one moves first. Player colours only tell the players apart, and stay with their players whatever the seating.

## A move

- **One move.** Placing a marble and removing a ring are one action, so Undo takes back both.
- **Free ring.** A free ring is vacant and has two neighbouring sides open (off the board or where a ring was taken away), so it can slide out without moving the others.
- **No free ring.** When no ring is free after the placing, the move ends without removing one. A placing that ends the game removes none either.

## Captures

- **One jump per action.** Each jump is its own action. While the marble that jumped can jump again it must, and the chain's further jumps are its only legal actions. Undo takes back one jump at a time.
- **Choosing among captures** is free, as the rules allow, whatever the number of marbles each would take.
- **A winning jump ends the chain.** The game ends as soon as the mover holds a winning set, even mid-chain.

## Isolated groups

- **Claimed automatically by the mover.** The rules let the player who isolates a group claim it if no ring in it is vacant. The game always claims such a group for the mover, whether the placing filled it or the removal cut it off. A group with a vacant ring stays on the board.

## End of the game

- **A winning set.** Captured and claimed marbles both count. The first player to hold a winning set wins.
- **Full board.** The player who fills the last vacant ring claims every remaining ring and wins.
- **Empty pool.** Once the pool is empty, a player places marbles from their own captures, any colour they hold. A player who then has none to place, and no capture to make, loses; the rules do not say what happens.
- **Repeated sequences.** The rules call a game a tie once the players start repeating the same sequence of moves. Here the game is drawn when the position a player faces at the start of their turn (the rings, the marbles on them, both players' captures, and who is to move) comes round a third time, which gives either player two chances to break the sequence. A position can come round again only once the pool is empty and while no ring leaves the board, so only the positions since then are kept. A drawn game names both players as winners, as the site's results expect.
- **Scores.** ZÈRTZ has no points: the winner scores 1 and the loser 0, and a drawn game gives both 1.
