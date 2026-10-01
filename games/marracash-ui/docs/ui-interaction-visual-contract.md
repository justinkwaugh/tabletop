# MarraCash UI interaction visual contract

Covers the board highlights and previews used while a player takes their turn. Selections live in `MarracashGameSession`; the board only renders them.

## Visual intents

| Intent | Trigger | Emphasized | Unaffected |
| --- | --- | --- | --- |
| Choose a fountain to move | `ChoosingAction`, the player may move, no fountain selected | Every fountain with visitors gets a dashed white ring and is clickable (pointer, or focus and Enter) | Shops, queue, pawns |
| Choose a shop to auction | `ChoosingAction`, the player may auction, no fountain selected | Every unowned shop gets a dashed white outline and is clickable | Fountains, queue |
| Choose a direction | A fountain is selected | That fountain gets a solid dark ring; an arrow appears on each exit; other movable fountains keep their dashed rings and switch the selection when clicked | Shop colours, pawns |
| Preview a route | Pointer over, or focus on, an exit arrow | A dashed path from the fountain along the route, and a white ring on the destination | Everything else |
| Choose an entrance | `RefillingEntrances`, queue end and visitor count chosen | Each empty entrance gets a dashed white ring and is clickable | Shops, other fountains |

## Coexistence and precedence

| Intent A | Intent B | Rule |
| --- | --- | --- |
| Choose a fountain | Choose a shop | Coexist until a fountain is selected. Selecting a fountain removes the shop highlights, because an auction can't follow choosing a move. |
| Choose a direction | Choose a fountain | Coexist: the other movable fountains stay highlighted so the player can switch. |
| Preview a route | Choose a direction | The preview only exists while its route starts at the selected fountain. |
| Choose an entrance | Any move or auction intent | Can't overlap: refilling and choosing an action are different machine states. |

During bidding, while waiting for others, and in History View, the session reports no available actions, so no intent shows.

## Shared visual state

- **Staged selection** (`fountain`, `queueEnd`, `visitorCount` in the session):
  - Meaning: the player's manual choices before an action is committed.
  - Producers and consumers: board clicks and the refill panel set it. Board highlights and the panels read it.
  - Lifetime: cleared by `resetAction()` before each new state is published. Back and Undo remove the latest manual choice.
  - Validity: each derived value is undefined unless its action is currently available, so stale choices never render.
  - A single legal visitor count is derived, never stored, so Back and Undo never consume it.
- **Hovered route** (`Board`):
  - Meaning: the exit route under the pointer or focus.
  - Producer: `DirectionArrows`. Consumer: `RoutePreview`.
  - Lifetime: cleared on pointer leave or blur.
  - Validity: derived empty while a new state is publishing, or when the route doesn't start at the selected fountain.

## Render ownership

- `Board` owns the layer order: shops, then fountains, then the route preview, then the exit arrows. The arrows stay on top so they remain clickable over the preview, which ignores pointer events.

## Verification scenarios

All checked manually in the dev harness, using scripted browser runs.

1. **Round 2 turn:**
   - At the start, both fountains with visitors and unowned shops are highlighted.
   - Selecting fountain 1 removes the shop highlights and shows three arrows.
   - Hovering the south arrow previews the route to fountain 6.
   - Back restores the start-of-turn highlights.
2. **Entrance refill:**
   - After two moves that empty entrances 1 and 8, choose the front of the queue and 3 visitors; both empty entrances are highlighted.
   - Clicking entrance 1 places the visitors and clears the selection.
   - The second refill starts from a fresh selection.
3. **Auction:** clicking an unowned shop starts bidding, and every board highlight disappears.
