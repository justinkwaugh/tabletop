# Depot train purchases

## Research and design scope

The full title-trait corpus was surveyed for operating capacity (204 assignments
across 128 profiles), running permissions (128/128), acquisition (294/128), train
limits (148/128), and purchase obligations (128/128). Missing profiles remain
unverified. The domain study's train-capacity and route sections distinguish
persistent assets, ownership, operating permissions and distance measures.

Individual trains appear in 125 profiles, selectable variants in 56, attachments
in 16, combined trains in three, and pooled power/generated service units in one
each. Depot purchase appears in 125, intercompany purchase in 124, exchange in 33
and lease/borrow in eight. Phase and company-form train limits coexist with
special exclusions and power limits; two profiles lack the railway mechanism.
18Carolinas' primary power purchase and allocation rules and 1862's primary
permit rules were inspected as counterexamples to universal train-card and
owned-means-runnable assumptions. These require future extensions, not empty
variant, lease or permit frameworks in the first purchase slice.

TOP prototype §§7.6–7.7, 13–14 supplies price, quantity, phase and train-limit
facts. In particular its 4+ costs $200 and its diesel supply is unlimited despite
six included pieces. Shikoku 1889 §§8.7 and 9 and its local title roster establish
ordered purchases, prices, quantities and the diesel availability exception.
The local research definitions were consulted only for rule/data context; the
implementation was independently designed for this repository.

Both titles prohibit exceeding the current train limit even if a purchase would
rust owned trains. 1889's explicit diesel exchange is a later feature. TOP's
PEIR may buy only one depot train per OR, while other companies may buy multiple
trains subject to cash and capacity. 1889 makes diesels available after the first
6 even while further 6 trains remain. A first purchase in a later rank may cause
more than a color change: rusting, discards, private events and interruptions
must be resolved together in slice 12.

## Shared models and procedures

TrainDefinition describes an identified capability, printed price and distance.
Train holds persistent identity and definition independently of its ownership or
presence in the depot. Unissued, owned and removed trains remain distinct. Owned
trains reuse Owner, so a Bank-owned secondhand train is not confused with a new
depot train. No running permission is implied by ownership. Discarded/open-market
purchase, selectable variants, attachments and assigned operators are future work.

TrainDistance names a measurement and maximum. The present measurements are hex
edges, revenue centers, and cities/offboards; unlimited is explicit, never a large
magic number. TOP H trains count edges; + trains count cities/offboards while
towns may contribute revenue, including trailing towns. TOP's required city and
all route-set restrictions belong to the route evaluator in slice 10. 1889 and
TOP's 7 count revenue centers; diesel distance is unlimited. Visit/payment
selection, gauge weights, express trains and combined capacity are surveyed but
not implemented by pretending one numeric distance captures every title.

TrainDepot owns definitions, ordered supply and persistent piece identities.
Finite trains are initialized once and remain in the inventory even when removed.
Unlimited trains are materialized on purchase from a serialized monotonic identity
cursor. Repeated offer reads allocate nothing. TrainInventory validation rejects
missing/duplicate finite pieces, unknown owners/definitions, and invalid unlimited
identities. Supply and ownership therefore replay and undo together.

TrainPurchase evaluates company, train identity and definition. TrainRules supplies
availability, resulting phase, company limit and depot purchase allowance. Normal
price comes from the definition; negotiated prices and discounts remain later
features. The same evaluator supplies UI offers and validates BuyTrain; expected
price and concrete train identity reject stale submissions. BuyTrain reuses cash
settlement and records the purchased identity in TrainPurchaseStep.

## Executable boundary

BuyingTrains is reached directly by the prepared Train purchases example, which
starts in each title's initial phase with one owned train and sufficient treasury
cash. Existing track/station examples keep their current endpoint: routes and
payouts must be implemented before normal operations reach train buying.
No bookkeeping-only start action was added. Finishing a trainless turn and
compulsory financing remain unimplemented; this slice does not offer a bypassing
finish action or claim complete operating turns.

A purchase whose resulting phase differs from the current phase is rejected
explicitly pending slice 12. Same-phase finite and unlimited purchases are
executable, including the distinction between depot availability and a purchase
this slice can finish safely. The UI shows the unavailable reason. A prepared
phase-D test exercises unlimited issuance without silently skipping first-diesel
events. Intercompany purchases, diesel exchanges and emergency financing remain
in their planned slices.

## Prototype and verification

The session owns a single manual train selection. Selecting displays the price;
Confirm invokes BuyTrain through GameSession. Back clears selection, and Undo
clears a manual selection before reversing a committed purchase. Drafts disappear
in history and during visible-state updates; beforeNewState clears them. Depot
counts, treasury and company rosters remain committed until confirmation.

The prototype shows all supplied ranks, availability reasons, distance descriptions,
current train limit, company rosters and purchase history. Fixture version 13
preserves prior examples. UI controls are disposable; no mobile refinement or
train-card artwork is part of this slice.

Tests exercise finite conservation, unlimited identities, stale requests,
authorization, affordability, current train limits, sequential ranks, PEIR's
allowance, 1889 diesel availability, phase-boundary rejection, replay, hydration,
determinism and Undo. Browser checks cover preview, Back, Undo, history, reload,
remaining supply and company rosters for both titles.

Verification passed: 127 shared logic tests, 108 harness unit/integration tests,
and 18 browser checks covering train purchases and the existing economy, stock
round, construction and station flows. Shared and title logic/UI builds passed;
shared UI, both title UIs and the harness reported zero Svelte errors or warnings.
The desktop train-purchase preview was also inspected visually.
