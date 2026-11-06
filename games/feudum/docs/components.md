# Feudum components

The inventory the data files transcribe. Ids are permanent: game state stores ids only, and an id once published is never reused or renamed.

Built only from the rules digest (`rules-digest.md`, cited `R-x.y`), the rulebook's Royal Writ summary text (December 2018 rulebook), and the picture transcription and the Tabletopia edition's textures and component manifest, in which every value is tagged [read] (clearly legible) or [unsure] (with a reason). A value no picture settled is written **unread** and listed under "Unread values". Nothing here is from memory of the game.

## Id scheme

`<kind>.<group>.<name>` in kebab case. Groups are the rulebook's own groupings.

- Board: `space.<region>.<n>`, `route.<medium>.<a>--<b>` (medium: road, ship, submersible, flying-machine, ferry; endpoints are short space names such as `forest-1`, written in region order sea, island, forest, desert, badlands, mountain, then number), `region.<name>`.
- Guilds: `guild.<name>`, with `guild.<name>.track.<apprentice|journeyman|master>` and the goods-area ids listed in their own tables.
- Tracks: `track.voyage.<1..7>`, `track.military.<1..3>`, `track.epoch.<i..v>`, `track.tile-chart.<i..v>`, `track.score`.
- Cards and writs: `card.action.<name>`, `writ.mandate.<n>`, `writ.charter.<name>`.
- Tiles and discs: `tile.<region>.<i|ii|iii|iv>` (epoch in lower-case roman numerals), `disc.start.<n>`, `disc.double.<n>`, `disc.feudum.<guild>-<1|2>`, `seal.<n>`.
- Tokens: `pawn.<colour>`, `pawn.face.<character>`, `player-disc.<colour>`, `marker.influence.<colour>`, `pouch.<colour>`, `barrel.<colour>`, `vessel.<type>`, `monster.<name>`, `good.<name>`, `shilling.<value>`, `target.archery`, `die.progress`, `marker.epoch`, `marker.start-player`, `bag.haversack`, `board.main`. Identical pieces share one row with a count.
- Colours: red, blue, yellow, green, purple (R-1.1).

Conventions and assumptions:

- **Img id** is the S1, I1, F1 ... label used in the picture transcription.
- **Confidence** copies the transcription's tag and reason. Source short names: FB = publisher flat board scan, DTL/DLR = publisher flat close-ups, DRG = pre-production close-up, SETUP-L/R and BEAVER/ZAND2 = player photos, AID = fan map-aid cards, FAN-GUILD = fan guild tracker, RB-pN = rulebook PDF page N, REF = player reference, TT = the Tabletopia edition (v1.23): its textures, and its component manifest for copy counts.
- Merchant market spaces are numbered 1 to 4 in fill order (incoming goods fill left to right, R-4.6.3); space 4 is the "last" space the setup leaves empty in the saltpeter and sulfur bins. TT prints each bin's prices from most to least expensive; space 1 is taken as the most expensive end, the only reading that fits saltpeter-4 = 2s and sulfur-4 = 1s [unsure: the direction rests on those two readings].
- Prices are in shillings (written `Ns`).
- The mandate numbers 1 to 8 are the transcription's own order (the rulebook's card layout), not printed on the cards.

## Board spaces (22)

| Id               | Img id | Region   | Starting space | N/S/E/W letters | Letters as printed | Notes                                                                                       | Digest / source                                                               |
| ---------------- | ------ | -------- | -------------- | --------------- | ------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| space.sea.1      | S1     | sea      | no             | N               | N                  | Small island top-left; the island itself is the space                                       | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.sea.2      | S2     | sea      | no             | S W             | SW                 |                                                                                             | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.sea.3      | S3     | sea      | no             | E               | E                  | Open-water rocks                                                                            | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.island.1   | I1     | island   | no             | N               | N                  | Upper big island, NW end; ferry dock icon                                                   | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.island.2   | I2     | island   | no             | E               | E                  | Upper big island, SE end                                                                    | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.island.3   | I3     | island   | no             | W               | W                  | Lower big island, NW end                                                                    | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.island.4   | I4     | island   | no             | S               | S                  | Lower big island, SE end; orchard art                                                       | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.forest.1   | F1     | forest   | no             | N W             | NW                 | West coast                                                                                  | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.forest.2   | F2     | forest   | yes            | -               | -                  | Central; ferry dock icon; starting space                                                    | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.forest.3   | F3     | forest   | yes            | S E             | SE                 | South-east; starting space                                                                  | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.desert.1   | D1     | desert   | no             | N               | N                  | North coast dock                                                                            | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.desert.2   | D2     | desert   | no             | S W             | SW                 | South-west dock                                                                             | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.desert.3   | D3     | desert   | yes            | -               | -                  | South; starting space                                                                       | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.desert.4   | D4     | desert   | yes            | -               | -                  | North-east, river; ferry icon; starting space                                               | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.desert.5   | D5     | desert   | no             | E               | E                  | East, river end; ferry icon                                                                 | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.badlands.1 | B1     | badlands | yes            | N W             | NW                 | North-west; starting space; the aid colours it badlands though it sits at the forest's edge | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.badlands.2 | B2     | badlands | no             | -               | -                  | North                                                                                       | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.badlands.3 | B3     | badlands | no             | -               | -                  | River dock, west                                                                            | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.badlands.4 | B4     | badlands | yes            | -               | -                  | Centre, river; ferry icon; starting space                                                   | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.badlands.5 | B5     | badlands | no             | S E             | SE                 | South                                                                                       | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.mountain.1 | M1     | mountain | no             | N W             | NW                 | North                                                                                       | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |
| space.mountain.2 | M2     | mountain | no             | S E             | SE                 | South-east, river; ferry icon                                                               | R-1.2.1; letters [read] DTL, DLR, SETUP-L, SETUP-R; start ring [read] FB, AID |

A two-letter space counts for both directions. Region counts: sea 3, island 4, forest 3, desert 5, badlands 5, mountain 2. Six starting spaces: forest-2, forest-3, desert-3, desert-4, badlands-1, badlands-4.

## Connections

| Id                                          | Medium         | From             | To               | Img ids | Confidence                                                                   | Digest  |
| ------------------------------------------- | -------------- | ---------------- | ---------------- | ------- | ---------------------------------------------------------------------------- | ------- |
| route.road.forest-1--forest-2               | road           | space.forest.1   | space.forest.2   | F1 - F2 | [read] TT, AID, FB                                                           | R-4.2.1 |
| route.road.forest-2--forest-3               | road           | space.forest.2   | space.forest.3   | F2 - F3 | [read] TT, AID, FB                                                           | R-4.2.1 |
| route.road.forest-2--badlands-1             | road           | space.forest.2   | space.badlands.1 | F2 - B1 | [read] TT, AID, FB                                                           | R-4.2.1 |
| route.road.forest-3--badlands-1             | road           | space.forest.3   | space.badlands.1 | F3 - B1 | [read] TT, AID, FB                                                           | R-4.2.1 |
| route.road.forest-3--desert-4               | road           | space.forest.3   | space.desert.4   | F3 - D4 | [read] TT, AID, FB                                                           | R-4.2.1 |
| route.road.badlands-1--badlands-2           | road           | space.badlands.1 | space.badlands.2 | B1 - B2 | [read] TT, AID, FB                                                           | R-4.2.1 |
| route.road.badlands-2--badlands-4           | road           | space.badlands.2 | space.badlands.4 | B2 - B4 | [read] TT, AID, FB                                                           | R-4.2.1 |
| route.road.desert-3--desert-4               | road           | space.desert.3   | space.desert.4   | D3 - D4 | [read] TT, AID, FB                                                           | R-4.2.1 |
| route.road.desert-1--desert-3               | road           | space.desert.1   | space.desert.3   | D1 - D3 | [read] TT, AID, FB                                                           | R-4.2.1 |
| route.road.desert-2--desert-5               | road           | space.desert.2   | space.desert.5   | D2 - D5 | [read] TT, AID, FB                                                           | R-4.2.1 |
| route.road.island-1--island-2               | road           | space.island.1   | space.island.2   | I1 - I2 | [read] TT, AID, FB                                                           | R-4.2.1 |
| route.road.island-3--island-4               | road           | space.island.3   | space.island.4   | I3 - I4 | [read] TT, AID, FB                                                           | R-4.2.1 |
| route.road.mountain-1--mountain-2           | road           | space.mountain.1 | space.mountain.2 | M1 - M2 | [read] TT, AID, FB                                                           | R-4.2.1 |
| route.ship.sea-1--forest-1                  | ship           | space.sea.1      | space.forest.1   | S1 - F1 | [read] the board's chevron trail                                             | R-4.2.2 |
| route.ship.sea-1--sea-2                     | ship           | space.sea.1      | space.sea.2      | S1 - S2 | [read] the board's chevron trail                                             | R-4.2.2 |
| route.ship.sea-2--island-3                  | ship           | space.sea.2      | space.island.3   | S2 - I3 | [read] the board's chevron trail                                             | R-4.2.2 |
| route.ship.island-3--desert-2               | ship           | space.island.3   | space.desert.2   | I3 - D2 | [read] the board's chevron trail                                             | R-4.2.2 |
| route.ship.desert-1--desert-2               | ship           | space.desert.1   | space.desert.2   | D1 - D2 | [read] the board's chevron trail                                             | R-4.2.2 |
| route.ship.desert-1--badlands-3             | ship           | space.desert.1   | space.badlands.3 | D1 - B3 | [read] the board's chevron trail                                             | R-4.2.2 |
| route.ship.badlands-2--badlands-3           | ship           | space.badlands.2 | space.badlands.3 | B2 - B3 | [read] the board's chevron trail                                             | R-4.2.2 |
| route.ship.badlands-2--mountain-2           | ship           | space.badlands.2 | space.mountain.2 | B2 - M2 | [read] the board's chevron trail                                             | R-4.2.2 |
| route.submersible.sea-1--forest-1           | submersible    | space.sea.1      | space.forest.1   | S1 - F1 | [read] the board's dot trail                                                 | R-4.2.2 |
| route.submersible.island-1--forest-1        | submersible    | space.island.1   | space.forest.1   | I1 - F1 | [read] the board's dot trail                                                 | R-4.2.2 |
| route.submersible.sea-1--sea-2              | submersible    | space.sea.1      | space.sea.2      | S1 - S2 | [read] the board's dot trail                                                 | R-4.2.2 |
| route.submersible.sea-2--island-3           | submersible    | space.sea.2      | space.island.3   | S2 - I3 | [read] the board's dot trail                                                 | R-4.2.2 |
| route.submersible.sea-2--island-2           | submersible    | space.sea.2      | space.island.2   | S2 - I2 | [read] the board's dot trail                                                 | R-4.2.2 |
| route.submersible.sea-3--island-1           | submersible    | space.sea.3      | space.island.1   | S3 - I1 | [read] the board's dot trail                                                 | R-4.2.2 |
| route.submersible.sea-3--desert-1           | submersible    | space.sea.3      | space.desert.1   | S3 - D1 | [read] the board's dot trail                                                 | R-4.2.2 |
| route.submersible.desert-1--desert-2        | submersible    | space.desert.1   | space.desert.2   | D1 - D2 | [read] the board's dot trail                                                 | R-4.2.2 |
| route.submersible.island-3--desert-2        | submersible    | space.island.3   | space.desert.2   | I3 - D2 | [read] the board's dot trail                                                 | R-4.2.2 |
| route.flying-machine.island-2--desert-1     | flying-machine | space.island.2   | space.desert.1   | I2 - D1 | [read] the board's bird trail                                                | R-4.2.2 |
| route.flying-machine.island-2--island-4     | flying-machine | space.island.2   | space.island.4   | I2 - I4 | [read] the board's bird trail                                                | R-4.2.2 |
| route.flying-machine.island-4--desert-2     | flying-machine | space.island.4   | space.desert.2   | I4 - D2 | [read] the board's bird trail                                                | R-4.2.2 |
| route.flying-machine.desert-2--desert-5     | flying-machine | space.desert.2   | space.desert.5   | D2 - D5 | [read] the board's bird trail                                                | R-4.2.2 |
| route.flying-machine.desert-5--badlands-5   | flying-machine | space.desert.5   | space.badlands.5 | D5 - B5 | [read] the board's bird trail                                                | R-4.2.2 |
| route.flying-machine.badlands-5--mountain-2 | flying-machine | space.badlands.5 | space.mountain.2 | B5 - M2 | [read] the board's bird trail                                                | R-4.2.2 |
| route.flying-machine.mountain-1--mountain-2 | flying-machine | space.mountain.1 | space.mountain.2 | M1 - M2 | [read] the board's bird trail                                                | R-4.2.2 |
| route.flying-machine.badlands-2--mountain-1 | flying-machine | space.badlands.2 | space.mountain.1 | B2 - M1 | [read] the board's bird trail                                                | R-4.2.2 |
| route.ferry.island-1--forest-2              | ferry          | space.island.1   | space.forest.2   | I1 - F2 | [read] TT: facing ferry icons across one stretch of water; DTL, DLR, SETUP-R | R-4.2.3 |
| route.ferry.desert-4--desert-5              | ferry          | space.desert.4   | space.desert.5   | D4 - D5 | [read] TT: facing ferry icons across one stretch of water; DTL, DLR, SETUP-R | R-4.2.3 |
| route.ferry.badlands-4--mountain-2          | ferry          | space.badlands.4 | space.mountain.2 | B4 - M2 | [read] TT: facing ferry icons across one stretch of water; DTL, DLR, SETUP-R | R-4.2.3 |

