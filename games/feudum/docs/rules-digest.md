# Feudum rules digest

Rules version: **English rulebook, December 2018 revision**, with the official player reference card and the designer's later forum rulings.

The rules as the code cites them: `R-<section>` names a section below. Built from the sources listed here and nothing else; a sentence with no source is a gap, not a rule. The digest paraphrases the rules; short quoted phrases appear only where the exact wording decides a ruling.

Marks used in place:

- **Silent:** the sources do not say. Not resolved here.
- **Ambiguous:** the sources say something that can be read more than one way. Not resolved here.
- **Conflict:** two sources (or two places in one source) disagree. Not resolved here.
- **Unread:** the value is printed only on a component or the board and could not be read from any available picture. Listed in `open-questions.md` under "Unread values".

Scope: the base game for 2 to 5 players, with the advanced rules (R-3.4). Expansions (Alter Ego, Seals & Sirens, Windmills & Catapults and its sixth player, Squirrels & Conifers, Queen's Army), the promotional and action-type Royal Writs (King Daniel, Norrin, Atticus, Lone Isle and others) and the community solo systems are out of scope and omitted throughout.

## Sources

| Source               | What it is                                                                                                                                                                                                                                          | Date or edition                | Supplied as                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| rulebook             | Rules, 24 booklet pages                                                                                                                                                                                                                             | December 2018 revision         | PDF with text layer; diagrams read from rendered images; cited "RB p. N" by booklet page                             |
| reference card       | Two-sided player reference                                                                                                                                                                                                                          | official, updated              | PDF with text layer; cited "Ref"                                                                                     |
| errata               | One reeve sentence removed from every rulebook (May 2018); the December 2018 rulebook already carries it. Against the July 2017 first printing the 2018 text also changes the harvest limit ("10 or more" goods blocks a farm, was "more than 10"). | 2018-05, 2018-12               | cited "Erratum"                                                                                                      |
| designer answers     | The designer's replies on the BoardGameGeek rules forum, 2016–2025, including a 2025 post approving a block of answers                                                                                                                              | dated per answer               | cited "D yyyy-mm-dd"                                                                                                 |
| FAQ                  | Community FAQ v1.2; entries marked "(official)" were confirmed by the designer                                                                                                                                                                      | v1.2 (corrected 2024-06)       | cited "FAQ" or "FAQ (official)"                                                                                      |
| board and components | Publisher's flat board scan (1900 × 750) and close-ups, publisher component renders, the rulebook's diagrams, player photos                                                                                                                         | 2017–2018                      | values cited "Board" or "Img"; route lines partly from a community map aid, cited "Aid" and treated as evidence only |
| card and tile text   | Action cards, Royal Writs                                                                                                                                                                                                                           | rulebook pictures and RB p. 24 | transcribed in `components.md`                                                                                       |

Where sources conflict, the later official one wins: designer answers beat the rulebook where they correct it, a later designer answer beats an earlier one, and a FAQ entry not marked official decides nothing on its own. Each such conflict is listed in `open-questions.md`.

## R-1 Components and setup

### R-1.1 Components

| Component                            | Count  | Notes                                                                                                                                                  |
| ------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Game board                           | 1      | R-1.2                                                                                                                                                  |
| Pawns                                | 15     | 3 per colour, 5 colours (red, blue, yellow, green, purple); each shows one of 6 characters at a time: farmer, merchant, alchemist, knight, noble, monk |
| Player discs                         | 20     | 4 per colour: 1 scoring marker and 3 shared between reeves (at most 2), the epic voyage and military service (FAQ)                                     |
| Influence markers                    | 100    | 20 per colour                                                                                                                                          |
| Action cards                         | 55     | 11 per colour (R-3.5)                                                                                                                                  |
| Player pouches                       | 5      | hold the committed extra or sequential good (R-3.3)                                                                                                    |
| Wine barrels                         | 5      | printed on the board, one per colour, capacity 3 sulfur (Img)                                                                                          |
| Royal Writs                          | 16     | 8 mandates (each with two alternative effects) and 8 charters (Img; `components.md`)                                                                   |
| Location discs                       | 44     | 22 placed at setup, 22 double-sided in the general supply including the 12 feudums (RB p. 3)                                                           |
| Region / landscape tiles             | 24     | 6 region stacks of 4, one each of epochs I–IV; back is a landscape (Img)                                                                               |
| King's seals / rosary beads          | 17     | one disc, seal side (red, crown) and bead side (value +2 to +5) (RB p. 12; Img)                                                                        |
| Archery targets                      | 12     |                                                                                                                                                        |
| Vessels                              | 9      | 3 ships, 3 submersibles, 3 flying machines                                                                                                             |
| Monsters                             | 2      | behemoth, sea serpent                                                                                                                                  |
| Goods                                | 170    | saltpeter 30 (white), sulfur 30 (yellow), iron 30 (black), wood 30 (brown), food 50 (green)                                                            |
| Shillings                            | 50     | 43 of value 1, 7 of value 5 (78 shillings in all)                                                                                                      |
| Progress die                         | 1      | six faces, one per region                                                                                                                              |
| Haversack                            | 1      | bag for random draws of goods                                                                                                                          |
| Epoch marker, starting player marker | 1 each |                                                                                                                                                        |

Every component is limited to the supply; there are no substitutes, and a shortage may weaken or prevent an action (RB p. 17; D 2018-05-15). Supply shared out among players (landscape replenishment) goes one player at a time in turn order (D 2018-05-15). Shillings are the one supply the code may treat as unlimited (open question).

### R-1.2 The board

1. **Regions and spaces.** Six regions with 22 location spaces: sea 3, island 4, forest 3, desert 5, badlands 5, mountain 2. Six spaces are starting locations, ringed in pink. Each region has a space for each of N, S, E and W (a space may carry two letters); the letters are printed on the board. Map data (spaces, regions, starting spaces, letters, connections): `components.md`, `space.*` and `route.*`. (RB p. 2–3, p. 21; Img)
2. **Connections.** Roads; ship routes; submersible routes; flying-machine routes; three ferryboat routes. A space reachable by a ship or submersible route is a port. Any number of pawns may share a space. (RB p. 8; D 2018-05-13, 2018-05-15) Ambiguous: several route segments (open questions, "Map").
3. **Guilds.** Six guilds round the board in a ring: Farmer → Merchant → Alchemist (left edge, bottom to top) → Knight → Noble → Monk (right edge, top to bottom) → Farmer. A guild pulls from the guild before it ("left") and pushes to the guild after it ("right"). (RB p. 14; Img)
4. **Related locations.** Each location type is related to two guilds; ruling one gives a secondary status star there (R-4.5.1) (D 2017-07-21):

    | Guild     | Character / feudum icon | Related location |
    | --------- | ----------------------- | ---------------- |
    | Farmer    | sheep                   | farm             |
    | Merchant  | coins                   | town             |
    | Alchemist | gear                    | outpost          |
    | Knight    | axe                     | farm             |
    | Noble     | crown                   | town             |
    | Monk      | cross                   | outpost          |

    Alchemist → outpost is read from a community aid only (open question).

5. **Tracks.** Scoring track 0–149 round the edge. Epoch track: five sunrays I–V (R-4.11). Region tile chart and the six stack spaces, each printed "V" (R-4.3.2). Epic voyage track, 7 spaces ending at the monastery (R-6.2). Military service track, 3 spaces (R-4.9). (Img)

### R-1.3 Guild areas

Each guild has a trade area, a guild track of three spaces left to right — apprentice (1 vp), journeyman (3 vp), guild master (5 vp, the large hexagon) — and its goods area. The setup's "5 vp hexagon" is the master space and the "3 vp hexagon" the journeyman space. (RB p. 3, p. 16; Img)

| Guild     | Goods area                                                                                                                                                     | Setup contents                                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Farmer    | barn, limit 10 goods; 4 chicken spaces for beads ("alms"); the farmer's purse                                                                                  | 1 bead (flipped from a seal) on a chicken; 10 random goods from the haversack in the barn                                               |
| Merchant  | market of 5 bins (saltpeter, sulfur, iron, wood, food) × 4 spaces, each space with a printed price; rows and columns of this 5 × 4 grid score pushes and pulls | every space filled except the last of the saltpeter and sulfur bins: saltpeter 3, sulfur 3, iron 4, wood 4, food 4                      |
| Alchemist | production carts and piles: wood 3, iron 3, food 3, sulfur 3, saltpeter 3; the vessel space covering the ferry symbol                                          | wood 3, iron 3, food 1, sulfur 1, saltpeter full; 2 random vessels on the vessel space                                                  |
| Knight    | one row per colour (at least 4 rows), each of 6 spaces in three barrel sections of 1, 2 and 3; monster icons                                                   | 2 markers per row in the first two spaces (section 1 and the first space of section 2)                                                  |
| Noble     | scroll grid of 6 seal spaces in rows of 3, 2, 1 (left-aligned), giving three rows and three columns of lengths 3, 2, 1                                         | 4 seals, red side up, on the row-1 ends, the row-2 second space and the row-3 space; the row-1 middle and row-2 first spaces stay empty |
| Monk      | the rosary (beads, bead side up); the church coffer                                                                                                            | 4 beads                                                                                                                                 |

Sources: RB p. 3, p. 17–20; Img. Unread: 18 of the 20 Merchant prices (the saltpeter bin's last space reads 2s and the sulfur bin's 1s), the Alchemist saltpeter capacity (3 or 4), the rosary's capacity. Ambiguous: which charity — purse or coffer — receives each guild's apprentice share; the rule says "opposite side of the board" (R-4.6.2).

### R-1.4 Setup

In this order (RB p. 3; Img):

1. Each player takes a colour: 3 pawns, 4 player discs, 11 action cards, 7 influence markers, 7 food, 7 shillings and a pouch into their personal supply; one disc on the scoring track at 0.
2. General supply: vessels, the remaining influence markers, the monsters, the king's seals, shillings and archery targets.
3. Shuffle the Royal Writs into a face-down deck. Build six region tile stacks, one per region, each with IV at the bottom and I on top. Put the 22 double-sided location discs, including the 12 feudums, in the general supply; shuffle the other 22, put the circle-marked ones on the 6 starting spaces and the rest on the other 16, face up.
4. Fill the guilds as in R-1.3. Knight rows: one per player, plus dummy rows in unused colours until there are at least 4 rows. Every other good goes into the haversack.
5. Shuffle the 17 seals red side up: 4 to the Noble scrolls; 4 flipped to beads onto the Monk rosary; 1 flipped onto a Farmer chicken. Then 10 random goods into the Farmer barn.
6. Epoch marker on I. One random good from the haversack beside the N space of each region.
7. Random starting player, who takes the starting player marker and the progress die.
8. In turn order, each player takes 3 different goods of their choice from the haversack; a sulfur goes to the personal supply or the wine barrel, the player's choice.
9. In turn order, each player turns one pawn to a character and places it on a starting space (any; several players may share one), then puts an influence marker on the master space of that character's guild, or the journeyman space if the master space is taken. A third player choosing the same character takes the apprentice space where it is used (4–5 players); later ones gain no position. (FAQ)

Only the real players' food and markers are dealt; nothing else changes with player count except the apprentice space (R-4.5.3) and dummy Knight rows. (D 2024-10-11; D 2018-05-15)

## R-2 Turn structure

### R-2.1 The game

Play runs through epochs I to IV, each of one or more rounds (typically 7–10 rounds in all). The epoch advances when the region tiles run down (R-4.11). When epoch V is triggered, the current round is finished, epoch V's dawn is scored, and the game ends with final scoring; no round is played in epoch V. (RB p. 6, p. 21; D 2018-05-13)

### R-2.2 A round

1. **Take actions** (R-3).
2. **Nourish pawns** (R-4.10).
3. **Roll the progress die** (R-4.11.1).
4. **Advance the epoch and score its dawn, if triggered** (R-4.11, R-4.12).
5. **End the round**: pass the starting player marker clockwise; everyone takes back all action cards; pay committed pouch goods (R-3.3). If epoch V was triggered, final scoring instead (R-6). (RB p. 6–7, p. 21)

## R-3 Actions

### R-3.1 Choosing the hand

All players secretly choose 4 of their 11 cards as the round's hand; the rest are set aside. A player may wait to see whether anyone before them in turn order commits a pouch good (R-3.3); a player finalises by announcing "Long live the king", after which the hand and the pouch good cannot change. A later player may require an earlier one to finalise first. (RB p. 6; D 2017-05-12, 2017-10-21)

### R-3.2 Playing cards

The starting player plays one card face up and carries it out; play passes clockwise one card at a time until everyone has played every chosen card. A player must play at least one card on each turn but may forfeit its action. A player with more cards (R-3.3) keeps playing after others have run out. Silent: whether those who have run out are simply skipped (assumed).

### R-3.3 Extra and sequential actions

During card selection a player may put one saltpeter or one sulfur from their personal supply on the pouch (RB p. 7):

- **Extra action** (saltpeter): the hand has five cards.
- **Sequential action** (sulfur): once this round, on any one turn, play two cards back to back. Sulfur from the wine barrel may not be used.

Never both in one round. The good is paid to the haversack at the end of the round whether or not the bonus is used. (RB p. 7; D 2017-07-21; FAQ (official); D 2025-05-28)

### R-3.4 Basic and advanced game

Each card has a regular action and, at its foot, a special ability. The advanced game — which the designer calls the game as intended — makes special abilities available when the named pawn is on the board (or, where the card shows it, at the location) or the named good is turned in. Cards marked "either/or" (Improve, Conquer, Defend, Guild) replace the regular action with the special ability; on every other card the ability adds to the regular action. (RB p. 7; D 2018-05-13; D 2020-11-27)

Card symbols: x2 (may be replayed by Repeat); crossed x2 (never replayed); not-last (may not be the last card a player plays in the round); either/or; vp. (RB p. 6)

### R-3.5 The eleven cards

| #   | Card      | Symbols                                 | Regular | Special (needs)                                                |
| --- | --------- | --------------------------------------- | ------- | -------------------------------------------------------------- |
| 1   | Migrate   | —                                       | R-3.6   | Distant Kin (Alchemist pawn on the board)                      |
| 2   | Move      | x2                                      | R-3.7   | Godspeed (Monk pawn on the board)                              |
| 3   | Influence | x2                                      | R-3.8   | Money is Influence (Merchant pawn at the location; 1 shilling) |
| 4   | Improve   | vp, either/or                           | R-3.9   | Tend Landscape (wood), instead                                 |
| 5   | Explore   | —                                       | R-3.10  | Shovels & Swords (iron), in addition                           |
| 6   | Harvest   | 1 vp                                    | R-3.11  | Inspect the Harvest (Farmer pawn on the board)                 |
| 7   | Tax       | —                                       | R-3.12  | Reinforcements (Knight pawn on the board), in addition         |
| 8   | Conquer   | 2/4 vp, crossed x2, not-last, either/or | R-3.13  | Starve the People (Noble pawn at the location), instead        |
| 9   | Defend    | 1 vp, crossed x2, either/or             | R-3.14  | Royal Immunity (food), instead, out of turn                    |
| 10  | Repeat    | —                                       | R-3.15  | Déjà Vu (saltpeter)                                            |
| 11  | Guild     | vp, x2, either/or                       | R-3.16  | Feast (sulfur from the wine barrel), instead                   |

(Img; Ref) A card needs a pawn at a location only if it shows one (Influence, Conquer, and those abilities); Improve, Harvest, Tax and Explore do not (D 2018-07-30).

### R-3.6 Migrate

1. Move one of your pawns onto or off the board. **Onto:** pay 1 food to the haversack, turn the pawn to any character, and put it on a space that holds one of your pawns or influence markers; with neither on the board, on a starting space. A space holding only your monster does not qualify. **Off:** return it to supply, free. (RB p. 8; FAQ (official))
2. **Distant Kin:** with an Alchemist pawn already on the board, the migrating pawn may instead enter at any starting space. Still one pawn. (RB p. 8; D 2025-05-28)
3. Guild status changes at once (R-4.5).

### R-3.7 Move

1. Movement allowance = your pawns on the board plus your monsters; divide it freely among them. Each point moves a piece one space along a connection it may use (R-4.2). A piece may go out and come back. (RB p. 8; D 2017-01-27; D 2018-05-13)
2. **Successful move:** at least one piece moved at least one space. (RB p. 9)
3. **Godspeed:** with a Monk pawn on the board, one monk may move +1 space at the end, whether or not it moved before. (RB p. 9)
4. **Pilfer:** after all movement (Godspeed included), one piece that moved and stands on a space with a resource may take 1 resource there: a good on the space or a farm, or a good, target or shilling on a landscape. Not from a farm you rule, nor from a landscape your own serf tends; a non-farm location you rule is allowed. Limit 1 per Move. (RB p. 8; D 2017-05-22; FAQ (official))
5. **Epic voyage:** a player who makes two successful moves in one round (by Repeat) may place a disc on epic voyage space 1 or advance their disc one space; on spaces 2, 4 and 6 they draw 2 Royal Writs and keep 1 (R-4.4). Optional, since discs are shared. (RB p. 8–9; D 2017-10-21; Img)

### R-3.8 Influence

1. Add 1 influence marker from your supply to each space holding at least one of your pawns — one per space however many pawns. Monsters do not influence. (RB p. 9; D 2017-01-27; FAQ)
2. Placement follows R-4.1.
3. **Money is Influence:** if your Merchant pawn is on a space ruled by an opponent's single marker, pay 1 shilling to the general supply: their marker becomes the serf and yours goes on top as ruler; if you already had a serf there it becomes your subject. One merchant only. (RB p. 9; D 2018-08-26; D 2024-10-11)

### R-3.9 Improve

1. Improve one location you rule by turning in: outpost → farm, wood; farm → town, iron; town → feudum, king's seal. Replace the disc from the general supply, your ruling marker on top; for a feudum choose its guild icon. Goods on an outpost become the farm's harvest; goods on a farm becoming a town go to the haversack. One improvement per card. (RB p. 10; FAQ (official); D 2018-05-15)
2. Then take a region tile and score (R-4.3.2).
3. **Tend Landscape** (instead): turn in a wood to place one of your collected region tiles, landscape side up, at a location where you are the serf and which has no landscape; score 2 vp; it is filled at once (R-4.3.4). (RB p. 11; D 2017-06-24)

### R-3.10 Explore

1. If you rule an outpost: draw 2 Royal Writs, +1 per additional outpost or feudum you rule; keep 1, the rest to the bottom of the deck. (RB p. 11)
2. **Shovels & Swords:** then turn in an iron to draw 2 more and keep 1 more. (RB p. 11)

### R-3.11 Harvest

1. If you rule a farm with fewer than 10 goods: draw goods at random from the haversack onto one such farm; score 1 vp. Total = 5 + 1 per other farm or feudum ruled + each held rosary bead's value, at most 10. A farm's goods are not capped otherwise (replenishment may push it above 10). (RB p. 12; D 2018-08-27)
2. **Favors:** decide before drawing to take favors: the farm receives the partial harvest and the remainder goes to your supply (RB p. 12):

    | Total   | 5   | 6   | 7   | 8   | 9   | 10  |
    | ------- | --- | --- | --- | --- | --- | --- |
    | Partial | 4   | 5   | 5   | 5   | 6   | 6   |
    | Favors  | 1   | 1   | 2   | 3   | 3   | 4   |

    Taking favors flips every bead you hold to its seal side. (RB p. 12; D relayed 2020-03-07)

3. **Inspect the Harvest:** with a Farmer pawn in play, draw the total first and choose the favors openly from it. (RB p. 13)

### R-3.12 Tax

1. If you rule a town: take 2 shillings + 1 per other town or feudum ruled. (RB p. 13)
2. **Reinforcements:** with a Knight pawn on the board, also take 1 of your influence markers from the general supply, or from your Knight Guild row if the supply has none of your colour. (RB p. 13; D 2020-11-27; D 2018-08-27)

### R-3.13 Conquer

1. Target one opponent's pawn, monster or feudum on a space where you have a pawn or monster. Outposts, farms and towns are never targets. May not be your last card of the round. Resolve by R-4.8. Scores 2 vp (pawn or monster) or 4 vp (feudum). (RB p. 13)
2. **Starve the People** (instead): with your Noble pawn on a space where an opponent has a subject or serf, remove one of them (returned to its owner) — no strength contest; no vp; you may place a military service disc (R-4.9). Then all beads on the Farmer Guild's chickens go to the general supply. (RB p. 13; D 2018-05-13; D 2020-11-27)

### R-3.14 Defend

1. If you chose Defend and an opponent conquers your piece, flip it out of turn: +1 defence for that combat and 1 vp. It helps against one combat only. If nobody attacks you, playing it in turn scores 1 vp; if you have to play it in turn before an attack comes, it gives no defence but still 1 vp. (RB p. 14; FAQ (official))
2. **Royal Immunity** (instead): only when your subject or serf is the target of a Starve the People: turn in a food, cancel it, and put a king's seal from the general supply under that marker; while the seal is there that marker cannot be starved; you may take the seal back to use at any time, ending the protection. (RB p. 15; D 2017-10-21)

### R-3.15 Repeat

1. Replay one card you already played this round that carries x2. One repeat per round. (RB p. 14; D 2025-05-28)
2. **Déjà Vu:** turn in a saltpeter to replay a card without x2 instead; never Conquer or Defend. (RB p. 15)

### R-3.16 Guild action

1. Choose one guild and one of its functions: trade (anyone), pull (its journeyman), push (its guild master). (RB p. 14) Functions: R-4.6.
2. A second guild action in the round (by Repeat) must use a different guild; a feast counts as using its guild. (RB p. 14; FAQ (official); D 2025-05-28)
3. **Feast** (instead): turn in a sulfur from your wine barrel; on a space where you have a pawn and an opponent has a pawn or feudum, perform that opponent's own function in the related guild — the push if they are its master, the pull if journeyman — and score its points +3 vp, taking their share of a purse or coffer split. Never for your own pieces; no reeves score. (RB p. 15; D 2018-08-27; D 2025-05-28; FAQ (official))

## R-4 Mechanisms

### R-4.1 Location control

1. A space holds at most 3 influence markers, from at most 2 players, at most 2 from one player. (RB p. 9)
2. The first marker goes on top of the disc: **ruler**. A different player's marker: **serf**. The ruler's own second marker: **subject** (no serf needed first). If the serf adds a marker, the serf becomes ruler with a subject and the old ruler drops to serf. Nobody is ever both ruler and serf of one space. (RB p. 9; D 2017-07-21; D 2018-05-15; FAQ)
3. A landscape always belongs to the space's current serf; when the serf changes, it passes to the new serf; with no serf it is untended. (D 2020-02-05)
4. Ruled locations count for guild status (R-4.5), active regions (R-4.12.1), Tax, Explore, Harvest, final scoring and charters; serfs and subjects count for none of these, but a tending serf counts for active regions. (RB p. 9, p. 21; D 2018-05-13)

### R-4.2 Movement media, vessels and monsters

1. **Roads:** any pawn; the behemoth.
2. **Vessels:** a pawn must be on a vessel of the route's type. A vessel in your supply may be placed under one of your pawns at any time on your turn, free; once placed it never leaves the board. A pawn may leave its vessel and continue by road or another vessel; any pawn may board an abandoned vessel when moving. Pawns on vessels act normally on their space. A conquered pawn's vessel stays. Monsters never use vessels. (RB p. 8, p. 13; FAQ)
3. **Ferryboats:** any pawn, 2 shillings to the general supply per one-way trip — only while the Alchemist Guild has no vessel for sale. (RB p. 8, p. 18)
4. **Monsters:** gained by Tame the Beast (R-4.6.3). A monster adds 1 to movement, can pilfer, conquer and use weapons, has attack +1 and defence +1, needs no food, cannot influence, feast or use vessels. The behemoth moves by road and flying-machine routes; the sea serpent by ship and submersible routes. An opponent's pawn on a monster's space is pinned: it can only migrate off, conquer the monster, or wait for it to leave. A defeated monster returns to the Knight Guild and its owner's marker comes back. (RB p. 19; D 2017-01-27; FAQ)

### R-4.3 Region tiles and landscapes

1. **Stacks.** Six region stacks, epoch I on top. A tile is legal to take if its epoch is the current one or earlier. (RB p. 10; D 2018-08-26)
2. **Reward for improving** (R-3.9): take the top tile of the improved space's region stack. If legal, score by the chart:

    | Tile epoch | Farm | Town | Feudum |
    | ---------- | ---- | ---- | ------ |
    | I          | 2    | 3    | 4      |
    | II         | 3    | 4    | 5      |
    | III        | 4    | 5    | 6      |
    | IV         | 5    | 6    | 7      |

    If not legal (prohibited), take a tile of an earlier epoch than the current one from another stack and score nothing; if none exists (always so in epoch I), take nothing. (RB p. 10–11; D 2017-05-12; D 2018-05-15; D 2025-05-28; Img) Ambiguous: which stack when several qualify.

3. **Collected tiles** are wild: at any time discard one (it leaves the game) for a good of your choice from the haversack, or place it as a landscape (R-3.9.3). (RB p. 11; D 2018-08-26)
4. **Landscapes:** orchard (food), silver mine (shillings), archery butt (targets), sulfur mine (sulfur). When placed, and at each epoch dawn after scoring, 3 of its resource are added. Each time, the serf may collect everything on it, paying 1 of it to the ruler, or leave it. Targets collected become influence markers of your colour from the general supply (never from the Knight Guild; excess targets are discarded). An untended landscape still fills. One landscape per space, never removed or replaced. (RB p. 11, p. 21; FAQ (official); D 2017-05-12)

### R-4.4 Royal Writs

1. **Drawing:** look at all drawn, keep the stated number, put the rest on the bottom of the deck. (RB p. 11; D 2017-01-27)
2. **Mandates:** play at any time; resources come from the general supply (goods drawn at random from the haversack); some need a good turned in (shown boxed) or 3 status stars in a pictured guild — then you may take only the reward of a guild where you have 3 stars, one reward per card. A played mandate goes to the bottom of the deck. (RB p. 11, p. 24; D 2017-10-21; D 2018-05-15; D 2018-08-27; FAQ)
3. **Charters:** score at game end only with a king's seal placed on them; sealing may happen earlier. "Per location ruled" counts ruled spaces only, and one space may count for several charters. (RB p. 11; D 2017-10-21; D 2018-05-13)
4. **Hand limit:** never end a turn holding more than 3 (sealed charters included); discard to the bottom of the deck at any time. Writs are hidden until played, discarded or scored. (RB p. 11; D 2017-06-24; D 2017-10-21)
5. Card texts and their keywords: `components.md` and R-7.

### R-4.5 Guild membership and status

1. **Status stars** in a guild: +1 per pawn of its character on the board, +3 per feudum of its icon you rule (primary); +1 per related location you rule (secondary, R-1.2.4), counted only while you have a primary there. Monsters give none. (RB p. 16; D 2017-07-21)
2. **Membership needs a marker.** With 1+ stars you must at once put an influence marker from your supply on that guild's track. Without one you are not a member — no push, pull, vp or rank, and nobody is displaced — until you get a marker, when you must place it at once if you still qualify. Guild markers are never removed voluntarily. (RB p. 16; D 2017-10-21; D 2018-05-15; D 2025-05-28)
3. **Rank:** most stars, master; second, journeyman; third, apprentice (4–5 players only; with 2–3 players the track has master and journeyman only). To take a space you must have more stars than its holder (ties keep the holder); the holder moves down one, off the track if none is left (marker to supply). Stars falling to 0 remove you (marker to supply). (RB p. 16; D 2018-05-15; D 2018-08-26)
4. Status is rechecked whenever a pawn enters or leaves the board, changes, or a ruled location or feudum changes hands. Silent: the order of re-ranking when one event changes several players' stars at once.
5. **Dawn scoring:** master 5, journeyman 3, apprentice 1 (R-4.12.1).

### R-4.6 Guild functions

1. **Pull and push amounts.** Move the stated number, or as many as can move if fewer ("fewer if impossible"); where a range is given the actor chooses. At least one item must move and there must be room for it; if nothing can move, that function cannot be chosen. A function that moves something but reaches no threshold scores 0 — no Royal Writ, no reeves — but still splits the purse or coffer. Only rows or columns completed by this action count, and the actor counts rows or columns, never both. (RB p. 17; D 2016-11-11; D 2018-05-13; D 2018-08-27; D 2020-02-05; D 2025-05-28; FAQ)
2. **Paying a guild** (any shilling price there): 1 to the master, 1 to the journeyman, 1 to charity, repeating; charity is the purse or coffer opposite. An absent member's shilling goes to the general supply. A member pays themselves but must hold the full price. (RB p. 14, p. 16)
3. **Trade** (anyone):
    - Farmer: send all goods from one farm you rule into the barn; take 1 food (from the haversack) or 1 shilling per 2 goods sent. Goods beyond the barn's limit of 10 go to the haversack, except that a number equal to the sum of the beads on the chickens, chosen at random from the shipment, spill into the Merchant market and then the Alchemist carts where they fit; the rest go to the haversack. (RB p. 17; D 2016-11-11; D 2017-07-21)
    - Merchant: buy up to 3 goods at their printed prices, always the cheapest available of that good (right to left); incoming goods fill left to right. (RB p. 17; FAQ (official))
    - Alchemist: buy 1 vessel for 3 shillings. (RB p. 18)
    - Knight: pay 3 shillings to take all the markers in your row. **Tame the Beast:** if that was 3 or more, you may return 3 — 2 to the supply, 1 on a monster's icon — to control that monster, deploying it at once to a space holding your pawn or marker that it can reach (sea serpent: a port; behemoth: by road or flying-machine route). Only during this trade. (RB p. 19; D 2017-06-24; FAQ)
    - Noble: buy 1 or 2 king's seals for 3 or 6 shillings, from the general supply. (RB p. 19) Ambiguous: from the general supply or from the scrolls.
    - Monk: pay 3 shillings; take the highest- and lowest-valued beads on the rosary; an opponent hides one in each hand; pick a hand and keep that bead; the other returns. Needs at least 2 beads. (RB p. 20; D relayed 2022-03-13)
4. **Pull** (journeyman), from the guild before; on reaching the threshold score 3 vp and draw 2 Royal Writs, keep 1 (RB p. 14, p. 17–20; Ref):
    - Farmer: take the high and low beads from the rosary; an opponent hides them; pick one onto an empty chicken, the other returns. Threshold: chickens total 5+.
    - Merchant: 3 goods from the Farmer barn into the market. Threshold: 1+ row or column completed.
    - Alchemist: 2 goods from the market into the carts and piles. Threshold: 1+ cart or pile completed.
    - Knight: from the Alchemist carts, invent 1 krud barrel (R-4.6.6) or 1 vessel (onto the Alchemist vessel space). Always reaches the threshold.
    - Noble: 2 markers of different colours from the Knight rows to the general supply, replaced by 2 king's seals from the general supply on empty scroll spaces. Threshold: 1+ row or column. (D 2016-11-11; D 2018-08-27)
    - Monk: 1 seal from the Noble scrolls flipped onto the rosary. Threshold: rosary total 11+.
5. **Push** (master), to the guild after; 1/2/3 completions or thresholds score 4/5/6 vp (RB p. 14, p. 17–20; Ref):
    - Farmer: 5 goods from the barn into the market; rows or columns completed; then split the farmer's purse with the journeyman, the master keeping the odd shilling; with no journeyman, that half stays.
    - Merchant: 4 goods from the market into the carts and piles; carts or piles completed.
    - Alchemist: 1–3 inventions from the carts — vessels onto the vessel space, krud barrels into the Knight rows; goods used go to the haversack; inventions made. Ship = food + 2 wood; submersible = food + 2 iron; flying machine = food + iron + wood; the 1st, 2nd and 3rd krud barrel of one push cost 2 saltpeter + sulfur, saltpeter + sulfur, wood. Silent: whether the barrel discount counts barrels of this push or of the game (read as this push).
    - Knight: 1–3 markers of different colours from the Knight rows to the general supply, replaced by that many seals from the general supply on empty scroll spaces, unseen; rows or columns completed.
    - Noble: 2 seals from the scrolls flipped onto the rosary; rosary total 5 / 11 / 17+.
    - Monk: as the Farmer pull (bead to a chicken); chickens total 3 / 6 / 9+; then split the church coffer as the purse. Needs at least 2 beads on the rosary and an empty chicken.
6. **Krud barrels:** each barrel invented fills the leading unfilled section of every Knight row (player and dummy rows alike) with that colour's markers from the general supply, as far as the section has room. A barrel can only be invented while some row still has an unfilled section. (RB p. 18; D 2018-05-15; D 2021-12-09)

### R-4.7 Reeves

When your push or pull scores, you may place one of your discs as a reeve in that guild if you have none there (pull: left; push: right). Then score +1 vp if you have a reeve in this guild, and +1 more if your other reeve is in another guild. This repeats on every later scoring push or pull there. A reeve follows your marker between master and journeyman and returns to supply if you drop to apprentice or off the track. At most 2, never two in one guild, never in a feast. (RB p. 16; Erratum; D 2018-05-08; D 2018-08-27; FAQ)

### R-4.8 Combat

1. **Sequence:** the attacker plays Conquer and names one target; the defender may flip Defend; then the attacker may add saltpeter and weapons. (D 2016-11-11; FAQ)
2. **Strength.** Attack: +1 per attacking pawn or monster on the space, +1 for one saltpeter (any number if one of the attacking pawns is a knight), +1 or +2 per weapon (Royal Writs), +1 for the attacker's serf when the target is a feudum. Defence: +2 per defending pawn, +1 per defending monster on the space, and for a feudum +2 and +1 for the defender's subject; +1 for a flipped Defend. A drunk pawn contributes 0 (its weapons and saltpeter still work). Only the attacker's and defender's pieces count. Attack must exceed defence. (RB p. 13; D 2017-01-27; D 2018-08-27; FAQ (official)) Ambiguous: whether the attacker chooses which of their pieces join; read as all on the space.
3. **Win:** a pawn returns to its owner's supply; a monster returns to the Knight Guild; a feudum becomes an outpost and every marker on it returns to its owner, unless the attacker had a serf there, who becomes the outpost's ruler; goods and landscape stay. Other defending pieces are unharmed. Guild status updates. Score 2 vp (pawn or monster) or 4 vp (feudum), and you may place a military service disc. **Loss:** nothing happens. (RB p. 13; D 2018-05-15)

### R-4.9 Military service

1. Each successful Conquer or Starve the People lets the actor place one of their discs on the next space of the military service track they have not yet covered themselves (3 spaces, left to right; every player has their own progress along the same printed spaces), vassal or not. (RB p. 10; D 2018-05-13)
2. A **vassal** rules at least one feudum (several feudums are one obligation). At the dawn of epochs II, IV and V a vassal loses the value of each uncovered space due by then: space 1 (−3) from II, space 2 (−4) from IV, space 3 (−5) at V — cumulatively, so a vassal from epoch I who never serves loses 3, then 7, then 12 (22 in all). (RB p. 10, p. 21; D 2016-11-24; Img)

### R-4.10 Nourish and wine

1. After the last card, every pawn on the board must be fed with 1 food (to the haversack) or wine, if you have them; spending a region tile is optional. Unfed pawns return to supply. Monsters eat nothing. (RB p. 20; D 2018-08-26)
2. **Wine:** every sulfur you gain goes either to your supply or your barrel (max 3). Feeding with wine puts a barrel sulfur on the pawn: it is fed this round and the next; during that next round the pawn's own attack and defence are 0; at the end of it the sulfur is removed. (RB p. 20; FAQ (official))

### R-4.11 Progress die and epochs

1. After nourishing, roll the progress die and remove the top tile of that region's stack if legal (R-4.3.1); otherwise roll again; if no legal tile remains anywhere, don't roll. (RB p. 20)
2. **Advancement:** the next epoch is triggered when the stack tops show 4 epoch II tiles (for II), 3 epoch III (for III), 2 epoch IV (for IV), or 1 empty stack showing its printed V (for V). Epochs advance one at a time. The check happens at this step only; a mid-round improvement that meets the condition triggers the epoch at this step. (RB p. 21; D 2018-08-26; Img) Ambiguous: a mid-round trigger and this step (open question).

### R-4.12 Dawn of an epoch

On triggering epochs II–V, advance the marker and, in order (RB p. 21; Img):

1. **Score:** guild ranks 5/3/1; each landscape your serf tends, 2 vp empty or 4 vp with 1+ resource; active regions — regions where you rule a location or tend a landscape — 1/3/5/7/9/11 vp for 1–6.
2. **Disloyalty** (II, IV, V): R-4.9.2.
3. **Replenish landscapes:** +3 each, players in turn order; serfs may collect.
4. **Replenish the map** (II, III, IV): one random good from the haversack beside the S (II), E (III) or W (IV) space of each region, even if goods are already there; on a farm it joins the harvest.
5. **Replenish guilds** (III): refill every guild's setup spaces (R-1.3); extras stay.

## R-5 Information

1. **Hidden:** each player's hand of action cards until played (R-3.1); the Royal Writs each player holds; the order of the Royal Writ deck; which hand holds which bead in the Monk/Farmer bead draw (R-4.6); the values on the bead side of seals placed red side up (setup, the Noble scrolls) (RB p. 19).
2. **Random:** every draw from the haversack; the progress die; the seal shuffle; the starting player; the 2 setup vessels; the spill-over choice of goods (R-4.6.3).
3. **Public:** everything else, including goods, shillings, markers, tiles and wine barrels in each personal supply, the pouch good once finalised, and cards played.
4. Silent: whether a seal's bead value is hidden from its owner and others while red side up; whether the haversack's contents may be inspected.

## R-6 Game end and scoring

### R-6.1 End

When epoch V is triggered, finish the round, score epoch V's dawn (R-4.12), then final scoring. (RB p. 21; D 2018-05-13)

### R-6.2 Final scoring

- **Epic voyage:** four sections — spaces 1–2 (3/5), 3–4 (7/9), 5–6 (11/13), 7 the monastery (17). In each section the furthest-on disc and any tied with it score the higher value; other discs there the lower. (RB p. 9; D 2016-12-11; D 2020-02-05; Img)
- **Large empires:** 1 vp per outpost, farm or town ruled; 3 per feudum; +3 per set of 3 alike ruled locations, a feudum being wild and used in one set only (3 feudums are also a set). (RB p. 21; D 2018-05-15)
- **Shillings:** 1 vp per 3.
- **Sealed charters:** as printed.

### R-6.3 Winner

Most vp. Tie: most sulfur in the wine barrel; still tied, shared. (RB p. 21)

## R-7 Component text

The texts are in `components.md`. Their keywords:

- **Turn in:** pay the named good to the haversack.
- **\* (drawn from supply):** the reward comes from the general supply; goods are drawn at random from the haversack. (RB p. 24; D 2018-05-15)
- **Boxed good:** the good to turn in; unboxed goods on a card are only the recipe picture. (D 2018-08-27)
- **Reach 3★ in one guild:** having at least 3 status stars in one of the pictured guilds; take that guild's reward, one per card. (FAQ)
- **Use … for free:** a weapon adding attack without a cost; a mandate, so played once.
- **Kingdom (per location ruled):** the count of marked spaces you rule at game end.
