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

## Shrimps

- **Introducing (action 4).** Once a turn, a player may put a shrimp from behind the screen onto any polyp of a coral that has no shrimp. A new shrimp never goes onto bare rock (rulebook p. 5).
- **Order of actions.** Every action except moving shrimps must be finished before another starts (rulebook p. 4). Introducing a shrimp therefore ends the larva cube being played: no more polyps of its colour may follow, though a second cube may still be played (confirmed by the user).
- **Moving (action 5).** Any number of times a turn, and in the middle of placing polyps, a player may move one of their own shrimps to another polyp of the same coral, to a polyp of another coral, to bare rock, or back behind the screen (rulebook p. 5). A shrimp left on bare rock must move on before the turn ends, so the turn cannot end while one is there (rulebook p. 5).
- **Limits.** Two shrimps are never on the same coral, and a player never has more than two of their own shrimps on one board (rulebook p. 9). Both hold for introducing and moving.

## Exchanges

- **Consumed polyp for a larva cube (action 6).** The polyp goes into the bag, which is reshuffled, and a cube of its colour comes from the supply (rulebook p. 5). Following the designer's 2007 change, the cube must be played next, as action 2, 3 or 8; until then the player may only move shrimps. So the exchange is offered only when the cube could then be played: the supply has one, and either fewer than two cubes have been played this turn or a bonus polyp of its colour is available for action 8.
- **Larva cube for a polyp (action 8).** The cube returns to the supply and a polyp of its colour goes behind the screen, where everyone saw it arrive. It is taken from the bonus polyps, which are refilled from the bag, as the rulebook suggests (p. 6). Whether the exchange is possible therefore never depends on the hidden bag: it needs a bonus polyp of that colour.
- **Empty bonus spaces** (user ruling). When the bag has no polyp of a colour to replace a bonus polyp used for action 8 or extra growth, that colour's space stays empty, and neither is possible for that colour. The next polyp of that colour returned to the bag, by eating or action 6, fills the space instead, and any others go into the bag as usual; action 8 and extra growth are then possible for it again. The bonus polyps join the bag only when the bag runs out completely (rulebook p. 11), and from then on there are no bonus spaces to refill.
- Neither exchange counts as playing a larva cube, and each finishes the cube being played. Both may be done any number of times a turn.

## Alga cylinders

