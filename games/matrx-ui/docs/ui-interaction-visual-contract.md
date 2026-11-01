# UI Interaction Visual Contract

## 1. Visual Intents

| Intent        | Trigger                                                       | What should be emphasized                                                                        | What should be dimmed                       | What must remain unaffected       |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------- | --------------------------------- |
| choose_kind   | The viewer may bring a stack in                               | Reserve strip under the action panel; the chosen kind ringed cyan                                | Kinds with no stack                         | Board                             |
| choose_dot    | The viewer may push (a stack, a GIPF piece, or an extra move) | Every dot with a legal push (cyan ring)                                                          | Nothing                                     | Stacks                            |
| choose_line   | A dot is chosen                                               | The staged stack on the dot; an arrow and dashed target ring on each first spot it can push into | Other dots' and movable stacks' rings (40%) | Stacks                            |
| choose_from   | The viewer has stacks of two that can move                    | A solid cyan ring on each such stack's top face                                                  | Nothing                                     | Dots stay ringed                  |
| choose_target | A stack is chosen                                             | Its ring thicker; dashed rings on empty landing spots and on the top face of stacks it can cover | Other movable stacks' and dots' rings (40%) | Stacks                            |
| choose_row    | The viewer has rows to take                                   | Every stack in a row's reach (dashed red ring)                                                   | Nothing                                     | Dots, targets                     |
| shape_row     | A row is chosen                                               | A spot on each stack's top (red goes, green stays); stacks of two also a toggle ring             | Nothing                                     | Other rows keep their dashed ring |

## 2. Visual Primitives

