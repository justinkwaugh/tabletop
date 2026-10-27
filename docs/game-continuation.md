# Game continuation

A Finished Game can offer **Continue** when its Game Title carries play over into a next game. Continue opens the ordinary create-game form, prefilled from the finished game, and the new game's initializer receives the finished game's final state. Who plays next, and how many, are up to the people creating it: the form starts with the same Players, Game Configuration, name and visibility, and all of them can be changed. The finished game's result is unchanged.

## Title contract

1. Set `initializer.supportsContinuation = true`.
2. Set `canContinue = true` on the Game State together with the final `result`, once every end-of-game choice that affects the next game has been made. Leave it unset for outcomes that cannot continue. A Called Game never sets it.
3. Read the fourth argument of `initializeGameState(game, state, assignment?, continuation?)`:

```ts
type GameContinuation<T> = {
    previousState: Readonly<T> // canonical final state of the finished game
    previousPlayers: readonly Player[] // the finished game's Players, with userId and name
}
```

Copy what carries over into the fresh state and leave everything else alone. The fresh state keeps its own game identity, randomness and history counters. The first game of a series has no continuation.

The new game's Players have new player IDs and may be different people, so carryover cannot be keyed by player ID. Carry over things that belong to no one (a campaign map, a shared deck, an era marker). To carry over a Player's own things, match `previousPlayers` to the new Players by `userId` for Hosted Games. Hotseat Players all share the owner's `userId`, so match them by name or seat. A title that needs exactly the same people at the table should not adopt continuation until the platform supports a locked roster.

The engine re-validates the stored state against the title's current state schema before calling the initializer, and refuses to start if it no longer validates. A lobby can wait a long time before it starts, so a title must keep accepting the final states its earlier Publications produced.

## Lifecycle

- **Who**: any Player of the finished game (and administrators). Each Continue creates another game, so one finished game can be continued several times.
- **Hosted Games**: the create request carries `options.continueFromGameId`. The backend checks the source and the requester, captures the source's canonical final state and Players into the new game's private `continuation` document in the creation transaction, and records `continuedFromGameId` on the new game. Starting the lobby reads that document, so later Undo or deletion of the source cannot change the next game's setup. The captured state never appears in lobby metadata, list responses or notifications.
- **Local Games** are continued as Local Games. The site loads the source from IndexedDB and starts the new game immediately with the same continuation input. Local game records copy `canContinue` from their saved state.
- Forks clear `canContinue` and `continuedFromGameId`. Explorations and deleted games cannot be continued.

## Publication

The backend must be released before the Site Frontend: an older backend rejects `continueFromGameId` as an unknown creation option. No Game UI Host Bridge Contract member changes, and no UI Artifact needs republishing for the platform change. A title adopts continuation with a Logic-changing Publication that implements the initializer and sets `canContinue`. No current title is opted in.
