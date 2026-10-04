# Stellar Horizons II UI interaction visual contract

## Visual intents

### Choosing a ship

- **Trigger:** the acting player clicks one of their own ships during build, cargo, movement or exploration, either its counter on the star map or its tile in the action panel. Clicking the selected ship again clears the choice.
- **Emphasis:**
    - The counter on the map gains a gold selection frame.
    - The ship's tile in the action panel gains a gold border.
- **Unaffected:** other ships, system tiles, worlds and bases keep their normal look. Ships that cannot act in the current step are not clickable; the movement step only offers ships that have arrived and have a destination, and the exploration step only offers ships that can explore.

### Choosing a destination

- **Trigger:** a ship is chosen during the movement step.
- **Emphasis:** every system the ship can reach gains a cyan hex outline and a label with the travel time. The action panel lists the same destinations as buttons.
- **Commit:** clicking a highlighted system or a destination button moves the ship and clears the choice.
- **Unaffected:** unreachable systems keep their normal look and are not clickable.

### Choosing a tech

- **Trigger:** during the develop-techs step, the acting player clicks a tech the chart marks as available.
- **Emphasis:**
    - Available techs show a cyan frame and their current cost.
    - The chosen tech shows a thick gold frame.
    - The action panel shows that tech's payment, with the suggested markers lit and the cash top-up. Toggling a marker changes only the payment, not the chart.
- **Commit:** developing the tech commits the action and clears the choice; Cancel clears it without committing.

### Star map or tech chart

- **Default:** the main area shows the star map, and switches to the tech chart while the acting player is in the develop-techs step.
- **Override:** the Star map / Tech chart buttons override the default for the rest of the current step only.

## Coexistence and precedence

- **One choice at a time.** Ship and tech choices share one selection. Ships are only selectable in the first four steps and techs only in the develop-techs step, so they never coexist.
- **Destinations depend on the ship.** Destination highlights exist only while a ship is chosen in the movement step, and the board draws them above that system's ships.
- **Other players' actions.** Another player's action arriving during simultaneous play does not clear the current player's choice. It stays as long as it remains valid.

## Shared visual state

### Selection

- **Meaning:** the acting player's manual choice of a ship or a tech.
- **Owner and readers:** owned by the game session. It is read by the star map (selection frame, destination outlines), the tech chart (gold frame) and the action panel (tile border, destination buttons, payment).
- **Lifetime:** cleared by clicking the chosen item again, by Cancel, by Undo (which clears a manual choice before undoing any action), by ending the step, and by committing any action that consumes the choice.
- **Validity:** derived from the current state. A ship choice applies only while the player can act, is in a ship step, and still owns the ship. A tech choice applies only during the develop-techs step while the tech is still available.
- **History and replay:** the player cannot act in History View, so no choice is shown there, and returning to Live View shows a still-valid choice again. Replay and silent restoration do not change the choice.

### Destinations

- **Meaning:** the reachable systems and travel times for the chosen ship.
- **Source:** derived from the selection and the movement rules; it is never stored.
- **Effects:** drives the destination outlines on the star map and the destination buttons in the panel.
- **Validity:** it disappears as soon as the selection is no longer valid or the ship has moved.

## Render ownership

- **Selection frame:** drawn by the ship counter on the star map.
- **Destination outline and travel-time label:** drawn by the system tile, above its ships, so a click anywhere on a reachable system commits the move.
- **Tech frames and cost labels:** drawn by the tech chart overlay above the chart image. Faction flags of owners are drawn by the same overlay.

## Verification scenarios

| Scenario               | Start                                               | Input                             | Expected                                                                                         | Verification                         |
| ---------------------- | --------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Choose and move a ship | Movement step, an arrived probe at Sol              | Click the probe's tile            | Gold frame on the counter; reachable systems outlined with travel times; matching buttons listed | Automated (`tests/turnFlow.spec.ts`) |
| Commit by map          | As above                                            | Click Alpha Centauri on the map   | The probe moves with a transit badge; outlines and frame clear                                   | Automated                            |
| Undo a choice          | A ship is chosen, with no committed action after it | Click Undo                        | The choice clears and no action is undone                                                        | Automated                            |
| Choose a tech          | Develop-techs step                                  | Click an available tech           | Gold frame; payment shown with suggested markers; developing it records the tech                 | Automated                            |
| History view           | A ship is chosen                                    | Step back in history              | No frame or outlines; returning to Live View restores them                                       | Automated                            |
| Simultaneous play      | A ship is chosen; another player acts               | The other player's action arrives | The choice stays                                                                                 | Automated                            |
