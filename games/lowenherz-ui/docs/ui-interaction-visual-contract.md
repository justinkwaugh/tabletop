# Politics card interactions

## Visual intents

- **Inspect a pile:** choosing a politics pile deals its faces into the inspector's available row width. Once the deal finishes, each occurrence is an independent button, including identical cards. Pointer, touch, and keyboard activation use the same selection path.
- **Take a card:** the clicked occurrence moves to the center while the other occurrences collapse. Further selections are disabled until the action finishes or fails. The pile closes after a successful take; the hand gains one card.
- **Arm a card from hand:** Alliance and Renegade begin their existing targeting flows. Treasure adds one printed value to the pending bid or arms one payment for a wooded knight placement. Identical faces remain interchangeable; an active badge represents one selected occurrence, not every matching copy.

## Coexistence and precedence

The deal and the interactive pile are mutually exclusive render phases. Taking is only available after the deal. The pile's pending selection suppresses repeated activation. Alliance and Renegade targeting cancel one another. Knight payment and duel bidding belong to different game phases; a duel may arm several treasures, including repeated values in development fixtures.

## Shared visual state

The selected pile occurrence is a local array index shared by the pile component and its take animator. It only selects the node to emphasize; the Action contains the card face. The index is valid against the displayed source pile and is cleared when submission settles or the animator detaches. Replay without a local selection emphasizes the first matching face.

Hovering or touch-holding a face-up card shows a magnified copy. The magnifier shares its anchor element and scale with the session, so taking that rendered occurrence transfers the enlarged view into the take animation. This reference identifies only a mounted element, never a card in game state, and clears on release or unmount. Identical faces and separate views of the same card therefore remain independent.

The session supplies the measured row width and click origin for the deal. Both transient and interactive layouts use the same slot calculation. Reloading into an inspection can render the cards directly after measuring, without a prior click origin.

Committed actions use the shared animation timeline. Actionless History navigation and Undo use the existing fast fallback, at most 200 ms; silent restoration contributes no animation. Restored inspections remain selectable. Hand keys and jitter belong to local rendering slots and never enter Game State, Action payloads, or saved History.

## Render ownership

Both pile animators and settled selection read the owner's inspection snapshot, including the `from` snapshot when taking removes it. They never read the canonical hidden pile. Opponents render one unknown card back per public hand count; no invented face enters state or history. The public final-hand snapshot supplies endgame faces. Pending opponent bids render as sealed submissions; resolved-round summaries use the complete public reveal.

The pile reveal owns both the transient deal and the settled buttons. Its animators target those nodes by local occurrence index, with the chosen node above the collapsing cards. Node maps and transient layout references clear on detach. The hand panel owns its grouped cards and active badges; the session owns targeting and pending treasure quantities.

## Verification scenarios

Browser checks use the local harness and controlled complete states:

1. Open a pile containing duplicate Alliance cards, activate the second occurrence, and verify that occurrence receives the spotlight, only one Action is submitted, and one copy moves to the hand.
2. Undo the take and navigate History backward/forward. The restored pile contains both copies and can be selected again; ordinary navigation does not play the long spotlight.
3. Replace or reload the view during an inspection. Card buttons have independent nodes and no stale disabled state or duplicate-key error remains.
4. Arm two treasures with the same value, remove one bid chip, and verify one commitment remains. Submitting sends numeric values with the correct multiplicity.

Rule tests separately verify one-copy consumption for taking, Alliance/Renegade plays, bid ownership, and forward continuation from legacy saves.

Hosted checks additionally use separate owner, opponent, and spectator accounts. Inspection faces and their history appear only for the inspector; reload preserves the snapshot, taking adds one card, Undo restores selection, and ordinary Exploration populates a complete hypothetical state. Admin Host View retains complete-state access. Exploration is unavailable with Public Money off, including from Host View and legacy Games.

## Private money

With Public Money off, player panels show the owner’s balance and question marks for other balances during play. EndOfGame reveals all balances. This rendering rule also applies to complete hotseat and legacy representations; protected network projections omit other balances entirely.

Negotiation amount controls cap only publicly displayed balances or the acting player’s own balance. A demand against an opponent’s private balance has no balance-derived cap; the payer must afford any amount they personally propose or accept. Duel controls and knight/alliance costs use the acting player’s known money.

The session disables Exploration when Game configuration or the recorded state flag makes money private. This includes Host View and legacy Games. Public-money Exploration keeps the existing card population behavior.

# Breaking an alliance

## Visual intents

- **Alliance markers:** two small drawn hearts on every wall along an allied border. Hearts beat slowly only for a viewer who could break that alliance right now (participant, active, in a state that accepts `CancelAlliance`, holding 10 ducats); otherwise they sit still.
- **Offer:** a pink "Break alliance?" pill, in the town-name pill's style, appears just off the border after the board's hover-intent delay while the pointer rests within half a cell of any of the alliance's walls. Tapping or focusing the hearts arms the same offer immediately, for touch and keyboard. Hovering the pill itself holds it open.
- **Break:** one click on the pill submits `CancelAlliance`; the hearts burst. Once the burst has finished and the visible state has settled, the status window announces "[breaker] broke an alliance with [other] and paid 10 ducats." to every viewer until the breaker is no longer an active player; the breaker's own later actions do not clear it.
- **Form:** playing an Alliance card is announced the same way - "[player] played an Alliance card on [other]." - once the hearts have bounced in, including when the play was auto-selected because only one target was legal. Both sentences are the history feed's own `ActionDescription`, so status and history never disagree.

## Coexistence and precedence

Only cancellable alliances are offered. When several are within radius the nearest wall wins. The pill sits above the hearts and other overlay glyphs. The offer never stages anything: `Back` has nothing to clear and `Undo` reverses the committed action as usual.

## Shared visual state

The offered alliance is local to the board: derived from the tracked pointer position, the pill's own hover, and an armed id written by tapping or focusing the hearts. The armed id is a writable derived that returns to nothing whenever `updatingVisibleState` flips, and is also cleared when focus leaves the alliance's controls or a pointer press lands outside them. Nothing about the offer enters game state or history.

The status column reserves two lines (77 px: the prompt line, the column gap, and the alliance/history line) and centres a lone line in that box, so forming or breaking an alliance never moves the board. Content taller than two lines (negotiation, duel controls, wrapped prompts, history entries, errors) still eases the column's measured height over 200 ms. Below the column, the politics deck chooser and pile reveal share one eased slot that holds a card row for the whole of the taker's politics turn, so the board slides down once when the decks appear, stays still through the chooser-to-reveal handoff and the choice, and slides back once the taken card is away. That easing (`EasedHeight.svelte`) is local layout settling with no coordination contract: nothing waits on it, it depicts no action, and the first measurement (mount, silent restore) snaps because browsers do not interpolate from `height: auto`. One known residual: a mid-session silent swap (a representation switch, or the history replay-range flow's silent jump and return) can still ease these containers over 200 ms if their content height changes at that instant, because the shared session keeps the history animation intent private and clears it before publishing state. Accepted as-is; closing it would need a read-only intent signal on `GameSession` in `frontend-components`.

## Verification scenarios

1. With a cancellable alliance, rest the pointer near its border and verify the pill appears after the delay, stays open while hovered, and breaks the alliance on click with the burst and status message.
2. Sweep the pointer across the border without resting and verify nothing appears.
3. Tab to the hearts and verify the pill appears at once and can be reached with the next Tab; tabbing away hides it.
4. As the other participant or a spectator, verify the hearts are inert and the status message still reads correctly after the break.
