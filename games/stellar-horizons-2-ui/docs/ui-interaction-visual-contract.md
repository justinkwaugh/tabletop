# Stellar Horizons II UI interaction visual contract

## Visual intents

### Ships on the star map

- **Display:** each ship is a pip in its faction's colour: a rounded square with the CV's size above three fixed slots that mark whether it has exploration (blue circle), cargo (orange hexagon) and combat (red triangle) values, with an empty slot where it has none, or a smaller diamond for an RE, showing its exploration value in a blue circle. A ship still on its way is drawn as a faction-coloured outline on a dark fill, with a gold badge giving the turns until it arrives. A red border just outside the pip marks damage (thicker when crippled). A white dot on the pip's top left corner marks cargo, the same size and the same distance in from the corner as the arrival badge on the top right.
- **Placement:** each faction's ships at a system form one honeycomb clump. Clumps are threaded clockwise along the orbit among the worlds, in faction order, and never cover a world, a base tab, the exploration marker, an anomaly or the tile's printed text. Pips are as large as the system allows and shrink only when needed to fit; in extreme crowds a faction's clump splits into adjacent smaller clumps rather than hiding a ship.

### Bases on the star map

- **Display:** each base is a tab filled with its owner's faction colour, showing its settlement count. Like ship pips, it carries no faction emblem. A base that meets the scenario's victory condition (in Footfall, 10 or more settlements in a system whose worlds total at least 25 population) has a gold outline. Hovering a tab names the faction and its settlements.
- **Placement:** a system's bases are tabs attached to one slanted edge of the tile, each cut to the edge's angle and reaching the seam between tiles, stacked in rows down that edge in faction order. Rows hold two or three tabs only when no edge has room for one per row, so a system's bases never wrap around a corner. Tabs keep clear of the worlds, the star, the exploration marker, an anomaly and the printed text, and ships keep clear of the tabs.

### Anomalies on the star map

- **Display:** an unresolved anomaly is its printed hexagonal tile, with a thin edge so the black tile reads as a piece against the black map. Its red triangle or blue disc shows the difficulty that applies, with the number of players added, drawn over the printed number in the printed style; In a scenario that ignores anomaly rewards, the printed reward along the bottom of the tile is covered in the tile's black; everything else is as printed. The same tile is used in the zoomed system's panel and on the exploration phase's anomaly cards. Tiles a player has resolved, in the console, keep their printed difficulty.
- **Turned over:** in the campaign a resolved anomaly whose back affects bases stays in its place showing that back, with no difficulty, and the system panel describes its effect. Backs that leave the game are not drawn.
- **Events:** an event with a challenge, placed in a system, is its printed tile, as printed, drawn just left of the anomaly position (or of the exploration marker when there is no anomaly). Several events in one system line up leftwards. The exploration step's event cards give the difficulty that applies.
- **Placement:** the anomaly takes the tile's lower right corner, where the exploration marker otherwise sits. While a system has an anomaly its exploration marker is drawn at about three quarters of its size and rests on the anomaly's top right corner, clear of the worlds, the printed text and the tile's edge. Base tabs and ships keep clear of the anomaly.

### The star map's shape

- **Layout:** the systems keep the printed map's arrangement, or that arrangement turned a sixth of a circle; tiles stay upright and every distance holds either way. The map takes whichever is drawn larger when fitted whole into the map area (the window, when the map is full screen), the printed arrangement on a tie, and re-lays itself when the area changes shape. The campaign and _These are the Voyages_ are never drawn larger turned, so they keep the printed arrangement; _Footfall_ is a tall strip as printed and turns to lie across a wide, short map area.

### Inspecting a clump

- **Trigger:** clicking a faction's clump of ships at a system, the player's own or a rival's, in any phase or view. Individual pips are not separate targets; the whole clump, including the small gaps between its pips, is one click target, and it does nothing on hover beyond a glow.
- **Emphasis:** a strip opens just above the clump (below it near the top edge) showing every ship in the clump as its full printed counter (square with slightly rounded corners, as printed); a damaged ship has a red border with a soft red glow behind it and a solid red damage badge joined to the border at the top left, where the counter's faction flag is left out so the badge stands alone, and cargo sits at the middle of the left edge, and a caption naming it (and its turns until arrival). The counter carries no arrival badge; the pip on the map shows it. The open clump keeps its glow.
- **Choosing from the strip:** in a phase where the player can act with a ship, its counter in the strip is clickable; clicking it chooses that ship and closes the strip. Counters that cannot act are shown but do nothing.
- **Closing:** clicking the same clump again, clicking anywhere else on the board, or pressing Escape. Clicking another clump switches the strip to it.

### Zooming into a system

