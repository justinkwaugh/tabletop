# Ride the Rails rules digest

The rules as the code cites them: `R-<section>` names a section below. Built from the sources listed here and nothing else; a sentence with no source is a gap, not a rule. Sources are cited as **B** (base rules, page 1 or 2), **AC** (Australia & Canada rules) and **FD** (France & Germany rules). The digest paraphrases; it does not reproduce the rulebooks.

## Sources

| Source    | What it is                                                                   | Date or edition              | Supplied as                                                                          |
| --------- | ---------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| rulebook  | _Ride the Rails_ rules of play (USA map), Capstone Games                     | 2020, 2 pages                | publisher PDF                                                                        |
| rulebook  | _Ride the Rails: Australia & Canada_ rules of play                           | 2021, 1 page                 | publisher PDF                                                                        |
| rulebook  | _Ride the Rails: France & Germany_ rules of play                             | 2020, 1 page (plus box back) | publisher PDF                                                                        |
| FAQ       | none found                                                                   |                              |                                                                                      |
| errata    | none found                                                                   |                              |                                                                                      |
| card text | none: the game has no cards                                                  |                              |                                                                                      |
| maps      | the USA map board, transcribed in `components.md`; the four expansion boards |                              | image of the printed USA board; the expansion boards are not yet supplied (deferred) |

Where sources conflict, the later official one wins and the conflict is listed in `open-questions.md`. Each expansion map uses the base rules except where its section in R-8 says otherwise (AC, FD: "uses the base game rules, except where listed below").

## R-1 Components and setup

### R-1.1 Components (B p1)

| Component            | Count | Notes                                                                      |
| -------------------- | ----- | -------------------------------------------------------------------------- |
| Game board (USA map) | 1     | Expansions: AC and FD each add 1 double-sided board (AC p1; FD p1, p2)     |
| Player boards        | 5     | one per player colour; a row per railroad for shares                       |
| Locomotives          | 162   | 27 in each of 6 railroad colours: Red, Blue, Orange, Yellow, Purple, Black |
| Passengers           | 52    | wooden                                                                     |
| Tracker disks        | 6     | one per railroad, for counting links (R-3.3.5); bookkeeping only           |
| Hexagon tracker      | 1     | counts the active player's payment (R-3.3.5); bookkeeping only             |
| Player disks         | 15    | 3 in each of 5 player colours: money (units), money (hundreds), turn order |
| Round marker         | 1     | on the round track, which also shows which railroads are available         |

### R-1.2 Players (B p1; AC p1; FD p1)

3 to 5 players, every map.

### R-1.3 Setup (B p1)

1. Place the board.
2. Place one passenger on each city (cities carry a station icon). Map changes: Australia, no passenger on Perth or Brisbane (AC); Germany, the two Berlin hexes are one city and get one passenger (FD).
3. Place the six tracker disks and the hexagon tracker on their starting spaces (bookkeeping).
4. Locomotives form the general supply beside the board.
5. Each player takes a colour, its player board and its three disks.
6. Each player's money is $0.
7. Turn order is random.
8. The round marker goes on round 1.

### R-1.4 Railroad availability (B p1, p2)

A railroad is _available_ from the round shown; available railroads may be taken as shares (R-3.1). One new railroad is added at the end of each of rounds 1 to 4 (R-2.5).

| Railroad | Available from round | Start rule |
| -------- | -------------------- | ---------- |
| Red      | 1                    | R-4.2.1    |
| Blue     | 1                    | R-4.2.1    |
| Orange   | 2                    | R-4.2.2    |
| Yellow   | 3                    | R-4.2.3    |
| Purple   | 4                    | R-4.2.4    |
| Black    | 5                    | R-4.2.5    |

Australia and Canada introduce the railroads differently: the publisher describes "new ways in which the 6 railroad companies are introduced", but the AC rules don't say how, so the schedule and start cities are printed on those boards (gap until the maps are supplied).

## R-2 Turn structure

### R-2.1 The game (B p1)

Six rounds. Each round has three phases in order: Take a Share (R-3.1), Build Railroad Track (R-3.2), Ride the Rails (R-3.3). Then the end of round (R-2.5).

### R-2.2 Phase order (B p1, p2)

- Phase 1 runs in **reverse** turn order.
- Phases 2 and 3 run in turn order.
- Each player completes their whole phase action before the next player acts.

### R-2.3 Turn order track (B p1, p2)

The turn order is set randomly at setup (R-1.3) and recomputed at each end of round (R-2.5).

