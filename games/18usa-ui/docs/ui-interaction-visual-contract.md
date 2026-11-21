# 18USA table interaction and visual contract

18USA renders the shared 18xx table through `EighteenUSASession`, a `SizedCompanySession`. Shared
modules own stock trading, the company auction, shorts, corporate actions, the merger and
acquisition rounds, tile and station staging, routes (the Pullman attached in the run panel),
payouts, train purchases, history and the single contextual Undo; their behaviour is recorded in
the [18xx-ui contract](../../../libs/18xx-ui/ui-interaction-visual-contract.md). This contract
covers what 18USA adds. The map is the generic presentation in the Custom tile style.

## Visual intents

- **Board.** The one-row market and the loan strip under it stand above the map at TOP's market
  scale; the depot stands beside the west coast. Neither covers a hex.
- **Printed icons.** Coal, oil, ore and bridge icons are revenue-sized symbols in a hex's clear
  corner. The Great Northern's border icons show while P17 is in the game and open.
- **Placed tokens.** A resource or bridge token covers the icon it was placed on, drawn as a disc
  of its kind with its value: oil's rises to $20 from phase 5, an upgraded ore token shows $20.
  P6's token shows the values it brings; P8's station shows its company with a +10 tab.
- **Subsidies.** Until the first stock round ends, each subsidy city shows the tile it offers as an
  orange token ($30, Boom town, Free Stn, Res, +10, +10/20, or — for none). A +10 or +10/+20 bonus
  a company took stays on its city as an orange token with its current value. The company auction
  states the home city's subsidy under the home.
- **Mexico.** The six hexes are drawn joined, the name and values once on I9.
- **Title operating modes.** Offered as entries of the operating mode switch only while the logic
  offers the action to this player: Pullman (buy, with the price, or scrap for $50; a reason shows
  when it cannot be bought), Upgrade ore (one button per hex, also chosen on the map), Turn Denver
  (one tile picture per allowed rotation), Train powers (one train badge per train each of P30 and
  P19 may be given to). Each press is one Action.
- **Pennsy Boneyard.** While a rust waits on P13 (`SavingTrain`), the action area shows the
  company, P13's text and one button per rusting train plus "Let them rust"; others see who
  chooses.

## Shared state and lifetime

The title keeps no local selections: every control is one Action, and the ore choice on the map
(`mapLocationChoice`) exists only while the ore mode is shown and upgrades are offered. Option lists
are derived from Game State and the valid action types, so they lapse with the step that offers
them. Buttons are disabled while `canChooseAction` is false (busy, updating visible state, viewing
history, or not this player's turn). Marker art that changes with play comes from
`presentation.markerArtFor`, and subsidy and bonus markers from `mapView.stateMarkers`.