- **Trigger:** clicking a system's printed name on the star map (cursor shows zoom-in and the name area highlights on hover).
- **Emphasis:** in one motion, the star map's camera moves from the current view until that system's hex fills the part of the map the panel leaves clear, a panel slides in over the map's right edge (from the bottom, as a sheet, on narrow screens), and the other systems dim. The panel first describes the system's anomaly, when it has one: its tile, name, the kind of challenge, the value needed to resolve it and how that is made up, and the restrictions it imposes. In the campaign it then shows a turned-over anomaly's back, saying it acts on the bases there; each unresolved event, with the value needed for each challenge it allows and its IP; and every standing pact on a target there, as the pact list shows it, `Offered` or `Agreed`, to every viewer. It then lists every faction present: its settlements there against the scenario's settlement goal, when it has one, and its ships as the same counters and, under a ship still on its way, only its turns until arrival. The panel leaves out what the tile already shows, such as worlds, habitability and exploration markers. The system's name and Back to map stay fixed at the top of the panel while the factions scroll beneath them. Neighbouring systems remain faintly visible and the map can still be panned and zoomed; clicking a visible neighbour's name moves the camera over to it the same way.
- **In the zoomed view:** clicking a clump highlights that faction in the panel instead of opening a strip; a ship counter in the panel is clickable when that ship can act, choosing it without leaving the view.
- **Leaving:** Back to map or Escape reverses the motion: the panel slides out and the dimming lifts while the camera returns to the view from before zooming in (the whole map if the zoom began on another view). Nothing is swapped in afterwards. Reduced-motion users get the change without animation.

### Choosing a ship

- **Trigger:** the acting player clicks one of their own ships during build, cargo, movement or exploration, either its counter in a clump's strip on the star map or its tile in the action panel. Clicking the selected ship again clears the choice.
- **Emphasis:**
    - The pip on the map gains a gold outline in its own shape, set slightly out from it: a rounded square around a CV, a diamond around an RE.
    - The ship's tile in the action panel gains a gold border.
- **Unaffected:** other ships, system tiles, worlds and bases keep their normal look. Ships that cannot act in the current phase are not clickable; the movement phase only offers ships that have arrived and have a destination, and the exploration phase only offers ships that can explore.

### Resolving an anomaly

- **Where:** the exploration phase lists, above the ships that can explore, every anomaly the acting player has ships at that could take part, and every anomaly they have already committed ships to. Each is a card edged in blue for a science challenge or red for a combat challenge, with the printed tile, its name, its system and the value needed, with the number of players added.
- **Choosing ships:** each of the player's ships there that can take part is a bare counter with what it adds beneath (`+6`). Clicking a counter adds it to the attempt (gold border, brighter number) and clicking it again takes it out. An event that allows either challenge offers With science and With combat; choosing one starts its draft afresh. Beside the counters the chosen total stands against the value needed (`12 / 9`), orange until it is enough and green after. Choosing a ship at another anomaly starts a new attempt and drops the earlier choices.
- **Committing:** Commit ships is available once the total is enough. It records the attempt and uses those ships' actions for the decade; nothing else changes until the decade ends, when attempts resolve in initiative order. The card then names the committed ships in place of the counters.
- **Explanations:** when the player's ships there cannot reach the value needed, the card says how much more to bring. A card for an anomaly that forbids exploration says ships cannot explore that system until it is resolved. A line names each other player who has committed ships to the same anomaly and whether they resolve before or after the viewer.
- **Unaffected:** the star map and the system panel are unchanged by a draft or a commitment. A ship that could both explore and take part appears in both lists until it does one of them.
- **Events:** events with a challenge in a system where the player has ships, or that they have committed ships to, get the same cards below the anomalies, edged by their challenge; AI Sentient Emergence may be met with either kind.

### Pacts