Spaces with no road: sea-1, sea-2, sea-3, badlands-3, badlands-5 [read] TT. A vessel route is printed as a trail of the texture the rulebook's legend names for its vessel: chevrons for a ship, clusters of dots for a submersible, birds for a flying machine (R-1.2-H1). A trail does not break at a location, so each stretch between two locations is one route. The only dashed lines on the map are the catapult arcs to the military spaces; they are not routes. TT draws piers at sea-1, sea-2, island-1, island-2, island-3, forest-1, desert-1, desert-2, badlands-2, badlands-3, mountain-2, and one on the river between forest-3 and desert-4, which has no disc or letter and so is no space. A pier does not make a port, and sea-3 is a port with none: ship and submersible routes make their endpoints ports (R-1.2.2). The ports are sea-1, sea-2, sea-3, island-1, island-2, island-3, forest-1, desert-1, desert-2, badlands-2, badlands-3, mountain-2. The sea serpent uses ship and submersible routes; the behemoth uses roads and flying-machine routes (R-4.2.4).

## Regions (6)

| Id              | Name     | Spaces | Space names                                                | Stack base space                                                                                               | Stack (top to bottom)                              | Progress die face           | Digest                   |
| --------------- | -------- | ------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------- | ------------------------ |
| region.sea      | sea      | 3      | sea-1, sea-2, sea-3                                        | printed V with the sea icon (left to right on the board: sea, island, forest, desert, badlands, mountain)      | tile.sea.i (top) to tile.sea.iv (bottom)           | the sea icon [read] TT      | R-1.2.1, R-4.3.1, R-4.11 |
| region.island   | island   | 4      | island-1, island-2, island-3, island-4                     | printed V with the island icon (left to right on the board: sea, island, forest, desert, badlands, mountain)   | tile.island.i (top) to tile.island.iv (bottom)     | the island icon [read] TT   | R-1.2.1, R-4.3.1, R-4.11 |
| region.forest   | forest   | 3      | forest-1, forest-2, forest-3                               | printed V with the forest icon (left to right on the board: sea, island, forest, desert, badlands, mountain)   | tile.forest.i (top) to tile.forest.iv (bottom)     | the forest icon [read] TT   | R-1.2.1, R-4.3.1, R-4.11 |
| region.desert   | desert   | 5      | desert-1, desert-2, desert-3, desert-4, desert-5           | printed V with the desert icon (left to right on the board: sea, island, forest, desert, badlands, mountain)   | tile.desert.i (top) to tile.desert.iv (bottom)     | the desert icon [read] TT   | R-1.2.1, R-4.3.1, R-4.11 |
| region.badlands | badlands | 5      | badlands-1, badlands-2, badlands-3, badlands-4, badlands-5 | printed V with the badlands icon (left to right on the board: sea, island, forest, desert, badlands, mountain) | tile.badlands.i (top) to tile.badlands.iv (bottom) | the badlands icon [read] TT | R-1.2.1, R-4.3.1, R-4.11 |
| region.mountain | mountain | 2      | mountain-1, mountain-2                                     | printed V with the mountain icon (left to right on the board: sea, island, forest, desert, badlands, mountain) | tile.mountain.i (top) to tile.mountain.iv (bottom) | the mountain icon [read] TT | R-1.2.1, R-4.3.1, R-4.11 |

## Guilds (6)

| Id              | Name      | Pawn and feudum icon | Related location | Related location confidence                                 | Ring: left (pulls from) | Ring: right (pushes to) | Position on FB | Digest           |
| --------------- | --------- | -------------------- | ---------------- | ----------------------------------------------------------- | ----------------------- | ----------------------- | -------------- | ---------------- |
| guild.farmer    | Farmer    | sheep                | farm             | [read]                                                      | guild.monk              | guild.merchant          | bottom-left    | R-1.2.3, R-1.2.4 |
| guild.merchant  | Merchant  | coins (three plates) | town             | [read] FAN-GUILD; yellow town disc also visible on FB       | guild.farmer            | guild.alchemist         | left middle    | R-1.2.3, R-1.2.4 |
| guild.alchemist | Alchemist | gear                 | outpost          | [read] TT (purple tower at 1★ in the status key), FAN-GUILD | guild.merchant          | guild.knight            | top-left       | R-1.2.3, R-1.2.4 |
| guild.knight    | Knight    | axe                  | farm             | [read] FAN-GUILD; RB-p2 crop blurry but consistent          | guild.alchemist         | guild.noble             | top-right      | R-1.2.3, R-1.2.4 |
| guild.noble     | Noble     | crown                | town             | [read]                                                      | guild.knight            | guild.monk              | right middle   | R-1.2.3, R-1.2.4 |
| guild.monk      | Monk      | cross                | outpost          | [read]                                                      | guild.noble             | guild.farmer            | bottom-right   | R-1.2.3, R-1.2.4 |

Ring order: Farmer, Merchant, Alchemist (up the left edge), Knight, Noble, Monk (down the right edge), back to Farmer. Status-star key printed on each guild: own pawn 1 star, own feudum 3 stars, related location 1 star [read] (R-4.5.1). Alchemist's push and trade, Knight's trade and so on are rules, not components: R-4.6.

### Guild goods areas and setup

| Guild           | Goods-area layout                                                                                                                                                                                                                                | Setup contents                                                                                                                         | Digest         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| guild.farmer    | Barn (limit 10 goods, `guild.farmer.barn`); 4 chicken spaces for beads (`guild.farmer.chicken.<1..4>`); the farmer's purse (`guild.farmer.purse`); trade medallion 2 goods for 1 food or 1 shilling                                              | 1 bead (flipped from a seal) on one chicken; 10 random goods from the haversack in the barn. Which chicken takes the bead: unread      | R-1.3, R-1.4.5 |
| guild.merchant  | Market of 5 bins (saltpeter, sulfur, iron, wood, food) by 4 spaces = 20 spaces, each with a printed price (`guild.merchant.space.<good>-<1..4>`); rows and columns of the 5 by 4 grid score                                                      | Every space filled except space 4 of the saltpeter and sulfur bins: saltpeter 3, sulfur 3, iron 4, wood 4, food 4 = 18 goods           | R-1.3          |
| guild.alchemist | Production carts and piles: wood 3, iron 3, food 3, sulfur 3, saltpeter 3 (`guild.alchemist.cart.<good>-<n>`); the vessel space covering the ferry symbol (`guild.alchemist.vessel-space`); invention strip (`guild.alchemist.invention.<name>`) | Wood 3, iron 3, food 1, sulfur 1, saltpeter full; 2 random vessels on the vessel space                                                 | R-1.3, R-4.6.5 |
| guild.knight    | Five rows, one per colour, of 6 spaces in barrel sections of 1, 2 and 3 (`guild.knight.row.<colour>.section.<1..3>`); behemoth and sea serpent icons, each "3 markers" (`guild.knight.monster.<name>`)                                           | 2 markers per row in column 1 and the first space of section 2; rows for unused colours are dummy rows until there are at least 4 rows | R-1.3, R-1.4.4 |
| guild.noble     | Scroll grid of 6 seal spaces in rows of 3, 2, 1 (`guild.noble.scroll.r<row>c<col>`)                                                                                                                                                              | 4 seals red side up on r1c1, r1c3, r2c2, r3c1; r1c2 and r2c1 empty                                                                     | R-1.3, R-1.4.5 |
| guild.monk      | The rosary (`guild.monk.rosary`); the church coffer (`guild.monk.coffer`)                                                                                                                                                                        | 4 beads (flipped from seals) on the rosary                                                                                             | R-1.3, R-1.4.5 |

