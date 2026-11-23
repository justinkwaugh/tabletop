# Locomotive Werks UI interaction visual contract

The board is drawn at the game column's width as two SVGs: a banner holding the column labels, which stays frozen at the top, over one row per locomotive, which scroll beneath it. Each row holds its Existing Orders dice, its generation numeral on a block of the kind's colour, its supply card count, its purchase, upgrade and income costs, its Initial Orders box, a plaque for each player's werk in that player's seat column, and its Customer Base: one box holding the dice as a stack, with a count beside it once it holds two or more.

Players act on the board. On their turn the rows they can act on are targets: each takes a press anywhere along its width, so a target is easy to hit on a phone, and a gold ring marks what the press acts on. Follow-up choices open in a picker beside the selection. The action panel carries the prompt and the choices with no place on the board: Develop nothing, the automatic shipping checkbox, Done buying, Ship and Hold everything. It opens with the round's sequence of play (Development, Production Capacity or Capacity & First Shipment under Buy and Ship, Production, Taxes, Market Demands) with the phase in progress filled in, and, in Production, its selling round after the first. When a round ends, each viewer steps through it in the live game: the track shows the ended round with Production, then Taxes, then Market Demands filled in, and the panel shows what each player shipped, then the taxes, cash and new Player Order, then each locomotive's Market Demands change and rolls. A Next button moves on, the last one leads into the new round, and Skip goes straight there. The game does not wait for anyone: whoever acts next may act at once, and their own controls follow their review.

With the colour-blind setting, a title preference, every kind colour comes from the Okabe–Ito palette and each kind's shape appears in the board's side stripes, the player panels' bars and the locomotive badges.

## Visual intents

### Develop choice

- **Trigger:** the viewing player is acting in Locomotive Development.
- **Emphasized:** each row the player may develop and afford gets a gold ring around its numeral, cards, costs and Initial Orders box. Pressing the row fills the ring and opens a picker beneath it with the locomotive's badge and a Develop button priced at its purchase cost, since a development that rolls a die cannot be undone. Pressing another row moves the choice there. Develop nothing, in the action panel, passes.
- **Unaffected:** rows the player cannot develop or afford, and the werk plaques.

### Werk picker

- **Trigger:** the viewing player is acting in Production Capacity.
- **Emphasized:** each of the player's werk plaques gets a gold ring and shows its units as they will be once the plan is made, with `was N` beneath while that differs; a werk planned down to none fades. Pressing a werk's row fills its ring and opens a picker beneath the plaque with a +1 unit button and an Upgrade button per newer werk the player owns, each priced for one unit, and the cash left to spend. A press plans one unit and buys nothing, and the picker stays open for the next. Buttons the planned cash or units cannot cover are disabled. The prompt shows the planned spending and the cash left. Below it, an unticked checkbox reads Ship everything automatically this round. Done buying, labelled with the planned spending, submits the plan in the order it was made, with that choice, as one action that ends the turn. A player who ticked it is not asked in their selling turns; their player card reads Shipping everything automatically until Production ends, and History lists each such shipment as auto-shipped in their turn.
- **Unaffected:** other players' plaques and the rest of each row.

### Shipping choice

- **Trigger:** the viewing player is acting in a selling turn.
- **Emphasized:** each werk that can ship gets a gold ring with its income (`+$N`) beneath its units, and a gold ring marks the order die the shipment fills or lowers. Pressing the row holds the shipment back: the plaque's ring turns dashed and unfilled, its units fade, it reads held, and the die's ring goes. Pressing again ships it. The Ship button in the action panel shows the income of the rest and sends them; Hold everything sends none.
- **Unaffected:** plaques without orders and other players' plaques.

### Shipment dice

- **Trigger:** a Ship action, live or replayed, including one made automatically.
- **Emphasized:** a reduced order die flips closed and open on its new face; a matched or exceeded die slides along its row into the Customer Base, over the rest of the row. About a third of a second, and nothing else on the board moves.
- **Undo and history steps without their action:** the same motion within 200ms; stepping back slides the die out of the Customer Base or opens the restored face.

## Coexistence and precedence

The three choices belong to three machine states, so at most one is active, and each row has at most one target. History View and other players' turns show none, because each derives from the session's `canAct`.

## Shared visual state

### Chosen locomotive

- **Meaning:** the locomotive the player is about to develop.
- **Producer:** a press on a developable row; a press on another row replaces it.
- **Consumers:** the row's filled ring and the develop picker.
- **Lifetime:** one manual stage: Undo, a press outside the picker, or scrolling the board closes it; Develop submits it, and the new Game State clears it.
- **Validity:** applies only while the player is acting in Locomotive Development and can still develop that locomotive.

### Capacity plan

- **Meaning:** the units the player means to add or upgrade this turn.
- **Producer:** the werk picker's +1 unit and Upgrade buttons; each press is one stacked step.
- **Consumers:** the plaques' units, the picker's buttons and cash, the prompt's planned spending, and the Done buying label.
- **Lifetime:** Undo takes back one press at a time; Done buying submits it, and the new Game State clears it.
- **Validity:** applies only while the player is acting in Production Capacity.

### Automatic shipping choice

- **Meaning:** whether Done buying asks for this Production phase's selling turns to be taken automatically.
- **Producer:** the checkbox in the action panel.
- **Consumers:** Done buying.
- **Lifetime:** part of the capacity plan's staged selection, so each tick or untick is one press that Undo takes back in turn with the planned steps. Done buying submits it, and the new Game State clears it.
- **Validity:** applies only while the player is acting in Production Capacity.

### Open werk

- **Meaning:** the werk whose picker is open.
- **Producer:** a press on one of the player's werk rows, as a manual stage after the capacity plan. A step planned in the picker keeps it open as an automatic selection.
- **Consumers:** the plaque's filled ring and the werk picker.
- **Lifetime:** Undo closes a picker opened since the last step; otherwise Undo takes back the last step and closes the picker with it. A press outside the picker, scrolling the board, or a change to the automatic shipping choice closes it. The new Game State clears it.
- **Validity:** applies only while the player is acting in Production Capacity and owns the werk.

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
- **Producer:** a press on a shipping werk's row, which toggles it; each press is one stacked step.
- **Consumers:** the plaque marks, the order die rings and the Ship button.
- **Lifetime:** Undo takes back one press at a time before any action; it clears whenever a new Game State is published.
- **Validity:** applies only while the player is acting in a selling turn; entries without orders are ignored.
