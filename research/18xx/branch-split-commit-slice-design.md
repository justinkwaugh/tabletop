# Slice 17B: commit a TOP branch split

## Rule and family evidence

This extends the full-catalog reorganization, ownership, capital-release, and
availability survey recorded in [17A](branch-split-preview-slice-design.md).
All 130 researched titles remain in scope; the six missing reorganization profiles
remain evidence gaps. TOP's retained parent and freely selected branch differ from
1841's prescribed successors, 1822 acquisitions, 1817 liquidation, 1846 conversion,
and 1861/1867 nationalization. Their exchange, debt, asset-allocation, and controller
requirements are not collapsed into a family reorganization state machine.

The supplied `/workspace/TOP71_RULES_PROTOTYPE.pdf`, §§6.2, 6.7.1–6.7.5 and 7.6,
is authoritative for ordering, asset division, funding, and train limits. Rechecked
the contextual TOP stock and split procedures for decision authority, temporary
choices, station removal, and the continuation. They provide rule context, not
code to copy. The book's simultaneous, separately rounded exchanges and its explicit
floated-parent condition remain authoritative. The contextual stock implementation
advances directly to the next player; this runtime retains the same stock turn
with its buy/start allowance consumed, allowing the existing additional private
exchanges and explicit Finish turn procedure.

## Draft and commit boundary

The splitting player chooses every asset allocation. No other player bids, accepts,
or makes a rule decision between these choices. A single `SplitCompany` Action
therefore commits the complete proposed split. Parent, branch, price, and allocation
remain manual local draft stages before confirmation; no partially completed
reorganization is authoritative. This preserves ordinary multi-client concurrency:
the engine validates against current canonical state, and any published state
change invalidates the UI draft. A reload before confirmation loses only local
choices; a reload after confirmation restores the whole completed split.

The Action names parent and branch, starting market space, expected branch grant,
parent station IDs, the station selected as the branch home, train IDs, cash,
and Hunslet allocation. No sequence position or presentation color identifies an
asset or player. The home selection refers to one of the selected parent station
IDs; settlement maps it to the branch's existing home piece. Action metadata records
actual certificate destinations, station replacements, payments, and branch funding.

`TheOldPrinceBranchSplit` supplies both the preview and commit validation. It checks
current stock authority, outstanding flotation, stock limits, parent eligibility,
branch/tranche/price availability, distinct transferable stations and trains,
protected printed homes, available branch pieces, cash bounds, Hunslet ownership,
and both resulting train counts. Zero cash, no trains, or retaining Hunslet are
legal choices. TOP's phase-wide train limit is shared by parent and branch; a split
of a legal fleet cannot create an excess fleet. Allocation validation also rejects
an over-limit result rather than allowing an invalid company to reach play.

## Settlement and runtime composition

The title model reuses shared cash settlement, certificate selection, station
replacement, stock-marker placement, presidency calculation, and stock-action
accounting. Existing certificates and trains change owners; no asset is copied.
Parent station pieces exchanged for branch pieces become removed. The parent's
printed home remains, the selected branch home uses its existing home piece, and
remaining branch pieces retain their normal availability. The parent retains its
operated status and market price. The branch starts funded, unoperated, and subject
to the ordinary 60% flotation check; later flotation pays no second capital grant.
A trainless floated parent remains subject to its ordinary subsequent operating
turn and compulsory-funding procedure; splitting does not create a train-purchase
obligation during the stock round.

A TOP stock handler adds the one title Action and delegates ordinary stock behavior.
The shared example runtime accepts an optional stock handler inside its existing
private-exchange and company-decision wrappers. Those wrappers retain their pending
decision and flotation precedence. TOP registers its Action through
[`titleActions`](title-actions-design.md); shared libraries and 1889 acquire no
split Action or canonical fields.
TypeBox is now a direct TOP logic dependency for its first title-owned Action.

## UI and verification

The allocation stage offers stations, an explicit home choice, trains, cash, and
Hunslet, then validates a combined preview before Confirm split. Back/Undo removes
the allocation stage first. Changing parent, branch, or price clears its allocations.
The map displays only canonical station ownership, with title-supplied branch colors.
After confirmation the completed split is visible, ordinary Finish turn is available,
and Undo restores ownership, cash, stations, trains, tranche capacity, market stacks,
and the stock turn together. No additional pending-state schema is needed.

Engine tests cover the worked example's complete settlement, identity and value
conservation, exact replay/Undo/hydration, malformed and stale Actions, unauthorized
actors, protected homes, station capacity, train limits, zero transfers, reserved
shares, later flotation, and stock-turn continuation. Browser checks exercise manual
allocation, Back, canonical confirmation, map updates, reload, and Undo, with 1889
and both opening auctions retained as regressions.
