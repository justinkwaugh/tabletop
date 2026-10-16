# Reef Encounter: rulings

How this implementation reads the second-edition rules (Z-Man, 2004), with the designer's later changes. Each entry gives its source. The board layout is in [board-map.md](board-map.md).

## Components

- **Coral tiles.** Ten tiles, each pairing two corals and two algae. The starfish side of each is recorded in `src/components/coralTiles.ts`; the reverse swaps both the corals and the algae (rulebook p. 10). Confirmed against photographs of both sides of every tile.
- **Polyps.** 40 of each of the five coral colours (rulebook p. 2).
- **Larva cubes.** 10 of each coral colour (rulebook p. 2).
- **Player colours.** The four printed shrimp colours: purple, green, red and yellow.

## Setup

In the rulebook's order (pp. 3–4):

1. One reef board per player, chosen at random. Each starts with one polyp of each colour on its marked squares, taken from the general supply rather than the bag.
2. One bonus polyp of each colour waits beside the open-sea board for extra growth. Every other polyp goes into the bag.
3. One coral tile is flipped, and all ten tiles show the side it landed on.
4. Each open-sea space gets a larva cube of its colour.
5. A polyp drawn from the bag names the first open-sea space and goes back into the bag, which is then reshuffled. The spaces then receive 3, 3, 3, 2 and 1 polyps clockwise from it. Clockwise is the direction of the arrows on the second-edition board: white, yellow, orange, pink, grey.
6. The start player is chosen at random. In turn order from them, players are dealt 6, then 9 (two players); 6, 7, 9 (three); or 6, 7, 8, 9 (four) polyps into their supplies.
7. In turn order, each player secretly feeds one of their polyps to their parrotfish. Nobody else ever learns its colour before the game ends.
8. In turn order, each player takes two larva cubes from the general supply and shows them. Two of the same colour are allowed.

## Turns

- **Action 10 ends every turn** (rulebook pp. 4–5): the player takes one larva cube from the open sea with every polyp on its space. Those polyps' colours were seen by everyone, so they count as known polyps in their supply.
- **Refill.** The taken cube is replaced by one of the same colour from the general supply, then every space holding fewer than three polyps gains one from the bag (rulebook p. 5). The polyps come from a shuffled bag, so the refill is a reveal and Undo cannot step back past it.
- **The bag running dry.** When the bag holds fewer polyps than the refill needs, the bonus polyps go into it and it is reshuffled (rulebook p. 11), since they were part of its population all along (user ruling).
- **Shortage ends the game at once** (rulebook p. 11, end condition 4): if the general supply has no cube of the taken colour, or the bag, with the bonus polyps, cannot supply the refill, the game ends with no extra turns. The open sea is left as it stood.
- The game is one continuous round, with turns passing clockwise (rulebook p. 5).

## Growing corals

- **Larva cubes (actions 2 and 3).** A player may play up to two larva cubes a turn, of any colours, the same colour twice included. Each cube goes back to the general supply. Polyps of its colour may then follow: up to four from their own supply, plus any number of consumed polyps (rulebook p. 5). Once the second cube is played, no more polyps of the first cube's colour may be placed (rulebook p. 7).
- **Which supply polyps are played.** Polyps whose colour everyone saw arrive, from the open sea, are played before the secret ones dealt at setup, so opponents learn only what they could have tracked.
- **Where a polyp may go.** On rock, not sand; never on a square with a shrimp; and never where it would join two corals of its colour that each carry a shrimp (rulebook p. 6). Polyps placed for one cube need not form one coral, and may go on different boards (designer ruling).
- **Attacks.** A polyp may replace a polyp of a weaker colour, as the coral tiles currently show, when it joins a coral of its own colour that already has at least two polyps, and no shrimp protects the target (rulebook pp. 7 and 9). The replaced polyp becomes a consumed polyp of the attacking player. A coral split by an attack lives on as separate corals.
- **Which coral attacks.** Any coral may attack unless it is a single polyp: the attacking coral must already hold at least two orthogonally connected polyps (rulebook p. 7, "adding a third or additional polyp"; confirmed by the user). Two single polyps that the new polyp would join do not qualify.
- **Shrimp protection.** A shrimp protects the polyp under it and the polyps of the same coral orthogonally next to it, never another coral's polyps (rulebook p. 9).
- **Extra growth.** Whenever a polyp is placed orthogonally next to the board's empty starfish square, a bonus polyp of its colour grows there at once, without counting towards the cube's four. It does not grow if a shrimp is on the square, if it would join two guarded corals, or if no polyp of that colour can be had (rulebook p. 7). The polyp is the colour's bonus polyp when its space holds one; otherwise the bag is searched for one (see [the bag and the bonus polyps](#the-bag-and-the-bonus-polyps)).

## Shrimps

- **Introducing (action 4).** Once a turn, a player may put a shrimp from their supply onto any polyp of a coral that has no shrimp. A new shrimp never goes onto bare rock (rulebook p. 5).
- **Order of actions.** Every action except moving shrimps must be finished before another starts (rulebook p. 4). Introducing a shrimp therefore ends the larva cube being played: no more polyps of its colour may follow, though a second cube may still be played (confirmed by the user).
- **Moving (action 5).** Any number of times a turn, and in the middle of placing polyps, a player may move one of their own shrimps to another polyp of the same coral, to a polyp of another coral, to bare rock, or back to their supply (rulebook p. 5). A shrimp left on bare rock must move on before the turn ends, so the turn cannot end while one is there (rulebook p. 5).
- **Limits.** Two shrimps are never on the same coral, and a player never has more than two of their own shrimps on one board (rulebook p. 9). Both hold for introducing and moving.