### Guild track spaces (18)

| Id                               | Guild           | Rank       | Dawn vp | Notes                                                                                          | Digest         |
| -------------------------------- | --------------- | ---------- | ------- | ---------------------------------------------------------------------------------------------- | -------------- |
| guild.farmer.track.apprentice    | guild.farmer    | apprentice | 1       | used only with 4 or 5 players (R-4.5.3); [read] RB-p9 (Farmer), DRG                            | R-1.3, R-4.5.3 |
| guild.farmer.track.journeyman    | guild.farmer    | journeyman | 3       | holder may pull; [read] RB-p9 (Farmer), DRG                                                    | R-1.3, R-4.5.3 |
| guild.farmer.track.master        | guild.farmer    | master     | 5       | the large hexagon beside the guild-icon medallion; holder may push; [read] RB-p9 (Farmer), DRG | R-1.3, R-4.5.3 |
| guild.merchant.track.apprentice  | guild.merchant  | apprentice | 1       | used only with 4 or 5 players (R-4.5.3); [read] RB-p9 (Farmer), DRG                            | R-1.3, R-4.5.3 |
| guild.merchant.track.journeyman  | guild.merchant  | journeyman | 3       | holder may pull; [read] RB-p9 (Farmer), DRG                                                    | R-1.3, R-4.5.3 |
| guild.merchant.track.master      | guild.merchant  | master     | 5       | the large hexagon beside the guild-icon medallion; holder may push; [read] RB-p9 (Farmer), DRG | R-1.3, R-4.5.3 |
| guild.alchemist.track.apprentice | guild.alchemist | apprentice | 1       | used only with 4 or 5 players (R-4.5.3); [read] RB-p9 (Farmer), DRG                            | R-1.3, R-4.5.3 |
| guild.alchemist.track.journeyman | guild.alchemist | journeyman | 3       | holder may pull; [read] RB-p9 (Farmer), DRG                                                    | R-1.3, R-4.5.3 |
| guild.alchemist.track.master     | guild.alchemist | master     | 5       | the large hexagon beside the guild-icon medallion; holder may push; [read] RB-p9 (Farmer), DRG | R-1.3, R-4.5.3 |
| guild.knight.track.apprentice    | guild.knight    | apprentice | 1       | used only with 4 or 5 players (R-4.5.3); [read] RB-p9 (Farmer), DRG                            | R-1.3, R-4.5.3 |
| guild.knight.track.journeyman    | guild.knight    | journeyman | 3       | holder may pull; [read] RB-p9 (Farmer), DRG                                                    | R-1.3, R-4.5.3 |
| guild.knight.track.master        | guild.knight    | master     | 5       | the large hexagon beside the guild-icon medallion; holder may push; [read] RB-p9 (Farmer), DRG | R-1.3, R-4.5.3 |
| guild.noble.track.apprentice     | guild.noble     | apprentice | 1       | used only with 4 or 5 players (R-4.5.3); [read] RB-p9 (Farmer), DRG                            | R-1.3, R-4.5.3 |
| guild.noble.track.journeyman     | guild.noble     | journeyman | 3       | holder may pull; [read] RB-p9 (Farmer), DRG                                                    | R-1.3, R-4.5.3 |
| guild.noble.track.master         | guild.noble     | master     | 5       | the large hexagon beside the guild-icon medallion; holder may push; [read] RB-p9 (Farmer), DRG | R-1.3, R-4.5.3 |
| guild.monk.track.apprentice      | guild.monk      | apprentice | 1       | used only with 4 or 5 players (R-4.5.3); [read] RB-p9 (Farmer), DRG                            | R-1.3, R-4.5.3 |
| guild.monk.track.journeyman      | guild.monk      | journeyman | 3       | holder may pull; [read] RB-p9 (Farmer), DRG                                                    | R-1.3, R-4.5.3 |
| guild.monk.track.master          | guild.monk      | master     | 5       | the large hexagon beside the guild-icon medallion; holder may push; [read] RB-p9 (Farmer), DRG | R-1.3, R-4.5.3 |

### Farmer goods area (6)

| Id                     | Part           | Capacity | Confidence                                                                                           | Setup                                            | Digest  |
| ---------------------- | -------------- | -------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------- |
| guild.farmer.barn      | barn           | 10       | [read] RB-p9: limit 10 goods                                                                         | setup: 10 random goods                           | R-1.3   |
| guild.farmer.purse     | farmer's purse | -        | [read] money-sack icon RB-p9                                                                         | setup: empty (no setup contents stated)          | R-4.6.2 |
| guild.farmer.chicken.1 | chicken space  | 1 bead   | [unsure] count is the 4 chickens drawn (1 rooster, 3 hens); the board prints no explicit space marks | setup: 1 bead on one of the four (which: unread) | R-1.3   |
| guild.farmer.chicken.2 | chicken space  | 1 bead   | [unsure] count is the 4 chickens drawn (1 rooster, 3 hens); the board prints no explicit space marks | setup: empty unless it holds the setup bead      | R-1.3   |
| guild.farmer.chicken.3 | chicken space  | 1 bead   | [unsure] count is the 4 chickens drawn (1 rooster, 3 hens); the board prints no explicit space marks | setup: empty unless it holds the setup bead      | R-1.3   |
| guild.farmer.chicken.4 | chicken space  | 1 bead   | [unsure] count is the 4 chickens drawn (1 rooster, 3 hens); the board prints no explicit space marks | setup: empty unless it holds the setup bead      | R-1.3   |

### Merchant market spaces (20)

| Id                               | Bin       | Space | Price | Price confidence                                         | Filled at setup | Digest         |
| -------------------------------- | --------- | ----- | ----- | -------------------------------------------------------- | --------------- | -------------- |
| guild.merchant.space.saltpeter-1 | saltpeter | 1     | 4s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |
| guild.merchant.space.saltpeter-2 | saltpeter | 2     | 3s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |
| guild.merchant.space.saltpeter-3 | saltpeter | 3     | 2s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |
| guild.merchant.space.saltpeter-4 | saltpeter | 4     | 2s    | [read] TT; SETUP-L, ZAND2: the space left empty at setup | no (empty)      | R-1.3, R-4.6.3 |
| guild.merchant.space.sulfur-1    | sulfur    | 1     | 3s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |
| guild.merchant.space.sulfur-2    | sulfur    | 2     | 3s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |
| guild.merchant.space.sulfur-3    | sulfur    | 3     | 2s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |
| guild.merchant.space.sulfur-4    | sulfur    | 4     | 1s    | [read] TT; SETUP-L, ZAND2: the space left empty at setup | no (empty)      | R-1.3, R-4.6.3 |
| guild.merchant.space.iron-1      | iron      | 1     | 3s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |
| guild.merchant.space.iron-2      | iron      | 2     | 2s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |
| guild.merchant.space.iron-3      | iron      | 3     | 1s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |
| guild.merchant.space.iron-4      | iron      | 4     | 1s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |
| guild.merchant.space.wood-1      | wood      | 1     | 2s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |
| guild.merchant.space.wood-2      | wood      | 2     | 2s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |
| guild.merchant.space.wood-3      | wood      | 3     | 1s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |
| guild.merchant.space.wood-4      | wood      | 4     | 1s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |
| guild.merchant.space.food-1      | food      | 1     | 2s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |
| guild.merchant.space.food-2      | food      | 2     | 1s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |
| guild.merchant.space.food-3      | food      | 3     | 1s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |
| guild.merchant.space.food-4      | food      | 4     | 1s    | [read] TT                                                | yes             | R-1.3, R-4.6.3 |

### Alchemist spaces (16)

| Id                               | Part                                                          | Space | Filled at setup  | Confidence                      | Digest         |
| -------------------------------- | ------------------------------------------------------------- | ----- | ---------------- | ------------------------------- | -------------- |
| guild.alchemist.cart.wood-1      | wood cart/pile                                                | 1     | yes              | [read] TT: 3 spaces; BEAVER     | R-1.3          |
| guild.alchemist.cart.wood-2      | wood cart/pile                                                | 2     | yes              | [read] TT: 3 spaces; BEAVER     | R-1.3          |
| guild.alchemist.cart.wood-3      | wood cart/pile                                                | 3     | yes              | [read] TT: 3 spaces; BEAVER     | R-1.3          |
| guild.alchemist.cart.iron-1      | iron cart/pile                                                | 1     | yes              | [read] TT: 3 spaces; BEAVER     | R-1.3          |
| guild.alchemist.cart.iron-2      | iron cart/pile                                                | 2     | yes              | [read] TT: 3 spaces; BEAVER     | R-1.3          |
| guild.alchemist.cart.iron-3      | iron cart/pile                                                | 3     | yes              | [read] TT: 3 spaces; BEAVER     | R-1.3          |
| guild.alchemist.cart.food-1      | food cart/pile                                                | 1     | yes              | [read] TT: 3 spaces; BEAVER     | R-1.3          |
| guild.alchemist.cart.food-2      | food cart/pile                                                | 2     | no (empty)       | [read] TT: 3 spaces; BEAVER     | R-1.3          |
| guild.alchemist.cart.food-3      | food cart/pile                                                | 3     | no (empty)       | [read] TT: 3 spaces; BEAVER     | R-1.3          |
| guild.alchemist.cart.sulfur-1    | sulfur cart/pile                                              | 1     | yes              | [read] TT: 3 spaces; BEAVER     | R-1.3          |
| guild.alchemist.cart.sulfur-2    | sulfur cart/pile                                              | 2     | no (empty)       | [read] TT: 3 spaces; BEAVER     | R-1.3          |
| guild.alchemist.cart.sulfur-3    | sulfur cart/pile                                              | 3     | no (empty)       | [read] TT: 3 spaces; BEAVER     | R-1.3          |
| guild.alchemist.cart.saltpeter-1 | saltpeter cart/pile                                           | 1     | yes              | [read] TT: 3 spaces on the pile | R-1.3          |
| guild.alchemist.cart.saltpeter-2 | saltpeter cart/pile                                           | 2     | yes              | [read] TT: 3 spaces on the pile | R-1.3          |
| guild.alchemist.cart.saltpeter-3 | saltpeter cart/pile                                           | 3     | yes              | [read] TT: 3 spaces on the pile | R-1.3          |
| guild.alchemist.vessel-space     | vessel space covering the ferryboat symbol (vessels for sale) | -     | 2 random vessels | [read] text and RB-p10          | R-1.3, R-4.2.3 |

