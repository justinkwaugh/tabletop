# Magna Grecia UI interaction visual contract

## Visual intents

- **Turn phases.** The action panel lays the turn out left to right as three labelled phases joined by drawn chevrons, with every action button the same height: "Two actions, or one ★ enhanced" (Roads, Cities, then Resupply), "Market" (Build market, Sell market) and "Finish" (End turn). Each button appears only while it has a legal target or allowance. A phase with nothing left is greyed and says why: the tile phase says Done (naming a ★ enhanced action when one was taken), Skipped (a market action closed it first) or None available, and the market phase says Done or None available. Choosing a market tool while tile actions remain greys the tile phase to the status it will have once the market action is taken, with no separate hint.
- **Enhanced allowance.** Roads, Cities and Resupply buttons lead with the same icon as the round tab, then the label, then the count within the card's basic value in the tab's bold serif and, while the enhanced step is still open, a superscript "+n" for the extra that only an enhanced (sole) action allows. Build market and Sell market lead with the market icon, and Sell market adds a coin. On phone widths (under 640px) the button labels are visually hidden (kept for screen readers), except that the market buttons read "Buy" and "Sell", and the extra shows as a "(+n)" centred on the count instead of a superscript, with tighter button padding so Roads, Cities and Resupply fit on one line. Phone widths also hide the hint line, except the red warning that ending the turn cannot be undone, and shorten the Cities and Roads prompts to "Found or expand a city" and "Place a road tile" by hiding their detail. With the Roads, Cities or Resupply mode active, a hint under the prompt spells out both limits; the resupply confirm button says "(★ enhanced)" when the amount chosen goes past the basic value.
- **End turn.** A market action no longer ends the turn. When End turn is the only thing left, the prompt says the turn is complete and the End turn button turns solid gold with a slow glow (no glow under reduced motion). On the last turn of a round the warning applies whether or not other actions remain: with no tool chosen the hint line says what ending the turn does (starts the next round and reveals a new action card, which cannot be undone; starts the final round; or ends the game, which cannot be undone), and the End turn button carries the same text as its tooltip. When the turn cannot be undone the hint is red and, until End turn is the only option, the button has a red outline. A chosen tool keeps the hint line for its own limits, so the outlined button carries the warning then.
- **Tool targeting.** On the acting player's turn the action panel offers Roads, Cities, Build market and Sell market for whichever have a legal target, plus Resupply and End turn. No tool is preselected at the start of a turn: the prompt asks the player to choose an action and no board space pulses until they pick one. The active tool alone decides which board spaces pulse as targets; every other space stays inert. Targets are focusable and activate with Enter or Space.
- **City placement.** City targets are filled a pale cream so they stand out from the land and show a brown outline of the city tile's temple and houses, drawn at tile size in the same colour as the road target arc; hovering one previews a ghost city tile in the player's colour. Spaces that commit the player to further tiles use a fainter, dotted outline: a space beside a village (the next tile must cover it) and a plain space that founds a city which must reach a village this turn.
- **Pending village claim.** After a tile is placed beside a village, only that village is targeted, the tool buttons disappear, and the prompt asks for the village tile.
- **Pending founding.** After founding on a plain space, only spaces that extend the new city toward a village it can legally cover are targeted, the tool buttons disappear, and the prompt asks the player to keep building until the city covers a village.
- **Road targets.** Road targets use the same pale cream fill and carry a thick, wide arc glyph.
- **Road tile laying.** Choosing a road space opens the tile laying widget, modelled on the 18xx track picker. The legal tile shapes (straight, curved) fan out in an arc beside the space, above it unless the board edge forces another side. Choosing a shape moves it onto the space as a full-size preview in its first legal orientation; a single legal shape is auto-selected. Clicking the preview (or its rotate badge) cycles that shape's legal orientations. A red ✕ and green ✓ (28-unit radius, 1.75× the original size) sit on the side of the space away from the shape arc, below it unless the arc or the board edge is there: ✕ cancels, ✓ places the road. Nothing is committed until ✓.
- **Market targeting.** Build targets show a price tag with the cost (−n) above the place. Sell targets show a price tag with the value (+n) above the tile of each sellable market, one per market, so a player with two markets in one merged city chooses which one to sell.
- **Resupply.** The Resupply button toggles an inline picker bounded by the allowance and the staging area.
- **Oracle history rows.** A road or city action that turns an oracle adds "— an oracle turns to <player>'s city" to its history row, naming the player recorded in the action's metadata when the oracle turned, so the name stays after that city merges into another.

