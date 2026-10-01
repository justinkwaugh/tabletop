# MarraCash implementation plan

Phase 2 of the MarraCash work. Rules decisions are in [the implementation notes](marracash-implementation-notes.md) and the board is in [the board map](marracash-board-map.md). This plan says how to build them on the platform. Follow [DESIGN.md](DESIGN.md) and [the coding policy](agent-coding-policy.md) throughout.

## Reference games

- **Estates** is the closest match and the main pattern reference:
  - config-driven hidden money (`hiddenMoney` with `Visibility.Policy.configEquals`)
  - sealed simultaneous auctions using the shared `SimultaneousAuction`
  - registered state and Action visibility
  - an Exploration population hook
- **Fresh Fish** is the second reference, especially for protected randomness and hypothetical bag and bid population.

This replaces the earlier note that Fresh Fish should be the main pattern reference: Estates already combines concealed cash with sealed bids.

## Antique cards

`MarracashCards.png` shows 25 cards, 5 per colour, in steps of 25 Dirham:

| Colour | Values |
|---|---|
| Red | 50, 75, 100, 125, 150 |
| Purple | 75, 100, 125, 150, 175 |
| Green | 100, 125, 150, 175, 200 |
| Blue | 125, 150, 175, 200, 225 |
| Yellow | 150, 175, 200, 225, 250 |

## Packages

Create `games/marracash` and `games/marracash-ui` with the turbo generators (`create-game`, `create-game-ui`, then `add-action` and `add-state` per Action and state). The logic package must not depend on frontend code.

## Game state

**Board (static data, not state).** A module holding the 13 × 9 grid from the board map: shop cells, fountain cells, palms and entrances. Routes and the shops passed are derived from the grid, not hand-listed. A test pins the derived result to the board map's 46 one-way moves, so a grid typo can't change the routes silently.

**`MarracashGameState`:**

- `shops`: for each of the 25 shops, its owner `playerId` (if any) and customer count.
- `fountains`: visitors at each of the 16 fountains, as counts per colour. A group is everything on one fountain.
- `queue`: the ordered visitors outside the wall. Public.
- `auction`: the current `SimultaneousAuction`, while one is running.
- `antiqueDeck`: the 5 undealt cards (25 dealt 5 per player, so 5 are left over with 4 players and 10 with 3). Hidden all game.
- `antiqueRevealOrder`: the `playerId`s that have completed a set, in order. This decides the 5/4/3/2 payout.
- Turn tracking: the round number (round 1 is auction-only), the actions taken so far this turn, and whether the last round has started. The final round stops after the player to the right of the start player.

**`MarracashPlayerState`:**

- `money`: protected with `anyOf(Owner, configEquals('concealedCash', false, { defaultValue: false }), stateEquals('machineState', EndOfGame))`, as in Estates.
- `antiques`: the player's 5 cards, protected with `Policy.Owner` and the empty-array redaction, so other players see `[]`. Protecting it with the default omission breaks the projected type inference for the whole player.
- `revealedAntiques`: public. Cards move here from `antiques` when the set is completed.

A player's shop count is derived from `shops`.

## Configuration

Two Boolean options, registered through `info.configurator`:

- `concealedCash`, named "Concealed Cash", default `false`.
- `antiqueCards`, named "Antique Cards", default `true`. The initializer copies it into the public `antiqueCards` state field, which set detection checks. With it off, no cards are dealt and the antique deck is empty.

## Setup

- Turn order and start player come from public randomness.
- **Starting positions:** the initializer declares `supportsStartingPositions` and passes the optional assignment to `HydratedTurnManager.generate`, as every published title does ([tournament game capabilities](tournament-game-capabilities.md)). Position zero is the start player.
- **Queue:** generated from public randomness, because the order is public anyway. Rejection-sample (or build) an order where the three entrance trios each have three different colours and the remaining queue never has more than 3 of one colour in a row. That's 3 trios of 9 visitors, plus a queue of 55.
- **Antiques:** shuffled and dealt from protected randomness (`getProtectedPrng()`), with `randomnessVersion: 1` as in Fresh Fish and Sol.
- Every player starts with 1200 Dirham.

## Actions

