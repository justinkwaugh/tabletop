# Rules interpretations

Where the Germany rulebook (v0.60) is silent or conflicts with the board (v0.61), the implementation makes the choices below. Each is covered by a test in `src/model/rules.spec.ts` or `src/definition/*.spec.ts`.

## Setup

- **The Start Player token goes with the K.B.S.B. share.** The rulebook places it on Blue's share pile; the K.B.S.B. is auctioned last, and its buyer takes the first turn of round one. The other four opening shares each come with a random industry token.
- **Opening auctions run K.P.E.V., G.B.S.E., K.S.S.E., K.W.S.E., K.B.S.B.**, the charters' order on the board. The first opener is seat one; each next auction is opened by the previous buyer. A company's minimum opening bid is its starting revenue ($5 for a city home, $3 for a town).
- **Companies start with an empty treasury.** The Germany rulebook gives them no starting money, unlike the Midwest and Switzerland.
- **Starting cash and Round Timer follow the board:** $40, $30, $24 and $18, $15, $15 for three, four and five players.

## Actions

- **An action space the player cannot afford is not offered, and neither is one with nothing to do.** A player who can take no action must consolidate. The rulebook only requires consolidating when no action is affordable; an action with no legal choice (no unsold share, no industry token left, or no company the player may build for) is treated as unavailable.
- **A share can be issued only if the player can afford its minimum bid.** The opener's bid is part of the action.
- **Industry Investment needs the player to afford the raised level**, since the investor may not bid zero. Players who cannot afford the level are left out of the sealed bidding; when no other player can bid, the investor buys at the new level.
- **The investor's tie rule applies at the tied bid.** A tie for highest goes to the investor if tied, else the tied player next clockwise, at the tied amount; a lone positive bid pays the industry's new level.
- **A sealed bid of zero is declared as an amount of 0** and is a full action, like a bid.
- **Lay Track may lay nothing.** The rulebook allows laying zero discs. Laying zero is an action that still moves the coins.
- **A crossing cube is a countryside placement for the company's own network.** It joins the company's network like a disc and counts toward the action's piece limit.
- **Network connection is by adjacency to any hex holding the company's disc or cube**, starting from its home hex.
- **Site capacity is the round number** for cities, towns and industry sites, one disc per company per site; a countryside hex holds one disc and one cube.

## Payouts

- **Dividends are revenue divided by shares sold, rounded up**, paid every round; a company with no shares sold pays nothing.
- **Obsolescence bands follow the Revenue Track arrows:** −3 from 11, −6 from 21, −9 from 31, −12 from 41, −15 from 51 and above. A revenue on a band's corner cell (20, 30, 40, 50) takes the lower band, since each arrow starts on the cell after it. The board prints no band above 60; the −15 band continues.
- **The final-round Round Timer reduction** is $1 per company with one share left and $2 per company with none, applied when the timer is refilled for round four.
- **The game-end industry bonus is $6 per site reached, shared among the tokens held**, per the board. The rulebook text says $10, $20, $30 for three sites; the board has four sites per industry and the $6-per-site line.
- **The Railroad Bonus counts a site's top disc only.** A crossing cube never counts as a disc.
- **Players tied on the most money share the win.**

## Off the Rails

- **The choice is made per industry placement** by the player laying the track, and applies only when the optional `offTheRails` rule is on.
