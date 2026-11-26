# PÜNCT scenarios

The dev harness lists these under **Scenarios**. Each starts with White to move in the standard game; loading one again starts it over. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/punct`.

- **Opening.** Three pieces each, all on the board: place a piece, or move one along its PÜNCT's lines.
- **Layers.** A seeded game played on with many climbs: pieces two and three levels up, frozen pieces under them, for judging how the levels read.
- **Same colour stacks.** Three-high towers of each colour (C2–C4 white, H3–H5 black) and a triangle on two straight pieces of each colour (K4/L4 white, N7/O7 black), for judging how the levels part where colours match.
- **Turning past towers.** Three-high white towers either side of D6. Place a straight piece at D6 pointing up the board and tap it: turning it clockwise to point up and right would sweep over one tower, the long way round over the other, so it lifts clear, turns and settles back into its hover.
- **One from a connection.** White's chain runs along the row from A to Q, over a white bridge at G8–I8 (resting on a white and a black piece) and a two-high white stack beside it, with D8–F8 open. Place a straight piece on D8–F8, turned to lie along the row: the game ends on the connection and a cyan line draws on along the chain from column A to Q, climbing over the bridge and the stack.
- **Last piece.** A seeded game played on until White has one piece left, ahead on the central spaces. Place it anywhere: the game ends on the centre count, White winning, and a cyan dot pops up in each of White's top dots on the central spaces.
