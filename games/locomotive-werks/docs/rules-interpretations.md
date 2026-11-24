# Rules interpretations

The default rules are the Queen Games rulebook. Where it is silent or ambiguous, the implementation makes the choices below. Each is covered by a test in `src/definition/rules.spec.ts` or `src/model/market.spec.ts`.

## Board

- **Box counts come from the tabloid map.** Each locomotive has as many Existing Orders boxes as Customer Base boxes: Passenger 3, 4, 4, 5, 5; Fast 3, 3, 4, 4; Freight 2, 3, 3; Special 1, 2.
- **Production Unit counters are unlimited.** The game has 80 double-sided counters, which no realistic game exhausts.
- **The dice pool holds twenty dice.** Market Demands adds only the dice left in the pool, and a development rolls no new Initial Orders die when the pool is empty.

## Locomotive Development

- **A player never develops the same locomotive twice**, even after its card has left play because every unit moved to newer technology.
- **Older cards leave play only when a generation is first brought into play.** The development that slides the Initial Orders die of a third, fourth or fifth generation removes the unbought cards of that kind two generations older.
- **A player who cannot afford any development is passed over**, rather than asked to pass.

## Production Capacity

- **Upgrading moves units only to a locomotive later in the board's chain**, which always has a higher production cost, and only to a card the player owns.
- **A player with nothing they can afford to buy or upgrade is passed over.** A player's turn ends on its own once they can spend nothing more.

## Locomotive Production

- **Shipping is optional.** In each selling turn a player chooses which of their locomotives to ship; the number shipped and the die it fills follow the rulebook's three cases. A player may hold everything back.
- **Selling rounds end the phase when nobody shipped in a whole round**, or when no player has a locomotive with Existing Orders left to ship. Players with nothing to ship are passed over.
- **A shipment matching any die fills that die**, even when a higher die could be lowered instead.

## Market Demands

- **With four or more generations of a kind, every generation older than the newest two is obsolete.** The rulebook covers up to three; several developments of one kind in a single round can bring a fourth into play.

## Buy and Ship

- **Buy and Ship merges Production Capacity with the first selling round.** Locomotive Development is unchanged. Then each player in Player Order buys and upgrades production units and immediately takes their first selling turn, before the next player buys. A player who can buy nothing goes straight to shipping; one who can ship nothing ends their turn after buying. Later selling rounds run as usual.