### Alchemist inventions (6)

| Id                                       | Invention                       | Goods required           | Digest           |
| ---------------------------------------- | ------------------------------- | ------------------------ | ---------------- |
| guild.alchemist.invention.ship           | ship                            | 1 food + 2 wood          | R-4.6.5          |
| guild.alchemist.invention.submersible    | submersible                     | 1 food + 2 iron          | R-4.6.5          |
| guild.alchemist.invention.flying-machine | flying machine                  | 1 food + 1 iron + 1 wood | R-4.6.5          |
| guild.alchemist.invention.krud-1         | krud barrel 1 (first of a push) | 2 saltpeter + 1 sulfur   | R-4.6.5, R-4.6.6 |
| guild.alchemist.invention.krud-2         | krud barrel 2                   | 1 saltpeter + 1 sulfur   | R-4.6.5, R-4.6.6 |
| guild.alchemist.invention.krud-3         | krud barrel 3                   | 1 wood                   | R-4.6.5, R-4.6.6 |

[read] BEAVER and TT (printed production strip), matching the rule text. Whether the barrel discount counts barrels of this push or of the game is silent in the sources (R-4.6.5).

### Knight row sections (15)

| Id                                | Row colour | Section | Spaces | Columns     | Setup (a row in play)            | Confidence                                                   | Digest         |
| --------------------------------- | ---------- | ------- | ------ | ----------- | -------------------------------- | ------------------------------------------------------------ | -------------- |
| guild.knight.row.red.section.1    | red        | 1       | 1      | column 1    | 1 marker (full)                  | [read] RB-p10 krud example; one barrel icon per section (TT) | R-1.3, R-4.6.6 |
| guild.knight.row.red.section.2    | red        | 2       | 2      | columns 2-3 | first space filled, second empty | [read] RB-p10 krud example; one barrel icon per section (TT) | R-1.3, R-4.6.6 |
| guild.knight.row.red.section.3    | red        | 3       | 3      | columns 4-6 | empty                            | [read] RB-p10 krud example; one barrel icon per section (TT) | R-1.3, R-4.6.6 |
| guild.knight.row.blue.section.1   | blue       | 1       | 1      | column 1    | 1 marker (full)                  | [read] RB-p10 krud example; one barrel icon per section (TT) | R-1.3, R-4.6.6 |
| guild.knight.row.blue.section.2   | blue       | 2       | 2      | columns 2-3 | first space filled, second empty | [read] RB-p10 krud example; one barrel icon per section (TT) | R-1.3, R-4.6.6 |
| guild.knight.row.blue.section.3   | blue       | 3       | 3      | columns 4-6 | empty                            | [read] RB-p10 krud example; one barrel icon per section (TT) | R-1.3, R-4.6.6 |
| guild.knight.row.yellow.section.1 | yellow     | 1       | 1      | column 1    | 1 marker (full)                  | [read] RB-p10 krud example; one barrel icon per section (TT) | R-1.3, R-4.6.6 |
| guild.knight.row.yellow.section.2 | yellow     | 2       | 2      | columns 2-3 | first space filled, second empty | [read] RB-p10 krud example; one barrel icon per section (TT) | R-1.3, R-4.6.6 |
| guild.knight.row.yellow.section.3 | yellow     | 3       | 3      | columns 4-6 | empty                            | [read] RB-p10 krud example; one barrel icon per section (TT) | R-1.3, R-4.6.6 |
| guild.knight.row.green.section.1  | green      | 1       | 1      | column 1    | 1 marker (full)                  | [read] RB-p10 krud example; one barrel icon per section (TT) | R-1.3, R-4.6.6 |
| guild.knight.row.green.section.2  | green      | 2       | 2      | columns 2-3 | first space filled, second empty | [read] RB-p10 krud example; one barrel icon per section (TT) | R-1.3, R-4.6.6 |
| guild.knight.row.green.section.3  | green      | 3       | 3      | columns 4-6 | empty                            | [read] RB-p10 krud example; one barrel icon per section (TT) | R-1.3, R-4.6.6 |
| guild.knight.row.purple.section.1 | purple     | 1       | 1      | column 1    | 1 marker (full)                  | [read] RB-p10 krud example; one barrel icon per section (TT) | R-1.3, R-4.6.6 |
| guild.knight.row.purple.section.2 | purple     | 2       | 2      | columns 2-3 | first space filled, second empty | [read] RB-p10 krud example; one barrel icon per section (TT) | R-1.3, R-4.6.6 |
| guild.knight.row.purple.section.3 | purple     | 3       | 3      | columns 4-6 | empty                            | [read] RB-p10 krud example; one barrel icon per section (TT) | R-1.3, R-4.6.6 |

Rows of unused colours are dummy rows (R-1.4.4). The transcription reads 5 rows on the final board; the digest says at least 4 rows are in play.

| Id                               | Part                          | Confidence     | Digest           |
| -------------------------------- | ----------------------------- | -------------- | ---------------- |
| guild.knight.monster.behemoth    | behemoth icon, "3 markers"    | [read] DRG, FB | R-4.2.4, R-4.6.3 |
| guild.knight.monster.sea-serpent | sea serpent icon, "3 markers" | [read] DRG, FB | R-4.2.4, R-4.6.3 |

### Noble scroll spaces (6)

| Id                      | Row | Column | Lengths                       | Setup occupancy    | Confidence                     | Digest |
| ----------------------- | --- | ------ | ----------------------------- | ------------------ | ------------------------------ | ------ |
| guild.noble.scroll.r1c1 | 1   | 1      | row length 3, column length 3 | seal (red side up) | [read] DRG, FB, RB-p3, SETUP-R | R-1.3  |
| guild.noble.scroll.r1c2 | 1   | 2      | row length 3, column length 2 | empty              | [read] DRG, FB, RB-p3, SETUP-R | R-1.3  |
| guild.noble.scroll.r1c3 | 1   | 3      | row length 3, column length 1 | seal (red side up) | [read] DRG, FB, RB-p3, SETUP-R | R-1.3  |
| guild.noble.scroll.r2c1 | 2   | 1      | row length 2, column length 3 | empty              | [read] DRG, FB, RB-p3, SETUP-R | R-1.3  |
| guild.noble.scroll.r2c2 | 2   | 2      | row length 2, column length 2 | seal (red side up) | [read] DRG, FB, RB-p3, SETUP-R | R-1.3  |
| guild.noble.scroll.r3c1 | 3   | 1      | row length 1, column length 3 | seal (red side up) | [read] DRG, FB, RB-p3, SETUP-R | R-1.3  |

### Monk guild parts (2)

| Id                | Part                                                              | Capacity        | Confidence                                                                                     | Setup                                   | Digest  |
| ----------------- | ----------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------- | ------- |
| guild.monk.rosary | rosary string of printed beads (8 drawn, one cut off at the edge) | capacity unread | [read] TT: no spaces or capacity printed; the banner's "11" is the pull target, not a capacity | setup: 4 beads, bead side up            | R-1.3   |
| guild.monk.coffer | church coffer (chest icon)                                        | -               | [read] DRG, FB                                                                                 | setup: empty (no setup contents stated) | R-4.6.2 |

### Apprentice's share (charity)

The apprentice share of a trade or push goes to charity on the "opposite side of the board" (R-4.6.2). Read as: Farmer, Merchant and Alchemist pay the church coffer; Knight, Noble and Monk pay the farmer's purse. [unsure] inferred from the board layout. TT prints only two charity icons: on the Farmer panel a share icon pointing to the farmer's purse, and on the Monk panel one pointing to the church coffer. Neither ties a guild to a charity unambiguously, and the other four guilds print none, so all six stay unread (R-4.6-H3, provisional).

## Tracks

### Epic voyage (7)

| Id             | Space | Section | Printed vp (lower/higher; single value for 7) | Royal Writ icon      | Notes                | Confidence              | Digest         |
| -------------- | ----- | ------- | --------------------------------------------- | -------------------- | -------------------- | ----------------------- | -------------- |
| track.voyage.1 | 1     | 1       | 3/5                                           | no                   |                      | [read] FB, RB-p2, RB-p5 | R-3.7.5, R-6.2 |
| track.voyage.2 | 2     | 1       | 3/5                                           | yes (draw 2, keep 1) |                      | [read] FB, RB-p2, RB-p5 | R-3.7.5, R-6.2 |
| track.voyage.3 | 3     | 2       | 7/9                                           | no                   |                      | [read] FB, RB-p2, RB-p5 | R-3.7.5, R-6.2 |
| track.voyage.4 | 4     | 2       | 7/9                                           | yes (draw 2, keep 1) |                      | [read] FB, RB-p2, RB-p5 | R-3.7.5, R-6.2 |
| track.voyage.5 | 5     | 3       | 11/13                                         | no                   |                      | [read] FB, RB-p2, RB-p5 | R-3.7.5, R-6.2 |
| track.voyage.6 | 6     | 3       | 11/13                                         | yes (draw 2, keep 1) |                      | [read] FB, RB-p2, RB-p5 | R-3.7.5, R-6.2 |
| track.voyage.7 | 7     | 4       | 17                                            | no                   | monastery, top right | [read] FB, RB-p2, RB-p5 | R-3.7.5, R-6.2 |

In each section the furthest-on disc and any tied with it score the higher value, other discs there the lower (R-6.2). Minor [unsure]: RB-p5's cropped example shows a disc beside space 1; FB shows no extra space.

### Military service (3)

| Id               | Space | Penalty if uncovered | Epochs checked (dawn of) | Confidence       | Digest |
| ---------------- | ----- | -------------------- | ------------------------ | ---------------- | ------ |
| track.military.1 | 1     | -3                   | II, IV, V                | [read] FB, RB-p6 | R-4.9  |
| track.military.2 | 2     | -4                   | IV, V                    | [read]           | R-4.9  |
| track.military.3 | 3     | -5                   | V                        | [read]           | R-4.9  |