| Action | Source | Purpose |
|---|---|---|
| `StartAuction(shopId)` | User | Choose an unowned shop. Creates a `SimultaneousAuction` with participants ordered clockwise from the auctioneer, and `TieResolutionStrategy.FirstInOrder`. That gives the auctioneer, then clockwise, tie rule. |
| `PlaceBid(amount)` | User, simultaneous | A sealed bid. The auctioneer bids at least 100. Others bid 0 or more, where 0 is a pass. A bid must be a multiple of 25 and can't exceed the bidder's money. Protected by `SimultaneousAuction` visibility until resolved. |
| `PlaceBid(0)` for a player with 6 shops | System | Entered automatically, so that player is never asked. |
| `ResolveAuction` | System | The winner pays the bank, and the auctioneer gets the 100/200 cut when someone else wins. Then the auction pull-in runs, with no mover's cut, and antique sets are checked. |
| `MoveVisitors(fountainId, direction)` | User | Moves the whole group along the derived route. Each colour enters the first owned shop of that colour it passes. Customers pay one after another, and each owner pays the mover's cut on the profit from that move. Then antique sets are checked. |
| `CompleteAntiqueSet(playerId)` | System | Reveals the player's cards and pays the best 5/4/3/2 by reveal order. A distinct history entry, so every player sees it. |
| `BringVisitors(end, count, entranceId)` | User | Refills one empty entrance with 2–4 visitors from one end of the queue, or the last 1 if only 1 is left. Repeated until every empty entrance is filled or the queue runs out. |
| `EndTurn` | System | Passes play on. Starts the last round when the queue empties, and ends the game when that round is complete. |

Results needed for history, logging and animation go in Action `metadata`: who entered which shop, every payment, cuts, and pull-ins.

## Machine states

- `ChoosingAction`: the active player chooses their next action. In round 1 that's `StartAuction` only, one per player. From round 2 the options are A (move, move), B (move, auction) and C (auction, auction). The option is tracked by the actions taken this turn, not chosen up front: after an auction, only another auction is allowed. Auction actions aren't offered if the player has less than 100 Dirham at that moment, already owns 6 shops, or if no shop is unowned. Money is checked when the auction would start, not at the start of the turn: a first move pays everyone straight away, so its profits count toward a second-action auction.
- `Bidding`: every participant still to bid is active at once. Leaves when all bids are in.
- `ResolveAuction` is processed in `Bidding`, as Fresh Fish handles `EndAuction` in its bidding state. It is queued once every bid is in, and play then returns to `ChoosingAction` for the same player or the next turn.
- `RefillingEntrances`: entered at the end of a turn when an entrance is empty and visitors are left in the queue.
- `EndOfGame`: terminal. Cash becomes public. The most cash wins, and ties share the win. It records `GameResult.Win` or `GameResult.Draw` with `winningPlayerIds`, and the runtime declares `scoring.finalScores` as each player's final cash, per [tournament game capabilities](tournament-game-capabilities.md).

Every state needs a handler, and every serialized Action must be registered in the API schemas and the hydrator.

`ChoosingAction` and `EndOfGame` were written by hand in step 1, because `add-state` needs an existing action. They lack the template's anchor comments, so `add-state-action` won't insert into them: wire their actions by hand. Use the generators for every other state and action.

## Hidden information

Register `runtime.visibility.state` and `.actions`. That's required because the game has secrets and protected randomness, even when `concealedCash` is off: antique hands are always secret.

- **Projected schemas:** derive them with `Visibility.createProjectionSchema`, keep the canonical validator on `runtime.canonicalStateValidator`, and follow Estates' accessor pattern (`getMoney()` asserting the value is present).
- **What stays public:** the queue, fountains, shops, customers, revealed antiques, reveal order, and all bids after resolution.
- **Optimistic play:** moves and auction resolution read other players' hands (and their cash when it's concealed). Those Actions will fall back to the host rather than run optimistically. That's expected, not a bug.
- **Undo:** the final bid that resolves an auction, and any move or auction that completes an antique set, are Information-Revealing Actions (`revealsInfo`). Bids and antique hands become known, so Undo can't cross them. Sealed bids form a Simultaneous Action Group.
- **Exploration:** a population hook samples hypothetical antique hands and the undealt deck from the cards the explorer hasn't seen. It rejects samples that would give a player a set their current customers already complete, because that player would have revealed it. It fills hidden sealed bids with legal amounts, using 0 for players with 6 shops. Like Estates with Hidden Money, exploration is unavailable when Concealed Cash is on.
- **Tests:** visibility tests in the style of `games/estates/src/definition/visibility.spec.ts`, covering player, spectator and the end-of-game reveal, with Concealed Cash on and off.

## UI

