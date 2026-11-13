# Rules interpretations

Where the rulebook is silent or ambiguous, the implementation makes the choices below. Each is covered by a test in `src/model/rules.spec.ts`.

## Auctions

- **Players who cannot afford the next bid drop out automatically**, so nobody waits on a forced pass.
- **Bidding goes clockwise in seat order**, which is the turn order, starting from the opener.
- **The minimum bid for an offered share is a fifth of the railroad's value, rounded up.** Values are always multiples of $5, so rounding never changes the amount.

- **The start player heads the turn order.** The CMRC's opening shareholder takes the first turn, so the turn order is turned to start with them. Seat order, and so bidding order, is unchanged.

## Choosing an action

- **The third Offer Stock slot is open with four, five and six players.** The rulebook text limits only the three-player game. The redrawn board marks the slot "4p, 5p", but six players get it too.
- **An action with nothing to do still moves the locomotive and ends the turn.** This covers Construct Track when no railroad can build, Offer Stock when no share is unsold and the player holds none, and Develop Settlements when nothing can be developed.

## Construct Track

- **A railroad that cannot build is underfinanced or has no link it may build.** The rulebook defines only the lack of money. A funded railroad with every legal link taken counts as unable to build, so a player may not choose it and must pick another or end the turn.
- **A player who controls a railroad able to build must build with one of their own.** They may not hand the build to another controller or pick a railroad they do not control. Delegation is only for a player with no railroad of their own able to build.

## Develop Settlements

- **Declining the $3 second development develops Johannesburg automatically, even when the first development was Johannesburg.** The rulebook's "if they choose not to pay $3, Johannesburg is automatically developed" is applied as written; the player may also choose Johannesburg as the second development, free. Once Johannesburg is full, declining develops nothing.
- **A metro area may be developed twice in one action.** Johannesburg, taking the free second development, is the common case.

## End of the game

- **Players tied on the most money share the win.** The rulebook names no tiebreak, so a tie is a draw between them.

## Texas Special

Where the Texas Special rules, its printed map and the SAR rulebook differ, the Texas Special rules come first, then the map, then the rulebook. Each choice below is covered by a test in `src/model/texasSpecial.spec.ts`.

- **The minimum bid is the railroad's track value ÷ 5**, as in SAR. The rules' definition of "Value" (value plus income over outstanding shares) is the final payoff per share and sets only the final payoff.
- **A second development costs $3 everywhere, Dallas included.** No settlement is developed free or without a connection.
- **Declining the second development, or leaving town, develops Dallas, then Kansas City, then Memphis**: the first that is not full. A second development nobody can afford is declined automatically.
- **Leave Town is the alternative to the first development** in the Develop Settlements box. It takes a cube from any developed settlement other than a natural resource, metro areas included (one level), where a railroad the player controls has track.
- **A Leave Town cube pays $3 at every dividend, the final payoff included, once.** The final score is the player's cash after that payout.
- **A northern and a southern railroad are adjacent when both have track into a common settlement.** The Texas Special is founded in place of a build by the railroad the player builds with, from its treasury, and pays both railroads' shareholders a special dividend of income ÷ 5, rounded down. The $20 bonus counts only toward each founder's final payoff.

## Pennsylvania Railroad

Pennsylvania Railroad plays as South African Railroads except where its map differs. Each choice below is covered by a test in `src/model/pennsylvania.spec.ts`.

- **The free metro area moves along the printed order.** The first of Pittsburgh, Cincinnati, St Louis, Detroit and Chicago that is not full is free to develop, needs no track, and is developed when a second development is declined.
- **Canadian connections cost $30 and pay a special dividend of income ÷ 5, rounded down, but add nothing to a railroad's value**, so they never raise the minimum bid or the final payoff.

## Veld Railroads

Veld Railroads plays as South African Railroads except where its rules and board differ. Each choice below is covered by a test in `src/model/veld.spec.ts`.

- **A one-way link is built towards the end its arrow points at.** The CSAR may lay its free first link along the one-way link from Aliwal North; a railroad reaching the other end first cannot build it back. A double build's second link obeys the arrow from the middle settlement.
- **Closed borders bar free first links too**, so a railroad whose home has a closed link lays its free link elsewhere.
- **The ZASM pays double while its track meets no other railroad's before the build.** The build that first meets another railroad's track is still paid double; connections are doubled the same way.
- **The ZASM opens on Johannesburg's income when the Develop Settlements action ends**, after any automatic development, with the turn player opening the auction. Its free first link is laid even in the war.
- **A railroad's first link into Johannesburg pays its special dividend on its income after the build.** The ZASM never earns it. The ZASM's own special dividend is paid when its track first meets another railroad's, provided no other railroad then has track into Johannesburg.
- **In the recovery round every special dividend pays income ÷ 10, rounded down**, as the board prints, not only those for connections.
- **In the war a player develops up to three settlements; one with nothing left to develop may stop after the first.** Declining the paid third develops Johannesburg, as declining the second does in peacetime.