- **Proposing:** an anomaly or event card offers Propose a pact when another Player still exploring had ships there that could take part when the phase began. It is a toggle: it opens the pact editor under the card and, pressed again, closes it. The editor shows partner chips for those Players (the proposer's own chip fixed on), a row of each partner's ships there as toggles with what they add (the other partners' ships as everyone saw them when the phase began, the proposer's own only while still free), the reward split item by item with − and +, starting as even as it divides, and, in These are the Voyages, who keeps the tile. The pledged total stands against the value needed, orange then green. Propose pact stays disabled while the terms are not valid, with the reason beside it in amber. There is no Cancel: Undo discards the draft and records nothing.
- **The list:** pacts naming the viewer sit at the top of the exploration step, and in the waiting panel of a hotseat Player who is not acting. Each names its target and system, then a line per partner with their pledged ships, their share and `accepted` once they have. An offer is edged in violet with its status (`Proposed to you`, `Waiting for the other partners`); an agreed pact is edged in green and says it resolves once everyone has finished exploring. An offer shows Accept (disabled when the viewer's pledged ships are no longer free), Counter, which opens the editor with the offer's terms, and Withdraw or Decline. The buttons appear only when the viewer can take the action now, never in History View.
- **Unaffected:** proposing changes nothing on the map. An agreed pact's ships leave the lists of ships that can explore or take part elsewhere.

### Mining, research and terraforming

- **Where:** in the campaign, the exploration step lists under Mine, research or terraform each of the player's mining or research ships that can act, with its system and one button per world and action: `Mine M (40% for $2B)`, `Research M (50% for biology)`, `Terraform M`. A tooltip gives the roll needed.
- **Results:** below the heading, a line per mining or research action this turn gives the ship, the system, the roll against the target and what it earned; a queued terraform says it happens once everyone has finished exploring. While there are results a note says a Player mines or researches each system once a turn, which explains the ships whose system no longer offers it.

### Choices after exploration

- **Choosing on the map:** these choices are made where the systems are. The eligible systems gain the destination outline with a label saying what a click does (`Place the event`, `+2 settlements`, `Add a settlement`); the action panel explains the choice and lists none of them.
- **Reward settlements:** after an anomaly's attempts resolve, a Player owed settlements is offered their bases and, if allowed, a new base in the anomaly's system; never a system where a "no bases" anomaly lies. Each click adds one settlement there, the panel lists what has been placed (`Barnard's Star: +1`), and Undo takes back the last. The button counts down what is left to place and becomes Place settlements at none; the outlines go once all are placed.
- **Events:** the Player who places an event sees its tile and why it falls to them, and clicks one of their highlighted systems. Homesteaders' Players choose one of their bases the same way.
- **Base production:** a base in a system with a turned-over anomaly that changes production names it and its effect beside the settlements (`Mineral Veins: +$3B when producing cash`); the offered yields already include it.

### Locating a ship from the action panel

- **Trigger:** during the cargo or exploration phase, the acting player clicks a ship's counter in the action panel.
- **Emphasis:** the ship becomes the chosen ship (gold outline around its pip and its counter) and the star map zooms into its system, as when clicking that system's name.
- **Clearing:** clicking the same counter again clears the choice and zooms back out. Back to map and Escape leave the zoom but keep the choice.
- **Exploration phase:** each ship that can explore is a bare counter with its odds and an Explore button under it. The odds are the guaranteed markers, when there are any, plus the chance of one more (`1 + 30%`, `80%`); their tooltip spells this out with the exploration value. The malfunction rate is shown once beside the prompt for each kind of ship (RE, CV) that can explore.
- **Exploration results:** the explorations made this turn form a table in its own darker panel under the ships, one ruled row each. A row's first line is the ship's name with its outcome labels at the right, in small tracked capitals: `SURVEY` in green when the markers are enough for one, `FAILED` in grey when there are none, and in red what a malfunction did (`1 DAMAGE`, `CRIPPLED`, `SHIP LOST`). Its second line has four columns aligned across rows: a red ten-sided die showing the roll for an extra marker when one was made; the markers gained; the malfunction roll as two black ten-sided dice, tens then units, always shown; and any markers salvaged from a lost ship. The panel is as wide as its content, or the full width on a phone. With three or more results, they fill columns, reading down each column and then to the next column on the right. Columns are two deep while that many fit the action panel; with less room the columns that fit grow deeper, down to a single list.
- **Movement phase:** a counter there only chooses the ship, without zooming, so its destinations on neighbouring systems stay in view. Entering the movement phase zooms back out to the whole map, whether the player ended the cargo phase or it ended by itself.

### Cargo holds

- **Display:** a ship's hold is a row of slots, one per point of cargo capacity. A carried settlement fills a slot with its faction's settlement token, then each good with its chit; empty slots are dashed outlines.
- **Layout:** slots sit four to a row, exactly as wide as the counter above them, and wrap in that grid.
- **Where:** under the ship's counter in the cargo phase (always, so free space shows), and in the movement phase and the zoomed system panel only when the ship is carrying something.
- **Draft:** while a transfer is being drafted, the holds of the chosen ship and of a partner ship show the drafted result, both in the ship list and in the transfer panel.

### Transferring cargo

- **Trigger:** a ship with a hold is chosen during the cargo phase. A transfer panel opens beside the ship list (below it on a phone).
- **Destination:** a sliding toggle centred at the top of the panel lists what the ship can exchange cargo with where it is: Earth (buying settlements, and in the campaign storing goods, at Sol), the player's base in that system or the base unloading would found, and each of the player's other arrived cargo ships there. The first is chosen to begin with. If there is nothing to exchange with, the panel is replaced by a line saying so.
- **Parties:** the ship's counter and hold sit at the left, the destination at the right (Earth's photograph, a settlement token with the base's count, or the partner ship's counter and hold) and a two-headed arrow joins them.
- **Rows:** one row per kind of cargo, settlements first and then each kind of good either side holds, under the two parties' names: the kind, the count aboard, a left and a right arrow button, and the count at the destination (or the price each at Earth). The left arrow moves one onto the ship and the right arrow one off it. A count that the draft raises turns green and one it lowers turns orange. An arrow that cannot be used is disabled and its tooltip gives the reason.
- **Commit:** the footer shows `No changes`, `No cost` or `Pay $NB`, and a Commit button that is disabled until something is drafted. Commit records one action for settlements and one per kind of good, everything coming off the ship first; the ship stays chosen with an empty draft. Once none of the player's ships can load, unload or exchange anything, the phase ends by itself and the choice clears; a player who reaches the cargo phase with nothing to do skips it.
- **Discarding:** there is no cancel button. The draft is dropped by choosing another destination, another ship or the same ship again, by Undo, and by ending the phase.

### Selling goods

- **Where:** on the map. In the campaign's cargo and trade step, every system where the player has a good (on arrived ships, at a base, or on Earth at Sol) that its demand matches gains a cyan outline, its label just under the system's demand marker so the marker stays in view: `Sell $6B`, or `Sell N goods` when several sell there; the cargo step says that there are goods to sell on the map. Clicking one zooms into the system and sets up a sale of its first good. The zoomed system panel's demand section lists each good to sell there as a button with its price each and, off Earth, +1 IP; the zoomed system loses its outline. Any system zoomed into in this step shows the same buttons.
- **Staging:** choosing a sale opens its terms beside it: a count, from 1 to all of them (all to begin with); whom to pay when the player has no base there and others do (named when only one is owed, a choice when several are); and a primary `Sell N for $XB`. Choosing it again closes the terms. Goods leave ships first, then the base or Earth.
- **After a sale:** the system's new demand marker is chosen in its own step (below), then the cargo step returns.
- **Discarding:** `Back to map` drops the sale; so do Undo and choosing it again.

### Choosing a demand marker

- **Trigger:** a system's first base, its last survey, or a sale there draws demand markers for the player who did it.
- **Display:** the action panel names the system and shows each drawn marker as a button with its art and good; choosing one keeps it and returns the others.

### Demand markers on the star map

- **Display:** a system's demand marker sits wholly inside its tile, at the place nearest the upper left that is clear of the tile's world slots and printed text, so it moves a little from tile to tile; base tabs and ships keep clear of it; Sol shows its own three-good marker. The zoomed system panel describes it: what sells there and for how much.

### Assigning drawn goods

- **Trigger:** the trade goods tile, each player in their own Branch.
- **Display:** the panel lists the drawn goods in order with where each has gone; the next one is outlined with its world types. A room line gives Earth's storage and what each base can still take this turn and store, counting the draft.
- **Choosing:** the map highlights the bases that can take the next good ("Food here") and Sol when it can go to Earth ("Food to Earth"); clicking one assigns it. `Discard Food for $1B` sets it aside instead. When nothing can take it, the panel says so. Undo takes back the last choice.
- **Commit:** `Assign goods`, or `Assign goods, $NB for the rest`, enabled once every good has a place.

### Placing reward goods

- **Trigger:** an anomaly's goods, after it resolves.
- **Where:** on the map. The map zooms into the anomaly's system as the step begins. In the zoomed system panel, each of the player's ships there that can take another good is choosable, and the player's base, while it can take one, shows `Put Fauna here` beside its settlements; each click places one good, which appears in that hold or among the base's goods. Undo takes back one.
- **Leaving:** `Back to map` from the anomaly's system zooms out and does not zoom in again for the same reward; leaving another system the player zoomed into returns to it. The anomaly's system keeps an outline that zooms back in, labelled with the goods still to place (`1 Fauna to place`), or `Goods placed` once all are.
- **Display:** the action panel names the anomaly and the goods and says where to put them.
- **Commit:** `Place Fauna` once all are placed, otherwise `Place N, destroy M for $MB`; the map zooms out.

### Goods in the player area

- **Display:** in the campaign the console lists Goods N of 12 by place: Earth, then bases, then ships, each with its chits.
- **Destroying:** for the viewer, while they are acting, each chit carries a `1 → $1B` button that destroys one for $1B.

### Choosing a destination

- **Trigger:** a ship is chosen during the movement phase.
- **Emphasis:** every system the ship can reach gains a cyan hex outline and a label with the travel time. The same outline marks the systems offered by the choices after exploration (above), each with its own label. The action panel only lists the ships that can move, as bare counters, and prompts for a destination on the map.
- **Commit:** clicking a highlighted system moves the ship and clears the choice. Once none of the player's ships can move, the phase ends by itself; a player who reaches the movement phase with nothing to move skips it. The exploration phase is skipped too when none of the player's ships can explore, but it never ends by itself once reached, so the results stay on screen until the player ends it. The build and develop-techs phases end by themselves the same way once nothing more can be built, repaired, cloned or afforded.
- **Unaffected:** unreachable systems keep their normal look and are not clickable.

### Choosing a tech

- **Trigger:** during the develop-techs phase, the acting player clicks a tech marked as available in the tech tree.
- **Before a choice:** the action panel shows what the player can spend, in a darker panel of labelled columns: the total of their markers in each field, on that field's blank chit, then their cash. Under it, next to the chart, is the only prompt: `Choose a tech on the chart below`. The prompt comes after the totals so that it is not read as an instruction to pick one of the chits.
- **Emphasis:**
    - Available techs show a cyan frame and their current cost.
    - The chosen tech shows a thick gold frame.
    - The action panel shows that tech's payment in a darker panel with two labelled groups of bare chits, each from the highest value down: `PAY WITH`, holding the suggested markers followed by the cash top-up in gold (red when the player cannot afford it), and `KEEP`, slightly faded, holding the rest. Clicking a chit moves it to the other group; that changes only the payment, not the chart. The button reads `Develop with 5+4+1 and $2B`, naming the chits in the same order.
- **Commit:** developing the tech commits the action and clears the choice; Cancel clears it without committing.

### Star map or tech chart

- **Default:** the main area shows the star map, and switches to the tech chart while the acting player is in the develop-techs phase.
- **Override:** the Star map / Tech chart buttons override the default for the rest of the current phase only.
- **Panning the star map:** once zoomed in at all, the star map can be dragged past its edges until an edge reaches the middle of the view, as on 18xx maps (wide layouts always; narrow layouts only when expanded). The map's background fades into the page colour at its edges, so no border shows. The tech chart does not overpan.
- **Category focus:** the All / Biology / Physics / Engineering buttons show every category or just one, for the rest of the session. A focused category uses taller cards with larger text, and each card lists its prerequisites from other categories, because their connectors are not drawn. Focus never changes which techs are available or chosen.

## Coexistence and precedence

- **One choice at a time.** Ship and tech choices share one selection. Ships are only selectable in the first four phases and techs only in the develop-techs phase, so they never coexist.
- **Cargo draft depends on the ship.** A draft exists only for the chosen ship and its chosen destination, so it never outlives either.
- **Destinations depend on the ship.** Destination highlights exist only while a ship is chosen in the movement phase, and the board draws them above that system's ships.
- **Other players' actions.** Each phase of the decade is played in private branches that merge onto the main line, so another player's actions arrive while the current player's own branch is open. They do not clear the current player's choice; it stays as long as it remains valid.
- **Order of play.** While a phase is in progress, a second track of arrow segments sits under the phase track: the players in the order their play lands on the main line, each segment outlined in the player's faction colour with their name in tracked capitals (`You` for the viewer), a tick once they have finished, the outline dimmed until they start or once done and the name bold while playing. In a local game only the player whose branch is being played is playing; in a hosted game everyone plays at once. In a phase merged as a barrier (exploration, develop techs, and the campaign's initiative declaration and base production) nobody's play lands before anyone else's, so the segments are plain blocks rather than arrows. When the panel is narrow the segments drop their names and show only the colour and the tick, as the phases drop to numbers.
- **Campaign economic phase.** In the campaign from the second turn, the phase track begins with a segment naming the turn's economic tile (`E` when narrow). It is current while the initiative declaration or the base production choices are being made, and past for the rest of the turn. Those choices end by themselves, so no Done button is shown during them. A tile whose rules are not in the game yet (trade goods) adds a line under the tracks saying it does nothing. In the first turn, which has only exploration and develop techs, the track shows those two phases alone.
- **Strip and selection.** Choosing a ship from a strip closes the strip; the chosen ship then shows its gold outline on the map and in the strip when reopened. The strip is drawn above every tile, including destination outlines.
- **Zoom and strip.** No strip is shown while zoomed; the panel lists the ships instead, and the inspected clump only highlights its faction there.
- **Zoom and tech chart.** Switching to the tech chart keeps the zoom; returning to the star map moves the camera to the zoomed system again. The tech chart has its own camera and is never zoomed by it.
- **Strip and destinations.** While a ship is chosen in the movement phase, a reachable system's outline covers its clumps, so a click there moves the ship rather than opening a strip.

