# Locomotive Werks

`@tabletop/locomotive-werks` is the deterministic logic package for Locomotive Werks, Dieter Danziger's game of developing, producing and selling locomotives, for 3–5 players. Its companion Game Client package is `@tabletop/locomotive-werks-ui`.

## Rules

The default rules are the Queen Games edition (2012), with starting cash of $10 for three players, $12 for four and $14 for five. Each round runs Locomotive Development, Production Capacity, Locomotive Production, Pay Taxes and Market Demands, and the game ends once a player has $300 or more after taxes. The richest player wins, and tied players win together.

Two options change the setup or the round:

- **Starting Cash** can instead be **Queen Start Money** ($12 for three or four players, $14 for five) or **Winsome Starting Cash** ($10 for three or four players, $14 for five).
- **Buy and Ship** merges Production Capacity with the first selling round: each player in turn buys and upgrades production units, then ships straight away before the next player buys. Further selling rounds follow as usual.

A player's whole Production Capacity turn is one action, which can also ask to ship automatically. That player's selling turns are then taken for them, shipping everything they can, until that Production phase ends. Shipping everything never loses a sale, since each shipment's size follows from the units and the order dice; holding back only matters for tactics such as taxes, Player Order or keeping an order die high for the next round.

Where the rulebook is silent or ambiguous, the choices made are recorded in [rules interpretations](docs/rules-interpretations.md), each backed by a test.

## Model

The fourteen locomotives, their costs, card counts and Customer Base sizes are rule data in `src/model/locomotives.ts`, in the board's chain order. Game State keeps each locomotive's dice and remaining supply cards (`spaces`), each player's cash, werks (`plants`) and the locomotives they have developed, and the selling round in progress. Selling and Market Demands are pure functions in `src/model/market.ts`.

Market Demands and each new Initial Orders die are rolled from the protected random stream, so no client can work out a roll before it is made, and the Actions that roll reveal information, so Undo stops at them. The runtime registers visibility to withhold the master seed and that stream from every client (`src/definition/visibility.spec.ts`); nothing else is hidden. Tournament seating is covered by `src/definition/competition.spec.ts`.
