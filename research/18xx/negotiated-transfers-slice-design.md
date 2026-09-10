# Negotiated transfers and private powers

## Evidence and variation

Surveyed all 130 title profiles in the recorded trait catalog for train acquisition,
interrupting decisions, power effect families, and power lifecycle. Acquisition
assignments include intercompany purchases in 124 titles, depot-only acquisition
in one, lease/borrow in eight, exchanges in 33, and two not-applicable profiles.
Twenty-three titles record another actor's response; 32 record multi-action
powers. Construction powers occur in 102 profiles; lifecycle records distinguish
player/corporate ownership, single/limited/repeated use, phase expiry, and action
expiry. These counts summarize the recorded snapshot, not universal rules or
claims that every assignment has the same evidence quality.

Read the domain study's train assets, construction access, interruptions, and
special-powers sections alongside the paired primary rulebooks: Shikoku 1889
§§8.7–8.8 and 15, TOP §§7.1.1, 7.6–7.7, 11.3, and 12.2. Inspected the contextual
1889 private definitions and immediate seller-lay procedure, and TOP private
and construction definitions, to clarify eligibility. Source behavior is rules
context only; no implementation is copied or translated.

Counterexamples shaping the interface include 18Ardennes asset acceptance,
1870 price protection, 1880 suspended operating rounds, 18CZ selectable train
variants, 18Carolinas capacity allocation, and 1862 service permissions. Ownership,
decision authority, capacity, and the ongoing operation are separate facts.
A simple asset purchase does not stand in for a lease, an emergency funding
procedure, a multi-party merger, or a suspended round.

The 1889 rulebook allows Mitsubishi outside another player's railway operation.
Stock decisions and stable decisions in its owner's operation expose the right.
BetweenCompaniesHandler pauses before a rival starts operating when a legal port
placement remains. ContinueOperatingRound declines only that window, preserving
unused powers for later. A short PrivatePowerWindow records the next company and
players who declined; it clears before that company's automatic start. The same
ordinary operating order and turn history resume. This implementation supports
ordered one-use construction rights here, not an arbitrary interrupt stack.
Sumitomo ignores mountain-only costs, preserving combined river/mountain costs;
this follows the production definition's explicit clarification of the book's
broader mountain wording. Ehime's seller decides immediately and independently of
railway connectivity. Optional use does not close either Ehime or Mitsubishi.

## Shared procedure and title policies

PurchaseOffer records the asset, buyer company, seller Owner, agreed cash price,
and the two controlling player identities. OfferPurchase changes no ownership or
cash until acceptance. Different players use RespondToPurchaseOffer; one player
controlling both sides settles with the original explicit confirmation. Acceptance
rechecks ownership, authority, price restrictions, liquidity, tradability, and
train capacity. Rejection remains available when an offer is stale. A rejected
or unaccepted offer does not consume the depot allowance or operating step.

TransferRules supplies permitted price ranges and post-purchase consequences.
Cash uses the existing payment settlement; trains preserve identity and history;
private ownership uses the existing certificate. Negotiated trains do not trigger
new depot phase events or consume PEIR's one-depot-train allowance. TOP allows
Hunslet alone to move from a player to a railway, for $1–200 from 4H until closure,
excluding PEIR. 1889 allows player-owned privates at half through twice face value
in phases 3/4, with no corporate resale.

CompanyDecisionsHandler composes the existing ordinary and exchange handlers.
A pending purchase, seller's private tile choice, or track permission has priority
and names the next player. These short decisions leave machineState, operatingSet,
track/route/purchase steps and turn history in place. Consequently the current
operation itself is the continuation; no second copy of its fields needs syncing.
Only the pending decision's response Actions can run. Resolution re-enters the
ordinary handler, which derives the current controlling player. Phase changes use
the existing explicit phase continuation because those change machine state and
may introduce compulsory train discards.

PrivatePowerRules provides eligible construction or early-train choices.
Mitsubishi and Ehime share TrackConstruction with explicit payer, locations,
definitions, an independent lay allowance and their connectivity exception.
Use/decline records a consumed one-use private power without closing the private.
This list is deliberately limited to the one-use rights implemented here; repeated
or resettable abilities need their own accounting when a consumer requires it.
Ordinary and private lays share physical inventory changes, station migration and
cash settlement. Sumitomo adjusts terrain cost through TrackRules. Vernon River
Bridge supplies a consent player: another owner accepts the exact requested lay,
while the same player confirms through ordinary LayTile. Acceptance reevaluates
both cost and topology and consumes the ordinary track allowance exactly once.
Schreiber and Burpee uses the existing owner-restricted physical straight tile;
phase closure retires its unused piece, while an already placed tile stays on map.

Hunslet uses the ordinary depot evaluation and purchase settlement, closes on use,
and preserves the current operation through phase advancement and discards.
It grants an early purchase, not a free train or extra capacity. Normal purchase
rules still enforce affordability, rank availability, and the pre-purchase limit.

## Prototype and verification

Negotiated purchases and Private powers are four-player prepared positions on the
economy page. The disposable panel displays the parties, price, decision owner,
and private tile/train choices. Components call session methods. Manual drafts
support Back and draft-first Undo, hide during visible-state transitions/history,
and clear beforeNewState. A committed pending response survives reload and uses
engine Undo. Optional private actors never acquire ordinary stock/operating actions.
Only local hotseat can explicitly select another entitled player's private lay;
networked clients must match their own player identity.

No shared library depends on a game package. No host bridge or shared Game Client
contract changes. Adoption requires publishing matching TOP/1889 Logic and UI
Artifacts. Development saves use version 21; old prepared histories are not migrated.

Verification: 139 shared logic tests, six title tests, and 178 harness tests pass.
The 21 new harness cases cover transfer authority, stale requests, same-player
settlement through Union Bank, prices, train limits and rusting, Ehime use/decline,
Mitsubishi stock and between-company decisions, mountain cost distinctions,
Hunslet phase/discard continuation, bridge consent, construction entitlement,
physical tile expiry, hydration, replay, and Undo. Twenty-four browser checks pass
sequentially across the new powers, construction, stock rounds, earnings, private
exchanges and phase changes. All four 18xx UI checks and affected builds pass.
Visual inspection covers the prototype purchase draft and private cards. The
between-company pass record persists until the automatic company-start Action,
so action revalidation does not reopen a window that its owner just declined.