## Player area

- **Standings:** one aligned row per player in initiative order: initiative, faction emblem, name (`You` for the viewer) with their current phase beneath (`Done` in green once they have finished), then right-aligned columns: `RE` and `CV` in play, `SET` (settlements at bases) and `$B` (cash, in gold). In a scenario won by resolving anomalies, an `ANOM` column before the cash gives the anomalies resolved against the number needed (`2/4`), with the science and combat split in its tooltip. In the campaign, `IP` (in violet) and `VP`, the victory points if the campaign ended now, follow the cash.
- **Console:** under the standings, one panel about a single player: a header in their faction's colour with faction, player, initiative and phase; cash and the marker total in each field; in the campaign, their IP, with a `1 IP → $1B` button on the viewer's own console while they can spend it, a line with their ships and bases against the century's limits and their settlement price, and their score so far with its rank and the categories that are not zero, the categories shown by clicking anywhere on the Score row, which keeps the total, the rank and a chevron in view (folded to begin with, kept while the console is shown); in a scenario won by resolving anomalies, the tiles they have resolved with the science and combat counts and the goal; their bases as map tabs with the system and its population (green once it reaches the population a winning system needs); their ships as map pips grouped by the system they are at or travelling to, with the turns left after a ship still on its way; and techs developed out of the chart in each field, marked `new` for a field developed this turn.
- **Trigger:** clicking a standings row shows that player in the console and tints the row in their faction's colour. The viewer's own row is shown to begin with.
- **Unaffected:** the choice changes nothing on the star map or in the action panel.

