# UI Interaction Visual Contract

## 1. Visual Intents

| Intent        | Trigger                            | What should be emphasized                                                                                                        | What should be dimmed               | What must remain unaffected |
| ------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------- |
| place_ring    | The viewer is placing rings        | Nothing: every vacant point takes a ring, so none is marked                                                                      | Nothing                             | Ring spaces                 |
| choose_ring   | The viewer may move                | Every ring with a legal move (thin cyan ring along its band)                                                                     | Nothing                             | Markers                     |
| choose_target | A ring is chosen                   | The chosen ring (thicker), a preview marker of the viewer's color inside it (rule E2), a cyan spot on every point it can move to | Other movable rings' marks (hidden) | Markers                     |
| choose_row    | The viewer must take a row         | Markers whose tap settles one row (solid ring on the face); markers in several rows (dashed)                                     | Nothing                             | Rings                       |
| choose_end    | A marker in several rows is chosen | That marker (thicker); within the rows through it, the markers that settle one row (solid) and the rest (dashed)                 | Markers of rows not through it      | Rings                       |
| remove_ring   | The viewer must take off a ring    | Every own ring (orange dashes along its band, each outlined in black)                                                            | Nothing                             | Markers                     |

## 2. Visual Primitives

- **Ring** (`RingShape.svelte`, sizes in `board/pieceGeometry.ts`, outlines in `board/pieceShape.ts`, colors and specks in `board/pieceStyle.ts`): an annulus seen from slightly in front, its side showing below the face and through the hole; the board shows through where the hole's openings overlap. Flecked like granite, white with black and black with white, seeded by the ring's id (`board/ringSeeds.ts`), so its specks follow it on the board, in flight, in its player's space and on the player's card. Never carries interaction state.
- **Marker** (`MarkerShape.svelte`): a disc a little smaller than a ring's hole, showing one face (white or black) over the blue side, seeded by its point, as markers never move.
- **Shadows** (`PieceShadow.svelte`, gradients in `PieceDefs.svelte`, `.shadows` layer in `Board.svelte`): a radial-gradient shape under every piece, keyed like the piece so the animator moves and fades each with its piece. Nothing on the board uses a filter.
- **Turning markers** (`Board.svelte`): while a marker turns over it is drawn above the ring in flight, so it pops up and turns as the ring slides beneath it.
- **Marks** (`Board.svelte`, mark layer above the pieces): two-tone circles, a dark band under a bright core (`--yinsh-mark`, cyan; `--yinsh-remove`, orange, for rings to take off): along a ring's band, or on a marker's face inside its rim, so a mark never reaches a neighbour. Destinations are cyan spots outlined in black on the vacant point. Inputs `session.movable`, `session.chosenFrom`, `session.destinations`, `session.rowOptions`, `session.anchor`, `session.removableRings`.
- **Ring spaces** (`board/geometry.ts` `ringSlots`): each player's three spaces for removed rings (one in Blitz) in the empty corners beside the board, parallel to the slanted edge and clear of the column labels: White's (the starting player's) at the top left, matching the order of the player cards, Black's at the bottom right, the same for every viewer, so they never change sides while a ring flies to them.
- **Board theme** (`app.css`): one light, matte board in the printed board's colours: a pale steel-blue table and a paler play area. There is no dark board and no theme toggle.
- **Coordinate labels** (`board/coordinates.ts`): BoardSpace style, each column's letter below its bottom point and each line's number before its first point on the left. Centred by `dy` on the alphabetic baseline with letter-spacing in user units, as WebKit misplaces `dominant-baseline` and Safari em lengths under the board's zoom.
- **Board lines** (`board/boardLines.ts`, from the logic's `LINES`): each line end to end, with a short whisker past each end point.

## 3. Layer Responsibilities

| Layer                                                 | Owns                                                                                                                                                                                                                                                                                                                                      | Allowed Inputs                                   | Must Not Own                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------- |
| `YinshGameSession`                                    | `placeable`, `movable`, `chosenFrom`, `destinations`, `rowOptions` (`model/rowChoice.ts`), `anchor`, `removableRings`, `topPlayerId`, staged selection; a tap commits a placement, a move, a settled row or a ring                                                                                                                        | Game state, valid action types, staged selection | Styling                     |
| `Board.svelte`                                        | Mark roles per point (destination over chosen over movable over row choice over ring removal); hit targets above everything; the staged marker's drop into the chosen ring and its lift back out (`board/dropIn.ts`, Svelte intros on `.drop` wrappers)                                                                                   | Session lists, animator's drawn pieces           | Deciding legality           |
| `BoardAnimator` (`animators/boardAnimator.svelte.ts`) | Motion for committed actions: a placed ring dropping in; the marker dropping into the ring, the ring flying to its point and each jumped marker turning over as the ring passes; a row's markers lifting away; a taken ring flying to its space; each mark fading with the move; the pieces, fliers and ring spaces drawn during a replay | Transition kind, `from`/`to` states, the action  | Interaction state, legality |
| `ActionPanel.svelte`                                  | One-line prompt on your turn (including when the opponent could not move), the last move otherwise                                                                                                                                                                                                                                        | Session state, history entries                   | Board marks                 |

## 4. Shared State Contracts

- **Animation scope**: the board animates only `own-action`, `other-action`, `undo`, `history` and `exploration` transitions; page loads, server syncs and view switches show the board at rest.
- **Steps without an action** (Undo, another player's Undo, state-only history, exploration): the animator reads the change from the two boards (`board/boardDiff.ts`), however many actions lie between them, pairing rings by id: every ring that moved flies from its start to its end, every ring taken off flies to its space and every ring taken back flies from it, markers that changed face turn over along the path of a ring that passed them, rings placed drop in, rings unplaced lift away, and markers drop in or lift away one after another. All within 0.18 s; `tests/undo-timing.spec.ts` holds each to 0.2 s. These are the title's own return motions, kept on purpose: an Undo of a row drops its markers back in and an Undo of a move flies the ring back around the marker it left.
- **Fliers** (`BoardAnimator.fliers`, keyed by ring id): a ring in flight is drawn by its flier and left out of the board's pieces until it lands. Pieces in front cover a flier while it is low only when it is the one flier (`occluders`).
- **Moving SVG** (`animators/svgPose.ts`): every moving node tweens a plain pose (`x`, `y`, `scale`) that writes `translate()` and `scale()` as it is set; opacity stays on the node. A turning marker's face is placed by `translate()` then a `matrix()` with no offset (`board/flipPose.ts`). GSAP writes SVG transforms as `matrix()`, whose offset Firefox 140 leaves out of the board's view-scale zoom; `tests/motion.spec.ts` checks no board transform has a `matrix()` offset through a move, its row and ring, a history step each way and an Undo.
- **Staged selection** (`selection`: `from` while moving, `anchor` while taking a row, as point keys): manual choices only. Registered with the session's `localSelections`, which pops it on Undo and clears it whenever a new state is published; Undo lets go of the chosen ring or row end before it undoes a committed action. The selection belongs to the player who made it (`selectionOwner`): anyone else viewing, as the harness's Non-active view is, sees none of it and Undo passes it by. Taps on the choices do nothing while a move plays (`updatingVisibleState`), as its choices still show while they fade.
- **Staged marker** (`Board.svelte`, `board/dropIn.ts`): choosing a ring drops a marker of the viewer's colour into it (rule E2), a local intro on `.drop` wrappers. `stagedDropStarted` records when it starts; a move committed while it is still falling hands the rest of the fall to the animator (`stagedDropLeft`, `stagedDropPose`), which carries the committed marker on from the same pose. Letting go of a chosen ring, by Undo, a tap off the choices, choosing it again or choosing another, lifts its marker back out (`lifting`, `liftOut` in 0.18 s). A published state or History clears the selection without that lift: `beforeNewState` resets `lifting`.
- **Undo of your own move** (`willUndo` notes the move as `undoingMove`): `restagedMove` holds only while the move is the one this Undo takes back (its index is the incoming state's action count) and the view stays with its mover. `beforeNewState` then chooses its ring again, with its marker still in it (`restaged`, so the marker does not drop in again), and the animator leaves that marker standing (`keepsMarker`). `undoingMove` is cleared by the next published state.
- **Stopping a move** (`YinshGameSession.moveInterrupter`, set by `BoardAnimator`): `beforeNewState` abandons the move on `view-switch`, killing its tweens and putting the board back at rest; the animator tells the abandoned presentation's later steps by `presentingState`. A move's `afterAnimations` writes its board only while the state it began on is still shown.
- **Board drawn during a move** (`BoardAnimator`, read by `Board.svelte`): `pieces` and `removed` (the board and ring spaces each replayed action leaves, until the state lands) are writable `$derived` values over `session.gameState`, so publishing the new state resets them; `fliers` is cleared as each step lands.
- **Turn header** (`Header.svelte`): names the player to act, `activePlayerIds[0]`, who is the opponent while they take rows a move made for them.
- **Passes** (`ActionPanel.svelte`, `history/historyEntries.ts`): the action that ends a turn records a player passed over (`passedPlayerId` in its metadata); the prompt and the history read it there.
- **Target lists**: derived from the displayed state; empty when the viewer cannot act, including in History View.

## 5. Forbidden Couplings

- Do not derive legality in components; read the session lists.
- Do not override `undo()`; register selections with `localSelections`.

## 6. Interaction Matrix

| Intent A    | Intent B      | Can coexist? | Winner / combination rule                                                                               |
| ----------- | ------------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| choose_ring | choose_target | yes          | A tap on a destination moves; a tap on another movable ring chooses that one; the chosen ring puts back |
| choose_row  | choose_end    | yes          | A tap on a settling marker takes its row; on another marker, it becomes the end; on the end, lets go    |

## 7. Regression Checklist

Each was exercised in the dev harness on 2026-11-16 (`tests/` covers the ones marked †).

| Scenario                                              | Intent                     | Expected                                                                                                                                                                                  | Automated               |
| ----------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| New game: place a ring                                | place_ring                 | The ring drops in with a small bounce; the turn passes; Undo lifts it away                                                                                                                | † `table.spec.ts`       |
| Form a row: choose F3                                 | choose_ring, choose_target | A preview marker drops into it, cyan spots on every destination; tap it again, tap off the board or Undo to put it back, its marker lifting out                                           | † `table.spec.ts`       |
| Form a row: choose F3, then a destination at once     | choose_target              | The committed marker carries on from mid-fall, without a snap                                                                                                                             | manual                  |
| Form a row: move F3 to D1                             | choose_target              | The ring lifts off over the marker it leaves, flies, and lands; taps on the old choices do nothing until it lands                                                                         | † `motion.spec.ts`      |
| Form a row: take B3–F3, then E9                       | choose_row, remove_ring    | The markers float up one after another; the ring flies to Alice's space                                                                                                                   | † `table.spec.ts`       |
| Choose the rows: move F3 to F6, tap C4, then G4       | choose_end                 | C4–G4 goes, one ring comes off                                                                                                                                                            | manual                  |
| Rows for both                                         | choose_row                 | The header names Alice, then Bob while he takes his row and ring, before he moves                                                                                                         | manual                  |
| Bob passes                                            | choose_ring                | After Alice moves, "Bob cannot move; move again"; the history entry ends "Bob could not move and passed"                                                                                  | manual                  |
| Undo of a move, own                                   | Undo                       | The ring flies back around the marker it left, which stays standing, markers turn back, and the ring is chosen again with the marker in it, within 0.2 s; Undo again lifts the marker out | † `undo-timing.spec.ts` |
| Undo of a move, another player's                      | Undo                       | The ring flies back and its marker lifts away; nothing is chosen                                                                                                                          | † `undo-timing.spec.ts` |
| History: beginning and end after a move, row and ring | History View               | Each moved ring flies straight between its ends, the removed ring flies to or from its space; no marks or targets                                                                         | † `undo-timing.spec.ts` |
| Switch of view mid-move                               | —                          | The move stops; the board shows the switched state                                                                                                                                        | manual                  |
| Refresh                                               | —                          | Two screenshots 0.1 s and 1 s after opening are identical                                                                                                                                 | manual                  |

## 8. Change Rules

When touching interactive visuals:

1. identify the intent being changed
2. identify the primitives involved
3. verify whether shared state contracts are being widened
4. update this document if a new interaction or coupling is introduced

## 9. Status

- Interactive visual system status: `Initial`
- Last updated for interaction change: registered selection, rings paired by id, translate() motion, recorded passes
