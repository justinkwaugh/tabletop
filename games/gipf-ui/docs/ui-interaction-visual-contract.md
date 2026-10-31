# UI Interaction Visual Contract

## 1. Visual Intents

| Intent       | Trigger                                                                                   | What should be emphasized                                                                    | What should be dimmed   | What must remain unaffected       |
| ------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------- |
| choose_piece | Tournament, while both a single and a GIPF-piece may be brought in                        | Piece-type buttons in the action panel; the chosen one                                       | Nothing                 | Board                             |
| choose_dot   | A piece type is chosen and the viewer may push                                            | Every dot with a legal push (orange)                                                         | Nothing                 | Pieces                            |
| choose_line  | A dot is chosen                                                                           | The chosen dot (ringed); an arrow and dashed target ring on each first spot it can push into | Other dots' rings (40%) | Pieces                            |
| choose_row   | The viewer has rows to take (all while resolving; only rows of GIPF-pieces before a move) | Every piece in a row's reach (dashed red ring)                                               | Nothing                 | Dots, targets                     |
| shape_row    | A row is chosen                                                                           | Pieces to be taken (solid red ring), GIPF-pieces kept (green ring)                           | Nothing                 | Other rows keep their dashed ring |

## 2. Visual Primitives

- **Entry dot** (`Board.svelte`, `.dot.entry`, `.dot.chosen`): once a dot is chosen, the other dots' rings fade (`.dot-ring.faded`, 40%). Inputs `session.entryDots`, `session.chosenDot`.
- **Push target** (`Board.svelte`, `.target`): arrow from the chosen dot and a dashed ring on the first spot. Inputs `session.targets`.
- **Row mark** (`Board.svelte`, on a layer above the pieces, drawn on each piece's top face so no mark reaches a neighbour): a dashed red ring just inside the face for a row you can choose (`.row-mark.role-row`); once a row is chosen, a spot on each piece (`.mark-spot`, red going, green kept), and on your own GIPF-pieces the crown ring recoloured and thickened (`.crown-mark`) for keep or take. Opponent GIPF-pieces are always taken in the UI. Positions come from `board/pieceGeometry.ts`. Inputs `session.rows`, `session.removing`, `session.keep`, `session.rowGipfPieces`.
- **Piece** (`PieceShape.svelte`, layout in `board/pieceGeometry.ts`): flat-lit disc with its side showing; a GIPF-piece is two same-size discs, the top raised with a dark gap band between their edges and a crown ring. Colour comes from the owner's player colour. Never carries interaction state.
- **Board theme** (`app.css`, `.gipf-light` on the table): light board by default (`lightBoard` title preference, toggled by `BoardModeToggle`, an icon showing the mode a press switches to (moon on light, sun on dark)): pale blue play area bounded by the outermost grid lines, muted blue table, black lines and dots. The dark board swaps the colour variables. No intersection marks.
- **Coordinate labels** (`Board.svelte`, `.coordinate-label`, from `board/coordinates.ts`): each column's bottom and top point (A1…A5 to I1…I5), outside the board edge.

## 3. Layer Responsibilities

| Layer                                                 | Owns                                                                                                                                                                                                                                     | Allowed Inputs                                   | Must Not Own                |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------- |
| `GipfGameSession`                                     | `pieceTypes`, `chosenGipf`, `entryDots`, `chosenDot`, `targets`, `rows`, `chosenRow`, `keep`, `removing`, staged selection                                                                                                               | Game state, valid action types, staged selection | Styling                     |
| `Board.svelte`                                        | Mark roles per piece and dot                                                                                                                                                                                                             | Session targets and rows                         | Deciding legality           |
| `BoardAnimator` (`animators/boardAnimator.svelte.ts`) | Motion for committed moves: the pushed piece sliding from its dot with the line moving one spot, taken pieces lifting and fading, the mark layer (entry rings, arrows, row marks) fading with the move; the pieces drawn during a replay | Transition kind, `from`/`to` states, the action  | Interaction state, legality |
| `ActionPanel.svelte`                                  | Prompts, piece-type choice, Take row / Leave GIPF-pieces buttons                                                                                                                                                                         | Session state                                    | Board marks                 |

## 4. Shared State Contracts

- **Animation scope**: the board animates only `own-action`, `other-action`, `undo`, `history` and `exploration` transitions; page loads, server syncs and view switches show the board at rest. Without an action (undo, state-only history) the animator reads a push from the two boards (`board/inferPush.ts`) and slides the line forward or back, the pushed piece returning to its dot on the way back; otherwise pieces whose spot is left empty fade. All within 0.18s. The drop-in of the piece you are about to bring in, onto the chosen dot, is a local Svelte transition: it explains a staged choice, not a committed move.

- **Staged selection** (`selection`: `gipf`, `dot`, `row`, `keep`): manual choices only; single options (one piece type, one row that must be taken) are derived, never stored, so Undo skips them. Cleared in `beforeNewState` for every presented transition. A tap on the board that misses every enabled `role="button"` lets go of a chosen dot (`letGo`); rows and keep toggles are left alone.
- **Target lists**: derived from the displayed state; empty when the viewer cannot act, including in History View.

## 5. Forbidden Couplings

- Do not derive legality in components; read the session lists.
- Do not store auto-selected piece types or rows in `selection`.

## 6. Interaction Matrix

| Intent A    | Intent B   | Can coexist?                                 | Winner / combination rule                             |
| ----------- | ---------- | -------------------------------------------- | ----------------------------------------------------- |
| choose_dot  | choose_row | yes, before a move with a row of GIPF-pieces | Dots and pieces are different elements                |
| choose_line | shape_row  | yes                                          | Targets are on empty first spots; row marks on pieces |

## 7. Regression Checklist

- Push: dot shows arrows and the other dots fade; tapping an arrow pushes the chain one spot; tapping off the choices on the board lets go of the dot.
- Rows: dashed marks on every row; choosing one turns its marks solid; tapping its GIPF-pieces toggles keep.
- Crossing rows: tapping the shared piece again switches row.
- History View: no marks or targets.

## 8. Change Rules

When touching interactive visuals:

1. identify the intent being changed
2. identify the primitives involved
3. verify whether shared state contracts are being widened
4. update this document if a new interaction or coupling is introduced

## 9. Status

- Interactive visual system status: `Initial`
- Last updated for interaction change: initial GIPF UI