## Coexistence and precedence

- A pending claim or pending founding overrides the chosen tool: the City tool is forced and only the city tiles that complete it are targetable.
- The tile laying widget exists only while the Road tool is active; choosing another tool, ✕, Undo, or any published state closes it. Choosing a different road space moves the widget there and forgets the previous shape and orientation.
- Choosing a mode hides the tile actions it rules out: while the resupply picker is open only Resupply remains in the tile phase, and while Build market or Sell market is chosen the tile phase greys out with its status in place of the buttons, as it will read once the market action is taken (Done after a tile action, otherwise Skipped). Undo deselects the mode and the buttons return.
- The resupply picker is its own mode: opening it deselects the Roads and Cities tools, closes any road being laid and hides every board target. Choosing a tool closes the picker; closing the picker (its button again, or Undo) restores the previously chosen tool. The picker closes when a new state is published.

## Shared visual state

| State          | Meaning                              | Producer                                                                                        | Consumers                              | Lifetime                                                                                | Validity                                            |
| -------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `activeTool`   | Which kind of target the board shows | Session: pending claim, else none while resupplying, else the turn draft's tool, else none | Action panel, target layer, header Undo | Chosen as a manual draft stage, so Undo deselects it before undoing any action. Before each published state `resetAction()` carries it forward as an automatic stage only if it belongs to the turn being left, so it stays chosen across the turn's own actions (Undo then undoes the action) but never reappears in another turn | Ignored unless its round and turn match and the tool is still available |
| `roadSpace`    | Road space being laid (manual)       | Target layer                                                                                    | Target layer, tile laying widget, action panel, header Undo | Cleared by `resetAction()` before each published state, by ✕, by Undo, and by choosing a tool | Options are re-derived from current legal road ends |
| `roadShape`    | Tile shape previewed on the space    | Widget (manual), or auto when only one shape is legal                                          | Tile laying widget, action panel       | Cleared with `roadSpace`; Undo clears a manual shape first                              | A manual shape no longer legal falls back to auto or none |
| `roadRotation` | Which legal orientation is previewed | Widget (click preview to rotate)                                                                | Tile laying widget                     | Reset whenever the space or shape changes                                               | Taken modulo the shape's legal orientations       |
| `resupplyOpen` | Resupply picker visible (suspends the build tool) | Action panel (manual `resupply` stage)                                                          | Action panel, header Undo              | Cleared by `resetAction()` before each published state, by its button, by Undo, by choosing a tool or a road space | Picker hidden when the allowance is 0               |