## Shared visual state

### Selection

- **Meaning:** the acting player's manual choice of a ship or a tech.
- **Owner and readers:** owned by the game session. It is read by the star map (selection outline, destination outlines), the tech chart (gold frame) and the action panel (tile border, payment).
- **Lifetime:** cleared by clicking the chosen item again, by Cancel in the tech payment, by Undo (which clears a manual choice before undoing any action; a reward placement loses only its last settlement), by ending the phase, and by committing any action that consumes the choice.
- **Validity:** derived from the current state. A ship choice applies only while the player can act, is in a ship phase, and still owns the ship. A tech choice applies only during the develop-techs phase while the tech is still available.
- **History and replay:** the player cannot act in History View, so no choice is shown there, and returning to Live View shows a still-valid choice again. Replay and silent restoration do not change the choice.

### Anomaly draft

- **Meaning:** the system whose anomaly the acting player is assembling an attempt against, and the ships chosen for it so far. Nothing in the game state changes until Commit ships.
- **Owner and readers:** owned by the game session as one kind of selection, so it replaces a chosen ship or tech and is replaced by one. It is read by the exploration phase's anomaly cards.
- **Lifetime:** cleared by taking out its last ship, by choosing a ship at another anomaly, by Undo (before any action is undone), by ending the phase and by Commit ships.
- **Validity:** derived from the current state. It applies only during the acting player's exploration phase, and only the chosen ships that can still take part count.
- **History and replay:** the player cannot act in History View, so no draft is shown there.

