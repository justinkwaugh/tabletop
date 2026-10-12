# Stellar Horizons II UI interaction visual contract

## Visual intents

### Ships on the star map

- **Display:** each ship is a pip in its faction's colour: a rounded square with the CV's size above three fixed slots that mark whether it has exploration (blue circle), cargo (orange hexagon) and combat (red triangle) values, with an empty slot where it has none, or a smaller diamond for an RE, showing its exploration value in a blue circle. A ship still on its way is drawn as a faction-coloured outline on a dark fill, with a gold badge giving the turns until it arrives. A red border just outside the pip marks damage (thicker when crippled). A white dot on the pip's top left corner marks cargo, the same size and the same distance in from the corner as the arrival badge on the top right.
- **Placement:** each faction's ships at a system form one honeycomb clump. Clumps are threaded clockwise along the orbit among the worlds, in faction order, and never cover a world, a base tab, the exploration marker, an anomaly or the tile's printed text. Pips are as large as the system allows and shrink only when needed to fit; in extreme crowds a faction's clump splits into adjacent smaller clumps rather than hiding a ship.

### Bases on the star map

- **Display:** each base is a tab filled with its owner's faction colour, showing its settlement count. Like ship pips, it carries no faction emblem. A base that meets the scenario's victory condition (in Footfall, 10 or more settlements in a system whose worlds total at least 25 population) has a gold outline. Hovering a tab names the faction and its settlements.
- **Placement:** a system's bases are tabs attached to one slanted edge of the tile, each cut to the edge's angle and reaching the seam between tiles, stacked in rows down that edge in faction order. Rows hold two or three tabs only when no edge has room for one per row, so a system's bases never wrap around a corner. Tabs keep clear of the worlds, the star, the exploration marker, an anomaly and the printed text, and ships keep clear of the tabs.

### Anomalies on the star map

- **Display:** an unresolved anomaly is its printed hexagonal tile, with a thin edge so the black tile reads as a piece against the black map. Its red triangle or blue disc shows the difficulty that applies, with the number of players added, drawn over the printed number in the printed style; In a scenario that ignores anomaly rewards, the printed reward along the bottom of the tile is covered in the tile's black; everything else is as printed. The same tile is used in the zoomed system's panel and on the exploration step's anomaly cards. Tiles a player has resolved, in the console, keep their printed difficulty.
- **Placement:** the anomaly takes the tile's lower right corner, where the exploration marker otherwise sits. While a system has an anomaly its exploration marker is drawn at about three quarters of its size and rests on the anomaly's top right corner, clear of the worlds, the printed text and the tile's edge. Base tabs and ships keep clear of the anomaly.

### Inspecting a clump

- **Trigger:** clicking a faction's clump of ships at a system, the player's own or a rival's, in any step or view. Individual pips are not separate targets; the whole clump, including the small gaps between its pips, is one click target, and it does nothing on hover beyond a glow.
- **Emphasis:** a strip opens just above the clump (below it near the top edge) showing every ship in the clump as its full printed counter (square with slightly rounded corners, as printed); a damaged ship has a red border with a soft red glow behind it and a solid red damage badge joined to the border at the top left, where the counter's faction flag is left out so the badge stands alone, and cargo sits at the middle of the left edge, and a caption naming it (and its turns until arrival). The counter carries no arrival badge; the pip on the map shows it. The open clump keeps its glow.
- **Choosing from the strip:** in a step where the player can act with a ship, its counter in the strip is clickable; clicking it chooses that ship and closes the strip. Counters that cannot act are shown but do nothing.
- **Closing:** clicking the same clump again, clicking anywhere else on the board, or pressing Escape. Clicking another clump switches the strip to it.

### Zooming into a system

