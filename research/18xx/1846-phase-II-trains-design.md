# 1846 phase-II train introduction

## Scope and evidence

Support the first phase-II purchase, both printed faces, and its recorded phase
change, then stop at PhaseIIReady. Green upgrades, their city/token rules and
phase-II operations are the next slice. Prepared route evaluations cover 3/5
scoring without advertising a playable phase-II operating turn.

GMT 2021 §§6.64, 6.81–6.85 and §9: 3/5 costs160, 4 costs180; both sides share
physical certificates. A type is chosen on purchase and cannot change while owned.
There are player-count+1 phase-II certificates in three-to-five-player games.
After all depot2s are sold either face becomes available; the first purchase,
not sale of the last2, starts phaseII. Limit stays4; no rust or private closures.
A3/5 visits up to5 and counts up to3, including one company station; a stop bonus
requires that stop to count. Offboard values remain at their lower phase-I values.

Reference snapshot 715567bdc7e5cc68a68a286b21dc8edd1a125e50:
g_1846/game.rb TRAINS, num_trains, revenue_for and route help; the shared reference
route engine's distance handling provides the visit/pay distinction. No reference
classes or algorithms are copied.

## Family survey and design

Reviewed every train-acquisition (294 assignments), route-distance (249), route
revenue-modifier (416) and train-retirement (193) profile. Acquisition includes
depot purchases, intercompany purchases, exchanges, leases and power purchases.
Distance varies between all stops, city/town allowances, hexes/edges, selected
stops and unlimited trains. Revenue can depend on phases, assets, directions,
train type and resources. Retirement includes immediate rust, final runs,
obsolescence and persistent equipment. Trait evidence gaps are not proof of absence.

1830/1889's independent ranks must retain their existing identities and supplies;
TOP's hex-edge distance must remain independent from payments. 1822-style separate
node allowances and 18ZOO's selected stops challenge a universal all-visits-pay
assumption. 1846's counted-station requirement remains title policy, not a family
invariant. Other variants can change price, distance or train-specific policies;
purchasing a face must not create another physical certificate.

TrainDepot supply entries may name alternative definition IDs. New depot offers
share the entry's physical ID and count; purchase stores the selected definition.
Existing entries omit variants and preserve identities/behavior. Validation checks
that a selected definition belongs to its physical supply. This slice supports
variant selection on new depot stock; changing the face of a future returned
market train remains part of later discard/market work.

RouteEvaluation still traces all visits and enforces full distance/connectivity.
A small optional payingStops policy selects from revenue candidates containing base
value, stop bonus and company-station presence. Payments and stop bonuses use the
selected candidates; traversed-hex bonuses keep their existing semantics. The
default pays all visits unchanged. 1846 selects the highest three including a
station, preserving path order for presentation. Combinations of directional
bonuses (East-West) and private powers will need their title scoring policy in the
phase-II operations work; the shared evaluator does not assume every title selects the highest base values.

1846 composes PhaseFields now that it records real phase events. Shared BuyTrain,
AdvancePhase and AdvancingPhaseHandler perform the recorded cascade. The phase
action's private-rule dependency narrows to phaseEffects, which it actually uses;
existing full policies still work. Title rules have no phase-II rust/closure effects.
The title continuation names PhaseIIReady so metadata and actual boundary agree.
The current operating turn stays open; no premature finish or next actor is created.

No host contract change or save compatibility reader is introduced. The UI contract
records distinct offer keys, shared supply, phase handoff and Undo behavior.

## Verification

Tests cover finite/unlimited variant identity, supply depletion, stale alternate
purchases, invalid supply definitions, player-count removals, premature phase-II
requests, face prices/affordability, exact cash/ownership, retained 2-trains/privates,
one System phase event, rejection at the boundary, replay/Undo, counted-station
selection, bonus selection and full visited-stop distance.


Validation completed: 802 shared-engine/title tests passed, followed by the focused
22-test route/phase suite including two additional affordability/distance cases.
All four existing title packages still type-check; title logic/UI checks, lint,
shared and title package builds, and both title bundles pass. Existing dependency
bundle warnings remain. Native desktop browser: after selling the last2, both
buttons appear with four shared certificates. Buying3/5 changes NYC cash220→60,
supply4→3 and phaseI→II; Undo restores both offers, phaseI, supply4 and cash220.
Buying4 instead changes cash220→40 and reaches the same handoff.