- **Player colours:** the scaffold's palette (green, yellow, blue, red, black) overlaps the five shop colours. Pick owner colours that stay distinct on any shop, since the colour is shown on a stall of a different colour.
- **The board:** independent artwork, per the notes. Generic pawns for visitors and player-coloured discs for shop owners. Show the board as the grid, with the queue as a U-shaped line around the wall.
- **Session methods:** `startAuction`, `placeBid`, `moveVisitors` and `bringVisitors`. Components call these and never build Actions themselves.
- **Staged selections** ([user interactions](user-interactions.md)):
  - A move is fountain, then direction. The destination is previewed using the derived route.
  - Refilling is queue end, then count, then entrance. Entrance and end are auto-selected when there's only one choice.
- **Panels:**
  - A bidding panel showing who has bid, and every bid once revealed.
  - Each player's own antique hand, with progress toward their set.
  - Revealed sets in each player's panel, so a player who checks in later can see a set was completed. The `CompleteAntiqueSet` history entry also stays in the log. No notification outside BoardTogether.
- **Visual contract:** start `ui-interaction-visual-contract.md` with the first cross-layer effect, such as route preview highlighting.
- **Animation:** follow the [game UI animation skill](../.agents/skills/game-ui-animation/SKILL.md) for visitor movement and shop entry.

## Build order

Each step ends with tests passing:

1. Scaffold both packages, plus the `concealedCash` config. Done.
2. The board module, with route derivation and the test pinning it to the board map. Done.
3. State, player state, initializer (queue generation, antique deal, starting positions) and hydration round-trip tests, plus a `competition.spec.ts` covering 3 and 4 players. Done. Players stay in game order and the turn manager holds the seating, as in Estates, so assigned positions change nothing else. Step 4 adds first-round play to the tournament test, and step 7 adds its projection checks.
4. The auction flow: `StartAuction`, `PlaceBid`, `ResolveAuction`, the pull-in, and the 6-shop rule. Done. A player with 6 shops stays in the active list only until their automatic 0 bid is processed, because the engine requires an action's player to be active. They are never offered a bid.
5. Movement: `MoveVisitors`, sequential payments, mover's cut and `CompleteAntiqueSet`. Done.
   - A shop entry that completes a set adds the owner to `pendingAntiqueSets`. The move or auction then queues one `CompleteAntiqueSet` per pending player, in the order their sets completed.
   - `ChoosingAction` decides whether the turn continues only once that list is empty, so completions are recorded before play passes on. The turn decision moved there from `Bidding`.
   - `CompleteAntiqueSet` names the player in `collectorId`, not `playerId`, because the engine only accepts an action's `playerId` from an active player.
6. Refilling, turn options, the end of game and scoring. Done.
   - When the current player has nothing left to do, `ChoosingAction` queues the system `EndTurn`, because a state's entry can't change state itself. `EndTurn` leads to `RefillingEntrances` while an entrance is empty and visitors remain in the queue, then to the next turn or `EndOfGame`.
   - A player who can't move or auction at the start of their turn is skipped this way too, still refilling entrances if needed.
   - `finalRound` is set when the queue empties. The game ends when the last seat's turn finishes during the final round.
   - The tournament test now plays whole games to the end, with antique cards on and off.
7. Visibility registration, projected hydration, Exploration population and visibility tests. Done. Guarded client-side execution only applies to games marked as protecting information, which every new hosted game is. In such a game, a move that needs an opponent's hidden hand raises the guard's unavailable-value error and goes to the host.
   - A skipped turn adds an `EndTurn` that depends on the skipped player's cash, so with Concealed Cash on it shows that player has under 100. Players at a table see a skipped turn too, so this matches the rules. Turn ends check movement first, so cash is only read when no visitors are left to move.
   - Antique hands that were never completed stay hidden after the game ends, as the user decided. Revisit if player feedback asks for them to be shown.
8. The UI package.
9. Add the title to the Game Catalogue (`config/config-games/src/games.json`, `gameId` and `packageId` both `marracash`). The local hosted site reads it, so this is needed before testing with the `local-hosted-game` skill.
10. A readiness check with the `game-pr-readiness` skill.

## Questions for the user

None. All the plan's questions are answered and recorded in the implementation notes.

## Possible shared-code follow-ups

These would touch other games or shared libraries, so they need the user's approval first.

- **`rotations` test helper:** `competition.spec.ts` in Bus, Bridges of Shangri-La, Estates, Indonesia and MarraCash each define the same `rotations` function. The 18xx titles share one in `libs/18xx/test/startingPositions.ts`. Coding policy rule 3 favours one shared helper for all titles.