- **Trigger:** clicking a system's printed name on the star map (cursor shows zoom-in and the name area highlights on hover).
- **Emphasis:** in one motion, the star map's camera moves from the current view until that system's hex fills the part of the map the panel leaves clear, a panel slides in over the map's right edge (from the bottom, as a sheet, on narrow screens), and the other systems dim. The panel first describes the system's anomaly, when it has one: its tile, name, the kind of challenge, the value needed to resolve it and how that is made up, and the restrictions it imposes. It then lists every faction present: its settlements there against the scenario's settlement goal, when it has one, and its ships as the same counters and, under a ship still on its way, only its turns until arrival. The panel leaves out what the tile already shows, such as worlds, habitability and exploration markers. The system's name and Back to map stay fixed at the top of the panel while the factions scroll beneath them. Neighbouring systems remain faintly visible and the map can still be panned and zoomed; clicking a visible neighbour's name moves the camera over to it the same way.
- **In the zoomed view:** clicking a clump highlights that faction in the panel instead of opening a strip; a ship counter in the panel is clickable when that ship can act, choosing it without leaving the view.
- **Leaving:** Back to map or Escape reverses the motion: the panel slides out and the dimming lifts while the camera returns to the view from before zooming in (the whole map if the zoom began on another view). Nothing is swapped in afterwards. Reduced-motion users get the change without animation.

### Choosing a ship

- **Trigger:** the acting player clicks one of their own ships during build, cargo, movement or exploration, either its counter in a clump's strip on the star map or its tile in the action panel. Clicking the selected ship again clears the choice.
- **Emphasis:**
    - The pip on the map gains a gold outline in its own shape, set slightly out from it: a rounded square around a CV, a diamond around an RE.
    - The ship's tile in the action panel gains a gold border.
- **Unaffected:** other ships, system tiles, worlds and bases keep their normal look. Ships that cannot act in the current step are not clickable; the movement step only offers ships that have arrived and have a destination, and the exploration step only offers ships that can explore.

### Resolving an anomaly

- **Where:** the exploration step lists, above the ships that can explore, every anomaly the acting player has ships at that could take part, and every anomaly they have already committed ships to. Each is a card edged in blue for a science challenge or red for a combat challenge, with the printed tile, its name, its system and the value needed, with the number of players added.
- **Choosing ships:** each of the player's ships there that can take part is a bare counter with what it adds beneath (`+6`). Clicking a counter adds it to the attempt (gold border, brighter number) and clicking it again takes it out. Beside the counters the chosen total stands against the value needed (`12 / 9`), orange until it is enough and green after. Choosing a ship at another anomaly starts a new attempt and drops the earlier choices.
- **Committing:** Commit ships is available once the total is enough. It records the attempt and uses those ships' actions for the decade; nothing else changes until the decade ends, when attempts resolve in initiative order. The card then names the committed ships in place of the counters.
- **Explanations:** when the player's ships there cannot reach the value needed, the card says how much more to bring. A card for an anomaly that forbids exploration says ships cannot explore that system until it is resolved. A line names each other player who has committed ships to the same anomaly and whether they resolve before or after the viewer.
- **Unaffected:** the star map and the system panel are unchanged by a draft or a commitment. A ship that could both explore and take part appears in both lists until it does one of them.

### Locating a ship from the action panel

