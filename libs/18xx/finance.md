# Finances (slices 1–5)

The shared model separates companies, the bank, asset ownership, certificate pools,
cash, and company management. Both title packages supply reduced example positions
through the Common Game Runtime and Game Session. Each example plays a complete stock round from a prepared position
to the start of an operating set. Full game setup and company operations follow in
later slices.

## Model and interfaces

Game State contains `bank`, `companies`, `cash`, `certificates`, and
`certificatePools` directly. `FinanceFields` supplies the reusable TypeBox property
schemas; `FinancialState` is their structural TypeScript type for queries and example
authoring. Neither introduces another persisted object or hydration layer.

Shared functions query the fields they need: `getCompany`, `certificatesOwnedBy`,
`certificatesInPool`, `cashOwnedBy`, `getTreasury`, `sharesOwned`, `privateOwner`, and
`controllingOwner`. `validateFinances` checks field shapes and ownership references
when Game State hydrates. Common Game State hydration provides copy isolation and
dehydration. Queries have no serialized caches.

`Owner` identifies a player, company, or the bank. Players remain Common Players
and Player States, referenced by stable Player IDs. Companies have title-defined
kinds, using `major`, `minor`, and `private` for the agreed categories. Share
structure and operating capabilities are independent of the category. The bank is
separate from companies; Union Bank is a private.

An outstanding `Certificate` has an owner and optional `poolId`. A `CertificatePool`
also has an owner, and its members must belong to that same owner. Moving a
certificate between that owner's pools changes its grouping without changing
ownership. The 1889 example places both IPO and Market certificates under the
Bank. Pool membership does not determine who receives purchase proceeds.

Retired certificates retain their identity and instrument details but have neither
an owner nor pool membership. They do not appear in portfolios or contribute to
share ownership or certificate-limit counts.

A share certificate records a positive number of `shares`, whether it is a
president's certificate, and an optional identifying number. A company's optional
`shareCount` supplies the basis for fixed percentages: two shares in a ten-share
major represent 20%. A private certificate represents ownership of one private;
there is at most one outstanding ownership certificate for each private.
`certificateLimitCount` records the current title-supplied contribution to the
certificate limit, independently of the number of shares or certificates. It
supports zero and fractional counts. Stock rules derive the effective count from
the current market position without changing that base weight. The ordinary-certificate authoring helper creates a two-share
president's certificate and one-share ordinary certificates; this is not a family
invariant.

`Cash` records one owner's amount, with an explicit unlimited value for the bank.
Each owner has at most one cash record in this slice. A `Portfolio` is a collection
of outstanding certificates. A `Treasury` query collects a company's cash and
portfolio from those ownership records; it does not duplicate assets in persisted
state. Trains and other treasury assets, restricted funds, debt, and spendability
rules will extend the model in their respective slices.

A company's `president` is the player or company holding its presidency. For a
private, ownership comes from its certificate instead. `controllingOwner` follows
those relationships to the player in control. Missing management, bank ownership
of a private, or a circular chain yields no controlling owner. There is no separate
stored controller that could drift from ownership. Title rules still govern
presidency changes, exceptional decision authority, and the consequences of having
no controlling owner. Control does not transfer assets or establish payment liability.

## Title examples

Shikoku 1889 includes Awa and Iyo certificates, player portfolios, Bank-owned IPO
and Market pools, Mitsubishi Ferry owned by a player, and Ehime Railroad owned by
Iyo. Iyo's president is therefore Ehime's controlling owner. The example has 8,000
total cash, with 6,120 in the Bank.

TOP includes Charlottetown as Mainline, Souris, Union Bank, PEIR, Vernon River Bridge,
and the King's Mail. Union Bank owns cash and certificates, including Souris's
president's certificate. Alex owns Union Bank's private certificate. Souris's
president is Union Bank and its controlling owner is Alex. Their assets remain
separate. TOP's Bank has unlimited cash.

PEIR uses numbered share certificates, each representing one share. Its entitlement
is based on outstanding shares rather than a fixed percentage. TOP's `peirShares`,
`peirEntitlement`, and `peirPresident` queries derive outstanding shares, payout
fractions, and the presidency's largest-shareholding/lowest-number tie rule. The
example has five outstanding shares split 1/2/2 among the players. Retiring one
changes the denominator. The initial stored PEIR president agrees with that rule;
future Actions must settle presidency changes when ownership changes.

Cash and holdings are illustrative midgame values, not full initialization. Other
companies and trains are omitted. TOP uses the supplied
prototype's King's Mail income of 60, with the edition discrepancy documented in
the title README.

## Runtime and presentation

