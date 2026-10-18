# Player Votes

A Player Vote lets the Players of a Hosted Game decide a lifecycle question together (see the [game lifecycle glossary](contexts/game-lifecycle/CONTEXT.md)). Issue #86 records the agreed design. The Undo Vote is built; calling the game and conceding are not.

## Undo Vote

- A Player in History View, at a position earlier than their own Undo reaches, may ask everyone to go back to it. The vote targets the first Action after that position, which must be a User Action.
- Every Player with an account must agree. Any Player may decline, which closes the vote. The Player who asked may withdraw it.
- At most one vote is open. It has no expiry. Play continues while it is open, and the Actions taken meanwhile are undone too when it passes.
- The other Players receive an Attention Notice through web push and Discord.
- Hotseat and Tournament Games have no votes. Finished Games do, since an Authorized Undo may reopen one.
- A passed vote runs the ordinary Undo path with the Player restrictions lifted. The unavailable-history check still applies. Undo restores the random-number position, so replaying draws the same dice and cards.

The shared rule for what a Player's own Undo reaches lives in `libs/common/src/game/engine/playerUndo.ts`. The host uses it to decide whether a request needs a vote, and the Game Session uses it for the Undo button and for the history position it reports.

## Host and UI Artifact contract

The vote is stored on the Game (`Game.vote`), not in Game State, so no Logic Artifact changes. The Game schema accepts unknown fields, so older UI Artifacts load Games that carry a vote.

The strip is host chrome (`apps/frontend/src/lib/components/PlayerVoteStrip.svelte`). It reads the vote from the Site Frontend's game cache, which game update notifications keep current.

Three optional `GameSessionBridge` members come from the shared Game Client bundled into each UI Artifact (ADR 0004):

- `viewedHistoryPosition`: where History View stands, the live game's Action count, and whether the position is beyond the Player's own Undo reach.
- `showHistoryBeforeAction(actionIndex)`: moves History View to the position just before an Action.
- `showLiveGame()`: leaves History View. The host calls it for the Player who asked once their vote passes and the Undo has reached the client.

A UI Artifact gains them only through a new UI-only Publication. Until a title is republished, the host offers the request at every History View position, and the server answers "you can undo this yourself" where Undo already reaches. The host also hides View that point, and the Player who asked stays in History View after the vote passes.