Penalties are cumulative: a vassal who never serves loses 3, then 7, then 12 (22 in all). No fourth space is printed; discs beyond 3 have no space.

### Epoch track (5 sunrays)

| Id              | Ray | Replenish map direction                                       | Catapult                | Guild refill              | Advance when (stack tops)           | Digest           |
| --------------- | --- | ------------------------------------------------------------- | ----------------------- | ------------------------- | ----------------------------------- | ---------------- |
| track.epoch.i   | I   | N (goods at the start of the game; each player takes 3 goods) | no                      | no                        | 6 epoch-I tiles showing (start)     | R-1.4, R-4.11    |
| track.epoch.ii  | II  | S                                                             | yes (disloyalty, R-4.9) | no                        | 4 epoch-II tiles showing            | R-4.11.2, R-4.12 |
| track.epoch.iii | III | E                                                             | no                      | yes (refill setup spaces) | 3 epoch-III tiles showing           | R-4.11.2, R-4.12 |
| track.epoch.iv  | IV  | W                                                             | yes (disloyalty)        | no                        | 2 epoch-IV tiles showing            | R-4.11.2, R-4.12 |
| track.epoch.v   | V   | none                                                          | yes (disloyalty)        | no                        | 1 empty stack showing its printed V | R-4.11.2, R-4.12 |

[read] DTL (icons), RB-p11 and DLR (advancement chart). Every ray except V also shows a good icon beside its direction. Dawn steps in order: score, disloyalty, replenish landscapes, replenish map, replenish guilds (R-4.12).

### Region tile chart (5)

| Id                   | Tile epoch | Farm vp     | Town vp     | Feudum vp ("?") | Confidence        | Digest  |
| -------------------- | ---------- | ----------- | ----------- | --------------- | ----------------- | ------- |
| track.tile-chart.i   | I          | 2           | 3           | 4               | [read] RB-p6, DLR | R-4.3.2 |
| track.tile-chart.ii  | II         | 3           | 4           | 5               | [read]            | R-4.3.2 |
| track.tile-chart.iii | III        | 4           | 5           | 6               | [read]            | R-4.3.2 |
| track.tile-chart.iv  | IV         | 5           | 6           | 7               | [read]            | R-4.3.2 |
| track.tile-chart.v   | V          | crossed out | crossed out | crossed out     | [read]            | R-4.3.2 |

### Scoring track (1)

| Id          | Spaces         | Layout                                                                                                                                                            | Confidence       | Digest  |
| ----------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------- |
| track.score | 150 (0 to 149) | loops round the board edge, labelled every 5; 0 is the bottom-left corner on FB; left edge up, top edge left to right, right edge down, bottom edge right to left | [read] FB, RB-p2 | R-1.2.5 |

The active-regions scoring values (1/3/5/7/9/11 for 1 to 6 regions) are not printed on any board image examined; they come from the text only (R-4.12.1).

## Action cards (11 kinds, 5 of each)

Eleven cards per colour, five colours (55). Verbatim card text is not in the inputs; the special-ability names are the printed titles. All symbols [read] on every card (RB-p5 to p8, cross-checked with REF).

| Id                    | Printed name | Count | Top-right symbols                                                         | Regular action                                                               | Special ability     | Special needs                             | Special effect                                                                        | Printed vp                                      | Either/or | Digest            |
| --------------------- | ------------ | ----- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- | --------- | ----------------- |
| card.action.migrate   | Migrate      | 5     | none                                                                      | Move one of your pawns onto or off the board                                 | Distant Kin         | Alchemist pawn on the board               | in addition: enter at any starting space                                              | none                                            | no        | R-3.5 #1, R-3.6   |
| card.action.move      | Move         | 5     | x2, epic-voyage icon                                                      | Move pieces (allowance = pawns on board + monsters), then pilfer             | Godspeed            | Monk pawn on the board                    | in addition: one monk +1 move                                                         | none                                            | no        | R-3.5 #2, R-3.7   |
| card.action.influence | Influence    | 5     | x2                                                                        | Add 1 influence marker to each space holding your pawn                       | Money is Influence  | Merchant pawn at the location; 1 shilling | in addition: unseat a lone ruler                                                      | none                                            | no        | R-3.5 #3, R-3.8   |
| card.action.improve   | Improve      | 5     | vp "?" (variable, per the region tile chart), region-tile icon, either/or | Improve a ruled location, then take a region tile and score                  | Tend Landscape      | wood                                      | instead: place a collected tile as a landscape at a location where you are serf, 2 vp | "?" (variable, by the tile chart); special 2 vp | yes       | R-3.5 #4, R-3.9   |
| card.action.explore   | Explore      | 5     | none                                                                      | Rule an outpost: draw 2 Royal Writs (+1 per other outpost or feudum), keep 1 | Shovels & Swords    | iron                                      | in addition: draw 2 more, keep 1 more                                                 | none                                            | no        | R-3.5 #5, R-3.10  |
| card.action.harvest   | Harvest      | 5     | 1 vp                                                                      | Harvest goods onto a ruled farm with fewer than 10 goods                     | Inspect the Harvest | Farmer pawn on the board                  | in addition: draw the total first, choose favors openly                               | 1                                               | no        | R-3.5 #6, R-3.11  |
| card.action.tax       | Tax          | 5     | none                                                                      | Rule a town: take 2 shillings + 1 per other town or feudum                   | Reinforcements      | Knight pawn on the board                  | in addition: take 1 of your influence markers                                         | none                                            | no        | R-3.5 #7, R-3.12  |
| card.action.conquer   | Conquer      | 5     | 2/4 vp, crossed x2, not-last, either/or                                   | Attack an opponent's pawn, monster or feudum (R-4.8)                         | Starve the People   | Noble pawn at the location                | instead: remove a subject or serf, 0 vp, may place a military service disc            | 2/4; special 0                                  | yes       | R-3.5 #8, R-3.13  |
| card.action.defend    | Defend       | 5     | 1 vp, crossed x2, either/or                                               | Flip out of turn when conquered: +1 defence, 1 vp                            | Royal Immunity      | food                                      | instead, out of turn: cancel a Starve the People, put a king's seal under the marker  | 1                                               | yes       | R-3.5 #9, R-3.14  |
| card.action.repeat    | Repeat       | 5     | none                                                                      | Replay one card you already played this round that carries x2                | Déjà Vu             | saltpeter                                 | replay a card without x2 (never Conquer or Defend)                                    | none                                            | no        | R-3.5 #10, R-3.15 |
| card.action.guild     | Guild        | 5     | vp "?" (variable), x2, either/or                                          | One guild action: trade, pull or push                                        | Feast               | sulfur from the wine barrel               | instead: perform an opponent's guild function on a shared space, +3 vp                | "?"; special +3                                 | yes       | R-3.5 #11, R-3.16 |

Harvest card chart [read] (RB): total 5/6/7/8/9/10, partial 4/5/5/5/6/6, favors 1/1/2/3/3/4 (R-3.11.2). Improve's tile-chart values: `track.tile-chart.<i..iv>`.

## Royal Writs (16)

Printed text is quoted from the rulebook's Royal Writ summary. The star glyph in "Reach 3 [star] in 1 guild" is lost in the text layer; it is written 3★ below. `*` means drawn from the general supply (R-7). Boxed goods are the goods turned in; unboxed goods on a card are only the recipe picture.

### Mandates (8, play once at any time)

| Id             | Alternative A (printed)                                      | Alternative B (printed)                            | Turned in for A    | Turned in for B             | Recipe / boxed picture                                                         | 3-star rewards                                                                      | Confidence                                                          | Digest       |
| -------------- | ------------------------------------------------------------ | -------------------------------------------------- | ------------------ | --------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------ |
| writ.mandate.1 | Use bow for free: +1 attack                                  | Turn in wood: +2 attack                            | none (free)        | wood                        | bow / crossbow                                                                 | -                                                                                   | [read] RB-p13                                                       | R-4.4.2, R-7 |
| writ.mandate.2 | Turn in food: flying machine*                                | Turn in wood: ship*                                | food               | wood                        | A recipe iron, wood, boxed food; B recipe food, wood, boxed wood               | -                                                                                   | [read] RB-p13                                                       | R-4.4.2, R-7 |
| writ.mandate.3 | Use sword for free: +1 attack                                | Turn in iron: +2 attack                            | none (free)        | iron                        | sword / longsword                                                              | -                                                                                   | [read] RB-p13                                                       | R-4.4.2, R-7 |
| writ.mandate.4 | Turn in wood: ship*                                          | Turn in iron: submersible*                         | wood               | iron                        | A recipe food, wood, boxed wood; B recipe food, iron, boxed iron               | -                                                                                   | [read] RB-p13                                                       | R-4.4.2, R-7 |
| writ.mandate.5 | Turn in food: 3s                                             | Turn in wood & food: 7s                            | food               | wood + food                 | goods column saltpeter, sulfur, iron, wood, food with the turned-in ones boxed | -                                                                                   | [read] RB-p13                                                       | R-4.4.2, R-7 |
| writ.mandate.6 | Reach 3★ in 1 guild to earn 3 goods, 3s or any vessel*       | (same card: the rewards are alternatives by guild) | none               | none                        | icons sheep, coins, gear, each 3★, under bag / 3s / ship                       | Farmer: 3 goods*; Merchant: 3s*; Alchemist: a ship* (R-4.4-H4). One reward per card | [read] RB-p13; TT prints a ship icon for the Alchemist reward (Q29) | R-4.4.2, R-7 |
| writ.mandate.7 | Turn in iron, wood & food: 9s                                | Turn in sulfur, iron, wood & food: 13s             | iron + wood + food | sulfur + iron + wood + food | goods column with the turned-in ones boxed                                     | -                                                                                   | [read] RB-p13                                                       | R-4.4.2, R-7 |
| writ.mandate.8 | Reach 3★ in 1 guild to earn 3 influence*, 1 seal* or 1 bead* | (same card: the rewards are alternatives by guild) | none               | none                        | icons axe, crown, cross, each 3★                                               | Knight: 3 influence*; Noble: 1 seal*; Monk: 1 bead*. One reward per card            | [read] RB-p13                                                       | R-4.4.2, R-7 |

The ship option appears on two cards (mandates 2 and 4). Mandates 6 and 8 are two printed alternatives on one card line, chosen by the guild where you hold 3 stars (R-4.4.2).

