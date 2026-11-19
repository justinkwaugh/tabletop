# 18RoyalGorge table interaction and visual contract

18RoyalGorge renders the shared 18xx table through `SessionRoyalGorge`, a specialization of the
shared 18xx session. Shared modules own the selection auction, stock trading, tile and station
staging, routes, payouts, train purchases, history and the single contextual Undo; their behaviour
is recorded in the [18xx-ui contract](../../../libs/18xx-ui/ui-interaction-visual-contract.md).
This contract covers what 18RoyalGorge adds. The map is the generic presentation.

## Visual intents

- **Steel choice.** In the operating railroad's track step, the board panel's CF&I steel market
  shows each colour's column the railroad has used this turn, or chosen, outlined with the
  railroad's token, and the next steel's price under each colour it may lay. Columns it may still
  choose for a colour, and the Steel Depot while its railroad holds it, are buttons; pressing one
  is one Action (ChooseSteel). Other players see the marks but no buttons. The action area repeats
  the next steel's price per colour in one line.
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
- **Debt marker.** While debts are owed, a DEBT token stands on the stock market at the debt
  marker's space, beneath the companies' tokens there, and moves with the market's animation.

## Coexistence and precedence

- Gold shipping and the ghost town are never offered together: the ghost town follows the
  shipment that emptied the mine, and a railroad ships once a turn. Gold shipping wins in
  `mapLocationChoice` if both were ever open; either replaces the family's location choices.
- Steel choice happens only in the track step and gold only after the run, so the steel buttons
  and the gold mask never overlap.
- The bridge lease prompt blocks the payout but not gold shipping; both prompts may show at once.

## Shared visual state

- **Chosen gold** (`goldChoice`, a single-choice staged selection registered first with
  `localSelections`). Meaning: the mine whose shipment awaits the Nugget choice. Producer: a map
  pick while the Nugget is available. Consumers: the map follow-up. Lifetime: cleared by Undo, by
  the follow-up's cancel, and on every published state (the session keeps no selections across
  transitions). Validity: read through `chosenGold`, which drops a mine no longer shippable.
  History View shows no follow-up, since `shippableGold` is empty there.

## Verification scenarios

- _Steel choice_ (manual, scenario "Steel choice"): press green column F on the board panel; F is
  outlined with RG's token and the action line reads "green $20 (F)". Undo restores E.
- _Gold shipping_ (manual, scenario "Gold shipping"): every hex but Buena Vista is masked; picking
  it ships, the payout rises from $90 to $140 and one gold cube stays on the hex. Undo returns the
  cube.
- _Debt marker_ (manual, scenario "Treaty debts"): the DEBT token stands on $60; paying a debt
  leaves it there, and the next operating round's settlement moves it right.
- _Nugget follow-up and ghost town_ (manual, no prepared scenario): with the Nugget, a pick opens
  the follow-up; Undo closes it without undoing an Action.
