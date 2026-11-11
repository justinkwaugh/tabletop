# Ride the Rails components

The inventory the data files transcribe. Ids are permanent: game state stores ids only, and an id once published is never reused or renamed.

The map tables are transcribed from the printed boards, since no rulebook draws the maps (`rules-digest.md`, Sources). The USA map is done; the expansion maps are deferred.

## Id scheme

`<kind>.<group>.<name>` in kebab case. Groups are the rulebook's own groupings.

- `railroad.<colour>`: `railroad.red`
- `map.<map>`: `map.usa`
- `city.<map>.<name>`: `city.usa.chicago`, `city.de.berlin`
- `hex.<map>.<row>-<dcol>`: row from the top, doubled column (see Map: USA, Coordinates)
- `hexside.<map>.<hex>.<edge>`: impassable hexsides
- `bonus.<map>.<name>`: `bonus.usa.transcontinental`

Map groups: `usa`, `au`, `ca`, `fr`, `de`.

## Railroads (6)

Each railroad's locomotives serve both as shares (R-3.1) and as track (R-3.2).

| Id                | Printed name | Count          | Printed values                      | Printed text | Digest section |
| ----------------- | ------------ | -------------- | ----------------------------------- | ------------ | -------------- |
| `railroad.red`    | Red          | 27 locomotives | available round 1                   | —            | R-1.4, R-4.2.1 |
| `railroad.blue`   | Blue         | 27 locomotives | available round 1                   | —            | R-1.4, R-4.2.1 |
| `railroad.orange` | Orange       | 27 locomotives | available round 2 (round marker II) | —            | R-1.4, R-4.2.2 |
| `railroad.yellow` | Yellow       | 27 locomotives | available round 3 (III)             | —            | R-1.4, R-4.2.3 |
| `railroad.purple` | Purple       | 27 locomotives | available round 4 (IV)              | —            | R-1.4, R-4.2.4 |
| `railroad.black`  | Black        | 27 locomotives | available round 5 (V)               | —            | R-1.4, R-4.2.5 |

## Maps (5)

| Id        | Printed name         | Count        | Printed values                             | Printed text              | Digest section |
| --------- | -------------------- | ------------ | ------------------------------------------ | ------------------------- | -------------- |
| `map.usa` | Ride the Rails (USA) | 1 board      | limits 8 / 5 / 4, mountain −1              | placement reminders (R-7) | R-8.1          |
| `map.au`  | Australia            | 1 board side | limits 8 / 5 / 4, mountain −2              | —                         | R-8.2          |
| `map.ca`  | Canada               | 1 board side | limits 7 / 5 / 4, no mountains             | —                         | R-8.3          |
| `map.fr`  | France               | 1 board side | limits 8 / 5 / 4, mountain −1              | —                         | R-8.4          |
| `map.de`  | Germany              | 1 board side | limits 8 / 5 / 4, mountain −1 (not Orange) | —                         | R-8.5          |

## Bonuses (10 printed, 11 ids)

| Id                           | Printed name     | Count                       | Printed values                  | Printed text | Digest section |
| ---------------------------- | ---------------- | --------------------------- | ------------------------------- | ------------ | -------------- |
| `bonus.usa.chicago`          | Chicago          | each placement              | $2                              | —            | R-4.3.1        |
| `bonus.usa.five-dollar`      | $5 cities        | 4 cities, once each         | $5                              | —            | R-4.3.2        |
| `bonus.usa.transcontinental` | Transcontinental | once                        | $12 in a city hex, $8 elsewhere | —            | R-4.3.3        |
| `bonus.au.perth`             | Perth            | once (capacity 1)           | 50                              | —            | R-8.2.5        |
| `bonus.au.brisbane`          | Brisbane         | once (capacity 1)           | 20                              | —            | R-8.2.5        |
| `bonus.ca.toronto-build`     | Toronto          | each build into Toronto     | $3                              | —            | R-8.3.3        |
| `bonus.ca.toronto-start`     | Toronto          | each railroad started there | $2                              | —            | R-8.3.3        |
| `bonus.ca.intercolonial`     | Intercolonial    | once                        | $8                              | —            | R-8.3.4        |
| `bonus.fr.paris`             | Paris            | each build into Paris       | $10                             | —            | R-8.4.3        |
| `bonus.de.berlin`            | Berlin           | each build into Berlin      | $3                              | —            | R-8.5.3        |
| `bonus.de.greater-germany`   | Greater Germany  | once                        | $12                             | —            | R-8.5.5        |

