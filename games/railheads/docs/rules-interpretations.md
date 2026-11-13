# Rules interpretations

Where a rulebook is silent or conflicts with its board, the implementation makes the choices below. Each is covered by a test in `src/model/*.spec.ts` or `src/definition/*.spec.ts`. The Germany rulings use rulebook v0.60 and board v0.61; the Midwest rulings use rulebook v0.60 and board v0.63. A Germany ruling about the shared rules (actions, auctions, payouts, the round loop) applies to the Midwest too unless the Midwest section says otherwise.

# Germany

## Germany setup

- **The Start Player token goes with the K.B.S.B. share.** The rulebook places it on Blue's share pile; the K.B.S.B. is auctioned last, and its buyer takes the first turn of round one. The token never moves after that: turns go clockwise without a break, so each later round opens with the player after the one who took the previous round's last turn. The other four opening shares each come with a random industry token.
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

# Switzerland

Rulebook v0.60 and the board printed in it (Gameboard Version 0.61).

## Switzerland setup

- **Homes follow the coloured circles on the board:** the SNB at Zurich, the AB at Frauenfeld, the PB at Alpnachstad, the RhB at Winterthur and the MOB at Montreux.
- **Opening auctions run SNB, AB, PB, RhB, MOB**, the charters left to right. The Start Player token goes with the MOB share (Red), auctioned last; the other four come with a random industry token.
- **Starting cash is the rulebook's $30, $23 and $18**, which it says replace the board's. Every company starts with two loans and $10.

## Switzerland track

- **The Alps (white) and lakes take no track.** Hillside (grey) costs $3; a tunnel costs $4 per hex.
- **A crossing cube costs what the board's Track Info prints:** $1 on countryside, $2 on hillside and $2 per tunnel hex. The rulebook text says $1 on hillside.
- **A tunnel is one place.** Its single disc sits on the tunnel's first hex, and track beside any of its hexes connects through it. Lay Track III builds at most one tunnel.
- **Loans are for the company being built for**, on Lay Track I or III, before any track. A company takes at most two a turn, each only while its treasury is under $20, and ten in all; it repays any number it can afford at $10 each.
- **Interest follows every payout, the final one included**, so the Loan Limit is checked against the revenue after the last interest step.
- **The Loan Limit is one loan per full five revenue above five:** none up to 5, one from 6 to 10, and so on, as the brackets along the Revenue Track show.

## Switzerland Industry Investment and game end

- **Sealed bids are first-price.** A bid must be zero or at least the lower of the industry's raised level and $5; the investor may not bid zero, and bids even when no one else can afford to.
- **Bid order is highest bid first, ties clockwise from the investor.** The winner must take an item their bid covers. Each later bidder whose bid covers the leftover may take it or pass; bids too low for it are skipped.
- **An unsold industry token returns to its level before the auction;** an unsold Credit Suisse share returns to the supply.
- **Total Subsidies count the flagged Industry Sites a company reaches in each country.** France and Germany pay $6 for one and $9 for more, Austria $4 and $8; Italy multiplies the sum by one or two. The rulebook's Establishment Bonus does not exist in Switzerland.
- **A Credit Suisse share pays each company's Loan Table dividend:** +1 for one or two loans up to +5 for nine or ten.

## Toll chits (Switzerland and Denmark)

- **A chit cashes in for $1 a star only when its holder pays for a share or an auction item** with too little cash; the engine cashes in the chits covering the shortfall with the fewest stars. Chits count towards what a player can bid. Chits left at the end pay $2 a star.

# Denmark

Rulebook v0.61 and Gameboard Version 0.62.

## Denmark setup

- **Homes follow the board:** the SFJ at Nyborg, the AaAJ at Aabenraa, the AHB at Aalborg, the JFJ at Ringkøbing and the DSJ at Copenhagen, which pays +7 as the capital.
- **Opening auctions run SFJ, AaAJ, AHB, JFJ, DSJ**, left to right. The DSJ share (Black) carries the Start Player token and one Government Bond; the others each carry a random industry token.
- **Starting cash follows the board:** $40, $30 and $24.

## Denmark rules

- **Bridges are built only on Lay Track III, one per action.** A bridge disc costs $6 and a cube on it $3; its builder takes the Bridge Toll chit.
- **Obsolescence follows the Revenue Track arrows:** −2 from 11, −4 from 21, −6 from 31, −8 from 41 and −10 from 51 and above.
- **Wealth Taxation is paid at every round end, the last included,** before the payout. Above $60 the tax is a third of a player's cash, rounded down.
- **Industry Investment works as in Switzerland, with a Government Bond for at least $1.** A bond's buyer sends its price to any company's treasury or to the State Treasury.
- **At the end each bond pays the State Treasury divided by the bonds held, rounded up.** The Establishment Bonus is $8 per site, as in the Midwest.

# England & Wales

Rulebook v0.60 and Gameboard Version 0.60.

## England & Wales setup

- **Homes follow the board:** the LMS at Lancaster, the LNER at York, the Southern at Southampton, the GWR at Cardiff and the Underground at London. Companies start with an empty treasury, as no setup step funds them.
- **Opening auctions run LMS, LNER, SR, GWR, Underground**, the charters left to right. The First Player token goes with the Underground share (Black); the other four carry a random industry token.
- **Every company has five shares; the Underground has 15 discs**, its home disc included. The four discs in the Tube Connection box only mark couplings.
- **Starting cash and the Round Timer follow the board:** $40, $30, $24 and $18, $15, $15. The rulebook's end-of-round step says $16 for four players.

## England & Wales track

- **Each Lay Track space sets the price for one company:** I $2, II $3, III $4 a disc, times one more than the discs already on the hex. Lay Track I needs no share and halves the price without one; II and III need a share and sell cubes for $2 and $1.
- **The extra disc for staying in the designated region applies only when every disc of the action lies in it.** The Underground has no region, so it never takes the extra disc. Regions follow the dashed lines and edge colours: red is the LMS's Midlands, blue the LNER's East, yellow the GWR's West and green the Southern's South. London lies in none.
- **Sites hold two discs and London three.** France is a city of the South.

## England & Wales payouts

- **The coupling bonus pays once per Big Four company,** when its disc and an Underground disc first share a town, city or site, after the revenue rises. It pays that company's dividend per share to its shareholders, and the Underground's dividend to the Underground's shareholders when the Underground built. An Underground disc joining several Big Four discs couples with each.
- **Running Rights count every town, city and site holding the company's disc outside its region**, London excepted; the Underground earns none. The Establishment Bonus is $6 per site, four sites a type.
