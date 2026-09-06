# Politics card interactions

## Visual intents

- **Inspect a pile:** choosing a politics pile deals its faces into the inspector's available row width. Once the deal finishes, each occurrence is an independent button, including identical cards. Pointer, touch, and keyboard activation use the same selection path.
- **Take a card:** the clicked occurrence moves to the center while the other occurrences collapse. Further selections are disabled until the action finishes or fails. The pile closes after a successful take; the hand gains one card.
- **Arm a card from hand:** Alliance and Renegade begin their existing targeting flows. Treasure adds one printed value to the pending bid or arms one payment for a wooded knight placement. Identical faces remain interchangeable; an active badge represents one selected occurrence, not every matching copy.

## Coexistence and precedence

The deal and the interactive pile are mutually exclusive render phases. Taking is only available after the deal. The pile's pending selection suppresses repeated activation. Alliance and Renegade targeting cancel one another. Knight payment and duel bidding belong to different game phases; a duel may arm several treasures, including repeated values in development fixtures.

## Shared visual state

The selected pile occurrence is a local array index shared by the pile component and its take animator. It only selects the node to emphasize; the Action contains the card face. The index is valid against the displayed source pile and is cleared when submission settles or the animator detaches. Replay without a local selection emphasizes the first matching face.

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

Hosted checks additionally use separate owner, opponent, and spectator accounts. Inspection faces and their history appear only for the inspector; reload preserves the snapshot, taking adds one card, Undo restores selection, and ordinary Exploration populates a complete hypothetical state. Admin Host View and Exploration retain complete-state access.