The tool choice, `resupplyOpen`, `roadSpace`, `roadShape` and `roadRotation` all live in one turn draft (`model/turnDraft.ts`), built on the shared staged-selection helpers with the stage order tilesSkipped, tool, resupply, space, shape: a skip, a chosen tool, the open resupply picker, the space and a manually chosen shape are manual stages, a tool carried across the turn's own actions and an auto-selected shape are not. There is no Back control: the header's single UNDO button (the session's `undo()` override) pops the highest manual stage, and only when none is left does it undo a committed action.

| State             | Meaning                                   | Producer                                                                                   | Consumers     | Lifetime                                   | Validity |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------ | -------- |
| `flipPlayerOrder` | Whether the player list may slide into its new order | Session: true only when the state change passed through `onGameStateChange`; set in `beforeNewState` | Players panel | Recomputed before every published state | Silent history swaps never call the listener, so they reorder instantly |

In History View and for inactive players `canAct` is false, so no tool, target, picker or tile laying widget is shown.

## Render ownership

- **Targets, ghost city and tile laying widget.** The target layer owns every pulsing target, the ghost city preview and the tile laying widget. It renders above the pieces layer so previews cover placed tiles, and it is the only layer with hit targets on the board.
- **Tile laying preview.** The widget draws the chosen shape full size on the space with a rotate badge when more than one orientation is legal; the chosen shape leaves the arc while it is on the space.
- **Oracle column.** The pieces layer owns it. Each oracle covers its whole village hex with an opaque white plinth so no village art shows beneath. The oracle is a marble Greek column lying on its side with a triangular pediment as its point. It points up while no city has the oracle's attention; once one does, its pediment and base take that player's colour and it points along the oracle's connection to the favoured city (`oracleViews`), not from any transient UI state.
- **Action card.** Below the turn header, the action panel (or the end-of-game panel) sits on a centred, rounded, lighter card with a soft shadow, floating above the page and set apart from the board and its round tab by a gap. When the viewer cannot act (another player's turn, or viewing history), the card shows the last action (or "Waiting for turn" / "Viewing history") and below it the current round's actions at text scale, drawn with the same `AllowanceList` as the tabs, so a waiting player can plan; on phone widths their extras show as "(+n)" like the phone buttons. The card eases its width and height to its content over 220ms (`ActionCard`), clipping while it moves and staying centred, and newly shown buttons, statuses, hints and the resupply picker fade up over 200ms; nothing animates out, so the measured size is always the final layout. Both are local presentation outside `AnimationContext`: they settle the control panel after selection or state changes, explain no game action, gate no interaction, and are off under reduced motion.
- **Phone layout.** On phone widths (under 640px) the turn header is 30px tall with 14px text, a smaller Undo button and no rule beneath it. The board area always keeps at least 40% of the viewport height (`40dvh`); when the controls above need more room the game column scrolls instead of shrinking the board further.
- **Phone turn steps.** On phone widths the action card fills the available width (only its height animates) and shows one step at a time instead of all three phases: the tile step (tile buttons and a small "Skip ›" button beneath) while tile actions are open and not skipped; the market step (market buttons and End turn on one row, wrapping only if the screen is too narrow; no chevrons and no Market or Finish titles) after Skip, once tile actions are finished, or while a market tool is chosen; and only End turn once it is the only option. Skip is a manual turn-draft stage ahead of the tool, so Undo deselects a market tool first and then returns to the tile step; choosing a tile tool clears it and it is not carried into the next published state.
- **Round tab.** "Round X of N", with both numbers in the same weight, sits on a folder tab rising from the top-left of the board frame, followed by the round's player order as squares in each player's colour with their initial, the current player's square outlined. The current round's action counts are not repeated here; they are on the action buttons. The tab shares the frame's background and highlight, so it reads as part of the frame, and its right side curves down into the frame's top edge.
- **Upcoming tab.** A mirrored folder tab rises from the top-right of the board frame with a "Next" label, then the next round's actions (icon, count and superscript "+n") and player order, drawn with the same `AllowanceList` and `SeatSquares` components as the round tab, with the label and player order at the same size, the actions a little smaller, and all of it dimmed so it never reads as the current round. It is derived from `upcomingCard()` and is hidden in the final round and after the game ends, when the frame's top-right corner is rounded again. Its content is the shared `UpcomingRound` component. On phone widths (under 640px) the tab is hidden, the frame's top-right corner is rounded, and the same content shows in a full-width strip below the action card, outside the scaled board (`UpcomingStrip`): undimmed, a small "NEXT" header label above one row with the actions on the left and the player squares on the right with no divider, the extra shown as "(+n)" centred on each count as on the phone buttons.
- **Market state.** An upright market with a player-coloured top is active (it scores its place's connections). An upright market with a black top is inactive: it no longer sits in, or is directly connected to, one of its owner's cities and scores nothing until it is again. A market lying on its side is sold. Each market stands in the upper part of the lower half of the tile it was placed on and stays there when places merge; markets sharing a tile take separate slots, outlined with a light halo and a dark base shadow so they read clearly against any tile. Activity comes from `isMarketActive` through `marketViews`, never from transient UI state.
- **Legend.** A compact single-column legend card floats over the sea in the board's bottom-right corner (there is no side panel), showing a starting (frontier) village, a village, an undeveloped space, a road, a city, and active, inactive and sold markets, drawn with the board's own art in the viewer's colour (terracotta for spectators).
- **Player colours.** Red `#d02329`, yellow `#ffe700`, gray `#aaafb3` and a deep royal blue `#2b5cc8`. The blue is far darker than the gray so blue and gray roads and cities read apart on the land, and it is bluer than the teal sea; it carries white text, while yellow and gray carry dark text.
- **Next round order.** Each player panel shows "Next round: 1st/2nd/3rd/4th" from the upcoming card's turn order; it is hidden in the final round and after the game ends.

## Verification scenarios

Scenarios 1, 4–9 and confirming a resupply were exercised manually in the single-game harness. Scenario 2, the mode and Undo paths of scenario 3, the empty tool selection at the start of a turn, the enhanced chip and hint of scenario 11, and the market, End turn and round-end warning paths of scenario 10 are automated in `tests/turnControls.spec.ts`.

1. **Claim start and Undo.**
    - Start: a new 4-player game.
    - Input: choose Cities.
    - Expected: the 10 frontier villages are solid targets and the plain spaces beside them are dotted. Clicking a dotted space leaves only its village targeted, shows the claim prompt and hides the tool buttons.
    - Cancel: Undo removes the tile and restores the tool buttons and all city targets.
2. **Road tile laying.**
    - Start: the player has a frontier city.
    - Input: choose Roads, then a space where both shapes are legal.
    - Expected: straight and curved tiles fan out beside the space. Choosing curved moves it onto the space; clicking it steps through its legal orientations; ✓ places the road and closes the widget.
    - Cancel: ✕, or Undo with no shape chosen, closes the widget without placing anything; Undo with a shape chosen returns to the arc.
    - Replacement: choosing another tool or another road space while the widget is open closes it or moves it there.
    - Publish: the state published by ✓ closes the widget.
3. **Resupply picker.**
    - Input: open Resupply, step roads and cities, then confirm.
    - Expected: supply and staging counts update and the picker closes.
    - Cancel: Undo closes the picker without moving tiles.
    - Mode: while the picker is open no tool button is highlighted and no board space pulses; choosing Roads or Cities closes it, and closing it with its button or Undo restores the previously chosen tool.
4. **Market targets.**
    - Input: choose Build market.
    - Expected: price tags appear on eligible villages and rival cities, and clicking one builds the market, keeps the turn open with only End turn left (highlighted) and marks the tile phase Skipped if no tile action was taken.
    - Merge: a market built on a village or city tile stays on that tile when the place is covered or merged into a larger city.
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
    - Expected: a +n price tag appears on the tile of each of the player's active markets, including a market worth 0; clicking one lays that market on its side and leaves only the highlighted End turn.
9. **Silent history replay.**
    - Start: a game at least one round past a round whose card changed the turn order.
    - Input: click an action from the earlier round in the history list to replay it.
    - Expected: the player list switches order instantly when the replay starts and ends; it only slides when a live or stepped state change reorders it.
10. **Turn phases and End turn.**
    - Start: the first turn of a new game.
    - Input: choose Build market and click a price tag.
    - Expected: the market is built, the turn stays with the same player, the tile phase reads Skipped, no Roads, Cities, Resupply or market buttons remain and End turn is solid gold.
    - Round end: on the last turn of a round, before any action, the red warning shows and End turn has a red outline and the warning as its tooltip; choosing Cities moves the hint line to the city limits while the outline stays. End turn passes the turn.
11. **Enhanced allowance.**
    - Start: the first turn of a new game.
    - Expected: Cities, Roads (once reachable) and Resupply show the basic count and a superscript "+1" (or "+n"); choosing Cities shows a hint with the basic limit and the enhanced total.
    - Input: place cities past the basic value.
    - Expected: Roads and Resupply disappear and the tile phase reads "Done: ★ enhanced cities".
