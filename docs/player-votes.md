# Player Votes

A Player Vote lets the Players of a Hosted Game decide a lifecycle question together (see the [game lifecycle glossary](contexts/game-lifecycle/CONTEXT.md)). Issue #86 records the agreed design. Both kinds are built: the Undo Vote and the Call Request, which a two-Player Game presents as Concede.

## Undo Vote

- A Player in History View, at a position earlier than their own Undo reaches, may ask everyone to go back to it. The vote targets the first Action after that position, which must be a User Action.
- Every Player with an account must agree. Any Player may decline, which closes the vote. The Player who asked may withdraw it.
- At most one vote is open. It has no expiry. Play continues while it is open, and the Actions taken meanwhile are undone too when it passes.
- The other Players receive an Attention Notice through web push and Discord.
- Hotseat and Tournament Games have no votes. Finished Games do, since an Authorized Undo may reopen one.
- A passed vote runs the ordinary Undo path with the Player restrictions lifted. The unavailable-history check still applies. Undo restores the random-number position, so replaying draws the same dice and cards.

## Call Request and Concede

- A Joined Player of an In Progress Game asks from the account menu: **Concede…** in a two-Player Game, **Call the game…** otherwise. The menu shows the entry only when the title's loaded UI declares the `calledGames` client capability, the Game is eligible, and, for a call, no other vote is open.
- A call names one winner or no winner. It passes on a strict majority of the Players with an account, the asker included, and fails once that majority is out of reach, a tie included. Each Player answers once; a decline counts against the call but does not end it while a majority is still possible. The asker may withdraw it. If a passed call cannot be recorded, for instance because the Game ended first, the vote closes.
- Concede needs no vote: the other Player is the winner and the Game ends at once.
- On passing, the host appends the reserved `callGame` System Action (ADR 0012). The result is a Win for the declared winner, or Abandoned with none. No final scores are recorded. The Game records the call in `Game.call` (kind `called` or `conceded`, the asker, the declared winner if any, approvals and declines), and the Action carries the same record for history.
- Players cannot undo a Called Game and have no further votes on it; an administrator can undo it, which clears `Game.call`. A fork from before the call starts without it, and without any open vote.
- Hotseat and Tournament Games refuse it.

The shared rule for what a Player's own Undo reaches lives in `libs/common/src/game/engine/playerUndo.ts`. The host uses it to decide whether a request needs a vote, and the Game Session uses it for the Undo button and for the history position it reports.

## Host and UI Artifact contract

The vote is stored on the Game (`Game.vote`), not in Game State, so no Logic Artifact changes. The Game schema accepts unknown fields, so older UI Artifacts load Games that carry a vote.

The strip is host chrome (`apps/frontend/src/lib/components/PlayerVoteStrip.svelte`). It reads the vote from the Site Frontend's game cache, which game update notifications keep current.

Three optional `GameSessionBridge` members come from the shared Game Client bundled into each UI Artifact (ADR 0004):

- `viewedHistoryPosition`: where History View stands, the live game's Action count, and whether the position is beyond the Player's own Undo reach.
- `showHistoryBeforeAction(actionIndex)`: moves History View to the position just before an Action.
- `showLiveGame()`: leaves History View. The host calls it for the Player who asked once their vote passes and the Undo has reached the client.

A UI Artifact gains them only through a new UI-only Publication. Until a title is republished, the host offers the request at every History View position, and the server answers "you can undo this yourself" where Undo already reaches. The host also hides View that point, and the Player who asked stays in History View after the vote passes.

## Called games and UI Artifacts

`callGame` runs in each UI Artifact's embedded engine, so a title can be called only after a UI-only Publication that includes it. Publish it as a UI major: a client that still has the older Artifact loaded reloads on its next request to the game, so it does not have to present a call it cannot read. Such an Artifact declares `clientCapabilities: ['calledGames']` in `UiDefinition.info`; the build copies it into the Artifact's `catalog.json`, and the backend refuses a call while the current Publication's catalog entry lacks it. The Site Frontend reads the same field from the loaded `UiDefinition` to show the menu entry. Napoleon's Triumph is the first title to opt in. A title adopting calls also shows the ending and the call's history entry, through `GameSession.gameCall` and the shared `CalledGameEnding` and `CalledGameDescription`; a title whose logic ties a result to its own end state, as the 18xx family does, needs a Logic release as well.

The shared Game Client exposes `gameCall` on the Game Session. It comes from `currentAction`, the Action behind the displayed state: the transition presenter publishes the visible context's actions together with that state. Synchronization, Undo, History View and Explorations therefore show the ending that belongs to the state on screen; the client does not read `Game.call`. Title end panels show the shared `CalledGameEnding` in place of their scoring, and history shows a `callGame` Action with `CalledGameDescription`. The harness Scenarios menu can copy the open game ended by a call to check a title's ending.

`Game.call` and the call vote are new shapes on the Game. Site Frontend builds older than this change reject a Game that carries a call vote, so release the Site Frontend before the backend accepts calls.
