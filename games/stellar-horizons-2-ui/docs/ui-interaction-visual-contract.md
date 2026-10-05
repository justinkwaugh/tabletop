# Stellar Horizons II UI interaction visual contract

## Visual intents

### Ships on the star map

- **Display:** each ship is a pip in its faction's colour: a rounded square with the CV's size above three fixed slots that mark whether it has exploration (blue circle), cargo (orange hexagon) and combat (red triangle) values, with an empty slot where it has none, or a smaller circle for an RE (80% of a CV's size), showing its exploration value in a blue circle. A ship still on its way is drawn as a faction-coloured outline on a dark fill, with a gold badge giving the turns until it arrives. A red border just outside the pip marks damage (thicker when crippled) and a white dot marks cargo.
- **Placement:** each faction's ships at a system form one honeycomb clump. Clumps are threaded clockwise along the orbit among the worlds, in faction order, and never cover a world, a base tab, the exploration marker or the tile's printed text. Pips are as large as the system allows and shrink only when needed to fit; in extreme crowds a faction's clump splits into adjacent smaller clumps rather than hiding a ship.

### Bases on the star map

- **Display:** each base is a tab filled with its owner's faction colour, showing its settlement count. Like ship pips, it carries no faction emblem. A base that meets the scenario's victory condition (in Footfall, 10 or more settlements in a system whose worlds total at least 25 population) has a gold outline. Hovering a tab names the faction and its settlements.
- **Placement:** a system's bases are tabs attached to one slanted edge of the tile, each cut to the edge's angle and reaching the seam between tiles, stacked in rows down that edge in faction order. Rows hold two or three tabs only when no edge has room for one per row, so a system's bases never wrap around a corner. Tabs keep clear of the worlds, the star, the exploration marker and the printed text, and ships keep clear of the tabs.

### Inspecting a clump

- **Trigger:** clicking a faction's clump of ships at a system, the player's own or a rival's, in any step or view. Individual pips are not separate targets; the whole clump, including the small gaps between its pips, is one click target, and it does nothing on hover beyond a glow.
- **Emphasis:** a strip opens just above the clump (below it near the top edge) showing every ship in the clump as its full printed counter (square with slightly rounded corners, as printed); a damaged ship has a red border with a soft red glow behind it and a solid red damage badge joined to the border at the top left, where the counter's faction flag is left out so the badge stands alone, and cargo sits at the middle of the left edge, and a caption naming it (and its turns until arrival). The counter carries no arrival badge; the pip on the map shows it. The open clump keeps its glow.
- **Choosing from the strip:** in a step where the player can act with a ship, its counter in the strip is clickable; clicking it chooses that ship and closes the strip. Counters that cannot act are shown but do nothing.
- **Closing:** clicking the same clump again, clicking anywhere else on the board, or pressing Escape. Clicking another clump switches the strip to it.

### Zooming into a system

- **Trigger:** clicking a system's printed name on the star map (cursor shows zoom-in and the name area highlights on hover).
- **Emphasis:** in one motion, the star map's camera moves from the current view until that system's hex fills the part of the map the panel leaves clear, a panel slides in over the map's right edge (from the bottom, as a sheet, on narrow screens), and the other systems dim. The panel lists every faction present: its settlements there against the goal, and its ships as the same counters and, under a ship still on its way, only its turns until arrival. The panel leaves out what the tile already shows, such as worlds, habitability and exploration markers. Neighbouring systems remain faintly visible and the map can still be panned and zoomed; clicking a visible neighbour's name moves the camera over to it the same way.
- **In the zoomed view:** clicking a clump highlights that faction in the panel instead of opening a strip; a ship counter in the panel is clickable when that ship can act, choosing it without leaving the view.
- **Leaving:** Back to map or Escape reverses the motion: the panel slides out and the dimming lifts while the camera returns to the view from before zooming in (the whole map if the zoom began on another view). Nothing is swapped in afterwards. Reduced-motion users get the change without animation.

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
- **Panning the star map:** once zoomed in at all, the star map can be dragged past its edges until an edge reaches the middle of the view, as on 18xx maps (wide layouts always; narrow layouts only when expanded). The map's background fades into the page colour at its edges, so no border shows. The tech chart does not overpan.
- **Category focus:** the All / Biology / Physics / Engineering buttons show every category or just one, for the rest of the session. A focused category uses taller cards with larger text, and each card lists its prerequisites from other categories, because their connectors are not drawn. Focus never changes which techs are available or chosen.

## Coexistence and precedence

- **One choice at a time.** Ship and tech choices share one selection. Ships are only selectable in the first four steps and techs only in the develop-techs step, so they never coexist.
- **Destinations depend on the ship.** Destination highlights exist only while a ship is chosen in the movement step, and the board draws them above that system's ships.
- **Other players' actions.** Another player's action arriving during simultaneous play does not clear the current player's choice. It stays as long as it remains valid.
- **Strip and selection.** Choosing a ship from a strip closes the strip; the chosen ship then shows its gold ring on the map and in the strip when reopened. The strip is drawn above every tile, including destination outlines.
- **Zoom and strip.** No strip is shown while zoomed; the panel lists the ships instead, and the inspected clump only highlights its faction there.
- **Zoom and tech chart.** Switching to the tech chart keeps the zoom; returning to the star map moves the camera to the zoomed system again. The tech chart has its own camera and is never zoomed by it.
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

### Focused system

- **Meaning:** the system the board is zoomed into, and whether the zoom is on its way out.
- **Owner and readers:** owned by the game session; set by a tile's name and the panel's Back button or Escape; read by the table (camera target and panel), the board (neighbour dimming and strip) and the panel.
- **Lifetime:** cleared when the zoom-out motion completes after Back or Escape.
- **Validity:** derived from the current state; it applies only while the system is in play.
- **History and replay:** the zoom stays while navigating history; the panel describes the displayed state.

### Destinations

- **Meaning:** the reachable systems and travel times for the chosen ship.
- **Source:** derived from the selection and the movement rules; it is never stored.
- **Effects:** drives the destination outlines on the star map and the destination buttons in the panel.
- **Validity:** it disappears as soon as the selection is no longer valid or the ship has moved.

## Render ownership

- **Base tabs and pip layout:** computed once per system by the board, the base tabs first so the pip layout can keep ships clear of them. Both are drawn by the system tile; the ship strip anchors to the clumps.
- **Selection ring:** drawn by the ship pip.
- **Ship strip:** drawn by the board above every system tile.
- **Zoom:** the star map's scaling wrapper owns the camera; the table asks it to focus the system's hex with the panel's size kept clear, and to restore the captured earlier view on the way out. The panel slide, the camera move and the dimming share one duration and easing. The table reports the zoom-out's completion to the session after that duration.
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
| Many bases             | Six bases at one system, with ships                 | Lay out the system                                                   | One column of tabs on one edge, clear of worlds and printed text; no ship over a tab         | Automated (`baseTabLayout.spec.ts`)  |
| Zoom into a system     | A probe at Sol                                      | Click Sol's name; then Back; then click it and press Escape          | The view zooms to Sol with a panel listing the probe; each exit returns to the map           | Automated                            |
| Choose from the panel  | Movement step, zoomed into Sol                      | Click the probe in the panel                                         | The probe is chosen; the zoom stays                                                          | Automated                            |
| Summary data           | Systems with and without ships and bases            | Summarise the system                                                 | Each faction present with its settlements and ships, the viewer's first                      | Automated (`systemSummary.spec.ts`)  |