`EighteenXXState` is built on Common Game State with financial fields at the
root. Its initializer requires three players, uses their stable IDs, and authors
deterministic asset IDs. `StockRoundHandler` offers purchases, sales, and company
starts. `FinishStockTurn` advances the player and records a pass only if the turn
had no stock action. Final passing schedules `CompleteStockRound`; the example
then schedules `StartOperatingSet` and stops at `OperatingSet`. The terminal view
retains a player identity for Common's hotseat Undo and accepts no operating
Actions. Each title exports a Definition and UiDefinition using a shared finance
example Game Session subclass. The shared host contract is unchanged.

`Portfolio` renders owned certificates grouped into their owner's certificate pools.
`FinanceInspector` arranges player portfolios, company treasuries, and Bank cash
and certificates. Companies show their President or private Owner and their
Controlling Owner. TOP adds PEIR's dividend entitlement through a snippet. These
are provisional layouts. A shared trading panel submits Actions through the
Game Session and renders payment previews and committed history.

The playable table at `/table` in the 18xx Playground uses the local harness to persist examples.
The host identifies this schema's examples with the versioned name
`Finances example · 7 · <position>`. Earlier inspection examples are preserved, and a new
example is created for this version. Current examples are reused on reload and
when switching titles. This is fixture versioning, not a saved-game migration.

## Family review and evidence

The catalog review covered 2,614 assignments across 130 title profiles for entity
roles, eligible investors, control resolution, equity structure, certificate
counting, ownership limits, presidency, capitalization, capital release, dividend
entitlement, and payout rounding. Unassigned or unresolved traits remain evidence
gaps. Sources are the local study's `18xx-domain-model-study.md` ownership/finance
sections and `data/title-traits.json`, with linked primary definitions checked for
the distinctions below. The research supplies facts and counterexamples only;
implementation is independently designed around this repository's Common modules.

| Variation | Design consequence |
| --- | --- |
| 1841 corporate ownership/control; TOP Union Bank | Separate owners from resolved human authority; do not aggregate personal and corporate assets. |
| 18MEX unequal 5%/10%/20% denominations | Explicit integer units and issuer basis, not one certificate = one share. |
| 1856 CGR half-certificate ordinary shares | Certificate limit contribution separate from unit quantity and certificate count. |
| 1817 and related shorting titles | Positive certificates do not describe the whole economy; short liabilities need a future explicit position model. No universal 100% outstanding-positive-interest check is imposed. |
| 1856 escrow and differing capital-release events | Cash ownership does not establish permission to spend; restricted funds and release rules are deferred. |
| TOP numbered PEIR shares | Keep share identity and number, derive entitlement and tie resolution in the title. |
| Titles without certificate limits; market/private exemptions | Zero/fractional effective counts supported, calculation policy stays title-owned. |

Primary checks: [18MEX denominations](https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_18_mex/entities.rb),
[1856 national shares](https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1856/game.rb),
[1817 short positions](https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1817/game.rb),
[TOP authority and PEIR](https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1871/game.rb).
The supplied TOP prototype §§3, 6.3, 6.8, 7.7, and 11.3 and Shikoku 1889 §§7, 8,
and 15 provide the title rules. TOP remains a prototype with the discrepancies
already recorded in its title README.

The current slice excludes debt, shorts, preferred dividends, scoring aggregation,
full setup, and company operations.
Those rules remain title-owned as they are added.

## Verification

Model tests cover ownership independently of pool membership, mismatched pool
owners, private ownership, direct and indirect presidencies, circular control,
weighted certificate limits, retirement, cash validation, and JSON hydration.
Both title examples run through `GameEngine.startGame` and retain their ownership
when players are reordered or recolored. TOP verifies the changing PEIR denominator
and presidency. Browser checks cover desktop/mobile presentation, title switching,
current-example reload, and preserving earlier examples while creating a current one.

## Existing share purchases

`StockRound` defines the shared stock-round schema and type. Game State declares
`stockRound: StockRound` directly, and purchase logic consumes that model. Its
fields record its number, current StockTurn, prior sales, companies that have
purchased this round, ordered passed player IDs, and completion.

`BuyShares` records the acting Player ID, buying Owner, certificate identity, and
expected price. The title supplies eligible buyers, source restrictions, price,
payment recipients, ordered payers, and ownership/certificate limits. Shared code
reevaluates the purchase at application, settles cash atomically, transfers the certificate,
clears its previous pool, and records the actual payment legs in Action metadata.
The buyer is an Owner; buying does not imply holding a presidency. Rules remain
runtime dependencies, outside serialized state and Actions.

The three-player 1889 example uses 19 certificates and 60% ownership, IPO at par,
and Market at market price. TOP uses 20 certificates and 60%, current market
price, and Bank or issuing-company treasury sources. Union Bank pays from its
own cash first, then its private Owner supplies the balance; Union Bank receives
the certificate. A purchase for Union Bank consumes its once-per-stock-round
opportunity. Prior sales are recorded against the buying Owner, independently of
the player directing that Owner.

