# DVONN scenarios

The dev harness lists these under **Scenarios**. Alice (White) moves first in each; loading one again starts it over. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/dvonn`.

- **Midgame.** A board reached by seeded random play from a random placement: stacks from one piece to ten, two DVONN pieces inside stacks. Tap a white-topped stack to see where it can land, and tap a dashed rim to move there.
- **Cut off.** C2 is the only link between the four stacks on A1, A2, B1 and B2 and the DVONN pieces. Move C2 onto D2 or D3: those four stacks (five pieces, both colors) lift away, and the history says 5 pieces in 4 stacks were cut off and removed.
- **Bob passes.** Bob's only stack, three high on F3, has nowhere to land. Move D3 onto the DVONN piece on E3: Bob cannot move, so it stays Alice's turn and the banner says Bob cannot move; move again. Move B1 onto A1 and Bob passes again.
- **Last move.** Alice's two-stack on D3 can only land on Bob's two-stack on F3. After that neither player can move, so the game ends: Alice wins, stack height 4 to 0.
- **Stacking begins.** One space, K3, is left in the placing phase. Alice places her last piece there and, having placed the first DVONN piece, makes the first move straight away.
- **Behind tall stacks.** The two spaces in the row behind a stack are the ones its height hides most. Behind the 12-stack on F2 stand a single black piece (F3) and a two-stack topped white (G3); behind the 9-stack on C2 stand a DVONN piece (C3) and a three-stack topped black (D3). Each piece behind should still show its color, its hole, and its count. Tap G2 and move it onto G3: the count on G3 changes to 3 and stays readable.
- **Nearly all pieces.** Alice controls 44 pieces in five stacks and a single, the three DVONN pieces among them; Bob has one piece left. Her player card tallies them as six stacks of up to eight: her 19 white pieces, then the three red, then Bob's 22 black; Bob's card shows one black piece.