- **Trigger:** during the cargo or exploration step, the acting player clicks a ship's counter in the action panel.
- **Emphasis:** the ship becomes the chosen ship (gold outline around its pip and its counter) and the star map zooms into its system, as when clicking that system's name.
- **Clearing:** clicking the same counter again clears the choice and zooms back out. Back to map and Escape leave the zoom but keep the choice.
- **Exploration step:** each ship that can explore is a bare counter with its odds and an Explore button under it. The odds are the guaranteed markers, when there are any, plus the chance of one more (`1 + 30%`, `80%`); their tooltip spells this out with the exploration value. The malfunction rate is shown once beside the prompt for each kind of ship (RE, CV) that can explore.
- **Exploration results:** the explorations made this turn form a table in its own darker panel under the ships, one ruled row each. A row's first line is the ship's name with its outcome labels at the right, in small tracked capitals: `SURVEY` in green when the markers are enough for one, `FAILED` in grey when there are none, and in red what a malfunction did (`1 DAMAGE`, `CRIPPLED`, `SHIP LOST`). Its second line has four columns aligned across rows: a red ten-sided die showing the roll for an extra marker when one was made; the markers gained; the malfunction roll as two black ten-sided dice, tens then units, always shown; and any markers salvaged from a lost ship. The panel is as wide as its content, or the full width on a phone. With three or more results, they fill columns, reading down each column and then to the next column on the right. Columns are two deep while that many fit the action panel; with less room the columns that fit grow deeper, down to a single list.
- **Movement step:** a counter there only chooses the ship, without zooming, so its destinations on neighbouring systems stay in view. Entering the movement step zooms back out to the whole map, whether the player ended the cargo step or it ended by itself.

### Cargo holds

- **Display:** a ship's hold is a row of slots, one per point of cargo capacity. A carried settlement fills a slot with its faction's settlement token; empty slots are dashed outlines.
- **Layout:** slots sit four to a row, exactly as wide as the counter above them, and wrap in that grid.
- **Where:** under the ship's counter in the cargo step (always, so free space shows), and in the movement step and the zoomed system panel only when the ship is carrying something.
- **Draft:** while a transfer is being drafted, the holds of the chosen ship and of a partner ship show the drafted result, both in the ship list and in the transfer panel.

### Transferring cargo

- **Trigger:** a ship with a hold is chosen during the cargo step. A transfer panel opens beside the ship list (below it on a phone).
- **Destination:** a sliding toggle centred at the top of the panel lists what the ship can exchange cargo with where it is: Earth (buying, at Sol), the player's base in that system or the base unloading would found, and each of the player's other arrived cargo ships there. The first is chosen to begin with. If there is nothing to exchange with, the panel is replaced by a line saying so.
- **Parties:** the ship's counter and hold sit at the left, the destination at the right (Earth's photograph, a settlement token with the base's count, or the partner ship's counter and hold) and a two-headed arrow joins them.
- **Rows:** one row per kind of cargo, under the two parties' names: the kind, the count aboard, a left and a right arrow button, and the count at the destination (or the price each at Earth). The left arrow moves one onto the ship and the right arrow one off it. A count that the draft raises turns green and one it lowers turns orange. An arrow that cannot be used is disabled and its tooltip gives the reason.
- **Commit:** the footer shows `No changes`, `No cost` or `Pay $NB`, and a Commit button that is disabled until something is drafted. Commit records the whole draft as one action; the ship stays chosen with an empty draft. Once none of the player's ships can load, unload or exchange anything, the turn goes on by itself and the choice clears; a player who reaches the cargo step with nothing to do skips it.
- **Discarding:** there is no cancel button. The draft is dropped by choosing another destination, another ship or the same ship again, by Undo, and by ending the step.

### Choosing a destination

- **Trigger:** a ship is chosen during the movement step.
- **Emphasis:** every system the ship can reach gains a cyan hex outline and a label with the travel time. The action panel only lists the ships that can move, as bare counters, and prompts for a destination on the map.
- **Commit:** clicking a highlighted system moves the ship and clears the choice. Once none of the player's ships can move, the turn goes on by itself; a player who reaches the movement step with nothing to move skips it. The exploration step is skipped too when none of the player's ships can explore, but it never ends by itself once reached, so the results stay on screen until the player ends it.
- **Unaffected:** unreachable systems keep their normal look and are not clickable.

### Choosing a tech

