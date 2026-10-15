# UI Interaction Visual Contract

## 1. Visual Intents

| Intent         | Trigger                                                       | What should be emphasized                                          | What should be dimmed                 | What must remain unaffected      |
| -------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------- | -------------------------------- |
| choose_marble  | Acting player may place and more than one colour is available | Selectable pool chips (amber border); the chosen chip              | Colours with none left (faded marble) | Board rings                      |
| place_marble   | A colour is chosen (manually, or the only one available)      | Every vacant ring (amber outline); hover preview of the marble     | Nothing                               | Pool counts, player trays        |
| remove_ring    | `RemovingRing` and the viewer is acting                       | Free rings (red dashed outline); hovered ring fades                | Nothing                               | Marbles, ghost positions         |
| choose_jumper  | A capture is required and no jumper is chosen                 | Marbles with a legal jump (green outline)                          | Nothing                               | Pool (inactive)                  |
| choose_landing | A jumper is chosen, or a capture chain continues              | The chosen jumper (thick green); its landing rings (green outline) | Nothing                               | Other jumpers keep their outline |

## 2. Visual Primitives

- **Ring highlight** (`Board.svelte`, `.ring-highlight`): one outline circle per interactive ring, styled by the ring's role. Inputs: the role from session targets. Must not encode game state beyond the role.
- **Placement preview** (`Board.svelte`, `.preview`): translucent marble on the hovered placement ring. Inputs: `chosenColor` and local hover. Must not appear for any other role.
- **Ghost position** (`Board.svelte`, `.ghost`): dashed outline where a ring has been removed. Inputs: layout positions minus current rings. Never interactive.
- **Pool chip** (`PoolStrip.svelte`): marble and count; selectable and chosen states.

## 3. Layer Responsibilities

| Layer              | Owns                                                                                                                          | Allowed Inputs                                      | Must Not Own      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------- |
| `ZertzGameSession` | Target lists (`placementRings`, `removableRings`, `jumpers`, `landingRings`), `chosenColor`, `chosenJumper`, staged selection | Game state, valid action types, staged selection    | Hover, styling    |
| `Board.svelte`     | Ring roles, hover key, placement preview                                                                                      | Session target lists                                | Deciding legality |
| `PoolStrip.svelte` | Pool chip states                                                                                                              | `placeableColors`, `chosenColor`, pool and captures | Board highlights  |

## 4. Shared State Contracts

- **Staged selection** (`selection`: `color`, `jumper`): manual choices only. Produced by `chooseColor` and `chooseJumper`; consumed by the session's derived `chosenColor` and `chosenJumper`. Single-option choices are derived, never stored, so Undo skips them. Cleared in `beforeNewState` for every presented transition.
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
- History View: no targets or pool interaction.

## 8. Change Rules

When touching interactive visuals:

1. identify the intent being changed
2. identify the primitives involved
3. verify whether shared state contracts are being widened
4. update this document if a new interaction or coupling is introduced

## 9. Status

- Interactive visual system status: `Initial`
- Last updated for interaction change: initial ZÈRTZ UI
