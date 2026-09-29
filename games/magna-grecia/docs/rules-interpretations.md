# Magna Grecia rule interpretations

The implementation follows the reformatted Rio Grande rulebook. This file records the reconstructed data and the rulings the rulebook leaves open; each ruling is covered by `src/model/rules.spec.ts` or `src/definition/playthrough.spec.ts`.

## Reconstructed data

- **Board.** `src/components/boardGrid.ts` is transcribed from overhead photos of the published board: 16 rows of pointy hexes with odd rows shifted right, 10 green-bordered (frontier) villages on the edges and 32 inland villages. No two villages are adjacent. Sea spaces and the southern bay are excluded.
- **Action cards.** Seven cards are read from published photos: Y1, Y2, O1, R1, B1, B2 and B3. Y3, O2, O3, R2 and R3 are reconstructed so that each border colour leads three cards with a spread of road, city and resupply values. Replace them in `src/components/actionCards.ts` if the printed values become available.

## Rulings

- **Road tiles.** The straight side joins opposite edges and the curved side joins edges two apart, giving nine orientations. At least one end must meet a city (any colour), the player's own joining road, or a village or oracle the player's road already enters. A road may not join an opponent's road end; it may cut one off.
- **Direct connections.** Two places are connected when a chain of joined road tiles runs between them. A tile end meeting anything but a joining road or a place is a dead end.
- **Tiles beside a village.** A city tile may be placed beside exactly one open village only if the next tile covers that village. The pair must be affordable in allowance, supply and points; until the second tile is placed the player can do nothing else. Only the two-tile form of the rulebook's founding exception (example E) is supported.
- **Merging.** A tile adjacent to several of the player's cities merges them into the oldest. Markets and oracle attention follow the merged city. No market is ever lifted or un-sold by a merge or village claim, so a player can end up with two markets in one place; both stay as they were. The one-market-per-place limit governs building.
- **Founding market.** The free market is placed when the founding completes, which is on the village tile for a two-tile founding.
- **Oracle attention.** Attention is re-evaluated after every road and city tile. An oracle turns only to a connected city with strictly more connections than the city it favours; among equally important newcomers the oldest city wins.
- **Markets.** Market supply is derived as 20 minus the player's markets on the board, sold ones included. A market may be sold only while active, even if its current value is 0.
- **Ties.** Tied highest totals share the win and the result is a draw.
