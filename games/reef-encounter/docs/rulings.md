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

## Hidden information

- The polyps dealt at setup and the polyp fed to the parrotfish at setup are hidden from the other players until the game ends, since nobody could track them at the table.
- With the **Concealed** option off (the default), anything a careful player could track is shown: larva cubes, shrimps behind the screen, and polyps whose colours were seen when taken from the open sea.
- With **Concealed** on, the game hides what the printed rules hide: everything behind the screens.
- The order of the polyps in the bag is never shown; how many remain is public.
- **When the game ends, everything is revealed to everyone**: every screen, every parrotfish including its setup polyp, and every shrimp count. The bag's order stays hidden, since it no longer affects anything.
