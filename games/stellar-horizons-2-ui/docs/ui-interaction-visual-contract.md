# Stellar Horizons II UI interaction visual contract

## Visual intents

### Ships on the star map

- **Display:** each ship is a pip in its faction's colour: a rounded square with the CV's size, or a smaller circle for an RE (80% of a CV's size), showing its exploration value in a blue circle. A ship still on its way is drawn as a faction-coloured outline on a dark fill, with a gold badge giving the turns until it arrives. A red bar marks damage (white-edged when crippled) and a white dot marks cargo.
- **Placement:** each faction's ships at a system form one honeycomb clump. Clumps are threaded clockwise along the orbit among the worlds, in faction order, and never cover a world, the base, the exploration marker or the tile's printed text. Pips are as large as the system allows and shrink only when needed to fit; in extreme crowds a faction's clump splits into adjacent smaller clumps rather than hiding a ship.

### Inspecting a clump

- **Trigger:** clicking a faction's clump of ships at a system, the player's own or a rival's, in any step or view. Individual pips are not separate targets; the whole clump, including the small gaps between its pips, is one click target, and it does nothing on hover beyond a glow.
- **Emphasis:** a strip opens just above the clump (below it near the top edge) showing every ship in the clump as its full printed counter, with arrival, damage and cargo badges and a caption naming it (and its turns until arrival). The open clump keeps its glow.
- **Choosing from the strip:** in a step where the player can act with a ship, its counter in the strip is clickable; clicking it chooses that ship and closes the strip. Counters that cannot act are shown but do nothing.
- **Closing:** clicking the same clump again, clicking anywhere else on the board, or pressing Escape. Clicking another clump switches the strip to it.

### Choosing a ship

- **Trigger:** the acting player clicks one of their own ships during build, cargo, movement or exploration, either its counter in a clump's strip on the star map or its tile in the action panel. Clicking the selected ship again clears the choice.
- **Emphasis:**
    - The pip on the map gains a gold ring.
    - The ship's tile in the action panel gains a gold border.
- **Unaffected:** other ships, system tiles, worlds and bases keep their normal look. Ships that cannot act in the current step are not clickable; the movement step only offers ships that have arrived and have a destination, and the exploration step only offers ships that can explore.

### Choosing a destination

- **Trigger:** a ship is chosen during the movement step.
- **Emphasis:** every system the ship can reach gains a cyan hex outline and a label with the travel time. The action panel lists the same destinations as buttons.
- **Commit:** clicking a highlighted system or a destination button moves the ship and clears the choice.
- **Unaffected:** unreachable systems keep their normal look and are not clickable.

### Choosing a tech

- **Trigger:** during the develop-techs step, the acting player clicks a tech marked as available in the tech tree.
- **Emphasis:**
    - Available techs show a cyan frame and their current cost.
    - The chosen tech shows a thick gold frame.
    - The action panel shows that tech's payment, with the suggested markers lit and the cash top-up. Toggling a marker changes only the payment, not the chart.
- **Commit:** developing the tech commits the action and clears the choice; Cancel clears it without committing.

### Star map or tech chart

- **Default:** the main area shows the star map, and switches to the tech chart while the acting player is in the develop-techs step.
- **Override:** the Star map / Tech chart buttons override the default for the rest of the current step only.
- **Category focus:** the All / Biology / Physics / Engineering buttons show every category or just one, for the rest of the session. A focused category uses taller cards with larger text, and each card lists its prerequisites from other categories, because their connectors are not drawn. Focus never changes which techs are available or chosen.

## Coexistence and precedence

- **One choice at a time.** Ship and tech choices share one selection. Ships are only selectable in the first four steps and techs only in the develop-techs step, so they never coexist.
- **Destinations depend on the ship.** Destination highlights exist only while a ship is chosen in the movement step, and the board draws them above that system's ships.
- **Other players' actions.** Another player's action arriving during simultaneous play does not clear the current player's choice. It stays as long as it remains valid.
- **Strip and selection.** Choosing a ship from a strip closes the strip; the chosen ship then shows its gold ring on the map and in the strip when reopened. The strip is drawn above every tile, including destination outlines.
- **Strip and destinations.** While a ship is chosen in the movement step, a reachable system's outline covers its clumps, so a click there moves the ship rather than opening a strip.

## Shared visual state

### Selection

- **Meaning:** the acting player's manual choice of a ship or a tech.
- **Owner and readers:** owned by the game session. It is read by the star map (selection ring, destination outlines), the tech chart (gold frame) and the action panel (tile border, destination buttons, payment).
- **Lifetime:** cleared by clicking the chosen item again, by Cancel, by Undo (which clears a manual choice before undoing any action), by ending the step, and by committing any action that consumes the choice.
- **Validity:** derived from the current state. A ship choice applies only while the player can act, is in a ship step, and still owns the ship. A tech choice applies only during the develop-techs step while the tech is still available.
- **History and replay:** the player cannot act in History View, so no choice is shown there, and returning to Live View shows a still-valid choice again. Replay and silent restoration do not change the choice.

### Inspected clump

- **Meaning:** the faction clump at a system whose strip is open.
- **Owner and readers:** owned by the game session; set by the clump, read by the clump (glow) and the board's ship strip.
- **Effects:** drives the strip and the clump's glow only.
- **Lifetime:** cleared by clicking the clump again, clicking elsewhere on the board, Escape, or choosing a ship from the strip.
- **Validity:** derived from the current state; it applies only while that player still has ships at that system, and the strip always lists the ships there now.
- **History and replay:** the strip shows the clump as it stands in the displayed state, live or historical.

### Destinations

- **Meaning:** the reachable systems and travel times for the chosen ship.
- **Source:** derived from the selection and the movement rules; it is never stored.
- **Effects:** drives the destination outlines on the star map and the destination buttons in the panel.
- **Validity:** it disappears as soon as the selection is no longer valid or the ship has moved.

## Render ownership

- **Pip layout:** computed once per system by the board and shared by the system tile, which draws the clumps, and the ship strip, which anchors to them.
- **Selection ring:** drawn by the ship pip.
- **Ship strip:** drawn by the board above every system tile.
- **Destination outline and travel-time label:** drawn by the system tile, above its ships, so a click anywhere on a reachable system commits the move.
- **Tech status, cost and owners:** derived once per tech and drawn by the tech tree, with cards above their prerequisite connectors.

## Verification scenarios

| Scenario               | Start                                               | Input                                                                | Expected                                                                                     | Verification                         |
| ---------------------- | --------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------ |
| Choose and move a ship | Movement step, an arrived probe at Sol              | Click the probe's panel tile                                         | Gold ring on the pip; reachable systems outlined with travel times; matching buttons listed  | Automated (`tests/turnFlow.spec.ts`) |
| Commit by map          | As above                                            | Click Alpha Centauri on the map                                      | The probe becomes an outlined pip with a turns badge; outlines and ring clear                | Automated                            |
| Undo a choice          | A ship is chosen, with no committed action after it | Click Undo                                                           | The choice clears and no action is undone                                                    | Automated                            |
| Choose a tech          | Develop-techs step                                  | Click an available tech                                              | Gold frame; payment shown with suggested markers; developing it records the tech             | Automated                            |
| History view           | A ship is chosen                                    | Step back in history                                                 | No ring or outlines; returning to Live View restores them                                    | Automated                            |
| Simultaneous play      | A ship is chosen; another player acts               | The other player's action arrives                                    | The choice stays                                                                             | Automated                            |
| Inspect a clump        | Two ships of one faction at Sol                     | Hover, then click the clump; click again, Escape, or click the board | Hover shows nothing; click opens a strip of both counters; each close action closes it       | Automated                            |
| Choose from a strip    | Movement step, an arrived probe at Sol              | Open its clump, click its counter                                    | The probe is chosen and the strip closes; destinations appear                                | Automated                            |
| Crowded systems        | Six factions with many ships at one system          | Lay out the system                                                   | Every ship is placed, clear of worlds and printed text, one clump per faction where possible | Automated (`shipPipLayout.spec.ts`)  |
