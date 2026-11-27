# The Game of Y scenarios

The dev harness lists these under **Scenarios**. Alice plays Black and Bob White; loading one again starts it over. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/game-of-y`.

- **Swap or place.** Alice has placed her first stone on E5 and it is Bob's turn, with the swap rule on. Tap **Swap**: Bob now plays Black, the stone on E5 stays black, and Alice, now White, places next. Undo takes the swap back and the prompt offers it again. Placing a white stone instead closes the swap for good.
- **One from a Y.** Alice's black chain runs from the left side to the right with a branch down that stops one point short of the bottom. Place on B1 or C1: the stone drops in, the game ends, Alice wins and her chain is ringed. Placing anywhere else hands the turn to Bob.
- **Crowded board.** Sixty stones, thirty of each colour, scattered at random with neither colour joined up: for judging how stones look packed together and how the near ones cover the far ones.
- **Cover position.** A finished game from a top-down photo of a Kadon board, one stone short: Alice, Black, places F1 to join her chain to all three sides and win. The cover image is this board after F1, tilted, with rings and coordinates hidden.
