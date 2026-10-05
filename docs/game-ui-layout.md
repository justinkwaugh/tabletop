# Game UI Layout

The default table layout for a Game Client. Start every new game UI from it. A title may rearrange a region when its play demands it, such as a second board, an always-visible market strip, or a different small-screen arrangement. Keep each region's role recognizable so players moving between titles find the same controls in the same places.

## Regions

`DefaultTableLayout` splits the table into a left **sidebar** (`sideContent`) and a right **game column** (`gameContent`).

### Sidebar

Top to bottom:

1. History controls (`HistoryControls`).
2. Tabs for the [player panels](#player-panels), the [history panel](#history-panel), and chat (`DefaultTabs`).

`DefaultSideContent` renders both from `playersPanel`, `history`, and `chat` snippets. Compose `HistoryControls` and `DefaultTabs` directly when the title restyles them or inserts a strip between them. On small screens `DefaultTableLayout` renders the history controls above the table instead (`mobileControlsContent`), so the sidebar copy stays inside `max-sm:hidden`, as `DefaultSideContent` does.

### Game column

Top to bottom:

1. **Turn header**: one row.
    - Left end: whose turn it is. `Your turn` for the acting player; otherwise the active player's name in possessive form, `[Player name]'s turn` (`PlayerName` with `possessive`). It reads `History` in History View and `End of game` once the game has a result.
    - Right end: the single **Undo** button. Its behavior is defined in [user interaction patterns](user-interactions.md#undo).
2. **Action area** (see [action area views](#action-area-views)): exactly one of
    - the action panel, holding prompts and controls for the decision the player is making now;
    - the waiting view, for players who are not acting;
    - the history description, in History View;
    - the game-end summary once the game has a result.
3. **Board**: the main play area, scaled into the remaining height by `ScalingWrapper` (see [board scaling](#board-scaling)).

Wrap the turn header and action area in a `shrink-0` container and the board in a `flex: 1; overflow: hidden` container, so the board scales to the height left over instead of making the page scroll. The [viewport layout contract](viewport-layout-contract.md) owns the overall height budget.

## Action area views

The action area is the most-read space on the table, so every player sees useful content there, not only the acting player.

### Waiting view

A player who is not acting gets no controls here, and the space shows what is going on in the game instead. Choose content that tells them what they would otherwise hunt for:

- what is being waited for: which player, and the decision they are making;
- the live state of a step in progress that involves several players;
- what the previous player just did.

A bare "Waiting for…" line is the minimum. Give the space the same care as the action panel.

### History description

In History View the action area explains the state on screen: what happened to produce it. As the player steps backward and forward, it describes the History Step that led to the displayed state: the User Action and the consequences its System Actions produced. `gameSession.actions` and `gameSession.currentAction` follow the displayed state, so read them, not the live game's history. Build the text, and the waiting view's account of the previous player's action, from each Action's input and `metadata` alone; `undoPatch` and `forwardPatch` belong to the engine and are never a source of history. When a description needs a fact the Action does not carry, such as a value from before the Action, have the handler record it in `metadata` (see [Actions](DESIGN.md#actions)). The history panel's descriptions can usually be shared here.

## Board scaling

### Full screen

Set `expandable` on the `ScalingWrapper` that holds the primary board or map. Full screen exists so players see more of the board at a larger size; the `F` key and the expand control toggle it, and `allowFullscreenShortcut` can gate the key.

Full screen is a modal dialog, so everything outside the wrapper sits behind it and cannot be clicked. Leaving the action panel out is a fine default. To keep play going in full screen, render the action area inside the wrapper's `toolbar` snippet only while the dialog is modal, as `games/magna-grecia-ui/src/lib/components/GameTable.svelte` does with its `watchExpansion` attachment.

### Focus views

`ScalingWrapper` can zoom to a region: bind the wrapper and call `focusRect(rect, { animate, maxScale, padding })`, and `fitToContent()` to return to the whole board. Offer focus controls sparingly. They earn their place when the map is too big to read at a fitted scale, or when the game has distinct areas players repeatedly inspect. Render the controls in the `overlay` snippet so they stay over the board in full screen too; `games/oath-ui` does this with its focus chooser over named board areas. When controls overlay the board's top edge, set `insetTop` so fitting and focusing keep content clear of them.

## Small screens

A large share of players play on phones with very small screens. Treat every region as a phone design too, and check each change at a phone-sized viewport before calling it done. The right answer differs by title, so this section names where the work lands rather than a recipe.

Below the `sm` breakpoint, `DefaultTableLayout` moves the history controls above the table, lays the sidebar and game column side by side wider than the screen, and opens scrolled to the game column (`scrollToRight`); players swipe sideways to reach the sidebar.

The **turn header** and **action area** need the most attention. Both sit in the `shrink-0` container, so every pixel of height they take comes out of the board. Compact the header on small screens (`games/magna-grecia-ui` shrinks its height and text under `max-sm:`). Keep the action area to the decision at hand: short prompts, button rows that wrap, targets large enough to tap, and secondary detail collapsed or moved elsewhere. Size these regions to fit the column width so they never force sideways scrolling inside the game column.

Touch screens have no hover. Anything revealed on hover, such as previews or highlights, also needs a tap path, as `games/marracash-ui` does with `usesTouch`. On the board, full screen matters most on phones; when fitting the whole board would make its targets too small to tap, `coverBelowScale` rests it at a cover fit that fills the view and pans to the rest.

## Player panels

The players tab shows one panel per player (`PlayersPanel` rendering a `PlayerState` per player). Its baseline is a card: a header filled with the player's color holding their name, then the information players check about that seat.

Treat the panel as the game's signature: it is the strongest place to make a title look custom and unique. Design it as an object from the game's world, drawing on its theme, era, and artwork:

- `games/bus-ui`: each panel is a bus.
- `games/indonesia-ui`: panels read like period company financials.
- `games/lowenherz-ui`: panels hang under medieval flags.
- `games/sol-ui`: a layout built around that game's own resources and structure.

Pick a motif that fits the new title instead of reusing one of these. The motif serves clarity: every panel shows the player's name and color prominently, and the facts players consult most often read at a glance. Take player colors from the session's color helpers (`gameSession.colors`) so preferred colors and color-blind presentation carry through the themed design.

## History panel

The history tab tells the story of the game. At minimum it describes every action a player took, plus every System Action that carries information a player would want, built from input and `metadata` as the [history description](#history-description) is. Treat that as the floor: a good history is shaped so a reader can follow the game, which takes three tools.

- **Skip** actions that tell the reader nothing on their own, such as bookkeeping System Actions or end-of-turn markers (`games/marracash-ui` omits its end-turn action).
- **Group** actions that form one event into a single entry that grows as its actions arrive and completes when the event does.
    - An event several players contribute to, such as a simultaneous auction, is one entry that gains a line per contribution, showing only what the game has revealed so far, and closes with a compact summary of the outcome (`games/fresh-fish-ui` `AuctionResults.svelte`).
    - A turn made of many small steps, such as moving one piece, then another, then trading a resource, is one entry for the player's turn that builds up as they act and completes when the turn ends (`games/indonesia-ui` groups an operating company's turn this way).
- **Interstitials** divide the list at round, phase, or era boundaries in games that have them, so a player scrolling the history knows where they are. Derive them from the round or phase series in Game State (`games/indonesia-ui` places era and phase markers from `phaseManager.series`; `games/kaivai-ui` does the same for rounds).

Write grouping as a pure function from the action list to entries in its own module, as `actionAggregator.ts` does in `games/bus-ui` and `games/indonesia-ui`, so it can be tested apart from rendering.

### Jump and replay

Clicking an entry can do two optional things. Offer each only on the entries where it helps the reader; the right set depends on the game.

- **Jump** enters History View at that entry (`gameSession.history.goToActionIndex`). It earns its place on coarse landmarks such as a player's turn or a round, where seeing the table as it stood is useful. Jumping to each small step within a turn rarely is.
- **Replay** animates the entry's actions on the board and returns the player to where they were (`gameSession.history.replayRange`). Reserve it for actions that do something visible on the board, such as a piece moving across it; an action that changes only numbers or choices has nothing to replay.

A grouped entry replays its whole span, from its first action to its last (`games/bus-ui` carries `lastActionIndex` for this).

## Exemplars

`games/magna-grecia-ui` and `games/indonesia-ui` follow this layout, including a `Header.svelte` turn header with the contextual Undo. Layouts across older titles vary, and several render a separate Back button that predates the [Undo contract](user-interactions.md#undo); model new work on the exemplars.
