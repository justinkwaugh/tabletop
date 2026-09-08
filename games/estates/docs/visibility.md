# Estates visibility

New protected Games conceal undrawn roof values and order, the private random generator, and the reproduction master seed. Roof count and selectable slots stay public. Drawing publishes exactly the chosen roof in state and Action metadata.

With Hidden Money enabled, only the owner receives their money, stolen money, and running score during play. All financial totals become public at EndOfGame. Without the option, these fields remain public throughout. A shared declarative policy grants access to the owner, when persisted Game configuration disables Hidden Money (default false), or when the projected state is at EndOfGame. One canonical player/state schema carries these annotations, and hydration uses its directly derived projection schema. Historical projections evaluate their own phase, even when the current Game is finished. The optional state flag remains readable for legacy auction behavior and exploration checks; it does not select financial visibility.

Cube offers, buildings, certificates, selected pieces, bids, payments, and embezzlement Actions remain public. Public transaction history allows balances and stolen totals to be calculated; this feature conceals their direct delivery, not their inference. Sneaky Buildings continues to hide previously public cube faces visually.

## Execution and exploration

With Hidden Money, every non-auctioneer participates, including players with zero cash. Each bidder must explicitly bid or pass; insufficient funds never cause a public skip or automatic pass. The auctioneer also explicitly chooses the recipient even when unable to buy out the winner. Only the acting player sees disabled unaffordable choices. Public-money Games and legacy saves without the state flag retain their automatic passing and recipient decisions.

Auction setup and bidder advancement therefore need no opponent balances in Hidden Money Games. Legal-action discovery always allows the active bidder to pass. Positive bids still require sufficient owner cash; transfers and scoring require canonical balances. Guarded projected execution falls back to the authoritative engine on unavailable reads. Missing money is never treated as zero by game logic.

Exploration is unavailable when Hidden Money is enabled, including Host View, history, finished Games, and legacy saves whose option exists only in Game configuration. The Game Session checks both configuration and state before allowing entry; the runtime rejects Hidden Money population from projected input or canonical state carrying the option. No financial reconstruction is provided.

For public-money Games, projected exploration reconstructs the remaining roof multiset from public DrawRoof outcomes and samples its order with the supplied branch randomness. Known financial values are retained. Missing draw observations fail explicitly. Sampling never consults canonical roof order or private entropy.

## Existing Games and publication

The updated Estates Logic and UI adopt the shared visibility runtime. Assign deployment versions and publish them together after deploying the updated backend. The Site Frontend must already support visibility; these changes do not require another Site Frontend deployment when that support is present. This change adds no Site Frontend ↔ Game UI bridge interface; older Estates UIs require the major-version reload before rendering a protected Game. The shared visibility resolver rejects a protected Game when its selected Logic lacks a projector, so rollback requires a compatible runtime.

The persisted `Game.protectedInformation` marker fixes protection at initialization. Unmarked v1/v2 Games and existing unmarked numeric v3 Games continue canonical delivery under the new runtime. They are not retroactively protected. Their saved roof order, random cursors, and system version are preserved. An absent state `hiddenMoney` flag remains valid. Legacy roof bags with consumed trailing items remain supported by the shared DrawBag.

The v2 fixture was generated with the pre-adoption implementation at `3dc89bb7`. Regression tests pin its setup checksum/random cursor and the exact result of a saved continuation through embezzlement, roof drawing, bids, payment, and placement, serializing state between steps. Compatibility requires forward play; historical Undo/navigation for old Games is not a release requirement.

## Verification

Logic tests cover owner and spectator state, final disclosure and projected replay, action schema coverage, guarded discovery, manual zero/insufficient-balance bidding and recipient choices, legacy automatic decisions, public payments, independent roof samples, missing exploration observations, crypto reproduction, v2 and unmarked numeric v3 continuation, and complete v2/v3 games. Browser tests exercise both money layouts, perspective switching, HTML actions, projected cube/roof auctions, revealed roof labels, blocked Hidden Money exploration (including legacy state), and public-money exploration, alongside the on-demand rendering and animation regressions.

These checks use the local development harness. They do not constitute a production publication or a hosted multi-account rollout rehearsal.
