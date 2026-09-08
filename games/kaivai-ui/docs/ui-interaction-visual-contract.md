# Kaivai interaction and board motion

## Visual intents

- **Action selection:** a single available staged action, or the current build/move/deliver/fish continuation, is selected automatically. Choosing among actions is manual. Automatic selection changes only the draft; it never submits an Action.
- **Action panel continuity:** the current action and its draft controls remain visible, disabled, throughout a committed animation. Draft choices clear when the resulting Displayed Game State is published. Initial hut placement returns directly to the hut choices without an empty panel in between. Undo is the single control for reversing manual choices and committed Actions; there is no separate Back button.
- **Boat destination preview:** Build and Deliver relocate the chosen boat to an empty destination while the remaining draft is completed. Cancel returns it to its source. Move and Fish commit directly from the destination click; they do not start a competing preview. When the destination is occupied, both boats stay in their current cells until the move commits.
- **Committed board motion:** a boat that remains in State and changes coordinates uses FLIP, preserving its identity and owner color. A newly added boat scales/fades in; a removed boat scales/fades out in place without FLIP. A new boat and its boat-building tile appear together. Reversing that placement scales/fades both out together. Fishing huts and their fishermen also share one appearance/removal tween. Sinking removes the opponent's boat as the incoming boat arrives.
- **Fisherman God:** first placement scales/fades the god and new cult tile in together. Undo removes both together. Subsequent placement moves the god between cells while its new tile appears; Undo moves the god back while removing that tile. Piece/tile scale-fades take 100ms; movement takes 200ms.
- **Undo and History:** reversing a move returns the moving boat to its source. Reversing a sink also restores the sunk boat at the destination with its original identity and color. State-only navigation uses a direct transition of at most 200ms. Full-action replay processes each Action separately. Silent restoration swaps placements without motion.

## Coexistence and precedence

A committed transition takes ownership of boat presentation before the draft is reset. Its explicit placements override destination previews until the new Displayed Game State is published. Clearing the draft during that interval must not move a boat back to its former cell or remove an incoming boat.

An incoming and departing boat may occupy the same cell during sinking or reversal. They remain separate keyed elements. Neither may borrow the other's color, transition key, or element reference.

Cells render in three board-wide passes: tiles; stationary pieces, fish overlays, and interaction masks; then raised pieces. Island outlines render between the masks and raised pieces, keeping the entire border visible over masked water without intercepting clicks. A selected boat stays in the raised layer before and after its destination preview. Moving boats and the god also use that layer, so motion stays above every tile and mask regardless of cell iteration order. When a piece is neither selected nor moving, it returns to its normal masked layer. Final-scoring visibility applies to all passes. Boat motion does not change which board targets are legal. Interaction remains blocked while the session is busy.

## Shared visual state

The island bid amount is local to the action panel's current bidding player and island. Changing player, changing island, leaving bidding, or entering History resets it to zero. State updates that keep the same player and island eligible to bid preserve their unsubmitted amount.

Manual selection uses the shared staged-selection helpers, ordered as action, boat, destination, hut, deliveries, and delivery location. Hut and delivery stages belong to separate action branches. Selecting an earlier stage clears later stages. Undo removes the latest manual stage first; removing a destination also animates the previewed boat back. Once no manual stages remain, Undo reverses committed history without consuming the derived automatic action. Undo is available for manual choices even before the first committed Action. State transitions clear manual selections before the new state becomes interactive.

Boat, god, and tile presentation is owned by the session's board animator and consumed by each cell. During a committed transition it contains the resulting placements plus any departing pieces and tiles needed for disappearance. Departures are removed after that Action's animation, so they do not accumulate across replayed Actions. The overrides expire when Displayed Game State changes, including silent restoration. Outside a committed transition, boat placement is derived from Game State and the current local destination preview. Cell interaction eligibility continues to read Displayed Game State, independently of the presentation override.

## Render ownership

Cells own keyed piece glyphs at their world positions. Their centered wrappers own movement transforms, scale, and opacity; the enclosing cell owns world placement. A separate centered tile wrapper owns tile/fisherman scale and opacity, with artwork rotation on an inner wrapper. The animator implements FLIP in the board's SVG coordinate space: capture the piece origin, render its destination, invert the displacement into its new local coordinates, then tween that displacement to zero. Page layout shifts and board scaling never enter the captured coordinates, and stationary pieces receive no movement tween. Movement and appearance start together on the shared Action timeline at position zero.

Local destination previews use a cancellable movement timeline owned by the same animator. A newer preview, a committed transition, or a state swap cancels pending preview work before capturing geometry. After capture, moving wrappers return to their base transforms before computing the destination, including commits that interrupt a preview. Boats, the god, and tiles have no Svelte intro/outro transitions.

Element registration belongs to the keyed boat's mount lifetime. Removing an old element must not unregister a replacement with the same boat identity. Teardown cancels owned motion and releases references and preview timelines.

## Verification scenarios

Chromium scenarios cover:

- ordinary moves and sinking, followed by committed Undo;
- initial boat-building placement with continuously visible action controls, simultaneous boat/tile appearance, and simultaneous removal in place on Undo;
- god appearance/removal with its cult tile, and movement/Undo between cult tiles;
- a newly built boat's subsequent Move through the actual cell click handler, with movement in both directions and moving pieces painted above tiles and masks;
- hut choices changing the board's page position without tweening stationary boats;
- original identity, owner color, and exact resting position after reversal;
- empty-destination preview, cancellation, and committing a previewed move;
- state-only backward/forward navigation, full-action replay, and silent restoration;
- automatic continuation selection, Undo before the first committed Action, and Undo through manual build stages before reversing committed history;
- selected boats in the raised layer and unselected stationary boats in the masked layer;
- rapid preview replacement and disposing/remounting during motion.

The protected harness additionally exercises ordinary and final-scoring auto-selection across Player, Spectator, and Host views, and resets nonzero island bids between successive hotseat players.