The two Toronto rows are one printed banner ("$3/$2"); they are separate ids because they pay on different events.

## Passengers (52)

| Id          | Printed name | Count | Printed values | Printed text | Digest section |
| ----------- | ------------ | ----- | -------------- | ------------ | -------------- |
| `passenger` | Passenger    | 52    | —              | —            | R-1.3, R-3.3   |

Passengers are identical; state records which cities hold one, not passenger ids.

## Player pieces (5 colours)

| Id             | Printed name | Count             | Printed values              | Printed text | Digest section |
| -------------- | ------------ | ----------------- | --------------------------- | ------------ | -------------- |
| `player-board` | Player board | 5                 | a share row per railroad    | —            | R-3.1          |
| `player-disk`  | Player disk  | 15 (3 per colour) | money, hundreds, turn order | —            | R-1.3, R-2.4   |

Seat colours are the platform's; the printed colours are not carried over.

## Tracks and markers

| Id                 | Printed name     | Count         | Printed values                                       | Printed text | Digest section |
| ------------------ | ---------------- | ------------- | ---------------------------------------------------- | ------------ | -------------- |
| `track.round`      | Round track      | 1             | rounds I–VI, with the railroads available in each    | —            | R-1.4          |
| `track.turn-order` | Turn order track | 1             | 5 spaces                                             | —            | R-2.3          |
| `track.money`      | Money track      | 1             | 0–99, plus hundreds track                            | —            | R-2.4          |
| `track.links`      | Counting chart   | 1             | per-railroad link count, active player's fare from 1 | —            | R-3.3.5        |
| `marker.round`     | Round marker     | 1             | —                                                    | —            | R-1.3          |
| `marker.tracker`   | Tracker disks    | 6 + 1 hexagon | —                                                    | —            | R-3.3.5        |

The counting chart and its trackers are bookkeeping: the game computes link counts and payments directly and shows them; it needs no state for them.

## Map: USA

Transcribed from an image of the printed board, twice independently, and reconciled hex by hex. 386 hexes in 19 rows: 286 plain, 49 mountain, 51 cities. No impassable hexsides.

