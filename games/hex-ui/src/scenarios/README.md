# Hex scenarios

The dev harness lists these under **Scenarios**. Alice plays Red and Bob Blue, on the 11 board; loading one again starts it over. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/hex`.

- **Swap or place.** Alice has filled F6 with red and it is Bob's turn, with the swap rule on. Tap **Swap**: Bob now plays Red, F6 stays red, and Alice, now Blue, places next. Undo takes the swap back and the prompt offers it again. Filling a cell instead closes the swap for good.
- **Red one from a win.** Alice's red chain runs from the top edge to the bottom but for D6. Fill D6: the red flows in from D5 and C7 at once, the game ends, Alice wins and her chain is marked. Filling anywhere else hands the turn to Bob.
- **Blue one from a win.** Bob's blue row 6 runs from the left edge to J6. Fill K6: the blue flows in from J6 and from the right edge at once, and Bob wins.
- **Middle game.** Fifty cells, twenty-five of each colour, filled at random with neither colour joined up: for trying every way a fill grows (from nothing, from one neighbour, from several, from an edge) and judging the board half full.
