# UI Interaction Visual Contract

## 1. Visual Intents

| Intent        | Trigger                                              | What should be emphasized                                                                                                                                                                                                                       | What should be dimmed                | What must remain unaffected |
| ------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------- |
| claim_color   | The viewer may claim (one claim per turn, two total) | Claimable tokens in the color strip (amber outline)                                                                                                                                                                                             | Nothing                              | Board                       |
| choose_stack  | The viewer may move                                  | Every stack with a legal move (thin amber ring on its top face)                                                                                                                                                                                 | Nothing                              | Color strip                 |
| choose_target | A stack is chosen                                    | The chosen stack (thicker ring); every landing it can reach, directly or through LYNGK-points (dashed ring and spot); each LYNGK-point it can pass through (cyan spot), joined to the chosen stack and each other by flickering lightning bolts | Other movable stacks' rings (hidden) | Color strip                 |

## 2. Visual Primitives

- **Stack** (`StackShape.svelte`, layout in `board/pieceGeometry.ts`, colors and specks in `board/pieceStyle.ts`): discs seen at an angle (elliptical faces, `TILT`), each showing a thick band of its side so every color in the stack reads; the top face shows the moulded rim and groove. Stacks are drawn back to front. The bottom disc stays on its point as the stack grows. Flat matte color, no sheen. Specks are seeded per point and level: jokers true white and densely flecked with black, colored pieces lightly flecked, black lightly flecked with white. A stack in flight is seeded for where it lands. Never carries interaction state.
- **Stack mark** (`Board.svelte`, mark layer above the stacks): an elliptical ring on the top face's rim (0.89 of the radius, outside the groove), so marks never reach a neighbour. Two-tone, a dark band under a bright core (`--lyngk-mark`, the same bright cyan as the LYNGK-point spots), so it reads on every disc color. Solid for movable stacks (hidden once a stack is chosen; they stay tappable), thicker for the chosen stack, dashed with a centre spot for landings (thick cyan dashes, each outlined in black on every color). A LYNGK-point gets only a cyan spot (`--lyngk-link-mark`); it stays tappable as a movable stack. Inputs `session.movable`, `session.chosenFrom`, `session.landings`, `session.links`.
- **Chain bolts** (`Board.svelte`, `.bolt`, shapes from `board/lightning.ts`, links from `board/route.ts` `chainLinks`): a jagged bolt between the top faces of each link a LYNGK chain from the chosen stack can make; glow, cyan body, white core. Each bolt is one set of paths stepping through three seeded shapes in place (SMIL `animate` on `d`, 0.4 s per shape, static under reduced motion), so it flickers without ever vanishing. Drawn above the rings and below the spots, on the mark layer, so they fade with the move. Input `session.chainLinks`.
- **Color strip** (`ColorStrip.svelte`, below the action panel at constant height): the first player's claims on the left, neutral colors in the middle, the second player's claims on the right. Neutral tokens the viewer may claim are buttons with a cyan (`--lyngk-mark`) outline. On a phone each name pill sits above its claimed colors so the strip keeps its height. Input `session.claimable`.
- **Board theme** (`app.css`, `.lyngk-light` on the table): light board by default (`lightBoard` title preference, `BoardModeToggle` shows the mode a press switches to): pale play area ending at the grid's outer lines, black lines with no marks at the nodes, muted blue table. The dark board swaps the color variables.
- **Coordinate labels** (`board/coordinates.ts`): columns A–I, each labelled with its bottom and top point; the single-point side tips (A1, I1) once.

## 3. Layer Responsibilities

| Layer                                                 | Owns                                                                                                                                                                                                             | Allowed Inputs                                   | Must Not Own                |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------- |
| `LyngkGameSession`                                    | `claimable`, `paths`, `movable`, `chosenFrom`, `landings`, `links`, staged selection; a landing commits the shortest route to it                                                                                 | Game state, valid action types, staged selection | Styling                     |
| `Board.svelte`                                        | Mark roles per stack (landing over chosen over link over movable)                                                                                                                                                | Session lists                                    | Deciding legality           |
| `BoardAnimator` (`animators/boardAnimator.svelte.ts`) | Motion for committed moves: the stack flying hop by hop through its LYNGK-points to land on its target, a scored stack lifting and fading, the mark layer fading with the move; the stacks drawn during a replay | Transition kind, `from`/`to` states, the action  | Interaction state, legality |
| `ActionPanel.svelte`                                  | One-line prompt on your turn, the last move otherwise                                                                                                                                                            | Session state                                    | Board marks                 |

## 4. Shared State Contracts

- **Animation scope**: the board animates only `own-action`, `other-action`, `undo`, `history` and `exploration` transitions; page loads, server syncs and view switches show the board at rest. Without an action (undo, state-only history) the animator reads the move from the two boards (`board/inferMove.ts`, using the stack scored between the states when both points empty), finds its route again (`board/route.ts` `shortestRoute`, the route the UI commits) and flies it forward, or back retracing its LYNGK-points: 0.18 s for a direct move, 0.14 s per hop for a chain.
- **Staged selection** (`selection`: `from`): manual choices only. The route through LYNGK-points never changes the outcome, so a move is one tap on its destination. Undo lets go of the chosen stack, then undoes the last committed action; a tap on the board that hits nothing choosable (`session.letGo()`) also lets go of it. Cleared in `beforeNewState` for every presented transition.
- **Target lists**: derived from the displayed state; empty when the viewer cannot act, including in History View.

## 5. Forbidden Couplings

- Do not derive legality in components; read the session lists.

## 6. Interaction Matrix

| Intent A     | Intent B      | Can coexist? | Winner / combination rule                                                                                                                   |
| ------------ | ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| claim_color  | choose_stack  | yes          | Strip and board are different elements; claiming clears the stack selection                                                                 |
| choose_stack | choose_target | yes          | A tap on a landing lands; a tap on another movable stack (a LYNGK-point included) picks that one up instead; a tap on anything else lets go |

## 7. Regression Checklist

- Choose a stack: rings on every landing it can reach, cyan spots on the LYNGK-points; tap the chosen stack again to put it back, or tap the blank board or a stack with no move to let go.
- Lyngk chain scenario: claim black, choose E7, tap G2 (reached through E5 and G4, which show cyan spots); the stack hops through both, lifts away and scores.
- Undo after a chain: the stack flies back; no stack left hidden.
- History View: no marks or targets.

## 8. Change Rules

When touching interactive visuals:

1. identify the intent being changed
2. identify the primitives involved
3. verify whether shared state contracts are being widened
4. update this document if a new interaction or coupling is introduced

## 9. Status

- Interactive visual system status: `Initial`
- Last updated for interaction change: initial LYNGK UI