### Event draft

- **Meaning:** the event the acting player is assembling an attempt against, the challenge chosen, and the ships chosen so far. One kind of selection, owned by the game session and read by the event cards.
- **Lifetime and validity:** as the anomaly draft; choosing the other challenge starts it afresh.

### Pact draft

- **Meaning:** the terms being drafted for a new pact or a counter: the target, partners, pledged ships, shares and, in These are the Voyages, the keeper. One kind of selection, owned by the game session; it is read by the pact editor under the card or offer it belongs to. Nothing in the game state changes until Propose pact or Counter.
- **Lifetime:** cleared by pressing Propose a pact or Counter again, by Undo, by proposing, and by any other selection.
- **Validity:** it applies only while the viewer may propose (their own Branch, or a hotseat Player viewed while waiting) and its target is still on the map.

### Reward draft

- **Meaning:** the systems clicked so far for a settlement reward, one entry per settlement. One kind of selection, owned by the game session; read by the reward step and the map labels.
- **Lifetime:** Undo removes the last entry; Place settlements and any other selection clear it.
- **Validity:** only entries in systems still offered count, up to the reward's size.

### Assignment draft

- **Meaning:** where each drawn good goes, in the order drawn: a base, Earth or discarded. One kind of selection, owned by the game session; read by the assignment step and the map targets.
- **Lifetime:** Undo removes the last entry; Assign goods and any other selection clear it.

### Reward goods draft

- **Meaning:** the holders clicked so far for an anomaly's goods, one entry per good. One kind of selection; Undo removes the last entry.