## Exchanges

- **Consumed polyp for a larva cube (action 6).** The polyp goes into the bag, which is reshuffled, and a cube of its colour comes from the general supply (rulebook p. 5). Following the designer's 2007 change, the cube must be played next, as action 2, 3 or 8; until then the player may only move shrimps. It needs only a cube of that colour in the supply: the cube can always be played next, because the polyp paid for it is returned where action 8 can take it back.
- **Larva cube for a polyp (action 8).** The cube returns to the general supply and a polyp of its colour goes into the player's supply, where everyone saw it arrive. The polyp comes from the bag, or from the colour's bonus space when that holds one (rulebook p. 6; see [the bag and the bonus polyps](#the-bag-and-the-bonus-polyps)).
- Neither exchange counts as playing a larva cube, and each finishes the cube being played. Both may be done any number of times a turn.

## The bag and the bonus polyps

User ruling: the bonus polyps are part of the bag's population, set aside only to save time when action 8 or extra growth needs a polyp of one colour.

- **Taking a polyp of one colour.** Action 8 and extra growth take the colour's bonus polyp when its space holds one. An emptied space is not refilled from the bag straight away.
- **Searching the bag.** When the space is empty, the bag is searched for a polyp of that colour. Nobody can see into the bag, so the search is a reveal, and Undo cannot step back past it. Action 8 is offered whenever the bag may hold that colour; a search that finds none leaves the turn as if the player had not tried, and extra growth then grows nothing.
- **A colour known to be missing.** After a search finds none, neither action 8 nor extra growth searches for that colour again until a polyp of it goes back into the bag.
- **Returned polyps.** A polyp returned by eating, action 6 or action 7 fills an empty bonus space of its colour first; any others go into the bag. Once the bonus polyps have joined the bag (see the refill above), every returned polyp goes into the bag.

## Alga cylinders

- **Buying one (action 7).** A consumed polyp of any colour buys a cylinder of any colour, which must be played at once (rulebook pp. 5 and 10). The consumed polyp goes into the bag, as in action 6 (the rulebook doesn't say; confirmed by the user), filling an empty bonus space first. A colour with no cylinder left in the supply cannot be chosen. Five cylinders of each colour.
- **On the open-sea space.** Any number a turn. A cylinder already there goes back to the general supply. Every coral tile without a cylinder whose face shows that colour as its large alga flips over (rulebook p. 10).
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
- **Passing a final turn that cannot score** (our ruling, asked for by the user). A player whose shrimps guard no coral larger than the polyps eating returns (five, or six in the Advanced game) passes without being asked, by a system Pass. Such a coral could only feed the parrotfish nothing.
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
- Ties are broken, in order, by consumed polyps, unplayed larva cubes, unplayed supply polyps, then polyps on the boards in corals protected by the player's shrimps. Players still level share the place (rulebook p. 12).

## Hidden information

- The polyps dealt at setup and the polyp fed to the parrotfish at setup are hidden from the other players until the game ends, since nobody could track them at the table.
- With the **Concealed** option off (the default), anything a careful player could track is shown: larva cubes, shrimps in each supply, polyps whose colours were seen when taken from the open sea, and how many of the secret setup polyps each player still holds (everyone saw how many were dealt, and the known polyps are always played first).
- With **Concealed** on, the game hides every player's supply, as the printed rules do. It hides them from the player panels only: the history still tells everything that happened in the open, and history playback and Replay stay available while the game runs. Players could work out a hidden supply or parrotfish from them, as an attentive player could at the table; they are trusted to play in the spirit of the game (user decision, 2026-10-10).
- The order of the polyps in the bag is never shown; how many remain is public.
- **When the game ends, everything is revealed to everyone**: every supply, every parrotfish including its setup polyp, and every shrimp count. The end of the game records each setup parrotfish polyp, so the history shows them too. The bag's order stays hidden, since it no longer affects anything.
- **Searching the bag is a reveal.** Undo stops at a search for a polyp of one colour (see [the bag and the bonus polyps](#the-bag-and-the-bonus-polyps)), as at the open-sea refill and the end of the game. Taking a bonus polyp from its space reveals nothing, so Undo stays available.

## Exploring

- **From what a player can see.** An exploration started from a player's or spectator's view deals every polyp they haven't seen at random: into the other players' secret supply polyps, as many as each still holds; one into each parrotfish already fed; and the rest into the bag. Everything the viewer could see stays as it was.
- **Colours missing from the bag.** A colour a search of the bag failed to find is dealt only to the supplies and parrotfish, never into the bag, until a polyp of it is returned. Other hints earlier draws give about where polyps are aren't used, since any deal can be played on.
- **Concealed games** can't be explored from a player's view until the game ends, as the hidden supplies can't be rebuilt. At the end everything but the bag's order is shown, so only the bag is dealt.