### R-2.4 Money (B p2)

Money is a single total per player, kept on a track; going past $100 moves a second disk to a hundreds track. That is bookkeeping: the total is exact and unbounded. Money is only ever gained, never spent.

### R-2.5 End of round (B p2; FD p1)

1. **Turn order.** Players are reordered by money, lowest first; the richest plays last. Ties: the rulebook says to "swap player positions" (R-2.5-H1).
2. **Round marker** advances.
3. **New railroad.** After rounds 1, 2, 3 and 4, the next railroad in R-1.4 becomes available.
4. **France only — Paris Travels:** if Paris has no passenger, one is placed there (FD).

## R-3 Actions

### R-3.1 Take a Share (phase 1) (B p1)

1. In reverse turn order, each player **must** take one locomotive of any available railroad (R-1.4) from the supply.
2. It goes on the player's board in that railroad's row: it is now one **share** of that railroad.
3. Shares let a player build that railroad's track (R-3.2) and earn its dividends (R-3.3.4).
4. A player may hold several shares of the same railroad and shares of several railroads.

### R-3.2 Build Railroad Track (phase 2) (B p1, p2)

1. In turn order, each player **may** place locomotives from the supply onto the board, one at a time, following the placement rules (R-4.1).
2. A player may build only for railroads in which they hold at least one share, and may mix any of those railroads in one turn.
3. **Placement limit** per turn, by player count:

    | Players | Limit | With a mountain placement |
    | ------- | ----- | ------------------------- |
    | 3       | 8     | 7                         |
    | 4       | 5     | 4                         |
    | 5       | 4     | 3                         |

4. **Mountains.** If any placement this turn is on a mountain hex, the turn's limit drops by one, once, however many mountain hexes are used. A player who has already placed all but one of their normal limit may not place the last on a mountain, since the reduced limit would be exceeded. Map changes: Australia −2 (R-8.2), Canada has no mountains (R-8.3), Germany exempts Orange (R-8.5).
5. **Bonuses** (R-4.3) are paid the moment the placement that earns them is made.

### R-3.3 Ride the Rails (phase 3) (B p2)

1. **Choose.** In turn order, each player **must** pick one passenger on the board, its city as the start, and a different city as the end.
2. **Route.** The player must trace a route from start to end made of **links**. A link is a path of locomotives of a single railroad that connects two cities. The route may pass through several cities, and its links may belong to any railroads; the player need not hold shares in a railroad to use it. The player chooses the route and which railroad's links are used.
3. **No looping.** Each hex may be visited at most once on the journey.
4. **Dividends.** Each railroad pays $1 per link of it used, to every player, per share of that railroad they hold (the active player included). Example (B p2): 2 Red links and 1 Blue link pay each Red shareholder $2 per Red share and each Blue shareholder $1 per Blue share.
5. **Fare.** The active player gains (total links + 1) dollars: the number of cities visited, start and end included. The trackers on the board only help count this.
6. The passenger is removed from the board.

## R-4 Track placement and building bonuses

### R-4.1 Placement rules (B p2; AC p1; FD p1)

1. A railroad's first locomotive goes in a city that displays that railroad's colour (exceptions: R-4.2).
2. Every later locomotive of a railroad must be adjacent to at least one locomotive of that railroad already on the board.
3. A railroad may have at most one locomotive in a hex.
4. A hex holds at most two locomotives, with these exceptions:
    - USA: Chicago has no limit.
    - USA: the six multi-coloured East Coast cities (showing Blue, Red, Orange and Black) hold one locomotive each, and a railroad may occupy at most two of them.
    - Canada: Toronto, France: Paris, Germany: Berlin have no limit (still one per railroad).
    - Australia: long-distance hexes hold one (R-8.2).
    - France: the four Red/Blue/Black cities and the six Paris entry hexes hold one (R-8.4).
5. Australia's Alps and the impassable hexsides of Canada and France block building (R-8).

### R-4.2 Starting a railroad (B p1, p2)

A city showing a railroad's colour is a legal start for it; Yellow is the one exception (B p2).

1. **Red and Blue** (round 1): start in one of the six multi-coloured East Coast cities, and not in the same city as each other.
2. **Orange** (round 2): any of the six East Coast cities, or Chicago.
3. **Yellow** (round 3): Chicago and/or one of the three westernmost occupied cities. The westernmost city chosen must hold exactly one locomotive before Yellow builds there; Chicago may hold any number. Which cities are westernmost is fixed at the moment the first Yellow locomotive would be placed. (Rulings: R-4.2.3-H1, R-4.2.3-H2.)
4. **Purple** (round 4): one of the four Purple & Black western cities. Germany changes this (R-8.5).
5. **Black** (round 5): any city that does not already hold two locomotives, or Chicago.

