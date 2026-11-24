# Locomotive Werks UI interaction visual contract

The board is drawn at the game column's width as two SVGs: a banner holding the column labels, which stays frozen at the top, over one row per locomotive, which scroll beneath it. Each row holds its Existing Orders dice, its generation numeral on a block of the kind's colour, its supply card count, its purchase, upgrade and income costs, its Initial Orders box, a plaque for each player's werk in that player's seat column, and its Customer Base: one box holding the dice as a stack, with a count beside it once it holds two or more.

Players act in the action panel. Each choice is a list there: the locomotives to develop, the werks to expand, the werks to sell from. The board mirrors the choice being made, with gold rings on what the panel's choices act on, but takes no press. The action panel carries the prompt, those lists, and the buttons that end the turn: Develop, Develop nothing, Done buying, Sell and Hold everything, with the automatic selling checkboxes. It opens with the round's sequence of play (Development, Production Capacity or Capacity & First Sale under Buy and Ship, Production, Taxes, Market Demands) with the phase in progress filled in, and, in Production, its selling round after the first. When a round ends, each viewer steps through it in the live game: the track shows the ended round with Production, then Taxes, then Market Demands filled in, and the panel shows what each player sold, then the taxes, cash and new Player Order, then each locomotive's Market Demands change and rolls. A Next button moves on, the last one leads into the new round, and Skip goes straight there. The game does not wait for anyone: whoever acts next may act at once, and their own controls follow their review.

With the colour-blind setting, a title preference, every kind colour comes from the Okabe–Ito palette and each kind's shape appears in the board's side stripes, the player panels' bars and the locomotive badges.

## Visual intents

### Develop choice

- **Trigger:** the viewing player is acting in Locomotive Development.
- **Emphasized:** the action panel shows a button for each locomotive the player may develop and afford, with its badge and purchase cost. Pressing one fills it in gold and shows a Develop button priced at its purchase cost, with a note that it cannot be undone, since a development rolls a die. Pressing another moves the choice there; pressing the chosen one again clears it. Develop nothing passes. On the board each of those rows gets a gold ring around its numeral, cards, costs and Initial Orders box, and the chosen row's ring fills.
- **Unaffected:** rows the player cannot develop or afford, and the werk plaques.

### Capacity planner

- **Trigger:** the viewing player is acting in Production Capacity.
- **Emphasized:** the action panel lists the player's werks, one line each, in board order: the locomotive's badge, its units as they will be once the plan is made, with `was N` beside them while that differs, a +1 button and an upgrade button (`→` and the newer werk's badge) per newer werk the player owns, each priced for one unit. A werk planned down to none fades. A press plans one unit and buys nothing. Buttons the planned cash or units cannot cover are disabled. On the board the player's plaques show the same planned units and `was N`, and fade the same way, but are not targets. The prompt shows the planned spending and the cash left. Below it, an unticked checkbox reads Sell everything automatically this round. Done buying, labelled with the planned spending, submits the plan in the order it was made, with that choice, as one action that ends the turn. A player who ticked it is not asked in their selling turns; their player card reads Selling everything automatically until Production ends, and History lists each such sale as auto-sold in their turn.
- **Unaffected:** other players' plaques and the rest of each row; the board's rows take no press.

### Selling choice

- **Trigger:** the viewing player is acting in a selling turn.
- **Emphasized:** the action panel lists each werk that can sell, one line each: the locomotive's badge, the units it sells and what that does to its order die (`3 → 1` or `fills the 3`), and a gold Selling · +$N toggle. Pressing the toggle holds the sale back: it turns dashed and reads Held, and the line fades. Pressing again sells it. On the board each werk that can sell gets a gold ring with its income (`+$N`) beneath its units, and a gold ring marks the order die the sale fills or lowers; a held werk's ring turns dashed and unfilled, its units fade, it reads held, and the die's ring goes. Below the list, an unticked checkbox reads Sell everything automatically for the rest of this Production. The Sell button shows the income of the sales not held back and sends them, with that choice; Hold everything sends none, also with that choice. A player who ticked it is not asked again until Production ends, as with the capacity checkbox.
- **Unaffected:** plaques without orders and other players' plaques.

### Shipment dice

- **Trigger:** a Ship action, live or replayed, including one made automatically.
- **Emphasized:** a reduced order die flips closed and open on its new face; a matched or exceeded die slides along its row into the Customer Base, over the rest of the row. About a third of a second, and nothing else on the board moves.
- **Undo and history steps without their action:** the same motion within 200ms; stepping back slides the die out of the Customer Base or opens the restored face.

## Coexistence and precedence

The three choices belong to three machine states, so at most one is active and the board mirrors at most one. History View and other players' turns show none, because each derives from the session's `canAct`.

## Shared visual state

### Chosen locomotive

- **Meaning:** the locomotive the player is about to develop.
- **Producer:** a press on one of the action panel's develop buttons; a press on another replaces it, and a press on the chosen one clears it.
- **Consumers:** the pressed button, the Develop button and its note, and the board row's filled ring.
- **Lifetime:** one manual stage: Undo clears it; Develop submits it, and the new Game State clears it.
- **Validity:** applies only while the player is acting in Locomotive Development and can still develop that locomotive.

### Capacity plan

- **Meaning:** the units the player means to add or upgrade this turn.
- **Producer:** the capacity planner's +1 and upgrade buttons; each press is one stacked step.
- **Consumers:** the plaques' units, the planner's units and buttons, the prompt's planned spending, and the Done buying label.
- **Lifetime:** Undo takes back one press at a time; Done buying submits it, and the new Game State clears it.
- **Validity:** applies only while the player is acting in Production Capacity.

### Automatic selling choice

- **Meaning:** whether Done buying asks for this Production phase's selling turns to be taken automatically.
- **Producer:** the checkbox in the action panel.
- **Consumers:** Done buying.
- **Lifetime:** part of the capacity plan's staged selection, so each tick or untick is one press that Undo takes back in turn with the planned steps. Done buying submits it, and the new Game State clears it.
- **Validity:** applies only while the player is acting in Production Capacity.

### Round review

- **Meaning:** how far the viewer has stepped through the last ended round.
- **Producer:** the review's Next and Skip buttons.
- **Consumers:** the phase track and the review; the action controls and waiting view show once it is finished. The waiting view leaves out the taxes and market, which belong to the review.
- **Lifetime:** keyed to the round's Market Demands action, so a new round's end starts a new review at Production; it is not saved, so a reload shows the latest review again.
- **Validity:** the live game only; History View and a finished game show none.

### Board step

- **Meaning:** the state the board draws while a shipment animates, which may run ahead of the shown Game State during a replay of several actions.
- **Producer:** the shipment dice animator, which sets it to the shipment's from-state, then to its to-state as the dice land, and only while the Game State it began under is still shown, so a view switch mid-animation keeps its own board.
- **Consumers:** the board's rows and werk plaques.
- **Lifetime:** cleared whenever a new Game State is shown.
- **Validity:** only while a transition animates.

### Held sales and automatic selling in a selling turn

- **Meaning:** the locomotives the player keeps back this selling turn, and whether their later selling turns this Production phase are taken for them.
- **Producer:** the sale list's toggles and the checkbox beneath it; each press is one stacked step in one staged selection.
- **Consumers:** the toggles and lines, the checkbox, the plaque marks, the order die rings, and the Sell and Hold everything buttons.
- **Lifetime:** Undo takes back one press at a time, holds and ticks alike, before any action; it clears whenever a new Game State is published.
- **Validity:** applies only while the player is acting in a selling turn; entries without orders are ignored.
