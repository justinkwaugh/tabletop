# UI Interaction Visual Contract

## 1. Visual Intents

| Intent         | Trigger                                                                          | What should be emphasized                                                   | What should be dimmed                 | What must remain unaffected      |
| -------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------- | -------------------------------- |
| choose_marble  | Acting player may place and more than one colour is available                    | Selectable pool chips (amber border); the chosen chip                       | Colours with none left (faded marble) | Board rings                      |
| place_marble   | A colour is chosen (manually, or the only one available) and no marble is staged | Every vacant ring (amber outline); hover preview of the marble              | Nothing                               | Pool counts, player trays        |
| remove_ring    | A marble is staged in its ring (`chosenPlace`)                                   | The rings free once it is placed (white dashed outline); hovered ring fades | Nothing                               | Marbles, ghost positions         |
| change_staged  | A marble is staged and another colour could be placed                            | The staged marble's ring (solid amber outline)                              | Nothing                               | Free rings keep their outline    |
| choose_jumper  | A capture is required and no jumper is chosen                                    | Marbles with a legal jump (green outline)                                   | Nothing                               | Pool (inactive)                  |
| choose_landing | A jumper is chosen, or a capture chain continues                                 | The chosen jumper (thick green); its landing rings (green outline)          | Nothing                               | Other jumpers keep their outline |

## 2. Visual Primitives

