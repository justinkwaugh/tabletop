# Ride the Rails engine conventions

The code cites the rules as `R-<section>` of `rules-digest.md`, which holds every rule of the game, including the reading of each question in `open-questions.md`. `R-X.<n>` names a convention of this implementation, below: how the engine takes input, undoes and keeps a game's rules, not a rule of the game.

Rules version: the 2020 rulebook (USA map).

## Conventions

- **R-X.1:** every choice arrives as explicit input from the player it belongs to; the engine infers none.
- **R-X.2:** undo stops at an action that revealed information: one that advanced the random stream, moved a card into or out of concealment, or showed a player something they had not seen.
- **R-X.3:** a game keeps the rules of the revision it was created under (`rideTheRailsRevision`, set at initialization). Revision 1 is the first release. A state from a revision this code does not know is refused at hydration, and a change to how a recorded game plays needs a new revision, with the old behaviour kept for games created under the earlier one. Spec: `gameState.spec.ts` (the unknown revision), `revision.spec.ts` (how revision 1 plays the supply limit, R-1.1 and R-3.1, and Yellow's one start, R-4.2.3).
