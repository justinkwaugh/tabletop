# Ride the Rails rule interpretations

The implementation follows the 2020 Capstone rulebook, on the USA, Australia, Canada, France and Germany maps. The rules themselves live in the logic package's code (`src/rules`, `src/stateHandlers`, `src/actions`, `src/data`); this file keeps no copy of them. It records the section labels the code cites, the readings where the rulebook leaves a question open, and the implementation's own conventions.

## Section labels

Code comments and spec names cite the rulebook's topics as `R-<section>`. A third number (`R-3.3.1`) is an item within that section, in the rulebook's order.

- **R-1** Components and setup: R-1.1 components and the locomotive supply, R-1.2 players, R-1.3 setup, R-1.4 railroad availability by round.
- **R-2** Turn structure: R-2.1 the game, R-2.2 phase order, R-2.3 turn order, R-2.4 money, R-2.5 end of round.
- **R-3** Actions: R-3.1 take a share, R-3.2 build track, R-3.3 ride the rails.
- **R-4** Track: R-4.1 placement, R-4.2 starting a railroad, R-4.3 building bonuses.
- **R-5** Information and taking back.
- **R-6** Game end and scoring.
- **R-7** Component text.
- **R-8** Maps: R-8.1 USA, R-8.2 Australia, R-8.3 Canada, R-8.4 France, R-8.5 Germany.

## Readings

Where the rulebook is silent or could be read two ways, the code takes these readings. Each is covered by the logic package's specs.

- **Map.** A game has a map option, chosen at creation, the USA by default. A game that names no map plays the USA.
- **Players.** 3 to 5; there is no 2- or 6-player mode.
- **Passengers.** One per city at setup, except in the cities a map leaves empty (Perth and Brisbane). The USA takes 51, Australia, Canada, France and Germany 52 each, no more than the box's 52, so the supply never runs short.
- **Turn-order ties** (R-2.5). Players tied on money reverse their relative order from the round just played.
- **No journey possible** (R-3.3.1). A player with no passenger they can carry on a legal journey passes by itself, a System Action, and earns nothing. No journey for one player means none for anyone, so every later player passes in the same cascade and the round ends.
- **Locomotive supply** (R-1.1, R-3.1, R-3.2). Shares and track draw on the same 27 locomotives of a colour. An empty railroad can't be taken as a share or built; a player with no railroad left to take skips the share by itself.
- **Shares** (R-3.1). No cap on shares of one railroad.
- **$5 cities** (R-4.3.2). The bonus goes with the first locomotive placed in the city, so a railroad starting there uses it up without earning it.
- **Yellow** (R-4.2.3), on the USA. One start, in Chicago or in one of the three westernmost cities holding track. Westernmost is the lowest `dcol` at the moment Yellow would start, every city tied with the third included; a city among them that can't take Yellow still counts. A westernmost city must hold exactly one locomotive for Yellow to start there.
- **Black** (R-4.2.5). Any city with room for it, Chicago included, except where a map says otherwise. An East Coast start counts toward Black's two East Coast cities.
- **Transcontinental** (R-4.3.3). The line needs two or more railroads, which connect only where both have a locomotive in the same hex; a line may pass a hex more than once. The higher price applies when some line the placement completes changes railroad only in city hexes.
- **Links** (R-3.3.2). A link runs between two cities with no city between them, so a railroad's track through a city is two links, and a route changes railroad only in a city.
- **Taking back** (R-5). A player may take back any of their own actions until the next player acts.
- **Ties at the end** (R-6.2). Players tied for the most money share the win.
- **Australia** (R-8.2).
    - The railroads arrive in the USA's rounds (R-1.4). Each starts in a city printed in its colour (R-4.2). No railroad starts in Perth or Brisbane; Black starts in any other city with room. There is no Transcontinental.
    - Limits 8 / 5 / 4 by player count. A mountain placement lowers the turn's limit by two, once a turn.
    - The Alps take no locomotive.
    - A long-distance hex holds one locomotive. A placement in a long-distance hex, or in Perth or Brisbane, must be the turn's first, and it ends the turn.
    - Perth and Brisbane, at the ends of the long-distance chains, hold one locomotive each and take no passenger at setup. A journey may end there but never starts there.
    - The board prints their bonuses in dollars: every placement into Perth pays $50 and into Brisbane $20. Each holds one locomotive, so each pays once.
- **Canada** (R-8.3).
    - The railroads arrive and start as on Australia. There is no Transcontinental.
    - Limits 7 / 5 / 4 by player count. There are no mountains.
    - Toronto has no limit, one locomotive of each railroad. A railroad's start there pays $2, and every other placement there $3.
    - The Intercolonial, $8, is paid once, to the first player whose placement joins Sault Ste. Marie, Windsor and Québec City through complete links of any railroads, so the railroad changes only in cities.
    - No track is built across an impassable side, and no link crosses one: the two hexes are not adjacent. Two of the 18 sides lie along the shore east of Cornwall, between a hex and water, so they part no hexes.
