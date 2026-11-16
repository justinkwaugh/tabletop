# Rules interpretations

Choices made where the TZAAR rulebook is silent, where table talk would decide, or where online play needs a firm rule. Rule letters are the rulebook's. Tests in `src/definition/game.spec.ts` and `src/definition/competition.spec.ts` cover them.

## Versions

- **Random, Fixed and Tournament** are offered, Random by default (C2). Random spreads all 60 pieces over the board at random. Fixed uses the rulebook's start position (H, diagram 4). In Tournament (I), White places first, then the players alternate one piece each until all 60 are on the board, and White then makes the opening capture.

## Who plays White

- **The White option** chooses at game creation: Random (the default), the game creator, or the opponent. White moves first. The creator is the seat whose user created the game; in a local game, where every seat belongs to that user, it is the first seat. If the creator does not play, White is drawn by lot.
- **Tournaments** seat players in order: seat one plays White whatever the option says.

## Turns

- **White's opening turn is a single capture** in every version (D). The first move of any turn is a capture and can never be a pass.
- **A missing second move passes the turn.** If a first capture leaves the player no capture and no stack to make, the turn passes automatically, and the capture records it (`noSecondMove`) for the history.

## Stacking

- **A stack never covers its owner's last top piece of a type**, since that would leave them without a Tzaar, Tzarra or Tott on top (B1). Such a stacking is never offered. The rules would allow it as a losing move.

## The end

- **Taking the last top piece of a type wins at once**, even on the first move of a turn. Buried pieces do not count (F4, G). The capture records the type taken (`eliminatedKind`) and nothing else about the opponent.
- **A player who cannot capture when their turn begins loses** (G). The action that ended the previous turn records them as `stuckPlayerId`, and the next turn starts from that record. This includes the last Tournament placement, though with every stack one piece high White always has a capture there.
- **No draw is possible.** The winner scores 1 and the loser 0.

## Notation

- **Coordinates follow the rulebook:** columns A–I, each counted up from 1 at its bottom point. Column E skips the centre, running E1–E4 below it and E5–E8 above.
