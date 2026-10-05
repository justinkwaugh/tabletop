# 1846 bankruptcy and receivership

## Evidence and variations

Surveyed the full September 8 title-profile assignments: control resolution (190),
presidency transfer (271), emergency funding (130), failure consequences (178),
and reorganization (192). Counts are assignments, not unique titles. Failure
profiles include game ending (75), elimination (33), continuing debt (27),
reorganization (16), receivership (11), liquidation (8), bankruptcy (7), and
failure prevention (1). Unknown profiles remain evidence gaps.

GMT 2021 rules §§6.89, 7, 8, 10.2 and pinned reference
`g_1846/step/bankrupt.rb`, `round/operating.rb`, `step/buy_train.rb`,
`step/dividend.rb`, plus the shared route step and share-pool code establish the
implemented sequence. Normal legal sales precede forced liquidation; forced sales
do not move prices and can exceed the market cap or put a president certificate
in the market. A successor immediately inherits the train obligation. Without a
successor, surviving players supply routes and the receiver automatically withholds
and buys the cheapest affordable depot train. It loses two stock columns when
trainless. A 20% holding recovers the presidency, including the virtual 10%
purchase when the market contains only the president certificate.

Known counterexamples remain distinct: 1889 ends on bankruptcy; TOP may require
multiple contributors; 1817 has no compulsory train guarantee; 1840 uses owner
loans. In pinned `g_1848/game.rb#perform_ebuy_loans`, exhausted loans or stock
movement trigger receivership. In `g_1860/step/buy_train.rb`, receivership and
bankruptcy are distinct and president contributions are forbidden. These policies
cannot be represented by a universal bankruptcy flag or a bank-owned presidency.
Corporate presidents and manager/director control also prevent equating a
corporation's acting player with its president in family interfaces.

## Boundaries and model

1846 owns elimination (`bankruptPlayerIds`), liquidation, receiver detection,
receiver turn sequencing, route actors, automatic decisions and virtual purchases.
The receiver is derived from the bank-held president certificate and absent
president; there is no second receiver flag, invented bank Player, or dummy
President. No new property is added to another title's canonical state. The title
composes the existing final-wealth capability for the last-survivor ending.

Shared route authorization gains a policy callback, retaining the controlling
owner as the default. Phase continuation similarly accepts title-selected active
players. This preserves normal action authorization while allowing a presidentless
receiver's automatic train purchase to advance the phase. The title has dedicated
system Actions for receiver start, earnings, purchase and completion. It reuses
shared route validation, earnings calculation/settlement, train purchase, phase
advancement and operating-turn completion. No construction, finance, acquisition
or voluntary train selling window is opened for receivers. Route maximization is
player-assisted, matching the reference; exhaustive optimality is not enforced.

Shared presidency resolution represents claiming a bank-held certificate separately
from transferring a presidency between owners. The stock purchase applies the
certificate exchange before checking the exceptional net certificate count. A
player at the limit can recover a presidency without gaining a certificate.
`presidencyClaim` is optional settlement metadata; existing action inputs and
existing title states remain valid. Four other titles' action-contract snapshots
change because their schemas embed shared share-purchase metadata; they do not
emit this new outcome in their existing rules. No migration or compatibility
reader is needed. The virtual 10% purchase remains an 1846 Action and obeys stock
turn, affordability, certificate and sale-repurchase restrictions.

Railroad closure is extracted from the existing closure Action so bankruptcy can
close owned independents atomically, including cash, trains, certificates, tokens
and reservations. Metadata records the actual liquidation and closures. A
bankruptcy Action ends the old actor's turn, removes them from turn order, and
opens continuation for a successor or surviving receiver actors. Pending operating
order is recomputed after price changes and closures. Bankruptcy does not change
the original player-count basis of the certificate limit.

## UI and verification

The funding screen exposes the unavoidable shortfall and an explicit bankruptcy
button describing liquidation and elimination. The session owns initiation and
uses existing active-player, history, publication and busy gates. Receiver route
entry uses the existing route editor; automatic settlement requires no client
Action. Holdings identify eliminated players and receivers. Stock trading offers
the virtual purchase only when legal. History descriptions use action inputs and
metadata; Undo restores the full transaction and automatic consequences.

Engine tests cover liquidation, private/independent closure, presidency succession,
receiver train buying and phase continuation, trainless operation/closure, route
authorization and automatic withholding, receiver train-sale prohibition,
elimination and the last-survivor ending, ordinary and virtual recovery,
certificate limits, invalid declarations, replay and Undo. Family regression tests
exercise the default route/phase behavior and stock-purchase contract changes.

The supported depot still ends in phase II. Later trains/construction, other
ending triggers, and two-player play remain later slices. This slice does not
claim production or full-game readiness.
