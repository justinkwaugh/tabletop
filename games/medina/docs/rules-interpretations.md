# Medina rule interpretations

The implementation follows the second edition (2014) rulebook. This file records the reconstructed data and the rulings the rulebook leaves open; each ruling is covered by `src/model/rules.spec.ts` or `src/definition/playthrough.spec.ts`.

## Reconstructed data

- **Tile values.** Palace tiles score grey 1, purple 2, brown 3, orange 4. Tower tiles carry the number of their tower: 1 north-west, 3 north-east, 4 south-west, 2 south-east. The rulebook only says "1-4 points"; these are printed on the published tiles and board.
- **Boards.** 16 by 11 spaces for three or four players, 14 by 10 for two, as the rulebook gives. Walls sit on a track around the city; each side has one wall space per city space beside it.

## Rulings

- **The well bonus.** The rulebook's well section reads as 4 points per palace, its scoring section as 4 points per building or stable. The worked example scores a palace 8 for two buildings, so the bonus is 4 per building or stable one orthogonal space from the well. A merchant standing in the space between does not cancel it.
- **Hidden supply.** The physical game keeps pieces behind screens, but every placement is public and the history shows it, so a player could always count them. Supply is open by default. The Hidden pieces option protects each player's counts of buildings, stables, merchants and walls: the host never sends them to other players or spectators until the game is played to its end, and rooftops and tea tiles stay public. A game that ends by Call, Concede or Stall keeps them hidden, as Hidden Money does in Estates. Placements stay public, so counts can still be tracked by hand, as at a real table. Exploration is unavailable in these games, and the last placement of a turn waits for the host, because the next turn depends on hidden supplies.
- **Tea break.** The rulebook has a tea break replace one of a turn's two placements, so it can be taken before the first piece or after it: taken after, it ends the turn. Only one per turn, and not on a turn that already places only one piece.
- **New palaces.** A building must extend an unfinished palace of its colour when any such palace can grow. Only when none can may it start a new palace. It must touch a building of the palace, not just its stable.
- **Palace tile.** The tile belongs to a palace, not a player: it moves only to a strictly larger palace of that colour, when that palace is claimed or a stable enlarges it after its claim. A neutral palace can hold it, and then nobody scores it.
- **Tower tile.** The tile moves when a palace bordering that tower's wall is claimed, when a wall reaches a claimed palace, or when a stable beside a wall extends a claimed palace. The first holder takes its merchants; a neutral first holder removes them from the game. The rulebook's note that a first claim beside a wall also takes "the corresponding palace tile" adds nothing beyond the palace tile rule above.
- **New market street.** When neither end of the street can grow, a new street starts on any free space touching no merchant. The rulebook says any free space, but also that a merchant may not join two merchants; keeping clear of every merchant is how Board Game Arena reads it. Only the newest street can grow, since the old one's ends can never reopen.
- **Stuck pieces.** The rulebook ends the game when all components are used, but pieces can become unplaceable, such as walls once every gap is a gate. A player with nothing placeable is skipped, and rejoins if a later placement frees something. The game ends when nobody can place anything. A turn also ends early if the second placement has become impossible.
- **Starting positions.** Seat one takes the first turn, and the single-placement opening follows the seats.
- **Ties.** Tied highest totals share the win and the result is a draw; the rulebook names no tiebreak.