### Charters (8, score at game end only with a king's seal on them)

Each card's map shows qualifying spaces as pink dots. The counts are [read]. The spaces are read from TT's card art: Western, Central and Eastern match the board space for space and together cover it, and the other three were matched against them. "Per location ruled" counts ruled spaces only (R-4.4.3).

| Id                            | Printed text (verbatim)                           | Values                        | Dots | Qualifying spaces                               | Confidence                                                                             | Digest         |
| ----------------------------- | ------------------------------------------------- | ----------------------------- | ---- | ----------------------------------------------- | -------------------------------------------------------------------------------------- | -------------- |
| writ.charter.sulfur-barrel    | End game with 2 or 3 sulfur in barrel: 5/7 vp     | 2 sulfur 5 vp / 3 sulfur 7 vp | -    | none (no map)                                   | [read] values, RB-p13, TT                                                              | R-4.4.3, R-6.2 |
| writ.charter.eastern-kingdom  | Eastern Kingdom (per location ruled): 3/5/7/9 vp  | 3/5/7/9                       | 7    | badlands-1..5, mountain-1, mountain-2           | [read] values and spaces, TT                                                           | R-4.4.3, R-6.2 |
| writ.charter.monster-defeat   | If you defeat either monster during game: 7 vp    | 7                             | -    | none (no map)                                   | [read] values, RB-p13, TT                                                              | R-4.4.3, R-6.2 |
| writ.charter.western-kingdom  | Western Kingdom (per location ruled): 3/5/7/9 vp  | 3/5/7/9                       | 7    | sea-1..3, island-1..4                           | [read] values and spaces, TT                                                           | R-4.4.3, R-6.2 |
| writ.charter.northern-kingdom | Northern Kingdom (per location ruled): 3/5/7/9 vp | 3/5/7/9                       | 6    | forest-1..3, badlands-1, badlands-2, mountain-1 | [read] values, TT; [unsure] badlands-2 and mountain-1 (the dots sit near those spaces) | R-4.4.3, R-6.2 |
| writ.charter.central-kingdom  | Central Kingdom (per location ruled): 3/5/7/9 vp  | 3/5/7/9                       | 8    | forest-1..3, desert-1..5                        | [read] values and spaces, TT                                                           | R-4.4.3, R-6.2 |
| writ.charter.southern-kingdom | Southern Kingdom (per location ruled): 3/5/7/9 vp | 3/5/7/9                       | 9    | desert-1..5, badlands-3..5, mountain-2          | [read] values and spaces, TT                                                           | R-4.4.3, R-6.2 |
| writ.charter.isolated-kingdom | Isolated Kingdom (per location ruled): 5/11/17 vp | 5/11/17 (1/2/3 locations)     | 3    | sea-3, badlands-3, badlands-5 (no mountain dot) | [read] values and spaces, TT                                                           | R-4.4.3, R-6.2 |

Only the six kingdom charters have names in the printed text; `sulfur-barrel` and `monster-defeat` are descriptive ids because the card prints no title in the rulebook list. "3/5/7/9" reads as 1/2/3/4 qualifying locations ruled giving 3/5/7/9 vp [read as printed; the per-count meaning is an interpretation].

## Region tiles (24)

Six stacks of four, one tile of each epoch I to IV, epoch I on top. The front shows only the epoch numeral; the back is a landscape. Scores come from `track.tile-chart.*`.

| Id                | Region   | Epoch (front) | Stack position  | Landscape back | Score when taken (legal)   | Digest         |
| ----------------- | -------- | ------------- | --------------- | -------------- | -------------------------- | -------------- |
| tile.sea.i        | sea      | I             | 1 of 4 (top)    | see below      | farm 2 / town 3 / feudum 4 | R-4.3, R-1.4.3 |
| tile.sea.ii       | sea      | II            | 2 of 4 (middle) | see below      | farm 3 / town 4 / feudum 5 | R-4.3, R-1.4.3 |
| tile.sea.iii      | sea      | III           | 3 of 4 (middle) | see below      | farm 4 / town 5 / feudum 6 | R-4.3, R-1.4.3 |
| tile.sea.iv       | sea      | IV            | 4 of 4 (bottom) | see below      | farm 5 / town 6 / feudum 7 | R-4.3, R-1.4.3 |
| tile.island.i     | island   | I             | 1 of 4 (top)    | see below      | farm 2 / town 3 / feudum 4 | R-4.3, R-1.4.3 |
| tile.island.ii    | island   | II            | 2 of 4 (middle) | see below      | farm 3 / town 4 / feudum 5 | R-4.3, R-1.4.3 |
| tile.island.iii   | island   | III           | 3 of 4 (middle) | see below      | farm 4 / town 5 / feudum 6 | R-4.3, R-1.4.3 |
| tile.island.iv    | island   | IV            | 4 of 4 (bottom) | see below      | farm 5 / town 6 / feudum 7 | R-4.3, R-1.4.3 |
| tile.forest.i     | forest   | I             | 1 of 4 (top)    | see below      | farm 2 / town 3 / feudum 4 | R-4.3, R-1.4.3 |
| tile.forest.ii    | forest   | II            | 2 of 4 (middle) | see below      | farm 3 / town 4 / feudum 5 | R-4.3, R-1.4.3 |
| tile.forest.iii   | forest   | III           | 3 of 4 (middle) | see below      | farm 4 / town 5 / feudum 6 | R-4.3, R-1.4.3 |
| tile.forest.iv    | forest   | IV            | 4 of 4 (bottom) | see below      | farm 5 / town 6 / feudum 7 | R-4.3, R-1.4.3 |
| tile.desert.i     | desert   | I             | 1 of 4 (top)    | see below      | farm 2 / town 3 / feudum 4 | R-4.3, R-1.4.3 |
| tile.desert.ii    | desert   | II            | 2 of 4 (middle) | see below      | farm 3 / town 4 / feudum 5 | R-4.3, R-1.4.3 |
| tile.desert.iii   | desert   | III           | 3 of 4 (middle) | see below      | farm 4 / town 5 / feudum 6 | R-4.3, R-1.4.3 |
| tile.desert.iv    | desert   | IV            | 4 of 4 (bottom) | see below      | farm 5 / town 6 / feudum 7 | R-4.3, R-1.4.3 |
| tile.badlands.i   | badlands | I             | 1 of 4 (top)    | see below      | farm 2 / town 3 / feudum 4 | R-4.3, R-1.4.3 |
| tile.badlands.ii  | badlands | II            | 2 of 4 (middle) | see below      | farm 3 / town 4 / feudum 5 | R-4.3, R-1.4.3 |
| tile.badlands.iii | badlands | III           | 3 of 4 (middle) | see below      | farm 4 / town 5 / feudum 6 | R-4.3, R-1.4.3 |
| tile.badlands.iv  | badlands | IV            | 4 of 4 (bottom) | see below      | farm 5 / town 6 / feudum 7 | R-4.3, R-1.4.3 |
| tile.mountain.i   | mountain | I             | 1 of 4 (top)    | see below      | farm 2 / town 3 / feudum 4 | R-4.3, R-1.4.3 |
| tile.mountain.ii  | mountain | II            | 2 of 4 (middle) | see below      | farm 3 / town 4 / feudum 5 | R-4.3, R-1.4.3 |
| tile.mountain.iii | mountain | III           | 3 of 4 (middle) | see below      | farm 4 / town 5 / feudum 6 | R-4.3, R-1.4.3 |
| tile.mountain.iv  | mountain | IV            | 4 of 4 (bottom) | see below      | farm 5 / town 6 / feudum 7 | R-4.3, R-1.4.3 |

[read] for the numeral and stack order (RB-p3 callout 8, TILE). Landscapes are orchard (3 food), silver mine (3 shillings), archery butt (3 targets) and sulfur deposit (3 sulfur) (R-4.3.4) [read] TT.

No region is printed on either face [read] TT, so a tile's landscape is a property of the epoch's mix, not of its region. TT keeps each epoch's six tiles in one shuffled bag, and setup shuffles them into the stacks (R-1.4-H2). Each epoch's mix [read] TT manifest:

### Landscapes per epoch (24)

| Epoch | Orchard | Silver mine | Sulfur deposit | Archery butt |
| ----- | ------- | ----------- | -------------- | ------------ |
| I     | 2       | 2           | 1              | 1            |
| II    | 1       | 1           | 2              | 2            |
| III   | 2       | 2           | 1              | 1            |
| IV    | 1       | 1           | 2              | 2            |
| All   | 6       | 6           | 6              | 6            |

## Location discs (44)

The 44 are outposts, farms, towns and feudums. Setup uses 22 placed on the map (circle-marked ones on the six starting spaces) and 22 double-sided in the general supply, which include the 12 feudums (R-1.4.3). The 22 / 22 split is arithmetic [read]. TT's manifest gives the 22 placed at setup: 6 with the circle (2 farms, 2 towns, 2 outposts) for the six starting spaces, and 16 plain (5 farms, 3 towns, 8 outposts) for the rest; which disc lands on which space is random. The numbering of `disc.start.<n>` within a type is a convention. The circle is the disc's ringed back; the other 16 have a plain back [read]. The double-sided discs are 8 farm/town, 1 outpost/farm and 1 outpost/town [read]; the numbering of `disc.double.<n>` follows that order and is a convention. Colours: outpost lilac with a tower, farm green with field stripes, town yellow with two houses, feudum teal with a guild icon [read] RB-p6, LOC.

### Setup discs (22)

