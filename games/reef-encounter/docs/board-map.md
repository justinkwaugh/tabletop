# Reef Encounter: reef board map

Transcribed 2026-10-08 from photos of the four reef boards, and checked by the user against their copy on 2026-10-09.

Each board is read on a 7-column by 6-row grid, with row 0 at the top and column 0 at the left. Squares use `OffsetCoordinates` (`row`, `col`).

Legend:

- `.` rock: polyps can be placed here
- `#` sand: inside the outline, but no polyps
- (blank) off the board
- `G` `O` `P` `W` `Y`: the starting polyp (grey, orange, pink, white, yellow), on rock
- `*` the extra-growth (starfish) square, on rock

```
        Board 1      Board 2      Board 3      Board 4
col     0123456      0123456      0123456      0123456
row 0   .. ...       .......       .. ..          ...
row 1   ..G.P.       ..O#P..       .Y.P.       ...G..
row 2   .#.*...      .#.*.G.      ...*.W.      ..Y.#..
row 3   .Y.#W..      ..W.#..      ..G.#..      .#.*.W.
row 4    .O...        ..Y..       ..#O...      ..O.P..
row 5   ... ..        ...          .....        .....
```

## Per board

| Board | Sand | Starting polyps | Extra growth | Rock squares |
|---|---|---|---|---|
| 1 | (2,1), (3,3) | G (1,2), P (1,4), Y (3,1), W (3,4), O (4,2) | (2,3) | 33 |
| 2 | (1,3), (2,1), (3,4) | O (1,2), P (1,4), G (2,5), W (3,2), Y (4,3) | (2,3) | 33 |
| 3 | (3,4), (4,2) | Y (1,2), P (1,4), W (2,5), G (3,2), O (4,3) | (2,3) | 33 |
| 4 | (2,4), (3,1) | G (1,3), Y (2,2), W (3,5), O (4,2), P (4,4) | (3,3) | 33 |

Coordinates are (row, col).

## How it was read

- The outline and squares come from the white grid on the images.
- Sand was judged by how much of each square is dark: the sand squares are 73–100% dark. Four squares are about half dark (41–54%): board 2 (3,3), board 3 (3,3), board 4 (4,0) and (4,3). The user confirmed all four are rock.
- Every board has 33 rock squares.
- The extra-growth square is the one with the red starfish on the raised rock.
