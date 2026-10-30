# UI Interaction Visual Contract

## 1. Visual Intents

| Intent        | Trigger                                                         | What should be emphasized                                                                       | What should be dimmed | What must remain unaffected  |
| ------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------- | ---------------------------- |
| choose_kind   | The viewer may bring a stack in                                 | Reserve strip under the action panel; the chosen kind ringed                                    | Kinds with no stack   | Board                        |
| choose_dot    | The viewer may push (a stack, a GIPF piece, or an extra move)   | Every dot with a legal push (amber ring)                                                        | Nothing               | Stacks                       |
| choose_line   | A dot is chosen                                                 | The staged stack on the dot; an arrow and dashed target ring on each first spot it can push into | Nothing               | Other dots stay ringed       |
| choose_from   | The viewer has stacks of two that can move                      | A dashed amber ring on each such stack's top face                                               | Nothing               | Dots stay ringed             |
| choose_target | A stack is chosen                                               | Its ring solid; dashed rings on empty landing spots and on the top face of stacks it can cover  | Nothing               | Other movable stacks' rings  |
| choose_row    | The viewer has rows to take                                     | Every stack in a row's reach (dashed red ring)                                                  | Nothing               | Dots, targets                |
| shape_row     | A row is chosen                                                 | A spot on each stack's top (red goes, green stays); stacks of two also a toggle ring            | Nothing               | Other rows keep their dashed ring |

## 2. Visual Primitives

- **Entry dot** (`Board.svelte`, `.dot.entry`, `.dot-ring`): inputs `session.entryDots`, `session.chosenDot`.
- **Push target** (`Board.svelte`, `.target`): arrow from the chosen dot and a dashed ring on the first spot. Inputs `session.targets`.
- **Move target** (`Board.svelte`): a dashed ring on an empty landing spot, or on the top face of a stack to cover; a click area the height of the stack there. Inputs `session.moveTargets`.
- **Stack ring** (`Board.svelte`, `.top-ring`, on each stack's top face, after the stack and outside the node that moves it): `role-movable` dashed amber, `role-chosen` solid amber, `role-target` dashed amber, `role-row` dashed red. Inputs `session.movable`, `session.chosenFrom`, `session.rows`.
- **Row marks** (`.mark-spot`, `.toggle-ring`): once a row is chosen, a spot on each top face, red going, green kept; stacks of two (which may stay) also a ring at the trough. Inputs `session.removing`, `session.keep`, `session.rowPairs`.
- **Piece** (`PieceShape.svelte`, geometry in `board/pieceShape.ts`): GIPF's lathe-drawn disc with a trough, each disc carrying its kind's mark (TAMSK a second ring, ZÈRTZ three notches across the rim, DVONN a hole cut through, YINSH a raised bar, PÜNCT notches cut round the edge). Never carries interaction state.
- **Reserve dots** (`Board.svelte`, `.reserve-dot`): each player's GIPF pieces in reserve, stacked on a dot off a corner on their side (White bottom left).
- **Board theme** (`app.css`): the rulebook's pale grey marble table, a white play area bounded by the outermost grid lines, black lines and dots, white panels. No intersection marks.
- **Coordinate labels** (`.coordinate-label`, from `board/coordinates.ts`): each column's bottom and top point (A1…A5 to J1…J4 on the MATRX board).

## 3. Layer Responsibilities

| Layer                                                 | Owns                                                                                                                                                         | Allowed Inputs                                   | Must Not Own                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | --------------------------- |
| `MatrxGameSession`                                    | `pushKinds`, `chosenKind`, `stagedDiscs`, `entryDots`, `chosenDot`, `targets`, `movable`, `chosenFrom`, `moveTargets`, `rows`, `chosenRow`, `keep`, `removing`, staged selection | Game state, valid action types, staged selection | Styling                     |
| `Board.svelte`                                        | Mark roles per stack and dot                                                                                                                                 | Session lists                                    | Deciding legality           |
| `BoardAnimator` (`animators/boardAnimator.svelte.ts`) | Motion for committed moves: pushes sliding in, potentials hopping, taken discs lifting, the mark layer fading with the move; the stacks drawn during a replay | Transition kind, `from`/`to` states, the action  | Interaction state, legality |
| `ActionPanel.svelte`, `ReserveStrip.svelte`           | Prompts, Take row and Skip buttons; the kind to bring in                                                                                                     | Session state                                    | Board marks                 |

## 4. Shared State Contracts

- **Animation scope**: the board animates only `own-action`, `other-action`, `undo`, `history` and `exploration` transitions; page loads, server syncs and view switches show the board at rest. Every step's motion is read from the two boards (`board/boardChange.ts`), following the known push when there is one: a push slides the line, a potential's piece hops, anything else lifts the discs that leave a stack and drops those that arrive. Undo and history play it in 0.18 s. The drop of the stack staged on a dot is a local Svelte transition: it explains a choice, not a committed move.
- **Staged selection** (`selection`: `from`, `dot`, `row`, `keep`): manual choices only; a single row is derived, never stored. Cleared in `beforeNewState`, except that Undo restages the move it took back (the dot, or the stack that moved).
- **Chosen kind** (`preferredKind`): kept from turn to turn, not staged; the first kind that can come in when it cannot.
- **Target lists**: derived from the displayed state; empty when the viewer cannot act, including in History View.

## 5. Forbidden Couplings

- Do not derive legality in components; read the session lists.
- Do not store derived single choices in `selection`.

## 6. Interaction Matrix

| Intent A    | Intent B    | Can coexist? | Winner / combination rule                                   |
| ----------- | ----------- | ------------ | ----------------------------------------------------------- |
| choose_dot  | choose_from | yes          | Choosing one clears the other                               |
| choose_line | shape_row   | no           | Rows are taken only while no move is open                   |

## 7. Regression Checklist

- Push: dot drops the chosen kind; arrows push the line one spot.
- Potential: tapping a ringed stack shows its landings; the piece hops there.
- Extra move: the TAMSK piece drops on the chosen dot; Skip takes it out of the game.
- Rows: dashed marks on every row; choosing one shows spots; tapping a stack of two toggles keep; Take row needs the row broken.
- Undo: a push returns to its dot staged, then lifts off; a potential's move hops back with its stack chosen.
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
