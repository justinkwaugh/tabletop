# Variations and Conditional Moves

Status: proposal, open for review. Nothing here is built.

Go and chess servers such as OGS let players explore branching variations, show them to each other, and submit conditional moves that answer an opponent's expected reply at once. This proposal brings the same to Exploration in three stages, each usable on its own:

1. [Variation Trees](#stage-1-variation-trees) inside an Exploration.
2. [Shared Variations](#stage-2-shared-variations) attached to Game Conversation Messages.
3. [Conditional Moves](#stage-3-conditional-moves) that the host plays for a Player while they are away.

Terms follow the [Game Client](../libs/frontend-components/CONTEXT.md#variations-proposed), [Game Conversations](contexts/game-conversations/CONTEXT.md#shared-variations-proposed) and [Game Lifecycle](contexts/game-lifecycle/CONTEXT.md#conditional-moves-proposed) glossaries.

## Scope

- Game Titles opt in to Shared Variations and Conditional Moves. The first candidates are two-Player, turn-taking titles with perfect information and no randomness after setup: the GIPF-project titles and Urbino, joined by Hex and the Game of Y once they land. A random setup, as in TZAAR and DVONN, does not disqualify a title.
- Titles with hidden information or later randomness are out of scope for those two stages. A Shared Variation sent as Actions could disclose a Player's hidden information through the Actions themselves, and a Conditional Reply would be played in a position its Player never saw. Conditional moves are hard to reason about in such games anyway.
- Games with more than two Players, Hotseat Games and Local Games are out of scope for Conditional Moves.
- Variation Trees need no opt-in. They stay local to the explorer and work for every title, hidden information included.
- Opt-in follows the `calledGames` precedent ([Player Votes](player-votes.md#called-games-and-ui-artifacts)): the UI Artifact declares a client capability, such as `sharedVariations` or `conditionalMoves`, in `UiDefinition.info.clientCapabilities`, and the backend refuses the feature while the current Publication's catalog entry lacks it.

## Stage 1: Variation Trees

- An Exploration holds a Variation Tree instead of one linear Action sequence. Playing a different Action at an earlier position adds a Variation rather than discarding the later Actions.
- Moving between Variations reverses Actions back to the shared ancestor position and re-applies Actions along the chosen path, using the existing Action Reversal and redo machinery.
- Hidden information and randomness: Variations share the Hypothetical Game State at the position where they split. Each Variation keeps its own recorded random outcomes, so moving between Variations never resamples, extending the existing rule that Undo and redo within an Exploration preserve its sampled values and randomness ([Hidden-information Exploration](hidden-information-exploration.md)).
- A game can keep several Saved Explorations, each holding a full Variation Tree. Existing Saved Explorations load as trees with a single Variation.
- The saved format leaves room for a text note on any position in the tree. Notes are not part of this proposal, but they become valuable if Variation Trees are later stored on the host for public review of a game, as OGS reviews are.
- The tree view lives in or beside each title's history panel, the natural home for position navigation.
- Rollout: Game Client only. No backend or Logic Artifact change. Each UI Artifact adopts it when republished. Prefer storing the tree inside the Exploration's own record so the Site Frontend's local store needs no change.

## Stage 2: Shared Variations

- A Joined Player can attach a Variation Tree to a Conversation Message (the in-game chat). It is stored with that Message, so no new collection is needed.
- The attachment holds Actions, never Game State:
    - Its anchor: the position in the Canonical Action History where the tree starts, identified by Action index and the `actionChecksum` of the state there.
    - The tree's User Actions. System Actions are regenerated when the reader replays it.
    - A size cap on positions or bytes, separate from the Message's 500-character text limit.
- The Message also carries fallback text, such as "Shared a variation: 3 moves from move 24". UI Artifacts built before this stage show only that text.
- Opening a Shared Variation:
    1. Check the anchor: the Action at that index still exists with the same checksum.
    2. Move History View to the anchor and start an Exploration from History there, in the reader's own Player Perspective. Starting from History is already supported, for spectators as well as Players.
    3. Replay the tree. If an Action fails to apply, open the tree up to that point and say so.
- The result is the reader's own Exploration: they can step through it, add Variations, save it, or share their changed tree back.
- A Shared Variation whose anchor Undo has removed is shown as stale and does not open.
- The Conversation Audience, spectators included, can open a Shared Variation. A Player who shares one chooses to make that analysis public. Sharing works while the game is In Progress and after it Finishes, for post-mortems.
- Message Redaction removes the attachment as well as the text.
- Rollout: the Conversation Message schema gains an optional attachment. Deploy the backend first, then republish each opted-in title's UI Artifact, which bundles `GameChat`. Review the [Game UI Host Bridge Contract](adr/0004-game-ui-host-bridge-contract.md) for the new Message field.

## Stage 3: Conditional Moves

### Planning

- While waiting on the other Player in an opted-in Hosted Game, a Player can choose **Plan conditional moves**. It opens an Exploration at the live position, where they play possible Actions for the other Player and their own replies.
- The tree changes sides whenever the Active Player changes, not once per turn. A turn can be several Actions, as with ZÈRTZ capture chains or GIPF row removals, and a turn can hand a decision to the other Player partway through, as when a GIPF move makes rows for both Players.
- Wherever the planning Player is to act, the tree holds exactly one reply. Playing a different reply there replaces the old one. The other Player's possible Actions can branch freely.
- The planner loads the Player's current Conditional Move Tree for editing, and offers submit and cancel.
- From an ordinary Exploration rooted at the live position, **Submit as conditional moves** takes a tree of the same shape.
- If the other Player acts while the planner is open, the planner says so and returns to Live View. A submission anchored at a position that is no longer current is rejected.

### Matching and playing replies

- After the other Player's Action is stored, the host compares the Actions since the tree's current position with the tree's branches. Matching compares Action content, ignoring identity, index, timestamps and host-filled fields. A title can supply its own comparison where content alone is not enough.
- On a match, the host plays the Player's reply as ordinary User Actions through the usual execution path. If the reply is no longer valid, the host discards the tree and notifies the Player.
- When the other Player's Actions match no branch, the host discards the whole tree, as OGS does, and the Player gets their normal turn notification.
- Replies run within the other Player's own Action request, after their Action is stored, so the reply reaches them through the usual Realtime Update within about a second, before they are likely to leave. Whether this is a second write or part of the same transaction is a question for review.
- A Conditional Reply carries no mark in history, so the other Player cannot tell a reply was planned.
- No notification is sent for each reply played. The Player's normal turn notification comes when their tree runs out or is discarded.
- Conditional Moves pause while a Player Vote is open. While paused, nothing is matched, and the Player gets their normal turn notification when it becomes their turn; if they act themselves, their own Action leaves the tree and the host discards it. When the vote closes, the host matches the other Player's Actions played meanwhile: a match plays the reply then, and no match discards the tree. If the vote passed, its Undo applies first, and the tree is matched against what remains.

### Privacy and lifetime

- The host keeps each Player's tree privately, one per Player per Hosted Game. It never appears in the Game representation, Realtime Updates, a Fork or a Continuation, and is deleted with the game.
- An Undo that takes back the tree's anchor or any Conditional Reply discards the tree. A Player who undoes their own reply has chosen to play that turn by hand; the alternative, moving the tree's position back so the reply's branch is open again, is left for review.
- An Undo that takes back only the other Player's Actions after the anchor, while the tree is paused, moves the tree's position back with them.
- When the game ends, the host discards any remaining tree. A Player who wants to keep their plan keeps it in an Exploration. Showing unused branches becomes worth revisiting with lasting public reviews.
- Rollout: deploy the backend first, then republish each opted-in title's UI Artifact. Titles that have not opted in, and UI Artifacts built before this stage, are unaffected.

## Questions for review

### Undo after a Conditional Reply

A Conditional Reply is the other Player's User Action, so under the current rules the Player who triggered it cannot undo their own Action past it without an Undo Vote. In Tournament Games, which have no Player Votes, they cannot undo past it at all.

- **Default suggestion: keep the current rules.** Being able to undo freely would let a Player see the reply, undo because of it rather than because of a mistake, and try something else. That spoils the planned reply.
- **Option: a grace period.** The reply waits a short time, during which the triggering Player can still undo their own Action without a vote. It costs some of the immediacy and adds a pending state the host must track.
- **Option: a delay before playing the reply.** Similar, with a longer delay and a scheduled task, so the reply arrives after the triggering Player has had time to reconsider. It risks the Player leaving before the reply arrives, which works against the main reason for Conditional Moves.
- Considered and dropped: undoing the triggering Action also reverses the reply and re-arms the tree. It is the simplest rule, but it is exactly what invites undoing after seeing the reply.
- Whichever rule is chosen, an Undo that takes back a Conditional Reply discards the rest of the tree by default, as described under [Privacy and lifetime](#privacy-and-lifetime).

### Other questions

- **Game or tournament switch.** No per-game switch is proposed, only the per-title opt-in. OGS ties disabling conditional moves to disabling analysis, and organisers may want that for tournaments.
- **Phone layout.** How the tree view fits each title's history panel on small screens.
- **Firing.** A second write after the triggering Action, or one transaction that stores both.
- **Storage shape** of a Variation Tree in a Saved Exploration, and the size cap for a Shared Variation.
- **Glossary.** The Game Runtime glossary defines a User Action as one initiated directly through user input. A Conditional Reply is user input given in advance; that definition may need to say so.
- **Public reviews.** Storing Variation Trees with notes on the host for public review of a game is a natural later step and is out of scope here.
