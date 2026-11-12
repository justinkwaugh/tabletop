# Maps

A game is played on one map, chosen with the **Map** option when the game is created and stored in the game state as `mapId`. Rules that the board prints, and that could differ on another map, live with the map. Rules that the rulebook sets for every map stay as constants in the model.

## What a map defines

Logic (`src/maps/`):

- `types.ts` lists every `MapId` and every `RailroadId`. A new map adds its id and any railroads it introduces. Railroad ids are shared across maps, so a railroad that appears on two maps keeps one id.
- `<map>/data.ts` holds the settlements (id, name, kind and printed position), the links between them (with the position of each building box, and for a one-way link the end it is built from, `oneWayFrom`), any external connections (price, value and position) and any closed borders (the links each closes and the dividend after which they open).
- `<map>/map.ts` is the `MapDefinition`:
    - `railroads`: id, short and full name, colour and home settlement.
    - `initialOffering`: the railroads auctioned at the start, in order. Every other railroad opens, with a share auctioned at once, when track first reaches its home.
    - `startPlayerRailroad`: the buyer of this railroad's initial share takes the first turn and heads the turn order.
    - `doubleBuildBarrierId`: the settlement a double build may not run into and out of.
    - `freeMetroDevelopment`: whether the metro area Automatic Metro Development would raise next is developed without a connection, and free as the second development. Once it is full the next in order takes its place.
    - `automaticDevelopment`: the metro areas Automatic Metro Development raises, in order; when one is full, the next. It runs when a player declines the paid second development, or leaves town.
    - `leaveTown`: whether Develop Settlements may instead take a development cube into the player's area, where it pays $3 at every dividend.
    - `specialConnection` (optional): a one-off founding, in place of a build, between a northern and a southern railroad whose track meets. It names the two groups, the cost from the treasury, and the bonus to each founder's value at the final payoff; both founders pay a special dividend.
    - `settlementIncome` for each kind the map uses, and `metroIncome` per metro area: the income at each development level, base first.
    - `startingCash` and `offerStockSlots` per player count.
    - `dividendsBeforeFinal`: dividends paid before the final payoff, which takes the place of the next one and ends the game. Five on every map but Veld Railroads, which has seven.
    - `specialDividendsRoundUp`: whether special dividends pay income ÷ 5 rounded up rather than down.
    - `startingTreasuryRoll` (optional): each railroad's treasury starts with a die roll, doubled for the railroads it names.
    - `closedBorders` (optional): links that cannot be built, free first links included, until a number of dividends have been paid.
    - `war` (optional): the round fought in wartime. Links cost `linkCost`, only single links are built and no connections, `haltedRailroad` builds nothing but its free first link, and Develop Settlements makes up to `developments` developments, all but the last free.
    - `recoveryRound` (optional): the round in which every dividend and special dividend pays income ÷ 10, rounded down.
    - `metroRailroad` (optional): the railroad whose home is a metro area. It also opens when that metro's income reaches `opensAtIncome`, at the end of the Develop Settlements action, and pays `costMultiplier` times for track and connections until its track meets another railroad's. Every other railroad's first link into its home pays that railroad a special dividend, and its own track first meeting another's pays it one, unless another railroad already reaches its home.
- `maps.ts` registers the map in `MAPS`; `gameConfig.ts` adds it to the Map option, which `SarConfigurator` offers when a game is created. The configurator brings typebox's schema builder into the catalog entry, about 80 KB, as in Railheads.

UI (`south-african-railroads-ui/src/lib/`):

- `utils/maps/<map>.ts` is the `BoardLayoutSpec`: board size and crop, where the legend, Final Payoff panel, logo (title and credit), special connection panel, Automatic Metro Development note and rules reminder sit, the course and caption of each closed border, each metro area's development grid, the base railroads' printed names, the printed position of each settlement name and the region labels. Register it in `BOARD_LAYOUTS` in `utils/boardLayout.ts`.
- `components/board/terrain/<Map>Terrain.svelte` draws artwork that is not data, such as the sea, for a map that has any. Register it in `TERRAIN` in `components/board/MapBackground.svelte`.
- `utils/railroadStyle.ts` needs a style for every new railroad id.

Settlement names are placed automatically from the printed positions; natural resources go unnamed, as printed. A name whose printed spot is not clear moves to the nearest clear spot around its icon, so a map without printed positions still gets names. `mapLabels.spec.ts` and the logic's map checks in `rules.spec.ts` run for every registered map, so a new map is checked as soon as it is registered.

## Shared across maps

These are the same on every map: five shares a railroad, link costs ($5, $15 for two) outside a war and value ($5), the four action boxes and their action-track advances, the action track limit of 35, the $3 paid development, the $3 a Leave Town cube pays, and the dividend (outside a recovery round), final payoff and minimum bid formulas. A map that changes one of these needs it moved into `MapDefinition` first.

## Known limits

- A free first link never opens a railroad, even if it reaches a closed railroad's home. On both maps no home is one link from another.
- One railroad opens per build. A double build that reached two closed homes would open only the first railroad in the map's list.
