# Magna Grecia UI interaction visual contract

## Visual intents

- **Tool targeting.** On the acting player's turn the action panel offers Roads, Cities, Build market and Sell market for whichever have a legal target, plus Resupply and End turn. No tool is preselected at the start of a turn: the prompt asks the player to choose an action and no board space pulses until they pick one. The active tool alone decides which board spaces pulse as targets; every other space stays inert. Targets are focusable and activate with Enter or Space.
- **City placement.** City targets are filled a pale cream so they stand out from the land and show a brown outline of the city tile's temple and houses, drawn at tile size in the same colour as the road target arc; hovering one previews a ghost city tile in the player's colour. Spaces that commit the player to further tiles use a fainter, dotted outline: a space beside a village (the next tile must cover it) and a plain space that founds a city which must reach a village this turn.
- **Pending village claim.** After a tile is placed beside a village, only that village is targeted, the tool buttons disappear, and the prompt asks for the village tile.
- **Pending founding.** After founding on a plain space, only spaces that extend the new city toward a village it can legally cover are targeted, the tool buttons disappear, and the prompt asks the player to keep building until the city covers a village.
- **Road targets.** Road targets use the same pale cream fill and carry a thick, wide arc glyph.
- **Road tile laying.** Choosing a road space opens the tile laying widget, modelled on the 18xx track picker. The legal tile shapes (straight, curved) fan out in an arc beside the space, above it unless the board edge forces another side. Choosing a shape moves it onto the space as a full-size preview in its first legal orientation; a single legal shape is auto-selected. Clicking the preview (or its rotate badge) cycles that shape's legal orientations. A red ✕ and green ✓ sit above the space: ✕ cancels, ✓ places the road. Nothing is committed until ✓.
- **Market targeting.** Build and sell targets show a price tag with the cost (−n) or value (+n) above the place.
- **Resupply.** The Resupply button toggles an inline picker bounded by the allowance and the staging area.

## Coexistence and precedence

- A pending claim or pending founding overrides the chosen tool: the City tool is forced and only the city tiles that complete it are targetable.
- The tile laying widget exists only while the Road tool is active; choosing another tool, ✕, Back, or any published state closes it. Choosing a different road space moves the widget there and forgets the previous shape and orientation.
- The resupply picker is its own mode: opening it deselects the Roads and Cities tools, closes any road being laid and hides every board target. Choosing a tool closes the picker; closing the picker (its button again, or Back) restores the previously chosen tool. The picker closes when a new state is published.

## Shared visual state

| State          | Meaning                              | Producer                                                                                        | Consumers                              | Lifetime                                                                                | Validity                                            |
| -------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `activeTool`   | Which kind of target the board shows | Session: pending claim, else none while resupplying, else the chosen tool, else none | Action panel, target layer             | The choice is keyed to the round and turn, so it lapses when the turn changes           | Derived from currently available tools              |
| `roadSpace`    | Road space being laid (manual)       | Target layer                                                                                    | Target layer, tile laying widget, action panel, header Back | Cleared by `resetAction()` before each published state, by ✕, by Back, and by choosing a tool | Options are re-derived from current legal road ends |
| `roadShape`    | Tile shape previewed on the space    | Widget (manual), or auto when only one shape is legal                                          | Tile laying widget, action panel       | Cleared with `roadSpace`; Back clears a manual shape first                              | A manual shape no longer legal falls back to auto or none |
| `roadRotation` | Which legal orientation is previewed | Widget (click preview to rotate)                                                                | Tile laying widget                     | Reset whenever the space or shape changes                                               | Taken modulo the shape's legal orientations       |
| `resupplyOpen` | Resupply picker visible (suspends the build tool) | Action panel                                                                                    | Action panel, header Back              | Cleared like `roadSpace`                                                                | Picker hidden when the allowance is 0               |

`roadSpace`, `roadShape`, `roadRotation` and `resupplyOpen` all live in one turn draft (`model/turnDraft.ts`), built on the shared staged-selection helpers: the space and a manually chosen shape are manual stages, an auto-selected shape is derived and never stored, and Back pops the highest manual stage.

| State             | Meaning                                   | Producer                                                                                   | Consumers     | Lifetime                                   | Validity |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------ | -------- |
| `flipPlayerOrder` | Whether the player list may slide into its new order | Session: true only when the state change passed through `onGameStateChange`; set in `beforeNewState` | Players panel | Recomputed before every published state | Silent history swaps never call the listener, so they reorder instantly |

In History View and for inactive players `canAct` is false, so no tool, target, picker or tile laying widget is shown.

## Render ownership