### R-4.3 Building bonuses, USA (B p2)

1. **Chicago, $2:** whenever a player places a locomotive in Chicago, including a railroad's first placement there.
2. **$5 cities:** each of the four cities with a green $5 banner pays $5 to the first player to build track into it. Nothing is paid when another railroad later builds into it, or when a railroad starts there.
3. **Transcontinental, $12 or $8, once:** the first player to complete a line of track made of different railroads connecting a West Coast Purple & Black city to one of the six East Coast cities. $12 if the railroads connect in a city hex, $8 if they connect in any other hex.

The other maps replace these (R-8).

## R-5 Information

Everything is public: the board, every player's shares, money and the turn order. The only random element is the initial turn order (R-1.3). There are no hidden components.

## R-6 Game end and scoring

1. The game ends at the end of round 6 (B p1, p2).
2. The player with the most money wins. Ties are possible: the rulebook gives no tie-break (B p2).

## R-7 Component text

No component carries rules text. The board prints reminders of R-3.2 and R-4.1 (placement limits, the mountain −1, the East Coast and Chicago capacities, two per hex) and the bonus amounts; they restate the rules above.

## R-8 Maps

The base rules apply on every map except where a section below changes them. The first release plays the USA map only; R-8.2 to R-8.5 are recorded for the later expansion maps. Each map's hexes, terrain, cities, start colours and bonus cities are a gap until the boards are supplied.

### R-8.1 USA (B)

As R-1 to R-6. Bonus cities: Chicago, the four green $5 cities, Transcontinental. Restricted cities: the six East Coast cities. Purple's start: the four Purple & Black West Coast cities.

### R-8.2 Australia (AC)

1. Setup: no passenger on Perth or Brisbane.
2. **Alps** (dark grey hexes with red X): no track.
3. **Mountains** cost two placements instead of one, once per turn: limits with a mountain placement 6 / 3 / 2 for 3 / 4 / 5 players (normal limits as base: 8 / 5 / 4).
4. **Long-distance hexes** (grey, with a circle; Perth and Brisbane are among them): building in one uses the player's whole placement turn; each holds one locomotive regardless of player count.
5. **Perth bonus:** building into Perth earns 50; it uses the whole placement turn. **Brisbane bonus:** 20, likewise. (The rules say "points"; open question.)
6. No Transcontinental bonus.
7. A passenger journey may end in Perth or Brisbane but may not start there.
8. Railroad introduction: printed on the board (R-1.4).

### R-8.3 Canada (AC)

1. Placement limits 7 / 5 / 4 for 3 / 4 / 5 players.
2. No mountains.
3. **Toronto:** no limit on locomotives, one per railroad. Building into Toronto earns $3; starting a railroad in Toronto earns $2.
4. **Intercolonial bonus, $8:** the first player to connect all three green-link cities (Sault Sainte Marie, Windsor, Québec City), using complete links only. Replaces Transcontinental.
5. **Impassable hexsides** (red lines near Montreal and Québec City, and one south of Toronto): no track may be built directly across, and no passenger may be carried directly across.
6. Railroad introduction: printed on the board (R-1.4).

### R-8.4 France (FD)

1. **Red/Blue/Black cities** (Lille, Valenciennes, Sedan, Metz): one locomotive each; a railroad may occupy at most two of them; Red and Blue may not start in the same city.
2. **Paris entry hexes** (the six hexes around Paris): one locomotive each; a railroad may occupy only one of them.
3. **Paris:** no limit, one per railroad. Building into Paris earns $10.
4. No Transcontinental bonus.
5. **Impassable estuaries** (four red lines on the Atlantic coast): no track directly across, no passenger directly across.
6. **Paris Travels** at the end of each round (R-2.5).

### R-8.5 Germany (FD)

1. Setup: the two Berlin hexes are one city (one space) with one passenger.
2. **Orange** pays no mountain penalty.
3. **Berlin:** no limit, one per railroad. Building into Berlin earns $3.
4. **Purple** (available after round 3, as base): starts in any Purple & Black city not holding two locomotives, or in Berlin.
5. **Greater Germany bonus, $12:** the first player to connect all five green-link cities (Berlin, Hamburg, Köln, München, Dresden), using complete links only. Replaces Transcontinental.
