# UI Interaction Visual Contract

## 1. Visual Intents

| Intent         | Trigger                                                       | What should be emphasized                                          | What should be dimmed                 | What must remain unaffected      |
| -------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------- | -------------------------------- |
| choose_marble  | Acting player may place and more than one colour is available | Selectable pool chips (amber border); the chosen chip              | Colours with none left (faded marble) | Board rings                      |
| place_marble   | A colour is chosen (manually, or the only one available)      | Every vacant ring (amber outline); hover preview of the marble     | Nothing                               | Pool counts, player trays        |
| remove_ring    | `RemovingRing` and the viewer is acting                       | Free rings (white dashed outline); hovered ring fades              | Nothing                               | Marbles, ghost positions         |
| choose_jumper  | A capture is required and no jumper is chosen                 | Marbles with a legal jump (green outline)                          | Nothing                               | Pool (inactive)                  |
| choose_landing | A jumper is chosen, or a capture chain continues              | The chosen jumper (thick green); its landing rings (green outline) | Nothing                               | Other jumpers keep their outline |

## 2. Visual Primitives

- **Ring highlight** (`Board.svelte`, `.ring-highlight`): one outline circle per interactive ring, styled by the ring's role, on its own layer above the rings so a sinking ring leaves its outline in place. The `BoardAnimator` fades the whole outline layer on the move's timeline, for as long as the move animates (at least 0.28s; 0.18s without an action), so a removed ring's outline fades while the ring sinks. The layer is keyed on the displayed state, so each new position gets a fresh layer whose outlines fade in (0.12s). Inputs: the role from session targets, hover and keyboard focus. Must not encode game state beyond the role.
- **Placement preview** (`Board.svelte`, `.preview`): translucent marble on the hovered placement ring. Inputs: `chosenColor` and local hover. Must not appear for any other role.
- **Ghost position** (`Board.svelte`, `.ghost`): dashed outline where a ring has been removed. Inputs: layout positions minus current rings. Never interactive.
- **Sinking ring** (`Board.svelte`, the shared `ringShadow` snippet): a removed ring keeps the soft drop shadow it cast on the board, under its ghost dashes, for every ring taken off during the latest turn that took any: the removed ring, any group it cut off, and any group claimed by a placement that turn. A later turn that takes rings replaces them, the old shadows fading while the new rings sink; a capture-only turn leaves them. Inputs: `session.sinkingRings`, derived from the actions up to the displayed state's `actionCount` (the actions list moves ahead as soon as an action is taken, before its animation has played). Never interactive.
- **Coordinate labels** (`Board.svelte`, `.coordinate-labels`, from `board/coordinates.ts`): each column's bottom and top ring names below and above it, BoardSpace style (A1 under the bottom-left ring, A4 over the top-left). Drawn from the setup's full layout, so they stay put as rings are removed. Shown while the `showCoordinates` title preference is on (an `OverlayToggle` in the board overlay). Never interactive.
- **Water** (`app.css` `.zertz-water`): matte #0f527c. Full screen redraws the same layer. Never interactive.
- **Each-colour outline** (`PlayerTray.svelte`, `.trio`): rounded outline around the first `eachColor` slots of every tray row; lit (`.met`) once that colour reaches the each-colour target. Reflects captures only.
- **Shadows** (`Board.svelte`, `.ring-shadow`, `.shadow`): blurred on their own layer and circles so rings and marbles are never rasterised through a filter and stay sharp when zoomed.
- **Pool chip** (`PoolStrip.svelte`): marble and count; selectable and chosen states.
- **Marble** (`MarbleDefs.svelte` + `MarbleShape.svelte`, styled from `board/marbleStyle.ts`): body gradient, speckles (white on black, black on grey) and sheen. The board and every icon draw marbles through these, so a style change lands everywhere. Never carries interaction state.

## 3. Layer Responsibilities

| Layer                                                 | Owns                                                                                                                                                          | Allowed Inputs                                      | Must Not Own                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------- |
| `ZertzGameSession`                                    | Target lists (`placementRings`, `removableRings`, `jumpers`, `landingRings`), `chosenColor`, `chosenJumper`, staged selection                                 | Game state, valid action types, staged selection    | Hover, styling              |
| `Board.svelte`                                        | Ring roles, hover key, placement preview                                                                                                                      | Session target lists                                | Deciding legality           |
| `BoardAnimator` (`animators/boardAnimator.svelte.ts`) | Motion for committed transitions: ring sinking, marble jump (a flier above the board), captured/claimed marble lift and fade; the rings drawn during a replay | Transition kind, `from`/`to` states, the action     | Interaction state, legality |
| `PoolStrip.svelte`                                    | Pool chip states                                                                                                                                              | `placeableColors`, `chosenColor`, pool and captures | Board highlights            |

## 4. Shared State Contracts

- **Animation scope**: the board animates only `own-action`, `other-action`, `undo`, `history` and `exploration` transitions; page loads (`initial`), server syncs (`reconciliation`), view switches and edits show the board at rest. Without an action (undo, state-only history) the animator reads a jump from the two boards (`board/inferJump.ts`) and flies it; other removed rings and vanished marbles fade, all within 0.18s.

- **Staged selection** (`selection`: `color`, `jumper`): manual choices only. Produced by `chooseColor` and `chooseJumper`; consumed by the session's derived `chosenColor` and `chosenJumper`. Single-option choices are derived, never stored, so Undo skips them. Cleared in `beforeNewState` for every presented transition. A tap on the board that misses every `.interactive` ring or marble clears it through `letGo`.
- **Target lists**: derived from the displayed state; empty when the viewer cannot act, including in History View.

## 5. Forbidden Couplings

- Do not derive legality in components; read the session target lists.
- Do not store auto-selected colours or jumpers in `selection`.
- Do not let hover state change anything but the hovered ring's outline and the placement preview.

## 6. Interaction Matrix

| Intent A       | Intent B      | Can coexist? | Winner / combination rule                                                    |
| -------------- | ------------- | ------------ | ---------------------------------------------------------------------------- |
| remove_ring    | place_marble  | no           | Different machine states                                                     |
| choose_jumper  | place_marble  | no           | A required capture disables placement                                        |
| choose_landing | choose_jumper | yes          | Landing rings are vacant and jumpers are occupied, so no ring has both roles |

## 7. Regression Checklist

- Placement: choosing a colour highlights vacant rings; hover shows the preview; Undo clears a manual colour.
- Removal: only free rings are outlined after a placement.
- Capture: jumpers outlined; choosing one shows its landings; a chain fixes the jumper.
- Tap-off: a tap on the board off every target lets go of a chosen colour or jumper; tapping another jumper switches.
- History View: no targets or pool interaction.
- Animation: placing never animates; removal sinks; a jump flies above other rings; reloading or opening a game shows no motion.

## 8. Change Rules

When touching interactive visuals:

1. identify the intent being changed
2. identify the primitives involved
3. verify whether shared state contracts are being widened
4. update this document if a new interaction or coupling is introduced

## 9. Status

- Interactive visual system status: `Initial`
- Last updated for interaction change: initial ZÈRTZ UI
