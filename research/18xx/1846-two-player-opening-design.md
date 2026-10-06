# 1846 two-player public opening

The opening-only boundary below records this slice as implemented.
[The completion slice](1846-two-player-completion-design.md) now continues through
regular two-player play and the final ending.

This slice implements the opening in GMT's published
[two-player variant](https://gmtwebsiteassets.s3-us-west-2.amazonaws.com/1846/1846_2P_VARIANT-FINAL.pdf).
The pinned reference's `g_1846/step/draft_2p_distribution.rb`, inherited
`draft_distribution.rb`, and `game.rb` supply comparison evidence for purchase
settlement, returning to distribution after two ORs and independent debt floors.
The published zero-price rule discounts the company value; independent debt
remains payable, consistently with the existing hidden distribution/reference.

## Family survey and boundary

Surveyed the full title-traits catalog's allocation-method (160 assignments),
round-sequence (208), actor-order (388) and entity-roles (325) profiles. Opening
allocation includes hidden and public drafts, rotating/snake selection, auctions,
fixed/random allocations and no initial private allocation. Round sequences include
startup operations before stock, draft/operating alternation, ordinary stock/OR
cycles, merger/acquisition rounds and continuous turns. Unverified profiles remain
evidence gaps. TOP's initial corporate auction and 1830/1889's private auctions
are counterexamples to treating every opening as a packet draft or fixed-price
purchase. 1817's merger/acquisition rounds also rule out a universal stock/OR
alternation assumption.

Keep the public allocation policy and its controls title-owned. Reuse the existing
1846 private/independent settlement, ordinary operating-set/round Actions, track,
route and earnings mechanisms. No family state or universal opening interface is
added. The only differences at the existing operating-set boundary are whether
purchases resume or stock trading begins; a system Action records the resumption.
The opening can repeat any number of preliminary two-OR sets, independently of
stock-round numbering.

## State, Actions and setup

Distribution is a discriminated union. Hidden distribution owns protected packets,
deck and selections; public distribution owns its buying/operating/completed stage,
consecutive passes and optional last-company offer. Public games do not carry empty
hidden packets or a hidden deck. The hidden-mode accessor narrows this union; it is
not a saved-state compatibility reader. 1846 remains unreleased and this slice does
not migrate development saves created with the previous schema.

Setup uses a $7,000 bank, $600 per player, two removals from each private group,
one removed northern and one removed southern corporation. Removed Erie places its
second blocking station immediately in Erie, alongside its Salamanca home station. Bank trains begin
with five Phase I, five Phase II and three Phase III certificates, plus independent
trains. Priority Deal is randomized by the existing seeded setup; the other player
buys first and must purchase. Public purchases immediately transfer ownership and
payment, capitalize/float independents and provide their train. Independent home
stations are placed during setup, before either allocation mode; purchase and Undo
preserve them. Their reservations are consumed at setup. This keeps physical
occupancy separate from company ownership/operation and uses the existing shared
station blocking rules. The reference setup (`game.rb` minor setup) confirms this
initial occupancy; train grants remain at purchase in this slice.
Settlement is shared with the hidden draft rather than duplicated.

BuyOpeningCompany validates actor, current price and affordability.
PassOpeningPurchase clears into two operating rounds after two consecutive passes
with at least two companies remaining; purchasing resets that count. A last
company instead falls by $10 per pass and is assigned to the next player at its
minimum price. ResumeOpeningPurchases records the completed OR set and returns
the first offer to the player without Priority Deal. These Actions use canonical
runtime history and patches for replay and Undo; public purchases reveal no secret
information and do not impose the hidden draft's reveal barrier.

The preview stops at TwoPlayerOpeningComplete after every company is purchased.
Regular two-player play is deliberately unavailable until ownership/certificate
limits, delayed second blocking stations, finite Phase IV supply and final-train
restrictions/endings are implemented. The current final depot remains the ordinary
unlimited depot; it cannot be bought during this opening. The other second blocking
stations cannot be triggered by preliminary yellow-only construction. This is an
explicit development boundary, not a rules-defined game ending.

## Presentation and verification

The title UI displays all remaining offers and prices to every perspective, and
only enables affordable choices for the active player. Session methods submit
canonical buy/pass Actions. Preliminary operations reuse the existing board and
operating controls; purchases reappear after the second OR. There are no new
transient selections, auto-committing effects, Back steps or animations. History
and busy/inactive gates apply to the new panel. The completion panel identifies
the opening preview boundary.

Tests cover seeded removals, cash/train quantities, mandatory first purchase,
wrong actors/prices/sources, immediate independent capitalization/stations/trains,
pass resetting, two empty ORs with private income, repeated independent operations,
last private and independent debt-floor assignment, public projections, full
replay and Undo. The existing hidden-draft suite exercises three-to-five-player
projection and distribution after the union/settlement refactor.

Validation: all 234 tests in the 1846 suite pass, including 11 public-opening
cases. All 301 playground demo regression tests also pass. Logic build/lint, the new suite's strict TypeScript check, and UI
packaging/check/lint pass. Native preview automation timed out repeatedly;
interactive browser verification remains outstanding, as recorded in the visual
contract. No production publication or commit is part of this slice.


Review fix: both independent home stations now exist from setup for every player
count. A reservation alone does not block track connectivity. Regression coverage
checks initial occupancy without activating the companies, station preservation on
purchase/replay/Undo, and construction beyond an unbought Big 4 in preliminary ORs.
A seeded yellow connection to Indianapolis has no onward construction choices;
removing its station restores them, proving that occupancy is the blocking cause.
This is title setup data, not a new shared station or allocation policy.

Post-fix validation: all 239 1846 tests pass. The new regression failed before
the correction. Logic build/lint and the opening suite's strict type check pass.