**Coordinates.** Hexes are pointy-topped in horizontal rows, alternate rows offset by half a hex. `row` counts down from 0 (Seattle's row). `dcol` is the doubled column: horizontal position in half-hex widths, Seattle at 4; in every row, dcol has the same parity as row. Neighbours of (r, d): (r, d±2), (r±1, d±1). A hex's id is `hex.usa.<row>-<dcol>`, for example `hex.usa.5-43` for Chicago.

### Cities (51)

| Id                        | Printed name      | Hex   | Start colours            | Capacity | Bonus                                       | Passenger at setup | Digest section |
| ------------------------- | ----------------- | ----- | ------------------------ | -------- | ------------------------------------------- | ------------------ | -------------- |
| `city.usa.seattle`        | Seattle           | 0-4   | Purple, Black            | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.spokane`        | Spokane           | 0-10  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.billings`       | Billings          | 0-22  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.fargo`          | Fargo             | 0-32  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.butte`          | Butte             | 1-17  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.bismarck`       | Bismarck          | 1-27  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.green-bay`      | Green Bay         | 1-43  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.portland-or`    | Portland (Oregon) | 2-4   | Purple, Black            | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.minneapolis`    | Minneapolis       | 2-36  | —                        | 2        | $5 first build-in (`bonus.usa.five-dollar`) | 1                  | R-4.1, R-4.2   |
| `city.usa.portland-me`    | Portland (Maine)  | 2-64  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.rapid-city`     | Rapid City        | 3-25  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.milwaukee`      | Milwaukee         | 3-41  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.boise`          | Boise             | 4-10  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.pocatello`      | Pocatello         | 4-16  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.detroit`        | Detroit           | 4-48  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.buffalo`        | Buffalo           | 4-52  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.albany`         | Albany            | 4-58  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.boston`         | Boston            | 4-62  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.cheyenne`       | Cheyenne          | 5-23  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.omaha`          | Omaha             | 5-31  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.des-moines`     | Des Moines        | 5-37  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.chicago`        | Chicago           | 5-43  | Orange, Yellow, Black    | no limit | $2 each placement (`bonus.usa.chicago`)     | 1                  | R-4.1, R-4.2   |
| `city.usa.salt-lake-city` | Salt Lake City    | 6-16  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.new-york`       | New York          | 6-60  | Blue, Red, Orange, Black | 1        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.reno`           | Reno              | 7-7   | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.pittsburgh`     | Pittsburgh        | 7-51  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.philadelphia`   | Philadelphia      | 7-57  | Blue, Red, Orange, Black | 1        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.denver`         | Denver            | 8-22  | —                        | 2        | $5 first build-in (`bonus.usa.five-dollar`) | 1                  | R-4.1, R-4.2   |
| `city.usa.kansas-city`    | Kansas City       | 8-32  | —                        | 2        | $5 first build-in (`bonus.usa.five-dollar`) | 1                  | R-4.1, R-4.2   |
| `city.usa.saint-louis`    | Saint Louis       | 8-38  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.cincinnati`     | Cincinnati        | 8-46  | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.san-francisco`  | San Francisco     | 9-5   | Purple, Black            | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.baltimore`      | Baltimore         | 9-55  | Blue, Red, Orange, Black | 1        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.las-vegas`      | Las Vegas         | 10-14 | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.oklahoma-city`  | Oklahoma City     | 10-30 | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.nashville`      | Nashville         | 10-42 | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.santa-fe`       | Santa Fe          | 11-21 | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.little-rock`    | Little Rock       | 11-37 | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.washington`     | Washington        | 11-55 | Blue, Red, Orange, Black | 1        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.los-angeles`    | Los Angeles       | 12-10 | Purple, Black            | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.atlanta`        | Atlanta           | 12-46 | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.charleston`     | Charleston        | 12-52 | Blue, Red, Orange, Black | 1        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.phoenix`        | Phoenix           | 13-17 | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.dallas`         | Dallas            | 13-31 | —                        | 2        | $5 first build-in (`bonus.usa.five-dollar`) | 1                  | R-4.1, R-4.2   |
| `city.usa.el-paso`        | El Paso           | 14-24 | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.jacksonville`   | Jacksonville      | 14-50 | Blue, Red, Orange, Black | 1        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.houston`        | Houston           | 15-35 | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.new-orleans`    | New Orleans       | 15-41 | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.tampa`          | Tampa             | 16-48 | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.corpus-christi` | Corpus Christi    | 17-31 | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |
| `city.usa.miami`          | Miami             | 18-50 | —                        | 2        | —                                           | 1                  | R-4.1, R-4.2   |

Groups the rules name:

- **East Coast cities (6)**, Blue, Red, Orange and Black, capacity 1, at most two per railroad (R-4.1.4): New York, Philadelphia, Baltimore, Washington, Charleston, Jacksonville. The Transcontinental's eastern end (R-4.3.3).
- **Purple & Black West Coast cities (4)** (R-4.2.4): Seattle, Portland (Oregon), San Francisco, Los Angeles. The Transcontinental's western end.
- **Chicago**, Orange, Yellow and Black, no limit, $2 (R-4.1.4, R-4.2, R-4.3.1).
- **$5 cities (4)** (R-4.3.2): Minneapolis, Denver, Kansas City, Dallas.
- The names at 11-55 (Washington) and 12-52 (Charleston) are hard to read on the image; both transcriptions read them the same way.

### Terrain

Every non-city hex, by row, as dcol values. Cities are listed above.

| Row | Plain                                                              | Mountain             |
| --- | ------------------------------------------------------------------ | -------------------- |
| 0   | 8 12 16 18 20 24 26 28 30 34 36 38 64                              | 6 14                 |
| 1   | 3 7 9 11 19 21 23 25 29 31 33 35 37 39 41 63                       | 5 13 15              |
| 2   | 8 10 18 20 22 24 26 28 30 32 34 38 40 42 46 58 60 62               | 6 12 14 16           |
| 3   | 3 7 9 11 13 21 23 27 29 31 33 35 37 39 45 47 57 61                 | 5 15 17 19 59        |
| 4   | 4 8 12 14 20 22 24 26 28 30 32 34 36 38 40 42 46 54 56 60          | 6 18                 |
| 5   | 3 7 9 11 13 15 17 19 21 25 27 29 33 35 39 41 45 47 53 55 59 61 63  | 5 57                 |
| 6   | 4 8 10 12 14 18 22 24 26 28 30 32 34 36 38 40 42 44 46 48 50 52 58 | 6 20 54 56           |
| 7   | 3 9 11 13 15 17 23 25 27 29 31 33 35 37 39 41 43 45 47 49 55       | 5 19 21 53           |
| 8   | 4 10 12 14 16 24 26 28 30 34 36 40 42 44 48 50 54 56               | 6 8 18 20 52         |
| 9   | 7 11 13 15 23 25 27 29 31 33 37 39 41 43 45 47 53                  | 9 17 19 21 35 49 51  |
| 10  | 6 8 12 16 22 24 26 28 32 38 40 44 46 52 54 56                      | 10 18 20 34 36 48 50 |
| 11  | 7 9 13 15 19 23 25 27 29 31 33 35 39 41 43 45 47 51 53             | 11 17 49             |
| 12  | 12 14 18 20 22 24 26 28 30 32 34 36 38 40 42 44 48 50              | 16                   |
| 13  | 11 13 15 19 21 23 25 27 29 33 35 37 39 41 43 45 47 49 51           | —                    |
| 14  | 18 20 22 26 28 30 32 34 36 38 40 42 44 46 48                       | —                    |
| 15  | 25 27 29 31 33 47 49                                               | —                    |
| 16  | 30 32 50                                                           | —                    |
| 17  | 49 51                                                              | —                    |
| 18  | —                                                                  | —                    |

### Board reminders

The round track shows, for each round, the railroads available and where each may start: in round III and later, Yellow's icon pairs a Chicago hex with a blank hex marked with a west arrow (R-4.2.3). The reminder panel restates R-3.1 (+1 share), R-3.2 (8 / 5 / 4 by player count, mountain −1) and R-4.1 (East Coast ×1, Chicago no limit, other hexes ×2, one locomotive per railroad in a hex).

## Map: Australia

Deferred with the expansion maps (not in the first release). Gap until the board is supplied. Tables owed: hexes (plain, mountain, Alps, long-distance), cities with start colours, Perth and Brisbane, the railroad introduction order and start cities (R-1.4).

## Map: Canada

Deferred with the expansion maps (not in the first release). Gap until the board is supplied. Tables owed: hexes, cities with start colours, Toronto, the three Intercolonial cities, impassable hexsides, the railroad introduction order and start cities (R-1.4).

## Map: France

Deferred with the expansion maps (not in the first release). Gap until the board is supplied. Tables owed: hexes (plain, mountain), cities with start colours, the four Red/Blue/Black cities, Paris and its six entry hexes, the four impassable estuaries.

## Map: Germany

Deferred with the expansion maps (not in the first release). Gap until the board is supplied. Tables owed: hexes (plain, mountain), cities with start colours, Berlin's two hexes, the Purple & Black cities, the five Greater Germany cities.

## Totals

| Kind                 | Rulebook says                                             | Rows above                    |
| -------------------- | --------------------------------------------------------- | ----------------------------- |
| Railroads            | 6                                                         | 6                             |
| Locomotives          | 162 (27 × 6)                                              | 6 × 27 = 162                  |
| Maps                 | 5 (1 base board, 2 double-sided expansion boards)         | 5                             |
| Bonuses              | 10 named across the rulebooks (the four $5 cities as one) | 11 ids (Toronto split in two) |
| Passengers           | 52                                                        | 52                            |
| Player boards        | 5                                                         | 5                             |
| Player disks         | 15                                                        | 15                            |
| Tracker disks        | 6 + 1 hexagon                                             | 7                             |
| Round marker         | 1                                                         | 1                             |
| Map hexes and cities | printed on the boards only                                | gap                           |
