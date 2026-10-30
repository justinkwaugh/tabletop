# UI Interaction Visual Contract

## 1. Visual Intents

| Intent        | Trigger                            | What should be emphasized                                                                                                                                  | What should be dimmed                | What must remain unaffected |
| ------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------- |
| place_piece   | The viewer is placing (tournament) | The chosen type among the action panel's type buttons; on the board nothing, since every empty space takes a piece                                         | Types the viewer has none left of    | Pieces on the board         |
| choose_stack  | The viewer may capture or stack    | Every stack with a legal capture or stacking (a cyan ring on the flat edge of its top piece)                                                               | Nothing                              | Other stacks                |
| choose_target | A stack is chosen                  | The chosen stack (thicker ring), a dashed cyan ring, each dash outlined in black, on every stack it can capture and every own stack it may be stacked onto | Other movable stacks' marks (hidden) | Other stacks                |
| pass          | The viewer is on the second move   | A Pass button in the action panel while no stack is chosen                                                                                                 | Nothing                              | The board                   |

## 2. Visual Primitives

- **Stack** (`StackShape.svelte`, sizes in `board/pieceGeometry.ts`, shape in `board/pieceShape.ts`, colors and specks in `board/pieceStyle.ts`): GIPF-style discs seen from the near side of the table, each resting a little above the one below with a dark crease between; only the top piece shows its top: a flat edge, a groove, a raised ring and a sunken centre. A Tzarra's centre is metal, and a Tzaar's groove too: gold on white, silver on black. Past five pieces (nine on the rotated board, `ROTATED_PIECE_MODEL`, where the nearest pieces behind stand half a piece to either side) a stack rises no higher, so a single piece behind it keeps about 44% (54%) showing, and the pieces between its bottom and top thin to bands. A stack of two or more carries its count on a small white badge on the near-right of its top piece (the digits set ten times larger and scaled down, since text that small is snapped off-centre on phones), inside the stack's own outline and clear of the type's markings. Speckled like the real pieces on every plastic surface at one density per area, seeded by each piece's id. Never carries interaction state.
- **Shadows** (`Board.svelte`): a radial-gradient ellipse under each stack, inside the stack's animated group, so it moves and fades with it, and the board in shade right under it, showing through the gap below the bottom piece. No filters on pieces.
- **Board** (`Board.svelte`, outline and lines from `board/geometry.ts`; the `rotatedBoard` title preference, toggled by the ↻ overlay button, turns it a quarter turn so its flat sides face the players, columns running across with A at the top and labels beside both ends of each row): the printed board's pale play area, a hexagon less the one round the missing centre, on the golden table; black lines along the three directions between neighbouring spaces, never across the centre, running a quarter step past the board's edge.
- **Marks** (`Board.svelte`, passed to `StackShape` as its `onTop` snippet and drawn on the top piece under the count badge, so nearer stacks cover them as they cover pieces, the badge stays whole, and a captured stack's mark rises and fades with it; the animator fades every mark with the move): two-tone ellipses, a dark band under a cyan core (`--tzaar-mark`), on the flat edge of the top piece at the stack's current height, so a mark never reaches a neighbour. Inputs `session.movable`, `session.chosenFrom`, `session.captureTargets`, `session.stackTargets`.
- **Coordinate labels** (`board/coordinates.ts`, placed by `BoardView.labelAt`): the rulebook's names for the ends of each column, the top one a gap above a single piece on that space and the bottom one a gap below its near edge, on the table. A taller stack on a top space covers its label (the user's choice for now).

## 3. Layer Responsibilities

| Layer                                                 | Owns                                                                                                                                                                                                                                                                                                                                                                                                         | Allowed Inputs                                   | Must Not Own                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | --------------------------- |
| `TzaarGameSession`                                    | `placeable`, `kindsInHand`, `placingKind` (a tool-like choice kept between placements, not a staged step), `movable`, `chosenFrom`, `captureTargets`, `stackTargets`, staged selection; a tap commits a placement, capture or stacking; `pass()`                                                                                                                                                             | Game state, valid action types, staged selection | Styling                     |
| `Board.svelte`                                        | Mark roles per space (destination over chosen over movable); hit targets above everything, sized to each stack                                                                                                                                                                                                                                                                                               | Session lists, animator's drawn stacks           | Deciding legality           |
| `BoardAnimator` (`animators/boardAnimator.svelte.ts`) | Motion for committed actions: a placed piece dropping in; the moving stack hopping in an arc onto the space it captures, the captured stack floating up as it comes, and rebounding along the hop as it lands; or onto its own stack, with a small vertical bounce, after which a stack grown past the height limit shrinks to it over 0.3 s (drawn at once when quick); the mark layer fading with the move | Transition kind, `from`/`to` states, the action  | Interaction state, legality |
| `ActionPanel.svelte`                                  | One-line prompt on your turn with the Pass button or the type buttons, the last move otherwise                                                                                                                                                                                                                                                                                                               | Session state, history entries                   | Board marks                 |

## 4. Shared State Contracts

- **Animation scope**: the board animates only `own-action`, `other-action`, `undo`, `history` and `exploration` transitions; page loads, server syncs and view switches show the board at rest. The animator reads the change from the two boards (`board/boardDiff.ts`), following the action the session knows where one is: a stack that left one space and now stands on another in line with it hops there, capturing what stood there or landing on it (backwards for undo, the captured stack coming back down once the mover has left); stacks that appear drop in and stacks that vanish lift off; undo and history all within 0.18 s.
- **Staged selection** (`selection.from`): manual only. Tapping the chosen stack again or Undo lets go of it; Undo then undoes the last committed action. Undoing a capture or stacking restages its stack as chosen in `beforeNewState` (`kind === 'undo'`); every other presented transition clears it.
- **Target lists**: derived from the displayed state; empty when the viewer cannot act, including in History View.

## 5. Forbidden Couplings

- Do not derive legality in components; read the session lists.

## 6. Interaction Matrix

| Intent A      | Intent B      | Can coexist? | Winner / combination rule                                                                                                            |
| ------------- | ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| choose_stack  | choose_target | yes          | A tap on a target captures or stacks; a tap on another movable stack that is not a target chooses that one; the chosen stack lets go |
| choose_target | pass          | no           | Pass shows only while no stack is chosen                                                                                             |

## 7. Regression Checklist

- Choose a stack: thicker ring on it, dashed rings on every capture and stacking target; tap it again to let go.
- Two Tzaars left: capture D1 onto D2; the captured Tzaar floats up as the stack lands; capture F1 onto F2 and the game ends.
- Covering a type: after capturing A3 onto A5, only A1 onto A2 or B1 and A5 onto A2 are offered.
- Undo after a capture: the stack hops back and stays chosen, the captured stack drops back in; every stack group has opacity 1 afterwards.
- Refresh: two screenshots 0.1 s and 1 s after opening are identical.
- History View: no marks or targets.

## 8. Change Rules

When touching interactive visuals:

1. identify the intent being changed
2. identify the primitives involved
3. verify whether shared state contracts are being widened
4. update this document if a new interaction or coupling is introduced

## 9. Status

- Interactive visual system status: `Initial`
- Last updated for interaction change: initial TZAAR UI