- **Entry dot** (`Board.svelte`, `.dot.entry`, `.dot-ring`): inputs `session.entryDots`, `session.chosenDot`.
- **Choice marks** (`Board.svelte`, `.under` and `.over`): the dot rings, target rings, arrows and the movable, chosen and target stack rings are two-tone as in DVONN, YINSH and LYNGK, a dark band (`.under`) under a cyan core (`.over`, `--matrx-mark`), so they read on the board and on light and dark pieces alike; dashed ones have each dash outlined on its own (shorter square-capped dark dashes), so what is under shows between dashes. Row rings and take/leave marks stay one-tone. The active player's tray keeps orange (`--matrx-target`), as in the other titles.
- **Push target** (`Board.svelte`, `.target`): an arrow lying on the board from the staged stack's top to near the first spot's centre (`ARROW_START`, `ARROW_REACH`), so it marks where the push goes, and a dashed ring on the first spot. Every arrow's tail is as far from its dot on screen as an upright one's, so slanted ones, which the tilt shortens less, reach as far back over the staged stack. Inputs `session.targets`. Click areas, bottom up: each first spot's (the stack there), then the stack staged on the chosen dot (nearer, so it covers them), then the arrows.
- **Move target** (`Board.svelte`): a dashed ring on an empty landing spot, or on the top face of a stack to cover; a click area the height of the stack there. Inputs `session.moveTargets`.
- **Stack ring** (`Board.svelte`, `.top-ring`, on each stack's top face, after the stack and outside the node that moves it): `role-movable` solid cyan, `role-chosen` thicker cyan, `role-target` dashed cyan, `role-row` dashed red; broken where it would cover the top disc's mark (`markGaps`), dashes fitted whole to each arc. Once a stack or dot is chosen, the other movable stacks' rings and the dot rings fade (`.faded`, 40%). Inputs `session.movable`, `session.chosenFrom`, `session.chosenDot`, `session.rows`.
- **Row marks** (`.mark-spot`, `.toggle-ring`): once a row is chosen, a spot on each top face, red going, green kept; stacks of two (which may stay) also a ring at the trough. Inputs `session.removing`, `session.keep`, `session.rowPairs`.
- **Piece** (`PieceShape.svelte`): each disc an `<image>` of its look, pre-rendered to `src/lib/images/looks/<tone>-<kind>-<turn>.webp` by `scripts/render-looks.mjs` from `DiscLook.svelte`, turned in 30° steps by the disc's id (`turnOf`; 42 looks) (geometry in `board/pieceShape.ts`; the `/looks` dev page draws them live for the script). GIPF's lathe-drawn disc with a filleted groove, each kind with its mark (TAMSK a second groove, ZÈRTZ three half-cylinder notches across the rim, DVONN a hole cut through, YINSH a channel, PÜNCT notches cut through the edge). Drawn live, the looks made opening a game and each move slow on phones. Never carries interaction state.
- **Reserve dots** (`Board.svelte`, `.reserve-dot`): each player's GIPF pieces in reserve, stacked on a dot off a corner on their side (White bottom left).
- **Board theme** (`app.css`): the board's pale grey marble, one flat colour (`--matrx-table`, `--matrx-play`) inside and outside the play area, which is bounded by the outermost grid lines; black lines and dots; white panels. As on the real board, a fine grey grid (`--matrx-fine`, `.fine`), a fifth of the spacing and lined up with the lines, covers the table, fading out beyond the board's frame, and the six triangles round E5, so the play area stands out by being plain. No intersection marks, except an optional one on E5 (`Board.svelte`, `.station`; not on the real board): a ring just wider than a piece with one as wide as TAMSK's inner groove inside it, the grid lines running through it to the inner ring, which is filled with the play area's colour to stop them, reminding that a TAMSK stack pushed there earns an extra move. It is off by default (see Board toggles).
- **Coordinate labels** (`.coordinate-label`, from `board/coordinates.ts`): each column's bottom and top point (A1…A5 to J1…J4 on the MATRX board). They can be hidden (see Board toggles).
- **Board toggles** (`OverlayToggle.svelte`, in `GameTable.svelte`'s overlay): a row of round chips at the board's bottom right, as in DVONN and TZAAR: A1 for the coordinate labels, then a two-ring icon for the E5 mark. Each is the player's own title preference (`showCoordinates`, `centreMark`), saved for the player; coordinates are on by default, the E5 mark off. On, the glyph fills in dark; off, it is a faint outline.

## 3. Layer Responsibilities

| Layer                                                 | Owns                                                                                                                                                                             | Allowed Inputs                                   | Must Not Own                |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------- |
| `MatrxGameSession`                                    | `pushKinds`, `chosenKind`, `stagedDiscs`, `entryDots`, `chosenDot`, `targets`, `movable`, `chosenFrom`, `moveTargets`, `rows`, `chosenRow`, `keep`, `removing`, staged selection | Game state, valid action types, staged selection | Styling                     |
| `Board.svelte`                                        | Mark roles per stack and dot                                                                                                                                                     | Session lists                                    | Deciding legality           |
| `BoardAnimator` (`animators/boardAnimator.svelte.ts`) | Motion for committed moves: pushes sliding in, potentials hopping, taken discs lifting, the mark layer fading with the move; the stacks drawn during a replay                    | Transition kind, `from`/`to` states, the action  | Interaction state, legality |
| `ActionPanel.svelte`, `ReserveStrip.svelte`           | Prompts, Take row and Skip buttons; the kind to bring in                                                                                                                         | Session state                                    | Board marks                 |

## 4. Shared State Contracts

- **Animation scope**: the board animates only `own-action`, `other-action`, `undo`, `history` and `exploration` transitions; page loads, server syncs and view switches show the board at rest. Every step's motion is read from the two boards (`board/boardChange.ts`), following the known push when there is one: a push slides the line, a potential's piece hops, anything else lifts the discs that leave a stack and drops those that arrive. Undo and history play it in 0.18 s. The drop of the stack staged on a dot is a local Svelte transition: it explains a choice, not a committed move.
- **Staged selection** (`selection`: `from`, `dot`, `row`, `keep`): manual choices only; a single row is derived, never stored. Cleared in `beforeNewState`, except that Undo restages the move it took back (the dot, or the stack that moved). A tap on the board that misses every enabled `role="button"` lets go of a chosen stack or dot (`letGo`); rows and keep toggles are left alone.
- **Chosen kind** (`preferredKind`): kept from turn to turn, not staged; the first kind that can come in when it cannot. Tapping the chosen dot, or the stack standing on it, again sets the next kind that can come in, in reserve order, wrapping round; with one kind (or a GIPF piece, or an extra move's TAMSK piece) it lets go of the dot instead.
- **Target lists**: derived from the displayed state; empty when the viewer cannot act, including in History View.

## 5. Forbidden Couplings

- Do not derive legality in components; read the session lists.
- Do not store derived single choices in `selection`.

## 6. Interaction Matrix

| Intent A    | Intent B    | Can coexist? | Winner / combination rule                 |
| ----------- | ----------- | ------------ | ----------------------------------------- |
| choose_dot  | choose_from | yes          | Choosing one clears the other             |
| choose_line | shape_row   | no           | Rows are taken only while no move is open |

## 7. Regression Checklist

- Push: dot drops the chosen kind; tapping it again swaps in the next kind (the old stack lifts off, the new one drops); arrows push the line one spot.
- Potential: tapping a ringed stack shows its landings; the piece hops there.
- Extra move: the TAMSK piece drops on the chosen dot; Skip takes it out of the game.
- Rows: dashed marks on every row; choosing one shows spots; tapping a stack of two toggles keep; Take row needs the row broken.
- Undo: a push returns to its dot staged, then lifts off; a potential's move hops back with its stack chosen.
- Tap-off: with a stack or dot chosen, a tap on blank board, a stack you can't move or a label lets go; tapping another stack or dot switches.
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
