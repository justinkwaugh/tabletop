# 1846 Phase III trains and lifecycle

This slice adds the 4/6 and 5 certificates, their route scoring, phase change,
private/independent closure, deferred rust, forced discards and bank resale.
Brown construction, Phase IV and the remaining game endings are subsequent slices.
The playground must expose the new choices and identify the construction boundary.

## Evidence and family survey

Surveyed all assignments in `../18xx-2026-09-08/data/title-traits.json` for
train-retirement (193), train-limits (148), train-acquisition (294), and
fleet-route-constraints (165). These are scoped assignments, not title counts.
Retirement includes immediate rust, obsolescence/final operation, wounded trains,
maintenance, persistent trains and capacity loss. Limits include phase limits,
company form, special exclusions, no ordinary limit and power capacity.
An unverified profile is not evidence of absence.

Primary evidence: GMT 2021 second-printing rules §§6.82–6.86, 8, 9; pinned source
`source/lib/engine/game/g_1846/game.rb` (phases, trains, counts, company events),
`g_1846/step/buy_train.rb`, and the shared discard/route procedures. For the
counterexamples, `g_1889/game.rb` rusts immediately; `g_1848/game.rb` excludes
2E trains from limits; `g_1822/game.rb` distinguishes company forms and equipment.
18MEX also has obsolescence. Neither deferred rust nor a limit exemption is a
family invariant. Ordinary 1889 purchases cannot change a certificate face.

## Boundaries

Shared TrainRules gains optional counting and bank-resale-face policies. One
counting helper serves buying, trading and compulsory discards; defaults preserve
existing title rules. TrainDepot owns physical certificate/face relationships;
TrainPurchase decides which faces may be bought. Bank offers share evaluation
with normal, emergency and receiver purchases. Returned stock does not unlock
new depot ranks or regress the phase.

Shared phase/rust/discard procedures remain authoritative. The existing optional
phase active-player policy also authorizes discards, covering ownerless receivers
without weakening other titles' ownership checks. 1846 composes these procedures
with title-owned phase closure metadata, including independent cash, assets and
player Steamboat removal. No other title acquires 1846 state fields. Corporation
revenue markers survive closure; corporate Mail remains open. Route paying-stop
selection chooses the highest valid subset including a station and East–West
bonuses for either express face.

Checks cover each face and player-count supply, pre-purchase limits, obsolete
exclusions, interrupt/resume discard authority, alternate-face bank resale,
nonregressing phases, private/independent closure, final unused runs, receivers,
express scoring and deterministic replay/Undo. UI displays current limit,
obsolete trains, bank stock and compulsory discard choices from the Game Session.

## C&WI closure correction

GMT 2021 p.12 and the pinned `g_1846/entities.rb` C&WI definition release its
Chicago reservation when the private is purchased or removed. Phase III previously
closed the certificate but retained this reservation, so the shared station
placement model correctly continued blocking the slot. Cleanup belongs to the
1846 lifecycle, rather than a station-placement exception for closed companies.

The full station-placement (331 assignments) and station-blocking (277 assignments)
profiles include special/replacement stations, slot and whole-tile reservations,
future-capacity reservations, blocking exceptions and titles lacking the mechanism.
Reservations do not universally share private-company lifetimes: 1846 corporation
reservations survive Phase III, while its C&WI right expires; 1889's special private
powers have different closure timing. Preserve shared placement semantics and the
existing separate home-reservation release procedure.

A title-owned `releasePrivateReservations` procedure now serves acquisition,
bankruptcy and phase closure, returning the released canonical reservations for
phase metadata. The phase summary reads that metadata. Both Phase III trigger
faces verify the slot changes from blocked to open, other reservations survive,
and replay/Undo restore the complete pre-purchase state and blocked slot.