| Id            | Group                   | Type    | Circle marker (TT manifest) | Digest  |
| ------------- | ----------------------- | ------- | --------------------------- | ------- |
| disc.start.1  | starting-placement disc | farm    | yes                         | R-1.4.3 |
| disc.start.2  | starting-placement disc | farm    | yes                         | R-1.4.3 |
| disc.start.3  | starting-placement disc | town    | yes                         | R-1.4.3 |
| disc.start.4  | starting-placement disc | town    | yes                         | R-1.4.3 |
| disc.start.5  | starting-placement disc | outpost | yes                         | R-1.4.3 |
| disc.start.6  | starting-placement disc | outpost | yes                         | R-1.4.3 |
| disc.start.7  | starting-placement disc | farm    | no                          | R-1.4.3 |
| disc.start.8  | starting-placement disc | farm    | no                          | R-1.4.3 |
| disc.start.9  | starting-placement disc | farm    | no                          | R-1.4.3 |
| disc.start.10 | starting-placement disc | farm    | no                          | R-1.4.3 |
| disc.start.11 | starting-placement disc | farm    | no                          | R-1.4.3 |
| disc.start.12 | starting-placement disc | town    | no                          | R-1.4.3 |
| disc.start.13 | starting-placement disc | town    | no                          | R-1.4.3 |
| disc.start.14 | starting-placement disc | town    | no                          | R-1.4.3 |
| disc.start.15 | starting-placement disc | outpost | no                          | R-1.4.3 |
| disc.start.16 | starting-placement disc | outpost | no                          | R-1.4.3 |
| disc.start.17 | starting-placement disc | outpost | no                          | R-1.4.3 |
| disc.start.18 | starting-placement disc | outpost | no                          | R-1.4.3 |
| disc.start.19 | starting-placement disc | outpost | no                          | R-1.4.3 |
| disc.start.20 | starting-placement disc | outpost | no                          | R-1.4.3 |
| disc.start.21 | starting-placement disc | outpost | no                          | R-1.4.3 |
| disc.start.22 | starting-placement disc | outpost | no                          | R-1.4.3 |

### Double-sided discs (10)

| Id             | Group                                      | Face A       | Face B | Digest  |
| -------------- | ------------------------------------------ | ------------ | ------ | ------- |
| disc.double.1  | double-sided, general supply, not a feudum | farm/town    | [read] | R-1.4.3 |
| disc.double.2  | double-sided, general supply, not a feudum | farm/town    | [read] | R-1.4.3 |
| disc.double.3  | double-sided, general supply, not a feudum | farm/town    | [read] | R-1.4.3 |
| disc.double.4  | double-sided, general supply, not a feudum | farm/town    | [read] | R-1.4.3 |
| disc.double.5  | double-sided, general supply, not a feudum | farm/town    | [read] | R-1.4.3 |
| disc.double.6  | double-sided, general supply, not a feudum | farm/town    | [read] | R-1.4.3 |
| disc.double.7  | double-sided, general supply, not a feudum | farm/town    | [read] | R-1.4.3 |
| disc.double.8  | double-sided, general supply, not a feudum | farm/town    | [read] | R-1.4.3 |
| disc.double.9  | double-sided, general supply, not a feudum | outpost/farm | [read] | R-1.4.3 |
| disc.double.10 | double-sided, general supply, not a feudum | outpost/town | [read] | R-1.4.3 |

### Feudums (12)

| Id                      | Face A | Icon                                             | Face B             | Confidence                                                  | Digest           |
| ----------------------- | ------ | ------------------------------------------------ | ------------------ | ----------------------------------------------------------- | ---------------- |
| disc.feudum.farmer-1    | feudum | teal, sheep icon (guild farmer)                  | feudum (same icon) | [read] TT: the guild icon on both faces; [read] 2 per guild | R-1.2.4, R-1.4.3 |
| disc.feudum.farmer-2    | feudum | teal, sheep icon (guild farmer)                  | feudum (same icon) | [read] TT: the guild icon on both faces; [read] 2 per guild | R-1.2.4, R-1.4.3 |
| disc.feudum.merchant-1  | feudum | teal, coins (three plates) icon (guild merchant) | feudum (same icon) | [read] TT: the guild icon on both faces; [read] 2 per guild | R-1.2.4, R-1.4.3 |
| disc.feudum.merchant-2  | feudum | teal, coins (three plates) icon (guild merchant) | feudum (same icon) | [read] TT: the guild icon on both faces; [read] 2 per guild | R-1.2.4, R-1.4.3 |
| disc.feudum.alchemist-1 | feudum | teal, gear icon (guild alchemist)                | feudum (same icon) | [read] TT: the guild icon on both faces; [read] 2 per guild | R-1.2.4, R-1.4.3 |
| disc.feudum.alchemist-2 | feudum | teal, gear icon (guild alchemist)                | feudum (same icon) | [read] TT: the guild icon on both faces; [read] 2 per guild | R-1.2.4, R-1.4.3 |
| disc.feudum.knight-1    | feudum | teal, axe icon (guild knight)                    | feudum (same icon) | [read] TT: the guild icon on both faces; [read] 2 per guild | R-1.2.4, R-1.4.3 |
| disc.feudum.knight-2    | feudum | teal, axe icon (guild knight)                    | feudum (same icon) | [read] TT: the guild icon on both faces; [read] 2 per guild | R-1.2.4, R-1.4.3 |
| disc.feudum.noble-1     | feudum | teal, crown icon (guild noble)                   | feudum (same icon) | [read] TT: the guild icon on both faces; [read] 2 per guild | R-1.2.4, R-1.4.3 |
| disc.feudum.noble-2     | feudum | teal, crown icon (guild noble)                   | feudum (same icon) | [read] TT: the guild icon on both faces; [read] 2 per guild | R-1.2.4, R-1.4.3 |
| disc.feudum.monk-1      | feudum | teal, cross icon (guild monk)                    | feudum (same icon) | [read] TT: the guild icon on both faces; [read] 2 per guild | R-1.2.4, R-1.4.3 |
| disc.feudum.monk-2      | feudum | teal, cross icon (guild monk)                    | feudum (same icon) | [read] TT: the guild icon on both faces; [read] 2 per guild | R-1.2.4, R-1.4.3 |

The N/S/E/W letters are printed on the board beside the space, not on the discs [read].

## King's seals / rosary beads (17)

One two-sided disc: seal side red with a white crown, no number; bead side striped teal and yellow with "+N". Bead value range +2 to +5 (text, R-1.1). TT's manifest holds 9 at +2, 5 at +3, 2 at +4 and 1 at +5 [read]. The discs carry no id, so which numbered seal has which value is a convention: seal.1-9 +2, seal.10-14 +3, seal.15-16 +4, seal.17 +5.

| Id      | Seal side        | Bead side value | Digest       |
| ------- | ---------------- | --------------- | ------------ |
| seal.1  | red, white crown | +2              | R-1.1, R-5.1 |
| seal.2  | red, white crown | +2              | R-1.1, R-5.1 |
| seal.3  | red, white crown | +2              | R-1.1, R-5.1 |
| seal.4  | red, white crown | +2              | R-1.1, R-5.1 |
| seal.5  | red, white crown | +2              | R-1.1, R-5.1 |
| seal.6  | red, white crown | +2              | R-1.1, R-5.1 |
| seal.7  | red, white crown | +2              | R-1.1, R-5.1 |
| seal.8  | red, white crown | +2              | R-1.1, R-5.1 |
| seal.9  | red, white crown | +2              | R-1.1, R-5.1 |
| seal.10 | red, white crown | +3              | R-1.1, R-5.1 |
| seal.11 | red, white crown | +3              | R-1.1, R-5.1 |
| seal.12 | red, white crown | +3              | R-1.1, R-5.1 |
| seal.13 | red, white crown | +3              | R-1.1, R-5.1 |
| seal.14 | red, white crown | +3              | R-1.1, R-5.1 |
| seal.15 | red, white crown | +4              | R-1.1, R-5.1 |
| seal.16 | red, white crown | +4              | R-1.1, R-5.1 |
| seal.17 | red, white crown | +5              | R-1.1, R-5.1 |

## Other components

| Id                      | Name                     | Count | Printed values / notes                                                                       | Confidence / source note | Digest         |
| ----------------------- | ------------------------ | ----- | -------------------------------------------------------------------------------------------- | ------------------------ | -------------- |
| board.main              | Game board               | 1     | 22 location spaces, 6 guild areas, tracks                                                    |                          | R-1.2          |
| pawn.red                | red pawns                | 3     | each shows one of 6 characters at a time                                                     |                          | R-1.1          |
| pawn.blue               | blue pawns               | 3     | each shows one of 6 characters at a time                                                     |                          | R-1.1          |
| pawn.yellow             | yellow pawns             | 3     | each shows one of 6 characters at a time                                                     |                          | R-1.1          |
| pawn.green              | green pawns              | 3     | each shows one of 6 characters at a time                                                     |                          | R-1.1          |
| pawn.purple             | purple pawns             | 3     | each shows one of 6 characters at a time                                                     |                          | R-1.1          |
| player-disc.red         | red player discs         | 4     | 1 scoring marker + 3 shared between reeves (at most 2), the epic voyage and military service |                          | R-1.1, R-4.7   |
| player-disc.blue        | blue player discs        | 4     | 1 scoring marker + 3 shared between reeves (at most 2), the epic voyage and military service |                          | R-1.1, R-4.7   |
| player-disc.yellow      | yellow player discs      | 4     | 1 scoring marker + 3 shared between reeves (at most 2), the epic voyage and military service |                          | R-1.1, R-4.7   |
| player-disc.green       | green player discs       | 4     | 1 scoring marker + 3 shared between reeves (at most 2), the epic voyage and military service |                          | R-1.1, R-4.7   |
| player-disc.purple      | purple player discs      | 4     | 1 scoring marker + 3 shared between reeves (at most 2), the epic voyage and military service |                          | R-1.1, R-4.7   |
| marker.influence.red    | red influence markers    | 20    | personal supply 7; the rest in general supply                                                |                          | R-1.1, R-1.4   |
| marker.influence.blue   | blue influence markers   | 20    | personal supply 7; the rest in general supply                                                |                          | R-1.1, R-1.4   |
| marker.influence.yellow | yellow influence markers | 20    | personal supply 7; the rest in general supply                                                |                          | R-1.1, R-1.4   |
| marker.influence.green  | green influence markers  | 20    | personal supply 7; the rest in general supply                                                |                          | R-1.1, R-1.4   |
| marker.influence.purple | purple influence markers | 20    | personal supply 7; the rest in general supply                                                |                          | R-1.1, R-1.4   |
| pouch.red               | red player pouch         | 1     | holds the committed saltpeter or sulfur                                                      |                          | R-3.3          |
| pouch.blue              | blue player pouch        | 1     | holds the committed saltpeter or sulfur                                                      |                          | R-3.3          |
| pouch.yellow            | yellow player pouch      | 1     | holds the committed saltpeter or sulfur                                                      |                          | R-3.3          |
| pouch.green             | green player pouch       | 1     | holds the committed saltpeter or sulfur                                                      |                          | R-3.3          |
| pouch.purple            | purple player pouch      | 1     | holds the committed saltpeter or sulfur                                                      |                          | R-3.3          |
| barrel.red              | red wine barrel          | 1     | capacity 3 sulfur; printed on the board, bottom right                                        | [read] DLR               | R-4.10.2       |
| barrel.blue             | blue wine barrel         | 1     | capacity 3 sulfur; printed on the board, bottom right                                        | [read] DLR               | R-4.10.2       |
| barrel.yellow           | yellow wine barrel       | 1     | capacity 3 sulfur; printed on the board, bottom right                                        | [read] DLR               | R-4.10.2       |
| barrel.green            | green wine barrel        | 1     | capacity 3 sulfur; printed on the board, bottom right                                        | [read] DLR               | R-4.10.2       |
| barrel.purple           | purple wine barrel       | 1     | capacity 3 sulfur; printed on the board, bottom right                                        | [read] DLR               | R-4.10.2       |
| vessel.ship             | Ship                     | 3     | -                                                                                            |                          | R-4.2.2        |
| vessel.submersible      | Submersible              | 3     | -                                                                                            |                          | R-4.2.2        |
| vessel.flying-machine   | Flying machine           | 3     | -                                                                                            |                          | R-4.2.2        |
| monster.behemoth        | Behemoth                 | 1     | moves by road and flying-machine routes; attack +1, defence +1                               |                          | R-4.2.4        |
| monster.sea-serpent     | Sea serpent              | 1     | moves by ship and submersible routes; attack +1, defence +1                                  |                          | R-4.2.4        |
| good.saltpeter          | Saltpeter                | 30    | white                                                                                        |                          | R-1.1          |
| good.sulfur             | Sulfur                   | 30    | yellow                                                                                       |                          | R-1.1          |
| good.iron               | Iron                     | 30    | black                                                                                        |                          | R-1.1          |
| good.wood               | Wood                     | 30    | brown (orange/brown)                                                                         |                          | R-1.1          |
| good.food               | Food                     | 50    | green                                                                                        |                          | R-1.1          |
| shilling.1              | Shilling, silver "1"     | 43    | value 1                                                                                      | rulebook: "43 silver 1s" | R-1.1          |
| shilling.5              | Shilling, gold "5"       | 7     | value 5                                                                                      | rulebook: "7 gold 5s"    | R-1.1          |
| target.archery          | Archery target           | 12    | -                                                                                            |                          | R-1.1, R-4.3.4 |
| die.progress            | Progress die             | 1     | six faces, one per region (see `region.*`)                                                   | [read] TT                | R-4.11         |
| marker.epoch            | Epoch marker             | 1     | -                                                                                            |                          | R-4.11         |
| marker.start-player     | Starting player marker   | 1     | -                                                                                            |                          | R-2.2          |
| bag.haversack           | Haversack                | 1     | bag for random draws of goods                                                                |                          | R-1.1          |

