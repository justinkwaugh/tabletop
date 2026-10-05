# 1846 first major train buying

This slice completes the first major's operating turn with ordinary phase-I depot
purchases. It does not advance to another company or operating round.

## Evidence and family survey

GMT 2021 §§6.81–6.88 require individual purchases, the printed depot price, a
four-train limit in phase I, and a train even without a runnable route. Insufficient
treasury requires emergency issuance and then owner funding; that procedure remains
an explicit unsupported boundary. Reference snapshot
715567bdc7e5cc68a68a286b21dc8edd1a125e50, g_1846/step/buy_train.rb, confirms
the distinction between ordinary and emergency purchases. Corporate train trades
are outside this slice: no other major has operated yet, and the independents'
starting trains are not ordinary sale offers.

Surveyed all researched title profiles for mandatory-train-purchase and train-limits.
Obligation assignments include 54 conditional, 33 trainless-with-route, 24 trainless,
and 15 no-purchase-obligation profiles. Limit assignments include 78 phase-based,
50 company-form-based, and 16 special-train-exclusion profiles, alongside absent
limits and power-capacity limits. These overlapping traits are evidence indexes,
not universal rules. 1830/1889 route-dependent obligations differ from 1846's
unconditional obligation; 1817's company-size limits and lack of compulsory purchase
are further counterexamples. Later 1846 obsolete-train treatment remains deferred.

## Design

Reuse TrainDepot, TrainPurchase, BuyTrain and FinishOperatingTurn, with title-owned
price, availability, train limit, obligation and phase policies. Inventory records
seven physical depot 2-trains and explicitly marks setup removals for three/four
players. Starting independent trains remain separate assets.

Extract OrdinaryBuyingTrainsHandler from the existing handler. The existing
BuyingTrainsHandler composes ordinary behavior with its emergency funding behavior,
preserving its constructor for existing titles. The ordinary handler requires only
the operating fields and optional phase-change marker it reads. 1846 adds only
trainPurchaseStep; it does not acquire debt, funding or phase-event feature fields.
The shared finish error describes an obligation without assuming its cause is a route.

The title wraps the handler to stop at FirstMajorComplete. No phase advancement,
train trading, private acquisition or emergency funding is claimed. A trainless
company with insufficient cash cannot finish or receive a fabricated train.
With at least five available depot trains and a four-train purchase limit, the
supported first-major sequence cannot exhaust the phase-I depot.

The title UI submits complete priced requests through the Game Session and reads
choices from logic. No local selection, shared host protocol or compatibility
reader is introduced. History gates commitments; Undo reverses normal recorded
actions. The UI contract records the interaction and unsupported boundaries.

## Verification

Tests cover actual cash/depot/ownership mutation, repeated purchases, train limits,
mandatory ownership, stale prices/train identities, actor/source/company rejection,
insufficient cash, player-count supply, completion cleanup, replay and Undo.
The shared engine suite also checks existing train/funding behavior.

Validation completed: 551 tests across all five titles and 236 shared-engine tests
passed. All four earlier titles type-check; 1846 logic/UI checks, lint, package
builds and bundles passed. Existing dependency bundle warnings remain. The native
desktop browser walkthrough verified a real IC purchase ($300 → $220 treasury,
five → four depot trains), mandatory ownership gating, completion, History controls
disabled, and separate Undo of completion and purchase. No mobile/physical-artwork
validation is claimed.
