# UI Interaction Visual Contract

## 1. Visual Intents

| Intent        | Trigger                            | What should be emphasized                                                                                                        | What should be dimmed               | What must remain unaffected |
| ------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------- |
| place_ring    | The viewer is placing rings        | Nothing: every vacant point takes a ring, so none is marked                                                                      | Nothing                             | Ring spaces                 |
| choose_ring   | The viewer may move                | Every ring with a legal move (thin cyan ring along its band)                                                                     | Nothing                             | Markers                     |
| choose_target | A ring is chosen                   | The chosen ring (thicker), a preview marker of the viewer's color inside it (rule E2), a cyan spot on every point it can move to | Other movable rings' marks (hidden) | Markers                     |
| choose_row    | The viewer must take a row         | Markers whose tap settles one row (solid ring on the face); markers in several rows (dashed)                                     | Nothing                             | Rings                       |
| choose_end    | A marker in several rows is chosen | That marker (thicker); within the rows through it, the markers that settle one row (solid) and the rest (dashed)                 | Markers of rows not through it      | Rings                       |
| remove_ring   | The viewer must take off a ring    | Every own ring (orange dashes along its band, each outlined in black)                                                                               | Nothing                             | Markers                     |

## 2. Visual Primitives

- **Ring** (`RingShape.svelte`, sizes in `board/pieceGeometry.ts`, outlines in `board/pieceShapes.ts`, colors and specks in `board/pieceStyle.ts`): an annulus seen from slightly in front, its side showing below the face and through the hole; the board shows through where the hole's openings overlap. Flecked like granite, white with black and black with white, seeded by the point it stands on (a ring in flight is seeded by the point it leaves). Never carries interaction state.
- **Marker** (`MarkerShape.svelte`): a disc a little smaller than a ring's hole, showing one face (white or black) over the blue side.
- **Shadows** (`Board.svelte`, `.shadows`): one blurred layer under every piece, keyed like the piece so the animator moves and fades each with its piece. Pieces themselves use no filters.
- **Turning markers** (`Board.svelte`): while a marker turns over it is drawn above the ring in flight, so it pops up and turns as the ring slides beneath it.
- **Marks** (`Board.svelte`, mark layer above the pieces): two-tone circles, a dark band under a bright core (`--yinsh-mark`, cyan; `--yinsh-remove`, orange, for rings to take off): along a ring's band, or on a marker's face inside its rim, so a mark never reaches a neighbour. Destinations are cyan spots outlined in black on the vacant point. Inputs `session.movable`, `session.chosenFrom`, `session.destinations`, `session.rowOptions`, `session.anchor`, `session.removableRings`.
- **Ring spaces** (`board/geometry.ts` `ringSlots`): each player's three spaces for removed rings (one in Blitz) in the empty corners beside the board, parallel to the slanted edge and clear of the column labels: White's (the starting player's) at the top left, matching the order of the player cards, Black's at the bottom right, the same for every viewer, so they never change sides while a ring flies to them.
- **Board theme** (`app.css`, `.yinsh-light` on the table): light board by default (`lightBoard` title preference, `BoardModeToggle` shows the mode a press switches to). The play area ends at the grid's outer lines, notched where the hexagon's corners are missing; no marks at the nodes.
- **Coordinate labels** (`board/coordinates.ts`): each column labelled with its top point's name above it and its bottom point's name below it (A5 and A2 … K10 and K7).

## 3. Layer Responsibilities

| Layer                                                 | Owns                                                                                                                                                                                                                                                                                                                                    | Allowed Inputs                                   | Must Not Own                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------- |
| `YinshGameSession`                                    | `placeable`, `movable`, `chosenFrom`, `destinations`, `rowOptions` (`model/rowChoice.ts`), `anchor`, `removableRings`, `topPlayerId`, staged selection; a tap commits a placement, a move, a settled row or a ring                                                                                                                      | Game state, valid action types, staged selection | Styling                     |
| `Board.svelte`                                        | Mark roles per point (destination over chosen over movable over row choice over ring removal); hit targets above everything                                                                                                                                                                                                             | Session lists, animator's drawn pieces           | Deciding legality           |
| `BoardAnimator` (`animators/boardAnimator.svelte.ts`) | Motion for committed actions: a placed ring dropping in; the marker dropping into the ring, the ring gliding to its point and each jumped marker turning over as the ring passes; a row's markers lifting away; a taken ring flying to its space; the mark layer fading with the move; the pieces and ring counts drawn during a replay | Transition kind, `from`/`to` states, the action  | Interaction state, legality |
| `ActionPanel.svelte`                                  | One-line prompt on your turn (including when the opponent could not move), the last move otherwise                                                                                                                                                                                                                                      | Session state, history entries                   | Board marks                 |

## 4. Shared State Contracts

- **Animation scope**: the board animates only `own-action`, `other-action`, `undo`, `history` and `exploration` transitions; page loads, server syncs and view switches show the board at rest. Without an action (undo, state-only history) the animator reads the change from the two boards (`board/boardDiff.ts`): a ring that left one point and arrived in line glides, markers that changed face turn over, pieces that left fade and pieces that arrived fade in, all within 0.18 s.
- **Staged selection** (`selection`: `from` while moving, `anchor` while taking a row): manual choices only. Undo lets go of the chosen ring or row end, then undoes the last committed action. Cleared in `beforeNewState` for every presented transition.
- **Target lists**: derived from the displayed state; empty when the viewer cannot act, including in History View.

## 5. Forbidden Couplings

- Do not derive legality in components; read the session lists.

## 6. Interaction Matrix

| Intent A    | Intent B      | Can coexist? | Winner / combination rule                                                                               |
| ----------- | ------------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| choose_ring | choose_target | yes          | A tap on a destination moves; a tap on another movable ring chooses that one; the chosen ring puts back |
| choose_row  | choose_end    | yes          | A tap on a settling marker takes its row; on another marker, it becomes the end; on the end, lets go    |

## 7. Regression Checklist

- Choose a ring: a preview marker inside it, cyan spots on every destination; tap it again to put it back.
- Choose the rows scenario: move F3 to F6, tap C4, then G4; C4–G4 goes, one ring comes off.
- Rows for both scenario: Alice takes her row and ring, then Bob his, before Bob moves.
- Undo after a move: the ring glides back, markers turn back, the left marker fades; every piece group has opacity 1 afterwards.
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
- Last updated for interaction change: initial YINSH UI
