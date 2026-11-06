# Feudum board map

The map as data: the 22 spaces and the 41 routes. `src/data/board.ts` holds them, and `src/data/boardMap.spec.ts` checks them against this file and the rows of `components.md`. Ids are permanent. A region's name is its terrain.

## How the routes are printed

- **Roads** are pale paths between locations. Three cross the river on stepping stones: forest-3--desert-4, badlands-2--badlands-4 and mountain-1--mountain-2.
- **Vessel routes** are trails of the small texture the rulebook's legend names for each vessel: chevrons for a ship, clusters of dots for a submersible, birds for a flying machine. A trail does not break at a location, so each stretch between two locations is one route (R-1.2-H1).
- **Ferries** have a shilling and rowboat icon at each end, and a drawn stream between (R-1.2.2).

The dashed lines on the map are the catapult arcs to the military spaces, not routes.

A space reached by a ship or submersible route is a port (R-1.2.2). Piers don't decide it: sea-3 is a port with none, and the pier pair on the river beside the forest-3--desert-4 stepping stones has no disc or letter, so it belongs to no space.

Sea-3 is reached only by submersible, badlands-3 only by ship and badlands-5 only by flying machine.

The ship trail on the river stops at the fork below mountain-1, so no ship reaches that space. The river passes badlands-3 by a short inlet that holds its pier, and badlands-2's pier is on a short spur. The table reads the river as two routes through badlands-3; the board doesn't print a separate desert-1--badlands-2 stretch, and it doesn't rule one out either.

## Spaces

| Id               | Region   | Letters | Starting space | Port |
| ---------------- | -------- | ------- | -------------- | ---- |
| space.sea.1      | sea      | N       | no             | yes  |
| space.sea.2      | sea      | S W     | no             | yes  |
| space.sea.3      | sea      | E       | no             | yes  |
| space.island.1   | island   | N       | no             | yes  |
| space.island.2   | island   | E       | no             | yes  |
| space.island.3   | island   | W       | no             | yes  |
| space.island.4   | island   | S       | no             | no   |
| space.forest.1   | forest   | N W     | no             | yes  |
| space.forest.2   | forest   | -       | yes            | no   |
| space.forest.3   | forest   | S E     | yes            | no   |
| space.desert.1   | desert   | N       | no             | yes  |
| space.desert.2   | desert   | S W     | no             | yes  |
| space.desert.3   | desert   | -       | yes            | no   |
| space.desert.4   | desert   | -       | yes            | no   |
| space.desert.5   | desert   | E       | no             | no   |
| space.badlands.1 | badlands | N W     | yes            | no   |
| space.badlands.2 | badlands | -       | no             | yes  |
| space.badlands.3 | badlands | -       | no             | yes  |
| space.badlands.4 | badlands | -       | yes            | no   |
| space.badlands.5 | badlands | S E     | no             | no   |
| space.mountain.1 | mountain | N W     | no             | no   |
| space.mountain.2 | mountain | S E     | no             | yes  |

## Routes

In the order of `components.md`: road, ship, submersible, flying machine, ferry. Confidence is its tag and reason, with its source short names.

