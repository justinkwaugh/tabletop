# UI Interaction Visual Contract

## 1. Visual Intents

| Intent        | Trigger               | What should be emphasized                                                                  | What should be dimmed                | What must remain unaffected |
| ------------- | --------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------ | --------------------------- |
| place_piece   | The viewer is placing | Nothing: every empty space takes a piece, so none is marked                                | Nothing                              | Pieces on the board         |
| choose_stack  | The viewer may move   | Every stack with a legal move (its moulded rim recoloured cyan on the top face)            | Nothing                              | Other stacks                |
| choose_target | A stack is chosen     | The chosen stack (thicker rim), a dashed cyan rim, each dash outlined in black, on the top of every stack it can land on | Other movable stacks' marks (hidden) | Other stacks                |

## 2. Visual Primitives

- **Stack** (`StackShape.svelte`, sizes in `board/pieceGeometry.ts`, colors and specks in `board/pieceStyle.ts`): donut pieces with a dished top seen from the near side of the table, nested with a dark seam between them; only the top piece shows its face. The hole is open: down it show the inner walls of the pieces in turn, each at its true thickness with a thin seam between pieces, and below them the board once the stack is low enough. Past thirteen pieces a stack rises no higher and its bands thin out, except DVONN pieces, which keep most of their thickness so a buried one stays a clear red band. A stack of two or more carries its count in the top piece's hole, white outlined in black. Speckled like the real pieces on every surface (face, side, hole wall, thinned bands) at one density per area, seeded by the space each piece was placed on. Never carries interaction state.
- **Shadows** (`Board.svelte`): a radial-gradient ellipse under each stack, inside the stack's animated group, so it moves and fades with it. No filters on pieces.
- **Board** (`Board.svelte`, `graphBoard` title preference, `BoardStyleToggle` showing the board a press switches to): the old edition's pale sand (`board/sand.ts`, grain drawn once on a canvas, clipped to the rounded outline from `board/geometry.ts`) pressed with a ring at every space, by default; or the newer graph board, black lines along the three directions through every space with short whiskers, on a pale area that ends at the outer lines.
- **Marks** (`Board.svelte`, drawn in each stack's group after the stack but outside its moving group, so nearer stacks cover them as they cover pieces; the animator fades every mark with the move): two-tone ellipses, a dark band under a cyan core (`--dvonn-mark`), drawn on the top face's moulded rim at the stack's current height, so a mark never reaches a neighbour. Inputs `session.movable`, `session.chosenFrom`, `session.destinations`.
- **Coordinate labels** (`board/coordinates.ts`): BoardSpace style; each row's number before its first space on the left, each diagonal column's letter beyond its bottom space, both on the table outside the board.

## 3. Layer Responsibilities

| Layer                                                 | Owns                                                                                                                                                                                                     | Allowed Inputs                                   | Must Not Own                |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------- |
| `DvonnGameSession`                                    | `placeable`, `pieceToPlace`, `movable`, `chosenFrom`, `destinations`, staged selection; a tap commits a placement or a move                                                                              | Game state, valid action types, staged selection | Styling                     |
| `Board.svelte`                                        | Mark roles per space (destination over chosen over movable); hit targets above everything, sized to each stack                                                                                           | Session lists, animator's drawn stacks           | Deciding legality           |
| `BoardAnimator` (`animators/boardAnimator.svelte.ts`) | Motion for committed actions: a placed piece dropping in; the moving stack hopping in an arc onto the stack it lands on; stacks cut off lifting away after it lands; the mark layer fading with the move | Transition kind, `from`/`to` states, the action  | Interaction state, legality |
| `ActionPanel.svelte`                                  | One-line prompt on your turn (including when the opponent could not move), the last move otherwise                                                                                                       | Session state, history entries                   | Board marks                 |

## 4. Shared State Contracts

- **Animation scope**: the board animates only `own-action`, `other-action`, `undo`, `history` and `exploration` transitions; page loads, server syncs and view switches show the board at rest. The animator reads the change from the two boards (`board/boardDiff.ts`): a stack that left one space and now tops another as far away as it is tall hops there (backwards for undo), stacks that left lift away and stacks that came back drop in; without an action all within 0.18 s.
- **Staged selection** (`selection.from`): manual only. Tapping the chosen stack again or Undo lets go of it; Undo then undoes the last committed action. Cleared in `beforeNewState` for every presented transition.
- **Target lists**: derived from the displayed state; empty when the viewer cannot act, including in History View.

## 5. Forbidden Couplings

- Do not derive legality in components; read the session lists.

## 6. Interaction Matrix

| Intent A     | Intent B      | Can coexist? | Winner / combination rule                                                                               |
| ------------ | ------------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| choose_stack | choose_target | yes          | A tap on a destination moves; a tap on another movable stack chooses that one; the chosen stack lets go |

## 7. Regression Checklist

- Choose a stack: thicker rim on it, dashed rims on every landing; tap it again to let go.
- Cut off scenario: move C2 onto D2; the four stacks on A1–B2 lift away after the hop lands.
- Bob passes scenario: after Alice's move the banner says Bob cannot move; move again.
- Undo after a move: the stack hops back and cut-off stacks drop back in; every stack group has opacity 1 afterwards.
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
- Last updated for interaction change: initial DVONN UI
