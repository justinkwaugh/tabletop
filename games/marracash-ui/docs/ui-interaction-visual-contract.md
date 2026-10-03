# MarraCash UI interaction visual contract

Covers the board highlights and previews used while a player takes their turn. Selections live in `MarracashGameSession`; the board only renders them.

## Visual intents

| Intent                    | Trigger                                                        | Emphasized                                                                                                                                                                                                                                                                                                                                                                                                                         | Unaffected                      |
| ------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Choose a fountain to move | `ChoosingAction`, the player may move, no fountain selected    | Every fountain with visitors gets a glowing white halo hugging its outline and is clickable (pointer, or focus and Enter)                                                                                                                                                                                                                                                                                                          | Shops, queue, pawns             |
| Choose a shop to auction  | `ChoosingAction`, the player may auction, no fountain selected | Every unowned shop gets a glowing white halo and is clickable; clicking one stages it for confirmation rather than starting the auction                                                                                                                                                                                                                                                                                            | Fountains, queue                |
| Choose a destination      | A fountain is selected                                         | Everything else on the table, queue included, is dimmed under the same half-black overlay as the auction spotlight; the selected fountain stays at full colour above it with a solid dark ring and is clickable to back out the same as Back, and each fountain one of its routes reaches stays at full colour with the white halo and is clickable. The action panel reads "Choose the destination for these visitors." with Back | Pawns on the lifted fountains   |
| Preview a route           | Pointer over, or focus on, a destination fountain              | A dashed path from the fountain along the route, branches into the owned shops the visitors would enter, which are lifted above the overlay at full colour without a halo, each with a chip where its branch meets the shop showing a pawn of the shop's colour and how many visitors walk in, and a pulse on the destination, all above the overlay                                                                               | Everything else                 |
| Choose an entrance        | `RefillingEntrances`                                           | Everything else on the table is dimmed under the shared half-black overlay; every empty entrance, even a single one, is lifted above it with a glowing white halo hugging its star, and the visitor queue is drawn above it at full colour. The entrances become clickable once the queue end and visitor count are chosen; the queue pawns that would be brought in then get the same halo, updating as the end or count changes  | Shops, other fountains (dimmed) |
| Spotlight the auction     | `auctionShopId` is set in the game state, or a shop is staged  | Everything else on the table, queue included, is dimmed under a half-black overlay; the auctioned shop stays at full colour above it with the white halo. The same spotlight shows while a chosen shop awaits confirmation, with Start auction and Back in the action panel                                                                                                                                                        | The auctioned shop              |

## Coexistence and precedence

| Intent A             | Intent B                   | Rule                                                                                                                                                                        |
| -------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Choose a fountain    | Choose a shop              | Coexist until a fountain is selected. Selecting a fountain removes the shop highlights, because an auction can't follow choosing a move.                                    |
| Choose a destination | Choose a fountain          | Exclusive: selecting a fountain removes the other movable fountains' halos under the overlay. Back returns to choosing an action, where any fountain or shop can be chosen. |
| Preview a route      | Choose a destination       | The preview only exists while its route starts at the selected fountain.                                                                                                    |
| Choose an entrance   | Any move or auction intent | Can't overlap: refilling and choosing an action are different machine states.                                                                                               |

During bidding, while waiting for others, and in History View, the session reports no available actions, so no intent shows. The auction spotlight comes from game state, not available actions, so it shows to every player during bidding, including in History View.

## Shared visual state

- **Staged selection** (`fountain`, `shop`, `queueEnd`, `visitorCount` in the session):
    - Meaning: the player's manual choices before an action is committed.
    - Producers and consumers: board clicks and the refill panel set it. Board highlights and the panels read it.
    - Lifetime: cleared by `resetAction()` before each new state is published. Back and Undo remove the latest manual choice.
    - Validity: each derived value is undefined unless its action is currently available, so stale choices never render.
    - A single legal visitor count is derived, never stored, so Back and Undo never consume it.
- **Hovered route** (`Board`):
    - Meaning: the route to the destination fountain under the pointer or focus.
    - Producer: the destination `FountainSpot`s. Consumer: `RoutePreview`.
    - Lifetime: cleared on pointer leave or blur, and reset whenever the selected fountain changes or a new state starts publishing, so choosing a destination (whose spot unmounts without a pointer leave) never leaves a stale preview.
    - Validity: derived empty while a new state is publishing, or when the route doesn't start at the selected fountain.

## Render ownership

- `Board` owns the layer order: the visitor queue in the margin outside the walls (drawn last instead, above the overlay, while entrances are being refilled), then shops, then fountains, then the shared overlay, then whatever is lifted above it (the auctioned or staged shop, the shops the previewed route enters, the selected fountain and its destinations, or the empty entrances awaiting a refill), then the route preview. The overlay blocks clicks on everything beneath it, so only lifted pieces are interactive; the preview ignores pointer events so it never blocks a destination.
- `ShopTile` draws each owned shop's `ShopSign`: a flat cardboard sign in the owner's colour, cut in a shape unique to their seat, with the customer count beside it. That count and the route preview's entering counts use the same `PawnCountChip`: a chip with a pawn and a number on or beside a shop always means visitors of that colour in the shop. Crowded fountains use their own tally panel instead.

## Verification scenarios

All checked manually in the dev harness, using scripted browser runs.

1. **Round 2 turn:**
    - At the start, both fountains with visitors and unowned shops are highlighted.
    - Selecting fountain 1 dims the table and leaves only fountain 1 and its destinations 2, 3 and 6 bright; the panel asks for the destination.
    - Hovering fountain 6 previews the route to it.
    - Back, or clicking fountain 1 again, restores the start-of-turn highlights.
    - Hovering fountain 4 from fountain 8 lifts the yellow and purple shops its visitors would enter, each with a chip counting one visitor.
    - Clicking fountain 6 moves the visitors there.
2. **Entrance refill:**
    - After two moves that empty entrances 1 and 8, the board dims and both empty entrances are highlighted but not yet clickable; the queue stays bright.
    - Choosing the front of the queue and 3 visitors makes both entrances clickable and haloes the three incoming pawns.
    - Clicking entrance 1 places the visitors and clears the selection.
    - The second refill starts from a fresh selection.
3. **Auction:** clicking an unowned shop dims the table around it, haloes it and asks for confirmation; Back restores the turn. Start auction starts bidding, and the spotlight stays until the auction resolves.
