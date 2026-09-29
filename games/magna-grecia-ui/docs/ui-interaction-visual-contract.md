# Magna Grecia UI interaction visual contract

## Visual intents

- **Tool targeting.** On the acting player's turn the action panel offers Roads, Cities, Build market and Sell market for whichever have a legal target, plus Resupply and End turn. The active tool alone decides which board spaces pulse as targets; every other space stays inert. Targets are focusable and activate with Enter or Space.
- **City placement.** City targets pulse; hovering one previews a ghost city tile in the player's colour. Spaces that commit the player to further tiles use a fainter, dotted outline: a space beside a village (the next tile must cover it) and a plain space that founds a city which must reach a foundable village this turn.
- **Pending village claim.** After a tile is placed beside a village, only that village is targeted, the tool buttons disappear, and the prompt asks for the village tile.
- **Pending founding.** After founding on a plain space, only spaces that extend the new city toward a foundable village are targeted, the tool buttons disappear, and the prompt asks the player to keep building until the city covers a village.
- **Road orientation.** Choosing a road space with one legal orientation places the road immediately. With several, the space stays highlighted and a ring of orientation choices opens around it; hovering a choice previews it on the space.
- **Market targeting.** Build and sell targets show a price tag with the cost (−n) or value (+n) above the place.
- **Resupply.** The Resupply button toggles an inline picker bounded by the allowance and the staging area.

## Coexistence and precedence

- A pending claim or pending founding overrides the chosen tool: the City tool is forced and only the city tiles that complete it are targetable.
- The road orientation ring exists only while the Road tool is active; choosing another tool, Back, or any published state closes it.
- The resupply picker may be open alongside any tool's targets; both close when a new state is published.

## Shared visual state

| State          | Meaning                              | Producer                                                                                        | Consumers                              | Lifetime                                                                                | Validity                                            |
| -------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `activeTool`   | Which kind of target the board shows | Session: pending claim, else the player's chosen tool, else the first of Roads/Cities available | Action panel, target layer             | The choice is keyed to the round and turn, so it lapses when the turn changes           | Derived from currently available tools              |
| `roadSpace`    | Road space awaiting an orientation   | Target layer                                                                                    | Target layer, road picker, header Back | Cleared by `resetAction()` before each published state, by Back, and by choosing a tool | Options are re-derived from current legal road ends |
| `resupplyOpen` | Resupply picker visible              | Action panel                                                                                    | Action panel, header Back              | Cleared like `roadSpace`                                                                | Picker hidden when the allowance is 0               |

In History View and for inactive players `canAct` is false, so no tool, target, picker or ring is shown.

## Render ownership

- **Targets, ghost city and road ring.** The target layer owns every pulsing target, the ghost city preview and the road orientation ring. It renders above the pieces layer so previews cover placed tiles, and it is the only layer with hit targets on the board.
- **Road ring preview.** The ring draws its hovered choice as a ghost tile on the chosen space, under the ring's dimming disc and choice buttons.
- **Oracle column.** The pieces layer owns it. Each oracle covers its whole village hex with an opaque slate plinth so no village art shows beneath. The oracle is a marble Greek column lying on its side with a triangular pediment as its point. It points up while no city has the oracle's attention; once one does, its pediment and base take that player's colour and it points along the oracle's connection to the favoured city (`oracleViews`), not from any transient UI state.
- **Upcoming round.** The action card panel shows the next round's card (allowances and turn order) in an "Upcoming round" box below the current card. It is derived from `upcomingCard()` and is hidden in the final round and after the game ends.

## Verification scenarios

All scenarios were exercised manually in the single-game harness with Playwright.

1. **Claim start and Undo.**
    - Start: a new 4-player game.
    - Input: choose Cities.
    - Expected: the 10 frontier villages are solid targets and the plain spaces beside them are dotted. Clicking a dotted space leaves only its village targeted, shows the claim prompt and hides the tool buttons.
    - Cancel: Undo removes the tile and restores the tool buttons and all city targets.
2. **Road ring.**
    - Start: the player has a frontier city.
    - Input: choose Roads, then a space with three legal orientations.
    - Expected: a three-choice ring opens. Hovering a choice previews it on the space, and clicking places the road and closes the ring.
    - Cancel: Back closes the ring without placing anything.
    - Replacement: choosing another tool while the ring is open closes it and shows that tool's targets.
3. **Resupply picker.**
    - Input: open Resupply, step roads and cities, then confirm.
    - Expected: supply and staging counts update and the picker closes.
    - Cancel: Back closes the picker without moving tiles.
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