- **Ring highlight** (`Board.svelte`, `.ring-highlight`): one outline circle per interactive ring, styled by the ring's role, on its own layer above the rings so a sinking ring leaves its outline in place. The `BoardAnimator` fades the whole outline layer on the move's timeline, for as long as the move animates (at least 0.28s; 0.18s without an action), so a removed ring's outline fades while the ring sinks. The layer is keyed on the displayed state, so each new position gets a fresh layer whose outlines fade in (0.12s). Inputs: the role from session targets, hover and keyboard focus. Must not encode game state beyond the role.
- **Placement preview** (`Board.svelte`, `.preview`): translucent marble on the hovered placement ring. Inputs: `chosenColor` and local hover. Must not appear for any other role.
- **Ghost position** (`Board.svelte`, `.ghost`): dashed outline where a ring has been removed. Inputs: layout positions minus current rings. Never interactive.
- **Sinking ring** (`Board.svelte`, the shared `ringShadow` snippet): a removed ring keeps the soft drop shadow it cast on the board, under its ghost dashes, for every ring taken off during the latest turn that took any: the removed ring, any group it cut off, and any group claimed by a placement that turn. A later turn that takes rings replaces them, the old shadows fading while the new rings sink; a capture-only turn leaves them. Inputs: `session.sinkingRings`, derived from the actions up to the displayed state's `actionCount` (the actions list moves ahead as soon as an action is taken, before its animation has played). Never interactive.
- **Coordinate labels** (`Board.svelte`, `.coordinate-labels`, from `board/coordinates.ts`): each column's bottom and top ring names below and above it, BoardSpace style (A1 under the bottom-left ring, A4 over the top-left). Drawn from the setup's full layout, so they stay put as rings are removed. Shown while the `showCoordinates` title preference is on (an `OverlayToggle` in the board overlay). Never interactive.
- **Board view** (`board/geometry.ts` `BoardView`): always seen from the side of the table (`TILT` 0.75), rings as hollow cones and marbles above them. The straight-down view and its Tilt toggle were removed; to bring them back, restore from commit `13ba7e438`.
- **Board toggles** (`OverlayToggle.svelte`, in `GameTable.svelte`'s overlay): a row of round chips at the board's top right: two turning arrows for the far side, the board seen half a turn round (`viewOf(true)`), with each label still beyond its column's end; then A1 for the coordinate labels. Each is the player's own title preference (`turned`, `showCoordinates`); the far side is off by default, coordinates on. Each chip's hover text says what a press does now.
- **Water** (`app.css` `.zertz-water`): matte #0f527c. Full screen redraws the same layer. Never interactive.
- **Each-colour outline** (`PlayerTray.svelte`, `.trio`): rounded outline around the first `eachColor` slots of every tray row; lit (`.met`) once that colour reaches the each-colour target. Reflects captures only.
- **Shadows** (`Board.svelte`, `zertz-ring-shadow` and `zertz-marble-shadow` gradients from `board/softShadow.ts`): radial-gradient fills whose stops follow the edge a 2.5-unit Gaussian blur gives, rather than a blur filter, which is slow to paint on phones and can leave a removed shape's pixels on screen in WebKit. Rings and marbles above them stay sharp when zoomed.
- **Staged marble** (`StagedMarble.svelte`, motion from `animators/drop.ts`): the marble you are placing, standing in the ring you chose until you choose a ring to remove. It drops in as it is drawn, unless Undo took it back out there; taken back, it lifts out (0.18s); when the move goes in it steps aside without lifting and the board's own marble takes its place. Keyed by colour, so a colour change lifts one out as the next drops in. Inputs: `chosenPlace`, `chosenColor`, the animator's `placedIn` and `returned`.
- **Pool chip** (`PoolStrip.svelte`): marble and count; selectable and chosen states.
- **Marble** (`MarbleDefs.svelte` + `MarbleShape.svelte`, styled from `board/marbleStyle.ts`): body gradient, speckles (white on black, black on grey) and sheen. The board and every icon draw marbles through these, so a style change lands everywhere. Never carries interaction state.

## 3. Layer Responsibilities

| Layer                                                 | Owns                                                                                                                                                                                                                                                          | Allowed Inputs                                      | Must Not Own                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------- |
| `ZertzGameSession`                                    | Target lists (`placementRings`, `removableRings`, `jumpers`, `landingRings`), `chosenColor`, `chosenPlace`, `chosenJumper`, staged selection, the move being undone                                                                                           | Game state, valid action types, staged selection    | Hover, styling              |
| `Board.svelte`                                        | Ring roles, hover key, placement preview                                                                                                                                                                                                                      | Session target lists                                | Deciding legality           |
| `BoardAnimator` (`animators/boardAnimator.svelte.ts`) | Motion for committed transitions: ring sinking, marble jump (a flier above the board), captured/claimed marble lift and fade; the rings drawn during a replay; whether the staged marble went in (`placedIn`) or came back (`returned`) until the state lands | Transition kind, `from`/`to` states, the action     | Interaction state, legality |
| `PoolStrip.svelte`                                    | Pool chip states                                                                                                                                                                                                                                              | `placeableColors`, `chosenColor`, pool and captures | Board highlights            |

## 4. Shared State Contracts

- **Animation scope**: the board animates only `own-action`, `other-action`, `undo`, `history` and `exploration` transitions; page loads (`initial`), server syncs (`reconciliation`), view switches and edits show the board at rest. Without an action (undo, state-only history) the animator reads a jump from the two boards (`board/inferJump.ts`) and flies it; other removed rings and vanished marbles fade, all within 0.18s.

- **Staged selection** (`selection`: `color`, `place`, `jumper`): manual choices only. Produced by `chooseColor`, `chooseRing` (a vacant ring stages `place`), `changeStagedColor` and `chooseJumper`; consumed by the session's derived `chosenColor`, `chosenPlace` and `chosenJumper`. Single-option choices are derived, never stored, so Undo skips them. Cleared in `beforeNewState` for every presented transition, except that an Undo of a move with a removal restages its marble (`undoingMove`, `restagedZertzSelection`), its colour too when there was a choice. A tap on the board that misses every `.interactive` ring or marble, an unremovable ring included, takes a staged marble off its ring through `letGo`, or else lets go of a chosen colour or jumper.
- **One move**: placing and removing a ring is one `PlaceMarble` action, sent when the ring to remove is chosen. A placement that leaves no ring to remove, or ends the game, is sent as soon as its ring is chosen (`removableAfterPlacing` from the logic package decides). Choosing the staged marble again, or another pool colour, changes its colour in place.
- **Target lists**: derived from the displayed state; empty when the viewer cannot act, including in History View.

## 5. Forbidden Couplings

- Do not derive legality in components; read the session target lists.
- Do not store auto-selected colours or jumpers in `selection`.
- Do not let hover state change anything but the hovered ring's outline and the placement preview.

## 6. Interaction Matrix

| Intent A       | Intent B      | Can coexist? | Winner / combination rule                                                    |
| -------------- | ------------- | ------------ | ---------------------------------------------------------------------------- |
| remove_ring    | place_marble  | no           | Staging a marble replaces the placement targets with the removal targets     |
| choose_jumper  | place_marble  | no           | A required capture disables placement                                        |
| choose_landing | choose_jumper | yes          | Landing rings are vacant and jumpers are occupied, so no ring has both roles |

## 7. Regression Checklist

- Placement: choosing a colour highlights vacant rings; hover shows the preview; choosing a ring stages the marble there (it drops in) and sends nothing; Undo takes it off, then clears a manual colour.
- Removal: only rings free once the staged marble is placed are outlined; choosing one sends the whole move.
- Staged colour: tapping the staged marble, or another pool chip, changes its colour in place.
- Undo of a move: the board returns and the marble stands staged in its ring again, without dropping.
- Capture: jumpers outlined; choosing one shows its landings; a chain fixes the jumper.
- Tap-off: a tap on the board off every target takes a staged marble off its ring, or lets go of a chosen colour or jumper; tapping another jumper switches.
- History View: no targets or pool interaction.
- Animation: a staged marble drops in, and does not drop again when the move goes in; removal sinks; a jump flies above other rings; reloading or opening a game shows no motion.

## 8. Change Rules

When touching interactive visuals:

1. identify the intent being changed
2. identify the primitives involved
3. verify whether shared state contracts are being widened
4. update this document if a new interaction or coupling is introduced

## 9. Status

- Interactive visual system status: `Initial`
- Last updated for interaction change: initial ZÈRTZ UI
