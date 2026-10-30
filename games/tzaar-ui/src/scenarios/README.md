# TZAAR scenarios

The dev harness lists these under **Scenarios**. Alice (White) makes the first capture of her turn in each; loading one again starts it over. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/tzaar`; `src/lib/model/scenarioFiles.spec.ts` plays each claim below through the engine.

- **Midgame.** A board reached by seeded play from a random start, with stacks of several heights. Tap a white-topped stack to see what it can capture, tap a dashed rim to capture it, then capture again, stack onto your own, or Pass.
- **Two Tzaars left.** Bob has two Tzaars on top, D2 and F2, and a third buried under a Tott on G3, which does not count. Capture D1 onto D2: the game goes on. Then capture F1 onto F2 with the second move: Bob has no Tzaar left on top, and Alice wins at once.
- **Bob cannot capture.** Bob has only single pieces, and Alice only stacks but for the Tott on C3. Capture C3 onto C4, then stack C4 onto A2: Bob cannot capture anything, and Alice wins. Pass instead, and Bob can take C4 from B4 or G6.
- **No second move.** Capture A1 onto A2: Alice is left with one of each type and nothing to capture, so the turn passes to Bob without a second move, and the history says so.
- **Covering a type.** Capture A3 onto A5. Alice now has one Tzaar (A1) and one Tzarra (A5) on top, and no stack may cover either: the only stacks offered are A1 onto A2 or B1, and A5 onto A2.
- **Tall stacks.** Stacks past 5 pieces stand no taller; the pieces between their bottom and top pieces thin out instead. Capture F1 onto F2, then stack D2 onto the 9-stack on D3: it becomes 11, still 5 pieces tall with thinner bands, beside Bob's 11-stack on C4.
- **Placement ends.** The tournament version with two spaces left. Alice places one piece, Bob the last, and Alice then makes the opening capture.
- **Crowded stacks.** Stacks of two to four on neighbouring spaces in both colours, to judge how stacks and their counts read where they crowd each other.
- **Stacks by the labels.** Stacks of two to nine on the top space of each column, where they rise over the column's coordinate label.
- **Behind stacks.** Stacks of two to nine (A1 2, C2 3, E2 4, G2 5, I1 6, A4 7, C5 8, E6 9), each with a single piece of the other colour straight behind it up its column, and single pieces behind it to either side, to judge how much of a piece a stack in front hides.