- **Trigger:** during the develop-techs step, the acting player clicks a tech marked as available in the tech tree.
- **Before a choice:** the action panel shows what the player can spend, in a darker panel of labelled columns: the total of their markers in each field, on that field's blank chit, then their cash. Under it, next to the chart, is the only prompt: `Choose a tech on the chart below`. The prompt comes after the totals so that it is not read as an instruction to pick one of the chits.
- **Emphasis:**
    - Available techs show a cyan frame and their current cost.
    - The chosen tech shows a thick gold frame.
    - The action panel shows that tech's payment in a darker panel with two labelled groups of bare chits, each from the highest value down: `PAY WITH`, holding the suggested markers followed by the cash top-up in gold (red when the player cannot afford it), and `KEEP`, slightly faded, holding the rest. Clicking a chit moves it to the other group; that changes only the payment, not the chart. The button reads `Develop with 5+4+1 and $2B`, naming the chits in the same order.
- **Commit:** developing the tech commits the action and clears the choice; Cancel clears it without committing.

### Star map or tech chart

- **Default:** the main area shows the star map, and switches to the tech chart while the acting player is in the develop-techs step.
- **Override:** the Star map / Tech chart buttons override the default for the rest of the current step only.
- **Panning the star map:** once zoomed in at all, the star map can be dragged past its edges until an edge reaches the middle of the view, as on 18xx maps (wide layouts always; narrow layouts only when expanded). The map's background fades into the page colour at its edges, so no border shows. The tech chart does not overpan.
- **Category focus:** the All / Biology / Physics / Engineering buttons show every category or just one, for the rest of the session. A focused category uses taller cards with larger text, and each card lists its prerequisites from other categories, because their connectors are not drawn. Focus never changes which techs are available or chosen.

## Coexistence and precedence

- **One choice at a time.** Ship and tech choices share one selection. Ships are only selectable in the first four steps and techs only in the develop-techs step, so they never coexist.
- **Cargo draft depends on the ship.** A draft exists only for the chosen ship and its chosen destination, so it never outlives either.
- **Destinations depend on the ship.** Destination highlights exist only while a ship is chosen in the movement step, and the board draws them above that system's ships.
- **Other players' actions.** Another player's action arriving during simultaneous play does not clear the current player's choice. It stays as long as it remains valid.
- **Strip and selection.** Choosing a ship from a strip closes the strip; the chosen ship then shows its gold outline on the map and in the strip when reopened. The strip is drawn above every tile, including destination outlines.
- **Zoom and strip.** No strip is shown while zoomed; the panel lists the ships instead, and the inspected clump only highlights its faction there.
- **Zoom and tech chart.** Switching to the tech chart keeps the zoom; returning to the star map moves the camera to the zoomed system again. The tech chart has its own camera and is never zoomed by it.
- **Strip and destinations.** While a ship is chosen in the movement step, a reachable system's outline covers its clumps, so a click there moves the ship rather than opening a strip.

## Player area

- **Standings:** one aligned row per player in initiative order: initiative, faction emblem, name (`You` for the viewer) with their current step beneath (`Done` in green once they have finished), then right-aligned columns: `RE` and `CV` in play, `SET` (settlements at bases) and `$B` (cash, in gold). In a scenario won by resolving anomalies, an `ANOM` column before the cash gives the anomalies resolved against the number needed (`2/4`), with the science and combat split in its tooltip.
- **Console:** under the standings, one panel about a single player: a header in their faction's colour with faction, player, initiative and step; cash and the marker total in each field; in a scenario won by resolving anomalies, the tiles they have resolved with the science and combat counts and the goal; their bases as map tabs with the system and its population (green once it reaches the population a winning system needs); their ships as map pips grouped by the system they are at or travelling to, with the turns left after a ship still on its way; and techs developed out of the chart in each field, marked `new` for a field developed this turn.
- **Trigger:** clicking a standings row shows that player in the console and tints the row in their faction's colour. The viewer's own row is shown to begin with.
- **Unaffected:** the choice changes nothing on the star map or in the action panel.

## Shared visual state

### Selection

