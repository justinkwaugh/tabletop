# Ride the Rails components

The inventory the data files transcribe. Ids are permanent: game state stores ids only, and an id once published is never reused or renamed.

The map tables (hexes, cities, start colours, bonus cities, blocked hexsides) are gaps until the boards are supplied: no rulebook draws the maps (`rules-digest.md`, Sources).

## Id scheme

`<kind>.<group>.<name>` in kebab case. Groups are the rulebook's own groupings.

- `railroad.<colour>`: `railroad.red`
- `map.<map>`: `map.usa`
- `city.<map>.<name>`: `city.usa.chicago`, `city.de.berlin`
- `hex.<map>.<col>-<row>`: coordinates fixed when the map is transcribed (offset scheme chosen in the spec)
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

Gap until the board is supplied. Tables owed: hexes (id, terrain: plain or mountain), cities (id, printed name, hex, start colours, capacity, passenger at setup), the six East Coast cities, the four Purple & Black West Coast cities, Chicago, the four $5 cities.

## Map: Australia

Gap until the board is supplied. Tables owed: hexes (plain, mountain, Alps, long-distance), cities with start colours, Perth and Brisbane, the railroad introduction order and start cities (R-1.4).

## Map: Canada

Gap until the board is supplied. Tables owed: hexes, cities with start colours, Toronto, the three Intercolonial cities, impassable hexsides, the railroad introduction order and start cities (R-1.4).

## Map: France

Gap until the board is supplied. Tables owed: hexes (plain, mountain), cities with start colours, the four Red/Blue/Black cities, Paris and its six entry hexes, the four impassable estuaries.

## Map: Germany

Gap until the board is supplied. Tables owed: hexes (plain, mountain), cities with start colours, Berlin's two hexes, the Purple & Black cities, the five Greater Germany cities.

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
