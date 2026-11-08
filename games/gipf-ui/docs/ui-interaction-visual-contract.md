# UI Interaction Visual Contract

## 1. Visual Intents

| Intent      | Trigger                                                                                   | What should be emphasized                                                                     | What should be dimmed   | What must remain unaffected       |
| ----------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------- |
| choose_dot  | The viewer may push                                                                       | Every dot with a legal push (cyan)                                                            | Nothing                 | Pieces                            |
| choose_type | Tournament, a dot is chosen, and both a single and a GIPF-piece may be brought in         | The staged piece on its dot: tapping it or the dot again drops a second disc, or lifts it off | Nothing                 | Targets                           |
| choose_line | A dot is chosen                                                                           | The chosen dot (ringed); an arrow and dashed target ring on each first spot it can push into  | Other dots' rings (40%) | Pieces                            |
| choose_row  | The viewer has rows to take (all while resolving; only rows of GIPF-pieces before a move) | Every piece in a row's reach (dashed red ring)                                                | Nothing                 | Dots, targets                     |
| shape_row   | A row is chosen                                                                           | Pieces to be taken (solid red ring), GIPF-pieces kept (green ring)                            | Nothing                 | Other rows keep their dashed ring |

## 2. Visual Primitives

- **Choice marks** (`Board.svelte`, `.under` and `.over`): the dot rings, target rings and arrows are two-tone as in MATRX GIPF, DVONN and LYNGK, a dark band (`.under`) under a cyan core (`.over`, `--gipf-mark`), so they read on the board and on light and dark pieces alike; the dashed target rings have each dash outlined on its own (shorter square-capped dark dashes), so what is under shows between dashes. Row marks stay red and green. The active player's tray keeps orange (`--gipf-target`).
- **Entry dot** (`Board.svelte`, `.dot.entry`, `.dot.chosen`): once a dot is chosen, the other dots' rings fade (`.dot-ring.faded`, 40%). Inputs `session.entryDots`, `session.chosenDot`.
- **Push target** (`Board.svelte`, `.target`): an arrow lying on the board from the staged piece's top to near the first spot's centre (`ARROW_START`, `ARROW_REACH`, as in MATRX GIPF), so it marks where the push goes, and a dashed ring on the first spot. Every arrow's tail is as far from its dot on screen as an upright one's, so slanted ones, which the tilt shortens less, reach as far back over the staged piece. Inputs `session.targets`.
- **Row mark** (`Board.svelte`, on a layer above the pieces, drawn on each piece's top face so no mark reaches a neighbour): a dashed red ring just inside the face for a row you can choose (`.row-mark.role-row`); once a row is chosen, a spot on each piece (`.mark-spot`, red going, green kept), and on each GIPF-piece in the row the crown ring recoloured and thickened (`.crown-mark`) for keep or take. Your own GIPF-pieces start kept and the opponent's start taken; tapping one toggles it. Positions come from `BoardView.topFace` in `board/geometry.ts`. Inputs `session.rows`, `session.removing`, `session.keep`, `session.rowGipfPieces`.
- **Piece** (`PieceShape.svelte`, shape in `board/pieceShape.ts`): MATRX GIPF's disc seen at the board's tilt, rounded edges and a flat top with a groove whose lips and floor are rounded; each tone's disc is a pre-rendered WebP (`scripts/render-looks.mjs` from the `/looks` route, `board/lookUrls.ts`; rerun after changing the shape). A GIPF-piece is two discs, the top one resting 0.24 of a thickness above the lower, a dark crease between them; each disc is its own node so it can drop on its own. Light for White, dark for Black. Never carries interaction state.
- **Board theme** (`app.css`): one light board: pale blue play area bounded by the outermost grid lines, muted blue table, black lines and dots. No intersection marks.
- **Coordinate labels** (`Board.svelte`, `.coordinate-label`, from `board/coordinates.ts`): each column's bottom and top point (A1…A5 to I1…I5), beyond the column's ends. They can be hidden (see Board toggles).
- **Board toggles** (`OverlayToggle.svelte`, in `GameTable.svelte`'s overlay): a row of round chips at the board's bottom right, as in GIPF with Potentials: A1 for the coordinate labels, then two turning arrows for the far side, the board seen half a turn round (`viewOf(true)`), so pieces hidden behind others come in front; labels stay beyond their columns' ends. Each is the player's own title preference (`showCoordinates`, `turned`); coordinates on by default, the far side off. A chip that is on shows its glyph in full ink with a thin cyan ring (`--gipf-toggle-on`) round it, as in LYNGK.

## 3. Layer Responsibilities

| Layer                                                    | Owns                                                                                                                                                                                                                                     | Allowed Inputs                                   | Must Not Own                |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------- |
| `GipfGameSession`                                        | `pieceTypes`, `chosenGipf`, `entryDots`, `chosenDot`, `targets`, `rows`, `chosenRow`, `keep`, `removing`, staged selection                                                                                                               | Game state, valid action types, staged selection | Styling                     |
| `Board.svelte`                                           | Mark roles per piece and dot                                                                                                                                                                                                             | Session targets and rows                         | Deciding legality           |
| `BoardAnimator` (`animators/boardAnimator.svelte.ts`)    | Motion for committed moves: the pushed piece sliding from its dot with the line moving one spot, taken pieces lifting and fading, the mark layer (entry rings, arrows, row marks) fading with the move; the pieces drawn during a replay | Transition kind, `from`/`to` states, the action  | Interaction state, legality |
| `StagedPiece.svelte`, `StagedDrop` (`animators/drop.ts`) | The staged piece's drop onto its dot, the added disc's bounce (local GSAP timelines on each disc's inner node) and its lift-off when let go (Svelte outros on the wrappers)                                                              | The staged selection                             | Committed motion            |
| `ActionPanel.svelte`                                     | Prompts, the last move while waiting, Take row / leave GIPF-pieces buttons                                                                                                                                                               | Session state                                    | Board marks                 |

## 4. Shared State Contracts

- **Animation scope**: the board animates only `own-action`, `other-action`, `undo`, `history` and `exploration` transitions; page loads, server syncs and view switches show the board at rest. Without an action (undo, state-only history) the animator reads a push from the two boards (`board/inferPush.ts`) and slides the line forward or back, the pushed piece returning to its dot on the way back; otherwise pieces whose spot is left empty fade. All within 0.18s. The drop-in of the piece you are about to bring in, onto the chosen dot, is a local GSAP timeline (`StagedDrop`): it explains a staged choice, not a committed move. A switch of view while a move plays leaves the board to the state it shows: the animator applies its end-of-move overrides only while the state it started from is still shown.

- **Staged selection** (`selection`: `dot`, `gipf`, `row`, `keep`): manual choices only; single options (one piece type, one row that must be taken) are derived, never stored, so Undo skips them. Registered with the session's `localSelections`, which pops it on Undo and clears it whenever a new state is published; on an Undo of your push, `beforeNewState` then restages the push's dot, and its GIPF choice if there was one to make. A tap on the board that misses every enabled `role="button"` lets go of a chosen dot (`letGo`); rows and keep toggles are left alone.
- **Pushes known to the session** (`GipfGameSession`): `undoingPush`, set by `willUndo` and kept until a transition other than Undo, and `historyPush`, set by `onHistoryAction`. The animator reads them in Undo and history steps to tell which dot a piece came from, using one only when it turns one board into the other; `beforeNewState` restages `undoingPush`.
- **Board drawn during a move** (`BoardAnimator`, read by `Board.svelte`): `pieces` (the board each replayed action leaves, until the state lands), `entering` (the piece coming in from its dot, cleared after each step), `returned` (the piece an Undo took back onto its dot, until the state lands) and `pushedIn` (your pushed piece stays off its dot until the state lands). Each but `entering` is a writable `$derived` over `session.gameState`, so publishing the new state resets it.
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
- Rows: dashed marks on every row; choosing one turns its marks solid; your GIPF-pieces start kept and the opponent's taken, and tapping one toggles it.
- Tournament type: tapping the staged piece drops a second disc, tapping again lifts it off, even mid-drop, without a snap.
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
- Last updated for interaction change: opponent GIPF-pieces may be left; registered staged selection