### Sale draft

- **Meaning:** the sale being set up: system, good, count and whom to pay. One kind of selection; its count is kept within what is there to sell when it changes. Leaving the zoomed system clears it.

### Map targets

- **Meaning:** the systems the map offers for the current choice, each with its label and the action a click takes: destinations in movement, and the systems for placing an event, Homesteaders, reward settlements or the next drawn good, for selling goods, and the system of reward goods while it is not zoomed into.
- **Source:** derived from the selection, the drafts and the Machine State; never stored.

### Cargo draft

- **Meaning:** the destination chosen for the chosen ship in the cargo phase, and how many settlements and goods of each kind are drafted onto the ship (negative: off it). Nothing in the game state changes until Commit.
- **Owner and readers:** owned by the game session. It is read by the cargo phase (ship list holds) and the transfer panel (toggle, counts, holds, footer).
- **Lifetime:** cleared whenever the selection changes or clears, replaced by choosing a destination, and reset to nothing drafted by Commit.
- **Validity:** derived from the current state. A destination that is no longer available falls back to the first available one, and a draft that no longer fits the holds, Earth's storage or the base's storage counts as nothing drafted.
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
- **Transfer panel:** drawn by the cargo phase from a view computed once from the state, the chosen ship, the destination and the draft; the same view feeds the holds in the ship list.
- **Ship strip:** drawn by the board above every system tile.
- **Zoom:** the star map's scaling wrapper owns the camera; the table asks it to focus the system's hex with the panel's size kept clear, and to restore the captured earlier view on the way out. The panel slide, the camera move and the dimming share one duration and easing. The table reports the zoom-out's completion to the session after that duration.
- **Destination outline and travel-time label:** drawn by the system tile, above its ships, so a click anywhere on a reachable system commits the move.
- **Tech status, cost and owners:** derived once per tech and drawn by the tech tree, with cards above their prerequisite connectors.

## Verification scenarios