### Pawn faces (6)

| Id                  | Character | Icon  | Guild           | Confidence                                     | Digest         |
| ------------------- | --------- | ----- | --------------- | ---------------------------------------------- | -------------- |
| pawn.face.farmer    | farmer    | sheep | guild.farmer    | [read] FAN-GUILD (icons); R-1.1 (6 characters) | R-1.1, R-4.5.1 |
| pawn.face.merchant  | merchant  | coins | guild.merchant  | [read] FAN-GUILD (icons); R-1.1 (6 characters) | R-1.1, R-4.5.1 |
| pawn.face.alchemist | alchemist | gear  | guild.alchemist | [read] FAN-GUILD (icons); R-1.1 (6 characters) | R-1.1, R-4.5.1 |
| pawn.face.knight    | knight    | axe   | guild.knight    | [read] FAN-GUILD (icons); R-1.1 (6 characters) | R-1.1, R-4.5.1 |
| pawn.face.noble     | noble     | crown | guild.noble     | [read] FAN-GUILD (icons); R-1.1 (6 characters) | R-1.1, R-4.5.1 |
| pawn.face.monk      | monk      | cross | guild.monk      | [read] FAN-GUILD (icons); R-1.1 (6 characters) | R-1.1, R-4.5.1 |

## Totals

"Rows above" counts components (the sum of the Count column where a row stands for identical pieces, otherwise the number of rows). "Not stated" means the rulebook gives no count, so the row count is recorded as the inventory's own figure. Where a breakdown is unread, the note says so.

| Kind                                             | Rulebook says                                                    | Rows above | Note                                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| Board spaces                                     | 22 (sea 3, island 4, forest 3, desert 5, badlands 5, mountain 2) | 22         | matches                                                                                               |
| Routes: roads                                    | not stated (picture only)                                        | 13         | [read] TT, AID, FB                                                                                    |
| Routes: ship                                     | not stated                                                       | 8          | [read] the board's chevron trail                                                                      |
| Routes: submersible                              | not stated                                                       | 9          | [read] the board's dot trail                                                                          |
| Routes: flying machine                           | not stated                                                       | 8          | [read] the board's bird trail                                                                         |
| Routes: ferry                                    | 3 ferryboat routes (R-1.2.2)                                     | 3          | matches                                                                                               |
| Regions                                          | 6                                                                | 6          | matches                                                                                               |
| Guilds                                           | 6                                                                | 6          | matches                                                                                               |
| Guild track spaces                               | 3 per guild = 18                                                 | 18         | matches                                                                                               |
| Farmer chicken spaces                            | 4 (counted from the chickens drawn; unsure)                      | 4          | count is unsure                                                                                       |
| Farmer barn + purse                              | 1 + 1                                                            | 2          | matches                                                                                               |
| Merchant market spaces                           | 5 bins x 4 = 20                                                  | 20         | [read] TT                                                                                             |
| Alchemist spaces (15 cart/pile + 1 vessel space) | carts 3+3+3+3+3 + 1 vessel space                                 | 16         | saltpeter 3, [read] TT                                                                                |
| Alchemist inventions                             | 6 (3 vessels, 3 krud barrels)                                    | 6          | matches                                                                                               |
| Knight row sections                              | 5 rows x 3 sections = 15                                         | 15         | matches                                                                                               |
| Knight monster icons                             | 2                                                                | 2          | matches                                                                                               |
| Noble scroll spaces                              | 6 (rows of 3, 2, 1)                                              | 6          | matches                                                                                               |
| Monk rosary + coffer                             | 1 + 1                                                            | 2          | rosary capacity unread                                                                                |
| Epic voyage spaces                               | 7 in 4 sections                                                  | 7          | matches                                                                                               |
| Military service spaces                          | 3                                                                | 3          | matches                                                                                               |
| Epoch sunrays                                    | 5 (I-V)                                                          | 5          | matches                                                                                               |
| Region tile chart rows                           | 5 (I-V; V crossed out)                                           | 5          | matches                                                                                               |
| Scoring track                                    | 0-149 (150 spaces)                                               | 1          | one row for the whole track                                                                           |
| Action cards                                     | 55 (11 per colour x 5)                                           | 55         | 11 kinds x 5; one card kind per row                                                                   |
| Royal Writ mandates                              | 8                                                                | 8          | each card carries 2 alternative effects                                                               |
| Royal Writ charters                              | 8                                                                | 8          | spaces [read] TT; two of Northern's unsure                                                            |
| Royal Writs (mandates + charters)                | 16                                                               | 16         | matches                                                                                               |
| Region tiles                                     | 24 (6 stacks x 4)                                                | 24         | 6 of each landscape; per-epoch mix [read] TT (R-1.4-H2)                                               |
| Location discs: placed at setup                  | 22                                                               | 22         | 7 farms, 5 towns, 10 outposts [read] TT                                                               |
| Location discs: double-sided, non-feudum         | 22 double-sided less the 12 feudums = 10                         | 10         | farm/town 8, outpost/farm 1, outpost/town 1 [read]                                                    |
| Location discs: feudums                          | 12 (one icon per guild)                                          | 12         | 2 per guild [read]                                                                                    |
| Location discs (all)                             | 44                                                               | 44         | matches                                                                                               |
| King's seals / rosary beads                      | 17                                                               | 17         | 9 × +2, 5 × +3, 2 × +4, 1 × +5 [read] TT                                                              |
| Game board                                       | 1                                                                | 1          | matches                                                                                               |
| Pawns                                            | 15 (3 x 5)                                                       | 15         | matches                                                                                               |
| Player discs                                     | 20 (4 x 5)                                                       | 20         | matches                                                                                               |
| Influence markers                                | 100 (20 x 5)                                                     | 100        | matches                                                                                               |
| Player pouches                                   | 5                                                                | 5          | matches                                                                                               |
| Wine barrels                                     | 5 (printed on the board)                                         | 5          | matches                                                                                               |
| Vessels                                          | 9 (3 + 3 + 3)                                                    | 9          | matches                                                                                               |
| Monsters                                         | 2                                                                | 2          | matches                                                                                               |
| Goods                                            | 170 (30 x 4 + 50 food)                                           | 170        | matches                                                                                               |
| Shillings                                        | 50 (43 silver + 7 gold)                                          | 50         | the digest's component table says "57 in all", which does not equal 43 + 7; the rulebook list says 50 |
| Archery targets                                  | 12                                                               | 12         | matches                                                                                               |
| Progress die                                     | 1                                                                | 1          | matches                                                                                               |
| Epoch marker                                     | 1                                                                | 1          | matches                                                                                               |
| Starting player marker                           | 1                                                                | 1          | matches                                                                                               |
| Haversack                                        | 1                                                                | 1          | matches                                                                                               |
| Pawn faces                                       | 6 characters                                                     | 6          | matches                                                                                               |

## Unread values

| Component                     | What is unread                                                                     | Values | What would settle it                                           |
| ----------------------------- | ---------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------- |
| guild.monk.rosary             | rosary capacity, and whether the printed beads are spaces                          | 1      | a designer ruling (no capacity is printed)                     |
| guild.farmer.chicken.*        | whether the board has exactly 4 chicken spaces, and which one takes the setup bead | 1      | a designer ruling (4 chickens are drawn; no spaces are marked) |
| guild.*                       | which charity (purse or coffer) receives each guild's apprentice share             | 6      | the designer's ruling (R-4.6-H3)                               |
| writ.charter.northern-kingdom | whether two dots mark badlands-2 and mountain-1                                    | 2      | the physical card beside the board                             |

Total unread values: 10.

Also open but not unread: the provisional placeholders for values printed nowhere are R-1.4-H3 and R-4.6-H3.
