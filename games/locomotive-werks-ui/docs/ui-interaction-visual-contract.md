# Locomotive Werks UI interaction visual contract

The board is drawn at the game column's width as two SVGs: a banner holding the column labels, which stays frozen at the top, over one row per locomotive, which scroll beneath it. Each row holds its Existing Orders dice, its generation numeral on a block of the kind's colour, its supply card count, its purchase, upgrade and income costs, its Initial Orders box, a plaque for each player's werk in that player's seat column, and its Customer Base: one box holding the dice as a stack, with a count beside it once it holds two or more.

The board only shows the game. Players act in the action panel, which opens with the round's sequence of play (Development, Production Capacity or Capacity & First Shipment under Lucas Order, Production, Taxes, Market Demands) with the phase in progress filled in, and, in Production, its selling round after the first. When a round ends, each viewer steps through it in the live game: the track shows the ended round with Production, then Taxes, then Market Demands filled in, and the panel shows what each player shipped, then the taxes, cash and new Player Order, then each locomotive's Market Demands change and rolls. A Next button moves on, the last one leads into the new round, and Skip goes straight there. The game does not wait for anyone: whoever acts next may act at once, and their own controls follow their review.

With the colour-blind setting, a title preference, every kind colour comes from the Okabe–Ito palette and each kind's shape appears in the board's side stripes, the player panels' bars and the locomotive badges.

## Visual intents

### Develop choice

- **Trigger:** the viewing player is acting in Locomotive Development.
- **Emphasized:** the action panel offers a button per locomotive the player may develop, showing its badge and purchase price; those they cannot afford are disabled. Pressing one develops it at once. Develop nothing passes.
- **Unaffected:** the board.

### Capacity table

- **Trigger:** the viewing player is acting in Production Capacity.
- **Emphasized:** the action panel shows a table of the player's werks: each werk's units, an Add button and an Upgrade button per newer werk the player owns, each priced for one unit. A press plans one unit and buys nothing: the table shows each werk's units as they will be (`1 → 2`, in amber), a werk planned down to none is struck through, and the prompt shows the planned spending and the cash left. Buttons the planned cash or units cannot cover are disabled. Below the table, an unticked checkbox reads Ship everything automatically this round. Done buying, labelled with the planned spending, submits the plan in the order it was made, with that choice, as one action that ends the turn. A player who ticked it is not asked in their selling turns; their player card reads Shipping everything automatically until Production ends, and History lists each such shipment as auto-shipped in their turn.
- **Unaffected:** the board.

### Shipping table

- **Trigger:** the viewing player is acting in a selling turn.
- **Emphasized:** the action panel shows a table of each werk that can ship: the units that go, the order die they fill or reduce, the income and a Hold button, which becomes Ship once held; a total row sums the income. A held row reads Holding, and its plaque on the board gets a dashed muted ring and faded units. Ship sends the rest.
- **Unaffected:** plaques without orders and other players' plaques.

### Shipment dice

- **Trigger:** a Ship action, live or replayed, including one made automatically.
- **Emphasized:** a reduced order die flips closed and open on its new face; a matched or exceeded die slides along its row into the Customer Base, over the rest of the row. About a third of a second, and nothing else on the board moves.
- **Undo and history steps without their action:** the same motion within 200ms; stepping back slides the die out of the Customer Base or opens the restored face.

## Coexistence and precedence

The three intents belong to three machine states, so at most one is active. History View and other players' turns show none, because each derives from the session's `canAct`.

## Shared visual state

### Capacity plan

- **Meaning:** the units the player means to add or upgrade this turn.
- **Producer:** the Add and Upgrade buttons in the capacity table; each press is one stacked step.
- **Consumers:** the table's units and buttons, the prompt's planned spending, and the Done buying label.
- **Lifetime:** Undo takes back one press at a time; Done buying submits it, and the new Game State clears it.
- **Validity:** applies only while the player is acting in Production Capacity.

### Automatic shipping choice

- **Meaning:** whether Done buying asks for this Production phase's selling turns to be taken automatically.
- **Producer:** the checkbox under the capacity table.
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

### Held shipments

- **Meaning:** the locomotives the player keeps back this selling turn.
- **Producer:** the Hold and Ship buttons in the shipping table; each press is one stacked step.
- **Consumers:** the plaque marks and the shipping table's rows, total and Ship button.
- **Lifetime:** Undo takes back one press at a time before any action; it clears whenever a new Game State is published.
- **Validity:** applies only while the player is acting in a selling turn; entries without orders are ignored.
