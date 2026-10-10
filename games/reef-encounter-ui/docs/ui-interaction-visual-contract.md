# Reef Encounter: UI interaction visual contract

How the action panel and the table share the acting player's choices. Follow `docs/ui-interaction-visual-contract.md` (repository root) when changing it.

## Visual intents

- **Placing polyps.** Trigger: the player has played a larva cube and has a polyp of its colour to place. Every square that can take one is ringed in white; a square holding a weaker polyp that the new one would attack is ringed in dashed orange instead. A weaker polyp the colour could attack but for a shrimp protecting it gets a dotted pale-blue outline, which takes no clicks. Clicking, tapping, or Enter or Space on a focused ring places the polyp. The panel names the colour, how many more may come from behind the screen, and, when consumed polyps could be used too, a choice between the two sources.
- **Taking an open-sea space.** Trigger: the player may end their turn. Every larva space they may take is ringed in white on the open sea; choosing one ends the turn. The panel says so.
- **Picking up a shrimp.** Trigger: the player may move a shrimp and no shrimp choice is open. Each of their shrimps on the reefs gets a dashed white ring; choosing one opens _Moving a shrimp_.
- **Introducing a shrimp.** Trigger: the panel's Introduce button. Every polyp the new shrimp may go on is ringed in white, and the panel asks for one.
- **Moving a shrimp.** Trigger: picking up a shrimp. Its square gets a solid orange ring, every polyp or bare rock it may move to is ringed in white, and the panel offers _Back behind your screen_.
- **Buying an alga cylinder.** Trigger: the panel's row of consumed polyps to pay with. Choosing one asks for the cylinder's colour (each with how many remain); choosing a colour rings the open sea's cylinder circle and every coral tile the cylinder may lock, and the panel explains both. Undo steps back one choice at a time.
- **Trades.** Larva cubes for polyps and consumed polyps for larva cubes are single buttons in the panel, each showing what is given and what is received. After buying a cube the panel says it must be played next.
- **Eating a coral.** Trigger: the panel's Eat a coral button, offered only before any other action of the turn, and in a final turn beside Pass. Every square of each coral the player's parrotfish may eat is ringed in red; choosing any of them eats that coral. The panel says how many of its polyps go back into the bag.
- **Final turn.** Trigger: the game's final turns. The panel offers only Eat a coral (when a coral is edible) and Pass.
- **Final turns announced.** Before: when locking a tile would lock the last one, or eating would feed the player's fourth shrimp, the prompt warns that it ends the game and gives every other player one final turn. During: every viewer's action area opens with a status banner naming who ended it and how, and whose turn is the game's last. After: the history adds "That ends the game" to the move that started them, and a Final turns divider heads the turns that follow.
- **Bare rock warning.** Trigger: one of the player's shrimps sits on bare rock. The panel names the square of each one and says to pick it up and move it onto a polyp or put it back behind the screen before the turn can end; no open-sea space is offered, since the rules forbid ending the turn.
- **Setup choices.** Feeding the parrotfish and taking larva cubes happen in the panel alone; the chosen first cube is outlined in orange until the second is chosen.

Coral tiles, larva cubes and cylinders on the open sea always stand upright, whatever the board's turn, so a coral tile reads as printed: stronger coral across the top, algae at the lower left.

## Coexistence and precedence