| Id                                          | Medium         | From             | To               | Confidence                                                                   |
| ------------------------------------------- | -------------- | ---------------- | ---------------- | ---------------------------------------------------------------------------- |
| route.road.forest-1--forest-2               | road           | space.forest.1   | space.forest.2   | [read] TT, AID, FB                                                           |
| route.road.forest-2--forest-3               | road           | space.forest.2   | space.forest.3   | [read] TT, AID, FB                                                           |
| route.road.forest-2--badlands-1             | road           | space.forest.2   | space.badlands.1 | [read] TT, AID, FB                                                           |
| route.road.forest-3--badlands-1             | road           | space.forest.3   | space.badlands.1 | [read] TT, AID, FB                                                           |
| route.road.forest-3--desert-4               | road           | space.forest.3   | space.desert.4   | [read] TT, AID, FB                                                           |
| route.road.badlands-1--badlands-2           | road           | space.badlands.1 | space.badlands.2 | [read] TT, AID, FB                                                           |
| route.road.badlands-2--badlands-4           | road           | space.badlands.2 | space.badlands.4 | [read] TT, AID, FB                                                           |
| route.road.desert-3--desert-4               | road           | space.desert.3   | space.desert.4   | [read] TT, AID, FB                                                           |
| route.road.desert-1--desert-3               | road           | space.desert.1   | space.desert.3   | [read] TT, AID, FB                                                           |
| route.road.desert-2--desert-5               | road           | space.desert.2   | space.desert.5   | [read] TT, AID, FB                                                           |
| route.road.island-1--island-2               | road           | space.island.1   | space.island.2   | [read] TT, AID, FB                                                           |
| route.road.island-3--island-4               | road           | space.island.3   | space.island.4   | [read] TT, AID, FB                                                           |
| route.road.mountain-1--mountain-2           | road           | space.mountain.1 | space.mountain.2 | [read] TT, AID, FB                                                           |
| route.ship.sea-1--forest-1                  | ship           | space.sea.1      | space.forest.1   | [read] the board's chevron trail                                             |
| route.ship.sea-1--sea-2                     | ship           | space.sea.1      | space.sea.2      | [read] the board's chevron trail                                             |
| route.ship.sea-2--island-3                  | ship           | space.sea.2      | space.island.3   | [read] the board's chevron trail                                             |
| route.ship.island-3--desert-2               | ship           | space.island.3   | space.desert.2   | [read] the board's chevron trail                                             |
| route.ship.desert-1--desert-2               | ship           | space.desert.1   | space.desert.2   | [read] the board's chevron trail                                             |
| route.ship.desert-1--badlands-3             | ship           | space.desert.1   | space.badlands.3 | [read] the board's chevron trail                                             |
| route.ship.badlands-2--badlands-3           | ship           | space.badlands.2 | space.badlands.3 | [read] the board's chevron trail                                             |
| route.ship.badlands-2--mountain-2           | ship           | space.badlands.2 | space.mountain.2 | [read] the board's chevron trail                                             |
| route.submersible.sea-1--forest-1           | submersible    | space.sea.1      | space.forest.1   | [read] the board's dot trail                                                 |
| route.submersible.island-1--forest-1        | submersible    | space.island.1   | space.forest.1   | [read] the board's dot trail                                                 |
| route.submersible.sea-1--sea-2              | submersible    | space.sea.1      | space.sea.2      | [read] the board's dot trail                                                 |
| route.submersible.sea-2--island-3           | submersible    | space.sea.2      | space.island.3   | [read] the board's dot trail                                                 |
| route.submersible.sea-2--island-2           | submersible    | space.sea.2      | space.island.2   | [read] the board's dot trail                                                 |
| route.submersible.sea-3--island-1           | submersible    | space.sea.3      | space.island.1   | [read] the board's dot trail                                                 |
| route.submersible.sea-3--desert-1           | submersible    | space.sea.3      | space.desert.1   | [read] the board's dot trail                                                 |
| route.submersible.desert-1--desert-2        | submersible    | space.desert.1   | space.desert.2   | [read] the board's dot trail                                                 |
| route.submersible.island-3--desert-2        | submersible    | space.island.3   | space.desert.2   | [read] the board's dot trail                                                 |
| route.flying-machine.island-2--desert-1     | flying-machine | space.island.2   | space.desert.1   | [read] the board's bird trail                                                |
| route.flying-machine.island-2--island-4     | flying-machine | space.island.2   | space.island.4   | [read] the board's bird trail                                                |
| route.flying-machine.island-4--desert-2     | flying-machine | space.island.4   | space.desert.2   | [read] the board's bird trail                                                |
| route.flying-machine.desert-2--desert-5     | flying-machine | space.desert.2   | space.desert.5   | [read] the board's bird trail                                                |
| route.flying-machine.desert-5--badlands-5   | flying-machine | space.desert.5   | space.badlands.5 | [read] the board's bird trail                                                |
| route.flying-machine.badlands-5--mountain-2 | flying-machine | space.badlands.5 | space.mountain.2 | [read] the board's bird trail                                                |
| route.flying-machine.mountain-1--mountain-2 | flying-machine | space.mountain.1 | space.mountain.2 | [read] the board's bird trail                                                |
| route.flying-machine.badlands-2--mountain-1 | flying-machine | space.badlands.2 | space.mountain.1 | [read] the board's bird trail                                                |
| route.ferry.island-1--forest-2              | ferry          | space.island.1   | space.forest.2   | [read] TT: facing ferry icons across one stretch of water; DTL, DLR, SETUP-R |
| route.ferry.desert-4--desert-5              | ferry          | space.desert.4   | space.desert.5   | [read] TT: facing ferry icons across one stretch of water; DTL, DLR, SETUP-R |
| route.ferry.badlands-4--mountain-2          | ferry          | space.badlands.4 | space.mountain.2 | [read] TT: facing ferry icons across one stretch of water; DTL, DLR, SETUP-R |
