# Fresh Fish action selection

## Visual intents

Choosing a disk placement makes legal board cells interactive and displays placement instructions. When only bidding, stall placement, market placement, or disk placement is available, the UI selects that interaction automatically. Drawing a tile always requires explicit input, even when it is the only action.

## Coexistence and precedence

Manual choice takes precedence over automatic selection within the current displayed position. Cancel clears manual selection. Automatic selection represents the current rules phase and never adds an Undo step: Undo reaches committed history.

## Shared visual state

The session owns manual selection and clears it immediately before publishing a replacement visible state. Automatic selection is derived from the displayed state's legal actions and acting-player perspective. The action panel and board consume the same selected action. They continue to describe the old displayed position during its transition, then switch together when the new position is published. Navigation, Undo, replay, and silent restoration all use this publication boundary.

## Render ownership

The action panel owns instructions and the selected auction/placement tile image. Board cells own legal placement highlights and hit targets. Both use the session selection; neither independently selects an action.

## Verification scenarios

- Draw a stall tile as admin: the panel displays bidding and the drawn stall. Undo: the panel returns to the legal action choices with no stale stall image. Verified in the local hosted browser.
- Start canonical Exploration during an auction and Undo the draw: bidding disappears, the tile returns to the bag, and earlier committed actions remain undoable. Automated Chromium coverage.
- Choose disk placement, Cancel, and choose it again: board targets follow the manual choice. Publishing another position clears that choice. Verified across History navigation and return to Live in the local hosted browser.
