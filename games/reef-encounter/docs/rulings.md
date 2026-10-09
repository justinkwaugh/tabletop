# Reef Encounter: rulings

How this implementation reads the second-edition rules (Z-Man, 2004), with the designer's later changes. Each entry gives its source. The board layout is in [board-map.md](board-map.md).

## Components

- **Coral tiles.** Ten tiles, each pairing two corals and two algae. The starfish side of each is recorded in `src/components/coralTiles.ts`; the reverse swaps both the corals and the algae (rulebook p. 10). Confirmed against photographs of both sides of every tile.
- **Polyps.** 40 of each of the five coral colours (rulebook p. 2).
- **Larva cubes.** 10 of each coral colour (rulebook p. 2).
- **Player colours.** The four printed shrimp colours: purple, green, red and yellow.

## Setup

In the rulebook's order (pp. 3–4):

1. One reef board per player, chosen at random. Each starts with one polyp of each colour on its marked squares, taken from the supply rather than the bag.
2. One bonus polyp of each colour waits beside the open-sea board for extra growth. Every other polyp goes into the bag.
3. One coral tile is flipped, and all ten tiles show the side it landed on.
4. Each open-sea space gets a larva cube of its colour.
5. A polyp drawn from the bag names the first open-sea space and goes back into the bag, which is then reshuffled. The spaces then receive 3, 3, 3, 2 and 1 polyps clockwise from it. Clockwise is the direction of the arrows on the second-edition board: white, yellow, orange, pink, grey.
6. The start player is chosen at random. In turn order from them, players are dealt 6, then 9 (two players); 6, 7, 9 (three); or 6, 7, 8, 9 (four) polyps behind their screens.
7. In turn order, each player secretly feeds one of their polyps to their parrotfish. Nobody else ever learns its colour before the game ends.
8. In turn order, each player takes two larva cubes from the supply and shows them. Two of the same colour are allowed.

## Turns

- **Action 10 ends every turn** (rulebook pp. 4–5): the player takes one larva cube from the open sea with every polyp on its space. Those polyps' colours were seen by everyone, so they count as known polyps behind the screen.
- **Refill.** The taken cube is replaced by one of the same colour from the supply, then every space holding fewer than three polyps gains one from the bag (rulebook p. 5). The polyps come from a shuffled bag, so the refill is a reveal and Undo cannot step back past it.
- **The bag running dry.** When the bag holds fewer polyps than the refill needs, the five bonus polyps go into it and it is reshuffled (rulebook p. 11).
- **Shortage ends the game at once** (rulebook p. 11, end condition 4): if the supply has no cube of the taken colour, or the bag, with the bonus polyps, cannot supply the refill, the game ends with no extra turns. The open sea is left as it stood.
- The game is one continuous round, with turns passing clockwise (rulebook p. 5).

## Growing corals

- **Larva cubes (actions 2 and 3).** A player may play up to two larva cubes a turn, of any colours, the same colour twice included. Each cube goes back to the supply. Polyps of its colour may then follow: up to four from behind the screen, plus any number of consumed polyps (rulebook p. 5). Once the second cube is played, no more polyps of the first cube's colour may be placed (rulebook p. 7).
- **Which screen polyps are played.** Polyps whose colour everyone saw arrive, from the open sea, are played before the secret ones dealt at setup, so opponents learn only what they could have tracked.
- **Where a polyp may go.** On rock, not sand; never on a square with a shrimp; and never where it would join two corals of its colour that each carry a shrimp (rulebook p. 6). Polyps placed for one cube need not form one coral, and may go on different boards (designer ruling).
- **Attacks.** A polyp may replace a polyp of a weaker colour, as the coral tiles currently show, when it joins a coral of its own colour that already has at least two polyps, and no shrimp protects the target (rulebook pp. 7 and 9). The replaced polyp goes in front of the attacking player's screen as a consumed polyp. A coral split by an attack lives on as separate corals.
- **Which coral attacks.** Any coral may attack unless it is a single polyp: the attacking coral must already hold at least two orthogonally connected polyps (rulebook p. 7, "adding a third or additional polyp"; confirmed by the user). Two single polyps that the new polyp would join do not qualify.
- **Shrimp protection.** A shrimp protects the polyp under it and the polyps of the same coral orthogonally next to it, never another coral's polyps (rulebook p. 9).
- **Extra growth.** Whenever a polyp is placed orthogonally next to the board's empty starfish square, a bonus polyp of its colour grows there at once, without counting towards the cube's four. It does not grow if a shrimp is on the square, if no bonus polyp of that colour is left, or if it would join two guarded corals (rulebook p. 7). The bonus polyp is replaced by picking one of that colour out of the bag, when the bag has one.

## Scoring

- Each polyp in a player's parrotfish scores its colour's value: 1, plus 1 for every coral tile currently showing that colour as the stronger coral. The values always total 15 (rulebook p. 12).
- Ties are broken, in order, by consumed polyps in front of the screen, unplayed larva cubes, unplayed screen polyps, then polyps on the boards in corals protected by the player's shrimps. Players still level share the place (rulebook p. 12). Until consumed polyps and shrimps on the reef exist in this implementation, ties use the two in between.

## Hidden information

- The polyps dealt at setup and the polyp fed to the parrotfish at setup are hidden from the other players until the game ends, since nobody could track them at the table.
- With the **Concealed** option off (the default), anything a careful player could track is shown: larva cubes, shrimps behind the screen, and polyps whose colours were seen when taken from the open sea.
- With **Concealed** on, the game hides what the printed rules hide: everything behind the screens.
- The order of the polyps in the bag is never shown; how many remain is public.
- **When the game ends, everything is revealed to everyone**: every screen, every parrotfish including its setup polyp, and every shrimp count. The bag's order stays hidden, since it no longer affects anything.
