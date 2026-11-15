# Fresh Fish action selection

## Visual intents

Choosing a disk placement makes legal board cells interactive and displays placement instructions. When only bidding, stall placement, market placement, or disk placement is available, the UI selects that interaction automatically. Drawing a tile always requires explicit input, even when it is the only action.

## Coexistence and precedence

Manual choice is the one staged selection (`model/stagedSelection.ts`) and takes precedence over automatic selection within the current displayed position. Undo clears a manual choice before it undoes any action; there is no Cancel button. Automatic selection represents the current rules phase and never adds an Undo step: Undo reaches committed history.

## Shared visual state

The session owns manual selection and clears it immediately before publishing a replacement visible state. Automatic selection is derived from the displayed state's legal actions and acting-player perspective. The action panel and board consume the same selected action. They continue to describe the old displayed position during its transition, then switch together when the new position is published. Navigation, Undo, replay, and silent restoration all use this publication boundary.

A board cell's placement preview (the lifted disc, stall or market under the pointer) shows while a mouse or pen hovers the cell and it is still a legal target. A touch never previews: a tap places the piece at once, and a phone need not report the finger leaving, which would bring the preview back on that square once Undo made it legal again. Clicking does not hide it: it lasts until the published position makes the cell illegal, so the placed piece replaces it in the same render. A disc that appears grows in from a dot, except in an `own-action` transition, where it sets down at full size, taking over from the preview of a mouse or pen; the session reads this from the presented transition in `beforeNewState`.

## Render ownership

The action panel owns instructions and the selected auction/placement tile image. Board cells own legal placement highlights, hit targets and placement previews. Both use the session selection; neither independently selects an action.

## Verification scenarios

- Draw a stall tile as admin: the panel displays bidding and the drawn stall. Undo: the panel returns to the legal action choices with no stale stall image. Verified in the local hosted browser.
- Start canonical Exploration during an auction and Undo the draw: bidding disappears, the tile returns to the bag, and earlier committed actions remain undoable. Automated Chromium coverage.
- Choose disk placement, press Undo, and choose it again: Undo returns to the action choices without undoing a committed action, and board targets follow the manual choice. Publishing another position clears that choice. Verified across History navigation and return to Live in the local hosted browser.
- Hover a legal cell while placing a disc and click: the preview stays until the placed disc replaces it at full size, with no empty or shrunken frame. Step back and forward through History: the disc grows in. Automated Chromium coverage (`tests/discPlacement.spec.ts`).
- On a phone, tap a legal cell to place a disc and press Undo without the pointer leaving the cell: the cell shows its legal-target highlight and no preview. Automated Chromium coverage with iPhone emulation (`tests/undoPreview.spec.ts`).