- **Buying one (action 7).** A consumed polyp of any colour buys a cylinder of any colour, which must be played at once (rulebook pp. 5 and 10). The consumed polyp goes into the bag, as in action 6 (the rulebook doesn't say; confirmed by the user), filling an empty bonus space first. A colour with no cylinder left in the supply cannot be chosen. Five cylinders of each colour.
- **On the open-sea space.** Any number a turn. A cylinder already there goes back to the supply. Every coral tile without a cylinder whose face shows that colour as its large alga flips over (rulebook p. 10).
- **On a coral tile (a lock).** Once a turn, and only once the player's parrotfish has eaten a shrimp and put it on the open-sea board. The cylinder must match the tile's large alga, and the tile must have no cylinder. The tile stays as it is for the rest of the game; every other uncovered tile with that large alga flips (rulebook p. 10).
- **The last uncovered tile** may be locked only by a player whose parrotfish holds at least two polyps, the one fed at setup included (rulebook p. 11; restated deliberately, designer).
- Like the exchanges, playing a cylinder finishes the larva cube being played, and must wait while a bought cube is still to be played.

## Eating

- **When (action 1).** Only before every other action of the turn, moving a shrimp included, and once a turn (rulebook pp. 4 and 11).
- **Which coral.** One of at least five polyps guarded by the player's own shrimp. Never a coral guarded by another player's shrimp, or an unguarded one (rulebook p. 11).
- **Where it goes.** Four polyps go back into the bag, which is reshuffled; the rest go into the parrotfish (rulebook p. 11). The first shrimp a player's parrotfish eats goes on the open-sea board; later ones go inside the parrotfish.
- **What others see.** The eaten coral was on the board, so with Concealed off its polyps, and the number of shrimps inside each parrotfish, are shown. With Concealed on they are hidden, as the printed rules forbid looking into another player's parrotfish. The shrimp on the open-sea board is always shown.

## End of the game

- **What ends it** (rulebook p. 11): every coral tile carrying an alga cylinder; a player's parrotfish having eaten all four of their shrimps, the one on the open-sea board included; no rock square left without a polyp; or the open sea not being refillable (see Turns).
- **At once.** The game ends the moment the condition is met: the player does nothing more that turn, not even action 10 (designer ruling, for the fourth shrimp; applied to every condition, since the rulebook says each ends the game immediately; confirmed by the user).
- **Final turns.** After the first two conditions, every other player, in turn order from the next, has one more turn in which they may only eat a coral or pass. Eating then returns five polyps to the bag instead of four, so a coral of five feeds the parrotfish nothing. Nothing more happens if a final turn eats a player's fourth shrimp.
- **What a final turn may eat.** The usual rules for eating hold: a coral of at least five polyps guarded by the player's own shrimp. The rulebook says only "consume one existing coral"; SpielByWeb says "shrimp-protected coral" (confirmed by the user). The last two conditions give no final turns.
- **No rock left** is read as every rock square of every board holding a polyp. It is checked after each polyp is placed, since nothing else fills a square. Attacks that might still be possible on a full board don't count (confirmed by the user).
- **Undo** cannot step back past the end of the game, which reveals everything hidden.

## Advanced game

An option, off by default (rulebook p. 12):

- **No extra growth.** Placing a polyp beside a starfish square never grows a bonus polyp. The bonus polyps are still used for action 8.
- **Eating returns one more polyp** to the bag: five instead of four, and six instead of five in the final turns.
- **A shrimp parked on bare rock when the game ends** stays there. Locking the last coral tile ends the turn at once, before the shrimp must move; it cannot affect the score, as bare rock holds no coral.
- **A coral of five may still be eaten**, though it feeds the parrotfish nothing; only the shrimp goes to the parrotfish (designer ruling, BGG thread 35388). The smallest edible coral stays five, in the final turns too.

## Scoring

- Each polyp in a player's parrotfish scores its colour's value: 1, plus 1 for every coral tile currently showing that colour as the stronger coral. The values always total 15 (rulebook p. 12).
- Ties are broken, in order, by consumed polyps in front of the screen, unplayed larva cubes, unplayed screen polyps, then polyps on the boards in corals protected by the player's shrimps. Players still level share the place (rulebook p. 12).

## Hidden information

- The polyps dealt at setup and the polyp fed to the parrotfish at setup are hidden from the other players until the game ends, since nobody could track them at the table.
- With the **Concealed** option off (the default), anything a careful player could track is shown: larva cubes, shrimps behind the screen, polyps whose colours were seen when taken from the open sea, and how many of the secret setup polyps each player still holds (everyone saw how many were dealt, and the known polyps are always played first).
- With **Concealed** on, the game hides what the printed rules hide: everything behind the screens. It hides them from the player panels only: the history still tells everything that happened in the open, and history playback and Replay stay available while the game runs. Players could work out a hidden screen or parrotfish from them, as an attentive player could at the table; they are trusted to play in the spirit of the game (user decision, 2026-10-10).
- The order of the polyps in the bag is never shown; how many remain is public.
- **When the game ends, everything is revealed to everyone**: every screen, every parrotfish including its setup polyp, and every shrimp count. The bag's order stays hidden, since it no longer affects anything.
- **Undo after a bonus polyp is replaced.** Trading a larva cube for a polyp, or extra growth, replaces the bonus polyp from the bag, and an empty bonus space shows the bag held none of that colour. Undo is not blocked there, so a player could learn that and take the move back. It tells no more than refilling the bonus space at the table would, so it is accepted rather than blocking Undo after every trade and extra growth.

## Exploring

- **From what a player can see.** An exploration started from a player's or spectator's view deals every polyp they haven't seen at random: into the other players' secret screen polyps, as many as each still holds; one into each parrotfish already fed; and the rest into the bag. Everything the viewer could see stays as it was.
- **What the deal ignores.** Earlier draws can hint where some polyps are; for example, a bonus space left empty meant the bag then held none of that colour. The deal doesn't use such hints, since any deal can be played on.
- **Concealed games** can't be explored from a player's view until the game ends, as the hidden screens can't be rebuilt. At the end everything but the bag's order is shown, so only the bag is dealt.
