# Finances (slice 1)

The shared model separates companies, the bank, asset ownership, certificate pools,
cash, and company management. Both title packages supply reduced example positions
through the Common Game Runtime and Game Session. These are inspection examples,
not complete game setup or playable variants.

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
supports zero and fractional counts. Market-dependent recalculation belongs to
later rules. The ordinary-certificate authoring helper creates a two-share
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
companies, trains, and round progression are omitted. TOP uses the supplied
prototype's King's Mail income of 60, with the edition discrepancy documented in
the title README.

## Runtime and presentation

`FinanceExampleState` is an inspection example built on Common Game State with a
financial fields at the root. Its initializer requires three players, uses their stable
IDs, and authors deterministic asset IDs. `InspectFinances` is a terminal machine
state without Actions, active players, or results. Each title exports a Definition
and UiDefinition using the standard Game Session; no shared host contract changed.

`Portfolio` renders owned certificates grouped into their owner's certificate pools.
`FinanceInspector` arranges player portfolios, company treasuries, and Bank cash
and certificates. Companies show their President or private Owner and their
Controlling Owner. TOP adds PEIR's dividend entitlement through a snippet. These
are provisional layouts, with no purchase Actions or other financial mutations.

The Finances page at the existing `/economy` route uses the existing local harness to persist examples.
The host identifies this schema's examples with the versioned name
`Finances example · 2`. Earlier inspection examples are preserved, and a new
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
ownership caps, presidency exchanges, company formation, full setup, and payments.
Those rules remain title-owned as they are added.

## Verification

Model tests cover ownership independently of pool membership, mismatched pool
owners, private ownership, direct and indirect presidencies, circular control,
weighted certificate limits, retirement, cash validation, and JSON hydration.
Both title examples run through `GameEngine.startGame` and retain their ownership
when players are reordered or recolored. TOP verifies the changing PEIR denominator
and presidency. Browser checks cover desktop/mobile presentation, title switching,
current-example reload, and preserving earlier examples while creating a current one.
