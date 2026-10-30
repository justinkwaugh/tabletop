# Promontory Point: the table, the map and the panel

This contract fixes what players see and press. It follows `docs/ui-interaction-visual-contract.md`, `docs/game-ui-layout.md`, `docs/user-interactions.md` and the game UI animation skill. Rules are cited as `R-x.y` (`rules-digest.md`), house rulings as `R-x.y-Hn` and implementation rules as `R-X.n` (`rulings.md`), in `games/promontory-point/docs/`.

It is written before the code. Action names are in backticks: `BuyShare`, `SellShare`, `PlaceTrack`, `ScrapTrack`, `PayRepairs`, `EndTurn`, and the System Action `RevealHand`. A placement resolves its town, and collects the Repairs bills of every holder who can pay, inside `PlaceTrack`; the drawing of a hand is part of `EndTurn` and of a drawing `ScrapTrack`; final scores are derived from the final state, not written by an Action. Once code exists, the code and its tests are the source of truth: where this file and they differ, they win and this file is corrected.

The choices a player would notice are gathered in [Design choices](#design-choices), each with the alternative not taken.

## The principle

Oath's principle, with one stated departure:

1. **The table is for looking.** A press on a share card (in a seat card, a deck, the panel) or on a town tile enlarges it. A press on the bag shows how many pieces are left ("51 pieces in the bag"), never which (R-5).
2. **A press enlarges.** The enlarged view sits over everything until the next press, Escape or its close button. That press does nothing else.
3. **The panel chooses.** Every choice without a place on the board is a button in the action panel: buy, sell, which piece to place, which shares to sell for Repairs, end the turn.
4. **Departure: a lit hex is picked on the board.** `docs/game-ui-layout.md` binds this: players act where the thing is. Placing a track piece targets one of 123 hexes (R-1.1, R-1.1-H3); a list of hexes in the panel would be long and would not show where they are. So once a piece is picked in the panel, its legal hexes light and a press on a lit hex places it. An unlit hex does nothing on a press except enlarge its town tile, if it has one. This is the only board pick in the game.

## The table

### What is on it

| Region                                                                  | Holds                                                                                                                                                 | Drawn as                                                         |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Map**                                                                 | 123 spaces (including the coastal hex below the Southern Pacific home), the four railroad home hexes, Promontory (+5) at the centre (R-1.1, R-1.1-H3) | the supplied map image                                           |
| **Town tiles** (on the map)                                             | one face-up tile on each of the 48 village hexes (R-1.3), still shown under a track piece                                                             | the supplied tile images, clipped to the village hex             |
| **Track pieces** (on the map)                                           | every placed piece, as a round token in its railroad's colour; no rails between hexes (O-5)                                                           | drawn in code in the railroad's colour (R-X.4)                   |
| **Share-price track** (on the map, left)                                | one marker per railroad on the printed 30-space track, 25 down to the fifth 0 (R-1.2)                                                                 | printed track; markers drawn                                     |
| **Border track** (on the map, edge)                                     | one money marker per seat on the printed 0–99 track, wrapping past 99 (R-1.3-H1)                                                                      | printed track; markers drawn                                     |
| **The sea** (on the map, in the open sea right of the price track, O-8) | the four share decks with counts (R-1.3), the bag with its count, the end tracker: red towns open and Promontory open or taken (R-6.1, R-6.1-H1)      | share faces from the supplied art; bag, counts and tracker drawn |
| **Players column** (the sidebar's Players tab, desktop)                 | one seat card per seat, in seat order                                                                                                                 | drawn; share faces from the supplied art                         |
| **Seat strip** (phone)                                                  | one chip per seat (see [Phone layout](#phone-layout))                                                                                                 | drawn                                                            |

### Images and data

- **Supplied images:** the map; the four share card faces; the eight town tile faces (+1, +2, +3, −1, −2, −3, Dividend, Repairs). The tile back and the share back are not used (O-7).
- **Drawn from data:** track pieces, price markers, money markers, the bag, every count, rings, chips, outlines, dimming, the seat cards, the end tracker.
- **Positions** come from one geometry table in map-image units, not from the picture at run time: each hex centre from its axial coordinate (pointy-top, Promontory at 0,0; `x = x0 + w·(q + r/2)`, `y = y0 + h·r` with the constants measured once off the map), each price-track space (30), each border-track space (100) and the sea slots (share decks, bag, end tracker).
- **Price-track slots.** Each railroad has a fixed slot across a row (CP, UP, KP, SP from the left), so markers on one value sit side by side and never overlap. The five 0 spaces are distinct positions (R-1.2): a marker on the third 0 stands on the third 0.
- **Border-track slots.** One seat alone in a space takes it whole; two or more share it as a 2×2 grid. A seat at 100 or more stands at its value less 100 with a "+100" mark (R-1.3-H1).
- **Town tiles** are clipped to a hex a little larger than the printed village hex, so the red Dividend and Repairs tiles keep their red border; the number tiles are turned upright (O-6). A piece on a tile is drawn smaller than the tile, so a covered red tile still reads as red and the end tracker's count can be checked on the board.

### Seat card

Each seat has one **seat card**, the brokerage ledger (O-10): a tan card in the map's paper colour, ruled twice, with a header in the seat colour. Top to bottom:

- **header:** the seat's name, a "placing" or "repairs" tag when that seat decides, and its **money** in large figures (public, R-1.3-H1);
- **shares:** four small stacks of share faces, one per railroad, each with its count and that railroad's price ("×3 · $4 ea"); a railroad the seat holds none of shows a faint stack and "×0";
- **foot:** the hand, three pieces (four with the variant, R-6.3), and "shares worth $25" (O-9).

The hand follows R-5 by perspective, never by what the client holds:

- the deciding seat's hand is revealed from the start of its turn (R-2.2 step 1), drawn in railroad colours, captioned "hand, revealed";
- the viewer's own concealed hand is drawn in colour, captioned "yours, hidden";
- every other concealed hand is grey discs marked "?", captioned "hand: 3 hidden".

A press on a share stack enlarges that share card. The name opens the seat at a readable size over the table (the same card larger, with the money history of the turn); the backdrop, Escape or the name again closes it. The seat card, the seat strip and the open seat read one derivation of the seat, so they never differ. The active seat's card carries the amber ring.

## Visual intents

### Pick conventions

- **Lit** (amber ring over a dark halo): a hex the deciding seat may press now. While a board pick is open, the rest of the board dims under one veil with holes at the lit hexes.
- **Picked** (heavier amber ring, faint amber fill): never used on the board, since a press on a lit hex sends. In the panel, the picked hand piece and each picked share for Repairs carry the heavier ring.
- **Chip** (anchored on its target): on a lit Dividend town, a neutral chip with what the deciding seat would receive ("you +$4"); on a lit Repairs town, a rose chip with its bill ("you pay $6") (O-3). Price towns and Promontory carry none: the tile says it. A chip never covers another lit hex.
- **Being decided** (neutral dashed outline, no dimming): the Repairs town whose bill is being paid, shown to every seat while any seat sells (R-4.3).
- **This turn's placements:** each piece the deciding seat placed this turn carries a dashed outline and its order badge 1, 2 or 3, for every seat, until the turn ends.
- **Rose** always carries a label and the dark halo, so a cost is never read as a red railroad, a red Repairs tile or Kansas Pacific's red.
- A lone legal choice is auto-selected (`auto` stage) and Undo never returns to it.

### The turn opens (before the first placement)

- The deciding seat's three pieces turn face up for everyone (`RevealHand`, R-2.2 step 1).
- The panel reads "Your turn. Buy or sell up to 2 shares, then place your 3 pieces." It shows the hand (a press picks a piece) and the **share block**: one entry per railroad with its card face (a press enlarges it), price, shares left in its deck and the seat's holding, a **Buy** and a **Sell** button, and "2 actions left".
- **`BuyShare`** (R-3.1): one press sends; it costs the price, "free" at 0. Dimmed with a one-line reason when the deck is empty ("none left") or the seat cannot pay ("you have $3").
- **`SellShare`** (R-3.2, R-3.2-H1): one press sends; it pays the price, $0 at 0. Dimmed when the seat holds none of that railroad.
- Two share actions in all, before the first placement or after the third (R-2.2, R-2.2-H1). After two, every Buy and Sell is dimmed with "no share actions left".
- No board pick is open, so nothing is dimmed and nothing is lit.

### Placing a track piece (`PlaceTrack`)

- **Stage 1, the piece** (panel): a press on a hand piece picks it; pressing it again unpicks it; pressing another piece switches. When every piece left in hand is of one railroad, the piece is auto-picked (`auto`).
- **Stage 2, the hex** (board): the picked railroad's legal hexes light: empty, and next to its home or one of its pieces (R-3.3). The board dims. Chips per O-3. A press on a lit hex sends `PlaceTrack`; the piece lands and the town resolves at once, inside the same Action (R-3.3, R-4.2).
- The panel reads "Place piece 2 of 3. Tap a lit hex for Kansas Pacific." The share block stays in view, locked: "Buying and selling open again after your third piece" (R-2.2-H1).
- Placing is undoable within the turn until a draw (R-X.2). Undo after a placement removes the piece and reverses its town's effect.

### No room for a piece (`ScrapTrack`)

- A hand piece with no legal hex shows "no room" under it in the panel. Picking it offers one button: "Set aside · draw a replacement · can't be undone" (R-3.3). The press sends; the piece leaves the game, a replacement is drawn and joins the revealed hand face up (O-11), and it must be placed this turn as one of the three (R-3.3-H1). With the bag empty, the button reads "Set aside · bag empty" and the turn places one piece fewer.
- Setting a piece aside is part of placing: once a player sets one aside, even before the first placement, the share block locks until the placements end (R-2.2-H2).
- **Four-piece variant** (R-6.3-H2): a piece is set aside only when it is chosen as one of the three to place. A player may keep a piece that has no room, place the other pieces, and carry it over as the kept piece, which stays face up for every seat.
- This is the one mid-turn draw. It is an undo barrier (R-X.2), so the button names it.

### Town effects (in `PlaceTrack`)

All follow the placement at once, for every seat, and are written into the placement's `metadata` (R-4.2):

- **Price towns and Promontory** (R-4.2, R-1.2): the railroad's price marker steps along the track. Movement beyond 25 or the last 0 is lost; the history says "capped".
- **Dividend** (R-4.2): every holder of that railroad receives $2 per share; each seat's money marker steps and its seat card's money changes.
- **Repairs** (R-4.2, R-4.3 and H1 to H4): see the next section.

### Repairs payment (in `PlaceTrack`, then `PayRepairs`)

- When a piece reaches a Repairs town, each holder's bill is fixed at $2 per share of that railroad held at that moment (R-4.3-H1). Every holder who can pay pays at once, inside `PlaceTrack`. Every holder whose money is below the bill is short and sends one `PayRepairs`. If no one is short, play goes on with no stop.
- **Short seats decide one at a time**, the placing seat first if short, then the others in seat order from the placing seat (R-4.3-H4). The deciding short seat may be any seat: it decides out of turn.
- **Every seat** sees the **Repairs row** above its action area: one chip per seat in that order with its bill and its state: "paid $6 ✓", "no shares", "short $3 · choosing shares to sell" (dashed outline, the deciding seat), or "waiting" for a short seat later in the order. The Repairs town carries the being-decided outline and a rose chip naming it ("Repairs · SP").
- **The deciding short seat**: its turn header reads "Your turn" and its seat card the "repairs" tag. Its panel reads "Repairs on Southern Pacific. Mara placed SP on a Repairs town. You owe $10 (5 SP shares × $2) and have $7. Sell shares at half price, rounded down, one at a time, until you can pay." It lists one entry per railroad the seat holds: the card face, the holding, "price $6 → $3 each", and **Sell one**. Each press stages one more share of that railroad (a tap list; Undo pops the last). A running line reads "Have $7 + sale $3 = $10 of $10 · enough". Once the staged sales cover the bill, every other Sell is locked, since selling stops as soon as the seat can pay (R-4.3-H2). The note "Selling SP does not lower the bill" stands whenever the seat holds the railroad that caused it (R-4.3-H1).
- **The send** names the result: "Sell 1 SP share · pay $10". When every share sold would still leave the seat short, the panel stages every share in one press and the button reads "Sell all 4 · pay $5 · $5 forgiven" (R-4.3-H3); a short seat with no shares reads "Pay $3 · $5 forgiven". Every outcome is the seat's own press (R-X.1).
- **Every other seat** (the placing seat included) reads "‹Name›'s turn" in the header and, in the waiting view: "Repairs on Southern Pacific. Royce owes $10 and has $7: he is choosing shares to sell at half price. Mara's turn continues once he has paid." What the seat has staged is not shown until it sends.
- Once the last short seat has paid, the placing seat's turn continues where it stood (R-4.3-H4).

### After the third placement and ending the turn (`EndTurn`)

- The share block unlocks with whatever actions are left (R-2.2-H1). The panel's primary button is **End turn · draw 3**. One press sends `EndTurn`; it draws the new concealed hand and is an undo barrier (R-X.2). With fewer than three pieces in the bag it reads "End turn · draw 2" (R-6.1-H2). With the bag empty it reads "End turn · bag empty", and the variant's draws follow the bag the same way.
- **Four-piece variant** (R-6.3, R-6.3-H1): the hand holds four and the turn places three. With a piece left over, End turn becomes two buttons: "Keep ‹UP› · draw 3" and "Return it · draw 4". With no piece left over it is one button, "End turn · draw 4".
- The turn header passes to the next seat; that seat's hand turns face up.

### Watching (waiting view)

The waiting view says who decides and what, then the live state of a shared step, then what the last action did, built from the Action's input and `metadata`: "Mara is placing piece 2 of 3 (SP, KP left). Last: Mara placed UP on a Repairs town: bills Mara $2, Theo $8, Inez $6, Royce $6, all paid." During Repairs it carries the Repairs row (above).

### Game end

- After a turn ends with at most one red town open and Promontory taken, or with the last piece drawn from the bag, the game ends (R-6.1, R-6.1-H1, R-6.1-H2). The header reads "End of game".
- The action area becomes the **score**: one row per seat, money, each railroad as "count × final price", share value and total (R-6.2), sorted by total, the winner first and in amber. A tie names every winner (R-6.2-H1). The line above names why the game ended.
- The board keeps the final table. Hands stay as they were, hidden from others.

### Hidden information, as others see it

Drawn by rule, never because the client holds the data; a Local game or Host View holds every field and the perspective decides.

- **Concealed hands** (R-5): grey "?" discs with the count, until the owner's turn reveals them.
- **A draw** (`EndTurn`, `ScrapTrack`): the drawer sees the pieces; others see the count ("drew 3"). A replacement joins the revealed hand (O-11).
- **The bag:** its count only.
- **Staged Repairs sales:** private to the deciding seat until it sends.
- Money, shares, prices, decks and the board are public (R-5, R-1.3-H1).

## Coexistence and precedence

One semantic derivation in the session, the **board offer**, decides each hex's role: lit, being decided, this turn's placement, dimmed or plain, and its chip. Every board layer draws that result and nothing else.

- **One staged action at a time.** Only the placement lights hexes; the share block, Repairs and End turn are panel steps and never dim the board.
- **Lit and being decided never meet.** Hexes light only while a piece is picked; a Repairs payment suspends the turn, so no piece can be picked while the outline stands.
- **This turn's placements and lit hexes never meet**: a placed hex is occupied, so it is never legal. The dashed outline stays drawn under the veil.
- **Chips and lit rings** coexist; one chip per hex.
- **What is open wins over what is under it.** The enlarged card or tile sits above the open seat, which sits above the table. Escape closes one layer at a time: the enlarged view, then the open seat, then full screen.
- **History View offers no choices.** No panel, no lit hex, no send. The being-decided outline, the Repairs row, this turn's badges, enlarge and the open seat keep working on the displayed state.
- **Undo** (`docs/user-interactions.md`): it pops the highest manual stage first (a staged Repairs sale, then the picked piece), then undoes the Undo Candidate. It is hidden when neither exists, so it is hidden right after a draw (R-X.2). The placing seat's Undo while another seat decides Repairs undoes the placement and with it the Repairs step; the deciding seat's staged sales then no longer apply and are dropped.
- **Out-of-turn decisions:** while a short seat decides Repairs, it alone has a panel. The placing seat has a waiting view and its Undo.
- **Hover** on a hand piece (mouse or pen) previews its legal hexes with a thin ring and no dimming; one already lit keeps its ring. Touch has no hover and no information depends on it.

## Shared visual state

The session owns these values. Components read them and call its methods. Each is read back only while it still applies, so a stale value offers nothing.

- **Turn draft** (stages: piece → hex). Producer: hand presses in the panel, lit-hex presses. Consumers: the panel, the board offer, the send. The hex stage is never stored: its press sends. Lifetime: the send; Undo; `beforeNewState` on every transition. Validity: the piece must still be in hand and, in the displayed state, have a legal hex or, with no room, still be one the seat may set aside. A lone railroad is picked automatically (`auto`); a press on it changes nothing.
- **Repairs draft** (a tap list of railroads to sell, in order). Producer: Sell one presses. Consumer: the Repairs panel and its running line. Lifetime: the seat's send; Undo; any transition that leaves the Repairs step or changes the deciding seat. Validity: the seat must still be the deciding short seat and hold each staged share.
- **Board offer.** Derived, never stored, from the displayed state, the valid actions and the turn draft. Consumers: every board layer. Effects: ring, chip, veil, outline, badges. Empty in History View except the being-decided outline and badges, and empty while `updatingVisibleState` is true.
- **Hover preview.** Producer: a hand piece's pointer hover or keyboard focus. Consumer: the board offer's preview ring. Lifetime: leave, blur or unmount. Never set by touch.
- **Card preview.** Producer: a press on a share card or town tile anywhere. Consumer: the preview layer, which reads its owner's current props. Lifetime: the next press, Escape or the owner unmounting.
- **Open seat.** Producer: a seat card's name, or a seat-strip chip on a phone. Lifetime: backdrop, Escape, close. Shows the displayed state, History View included.
- **Board focus** (phone). Producer: a board pick opening (frames the lit hexes), or the zoom control. Consumer: the scaling wrapper. A hand pan clears it; it never changes an offer.
- **In-flight pieces.** Producer: the state-change animators. Consumer: the flight layer. Lifetime: the running timeline, cleared on teardown and interruption. Never read for game meaning.

Silent restoration replaces the displayed state; every derived offer follows it without motion.

## Render ownership

- **Board surface.** One fixed surface, scaled by the shared scaling wrapper (`expandable`; `coverBelowScale` on phones). Layers in order: map image; town tiles; track pieces; this turn's outlines and badges; price markers; money markers; the sea (share decks, bag, tracker); the veil; the being-decided outline; lit rings; chips. Each layer draws only the board offer's result for what it owns. The veil is one path with holes at the lit hexes, drawn by the ring layer's owner, so no other layer dims itself.
- **Hit targets.** Each hex is a transparent hex polygon carrying its space id, above the pieces and below the chips, so a chip's overhang never blocks a press on its own hex. Chips take no press. A press on a lit hex sends; a press on any other hex places nothing and enlarges its town tile, if it has one. Price and money markers have no hit target.
- **Pieces and markers** sit in a centred outer wrapper for motion, with world placement on a separate node, so GSAP owns the wrapper's transform.
- **Flight layer.** A piece moving between the panel or a seat card and the board, and a share card moving between a deck and a seat card, cross the scaling wrapper. One flight layer, above the table layout and outside the wrapper (inside the full-screen dialog while it is open), draws the moving copy from the two elements' screen rectangles. While it flies, the source is hidden and the target not yet shown. It owns no game state.
- **Seat cards** sit outside the wrapper, in the left column on a desktop and nowhere else; on a phone the seat strip stands in. The open seat and the enlarged view are mounted after the table layout, outside the wrapper and scroll columns, padded by the safe-area insets.
- **Full screen** is the wrapper's modal dialog; while open, the action panel is drawn in its toolbar and the enlarged view inside it, each in one place at a time.
- **The Repairs row** is one component, read from the displayed state, in the panel and the waiting view alike.
- **Hidden things** are drawn by one piece component that takes a `faceShown` decision from the perspective rule.
- **Colour.** Amber means "yours to act on": lit ring, picked ring, the primary button, Undo, the deciding seat's ring. Rose means "costs or threatens": Repairs chips, "short $3". Railroad colours come from the palette and appear only on railroad things (pieces, price markers, tags). Seat colours come from `gameSession.colors` and appear only on seat things (seat headers, money markers, chips in the seat strip); the title's colour list avoids the railroad colours (O-1). Nothing else is amber or rose.

## Game log and history

Built from each Action's input and `metadata` only (`docs/DESIGN.md`, Actions). A seat's line is past tense after its name. Railroads appear as coloured tags (CP, UP, KP, SP), towns by kind ("a +2 town", "a Repairs town", "Promontory", "open country").

- **Grouping:** one entry per turn, growing as its Actions arrive: "revealed CP, UP, KP"; "bought a KP share for $5"; "placed UP on a Repairs town: bills Mara $2, Theo $8, Inez $6, Royce $6, all paid"; "placed KP on a −3 town: KP $5 → $2"; "placed CP at Promontory: CP $22 → $25 (capped)"; "placed SP on a Dividend town: Dividend pays Theo $6, Royce $8"; "ended the turn and drew 3". A Repairs payment adds a line for each short seat in the turn's entry: "Royce sold 1 SP at half price ($3) and paid $10", "Theo sold all 2 for $4, paid $5, $3 forgiven". While a short seat decides, the entry ends "Royce is selling…".
- **Actor-only lines:** a draw names the pieces to the drawer only ("drew CP, KP, SP"); others read "drew 3". A set-aside names the piece and the replacement for all, since the replacement joins the revealed hand (O-11).
- **Skipped:** `RevealHand` folds into the entry's first line; the Repairs bills paid inside `PlaceTrack` are part of the placement's line; bookkeeping is not shown.
- **Interstitials:** a round marker each time play returns to the starting seat (R-2.1, R-2.1-H1).
- **Jump** on each turn entry: shows the table as the turn ended. **Replay** on each turn entry, over its whole span: the reveal, the placements with their markers, payments and sales.
- **End of game:** the last entry is the score, read from the final state: each seat's money, shares at final prices and total, the winner or winners, and why the game ended.

## Animation plan

The game-session state-change animators and the shared `AnimationContext` own all motion caused by a committed transition. Each handles both modes: with an `action`, cinematic motion; without one (undo, history navigation), a direct `from → to` interpolation at or below 200 ms. Silent restoration has no motion.

| Animator      | Live motion (with action)                                                                                                                                                               | Triggered by                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Hand          | the deciding seat's grey discs turn to railroad colours in its seat card and the panel; a draw flies discs from the bag to the drawer's seat card (faces to the drawer, grey to others) | `RevealHand`, `EndTurn`, `ScrapTrack`                                                |
| Track pieces  | the piece flies from the panel (the deciding seat) or the seat card (others) to its hex through the flight layer and settles; a set-aside piece fades out of the hand                   | `PlaceTrack`, `ScrapTrack`                                                           |
| Price markers | the marker steps space by space along the track; at a limit it bumps once and stops                                                                                                     | `PlaceTrack` (price towns, Promontory)                                               |
| Money         | each seat's money marker steps along the border track, forward through 99 to 0 when it wraps; a "+$4" or "−$6" chip rises from its seat card's money                                    | `BuyShare`, `SellShare`, `PlaceTrack` (Dividend, Repairs paid at once), `PayRepairs` |
| Share cards   | a bought card flies from its deck in the sea to the seat card's stack; a sold card flies back; counts change on landing                                                                 | `BuyShare`, `SellShare`, `PayRepairs`                                                |
| Town tile     | on landing, a Dividend or Repairs tile pulses once under the piece                                                                                                                      | `PlaceTrack`                                                                         |

- An Action's effects, and the System Action that follows it, play in sequence on one timeline, each tween at an explicit position: a `PlaceTrack` lands, then its town's marker or money moves; an `EndTurn` draws, then `RevealHand` turns the next seat's hand face up.
- Interaction is gated while `updatingVisibleState` is true.
- Replay plays an entry's whole span, contiguous System Actions included.
- Local motion only: hover feedback, the amber ring's appearance, the deciding seat's pulse. The players column keeps seat order and never reorders, so no `animate:flip` is used. The score rows are sorted once and do not animate.

## Phone layout

Target: 390 × 844, held upright. Budget, top to bottom:

| Region           | Height                     | Notes                                              |
| ---------------- | -------------------------- | -------------------------------------------------- |
| History controls | ~36 px                     | `mobileControlsContent`                            |
| Turn header      | 30 px                      | compacted under `max-sm:`                          |
| Status strip     | 30 px                      | O-4                                                |
| Action area      | at most 36 % of the column | short prompts, wrapping button rows, 44 px targets |
| Board            | the rest, ~430 px          | scaling wrapper, `coverBelowScale`                 |
| Seat strip       | 50 px                      | one chip per seat                                  |

- **Board.** The map is about 1.55:1. Fitted to 390 px a hex would be 20 px wide. The board rests fitted to the hex field's width (about 30 px a hex), the price track and sea off to the left; a pan reaches them.
- **Pick framing.** When a piece is picked, the board frames its lit hexes (up to 2×, a lit hex about 45 px at most framings). This is the one place a choice moves the focus. A hand pan clears it.
- **Status strip** (O-4): one line drawn from data: the four prices with their railroad colours, the bag count, the red towns open.
- **Action area.** The hand as 34 px pieces with labels; the share block as four entries in two columns, each with Buy and Sell at 44 px; the Repairs panel as one button per railroad held in two columns, then the running line and the send on one row; the score as a four-column table (seat, money, shares, total), the per-railroad breakdown in the open seat.
- **Seat strip.** Each chip shows the seat colour, money and name. The deciding seat's chip carries the amber ring; during Repairs the seat whose turn it is carries the dashed outline. A press opens that seat card as a bottom sheet, up to 85 % of the dynamic viewport.
- **Full screen** keeps play going: the action panel in the toolbar.
- No hover anywhere; every hover effect has a press path or is not needed.

## Design choices

- **O-1 Seat colours.** The title's colour list is green, orange, black, white (then pink, brown), never blue, purple, red or yellow, so a seat is never mistaken for a railroad. _Alternative:_ the site's usual list, railroad colours included.
- **O-2 Placing.** Piece first in the panel, then a lit hex on the board; a lone railroad in hand is auto-picked. _Alternative:_ light every hex any hand piece reaches and ask which piece after the hex.
- **O-3 Effect chips.** Lit Dividend and Repairs towns carry the deciding seat's own payout or bill; price towns carry none. _Alternative:_ no chips.
- **O-4 Phone status strip.** Yes: prices, bag and red towns open in one line. _Alternative:_ none; pan to the track.
- **O-5 Rails.** Decided: no rails between hexes; each piece is the round token alone.
- **O-6 Number tiles upright.** The supplied +/− tiles print the number sideways; the board turns them a quarter turn. _Alternative:_ as supplied.
- **O-7 Backs.** The tile back and the share back are not used or shipped: tiles are always face up (R-1.3) and the decks are face up (R-1.3). _Alternative:_ the tile back as the concealed hand piece.
- **O-8 Decks, bag and tracker in the sea.** Decks, bag and end tracker in the open sea right of the price track, inside the board. _Alternative:_ a strip above the board.
- **O-9 Share worth.** Each seat card shows its shares' value at today's prices. _Alternative:_ counts and prices only.
- **O-10 Seat motif.** The brokerage ledger: a tan card ruled twice with the seat colour as its header. _Alternative:_ a plain card in the seat colour.
- **O-11 Replacement piece.** A replacement drawn after a set-aside joins the revealed hand face up for all, since it must be placed this turn (R-3.3-H1). _Alternative:_ shown only to its drawer until placed. Settled in `visibility.md`.

## Verification scenarios

Each gives the start, the input, the result, the result after Undo or exit, and how it is checked. "Auto" is a component or browser test; "Manual" is a person at desktop and phone width.

**The turn**

1. **Reveal.** Start: the previous seat ends its turn. The next seat's hand turns face up in its seat card and panel for all; the header names it. Others' hands stay "?". No Undo across it. Auto.
2. **Buy.** Before placing, press Buy on a $5 railroad: money −5, holding +1, deck −1, "1 action left". Undo restores all three. Auto.
3. **Buy dimmed.** A railroad with an empty deck shows Buy dimmed with "none left"; a price above the seat's money shows "you have $3". A press does nothing but show the reason. Auto.
4. **Sell at 0.** Sell a share at price 0: money unchanged, holding −1, deck +1, one action used (R-3.2-H1). Auto.
5. **Two actions.** After two share actions, every Buy and Sell is dimmed with "no share actions left"; after the third placement they stay dimmed. Auto.
6. **Pick and place.** Press a hand piece: its legal hexes light, the board dims, chips show on Dividend and Repairs towns. Press it again: unpicked, nothing lit. Pick, press a lit hex: the piece lands, its town resolves, the badge "1" appears. Undo: the piece returns to hand and the town's effect reverses; a second Undo returns nothing (the pick was undone with the action). Auto.
7. **Unlit hex.** With a piece picked, press an unlit hex: nothing is placed; on a town tile it enlarges the tile. Auto.
8. **Auto-pick.** With two KP pieces left, the panel opens with KP picked (auto); Undo goes straight to the last placement. Auto.
9. **Shares locked between placements.** After the first placement the share block is locked with its note; after the third it unlocks with the actions left. Auto.
10. **Price town and cap.** Place on a +3 town with the railroad at 24: the marker steps to 25 and bumps; the log reads "capped". Place on a −2 town with the railroad on the fourth 0: it stops on the fifth 0. Auto.
11. **Promontory.** Place on Promontory: price +5; the end tracker reads "Promontory taken ✓". Auto.
12. **Dividend.** Place on a Dividend town: every holder's money rises by 2 per share, markers step, chips rise; the log names each payment. Undo reverses all. Auto.
13. **No room.** A hand piece with no legal hex shows "no room"; picking it offers only "Set aside · draw a replacement · can't be undone". Send: the piece leaves, a replacement joins the revealed hand for all, Undo is hidden. With the bag empty the button reads "Set aside · bag empty" and the turn needs one placement fewer. Auto.
14. **End turn.** After three placements, "End turn · draw 3" sends: three pieces fly to the seat card (colours to the drawer, "?" to others); the log reads "drew 3" to others and names them to the drawer; no Undo. Auto.
15. **Four-piece variant.** With the option on, the hand holds four; after three placements the panel shows "Keep ‹rr› · draw 3" and "Return it · draw 4"; each draws the right count. With no piece left over it shows "End turn · draw 4". Auto.

**Repairs**

16. **No one short.** Place on a Repairs town where every holder can pay: all pay at once, the row flashes "paid" for each, play goes on with no stop. Undo reverses the placement and every payment. Auto.
17. **One short seat out of turn.** Mara places SP on a Repairs town; Royce owes $10 with $7. Royce's header reads "Your turn", his card the "repairs" tag, his panel lists his shares at half price. Mara's and the others' headers read "Royce's turn", their waiting view the Repairs row with Royce's dashed chip. Auto.
18. **Staging and the stop.** Royce presses Sell one on SP: the running line reads "$7 + $3 = $10 · enough", every other Sell locks, the button reads "Sell 1 SP share · pay $10", the note says the bill stays $10 (R-4.3-H1). Undo pops the SP pick and unlocks the rows. Send: SP flies to its deck, Royce's money reaches $0, Mara's turn continues. Auto.
19. **Two short seats.** Two seats are short: the placing seat (if short) then seat order (R-4.3-H4). The second waits with "waiting" in the row and no panel until the first sends. Auto.
20. **Short after everything.** A seat whose shares at half price cannot cover the bill sees one press staging all of them and "Sell all 4 · pay $5 · $5 forgiven"; a seat with no shares sees "Pay $3 · $5 forgiven". Money ends at 0 and it stays in the game (R-4.3-H3). Auto.
21. **Placer's Undo during Repairs.** While Royce stages a sale, Mara presses Undo: the placement and the Repairs step reverse; Royce's panel closes and his staged sales are gone. Auto.
22. **Sealed staging.** While Royce stages, no other seat sees which shares; after the send the log names them. Auto.

**Board, panels and history**

23. **Money wrap.** A seat passing 99 moves forward through 0 and shows "+100" beside its marker; its seat card shows the true amount. Auto.
24. **Shared spaces.** Two seats on one money space sit side by side; four as a 2×2 grid. Two railroads at one price sit in their fixed slots. Manual.
25. **Red tiles stay readable.** A covered Dividend or Repairs town shows its red border around the piece; the end tracker's count matches the uncovered red towns on the board. Manual.
26. **Enlarge.** Press a share stack in a seat card: the share card enlarges; the next press closes it and does nothing else. Same for a deck in the sea and a town tile. Escape closes it. Auto.
27. **Open seat.** Press a seat's name: the seat opens over the table; Escape closes it; a share inside enlarges above it. Auto.
28. **History.** Each turn is one entry growing line by line, with round markers. Jump on a turn shows the table as it ended; Replay plays its placements and payments and returns. History View shows no panel, no lit hex, and keeps the Repairs row and outline. Auto.
29. **Game end.** A turn ends with one red town open and Promontory taken: the header reads "End of game", the score lists money, shares × final prices and totals, the winner in amber; a tie names both (R-6.2-H1). The bag running out ends it the same way (R-6.1-H2). Auto.
30. **Undo walk.** A turn with a buy, two placements and a picked piece: Undo unpicks the piece, then undoes the second placement, the first, the buy; after the end-turn draw Undo is hidden. Auto.
31. **Interruption.** Press a lit hex and, during the flight, step backward in history: the motion stops at once, the displayed state is the earlier one, no piece is left in flight. Auto.
32. **Phone pick framing.** On a 390 px phone, picking a piece frames its lit hexes; a hand pan clears the framing; the status strip and seat strip stay in place; every panel button is at least 44 px tall. Manual.
33. **Full screen.** Press F: the board fills the screen with the action panel in the toolbar; placing and Repairs work there; Escape leaves. Manual.

## Exercise record

To be filled when the scenarios are run: each number with "automated" (and the spec) or "checked" (and who, at which widths).
