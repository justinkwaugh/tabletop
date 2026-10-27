# Power Grid scenarios

The dev harness lists these under **Scenarios**. Each is a bot game played up to the position, with every action that led to it, so Undo and the history work. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/power-grid`.

- **Round 2 auction.** Four players, the first chooser of round 2 with the discount on the lowest plant. Click a plant and bid: the plant carries the high bid and the next bidder gets Bid and Pass.
- **Bidding.** An auction in progress in round 2. The bidder may raise or pass; a player who cannot top the bid drops out on their own.
- **Buying resources.** A player with money buys in round 5. Clicking a lit market row adds its cheapest token to the cart; the tokens fade in place and the button shows the cost.
- **Building.** A player with at least 45 Elektro builds in round 5. Every affordable city is ringed with what it adds to the bill; choosing two totals them in the cheapest order. Confirm and the houses drop in.
- **Powering.** Round 3 Bureaucracy, every player still to power. The panel opens on the best plan; toggling plants changes the earnings.
- **Scrapping a plant.** A player has just won a fourth plant and must scrap one of the other three.
- **Step 2.** Five players, the first auction of Step 2: city slots of 15 are open.
- **Step 3 card drawn.** Four players in Step 2, the Step 3 card sitting at the end of the future market. Finish the auctions: at the end of Phase 2 the card and the lowest plant fade out and the six plants left slide into three columns.
- **Step 3.** Five players in Step 3: six plants on offer and the 20 slots open.
- **Game end.** A finished four-player game with the final standings.
- **Trust setup.** Two players placing the Trust's houses: only cities next to a Trust city are ringed.
- **Against the trust.** Round 4 of a two-player game. The Trust holds plants and has blocked the 15 slot of every city the players opened.
