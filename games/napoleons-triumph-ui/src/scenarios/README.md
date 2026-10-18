# Napoleon's Triumph scenarios

The dev harness lists these under **Scenarios**. Each opens on the French command phase with only the pieces of the scenario on the map; loading one again starts it over. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/napoleons-triumph`.

## Artillery firing together

A threat names only the approach, so batteries are paired when the attack is declared, not before: threaten with one battery, or aim at the locale, and name the other in the declaration.

- **Artillery pair, detached, wide approach.** Two detached batteries block the wide approach from 93 into 94. Picking them up chooses one at a time: tapping the second switches to it. Threaten with either; once the Allies stand and the attack is pressed, name the other battery too. Both are marked as leading at once, under a Unit Move each, and the attack width stays Wide. Tapping either takes it out again, leaving the other to fire alone.
- **Artillery pair in a corps with another unit, wide approach.** St. Hilaire's two batteries and an infantry unit block the same approach. In the declaration, name the two batteries: they fire together by a Detach Move (both may lead, across a wide approach) or by a Unit Move each (both lead).
- **Artillery pair alone in a corps, wide approach.** The corps has only the two batteries. Neither a Detach Move of both nor a Unit Move each may leave St. Hilaire without a unit, so they cannot fire together: one battery fires by a Unit Move, or the corps attacks by a Corps Move, which artillery cannot lead.
- **Artillery pair, detached, narrow approach.** Two detached batteries block the narrow approach from 72 into 74. Only one unit may lead across a narrow approach, so they never fire together: name both in the declaration and no command is offered, with a line saying so; either battery fires on its own.

## The same approach more than once

- **Bombardment, then an assault across the same approach.** Two detached batteries block 72 into 74, with Vandamme's corps behind them in reserve. Fire one battery: afterwards the second battery may still threaten but cannot be named to lead (no approach is bombarded twice in a turn), while Vandamme may still attack across the same approach.
- **Guns that fired across this approach last round.** Round 2; the battery on 72 into 74 led an attack there last round. It may threaten but not lead across that approach this round; Vandamme may still attack.
- **Guns that fired last round, down from a hill.** The same, from the hill locale 25 into 38: firing down from a hill lifts the bar, so the battery may lead again.
- **Guns resting on a crowded front.** Round 3, French command phase, around locale 83. French batteries fired last round from 83 into 74 and 94 and this turn into 72; Allied batteries fired last round from 74 and 72 into 83. Each approach carries a tag on its bar with the hour its army's guns may lead from it again, in that army's colour, the two armies' tags side by side where both fired across one border.
- **A second attack after a repulse or a feint.** St. Hilaire and Vandamme in 93, Legrand in 83, and Prebyshevsky blocking the approach from 93 into 94. Attack with St. Hilaire and name no leading unit: the blockers win the tie, the attack is repulsed after the Allies decline to counter-attack, and the approach from 93 closes for the turn, so Vandamme has no arrow there. Legrand's approach from 83 stays open. A feint by St. Hilaire closes it the same way.
