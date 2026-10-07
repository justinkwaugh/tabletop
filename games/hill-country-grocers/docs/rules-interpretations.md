# Rules interpretations

Hill Country Grocers follows the v2.0.0 rulebook (last updated 7/26/2026). Where the rulebook is silent or ambiguous, the implementation makes the choices below. Each is covered by a test in `src/model/rules.spec.ts` or `src/definition/playthrough.spec.ts`.

## Setup and auctions

- **Starting cubes come out of each grocer's supply.** The supply after setup is 12 red, 10 green, 11 blue and 8 orange including the cube placed on each starting city.
- **Whoever starts an auction must open with a bid**, from $0 up to their cash. This applies to the initial auctions as well as the Auction Share action, so every auction sells a share.
- **Players who cannot afford the next bid drop out automatically**, so nobody waits on a forced pass.
- **The initial auction order is shuffled once at setup** from the game's seeded random stream.

## Choosing an action

- **No pawn starts on the action board**, so a player's first action can be any of the three.
- **An action is offered only when it can be carried out.** Build needs a share in a grocer that can afford and legally place a cube. Develop needs a Development Marker and a city with room. Auction needs an unsold share.

## Building

- **A company never places a cube in a hex it already occupies**, the starting cities included. "Adjacent to existing cubes" is read as expanding the network, and a duplicate cube adds no value while burning supply.
- **Cubes placed earlier in the same action count as existing cubes** for the adjacency of later ones.
- **The $1 fee is paid once per grocer present**, not once per cube that grocer has in the hex.
- **The whole build is costed together and must fit in the treasury.**
- **Verbena's waiver applies automatically to the cube that owes the most fees.** The rule says Verbena "can choose" one cube; taking the largest saving is always at least as good for Verbena.
- **The Streamside Sisters bonus cube is optional** and is offered only when a legal, affordable placement exists. It is paid from the Streamside treasury, which already includes the winning bid.

## Developing

- **Development needs no grocer presence.** Any city with room may take a marker.
- **The $1 option comes after the first marker**: place one marker, then either place a second in a different city or take $1. If no second city is open, $1 is the only choice.
- **Balcones Builders pays each grocer company present once.** When its treasury cannot pay all of them, the active player picks exactly as many payees as it can afford.

## Dividends and the game end

- **Grocer value counts each city hex holding the grocer's cube.** Each city is worth $1, plus $2 per marker there ($3 for Complete Comestibles).
- **Shares held by nobody earn nothing**, and a company with no shareholders pays nothing.
- **Dividends come from the bank**, not the company treasury.
- **The game end is checked after each complete turn action**, including any Streamside bonus cube from that action.
- **A turn that both fills the eleventh round space and triggers the game end pays one dividend**, which is the final one.
- **Ties go to the player holding fewer shares in total.** If still tied, the win is shared and recorded as a draw.

## Not implemented

The _Strictly Grocers_ and _Vanilla_ variants are not offered. The Vanilla text conflicts with itself: removing two cubes of each colour does not leave every company with the same number of cubes.
