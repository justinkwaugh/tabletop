# Promontory Point components

The inventory the data files transcribe. Ids are permanent: game state stores ids only, and an id once published is never reused or renamed.

## Id scheme

`<kind>.<group>.<name>` in kebab case. Board spaces use axial hex coordinates instead of a name: `space.<q>.<r>`, pointy-top hexes, origin at the Promontory space, `q` growing east and `r` growing south-east (row down). Every coordinate below was read from the supplied map.

## Railroads (4)

| Id            | Printed name     | Count | Printed values                    | Printed text     | Digest section |
| ------------- | ---------------- | ----- | --------------------------------- | ---------------- | -------------- |
| `railroad.cp` | Central Pacific  | 1     | colour blue; home hex at `-2,-4`  | CENTRAL PACIFIC  | R-0, R-1.1     |
| `railroad.up` | Union Pacific    | 1     | colour purple; home hex at `6,-4` | UNION PACIFIC    | R-0, R-1.1     |
| `railroad.kp` | Kansas Pacific   | 1     | colour red; home hex at `2,4`     | KANSAS PACIFIC   | R-0, R-1.1     |
| `railroad.sp` | Southern Pacific | 1     | colour yellow; home hex at `-6,4` | SOUTHERN PACIFIC | R-0, R-1.1     |

## Share cards (44)

| Id         | Printed name           | Count | Printed values | Printed text                 | Digest section      |
| ---------- | ---------------------- | ----- | -------------- | ---------------------------- | ------------------- |
| `share.cp` | Central Pacific share  | 11    | —              | ONE SHARE / CENTRAL PACIFIC  | R-1.1, R-3.1, R-3.2 |
| `share.up` | Union Pacific share    | 11    | —              | ONE SHARE / UNION PACIFIC    | R-1.1, R-3.1, R-3.2 |
| `share.kp` | Kansas Pacific share   | 11    | —              | ONE SHARE / KANSAS PACIFIC   | R-1.1, R-3.1, R-3.2 |
| `share.sp` | Southern Pacific share | 11    | —              | ONE SHARE / SOUTHERN PACIFIC | R-1.1, R-3.1, R-3.2 |

Shares of one railroad are interchangeable: state stores a count per railroad, not card ids. The share back reads SHARE CARD.

## Track markers (96)

| Id          | Printed name            | Count | Printed values | Printed text | Digest section |
| ----------- | ----------------------- | ----- | -------------- | ------------ | -------------- |
| `marker.cp` | Central Pacific marker  | 24    | —              | —            | R-1.1, R-3.3   |
| `marker.up` | Union Pacific marker    | 24    | —              | —            | R-1.1, R-3.3   |
| `marker.kp` | Kansas Pacific marker   | 24    | —              | —            | R-1.1, R-3.3   |
| `marker.sp` | Southern Pacific marker | 24    | —              | —            | R-1.1, R-3.3   |

No art is supplied for the markers; they are drawn in code in their railroad's colour (R-X.4).

## Town tiles (48)

The counts per kind are provisional (R-1.1-H1).

| Id                   | Printed name     | Count | Printed values | Printed text            | Digest section      |
| -------------------- | ---------------- | ----- | -------------- | ----------------------- | ------------------- |
| `tile.price.plus-1`  | +1               | 5     | +1             | +1                      | R-4.2               |
| `tile.price.plus-2`  | +2               | 8     | +2             | +2                      | R-4.2               |
| `tile.price.plus-3`  | +3               | 6     | +3             | +3                      | R-4.2               |
| `tile.price.minus-1` | −1               | 3     | −1             | −1                      | R-4.2               |
| `tile.price.minus-2` | −2               | 6     | −2             | −2                      | R-4.2               |
| `tile.price.minus-3` | −3               | 4     | −3             | −3                      | R-4.2               |
| `tile.red.dividend`  | $ (Pay day)      | 8     | 2 per share    | $ symbol, red tile      | R-4.2, R-6.1        |
| `tile.red.hammer`    | hammer (Illness) | 8     | 2 per share    | hammer symbol, red tile | R-4.2, R-4.3, R-6.1 |

