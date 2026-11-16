# LYNGK scenarios

The dev harness lists these under **Scenarios**. Alice moves first in each; loading one again starts it over. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/lyngk`.

- **Lyngk chain.** Bob has claimed red and scored one stack. Black is still neutral: a black single on E7, black-topped stacks on E5 and G4, and a blue-ivory-red-green stack on G2. Claim black from the strip and choose E7: G2 is offered as a landing, with cyan spots on E5 and G4 as the LYNGK-points that reach it. Land on G2: the stack of 5 has black on top, so it is removed and Alice scores, evening the game at one each. Before the claim, E7 cannot reach G2.
- **Claim to move.** Bob has claimed black and blue. Alice's green on E4 and ivory on E1 have no neutral move, so the banner says she can only move by claiming, and only ivory and green are offered. Claim green and move E4 onto E3 (blue-red-black), which only a claimed color may climb.
- **Pass and end.** Alice has red and green, Bob black and blue; ivory is neutral. Move E7 onto E6: Bob has no move and passes, so it is Alice's turn again. Move E6 onto E2: nobody can move, the game ends, and Alice wins on stacks of 3 (one to none) since neither scored a stack of 5.
- **Stack of six.** The Stack of 6 variant. Alice has red and ivory. Move the red on E4 onto the joker-blue-ivory-green-black stack on E3: with the joker as white it makes a stack of 6 with red on top, and Alice wins at once.
