# Kogge UI interaction visual contract

## Visual intents

- **Choose a start city.** While the player still owes a secret start choice, every city card with office room that they have not chosen before pulses with a gold frame; clicking or pressing Enter on one commits the choice. Other cards stay plain.
- **Move the guild master.** For the round's first player, the one or two cities he can reach pulse; the action panel offers the same choices as buttons.
- **Sail.** During the acting player's movement, lanes from their cog's harbour to each reachable known city are drawn as moving dashed red lanes (purple dots for the secret passage) with arrowheads and the move's cost. A hidden route is shown as a dashed ring at the harbour. Destination city cards and the cog city's sailable route slots pulse. Clicking either chooses the route: a free move commits at once, a paid one opens the payment picker in the action panel and keeps its lane emphasised.
- **Found an office.** The next empty office site on the cog's card pulses when the player can build there.
- **Buy route markers.** Unsold pairs in the market cartouche pulse; one click buys with the only good on board, otherwise it opens the payment picker.
- **Change a route.** After choosing the tool, the cog city's face-up route slots pulse; the panel then lists the markers that may be laid face down.
- **Expel a robber.** For the chosen player, the raided city's routes that may move the robber pulse.
- **Faded sea lanes.** Every face-up route on the board is always drawn as a faint pale ribbon, a reading aid with no interaction.

## Coexistence and precedence

- Board targets are derived once in the session (`cityTargets`, `slotTargets`, `officeTarget`, `marketTargets`). Each target map is empty outside its owning machine state, so start-city, guild master, sailing and expulsion targets never coexist.
- Sailing, office, market and route-change targets share the acting player's turn. Choosing a tool or a paid route removes the free-turn targets (sail destinations, sailable slots, office site, market pairs); only the tool's own targets remain. Undo pops the tool or route and restores them.
- A city card's frame covers the whole card, so a card is never both a city target and a slot or office target: sail destinations exclude the cog's own city, and slot and office targets exist only on it.

## Shared visual state

- **Staged selection** (`tool`, `sailRoute`, `routeSlot`, `offerGroup`, `trade`, `bid`, `pile`, `payment`): produced by session methods, consumed by the action panel and the board targets. Every stage is manual; Undo pops the highest. Lifetime: cleared whenever a new visible state is published (`resetAction`). In History View no targets are offered because the player cannot act.
- **Fleet state** (`fleetState`): the state cogs and the guild master are drawn from. It follows `gameState` and is overridden by the fleet animator in `afterAnimations` with the state the motion ended on, so pieces never jump back between the motion and the state swap. Silent restoration updates it through `gameState`.

## Render ownership

- **Cog and guild master motion.** The outer group's translate comes from `fleetState`; the inner group's transform belongs to GSAP alone. Live sails and expulsions run along their lane for 1.1s; guild master moves step city by city. Undo and history steps move directly within 200ms. All offsets reset in `afterAnimations`.
- **Active lanes** are hidden while `updatingVisibleState` is true, so the departing city's lanes do not linger during a voyage.
- **Targets** draw above their card or cartouche and own the hit area; cogs and lanes ignore pointer events.

## Verification scenarios

1. Start a game: every city pulses for the first chooser; choosing one removes it for that player only. Manual (screenshot script).
2. Reach a turn: two lanes and two destination cards pulse; clicking a free destination sails the cog along its lane and the new city's lanes appear afterwards. Manual (frame captures at 100–1500ms).
3. With a paid move pending, Undo returns to all free-turn targets. Manual.
4. Choose Change a route: only face-up slots pulse; Undo restores the turn targets. Manual.
5. Step backward through history across a sail: the cog moves back within 200ms and no targets show. Manual.
