# UI Interaction Visual Contract

## 1. Visual Intents

| Intent        | Trigger                                                           | What should be emphasized                                                                                                    | What should be dimmed                       | What must remain unaffected       |
| ------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------- |
| choose_kind   | The viewer may push a piece in                                    | Reserve strip under the action panel (GIPF-piece while allowed, each kind in play loaded, plain); the chosen one ringed cyan | Kinds with none in hand                     | Board                             |
| choose_dot    | The viewer may push (a piece, or an extra move's TAMSK)           | Every dot with a legal push (cyan ring)                                                                                      | Nothing                                     | Stacks                            |
| choose_line   | A dot is chosen                                                   | The staged stack on the dot; an arrow and dashed target ring on each first spot it can push into                             | Other dots' and movable stacks' rings (40%) | Stacks                            |
| choose_from   | The viewer has loaded pieces whose potential can move             | A solid cyan ring on each such piece's top face                                                                              | Nothing                                     | Dots stay ringed                  |
| choose_target | A loaded piece is chosen                                          | Its ring thicker; dashed rings on empty landing spots and on the top face of stacks it can cover                             | Other movable stacks' and dots' rings (40%) | Stacks                            |
| choose_cover  | Its PÜNCT is sent onto a GIPF-piece with two pieces to cover from | That target's ring solid; the prompt's single / GIPF buttons                                                                 | Other targets' rings (40%)                  | Stacks                            |
| choose_row    | The viewer has rows to take, or rows of GIPF-pieces alone         | Every stack in a row's reach (dashed red ring)                                                                               | Nothing                                     | Dots, targets                     |
| shape_row     | A row is chosen                                                   | A spot on each stack's top (red goes, green stays); GIPF-pieces and loaded pieces also a toggle ring                         | Nothing                                     | Other rows keep their dashed ring |

## 2. Visual Primitives

- **Entry dot** (`Board.svelte`, `.dot.entry`, `.dot-ring`): inputs `session.entryDots`, `session.chosenDot`.
- **Choice marks** (`Board.svelte`, `.under` and `.over`): the dot rings, target rings, arrows and the movable, chosen and target stack rings are two-tone as in DVONN, YINSH and LYNGK, a dark band (`.under`) under a cyan core (`.over`, `--gp-mark`), so they read on the board and on light and dark pieces alike; dashed ones have each dash outlined on its own (shorter square-capped dark dashes), so what is under shows between dashes. Row rings and take/leave marks stay one-tone. The active player's tray keeps orange (`--gp-target`), as in the other titles.
- **Push target** (`Board.svelte`, `.target`): an arrow lying on the board from the staged stack's top to near the first spot's centre (`ARROW_START`, `ARROW_REACH`), so it marks where the push goes, and a dashed ring on the first spot. Every arrow's tail is as far from its dot on screen as an upright one's, so slanted ones, which the tilt shortens less, reach as far back over the staged stack. Inputs `session.targets`. Click areas, bottom up: each first spot's (the stack there), then the stack staged on the chosen dot (nearer, so it covers them), then the arrows.
- **Move target** (`Board.svelte`): a dashed ring on an empty landing spot, or on the top face of a stack to cover; a click area the height of the stack there. Inputs `session.moveTargets`.
- **Stack ring** (`Board.svelte`, `.top-ring`, on each stack's top face, after the stack and outside the node that moves it): `role-movable` solid cyan, `role-chosen` thicker cyan, `role-target` dashed cyan, `role-row` dashed red; broken where it would cover the top disc's mark (`markGaps`), dashes fitted whole to each arc. Once a stack or dot is chosen, the other movable stacks' rings and the dot rings fade (`.faded`, 40%). Inputs `session.movable`, `session.chosenFrom`, `session.chosenDot`, `session.rows`.
- **Row marks** (`.mark-spot`, `.toggle-ring`): once a row is chosen, a spot on each top face, red going, green kept; GIPF-pieces and loaded pieces (which may stay) also a ring at the trough. Inputs `session.removing`, `session.keep`, `session.rowKeepable`.
- **Piece** (`PieceShape.svelte`): each disc an `<image>` of its look, pre-rendered to `src/lib/images/looks/<tone>-<kind>-<turn>.webp` by `scripts/render-looks.mjs` from `DiscLook.svelte`, turned in 30° steps by the disc's id (`turnOf`; 42 looks), drawn at 4× and scaled down so the fine bands of the grooves and side blend with no steps or seams (geometry in `board/pieceShape.ts`; the `/looks` dev page draws them live for the script). GIPF's lathe-drawn disc with a filleted groove, a basic piece plain (a GIPF-piece two of them, a loaded piece one under its potential), each potential with its mark (TAMSK a second groove, ZÈRTZ three half-cylinder notches across the rim, DVONN a hole cut through, YINSH a channel, PÜNCT notches cut through the edge). Drawn live, the looks made opening a game and each move slow on phones. Never carries interaction state.
- **Board theme** (`app.css`): GIPF's board and colours: a pale blue play area (`--gp-play`) bounded by the outermost grid lines, black lines and dots, on a muted blue table (`--gp-table`, `--gp-table-deep`); dark navy panels and tabs, pale blue cards and history. No intersection marks, except an optional one on E5 (`Board.svelte`, `.station`; not on the real board): a ring just wider than a piece with one as wide as TAMSK's inner groove inside it, the grid lines running through it to the inner ring, which is filled with the play area's colour to stop them, reminding that a TAMSK-loaded piece pushed there earns an extra move. It is off by default (see Board toggles).
- **Coordinate labels** (`.coordinate-label`, from `board/coordinates.ts`): each column's bottom and top point (A1…A5 to I1…I5). They can be hidden (see Board toggles).
- **Board toggles** (`OverlayToggle.svelte`, in `GameTable.svelte`'s overlay): a row of round chips at the board's bottom right, as in DVONN and TZAAR: A1 for the coordinate labels, then, when TAMSK potentials are in the game, a two-ring icon for the E5 mark. Each is the player's own title preference (`showCoordinates`, `centreMark`), saved for the player; coordinates are on by default, the E5 mark off. On, the glyph fills in dark; off, it is a faint outline.

## 3. Layer Responsibilities

| Layer                                                 | Owns                                                                                                                                                                                                                                                | Allowed Inputs                                   | Must Not Own                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------- |
| `GipfPotentialsGameSession`                           | `kindsInPlay`, `pushKinds`, `chosenKind`, `forfeits`, `stagedDiscs`, `entryDots`, `chosenDot`, `targets`, `movable`, `chosenFrom`, `moveTargets`, `chosenTo`, `rows`, `chosenRow`, `rowKeepable`, `keep`, `removing`, `mustBreak`, staged selection | Game state, valid action types, staged selection | Styling                     |
| `Board.svelte`                                        | Mark roles per stack and dot                                                                                                                                                                                                                        | Session lists                                    | Deciding legality           |
| `BoardAnimator` (`animators/boardAnimator.svelte.ts`) | Motion for committed moves: pushes sliding in, potentials hopping, taken discs lifting, the mark layer fading with the move; the stacks drawn during a replay                                                                                       | Transition kind, `from`/`to` states, the action  | Interaction state, legality |
| `ActionPanel.svelte`, `ReserveStrip.svelte`           | Prompts, Take row, Leave, Skip and cover buttons; the kind to push in                                                                                                                                                                               | Session state                                    | Board marks                 |

## 4. Shared State Contracts

- **Animation scope**: the board animates only `own-action`, `other-action`, `undo`, `history` and `exploration` transitions; page loads, server syncs and view switches show the board at rest. Every step's motion is read from the two boards (`board/boardChange.ts`), following the known push when there is one: a push slides the line, a potential hops (a PÜNCT covering a GIPF-piece fades on landing as the covering pieces drop onto it), anything else lifts the discs that leave a stack and drops those that arrive. Undo and history play it in 0.18 s. The drop of the stack staged on a dot is a local Svelte transition: it explains a choice, not a committed move.
- **Staged selection** (`selection`: `from`, `to`, `dot`, `row`, `keep`): manual choices only; a single row that must be taken is derived, never stored. `to` holds only a GIPF-piece a PÜNCT is about to cover, waiting for one piece or two. Cleared in `beforeNewState`, except that Undo restages the move it took back (the dot, or the piece that moved, and the cover's target). A tap on the board that misses every enabled `role="button"` lets go of a chosen piece, dot or row of GIPF-pieces alone (`letGo`); rows that must be taken and keep toggles are left alone.
- **Chosen kind** (`preferredKind`): kept from turn to turn, not staged; the first kind that can come in when it cannot (never the plain piece while potentials remain, as it is listed last). Tapping the chosen dot, or the piece standing on it, again sets the next kind that can come in, in strip order, wrapping round; with one kind (or an extra move's TAMSK) it lets go of the dot instead. A plain piece staged while potentials remain says in the prompt that they will be lost (`forfeits`).
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

- Push: dot drops the chosen kind; tapping it again swaps in the next kind (the old piece lifts off, the new one drops); arrows push the line one spot.
- Potential: tapping a ringed piece shows its landings; the potential hops there. PÜNCT onto a GIPF-piece asks a single or a GIPF (straight in with one when the reserve has one), then hops and fades as they drop.
- Extra move: the TAMSK potential drops on the chosen dot; Skip takes it out of the game.
- Rows: dashed marks on every row; choosing one shows spots; tapping a GIPF-piece or loaded piece toggles keep; Take row needs a four holding a loaded piece broken; a row of GIPF-pieces alone offers Leave.
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
- Last updated for interaction change: initial GIPF with Potentials UI (from MATRX GIPF's)
