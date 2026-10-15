# Reef Encounter: UI interaction visual contract

How the action panel and the table share the acting player's choices. Follow `docs/ui-interaction-visual-contract.md` (repository root) when changing it.

## Visual intents

- **Placing polyps.** Trigger: the player has played a larva cube and has a polyp of its colour to place. Every square that can take one is ringed in white; a square holding a weaker polyp that the new one would attack is ringed in dashed orange instead. A weaker polyp the colour could attack but for a shrimp protecting it gets a dotted pale-blue outline, which takes no clicks. Clicking, tapping, or Enter or Space on a focused ring places the polyp. The panel names the colour and how many more may come from the supply, and how many consumed ones may follow.
- **Choosing the polyp's source.** Trigger: choosing a square while polyps of the colour are both in the supply and consumed. The square gets a solid orange ring, every other ring goes, and a popup beside the square offers _From your supply_ or _Consumed_; choosing one places the polyp. The panel asks which polyp goes there. With only one source the square places the polyp at once.
- **Taking an open-sea space.** Trigger: the player may end their turn. Every larva space they may take is ringed in white on the open sea; choosing one ends the turn.
- **Picking up a shrimp.** Trigger: the player may move a shrimp and no choice is open. Each of their shrimps on the reefs gets a dashed white ring; choosing one opens _Moving a shrimp_.
- **Action tiles.** Trigger: no choice is open. The panel offers one tile per action from the player aid, numbered as there; an action the player may take with several colours shows its number and verb once, then a button for each colour. A shared result (6's cube, 8's polyp) appears once after those buttons, as an outline until a button is under the pointer or focused, when it takes that colour; with one colour the tile shows it outright. Moving a shrimp and taking an open-sea space are done on the table alone, so a line under the tiles says so whenever either is possible.
- **Introducing a shrimp.** Trigger: the panel's Introduce tile. Every polyp the new shrimp may go on is ringed in white, and the panel asks for one.
- **Moving a shrimp.** Trigger: picking up a shrimp. Its square gets a solid orange ring, every polyp or bare rock it may move to is ringed in white, and a popup beside the shrimp offers _Back to your supply_. Choosing the shrimp again puts it down where it was, as Undo does.
- **Buying an alga cylinder.** Trigger: the panel's Acquire tile, with a button per consumed colour. Choosing one asks for the cylinder's colour (each with how many remain); choosing a colour rings the open sea's cylinder circle and every coral tile the cylinder may lock, and the panel explains both.
- **Trades.** The Exchange tiles trade a consumed polyp for a larva cube (6) or a larva cube for a polyp (8). After buying a cube the panel says it must be played next. A trade whose bonus space is empty searches the bag, which is a reveal: the history says what the bag held, and Undo cannot step back past it.
- **Eating a coral.** Trigger: the panel's Eat tile, offered only before any other action of the turn, and in a final turn beside Pass. Every square of each coral the player's parrotfish may eat is ringed in red; choosing any of them eats that coral. The panel says how many of its polyps go back into the bag.
- **Final turn.** Trigger: the game's final turns. The panel offers only Eat a coral (when a coral is edible) and Pass.
- **Final turns announced.** Before: when locking a tile would lock the last one, or eating would feed the player's fourth shrimp, the prompt warns that it ends the game and gives every other player one final turn. During: every viewer's action area opens with a status banner naming who ended it and how, and whose turn is the game's last. After: the history adds "That ends the game" to the move that started them, and a Final turns divider heads the turns that follow.
- **Bare rock warning.** Trigger: one of the player's shrimps sits on bare rock. The panel names the square of each one and says to pick it up and move it onto a polyp or put it back in their supply before the turn can end; no open-sea space is offered, since the rules forbid ending the turn.
- **Setup choices.** Feeding the parrotfish and taking larva cubes happen in the panel alone; the chosen first cube is outlined in orange until the second is chosen.
- **Player aid.** Trigger: the round ? button at the right of the turn header. The English reference card from the game opens over the board, which takes no input while it is open; Escape, a click outside the card or the button again closes it, and focus returns to the button.
- **History lines.** Each move reads as a full sentence to screen readers and shows as a short line in which component icons stand in for words: polyp faces (a bite out of the corner for a consumed polyp, a striped square for an unseen one), larva cubes, cylinders, a sandstone slab numbered for each board, and a parrotfish in the player's colour. Shrimps stay words, being too small to read as icons. The end of the game lists the polyp each parrotfish was fed at setup.

Coral tiles, larva cubes and cylinders on the open sea always stand upright, whatever the board's turn, so a coral tile reads as printed: stronger coral across the top, algae at the lower left.

## Coexistence and precedence

