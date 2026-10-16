# ZÈRTZ scenarios

The dev harness lists these under **Scenarios**. Each is a standard game with Player 1 to move; loading one again starts it over. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/zertz`.

- **One capture from winning.** Player 1 has captured 3 white, 3 grey and 2 black, so the white and grey "3 of each" outlines in their tray are lit and the black one is not. White on D4 and black on E3 force a capture. Jump the white over the black to F2: the game ends, won with three marbles of each colour. Undo, then jump the black over the white to C4 instead: the game ends, won with four white marbles.
- **Capture chain.** White on D4, grey on E3, black on F3. Choose the white and jump the grey to F2: the white is now the only marble that may move, and must jump again over the black to F4. The turn then passes to Player 2 with a grey and a black captured. Grey can also start a capture, so Player 1 first chooses which marble jumps.
- **Claim by ring removal.** White on A1 and grey on B1 sit in the bottom-left corner. With A2, B3, C1 and C2 gone, their only link to the board is the vacant ring B2, which is free. Place any marble elsewhere, then remove B2: the corner pair is cut off with no vacant ring, so Player 1 claims the white and the grey, and the history reads "and claimed ⚪ A1 🔘 B1".