- A shrimp choice (_Introducing_ or _Moving a shrimp_) wins over everything else on the table: while one is open, no placement rings, open-sea rings or shrimp pick-up rings show, and the panel shows only the shrimp prompt.
- _Placing polyps_, _Taking an open-sea space_ and _Picking up a shrimp_ coexist; each rings different things (reef squares, larva spaces, the player's own shrimps).
- A square never shows both a placement ring and a shrimp pick-up ring: a polyp is never placed under a shrimp.
- The _Bare rock warning_ and _Taking an open-sea space_ never coexist: the rules make no space takeable while a shrimp is on bare rock.

## Shared visual state

- **Shrimp choice** (`shrimp` stage of the staged selection). Producer: the panel's Introduce button and the board's pick-up rings. Consumers: the board's rings and the panel's prompt. It decides precedence. Lifetime: cleared when a shrimp action commits, by Undo (one press closes it without undoing any game action), and whenever a new state is published. Validity: it only exists while the player may act.
- **Cylinder payment and colour** (`cylinderPayment` and `cylinderAlga` stages). Producer: the panel. Consumers: the panel's prompt and the open sea's rings, which also decide precedence. Lifetime: cleared when the cylinder is played, by Undo (one stage per press), and on every new state.
- **Choosing a coral to eat** (`eating` stage). Producer: the panel. Consumers: the board's red rings and the panel's prompt; it decides precedence. Lifetime: cleared when the coral is eaten, by Undo, and on every new state.
- **First larva cube** (`firstLarvaCube` stage). Producer and consumer: the setup panel. Lifetime: cleared by the second choice's commit, by Undo, and on every new state.
- **Polyp source** (`polypSource` stage: screen or consumed). Producer and consumer: the turn panel; the board's rings follow it. Until one is chosen, the first source with a polyp to place applies. Lifetime: cleared by Undo (one press returns to that default) and on every new state.

None of these exist in History View or for players who are not acting: every ring and choice derives from the session's `canAct`, which is false there.

## Render ownership

- Each reef board draws its own rings inside the same turned drawing as its art, so a ring's hit area always covers the square it rings, whatever the board's rotation. The open sea does the same for larva spaces.
- Each piece's outer group places it (`translate` to its centre) and is the node GSAP animates; its drawing is centred on that group's origin, so scaling and flipping turn about the piece's centre.
- Upright pieces on the turned open sea are counter-turned about their own centres; their positions still turn with the board.

## Motion

- **Pieces** (`animators/piecesAnimator.ts`, owned by the session's state-change animation). Every state change compares the table's pieces before and after (`utils/tablePieces.ts`): a new piece drops in, a removed one sinks away, an attacking polyp lands once the polyp it replaces has gone, a shrimp moved along its reef slides there, and the open sea's polyps shuffle along their larva space as it fills. Coral tiles a cylinder flips turn over once it has landed. A shrimp that changes drawing (eaten onto the open sea, or moved to another reef) lifts off one and lands on the other. The viewer's own live actions play briskly with no hold; other players' actions and full-action replays hold for readability; undo and history steps finish within 200ms.
- While a change plays out the session refuses every choice, staged or committed. To show it, the board's rings and the action panel's buttons take no pointer clicks until the table settles.
- **Blinking** (local presentation). Each shrimp on the table blinks six to eight times a minute, in a rhythm and phase picked from the piece, so shrimps never blink together for long. Shrimps in the panels do not blink, and none blink under reduced motion.

## Verification scenarios

Automated, in `tests/`:

- `setup.spec.ts`: every player feeds their parrotfish and takes two cubes; Undo takes back the first cube without undoing the feeding.
- `turns.spec.ts`: playing a cube rings placements; placing one lowers the count from behind the screen and Undo restores it; taking a space ends the turn.
- `cylinders.spec.ts`: after an attack yields a consumed polyp, paying and choosing a colour ring the cylinder circle and hide the larva-space rings; Undo steps back through both choices; playing it ends the choice.
- `turns.spec.ts` also trades a larva cube for a polyp and undoes it.
- `eating.spec.ts`: after growing a coral of five under the player's shrimp, Eat a coral rings it and hides the larva-space rings; Undo closes the choice; eating feeds the parrotfish and puts the shrimp on the open sea.
- `accessibility.spec.ts`: the boards and open sea are labelled groups whose pieces, coral tiles (by which coral beats which) and rings carry names; the panel's cube icons are named.
- `history.spec.ts`: a history entry's header shows the table as its player left it, in History View, where the action panel tells the step that led there; Replay plays a turn's moves and returns to the live game, and setup entries, which move no pieces, offer no Replay.
- `shrimps.spec.ts`: Introduce hides the open-sea rings and rings polyps; a pick-up closes on Undo without undoing anything; a shrimp left on bare rock shows the warning and no space; sending it behind the screen restores the spaces.

`src/lib/utils/tablePieces.spec.ts` covers how changes are read: slides, lifts and lands, attacks, tile flips.

Manual (the end conditions take a long game to reach, so these were checked by hand on 2026-10-10 and need rechecking when their code changes):

- the final-turn panel, reached by temporarily ending the game after one eaten shrimp in the built logic: it offers Pass alone when no coral is edible, and passing ends the game on the score table;
- attack rings: dashed orange with a light orange wash over the weaker polyp;
- coral tiles turning over when a cylinder lands on the open sea;
- the motion itself, including replay and undo;
- locking a coral tile, after eating onto the open sea and buying a cylinder with a consumed polyp: the cylinder space and lockable tiles are ringed, the cylinder stands on the locked tile, and the other unlocked tile with the same large alga turns over.
