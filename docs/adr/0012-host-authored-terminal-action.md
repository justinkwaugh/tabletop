# Called games end through one host-authored terminal Action

A Called Game ends when the host appends a reserved System Action, `callGame`, which the shared engine handles itself before any title handler: it validates the call, sets only the base `result`, `winningPlayerIds` and `activePlayerIds`, and records the Action and its undo patch through the normal path, so history, checksums, replay and administrator Undo work unchanged. Machine state is left alone, because titles validate it as their own enum, so the invariant is restated as: a Game State with a result accepts no further Actions, whatever its machine state. The engine enforces it before executing an Action and in valid-action discovery.

We rejected a per-title concede Action (Urbino's pattern), which repeats the feature in every title; a vote held in Game State, which republishes every Logic Artifact and adds a base field to live games; forcing the Action through every title's handlers; and a host bypass with hand-built patches, which spreads special cases across the store, delivery and client reconciliation.

## Consequences

- The backend executes `callGame` with the engine from its own build of the shared code, but every UI Artifact embeds its own copy, so a title can be called only once its published UI declares the `calledGames` client capability. The backend reads that from the UI Artifact's catalog entry and refuses calls before it.
- Code that groups System Actions into the cascade of the User Action before them must treat `callGame` as its own run: replay, cascade ends, Fork positions, live delivery and visibility projection all do.
- Shared code that ties a result to a title's terminal machine state no longer holds; the 18xx family now ties only final wealth to GameOver.