- **France** (R-8.4).
    - The railroads arrive and start as on Australia. There is no Transcontinental.
    - Limits 8 / 5 / 4 by player count. A mountain placement lowers the turn's limit by one, once a turn.
    - Lille, Valenciennes, Sedan and Metz, the Red/Blue/Black cities, hold one locomotive each, and a railroad holds at most two of them, a start counted. Red and Blue start there, so never in the same city.
    - The six hexes round Paris are its entry hexes. Each holds one locomotive, and a railroad holds only one of them.
    - Paris has no limit, one locomotive of each railroad. Every placement there pays $10, a start included.
    - The seven estuary sides part their hexes as Canada's impassable sides do: no track across them, no link and no bonus connection.
    - Paris Travels: at the end of each round (R-2.5), if Paris holds no passenger, one is placed there. It comes from the passengers already carried: with Paris empty at most 51 of the box's 52 stand on the map, so one is always free.
- **Germany** (R-8.5).
    - The railroads arrive and start as on Australia, except that Purple may also start in Berlin. There is no Transcontinental.
    - Limits 8 / 5 / 4 by player count. A mountain placement by any railroad but Orange lowers the turn's limit by one, once a turn. An Orange placement on a mountain lowers nothing and leaves the turn's mountain charge unspent, so a later mountain placement by another railroad that turn still lowers the limit.
    - Berlin is one city printed over two hexes: one id, one start band, one passenger at setup. Its neighbours are those of both hexes. It has no limit, one locomotive of each railroad, and every placement there pays $3, a start included.
    - Essen, Köln, Leipzig and Dresden, the Red/Blue/Black cities, hold two locomotives each, with no limit on how many a railroad holds: the board prints neither. Red and Blue may start in the same one.
    - Greater Germany, $12, is paid once, to the first player whose placement joins Berlin, Hamburg, Köln, Dresden and München through complete links of any railroads, so the railroad changes only in cities.
    - The board prints no impassable side.

## Conventions

`R-X.<n>` names a convention of this implementation, not a rule of the game.

- **R-X.1:** every choice arrives as explicit input from the player it belongs to; the engine infers none.
- **R-X.2:** undo stops at an action that revealed information: one that advanced the random stream, moved a card into or out of concealment, or showed a player something they had not seen.
- **R-X.3:** a game keeps the rules of the revision it was created under (`rideTheRailsRevision`, set at initialization). Revision 1 is the first release. A state from a revision this code does not know is refused at hydration, and a change to how a recorded game plays needs a new revision, with the old behaviour kept for games created under the earlier one. The maps are added under revision 1: a game keeps the map it was created on (`mapId`), and a USA game plays as it did before them. Specs: `gameState.spec.ts`, `revision.spec.ts`, `usaReplay.spec.ts`.

## Ids and coordinates

Ids are permanent: game state stores ids only, and an id once published is never reused or renamed. They read `<kind>.<group>.<name>` in kebab case: `railroad.red`, `map.usa`, `city.usa.chicago`, `hex.usa.<row>-<dcol>`, `bonus.usa.transcontinental`.

Hexes are pointy-topped in horizontal rows, alternate rows offset by half a hex. `row` counts down from 0 (Seattle's row); `dcol` is the doubled column, the horizontal position in half-hex widths, with the same parity as the row. The neighbours of (r, d) are (r, d±2) and (r±1, d±1). The USA map's hexes, cities and terrain are transcribed from the printed board into `src/data/usaMap.ts`.

A flat-topped map (the expansions) runs the other way: `hex.<map>.<col>-<drow>`, columns counted from the west, `drow` the doubled row with the same parity as the column, and the neighbours of (c, d) are (c, d±2) and (c±1, d±1). On either orientation a map's hexes are in reading order, north to south and then west to east. A hex printed over two cells keeps one id, and its neighbours are those of both cells; two hexes an impassable side parts are not adjacent.

Australia's hexes are `hex.au.<col>-<drow>`: column 0 is Perth's, and the top half-row is drow 1, where the odd columns begin. Its cities and bonuses are `city.au.<name>` and `bonus.au.<name>` in kebab case, without punctuation (`city.au.st-arnaud`); names keep the board's spelling (Pinaroo, Wyalongo). Canada's are `hex.ca.<col>-<drow>` from Sault Ste. Marie's column, the top half-row again drow 1, and `city.ca.<name>` without accents (`city.ca.quebec-city`); names keep the board's spelling (Niagra Falls, Sault Ste. Marie, Montréal). France's are `hex.fr.<col>-<drow>` from Brest's column, the top row drow 0 (Dunkerque's), and `city.fr.<name>` without punctuation (`city.fr.st-nazaire`); names keep the board's spelling (Limonges, Clemont-Ferrand, Culot, Laroche, Morcenx, Geneve, Besancon). Germany's are `hex.de.<col>-<drow>` from Aachen's column, the top row drow 0 (Flensburg's), and `city.de.<name>` without accents (`city.de.koln`); names keep the board's spelling (Köln, München, Kottbus). Berlin's id names its north-west cell, `hex.de.19-17`, and also covers the cell at col 20, drow 18. The maps are transcribed from the printed boards into `src/data/australiaMap.ts`, `src/data/canadaMap.ts`, `src/data/franceMap.ts` and `src/data/germanyMap.ts`.

## Known deviations

None.
