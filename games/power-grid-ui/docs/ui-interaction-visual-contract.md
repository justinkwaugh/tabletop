# Power Grid UI interaction visual contract

## Visual intents

- **Choosing a plant to auction.** On the chooser's turn in Phase 2, every plant they can afford in the auctionable part of the market has a dashed amber outline; the rest of the market dims. Clicking a plant selects it (solid amber outline, lifted) and the action panel offers the opening bid. Clicking it again deselects it. The map and resource market are unaffected.
- **Bidding.** The plant under auction keeps the solid outline and carries a "Bid N" tag in the market for every player. Only the current bidder gets the stepper and buttons.
- **Scrapping a plant.** The action panel shows the player's older plants as targets; the chosen one is selected. The board is unaffected.
- **Filling the resource cart.** On the buyer's turn, resource rows they can add to are lit and clickable. Tokens in the cart stay in their market slots, faded, inside a dashed ring, cheapest first, so the market shows what the purchase leaves behind. The action panel mirrors the cart with −/+ per resource.
- **Choosing cities to build.** On the builder's turn, every city they can afford to add carries a dashed amber ring and a "+N" tag: what it would add to the bill on top of the cities already chosen. Chosen cities get a filled amber ring and a ghost house in their next slot. Each click toggles a city. Out-of-play regions are hatched grey and their cities faded throughout the game.
- **Placing a Trust house.** In a two-player setup, the cities the placer may use carry the dashed ring, with no price tag. A click places the house at once.
- **Choosing plants to run.** Everyone acts at once in Phase 5. The action panel starts on the best plan (most cities, least fuel); toggling a plant or the hybrid coal stepper makes it the player's own choice.
- **Houses arriving.** Houses built by any action drop into their slots one after another in the order they were connected.
- **Market changes.** When plants leave the market (bought, taken by the Trust, removed, placed under the stack), they fade out; the remaining cards slide to their new places, and newly drawn cards grow in. Step 3's change to a single six-card market slides the cards into three columns.
- **Phone focus.** On narrow screens the board stacks the map above the markets, and the view moves to the plant market or the resource market when the player's decision is made there.

## Coexistence and precedence

Only one player decision is open per client at a time, because the machine state owns exactly one decision kind. The decision intents therefore never overlap. Houses arriving and market changes can coexist with any of them and with each other; both are drawn in place and do not change targets.

## Shared visual state

All drafts are stages of one staged selection (`model/stagedSelection.ts`), in the order plant, bid, scrap, coal/oil choice, cart, cities, power. Every stage is manual; setting a stage clears the later ones.

| State                   | Meaning                                                    | Producer → consumers                                | Lifetime                                                                           | Validity                                                                  |
| ----------------------- | ---------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `plant`, `bid` stages   | Plant picked to open, and the bid being set                | Market click, stepper → market cards, action panel  | Cleared by `beforeNewState` on every transition except others powering             | The plant must be in `choosablePlants`; the bid is clamped when it is set |
| `scrap`, `dropOilFirst` | Plant picked to scrap, and which of coal or oil to give up | Action panel → action panel                         | Same                                                                               | Must be in `scrappablePlants`                                             |
| `cart` stage            | Tokens picked to buy, in click order                       | Market rows, steppers → market tokens, action panel | Same                                                                               | Each addition is checked against money, market stock and storage          |
| `cities` stage          | Cities picked to build, in click order                     | City clicks, panel chips → cities, action panel     | Same                                                                               | Each addition must have a quote the player can afford                     |
| `power` stage           | The player's own power plan                                | Panel toggles → action panel                        | Same; other players' `PowerCities` transitions keep it, as everyone powers at once | Previewed as invalid when the fuel does not cover it                      |
| `arrivingHouses`        | Houses of the next state drawn while they drop in          | `HousesAnimator` → cities                           | Set for one transition step, cleared after its animations                          | Scoped to the step being shown                                            |
| `animatedMarket`        | The next state's market, with the cards leaving it         | `MarketAnimator` → plant market                     | Set for one transition step, cleared after its animations                          | Scoped to the step being shown                                            |

Undo pops the highest manual stage: one city or one cart token at a time, any other stage whole. With no stage set, it undoes the last committed action.

In History View no decision is open, so none of the drafts are shown; houses still drop in when stepping forward.

## Render ownership

- **House drop.** `HousesAnimator` owns the motion. Cities render arriving houses inside an outer wrapper placed at the slot, and the animator tweens the inner node so the transform stays centred.
- **Market changes.** `MarketAnimator` owns the motion on the action timeline. Before the state swap it sets `animatedMarket` to the next market plus the leaving cards, so every card is placed at its final cell; it then tweens leaving cards out, moving cards from their old cell, and drawn cards in, clearing its transforms when each tween ends. A replayed action sequence is shown one action at a time, each from the market the previous one left.

## Verification scenarios

Each is checked by opening the named scenario in the harness (manual).

- **Round 2 auction:** click a dashed plant, then the Bid button. The plant gets the "Bid" tag and the next bidder gets Bid and Pass. Undo before bidding clears the selection.
- **Market change:** finish an auction in Round 2 auction. The sold plant fades, the cards after it slide left, and the replacement grows into its sorted place. Undo plays the reverse within 200 ms.
- **Step 3:** in Step 3 card drawn, finish the auctions. The card and the lowest plant fade out and the six cards left slide into three columns.
- **Buying resources:** click a lit row twice. Two faded, ringed tokens appear at the cheapest end and the button shows their cost. Undo removes one at a time.
- **Building:** click two ringed cities. Both get ghost houses and the button totals their cost. Confirm, and the houses drop in one after the other.
- **Powering:** the panel opens on the best plan. Toggle a plant and the earnings update. Undo returns to the best plan.
- **Trust setup:** only cities next to a Trust city are ringed. Clicking one places the house.
- **Phone (390 × 844):** in Round 2 auction and Buying resources, the view opens on the plant market and the resource market respectively.
