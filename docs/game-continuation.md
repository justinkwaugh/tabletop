# Game continuation

A Finished Game Instance can offer **Continue** when its Game Title has committed all carryover decisions. Continuing creates one new Game Instance with the same title, owner, player identities, configuration, visibility and play arrangement. It has fresh randomness, initial state and Action history. The prior game's result remains unchanged.

## Title contract

Set `initializer.supportsContinuation = true` and set `GameState.canContinue = true` alongside the final `result` once all legacy decisions are complete. Leave the flag absent for titles or outcomes without a continuation. `GameResult` continues to describe the outcome independently.

`initializeGameState(game, state, assignment?, previousState?)` receives the captured canonical previous state as its optional fourth argument. Treat that input as read-only and copy only title-owned carryover facts into the supplied fresh state. Preserve the fresh game identity, randomness and history counters. Player IDs are retained across the two Game Instances, so carryover associated with a player can use those IDs directly. First-game initialization has no previous state.

The current runtime hydrates and validates the captured state before initialization. Titles remain responsible for compatibility with stored continuation inputs across later Publications, including inputs captured before a new lobby starts. A missing capability or incompatible snapshot fails explicitly; the platform never silently starts an ordinary game instead.

## Hosted lifecycle

The owner's `POST /game/:typeId/continue` request supplies only `gameId`. The backend authorizes against the stored source and captures its canonical state, creates the new lobby, and records `continuedToGameId` on the source in one transaction. The new lobby records `continuedFromGameId`; `parentId` retains its Fork meaning.

Repeated or concurrent requests return the existing successor. There is one successor per source, including after source Undo. Deleting the successor does not release that relationship or permit another branch; attempts to open it report that it has been deleted.

The captured state is stored under the new game's private documents and never appears in lobby metadata, list responses or notifications. Starting the new lobby uses that snapshot, so Undo or deletion of the source cannot change its setup. The new game uses ordinary state projection once initialized.

Other players receive the existing invitation flow. The original roster and configuration are fixed. A decline retains the invited player even in a Public Game, and another user cannot take the seat. A declined player can join again. Tournament Games cannot be continued.

## Local lifecycle

Local Games initialize immediately. IndexedDB creates the successor and links the source in one transaction, so concurrent requests share one successor. The initialized successor is independent of subsequent source edits or deletion. Local saves derive continuation eligibility from the canonical state and preserve an existing successor link when an older session saves its source.

## Publication compatibility

The Game UI Host Bridge Contract additions are optional: older Game Sessions and harness hosts need not implement `GameService.continueGame` or `TabletopApiPublic.continueGame`. Existing result values and initializer arguments retain their meanings. The Site Frontend owns the card and hosted continuation command; older UI Artifacts can continue ordinary play without republishing.

A title adopting legacy behavior needs a Logic-changing Publication with a matching UI Artifact. Its new runtime must implement the continuation initializer and final-state flag. Consumers embedding the shared IndexedDB store, including development harnesses, must rebuild to adopt its local persistence changes. New UI Artifacts also clear continuation links when creating an Exploration; a title adopting continuation must include that shared Game Client update in its matching UI Artifact. Other titles need no coordinated republication. No current title is automatically opted in by this platform change.

The platform can create the next Game Instance only after the source reaches its final carryover state. Titles with player choices after victory should commit those choices before exposing their final result and `canContinue` flag.
