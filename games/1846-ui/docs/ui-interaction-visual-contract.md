# Private distribution interaction

## Visual intents

The initial view conceals draft packets and commitments behind **Show my cards**.
The named player explicitly opens their packet, then chooses a card with a click,
tap, or keyboard activation. **Hide cards** immediately conceals both packet and
commitments. Each card submits one complete Action; there is no staged selection.
The last company's identity and price are public and bypass this cover. Players
can still show and hide their prior commitments while deciding on that offer;
hiding private cards never hides the public offer or its buy/pass controls.

## Coexistence and precedence

State publication and perspective changes invalidate an opened packet. A prior
player's reveal never opens another player's packet. Read-only History permits
inspection of that perspective's known cards but disables all purchase controls.
The first-stock-round handoff shows public purchases instead of draft controls.

## Shared visual state

The Game Session owns whether the current packet is open. Its key includes state
identity, action count, and player perspective; beforeNewState closes it before
publication. Pending transitions hide it immediately. Action submission closes
it even if submission fails; the player can explicitly reopen after a failure.
No private values are copied into UI state or persisted as display preferences.

## Render ownership

The title table renders the cover, packet, commitments, and public final offer.
Common owns the toolbar, perspectives, History, and recorded Action undo rules.
Every draft choice is an information barrier because it reveals the next packet;
mechanical reversal remains available to the runtime for history reconstruction.

## Verification scenarios

- Open a packet, choose a card: the next player sees a cover, not their cards.
- Open then hide: packet and commitments both disappear.
- Change History position or perspective while open: cover returns; History
  purchase controls stay disabled.
- Opponent/spectator delivery contains neither packet nor commitments; public
  final-offer and final purchase summaries remain visible.
- Reach the final-company offer with earlier commitments: show and hide those
  commitments while the public offer and buy/pass controls stay visible. Passing
  closes the private view before handing play to the next player. Verified
  manually in the development harness.
- Finish distribution: purchases, funded independents, and Priority Deal are
  shown; no finished-game result is fabricated.
- Narrow viewport: cards wrap and retain keyboard/touch targets.

Projection and full-draft replay are covered by logic tests. Interactive checks
use the protected development harness and ordinary hotseat.

## First stock round

Distribution automatically hands control to Priority Deal. Stock controls show
legal launch prices, purchases by source, sales by quantity, and Finish/Pass.
These are immediate committed Actions; there is no local selection or Back step.
History disables trading. Undo uses the Game Session's committed action history,
including automatic flotation/round-completion consequences. Public corporation
cash, prices, presidency and holdings are shown during and after trading. The
prototype continues into the first independent’s construction step. Each company’s
shares are sold as a single complete block; automatic closures have their own
System Action with semantic metadata.


## Board and construction

The boardless view is built from the shared map and tile renderers. Declared
board areas hold the market and phase-I depot outside map hexes. No physical
artwork view is claimed. Selection highlights and all token/track positions use
the logical map identities; the board and picker share tile definitions.

A selected hex is a manual local selection owned by the title session. Only the
acting player in the live track step can select; stock rounds, completed steps,
History, spectators and pending transitions cannot create a construction selection.
Leaving that interaction clears its selection. There is no automatic selection.
The map or hex selector sets it; Back clears it. Tile
buttons show a complete orientation and its evaluated cost, and commit a LayTile
Action through the session. Undo clears a manual selection first; otherwise it
reverses the committed action and its automatic consequences. Before state
publication, on a perspective change, or when history changes action position,
the selection and choices disappear. History keeps the board inspectable and
disables tile commitments and Finish. The first operating turn ends this slice
at ReadyForRoutes after FinishTrack; there is no fake route or operating completion.

Verification: select a legal hex and Back; select a hex and Undo without changing
history; commit a lay and Undo to restore cash and supply; navigate History to
check controls are disabled; confirm selected tile orientation matches the board.
During a stock round, commit a purchase, click a board hex, then Undo: the purchase
is reversed immediately. After FinishTrack, clicking the board must likewise not
intercept committed-action Undo.

Verified in the development harness: launch NYC, click the board, and Undo restores
the launch choice; select C13 during construction and Undo clears its choices
without leaving the track step; FinishTrack, click the board, and Undo returns to
construction immediately. Type checks, lint, and the UI package build pass.
