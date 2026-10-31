# Promontory Point rules digest

The rules as the code cites them: `R-<section>` names a section below. Built from the sources listed here and nothing else; a sentence with no source is a gap, not a rule.

Promontory Point re-themes a published game around the transcontinental railroads. The digest is written in the rulebook's own terms so that each rule can be checked against it; the theme's names are mapped in R-0 and the code uses the theme's names.

## Sources

| Source            | What it is                                                                                                                                                         | Date or edition | Supplied as |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ----------- |
| rulebook          | Original rulebook, English (eggertspiele / Pegasus), 4 pages                                                                                                       | © 2012          | PDF         |
| rulebook (German) | German rulebook, used to cross-check the English text                                                                                                              | © 2012          | PDF         |
| forum             | BoardGameGeek rules forum: "Illness Tiles" (2018-12-07), "Running out of money / Bankruptcy" (2012-08-31 to 2024-07-11)                                            | —               | web page    |
| board             | The Promontory Point map supplied with this title's art: hex grid, four railroad headquarters, the Promontory space, the share-price track and a 0–99 border track | 2026            | image       |
| FAQ               | none published                                                                                                                                                     | —               | —           |
| errata            | none published                                                                                                                                                     | —               | —           |

Where sources conflict, the later official one wins and the conflict is listed in `open-questions.md`.

## R-0 Theme names

| Rulebook                         | Promontory Point                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| travelling show (4 colours)      | railroad: Central Pacific (CP, blue), Union Pacific (UP, purple), Kansas Pacific (KP, red), Southern Pacific (SP, yellow) |
| headquarters                     | the railroad's home hex                                                                                                   |
| royal court                      | Promontory, UT (the centre hex, +5)                                                                                       |
| entertainer card                 | share card ("One Share")                                                                                                  |
| sponsor / release an entertainer | buy / sell a share                                                                                                        |
| prestige path, reputation        | share-price track, share price                                                                                            |
| village tile                     | town tile                                                                                                                 |
| travel marker                    | track piece (R-0-H1)                                                                                                      |
| ducats                           | dollars                                                                                                                   |

## R-1 Components and setup

### R-1.1 Components

- 44 entertainer cards: 11 in each of the 4 colours. Only the colour matters.
- 96 travel markers: 24 in each colour, drawn at random from a bag.
- 48 village tiles. Each carries one event (R-4.2). The rulebook prints the counts as 6, 8, 5, 4, 6, 3, 8, 8 (the mapping to tile kinds is in the graphic only; see R-1.1-H1).
- 1 board: villages and empty spaces, the royal court at the centre, the 4 headquarters at the edges, a prestige path per show. On the Promontory Point map: 123 spaces (48 village spaces, 74 empty spaces including the coastal hex below the Southern Pacific home (R-1.1-H3), the Promontory space), the 4 railroad home hexes, and one shared share-price track.
- 54 coins (denominations not stated; the implementation keeps money as a number).
- 4 marking pieces, one per colour, on the prestige paths.
- 1 bag, 4 overview cards.

### R-1.2 Prestige path

Each colour's marker shows its reputation. The path runs from 25 down to "the last 0 before the headquarters"; the Promontory Point track runs 25, 24 … 3, 2, 1, then five spaces marked 0. A marker never moves past 25 or past the last 0; any movement beyond is lost.

### R-1.3 Setup

1. Shuffle the 48 village tiles and place one face up on each village space. Empty spaces and the royal court stay empty.
2. Sort the entertainer cards into 4 face-up decks by colour.
3. Put each colour's marker on 5 of its prestige path.
4. Each player takes 1 entertainer card of each colour (so each deck starts with 11 minus the player count). Cards a player holds are face up, sorted by colour, visible to all.
5. Each player takes 20 ducats. Money may be kept hidden.
6. Put all travel markers in the bag. Each player draws 3 at random and keeps them concealed.

No setup step depends on the player count (2–4 players).

## R-2 Turn structure

### R-2.1 Turn order

A starting player is chosen; play then goes clockwise. The game has no rounds.

### R-2.2 A turn

1. The player reveals the 3 travel markers in hand.
2. The player may take up to 2 entertainer actions (R-3.1, R-3.2) in total, each before or after the placements, never between them.
3. The player must place all 3 travel markers, one after another, in an order of their choosing (R-3.3). The three placements are not interrupted by entertainer actions.
4. The player draws 3 new travel markers from the bag and keeps them concealed.

Allowed orders: actions then placements; one action, placements, one action; placements then actions. Forbidden: an action between two placements.

## R-3 Actions

### R-3.1 Sponsor an entertainer

Take a card of any colour from that colour's deck; pay the bank that colour's current reputation (free at 0). A player may hold any number of cards. An empty deck cannot be bought from.

### R-3.2 Release an entertainer

Return one of your cards to the top of its colour's deck; take that colour's current reputation from the bank (nothing at 0).

### R-3.3 Place a travel marker

A marker may go on a space that (a) holds no travel marker and (b) is adjacent to its colour's headquarters or to a travel marker of its colour already on the board. If the marker fits nowhere, it is removed from the game and the player draws a replacement from the bag. A marker placed on a village tile or on the royal court triggers that space's event at once (R-4.2). The event concerns the marker's colour and every player.

## R-4 Reputation and events

### R-4.1 Reputation

Reputation moves on the prestige path (R-1.2). It sets the price to sponsor, the money from a release, and the value of each card at the end.

### R-4.2 Events

| Event       | Effect on the marker's colour                                               |
| ----------- | --------------------------------------------------------------------------- |
| +1          | reputation +1                                                               |
| +2          | reputation +2                                                               |
| +3          | reputation +3                                                               |
| royal court | reputation +5                                                               |
| −1          | reputation −1                                                               |
| −2          | reputation −2                                                               |
| −3          | reputation −3                                                               |
| Pay day     | every player takes 2 ducats from the bank per card of that colour they hold |
| Illness     | every player pays the bank 2 ducats per card of that colour they hold       |

Pay day and Illness apply to all players, not only the one who placed the marker (rulebook example; confirmed in the forum, 2018-12-07).

### R-4.3 Paying for Illness

A player who cannot pay must at once release cards until they can pay; each card so released returns only half the colour's current reputation, rounded down. The rulebook says nothing further; see R-4.3-H1 to R-4.3-H4.

## R-5 Information

- Public: the board, the tiles, every marker placed, every reputation, every card each player holds, the deck sizes, the number of markers left in the bag.
- Private to its holder: the 3 travel markers in hand until revealed at the start of the holder's turn; money ("may be kept hidden").
- Hidden from all: the order of the bag.
- Revealed: the hand at the start of its owner's turn; each draw from the bag (to its drawer).

## R-6 Game end and scoring

### R-6.1 End conditions

The game ends immediately after a player's turn when both (a) at most one red-bordered village tile has no travel marker on it, and (b) the royal court holds a travel marker. It also ends when, at the end of a turn, the last travel marker is drawn from the bag.

### R-6.2 Final payment and winner

Each card pays its holder its colour's current reputation. The player with the most ducats wins; a tie shares the victory.

### R-6.3 Variant

Each player draws 4 markers at setup but still places 3 per turn. At the end of the turn the player either keeps the fourth and draws 3, or returns it to the bag and draws 4.