The original purchase examples use floated majors. The formation positions also permit purchases in started companies before they float. Purchases and sales now settle presidency
exchanges, and 1889 market zones affect certificate and ownership limits. Company
formation and flotation are implemented in slice 4. PEIR's variable interest and reserved
exchange certificates are not ordinary purchase options.

The family review for purchase evaluation, payments, Action/state flow, and shared confirmation
covers the same full catalog and ownership/finance profiles above, plus the study's
stock-round/action-order and capitalization variations. Company investors require
separate actor/buyer identities; different capitalization schemes require an explicit
recipient rather than inferring one from an IPO label. Different share denominations
require title pricing of a certificate; limits use share units and weighted certificate
counts. Ordered payers exercise TOP's required contribution without conflating
control with liability. Shorts, escrow, and unusual multi-buy procedures remain
future work. The stock-round handler enters its configured next state when the
whole round completes.

Engine tests verify exact payment and certificate ownership for both Bank and
treasury sales, Union Bank contributions, reserved/unavailable certificates,
unaffordable purchases, actor/buyer authorization, prior sales, limits, stale prices,
flotation restrictions, and presidency exchanges. Hydration accepts serialized and already
hydrated input while preserving strict validation at the serialized boundary.
Undo and processed replay reproduce cash, certificates, round facts, and turn state.
Desktop/mobile browser checks exercise manual selection, Back, confirmation,
purchase history, reload, Undo, and title switching.


## Share sales and stock markets

`StockMarket` records distinct spaces and ordered stacks of company markers.
The company market price is queried from that position. Both title packages author
their printed market values and colors; explicit connections control movement.
`SellShares` records a selling Owner and ordered company/share-quantity blocks.
Evaluation reports exact ordinary certificates, proceeds at the old price,
presidency exchanges, and resulting market spaces. Settlement preserves the
president's certificate outside the Market. Cash, certificates, and market changes
are captured in the same processed trade.

1889 uses per-share downward movement, a 50% Market limit, no first-round sales,
clockwise successors, and its yellow/orange exemptions. TOP uses per-block downward
movement, a 30% sale limit, prior operation, and Union Bank's distinct tie and sale
rules. Several company blocks may be ordered in one sale for converging markers.
The examples support sales on each title's permitted side of one purchase, followed
by Finish turn. The 1889 initial position ties Alex and Blair in Iyo to demonstrate
presidency transfer on buying. TOP gives Alex an ordinary Souris share so the sale
preview can include multiple companies.

See the [slice 3 design and research review](../../research/18xx/stock-trading-slice-design.md)
for the full-catalog survey, interface choices, verification, and remaining scope.


## Company formation and flotation

The shared `StartCompany` action establishes presidency and starting market price
through the same share-acquisition/payment settlement used by `BuyShares`.
`FloatCompany` is a System Action scheduled by the stock handler after a qualifying
trade; its title rules supply initial capital and any inseparable exchange effects.
Company facts separately record starting, initial funding, flotation, operation and
closure. TOP branches can be funded before flotation and receive no second grant.

TOP uses tranches, phase-dependent starting prices, and player-owned PEIR shares as
start eligibility. Flotation exchanges the PEIR share, replaces its station,
resolves presidencies and permits any forced ownership-limit excess. The final
exchange closes PEIR and the King's Mail and discards PEIR cash. Train holdings do
not exist in these examples; train disposal must join this closure in the train slice.
1889 floats at 50% outside its IPO, grants ten times par, and keeps its home reserved
until the operating round. Station placement and reservation are separate facts.

The harness offers Share trading, Starting companies, and Flotation positions,
each persisted separately. Company and price choices are manual stages; Back
unwinds them and Undo reverses the triggering purchase together with flotation.
Reload defaults to the trading position; selecting a saved position restores its
committed state. Earlier fixture versions remain preserved. See the [formation design and evidence](../../research/18xx/company-formation-slice-design.md).

## Stock-round progression and operating sets

`StockRules.round` supplies pass invalidation, next-player ordering, and sold-out
eligibility. TOP retains other players' passes when someone acts again; 1889 clears
consecutive passes after a transaction. Common TurnManager advances active players,
resets per-turn budgets, and keeps round-long sale history and Union Bank usage.

`CompleteStockRound` applies sold-out marker movements in stock-market order and
records the next stock round's player order. `StartOperatingSet` independently
records the phase-dependent round count and first operating order through the
title's `OperatingRules`. The count remains fixed if the phase later changes.
TOP places open PEIR last; Union Bank does not receive an operating turn.

The prototype exposes Pass or Finish turn, current player and pass status, operating
order, next stock priority, history, and Undo. Engine tests verify multi-player
progression, round budgets, pass semantics, movement, snapshots, rejection, replay,
and Undo. Desktop browser checks verify those interactions and saved completion.
Mobile presentation is deferred with the disposable finance UI. See the
[round design and family evidence](../../research/18xx/stock-round-slice-design.md).