- **Targets, ghost city and tile laying widget.** The target layer owns every pulsing target, the ghost city preview and the tile laying widget. It renders above the pieces layer so previews cover placed tiles, and it is the only layer with hit targets on the board.
- **Tile laying preview.** The widget draws the chosen shape full size on the space with a rotate badge when more than one orientation is legal; the chosen shape leaves the arc while it is on the space.
- **Oracle column.** The pieces layer owns it. Each oracle covers its whole village hex with an opaque white plinth so no village art shows beneath. The oracle is a marble Greek column lying on its side with a triangular pediment as its point. It points up while no city has the oracle's attention; once one does, its pediment and base take that player's colour and it points along the oracle's connection to the favoured city (`oracleViews`), not from any transient UI state.
- **Round cards.** The action card panel shows "Round X of N" with both numbers in the same weight, the current round card, and below it an "Upcoming · Round N" card for the next round. Both cards come from the same `RoundCard` component and show every basic and enhanced allowance and a Player Order list; the upcoming card is smaller, muted and dashed so it never reads as the active card. It is derived from `upcomingCard()` and is hidden in the final round and after the game ends.
- **Market state.** An upright market with a player-coloured top is active (it scores its place's connections). An upright market with a black top is inactive: it no longer sits in, or is directly connected to, one of its owner's cities and scores nothing until it is again. A market lying on its side is sold. Markets stand in the upper part of the lower half of their place, outlined with a light halo and a dark base shadow so they read clearly against any tile. Activity comes from `isMarketActive` through `marketViews`, never from transient UI state.
- **Legend.** Below the upcoming round card, a legend shows a starting (frontier) village, a village, an undeveloped space, a road, a city, and active, inactive and sold markets, drawn with the board's own art in the viewer's colour (terracotta for spectators).
- **Next round order.** Each player panel shows "Next round: 1st/2nd/3rd/4th" from the upcoming card's turn order; it is hidden in the final round and after the game ends.

## Verification scenarios

Scenarios 1, 4–9 and confirming a resupply were exercised manually in the single-game harness. Scenario 2, the mode and Back paths of scenario 3, and the empty tool selection at the start of a turn are automated in `tests/turnControls.spec.ts`.

1. **Claim start and Undo.**
    - Start: a new 4-player game.
    - Input: choose Cities.
    - Expected: the 10 frontier villages are solid targets and the plain spaces beside them are dotted. Clicking a dotted space leaves only its village targeted, shows the claim prompt and hides the tool buttons.
    - Cancel: Undo removes the tile and restores the tool buttons and all city targets.
2. **Road tile laying.**
    - Start: the player has a frontier city.
    - Input: choose Roads, then a space where both shapes are legal.
    - Expected: straight and curved tiles fan out beside the space. Choosing curved moves it onto the space; clicking it steps through its legal orientations; ✓ places the road and closes the widget.
    - Cancel: ✕, or Back with no shape chosen, closes the widget without placing anything; Back with a shape chosen returns to the arc.
    - Replacement: choosing another tool or another road space while the widget is open closes it or moves it there.
    - Publish: the state published by ✓ closes the widget.
3. **Resupply picker.**
    - Input: open Resupply, step roads and cities, then confirm.
    - Expected: supply and staging counts update and the picker closes.
    - Cancel: Back closes the picker without moving tiles.
    - Mode: while the picker is open no tool button is highlighted and no board space pulses; choosing Roads or Cities closes it, and closing it with its button or Back restores the previously chosen tool.
4. **Market targets.**
    - Input: choose Build market.
    - Expected: price tags appear on eligible villages and rival cities, and clicking one builds the market and passes the turn.
5. **History navigation.**
    - Start: the Roads tool is active.
    - Input: step back in history.
    - Expected: no tool buttons, targets or ring are shown.
    - Returning to Live View restores the targets of the chosen tool.
6. **Game end.**
    - Input: play to the end.
    - Expected: the end panel lists winners with points, markets, oracles and totals, and no targets remain.
7. **Pending founding.**
    - Start: a new game with a card that allows at least two cities.
    - Input: choose Cities and click a dotted plain space that founds a city away from a village.
    - Expected: only spaces that extend the new city toward a village it can legally cover are targeted, the tool buttons disappear and the prompt asks the player to keep building; covering the village places the founding market and restores the tool buttons.
8. **Sell market.**
    - Start: the player owns an active market.
    - Input: choose Sell market.
    - Expected: a +n price tag appears on each place holding one of the player's active markets, including a market worth 0; clicking one lays the market on its side and passes the turn.
9. **Silent history replay.**
    - Start: a game at least one round past a round whose card changed the turn order.
    - Input: click an action from the earlier round in the history list to replay it.
    - Expected: the player list switches order instantly when the replay starts and ends; it only slides when a live or stepped state change reorders it.
