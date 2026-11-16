# PÜNCT scenarios

The dev harness lists these under **Scenarios**. Each starts with White to move in the standard game; loading one again starts it over. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/punct`.

- **Opening.** Three pieces each, all on the board: place a piece, or move one along its PÜNCT's lines.
- **Layers.** A seeded game played on with many climbs: pieces two and three levels up, frozen pieces under them, for judging how the levels read.
- **Same colour stacks.** Three-high towers of each colour (C2–C4 white, H3–H5 black) and a triangle on two straight pieces of each colour (K4/L4 white, N7/O7 black), for judging how the levels part where colours match.
- **Turning past towers.** Three-high white towers either side of D6. Place a straight piece at D6 pointing up the board and tap it: turning it clockwise to point up and right would sweep over one tower, the long way round over the other, so it lifts clear, turns and settles back into its hover.
