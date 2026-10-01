# UI Interaction Visual Contract

This file is required for every new game UI, even if the game does not yet have complex interaction visuals.

Purpose:
- separate visual intent from implementation details
- keep layer responsibilities narrow
- prevent one highlight/dimming change from breaking another interaction

If this game has no interactive visual states yet, leave the sections below in place and note `Not yet applicable` where appropriate.

## 1. Visual Intents

List each interaction mode separately.

| Intent | Trigger | What should be emphasized | What should be dimmed | What must remain unaffected |
| --- | --- | --- | --- | --- |
| example_intent | example trigger | example emphasis | example dimming | example unaffected elements |

## 2. Visual Primitives

List the visual building blocks used by the UI.

- board spotlight mask
- invalid-area dimming
- area overlay fill
- dual outline
- piece emphasis
- card exemption cutout
- disabled/muted state

For each primitive, document:
- owner layer
- allowed inputs
- forbidden responsibilities

## 3. Layer Responsibilities

| Layer | Owns | Allowed Inputs | Must Not Own |
| --- | --- | --- | --- |
| `ExampleLayer` | example responsibility | example inputs | example forbidden scope |

## 4. Shared State Contracts

For each shared visual state:
- semantic meaning
- producer
- consumers
- permitted uses
- forbidden uses

## 5. Forbidden Couplings

- Do not reuse board spotlight state to drive piece emphasis.
- Do not reuse piece emphasis state to drive board dimming.
- Do not let one layer infer another layer's visual responsibilities.
- Do not couple mask exemption and visible overlay styling unless explicitly intended.

## 6. Interaction Matrix

| Intent A | Intent B | Can coexist? | Winner / combination rule |
| --- | --- | --- | --- |
| example_a | example_b | yes/no | describe precedence |

## 7. Regression Checklist

- verify existing highlight interactions still work
- verify existing dimming interactions still work
- verify unaffected layers remain unaffected

## 8. Change Rules

When touching interactive visuals:
1. identify the intent being changed
2. identify the primitives involved
3. verify whether shared state contracts are being widened
4. update this document if a new interaction or coupling is introduced

## 9. Status

- Interactive visual system status: `Not yet applicable` / `Initial` / `Established`
- Last updated for interaction change:
