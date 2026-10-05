# 1846 personal emergency train funding

This slice extends the atomic emergency purchase with committed treasury issuance
and personal stock sales. Bankruptcy, receivership, returned trains and later
train phases remain separate work. An unfunded corporation cannot finish its turn.

## Evidence and variation

Rechecked the complete September 8 title-profile assignments for emergency funding
(130), failure consequences (178), share-sale eligibility (132), and presidency
transfer (271). These are scoped assignments, not distinct title counts. Sale
windows range from any time to completed operation, with president-only exceptions;
presidencies include incumbent ties, ordered successors, restricted transfers and
corporate presidents. Funding ranges from owner sales to issuance, loans,
refinancing and no compulsory guarantee. Failure can end a game, eliminate a
player, leave debt, reorganize a company or put it into receivership. Missing
profiles do not establish absence.

The preceding train-trading note records the primary-source counterexamples:
1889's owner sales and terminal bankruptcy, TOP's multiple contributors, 1840's
player loans and prohibition of emergency share sales, and 1817's absence of a
mandatory purchase. Those differences rule out treating 1846's sequence or failure
outcome as family defaults.

For 1846, GMT second-printing rules §§6.86–6.89 and 7 establish issuance before
personal money, normal sale restrictions, protected operating presidency and
corporation survival, other presidency changes and operating reordering, and
stopping when enough money is raised. The pinned g_1846/game.rb and
step/buy_train.rb, plus the shared reference step/train.rb and
step/emergency_money.rb, confirm single sale blocks, either depot variant,
no intercorporate purchase after emergency funding, and the last share's marginal
value restricting a subsequent cheaper variant.

## Ownership of data and procedure

The title owns `emergencyFunding` with the operating company, minimum train price
implied by committed sales, and corporations already sold. This property belongs
only to the 1846 state schema. It is absent outside the funding procedure. There is
no family-state optional property or compatibility reader.

`StartEmergencyFunding` applies all mandatory issuance before personal sales.
The existing emergency quote calculation serves both a complete cash-funded
purchase and the start of the longer sequence. Funding does not lock a train
variant: all still-legal variants remain available. Each personal sale sets a
purchase minimum equal to combined cash after selling minus one share's sale value
plus $1. This permits unavoidable excess proceeds, but disallows an unnecessary
last share and then choosing a cheaper train. The minimum only increases.

The title's sale evaluator composes shared share disposal and StockRules1846,
rather than pretending the sale is a stock-round turn. It preserves market limits,
certificate selection, president-before-operation policy and presidency exchange,
then adds operating-company protection, one-block-per-company and funding limits.
Shared settlement supplies cash, certificates, market movement and metadata.
Pending operating companies are reordered; closed companies no longer count as
pending in the shared reorder helper. Fixed completed/current positions remain
fixed. The same closure handler schedules the existing closure Action for stock,
ordinary operations and emergency funding, with title-specific continuations.
A funding closure resumes the operating corporation's funding, not its next turn.

EmergencyBuyTrain consumes only the remaining contribution and ends funding.
A phase change explicitly resumes BuyingTrains, not the completed funding step.
The funding handler offers only personal sales and funded depot purchases, so
issuance cannot repeat or be diverted into private acquisition or train trading.
History uses Action inputs and settlement metadata. Every issuance, sale and
purchase is a committed Action; Undo reverses those Actions, including automatic
closure and phase consequences. No transient selection or automatic client Action
is introduced.

## Verification

Engine examples cover treasury issuance before sales, retained personal excess,
single blocks, market limits, sale timing, operating presidency/closure protection,
other presidency changes and closure, pending order, phase continuation, both
variants, oversale restrictions, forged actions, replay and Undo. The playground
exposes issuance, legal sale blocks, the minimum train price and purchase choices.
It clearly identifies the remaining bankruptcy boundary when funding is exhausted.
