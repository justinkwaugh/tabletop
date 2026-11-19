# 18RoyalGorge table interaction and visual contract

18RoyalGorge renders the shared 18xx table through `SessionRoyalGorge`, a specialization of the
shared 18xx session. Shared modules own the selection auction, stock trading, tile and station
staging, routes, payouts, train purchases, history and the single contextual Undo; their behaviour
is recorded in the [18xx-ui contract](../../../libs/18xx-ui/ui-interaction-visual-contract.md).
This contract covers what 18RoyalGorge adds. The map is the generic presentation.

## Visual intents

- **Steel choice.** In the operating railroad's track step, the board panel's CF&I steel market
  outlines the column each colour's next steel comes from. The railroad's token marks it only once
  the column is chosen or fixed by a lay; the default, cheapest column is outlined without one.
  Columns it may still choose for a colour are buttons; pressing one is one Action (ChooseSteel).
  Other players see the marks but no buttons. The action area reads "Steel:" with one price badge
  per colour it may lay, in the colour's tile colour, and below it the hint to change columns on
  CF&I's market while a choice is left.
- **Steel Depot.** While its railroad holds the Steel Depot, the action area adds a switch, "Free
  yellow steel from the Steel Depot", beside a note of the steel the card has left and how much
  more it may give this turn; the switch is one ChooseSteel Action, and disabled once two have been
  used this turn.
- **Train extension.** While the Track Engineer, Coal Creek or the Coal Depot may lengthen a train,
  the action area asks "Add one stop to a train" (or two, for two cubes) with one button per
  eligible train, showing only its badge centred. Each lengthened train is listed below with its
  route colour and "+N stops".
- **Hanging Bridge Lease.** Before its railroad runs after the Treaty of Boston, the action area
  asks whether to use the lease, as one Action (UseBridgeLease); once used, a note says so for the
  rest of the run. After the payout, while trains ran through the gorge, the action area asks for
  Rio Grande's 10% of them, with a button for the treasury and one for the president, each paying
  the whole amount (PayBridgeLease); no other Action is offered until it is paid.
- **Discounted metal shares.** In a stock round, while the player's Metals Investor or U.S. Mint
  Worker offers a CF&I or VGC purchase, the stock menu adds a "Discount" entry. Opening it
  replaces the action area with one prompt per private: the Metals Investor's buys a share a space
  below its price, held until the next stock round; the Mint Worker's closes the private to buy
  VGC at half price. Each button names the shares and the price, with the market price in its
  tooltip, and is one Action (BuyMetalShares).
- **Debt repayment.** While a railroad may repay a debt, the action area shows its token, "owes N
  debts:" and a "Repay one for $X" button (PayDebt).
- **Brown gorge.** The brown gorge is one piece across the gorge's three hexes. Hovering any of
  them outlines all three, and the tile picker and the lay preview draw the brown gorge whole
  across them.
- **Gold shipping.** While the operating railroad may ship gold, the map masks every hex but the
  mines its run used, which stay pickable; the action area only prompts. Without the 13lb Gold
  Nugget a pick ships at once (one Action). With it, a pick opens a follow-up beside the hex
  offering +$50 or the Nugget's +$130; that pick is a manual local selection, so Undo closes the
  follow-up before undoing any Action.
- **Ghost town.** When the Ghost Town Tour Co.'s railroad empties a mine, that one hex stays
  unmasked and pickable, and the action area offers the same placement as a button.
- **Map markers.** Untiled mines, gold cubes, ghost towns and the St. Cloud Hotel (while a railroad
  owns it) are tokens placed in a clear corner of their hex, never over track or stops. They follow
  the displayed state, so History View shows them as they stood.
- **Debt marker.** A red DEBT tab hangs below the stock market row under the debt marker's
  space, clear of the companies' tokens. It shows from setup until the Treaty of Boston, then while
  any debts are owed, and steps to its new space when the new state is shown, without animation.

## Coexistence and precedence

- Gold shipping and the ghost town are never offered together: the ghost town follows the
  shipment that emptied the mine, and a railroad ships once a turn. Gold shipping wins in
  `mapLocationChoice` if both were ever open; either replaces the family's location choices.
- The action area shows the selection auction first, then the open Discount panel, then the
  title's prompts above the shared operating actions; the Discount panel hides the latter two.
- Steel choice happens only in the track step and gold only after the run, so the steel buttons
  and the gold mask never overlap.
- The bridge lease choice comes before the run and its payment after the payout, so neither
  shows with the gold prompt; the payment blocks every other Action while it is owed.

## Shared visual state

- **Chosen gold** (`goldChoice`, a single-choice staged selection registered first with
  `localSelections`). Meaning: the mine whose shipment awaits the Nugget choice. Producer: a map
  pick while the Nugget is available. Consumers: the map follow-up. Lifetime: cleared by Undo, by
  the follow-up's cancel, and on every published state (the session keeps no selections across
  transitions). Validity: read through `chosenGold`, which drops a mine no longer shippable.
  History View shows no follow-up, since `shippableGold` is empty there.

## Verification scenarios

- _Steel choice_ (manual, scenario "Steel choice"): press green column F on the board panel; F is
  outlined with RG's token and the green badge on the Steel line reads $20. Undo restores E.
- _Gold shipping_ (manual, scenario "Gold shipping"): every hex but Buena Vista is masked; picking
  it ships, the payout rises from $80 to $130 and one gold cube stays on the hex. Undo returns the
  cube.
- _Debt marker_ (manual, scenario "Treaty debts"): the DEBT tab hangs under $60; paying a debt
  leaves it there, and the next operating round's settlement steps it right.
- _Steel Depot_ (manual, scenario "Steel depot"): the switch is off; turning it on makes the
  next yellow tile's steel free from the card, and after two the switch is disabled.
- _Bridge lease_ (manual, scenarios "Bridge lease choice" and "Bridge lease"): using the lease lets
  the 4+ run through the gorge; after the payout only the two payment buttons are offered.
- _Brown gorge_ (manual, scenario "Brown gorge"): hovering E13 outlines all three gorge hexes, and
  choosing one previews the brown gorge whole.
- _Train extension_ (manual, scenarios "Train extension", "Coal creek" and "Coal depot"): the
  prompt shows one badge button per 2+; pressing one lists that train with its route colour and
  "+1 stop", and the prompt leaves (Track Engineer) or offers what cubes remain.
- _Discounted metal shares_ (manual, scenarios "Metal shares stock round" and "Mint worker"): open
  Discount from the stock menu; the Metals Investor offers CF&I and VGC at $40, and buying one
  CF&I leaves only VGC. The Mint Worker's purchase closes it.
- _Map markers_ (manual, scenarios "Gold shipping", "Ghost town run" and "St. cloud hotel"): gold
  cubes, the ghost town and the hotel stand in a corner of their hexes, clear of track and stops.
- _Debt repayment_ (manual, scenario "Treaty debts"): the prompt shows Rio Grande's token, "owes 4
  debts:" and "Repay one for $60"; repaying leaves three and no second prompt this round.
- _Nugget follow-up_ (manual, scenario "Gold nugget"): picking B10 opens the follow-up offering
  +$50 or +$130; Undo closes it without undoing an Action.
- _Ghost town_ (manual, scenario "Ghost town"): shipping B6's last cube leaves B6 pickable and
  offers Place ghost town; placing it puts the marker on B6.