- **Meaning:** the acting player's manual choice of a ship or a tech.
- **Owner and readers:** owned by the game session. It is read by the star map (selection outline, destination outlines), the tech chart (gold frame) and the action panel (tile border, payment).
- **Lifetime:** cleared by clicking the chosen item again, by Cancel, by Undo (which clears a manual choice before undoing any action), by ending the step, and by committing any action that consumes the choice.
- **Validity:** derived from the current state. A ship choice applies only while the player can act, is in a ship step, and still owns the ship. A tech choice applies only during the develop-techs step while the tech is still available.
- **History and replay:** the player cannot act in History View, so no choice is shown there, and returning to Live View shows a still-valid choice again. Replay and silent restoration do not change the choice.

### Anomaly draft

- **Meaning:** the system whose anomaly the acting player is assembling an attempt against, and the ships chosen for it so far. Nothing in the game state changes until Commit ships.
- **Owner and readers:** owned by the game session as one kind of selection, so it replaces a chosen ship or tech and is replaced by one. It is read by the exploration step's anomaly cards.
- **Lifetime:** cleared by taking out its last ship, by choosing a ship at another anomaly, by Undo (before any action is undone), by ending the step and by Commit ships.
- **Validity:** derived from the current state. It applies only during the acting player's exploration step, and only the chosen ships that can still take part count.
- **History and replay:** the player cannot act in History View, so no draft is shown there.

### Cargo draft

- **Meaning:** the destination chosen for the chosen ship in the cargo step, and how many settlements are drafted onto the ship (negative: off it). Nothing in the game state changes until Commit.
- **Owner and readers:** owned by the game session. It is read by the cargo step (ship list holds) and the transfer panel (toggle, counts, holds, footer).
- **Lifetime:** cleared whenever the selection changes or clears, replaced by choosing a destination, and reset to nothing drafted by Commit.
- **Validity:** derived from the current state. A destination that is no longer available falls back to the first available one, and a drafted amount outside the current limits counts as nothing drafted.
- **History and replay:** the player cannot act in History View, so no draft is shown there.

### Console player

- **Meaning:** the player whose console the player area shows.
- **Owner and readers:** owned by the game session; set by a standings row, read by the standings (row tint) and the console.
- **Lifetime:** kept until another row is clicked.
- **Validity:** derived from the current state; without a choice, or if the chosen player is no longer in the game, it is the viewer, or the first player in initiative order for a spectator.
- **History and replay:** kept while navigating history; the standings and console describe the displayed state.

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
- **Effects:** drives the destination outlines on the star map.
- **Validity:** it disappears as soon as the selection is no longer valid or the ship has moved.

## Render ownership

- **Anomaly and marker spots:** the board decides per system whether the tile's frame carries an anomaly spot and a moved marker, and hands that frame to the layouts and the system tile, which draws both.
- **Base tabs and pip layout:** computed once per system by the board, the base tabs first so the pip layout can keep ships clear of them. Both are drawn by the system tile; the ship strip anchors to the clumps.
- **Selection outline:** drawn by the ship pip.
- **Pip badges:** the cargo dot and the arrival badge are drawn by the system tile in a layer above all of its clumps, so no ship covers another ship's badge. The layer ignores the pointer, so a click on a badge reaches the clump beneath it.
- **Transfer panel:** drawn by the cargo step from a view computed once from the state, the chosen ship, the destination and the draft; the same view feeds the holds in the ship list.
- **Ship strip:** drawn by the board above every system tile.
- **Zoom:** the star map's scaling wrapper owns the camera; the table asks it to focus the system's hex with the panel's size kept clear, and to restore the captured earlier view on the way out. The panel slide, the camera move and the dimming share one duration and easing. The table reports the zoom-out's completion to the session after that duration.
- **Destination outline and travel-time label:** drawn by the system tile, above its ships, so a click anywhere on a reachable system commits the move.
- **Tech status, cost and owners:** derived once per tech and drawn by the tech tree, with cards above their prerequisite connectors.

