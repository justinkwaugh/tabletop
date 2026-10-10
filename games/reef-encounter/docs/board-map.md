# Reef Encounter: reef board map

The four reef boards as they appear in the official art (`Board1.png` to `Board4.png`, R&D Games), numbered as those files are. First transcribed 2026-10-08 from photos and checked by the user against a printed copy on 2026-10-09; on 2026-10-10 the same maps were turned to the official orientation and numbering, and agreed square for square with a separate reading of the official art.

Each board is read on a 6-column by 7-row grid, with row 0 at the top and column 0 at the left. Squares use `OffsetCoordinates` (`row`, `col`).

Legend:

- `.` rock: polyps can be placed here
- `#` sand: inside the outline, but no polyps (open water in the art)
- (blank) off the board
- `G` `O` `P` `W` `Y`: the starting polyp (grey, orange, pink, white, yellow), on rock
- `*` the extra-growth (starfish) square, on rock

```
        Board 1     Board 2     Board 3     Board 4
col     012345      012345      012345      012345
row 0     ...        ...          ..          ....
row 1   ...W..      ......      ......      ...#..
row 2   ..#.P.      .#G.Y.      .P.W..      ..W.O.
row 3   .G.*..      .O.*.       ..*#.       .Y.*#.
row 4    .Y.O.      ..#.P.       G..O.       .#.P.
row 5    ..#..      ...W..      ..#Y..       ..G..
row 6    ....        ...        .... .        ....
```

## Per board

| Board | Sand                | Starting polyps                             | Extra growth | Rock squares |
| ----- | ------------------- | ------------------------------------------- | ------------ | ------------ |
| 1     | (2,2), (5,3)        | W (1,3), P (2,4), G (3,1), Y (4,2), O (4,4) | (3,3)        | 33           |
| 2     | (2,1), (4,2)        | G (2,2), Y (2,4), O (3,1), P (4,4), W (5,3) | (3,3)        | 33           |
| 3     | (3,3), (5,2)        | P (2,1), W (2,3), G (4,1), O (4,4), Y (5,3) | (3,2)        | 33           |
| 4     | (1,3), (3,4), (4,2) | W (2,2), O (2,4), Y (3,1), P (4,4), G (5,3) | (3,3)        | 33           |

Coordinates are (row, col).

## In the art

- Each image is 2717 by 3744 pixels. The grid's top-left corner is at about (330, 668) and its squares are about 342 pixels across.
- Sand squares show open water through the rock; the extra-growth square is a pale raised slab.
- Grey polyps are drawn as a pale, curled cup and white polyps as a branching outline, so the starting polyps were told apart by shape.
