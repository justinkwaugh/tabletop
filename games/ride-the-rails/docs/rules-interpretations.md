# Ride the Rails rule interpretations

The implementation follows the 2020 Capstone rulebook, on the USA map only. The rules themselves live in the logic package's code (`src/rules`, `src/stateHandlers`, `src/actions`, `src/data`); this file keeps no copy of them. It records the section labels the code cites, the readings where the rulebook leaves a question open, and the implementation's own conventions.

## Section labels

Code comments and spec names cite the rulebook's topics as `R-<section>`. A third number (`R-3.3.1`) is an item within that section, in the rulebook's order.

- **R-1** Components and setup: R-1.1 components and the locomotive supply, R-1.2 players, R-1.3 setup, R-1.4 railroad availability by round.
- **R-2** Turn structure: R-2.1 the game, R-2.2 phase order, R-2.3 turn order, R-2.4 money, R-2.5 end of round.
- **R-3** Actions: R-3.1 take a share, R-3.2 build track, R-3.3 ride the rails.
- **R-4** Track: R-4.1 placement, R-4.2 starting a railroad, R-4.3 building bonuses.
- **R-5** Information and taking back.
- **R-6** Game end and scoring.
- **R-7** Component text.
- **R-8** Maps: R-8.1 USA. R-8.2 to R-8.5 are the expansion maps, not implemented.

## Readings

Where the rulebook is silent or could be read two ways, the code takes these readings. Each is covered by the logic package's specs.

- **Map.** USA only, so a game has no map option; the state keeps a map id for the expansions.
- **Players.** 3 to 5; there is no 2- or 6-player mode.
- **Passengers.** One per city at setup. The USA map has fewer cities than the box has passengers, so the supply never runs short.
- **Turn-order ties** (R-2.5). Players tied on money reverse their relative order from the round just played.
- **No journey possible** (R-3.3.1). A player with no passenger they can carry on a legal journey passes by itself, a System Action, and earns nothing. No journey for one player means none for anyone, so every later player passes in the same cascade and the round ends.
- **Locomotive supply** (R-1.1, R-3.1, R-3.2). Shares and track draw on the same 27 locomotives of a colour. An empty railroad can't be taken as a share or built; a player with no railroad left to take skips the share by itself.
- **Shares** (R-3.1). No cap on shares of one railroad.
- **$5 cities** (R-4.3.2). The bonus goes with the first locomotive placed in the city, so a railroad starting there uses it up without earning it.
- **Yellow** (R-4.2.3). One start, in Chicago or in one of the three westernmost cities holding track. Westernmost is the lowest `dcol` at the moment Yellow would start, every city tied with the third included; a city among them that can't take Yellow still counts. A westernmost city must hold exactly one locomotive for Yellow to start there.
- **Black** (R-4.2.5). Any city with room for it, Chicago included. An East Coast start counts toward Black's two East Coast cities.
- **Transcontinental** (R-4.3.3). The line needs two or more railroads, which connect only where both have a locomotive in the same hex; a line may pass a hex more than once. The higher price applies when some line the placement completes changes railroad only in city hexes.
- **Links** (R-3.3.2). A link runs between two cities with no city between them, so a railroad's track through a city is two links, and a route changes railroad only in a city.
- **Taking back** (R-5). A player may take back any of their own actions until the next player acts.
- **Ties at the end** (R-6.2). Players tied for the most money share the win.

## Conventions

`R-X.<n>` names a convention of this implementation, not a rule of the game.

- **R-X.1:** every choice arrives as explicit input from the player it belongs to; the engine infers none.
- **R-X.2:** undo stops at an action that revealed information: one that advanced the random stream, moved a card into or out of concealment, or showed a player something they had not seen.
- **R-X.3:** a game keeps the rules of the revision it was created under (`rideTheRailsRevision`, set at initialization). Revision 1 is the first release. A state from a revision this code does not know is refused at hydration, and a change to how a recorded game plays needs a new revision, with the old behaviour kept for games created under the earlier one. Specs: `gameState.spec.ts`, `revision.spec.ts`.

## Ids and coordinates

Ids are permanent: game state stores ids only, and an id once published is never reused or renamed. They read `<kind>.<group>.<name>` in kebab case: `railroad.red`, `map.usa`, `city.usa.chicago`, `hex.usa.<row>-<dcol>`, `bonus.usa.transcontinental`.

Hexes are pointy-topped in horizontal rows, alternate rows offset by half a hex. `row` counts down from 0 (Seattle's row); `dcol` is the doubled column, the horizontal position in half-hex widths, with the same parity as the row. The neighbours of (r, d) are (r, d±2) and (r±1, d±1). The USA map's hexes, cities and terrain are transcribed from the printed board into `src/data/usaMap.ts`.

## Known deviations

None.