## Verification scenarios

| Scenario               | Start                                                     | Input                                                                | Expected                                                                                                                                                    | Verification                                       |
| ---------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Choose and move a ship | Movement step, an arrived probe at Sol                    | Click the probe's panel tile                                         | Gold outline on the pip; reachable systems outlined with travel times; the panel asks for a destination                                                     | Automated (`tests/turnFlow.spec.ts`)               |
| Commit by map          | As above                                                  | Click Alpha Centauri on the map                                      | The probe becomes an outlined pip with a turns badge; outlines and gold clear                                                                               | Automated                                          |
| Undo a choice          | A ship is chosen, with no committed action after it       | Click Undo                                                           | The choice clears and no action is undone                                                                                                                   | Automated                                          |
| Choose a tech          | Develop-techs step                                        | Click an available tech                                              | Gold frame; payment shown with suggested markers; developing it records the tech                                                                            | Automated                                          |
| History view           | A ship is chosen                                          | Step back in history                                                 | No gold or outlines; returning to Live View restores them                                                                                                   | Automated                                          |
| Simultaneous play      | A ship is chosen; another player acts                     | The other player's action arrives                                    | The choice stays                                                                                                                                            | Automated                                          |
| Anomaly on a tile      | A system with an anomaly, an exploration marker and ships | View the map, then zoom into the system                              | The anomaly fills the lower right corner; the smaller marker rests on its top right corner; worlds, text, tabs and ships stay clear; the panel describes it | Manual (screenshot script `voyages-anomalies.mjs`) |
| Resolve an anomaly     | Exploration step, two armed ships at a combat anomaly     | Click both counters, then Commit ships                               | Each counter gains a gold border; the total turns green once enough; the card then names the committed ships; history records the attempt                   | Manual (screenshot script `voyages-resolve.mjs`)   |
| Inspect a clump        | Two ships of one faction at Sol                           | Hover, then click the clump; click again, Escape, or click the board | Hover shows nothing; click opens a strip of both counters; each close action closes it                                                                      | Automated                                          |
| Choose from a strip    | Movement step, an arrived probe at Sol                    | Open its clump, click its counter                                    | The probe is chosen and the strip closes; destinations appear                                                                                               | Automated                                          |
| Crowded systems        | Six factions with many ships at one system                | Lay out the system                                                   | Every ship is placed, clear of worlds and printed text, one clump per faction where possible                                                                | Automated (`shipPipLayout.spec.ts`)                |
| Many bases             | Six bases at one system, with ships                       | Lay out the system                                                   | One column of tabs on one edge, clear of worlds and printed text; no ship over a tab                                                                        | Automated (`baseTabLayout.spec.ts`)                |
| Zoom into a system     | A probe at Sol                                            | Click Sol's name; then Back; then click it and press Escape          | The view zooms to Sol with a panel listing the probe; each exit returns to the map                                                                          | Automated                                          |
| Choose from the panel  | Movement step, zoomed into Sol                            | Click the probe in the panel                                         | The probe is chosen; the zoom stays                                                                                                                         | Automated                                          |
| Summary data           | Systems with and without ships and bases                  | Summarise the system                                                 | Each faction present with its settlements and ships, the viewer's first                                                                                     | Automated (`systemSummary.spec.ts`)                |
| Draft and commit cargo | Cargo step, a cargo ship at Sol                           | Choose the ship, press the left arrow twice, then Commit             | Counts and hold show 2 and `Pay $10B` with no action recorded; Commit records one transfer                                                                  | Automated                                          |
| Undo a cargo draft     | A settlement is drafted                                   | Click Undo                                                           | The draft and the choice clear and no action is undone                                                                                                      | Automated                                          |
| Change destination     | A settlement is drafted at Earth; another ship here       | Choose the other ship in the toggle                                  | The draft is dropped and both ships' counts are unchanged                                                                                                   | Automated                                          |