| Scenario                  | Start                                                     | Input                                                                                  | Expected                                                                                                                                                     | Verification                                              |
| ------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Choose and move a ship    | Movement phase, an arrived probe at Sol                   | Click the probe's panel tile                                                           | Gold outline on the pip; reachable systems outlined with travel times; the panel asks for a destination                                                      | Automated (`tests/turnFlow.spec.ts`)                      |
| Commit by map             | As above                                                  | Click Alpha Centauri on the map                                                        | The probe becomes an outlined pip with a turns badge; outlines and gold clear                                                                                | Automated                                                 |
| Undo a choice             | A ship is chosen, with no committed action after it       | Click Undo                                                                             | The choice clears and no action is undone                                                                                                                    | Automated                                                 |
| Choose a tech             | Develop-techs phase                                       | Click an available tech                                                                | Gold frame; payment shown with suggested markers; developing it records the tech                                                                             | Automated                                                 |
| History view              | A ship is chosen                                          | Step back in history                                                                   | No gold or outlines; returning to Live View restores them                                                                                                    | Automated                                                 |
| Simultaneous play         | A ship is chosen; another player acts                     | The other player's action arrives                                                      | The choice stays                                                                                                                                             | Automated                                                 |
| Anomaly on a tile         | A system with an anomaly, an exploration marker and ships | View the map, then zoom into the system                                                | The anomaly fills the lower right corner; the smaller marker rests on its top right corner; worlds, text, tabs and ships stay clear; the panel describes it  | Manual (screenshot script `voyages-anomalies.mjs`)        |
| Resolve an anomaly        | Exploration phase, two ships at a science anomaly         | Click both counters, then Commit ships                                                 | Each counter gains a gold border; the total turns green once enough; the card then names the committed ships; history records the attempt                    | Manual (harness scenario _Three factions at one anomaly_) |
| Inspect a clump           | Two ships of one faction at Sol                           | Hover, then click the clump; click again, Escape, or click the board                   | Hover shows nothing; click opens a strip of both counters; each close action closes it                                                                       | Automated                                                 |
| Choose from a strip       | Movement phase, an arrived probe at Sol                   | Open its clump, click its counter                                                      | The probe is chosen and the strip closes; destinations appear                                                                                                | Automated                                                 |
| Crowded systems           | Six factions with many ships at one system                | Lay out the system                                                                     | Every ship is placed, clear of worlds and printed text, one clump per faction where possible                                                                 | Automated (`shipPipLayout.spec.ts`)                       |
| Many bases                | Six bases at one system, with ships                       | Lay out the system                                                                     | One column of tabs on one edge, clear of worlds and printed text; no ship over a tab                                                                         | Automated (`baseTabLayout.spec.ts`)                       |
| Zoom into a system        | A probe at Sol                                            | Click Sol's name; then Back; then click it and press Escape                            | The view zooms to Sol with a panel listing the probe; each exit returns to the map                                                                           | Automated                                                 |
| Choose from the panel     | Movement phase, zoomed into Sol                           | Click the probe in the panel                                                           | The probe is chosen; the zoom stays                                                                                                                          | Automated                                                 |
| Summary data              | Systems with and without ships and bases                  | Summarise the system                                                                   | Each faction present with its settlements and ships, the viewer's first                                                                                      | Automated (`systemSummary.spec.ts`)                       |
| Draft and commit cargo    | Cargo phase, a cargo ship at Sol                          | Choose the ship, press the left arrow twice, then Commit                               | Counts and hold show 2 and `Pay $10B` with no action recorded; Commit records one transfer                                                                   | Automated                                                 |
| Undo a cargo draft        | A settlement is drafted                                   | Click Undo                                                                             | The draft and the choice clear and no action is undone                                                                                                       | Automated                                                 |
| Change destination        | A settlement is drafted at Earth; another ship here       | Choose the other ship in the toggle                                                    | The draft is dropped and both ships' counts are unchanged                                                                                                    | Automated                                                 |
| Propose a pact            | Harness scenario _Campaign pact_                          | Propose a pact; choose Player 2; pledge Orion and Darwin; propose                      | The editor's total turns green at 11 / 10; the pact lists Player 1 as accepted, waiting for the other partners                                               | Manual (screenshot script `campaign-pact-flow.mjs`)       |
| Accept while waiting      | A pact proposed by Player 1, Player 1's branch open       | Options → Non-active view, view as Player 2, Accept                                    | Player 2's waiting panel lists the offer with Accept, Counter and Decline; accepting shows it agreed in green                                                | Manual (screenshot script `campaign-pact-flow.mjs`)       |
| Mine and terraform        | Harness scenario _Campaign mining_                        | Terraform D with Pytheas, then Research M with Orion                                   | Each ship leaves the list; the results report the research roll and the queued terraform                                                                     | Manual (harness scenario _Campaign mining_)               |
| Turned-over anomaly       | Harness scenario _Campaign anomaly backs_                 | Read the production step; zoom into Alpha Centauri                                     | The base offers $8B and names Mineral Veins' +$3B; the back shows in the anomaly position with Pirate Raids left of it                                       | Manual (screenshot script `anomaly-backs-zoom.mjs`)       |
| Place reward settlements  | Harness scenario _Campaign reward settlements_            | Click Barnard's Star, Undo, click it again and Alpha Centauri, then Place settlements  | The panel lists each placement and Undo takes one back; Barnard's Star grows to 5 and a base of 1 appears at Alpha Centauri                                  | Manual (screenshot script `campaign-map-claims.mjs`)      |
| Place an event on the map | Harness scenario _Campaign event_                         | Click Luhman 16                                                                        | Both Givers systems are outlined with Place the event; the click places it and the decade moves on                                                           | Manual (screenshot script `campaign-map-claims.mjs`)      |
| Pacts in the system panel | A pact proposed in _Campaign pact_                        | Zoom into Alpha Centauri                                                               | The panel shows the pact as Offered to every viewer, with each partner's pledge and share                                                                    | Manual (screenshot script `campaign-pact-flow.mjs`)       |
| Assign drawn goods        | Harness scenario _Campaign trade goods_                   | Click Alpha Centauri for Food, Discard Ore, click Luhman 16 for Fine Art, Assign goods | Ore gets no highlight and the panel says it has nowhere to go; the Branch ends and Player 1 shows as done                                                    | Automated (`tests/campaign.spec.ts`)                      |
| Sell and choose demand    | Harness scenario _Campaign trading_                       | Click Barnard's Star's `Sell $6B` outline, Sell, keep a marker                         | The map zooms in and the terms show Pays Player 2 $1B; the demand step follows, then the cargo step                                                          | Automated (`tests/campaign.spec.ts`)                      |
| Demand on the map         | Harness scenario _Campaign trading_                       | Zoom into Alpha Centauri, Barnard's Star and Sol                                       | Each marker sits inside the tile's upper left, clear of the worlds; the panel describes the demand and lists the base's goods                                | Manual (screenshot script `campaign-trade-claims.mjs`)    |
| Reward goods              | Harness scenario _Campaign reward goods_                  | Click Andromeda in the zoomed panel, Back to map, then Place 1, destroy 1 for $1B      | The map opens zoomed into Alpha Centauri; Fauna appears in Andromeda's hold; Back to map zooms out to the outlined system; the console's Goods reads 1 of 12 | Manual (screenshot script `campaign-trade-map.mjs`)       |