- An open choice (_Choosing the polyp's source_, _Introducing_ or _Moving a shrimp_, _Buying an alga cylinder_, _Eating a coral_) wins over everything else on the table: while one is open, no other placement, open-sea or pick-up rings show, and the panel shows only that choice's prompt. The session derives this once, as `turnChoiceOpen`.
- _Placing polyps_, _Taking an open-sea space_ and _Picking up a shrimp_ coexist; each rings different things (reef squares, larva spaces, the player's own shrimps).
- A square never shows both a placement ring and a shrimp pick-up ring: a polyp is never placed under a shrimp.
- The _Bare rock warning_ and _Taking an open-sea space_ never coexist: the rules make no space takeable while a shrimp is on bare rock.
- The two popups never coexist: each belongs to an open choice, and only one choice is open at a time.

## Shared visual state

Every stage below is a manual stage of the staged selection. Each is cleared when the action it leads to commits, by Undo (one stage per press, undoing no game action), and whenever a new state is published. None exists in History View or for a player who is not acting, since every ring and choice derives from the session's `canAct`.

- **Chosen square** (`placementSquare`). Producer: a placement ring, when both sources have a polyp. Consumers: the square's orange ring, the source popup anchored beside it, and the panel's prompt; it decides precedence.
- **Shrimp choice** (`shrimp`). Producer: the panel's Introduce tile and the board's pick-up rings; choosing a picked-up shrimp again clears it. Consumers: the board's rings, the panel's prompt, and, for a picked-up shrimp, the orange ring and the popup beside it; it decides precedence.
- **Cylinder payment and colour** (`cylinderPayment`, `cylinderAlga`). Producer: the panel. Consumers: the panel's prompt and the open sea's rings; they decide precedence.
- **Choosing a coral to eat** (`eating`). Producer: the panel. Consumers: the board's red rings and the panel's prompt; it decides precedence.
- **First larva cube** (`firstLarvaCube`). Producer and consumer: the setup panel.

## Render ownership

- Each reef board draws its own rings inside the same turned drawing as its art, so a ring's hit area always covers the square it rings, whatever the board's rotation. The open sea does the same for larva spaces.
- The popups are positioned against a one-pixel anchor the reef board draws at the right edge of the chosen square, inside the turned drawing, so a popup follows its square through scaling, panning and full screen.
- Each piece has two groups: the outer one places it (`translate` to its centre) and belongs to Svelte; the inner one is the only node GSAP animates, with its drawing centred on its origin, so scaling and flipping turn about the piece's centre and a slide runs from the old position's offset back to zero.
- Upright pieces on the turned open sea are counter-turned about their own centres; their positions still turn with the board.

## Motion

- **Pieces** (the session's state-change animation). Every state change compares the table's pieces before and after: a new piece drops in, a removed one sinks away, an attacking polyp lands once the polyp it replaces has gone, a shrimp moved along its reef slides there, and the open sea's polyps shuffle along their larva space as it fills. Coral tiles a cylinder flips turn over once it has landed, about the screen's vertical axis whichever way the open sea is turned. A shrimp that changes drawing (eaten onto the open sea, or moved to another reef) lifts off one and lands on the other. The viewer's own live actions play briskly with no hold; other players' actions and full-action replays hold for readability; undo and history steps finish within 200ms.
- While a change plays out the session refuses every choice, staged or committed, and marks the table `aria-busy`. The action panel and the board each take no pointer input until it settles.
- **Seascape** (local presentation). Behind the table, light shafts sway, caustics drift and a few bubbles rise; the parrotfish of each player whose turn it is breathes out bubbles in their panel. None of it takes input, and all of it holds still under reduced motion.
- **Blinking** (local presentation). Each shrimp on the table blinks six to eight times a minute, in a rhythm and phase picked from the piece, so shrimps never blink together for long. Shrimps in the panels do not blink, and none blink under reduced motion.

## Verification scenarios

Automated, through the browser, most starting from a harness scenario (see the scenarios README):

- **Setup:** every player feeds their parrotfish and takes two cubes; Undo takes back the first cube without undoing the feeding.
- **Placing polyps:** playing a cube rings placements; placing one lowers the count from the supply and Undo restores it; taking a space ends the turn.
- **Choosing the polyp's source** (_Both polyp sources_): choosing a square opens the popup and hides the other rings; Undo closes it without placing; choosing Consumed places the polyp, after which a square places from the supply with no popup.
- **Trades:** a cube traded for a polyp, and undone. With its bonus space empty (_Bag searches_), the trade searches the bag, the history says what it held, and Undo is gone; extra growth beside the starfish square grows a polyp found in the bag.
- **Buying an alga cylinder** (_Consumed polyps to spend_): paying and choosing a colour ring the cylinder circle and hide the larva-space rings; Undo steps back through both choices; playing it ends the choice.
- **Eating a coral** (_Coral ready to eat_): the Eat tile rings the coral of five and hides the larva-space rings; Undo closes the choice; eating feeds the parrotfish and puts the shrimp on the open sea.
- **Shrimps:** Introduce hides the open-sea rings and rings polyps; a pick-up closes on Undo, or on choosing the shrimp again, without undoing anything; a shrimp left on bare rock shows the warning and no space; sending it back to the supply from the popup restores the spaces.
- **End of the game** (_Last orange larva cube_): taking the orange space ends the game on the score table, and the history lists each setup parrotfish polyp.
- **Labels:** the boards and open sea are labelled groups whose pieces, coral tiles (by which coral beats which) and rings carry names; the panel's cube icons are named; the player aid opens from the header and closes with Escape or a click outside.
- **History:** a history entry's header shows the table as its player left it, in History View, where the action panel tells the step that led there; Replay plays a turn's moves and returns to the live game, and setup entries, which move no pieces, offer no Replay.

Unit tests cover how changes are read as motion: slides, lifts and lands, attacks, tile flips.

Manual:

- the final-turn panel: it offers Pass alone when no coral is edible, and passing ends the game on the score table;
- attack rings: dashed orange with a light orange wash over the weaker polyp;
- coral tiles turning over when a cylinder lands on the open sea;
- the motion itself, including replay, undo, and a shrimp sliding from its inner group's offset;
- locking a coral tile, after eating onto the open sea and buying a cylinder with a consumed polyp: the cylinder space and lockable tiles are ringed, the cylinder stands on the locked tile, and the other unlocked tile with the same large alga turns over;
- both popups at desktop and phone sizes, beside their square and clear of the action panel.
