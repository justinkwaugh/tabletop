# Rules interpretations

Where a rulebook is silent or conflicts with its board, the implementation makes the choices below. Each is covered by a test in `src/model/rules.spec.ts` or `src/definition/*.spec.ts`. The Germany rulings use rulebook v0.60 and board v0.61; the Midwest rulings use rulebook v0.60 and board v0.63. A Germany ruling about the shared rules (actions, auctions, payouts, the round loop) applies to the Midwest too unless the Midwest section says otherwise.

# Germany

## Germany setup

- **The Start Player token goes with the K.B.S.B. share.** The rulebook places it on Blue's share pile; the K.B.S.B. is auctioned last, and its buyer takes the first turn of round one. The other four opening shares each come with a random industry token.
- **Opening auctions run K.P.E.V., G.B.S.E., K.S.S.E., K.W.S.E., K.B.S.B.**, the charters' order on the board. The first opener is seat one; each next auction is opened by the previous buyer. A company's minimum opening bid is its starting revenue ($5 for a city home, $3 for a town).
- **Companies start with an empty treasury.** The Germany rulebook gives them no starting money, unlike the Midwest and Switzerland.
- **Starting cash and Round Timer follow the board:** $40, $30, $24 and $18, $15, $15 for three, four and five players.

## Germany actions

- **An action space the player cannot afford is not offered, and neither is one with nothing to do.** A player who can take no action must consolidate. The rulebook only requires consolidating when no action is affordable; an action with no legal choice (no unsold share, no industry token left, or no company the player may build for) is treated as unavailable.
- **A share can be issued only if the player can afford its minimum bid.** The opener's bid is part of the action.
- **Industry Investment needs the player to afford the raised level**, since the investor may not bid zero. Players who cannot afford the level are left out of the sealed bidding; when no other player can bid, the investor buys at the new level.
- **The investor's tie rule applies at the tied bid.** A tie for highest goes to the investor if tied, else the tied player next clockwise, at the tied amount; a lone positive bid pays the industry's new level.
- **A sealed bid of zero is declared as an amount of 0** and is a full action, like a bid.
- **Lay Track may lay nothing.** The rulebook allows laying zero discs. Laying zero is an action that still moves the coins.
- **A crossing cube is a countryside placement for the company's own network.** It joins the company's network like a disc.
- **Network connection is by adjacency to any hex holding the company's disc or cube**, starting from its home hex.
- **Site capacity is the round number** for cities, towns and industry sites, one disc per company per site; a countryside hex holds one disc and one cube.

## Germany payouts

- **Dividends are revenue divided by shares sold, rounded up**, paid every round; a company with no shares sold pays nothing.
- **Obsolescence bands follow the Revenue Track arrows:** −3 from 11, −6 from 21, −9 from 31, −12 from 41, −15 from 51 and above. A revenue on a band's corner cell (20, 30, 40, 50) takes the lower band, since each arrow starts on the cell after it. The board prints no band above 60; the −15 band continues.
- **The final-round Round Timer reduction** is $1 per company with one share left and $2 per company with none, applied when the timer is refilled for round four.
- **The game-end industry bonus is $6 per site reached, shared among the tokens held**, per the board. The rulebook text says $10, $20, $30 for three sites; the board has four sites per industry and the $6-per-site line.
- **The Railroad Bonus counts a site's top disc only.** A crossing cube never counts as a disc.
- **Players tied on the most money share the win.**
- **Player cash is public.** The rulebook hides only sealed bids, held in a closed fist; nothing conceals money.

## Germany Off the Rails

- **The choice is made per industry placement** by the player laying the track, and applies only when the optional `offTheRails` rule is on.

# The Midwest

## Midwest setup

- **Homes follow the discs printed on the board:** the PRR at Lincoln, the B&O at Indianapolis, the IC at St. Louis, the ERIE at Toledo and the NYC at Detroit. Each company's revenue starts at its home's value.
- **Opening auctions run NYC, ERIE, IC, B&O, PRR**, the charters right to left as the rulebook says. The Start Player token goes with the PRR share (Red), auctioned last.
- **Every company starts with $10** in its treasury, before its opening bid is paid in.

## Midwest track

- **A site holds three discs in every round**, one per company, per the board's Track Info.
- **A site disc costs $4 plus $2 for each disc already there**; Lay Track II halves that for a company the player holds no share in.
- **Demand counts the company's whole network.** A company may build on an Industry Site once any hex holding its disc or crossing cube touches a demand area that wants that industry. Demand, once established, stays, and a disc laid earlier in the same Lay Track action counts.
- **The demand areas are the four off-map circles:** Texas (steel and grain), Atlanta (cloth and brick), Washington D.C. (steel and brick) and New England (grain and cloth). The rulebook's anvil is steel. No track goes on a demand area or a lake.

## Midwest payouts

- **State Subsidies count every state holding the company's disc or crossing cube**, its home included, and pay per share from the board's table. A state is the area inside the printed red borders.
- **St. Louis is in Illinois.** The printed Missouri border runs west of it.
- **The Establishment Bonus is $8 per site reached**, shared among the industry's tokens held and rounded up; the rulebook and board agree, with three sites per industry.
- **Player cash is public**, as in Germany.