## Board spaces (123)

| Id                                                     | Printed name   | Count | Printed values              | Printed text     | Digest section |
| ------------------------------------------------------ | -------------- | ----- | --------------------------- | ---------------- | -------------- |
| `space.0.0`                                            | Promontory, UT | 1     | +5                          | PROMONTORY UT +5 | R-4.2          |
| village spaces (dark hexes)                            | —              | 48    | one town tile each at setup | —                | R-1.3          |
| empty spaces (light hexes, and the coastal hex `-6,5`) | —              | 74    | —                           | —                | R-3.3          |

Village spaces: `2,-6`, `4,-6`, `0,-5`, `2,-5`, `3,-5`, `5,-5`, `1,-4`, `3,-4`, `-1,-3`, `4,-3`, `-3,-2`, `0,-2`, `1,-2`, `2,-2`, `5,-2`, `-5,-1`, `-3,-1`, `-1,-1`, `2,-1`, `4,-1`, `6,-1`, `-6,0`, `-5,0`, `-2,0`, `2,0`, `5,0`, `6,0`, `-6,1`, `-4,1`, `-2,1`, `1,1`, `3,1`, `5,1`, `-5,2`, `-2,2`, `-1,2`, `0,2`, `3,2`, `-4,3`, `1,3`, `-3,4`, `-1,4`, `-5,5`, `-3,5`, `-2,5`, `0,5`, `-4,6`, `-2,6`.

Empty spaces: `0,-6`, `1,-6`, `3,-6`, `5,-6`, `6,-6`, `-1,-5`, `1,-5`, `4,-5`, `6,-5`, `-1,-4`, `0,-4`, `2,-4`, `4,-4`, `5,-4`, `-3,-3`, `-2,-3`, `0,-3`, `1,-3`, `2,-3`, `3,-3`, `5,-3`, `6,-3`, `-4,-2`, `-2,-2`, `-1,-2`, `3,-2`, `4,-2`, `6,-2`, `-4,-1`, `-2,-1`, `0,-1`, `1,-1`, `3,-1`, `5,-1`, `-4,0`, `-3,0`, `-1,0`, `1,0`, `3,0`, `4,0`, `-5,1`, `-3,1`, `-1,1`, `0,1`, `2,1`, `4,1`, `-6,2`, `-4,2`, `-3,2`, `1,2`, `2,2`, `4,2`, `-6,3`, `-5,3`, `-3,3`, `-2,3`, `-1,3`, `0,3`, `2,3`, `3,3`, `-5,4`, `-4,4`, `-2,4`, `0,4`, `1,4`, `-4,5`, `-1,5`, `1,5`, `-6,5`, `-6,6`, `-5,6`, `-3,6`, `-1,6`, `0,6`.

Not spaces: the four home hexes (above). The mostly sea-covered hex `-6,5` below the Southern Pacific home counts as an empty space (R-1.1-H3), so every home touches 4 spaces.

## Tracks

| Id            | Printed name      | Count                         | Printed values                                             | Printed text | Digest section |
| ------------- | ----------------- | ----------------------------- | ---------------------------------------------------------- | ------------ | -------------- |
| `track.price` | share-price track | 1 (shared by the 4 railroads) | 25 … 3, 2, 1, 0, 0, 0, 0, 0 (30 spaces); start marked at 5 | —            | R-1.2          |
| `track.money` | border track      | 1                             | 0–99                                                       | —            | R-1.3-H1       |

## Totals

| Kind                      | Rulebook says           | Rows above                            |
| ------------------------- | ----------------------- | ------------------------------------- |
| entertainer / share cards | 44                      | 44                                    |
| travel / track markers    | 96                      | 96                                    |
| village / town tiles      | 48                      | 48                                    |
| village spaces            | 48 (one tile per space) | 48                                    |
| headquarters / home hexes | 4                       | 4                                     |
| marking pieces            | 4                       | 4 (one per railroad on `track.price`) |
