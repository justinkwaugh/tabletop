# Railheads UI interaction visual contract

## Visual intents

- **Choose an action.** On the acting player's Choosing Action turn, the action spaces they can afford and take are highlighted in the strip above the board and clickable. Each space carries a gold corner bubble with what choosing it costs now and, when coins wait on it, a dark corner bubble with their number. A space holding coins also offers "Consolidate" ("Take" on phones). On phones the action panel lists every space's rules, since the tiles show only short names.
- **Round ending.** The Round Timer's coin turns red while the choosing player can take a space whose cost equals the coins left, the choice that ends the round.
- **Choose a company.** In Lay Track and Issue Share, the companies the player may pick are highlighted with a dashed gold border on their charters and offered in the action panel as share certificates, so the choice works when the charters are out of view. Charters sit in the Investors tab below 1280px wide and in a right-hand pane from 1280px. A lone option is chosen automatically and nothing is highlighted.
- **Stage track.** Hexes where the building company may lay its next disc or crossing cube get a dashed burgundy ring over a pale wash and a price tag. Clicking one adds a dashed ghost piece and refreshes the rings. The board, treasuries, revenues and payouts show the staged build as if it were laid; the action panel offers "Lay N pieces · $X", or "Lay no track". The company's treasury limits what stays ringed.
- **Off the Rails.** Picking an Industry Site opens a two-button card beside it: industry +1 with revenue gain, or industry +2 with none. The site stays outlined until a choice is made.
- **Open auctions.** Share auctions show a seat card per bidder in bidding order with a wide player-colour stripe and the latest bid. The current bidder's card lifts and shows "?"; a bidder who passed is faded under a PASSED stamp. The bid is typed or stepped by $1 within what the bidder may bid.
- **Sealed bids.** In an industry auction every seat shows "…" until it has bid, then a check. A player sees their own submitted amount; others see only the check. When the last bid is in, the history shows every amount and the price.

## Coexistence and precedence

Only one of these intents is live at a time, because each belongs to one machine state. The shared scaling wrapper's zoom and full-screen controls change only the view, so staged selections survive them.

## Shared visual state

The session owns the staged track selection (companies, pieces, a pending Off the Rails site) and the chosen share to issue. The map, charters and action panel only read them. The session also derives `roundEndingChoiceAvailable` from the game state for the Round Timer coin; it holds no transient state.

- **Lifetime:** every staged selection clears in `beforeNewState`. Undo pops the most recent manual stage first; an automatic company choice is never popped.
- **Validity:** a stored company applies only while it is among the current options and the owning machine state is active. The auto-selected company is judged against the game as it stands before staging, so spending the last of a treasury does not drop the choice. History View shows no targets because `canAct` is false there.

## Render ownership

The map layer draws hexes and names beneath the track layer (discs and cubes; stacks on sites fan left and right and sit above the site's value), which sits beneath the target rings, which sit beneath the Off the Rails card. Nothing above the revenue track takes clicks except rings and the card. The board uses no SVG or CSS filters and no endless animations.

## Verification scenarios

- In Lay Track III with two held companies, click a charter then a ringed hex: a ghost disc appears and Undo removes it. A second Undo clears the company; a third undoes the action.
- With a $5 treasury, stage discs on $2 hexes: after two, no rings remain.
- In Industry Investment as the investor, "Bid $0" is absent; as another player it places a sealed zero.
