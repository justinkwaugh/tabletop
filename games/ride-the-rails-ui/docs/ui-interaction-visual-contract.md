# Ride the Rails: the table, the map and the panel

This contract fixes what players see and press. It follows `docs/ui-interaction-visual-contract.md`, `docs/game-ui-layout.md`, `docs/user-interactions.md`, `docs/phone-rendering.md` and the game UI animation skill. Rules are cited as `R-x.y` (`games/ride-the-rails/docs/rules-digest.md`), house rulings as `R-x.y-Hn` and implementation rules as `R-X.n` (`games/ride-the-rails/docs/rulings.md`). Colours, shapes and fonts are in `games/ride-the-rails-ui/docs/art-plan.md`.

It is written before the UI is built. Once built, the code and its tests are the source of truth: where this file and they differ, they win and this file is corrected.

The choices a player would notice are gathered in [Design choices](#design-choices), each with the alternative not taken.

## The principle

1. **The table is for looking.** A press on anything that is not lit shows it: a hex or city opens its detail beside it; a railroad in the railroad strip, or a share row in a seat card, spotlights that railroad's track.
2. **A press enlarges.** A detail stays until the next press, Escape or its close control. That press does nothing else.
3. **The panel chooses.** Every choice without a place on the map is a button in the action panel: the share to take, Done building, Best route, Ride, Pass.
4. **Departure: a lit hex is picked on the map.** Placing a locomotive and choosing a journey are choices of a place: a hex among 386, a city among 51. Listing them in the panel would make the player read a map as a list, and `docs/game-ui-layout.md` binds players to act where the thing is. So a hex or city is picked by pressing it, but only while it is lit. A press on an unlit hex keeps rule 1 (it shows the hex), so a near miss never places anything. When a pick needs a follow-up (which railroad), a popup beside the hex asks it and the panel confirms nothing more: the popup's choice sends the action.

## The table

### What is on it

| Region                                                                                                             | Holds                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Turn header**                                                                                                    | Whose turn (`Your turn`, `‹Name›'s turn`, `History`, `End of game`); the round and phase ("Round 3 · Build"); Undo at the right end (`docs/game-ui-layout.md`)                                                                                                                                                                                                    |
| **Action area**                                                                                                    | The action panel, the waiting view, the history description or the game-end summary (below)                                                                                                                                                                                                                                                                       |
| **Map** (the board)                                                                                                | The USA map's 386 hexes drawn from data: plain and mountain hexes, 51 cities with their names, capacity marks (×1 on the six East Coast cities, ∞ on Chicago), start colours, the $5 banners and Chicago's $2; the West Coast and East Coast cities marked as the Transcontinental's ends; passengers; track (locomotives); the Transcontinental claim once taken |
| **Margin** (desktop: inside the board, in the map's empty lower corners; phone: see [Phone layout](#phone-layout)) | Round track I–VI with each round's new railroad (R-1.4); the railroad strip: one entry per railroad with its supply left, its track count and its shareholders; the turn order track with each seat's marker and money                                                                                                                                            |
| **Sidebar**                                                                                                        | History controls; tabs for the seat cards, the history and chat                                                                                                                                                                                                                                                                                                   |

### Images and data

There are no images. The map, locomotives, passengers, markers, seat cards and cover are drawn in code from the logic package's map data and the game state (`art-plan.md`).

### Seat card

The players tab shows one card per seat, in turn order. Its motif is a **station departure board**: a header in the seat's colour with the name and turn position, then a board with one row per railroad the seat holds, in railroad order (Red, Blue, Orange, Yellow, Purple, Black), each row showing the shares as small locomotives with the count beside them, and the money as the board's large figure. A railroad not yet held has no row. The acting seat's card has an outline. Pressing a share row spotlights that railroad (Railroad spotlight).

## Visual intents

### Pick conventions

- **Lit** (amber ring over a soft amber fill, on a dark halo): a hex or city the deciding seat may press now. While a map pick is open, a scrim dims the rest of the map; lit hexes show through holes in it. Panel-only steps never dim the map.
- **Picked** (heavier amber ring): a staged hex or city. Pressing it again unpicks it.
- **Railroad pips.** A lit hex shows one small pip per railroad that may go there or link there, in the railroad's colour with its monogram; a start is a hollow pip. The pips are the only words-free statement of "which railroad"; the hex carries no name while lit.
- **Gain and cost marks**, one wordless mark each at the hex's lower right, over the halo: a coin "$2" (Chicago), a green coin "$5" (a $5 city still to be had, when some railroad's placement there earns it), a gold coin "$12" or "$8" (some placement there completes the Transcontinental, with the price it would pay), and a rose "−1" (a mountain while no mountain has been used this turn: the limit would drop). Several marks stack outward. Marks come from the logic package's rule helpers, so a mark and what the engine pays never disagree.
- **Keyboard and touch.** Lit hexes are buttons in the accessibility tree, named by place and effect ("Chicago: place Orange or Black, $2"), reached by Tab in id order, pressed with Enter or Space. A lit hex's hit target is the whole hex. Nothing depends on hover: every hover effect also has a press.

### Look: hex detail

**Trigger:** a press on a hex or city that is not lit, at any time, in Live or History View. **Shows:** a popup beside the hex with its name (or terrain), capacity, the locomotives in it by railroad, the start colours it shows, its bonus and whether it is still to be had, and whether a passenger waits there. **Unaffected:** the scrim, the lit set, any staged pick. **Ends:** the next press anywhere, Escape, the close control, or a new Game State that moves the board.

### Look: railroad spotlight

**Trigger:** hovering (pointer) or pressing (touch, keyboard) a railroad in the railroad strip or a share row in a seat card; a second press, or pressing another railroad, ends or moves it. **Shows:** with no map pick open, every other railroad's track dims under the scrim and this railroad's track stays bright above it, its starts outlined. With a map pick open, the pick's scrim stays and this railroad's track gets an outline instead. **Unaffected:** lit hexes, staged picks, the panel.

### Take a share (`TakingShares`, the deciding seat)

The panel prompt reads "Take a share". Below it, one button per railroad in railroad order, drawn as that railroad's locomotive with its name, supply left ("19 left") and the seat's own shares. A railroad not yet available is shown disabled with its round ("from round 4"); one with an empty supply is disabled with "none left" (R-1.1-H1). Pressing an enabled button sends `TakeShare` (one press). The map is not dimmed and nothing on it is lit: the railroad strip on the board is for looking only.

### Build: place a locomotive (`Building`, the deciding seat)

- **Lit:** every hex where some railroad the seat holds may be placed now (the placement test, rules R-3.2 and R-4.1 to R-4.2), with its railroad pips and marks. Starts light only the start cities each railroad's rule allows (R-4.2); Yellow's western start lights the fixed westernmost set's cities that hold exactly one locomotive (R-4.2.3-H1, -H2).
- **Press a lit hex with one possible railroad:** sends `PlaceLocomotive` at once. The locomotive lands, any bonus is paid, and the lit set refreshes.
- **Press a lit hex with two or more:** the hex becomes picked and a popup beside it shows one chip per possible railroad: its locomotive, supply left, and the bonus that railroad's placement pays (a Black start in a $5 city pays nothing, R-4.3.2-H1). Choosing a chip sends `PlaceLocomotive`. Undo, or pressing the picked hex again, closes the popup.
- **Panel:** the prompt "Place locomotives", then "2 of 5 placed", and after a mountain "Mountain used: limit 4" (R-3.2.4). One button: Done building, which reads Build nothing before the first placement (R-3.2.1 "may"). When nothing more is legal the turn ends by itself (`FinishBuilding`), and the panel goes to the next view.
- **This turn's placements** are marked for every viewer with a thin seat-coloured bar under each locomotive placed this building turn, so others can follow the turn as it happens. The bars clear when the building turn ends.

### Ride the Rails: choose a journey (`Riding`, the deciding seat)

A journey is a staged selection of two stages: the start, then the links (a stacked stage, `docs/user-interactions.md`, Stacked stages).

- **Start.** Lit: each city holding a passenger from which at least one link leaves. The panel prompt reads "Choose a passenger". Pressing one picks it: its passenger lifts slightly and the city is picked.
- **Extend.** Lit: every city one more link can reach from the route's last city without reusing a hex, with the pips of the railroads that can make that link. Pressing a lit city with one railroad pushes that link; with several, a popup beside the city offers a chip per railroad, each with what the journey would then pay the seat. The route draws as a line through its hex centres, each link in its railroad's colour over a dark halo, with a station dot at every city visited and the link count at the last city.
- **Best route** (panel): replaces the links with the route that pays the seat most from this start (fare plus their own dividends). It is a starting point: the seat may Undo links from it and extend differently.
- **Panel:** the route as its cities ("Seattle → Portland → Boise"), "3 links · fare $4", then one chip per seat that a dividend reaches, in seat colour, with "+$N", and the seat's own total. **Ride · you +$N** sends `RideJourney`; it is enabled from the first link.
- **Undo** pops the last link, then the start, one per press; pressing the picked start again clears the whole draft.
- **No journey possible** (R-3.3.1-H1): the prompt reads "No passenger can travel: no link leaves any passenger's city" and the only button is Pass. Nothing is lit and the map is not dimmed.

### Last journey

After a journey, its route stays drawn for every viewer, thinner and without the halo, until the next action is made. In History View it shows the displayed action's journey. It never takes presses.

### Watching (waiting view)

For a seat that is not deciding:

- **Take a share:** "‹Name› is taking a share", the seats still to take in phase 1's reverse order, and the last share taken ("Ben took Blue").
- **Build:** "‹Name› is building · 2 of 5 placed", and the railroads they may build. Their placements appear live with this turn's bars.
- **Ride:** "‹Name› is choosing a journey". After each journey, its line: "Ben: Seattle → Chicago, 6 links, fare $7; you +$3".
- Every waiting view ends with a line of seat chips in turn order with each seat's money, since money decides turn order (R-2.5.1).

### End of round and game end

- **End of round** has no view of its own: it happens in the last journey's cascade. The history description and the log show the new turn order, with each seat's money, and the railroad made available.
- **Game end:** the action area shows the final money in order, the winner or winners (R-6.2-H1: every seat tied for most), and each seat's shares.

### History View

The action area shows the history description for the displayed step. Nothing is lit, no scrim, no popups, no staged route; the last-journey line and this-turn bars follow the displayed state. Hex detail and railroad spotlight still work, since they only look.

## Coexistence and precedence

One semantic derivation, the **board offer** (Shared visual state), decides the lit set, the scrim, the marks and the popups. Map layers draw its result.

| Overlap                                       | Rule                                                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| A map pick (build or journey) and hex detail  | Coexist. A press on an unlit hex shows its detail and changes no stage; a press on a lit hex picks and closes any detail.                        |
| A map pick and railroad spotlight             | Coexist. The pick's scrim and lit set win; the spotlight only outlines its railroad's track.                                                     |
| Railroad spotlight and hex detail             | Coexist.                                                                                                                                         |
| The railroad popup and Undo                   | Undo closes the popup first (it is the latest manual stage).                                                                                     |
| The staged route and the last-journey line    | Impossible: the last-journey line belongs to the previous action and is hidden while a draft holds a start.                                      |
| A staged pick and History View                | History View wins: entering it hides every pick, scrim and popup; leaving it shows the live offer again, rebuilt from the live state.            |
| A staged pick and another seat's action       | Impossible in this title: only the deciding seat acts, and every action is sequential.                                                           |
| A staged pick and a new Game State            | The new state clears every staged selection (default `keepsLocalSelections`), so a build popup or route never outlives the state it was made on. |
| Focus views, zoom, full screen and any intent | Coexist: they change only the view. A staged pick survives them.                                                                                 |

## Shared visual state

The session owns these. Components read them and call its methods.

- **Build stage** (`hex`): the picked hex while its railroad popup is open. Producer: a press on a lit hex with two or more railroads. Consumers: the hex's ring, the popup. Lifetime: a chip press (sends), Undo, a second press on the hex, a new Game State. Validity: only in `Building`, for the deciding seat, while the hex is still in the offer. History View: hidden.
- **Journey draft** (`start`, then stacked `links`). Producer: presses on lit cities, link popups, Best route. Consumers: the map's route line, the lit set, the panel's route and payments, the seat cards' pending "+$N" chips. Lifetime: Ride (sends), Undo pops, a new Game State clears. Validity: only in `Riding`, for the deciding seat; a draft is re-checked against the displayed state and reads as empty if any link no longer holds. History View: hidden.
- **Journey preview** (derived, never stored): links per railroad, the fare, each seat's payment, from the draft and the shares. Consumers: the panel, the seat cards' pending chips, the map's link count. It uses the logic package's payment helper, so the preview equals what `RideJourney` pays.
- **Board offer** (derived, never stored): from the displayed state, the valid actions for this seat and the stages. Effects allowed: lit set, pips, marks, scrim holes, which popup is open. Consumers: every map layer. History View and other seats: empty.
- **Hex detail** (`hexId`): producer, a press on an unlit hex; consumer, the detail popup. Cleared by the next press, Escape, close, or a Game State that changes that hex. Kept across History View navigation when the hex exists in both states.
- **Railroad spotlight** (`railroadId`): producer, the railroad strip and seat cards; consumers, the track layer and the scrim. Cleared by a second press or pointer leave (hover only). Survives Game States and history navigation.
- **Animation transients**: a travelling locomotive, a travelling passenger, a coin chip. Producer: the state-change animators. Consumers: the flight layer only. Scoped to the action being animated; cleared on its timeline's end or teardown.

## Render ownership

The board is **one SVG** (`docs/phone-rendering.md`, One board surface). Back to front:

1. Ground and map: plain and mountain hexes, coast outline.
2. Cities: station discs, names, capacity marks, start-colour pips, bonus banners, the Transcontinental ends and its claim.
3. Passengers.
4. Track: locomotives, this turn's bars.
5. Last journey line.
6. **Scrim**: one path, the map's outline with holes at the lit hexes (even-odd fill). It is a plain translucent fill, not an opacity or filter effect. With a spotlight and no pick it covers track only, and the spotlit railroad's locomotives are drawn again above it.
7. Staged route line and station dots.
8. Rings, pips and marks (the board offer).
9. Flight layer: travelling locomotives, passengers and coins.
10. Hit targets: transparent hex shapes carrying hex ids, the only map elements that take presses.

Popups (the railroad chips, hex detail) are HTML in the `Floater` against a reference point at the hex, outside the SVG, so their text stays crisp at any zoom (`docs/phone-rendering.md`, HTML text under zoom). The focus chooser sits in the `ScalingWrapper`'s `overlay` snippet. Rings, pips, marks and city names are sized by `viewScale()` so they stay readable at any zoom. No SVG or CSS filters, masks or endless animations on the board.

## Game log and history

- **One entry per player turn**, grouped (`docs/game-ui-layout.md`, Group): a share ("Ana took Red"); a building turn that grows as placements arrive ("Ana built 5: Red ×3, Blue ×2 · Chicago $2 · Denver $5") and closes at its end, with the reason when it ended by itself; a journey with its cities, link counts per railroad, the fare and each seat's dividend; a pass.
- **Interstitials** at each round and phase from the round and phase managers' series.
- **Skipped:** `SkipShare` is folded into its seat's entry; `FinishBuilding` closes its building entry rather than standing alone.
- **Jump** on round and turn entries. **Replay** on building turns (placements land in order) and journeys (the passenger travels). Shares, passes and the end of round have nothing to replay on the map.
- Text is built from each action's input and metadata (the logic package records bonuses, payments, the new order and the railroad made available).

## Animation plan

The game-session state-change animators and the shared `AnimationContext` own all motion caused by a committed transition. Each handles both modes: with an action, the motion below; without one (Undo, state-only history navigation), a direct `from → to` within 200 ms, pieces appearing or disappearing with a short scale and money snapping. Silent restoration moves nothing.

| Animator         | Live motion (with an action)                                                                                                                                                                                                                                                              | Pattern                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Share            | A locomotive lifts from its railroad's strip entry and flies to the seat's turn-order marker; the strip's supply count and the seat card's share count tick                                                                                                                               | B (transient flyer), D (counts) |
| Placement        | A locomotive flies from its railroad's strip entry to the hex and settles into its slot; a start lands with a small bounce. Bonus coins rise from the hex and fly to the seat's marker; money ticks                                                                                       | B, D                            |
| Transcontinental | After its placement lands, the line's hexes outline one after another (at most 900 ms), then a gold coin flies to the seat                                                                                                                                                                | B                               |
| Journey          | The start passenger travels the route through hex centres at about 120 ms per hex, the whole capped at 2.4 s; each city passed pulses its station ring once; at the end it fades. Then every dividend coin and the fare fly from the end city to the seats' markers together; money ticks | B, D                            |
| End of round     | After the last journey's motion, on the same timeline: the turn-order markers slide to the new order; the round marker steps; the new railroad's strip entry goes from dim to full                                                                                                        | A                               |

- Every motion has an explicit timeline position; independent motion starts at 0.
- A full-action replay of a building turn plays each placement in turn, including the closing `FinishBuilding`; history does not exit before the last motion settles (terminal system-action batches).
- Motion stays still around it: only the small travelling element repaints. Lit rings are static, never pulsing.
- SVG motion tweens a plain point and writes `translate(...)` on a centred outer wrapper (`docs/phone-rendering.md`, Moving SVG under zoom).

## Phone layout

At 375 × 812 and below `sm`:

- **Header:** one compact line: whose turn, "R3 · Build", Undo.
- **Action area:** the prompt on one line; buttons wrap. The journey panel collapses to "3 links · fare $4 · you +$6" with a toggle that opens the per-seat chips. Take a share's six buttons wrap to two rows of three.
- **Railroad strip:** the board's margin would pan out of sight, so on phones the round badge and the six railroad entries (colour, monogram, supply left, dim until available) form one row above the board, outside the scaling. It is the spotlight control on phones. The turn order and money move to the waiting view's seat line and the seat cards.
- **Board:** fitting the whole map would make a hex about 11 px wide. It rests at a cover fit (`coverBelowScale`) that fills the view's height, about 33 px a hex, and pans sideways. The focus chooser (Whole map, West, Middle, East) sits in the overlay, shown whenever a hex is under 28 px on screen; it is the same control in full screen. Full screen keeps play going by rendering the action area in the wrapper's toolbar while modal.
- **Popups** clamp inside the viewport and flip above the hex when there is no room below.
- **Touch:** every hover effect has a press. Lit hit targets are the whole hex.

## Design choices

- **U-1 Board picks** for hexes and cities, lit only when legal. _Alternative:_ a panel list of hexes. Rejected (the principle, rule 4).
- **U-2 Hex first, railroad second, and only when ambiguous.** Most presses place at once; the popup appears only when two railroads may go to one hex. _Alternative:_ choose a railroad in the panel, then its hexes. Rejected: a building turn often mixes railroads (R-3.2.2), and each switch would cost a press.
- **U-3 Each placement is sent at once** and undone one at a time, matching the logic's one action per placement.
- **U-4 Journeys built city by city, with Best route.** _Alternatives:_ pick only an end city and let the engine route (takes the railroad choice from the player, R-3.3.2); or a route list in the panel (unreadable with many routes).
- **U-5 An unlit press shows the hex.** A near miss never acts.
- **U-6 Railroad colours are rule colours, never seat colours.** Locomotives always carry the railroad colour and monogram; seats appear only as markers, chips, bars and card headers.
- **U-7 The last journey stays drawn** until the next action, so a seat that looked away sees what was carried.
- **U-8 The focus chooser shows only when hexes are small** on screen.

## Verification scenarios

Each gives the start, the input, the result, the result after Undo or exit, and how it is checked. "Auto" is a session or component test; "Manual" is a person at desktop and at 375 × 812.

**Take a share**

1. **Round 1, 4 seats, phase 1.** The last seat in turn order decides first. Panel: Red and Blue enabled with "27 left"; Orange to Black disabled with their rounds; the map not dimmed. Press Red: the locomotive flies to the seat's marker, Red shows "26 left". Undo (before the next seat acts): the share returns. Auto.
2. **Empty supply.** With Red's supply at 0, Red's button is disabled with "none left"; Blue still enabled. Auto.

**Build**

3. **First placement.** Round 1, a seat holding Red only: lit are the six East Coast cities with hollow Red pips; the rest dims. Press New York: the locomotive lands, the panel reads "1 of 5 placed", New York's neighbours that can take Red light. Undo: the locomotive leaves, the six cities light again. Auto.
4. **Red and Blue never share an East Coast city.** Blue started in Philadelphia: a seat holding Red sees Philadelphia unlit. Auto.
5. **Two railroads possible.** A seat holding Red and Blue presses a hex both may enter: the hex is picked, a popup shows Red and Blue chips. Undo closes the popup and places nothing; a second Undo undoes the previous placement. Choosing Blue places Blue. Auto.
6. **Mountain limit.** 4 seats (limit 5), 4 placed, no mountain yet: no mountain hex is lit and plain hexes are. With a mountain placed earlier this turn, the panel reads "Mountain used: limit 4", and the fourth placement ends the turn by itself (`FinishBuilding`). Auto.
7. **Bonus marks and pay.** A lit Chicago shows "$2"; placing there adds $2 and a coin flies. A lit, empty Denver shows "$5" for an adjacent railroad; a Black start in an empty $5 city shows no "$5" chip in its popup and pays nothing. Auto.
8. **Transcontinental.** With a Purple line from Seattle meeting Red in Chicago and Red reaching New York but for one hex: that hex shows "$12"; placing there pays $12 once, the claim appears on the board, and no hex shows the mark again. With the meeting in a non-city hex the mark reads "$8". Auto.
9. **Yellow's starts.** Round 3: Chicago and the westernmost occupied cities holding exactly one locomotive light with hollow Yellow pips. After a Yellow start in Chicago, the western start still lights the set fixed at that placement, even after other railroads build further west. Auto.
10. **Build nothing.** A seat presses Build nothing with 0 placed: the next seat's turn starts. Undo before they act restores the turn. Auto.
11. **This turn's bars.** Another seat watches a building turn: each new locomotive has the builder's bar; when the turn ends the bars clear. Manual.

**Ride the Rails**

12. **Start and extend.** Lit: passenger cities with a link out. Press one: it is picked and the cities one link away light with pips. Press one with a single railroad: the link draws, the panel shows "1 link · fare $2" and dividend chips. Undo removes the link; a second Undo unpicks the start. Auto.
13. **Railroad choice on a link.** Two railroads link the head to a city: the popup offers both with what each pays the seat. Choose one: the link draws in its colour. Auto.
14. **No loop.** A city already on the route, or reachable only through a used hex, is never lit. Auto.
15. **Best route.** Press Best route: the route fills with the best-paying journey; Undo pops its last link, not the whole route; Ride sends the shown route and the money paid equals the preview. Auto.
16. **Pass.** No passenger city has a link: Pass is the only button, nothing is lit. Auto.
17. **Last journey.** After a seat rides, every viewer sees its route drawn thinly until the next action; the waiting view names it. Manual.

**Round and game end**

18. **End of round.** The last journey of round 1: after its motion, the markers slide to money order (ties per R-2.5-H1), round II shows, Orange's strip entry turns full. Undo of that journey before the next seat acts reverses all of it. Auto (state), Manual (motion).
19. **Game end.** Round 6's last journey: the summary shows final money and both seats tied for most as winners. Auto.

**Looking, history and phones**

20. **Hex detail during a pick.** During a building pick, press an unlit hex: its detail opens and no stage changes; the next press on a lit hex places and closes the detail. Auto.
21. **Spotlight.** Hover Blue in the strip with no pick: other track dims under the scrim. Open a build pick: the pick's scrim shows and Blue's track is outlined. Manual.
22. **History View.** With a build popup open, step back in history: popup, scrim and lit hexes vanish; the history description shows; return to Live View: the live offer is lit, the popup gone. Manual.
23. **Rapid interruption.** Press Undo while a placement's locomotive is in flight: the motion ends at once and the board shows the undone state. Replay a building turn from the log: placements land in order, then history returns. Manual.
24. **Phone.** At 375 × 812: the board rests at cover fit and pans; the railroad strip sits above it; the focus chooser shows; tapping a lit hex places, a near-miss tap on an unlit hex opens its detail; popups stay on screen at the map's edges; nothing scrolls sideways inside the game column. In full screen the action area is in the toolbar and a building turn can be finished. Manual.
