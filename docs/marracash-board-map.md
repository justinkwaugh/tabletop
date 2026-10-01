# MarraCash board map

The board as data, for building the game's map. It was read from `Marracash_Tablero.jpg` and matches the original board in `Original_Board.png` and `Original_board_2.jpg` cell for cell. The annotated image `my-materials/marracash/Marracash_Tablero_routes.jpg` (not committed, because it's drawn on the third-party image) shows the fountain numbers, shop IDs and every route.

## Grid

The board is a grid of 13 columns by 9 rows. Rows are numbered from the top and columns from the left, both starting at 0.

```
     0   1   2   3   4   5   6   7   8   9   10  11  12
0    Y1  P1  G1  G1  R1  R1  .   .   .   1*  .   .   2
1    Y1  P1  .   .   .   .   3   B1  P2  .   G2  G2  .
2    .   .   4   Y2  Y2  P3  .   B1  P2  .   R2  R2  .
3    .   B2  .   R3  ##  P3  5   .   .   6   .   7   .
4    .   B2  .   R3  Y3  Y3  .   G3  B3  B3  Y4  .   P4
5    8*  .   9   .   10  .   11  G3  R4  R4  Y4  .   P4
6    .   G4  B4  B4  .   R5  .   .   12  .   .   13  ##
7    .   G4  Y5  Y5  .   R5  P5  P5  .   B5  B5  .   G5
8    14  .   .   .   15  .   .   .   16* .   .   .   G5
```

- `.` is walkway.
- A number is a fountain. `*` marks the three entrance fountains: 1 (top), 8 (left) and 16 (bottom).
- `##` is a palm tree, which blocks movement.
- Shops are a colour letter (`R`ed, `B`lue, `G`reen, `P`urple, `Y`ellow) and a number. Each shop covers 2 cells. There are 25 shops, 5 of each colour.

## How the routes were worked out

These follow the rulebook ("move all visitors currently at that fountain to the first fountain in the direction you choose") and the forum ruling on following corners:

1. Leave the fountain in one of the four directions, onto a walkway cell.
2. Go straight until the next cell is blocked by a shop, a palm tree or the wall, then turn into the only open side.
3. Stop at the first fountain reached.

On this board the rule is never ambiguous. Wherever a route has to turn, exactly one way is open. Every route also works the same in reverse, every walkway cell is on at least one route, and each entrance has three exits, matching the rulebook picture of a group leaving the entrance "towards one of the three indicated fountains". That gives 23 two-way connections, or 46 one-way moves.

## Shops passed

A visitor passes a shop when a cell on its route, including the fountain where it stops, is next to the shop. Every shop edge facing a walkway counts as a door. The starting fountain doesn't count, because the visitors are already there.

Shops are listed in the order they're passed. `&` joins shops passed at the same step. No cell is next to two shops of the same colour, so that never decides which shop a visitor enters. Entrance fountains aren't next to any shop. Fountains 3, 4, 5, 6, 7, 9, 10, 11 and 12 are each next to one shop, which matters for the auction pull-in.

| From | Direction | To | Steps | Shops passed |
|---|---|---|---|---|
| 1 | east | 2 | 3 | G2 |
| 1 | south | 6 | 3 | G2 & P2 → R2 → B3 |
| 1 | west | 3 | 4 | P2 → B1 → R1 |
| 2 | south | 7 | 4 | G2 → R2 → P4 |
| 2 | west | 1 | 3 | G2 |
| 3 | north | 1 | 4 | R1 → B1 → P2 |
| 3 | south | 5 | 2 | B1 & P3 |
| 3 | west | 4 | 5 | P3 & R1 → Y2 → G1 → P1 |
| 4 | north | 3 | 5 | G1 & P1 → Y2 → R1 → P3 → B1 |
| 4 | south | 9 | 3 | B2 & R3 → B4 |
| 4 | west | 8 | 5 | B2 & P1 → Y1 |
| 5 | north | 3 | 2 | B1 & P3 |
| 5 | east | 6 | 3 | B1 & G3 → B3 & P2 |
| 5 | south | 11 | 2 | G3 & Y3 |
| 6 | north | 1 | 3 | P2 & R2 → G2 |
| 6 | east | 7 | 2 | R2 & Y4 |
| 6 | west | 5 | 3 | B3 & P2 → B1 & G3 → P3 |
| 7 | east | 2 | 4 | P4 → R2 → G2 |
| 7 | south | 13 | 3 | P4 & Y4 |
| 7 | west | 6 | 2 | R2 & Y4 → B3 |
| 8 | north | 4 | 5 | B2 → Y1 → P1 → Y2 |
| 8 | east | 9 | 2 | B2 & G4 → B4 |
| 8 | south | 14 | 3 | G4 |
| 9 | north | 4 | 3 | B2 & R3 → Y2 |
| 9 | east | 10 | 2 | B4 & R3 → Y3 |
| 9 | west | 8 | 2 | B2 & G4 |
| 10 | east | 11 | 2 | R5 & Y3 → G3 |
| 10 | south | 15 | 3 | B4 & R5 → Y5 |
| 10 | west | 9 | 2 | B4 & R3 |
| 11 | north | 5 | 2 | G3 & Y3 → P3 |
| 11 | south | 12 | 3 | P5 & R5 → G3 → R4 |
| 11 | west | 10 | 2 | R5 & Y3 |
| 12 | east | 13 | 3 | B5 & R4 → Y4 |
| 12 | south | 16 | 2 | B5 & P5 |
| 12 | west | 11 | 3 | G3 & P5 → R5 |
| 13 | north | 7 | 3 | P4 & Y4 → R2 |
| 13 | south | 16 | 5 | B5 & G5 |
| 13 | west | 12 | 3 | B5 & Y4 → R4 |
| 14 | north | 8 | 3 | G4 |
| 14 | east | 15 | 4 | G4 → Y5 |
| 15 | north | 10 | 3 | R5 & Y5 → B4 → Y3 |
| 15 | east | 16 | 4 | R5 → P5 |
| 15 | west | 14 | 4 | Y5 → G4 |
| 16 | north | 12 | 2 | B5 & P5 → R4 |
| 16 | east | 13 | 5 | B5 → G5 |
| 16 | west | 15 | 4 | P5 → R5 |
