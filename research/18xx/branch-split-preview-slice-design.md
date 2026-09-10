# Slice 17A: TOP branch-split preview

The preview calculates TOP's branch split from canonical finances, stations, trains,
stock-round authority, and phase. Parent, branch, and starting-price selections are
manual Game Session drafts. There is no split Action or canonical split state in
this slice. A title-local evaluator returns eligibility failures or exact ownership,
certificate transfers, funding, and assets available for the later allocation.

## Evidence and family survey

The supplied `/workspace/TOP71_RULES_PROTOTYPE.pdf`, §§6.2, 6.7.1–6.7.5,
and its 50%/30%/20% worked example define this procedure. The full 130-title
catalog at `/workspace/research/18xx-2026-09-08/data/title-traits.json` was surveyed
for reorganization operations and settlement, company availability, control, and
capital release. Reorganization has profiles for 124 titles; six missing profiles
are evidence gaps. Scoped assignments include 45 without reorganization, 30
conversions, 41 mergers, 44 acquisitions, 19 nationalizations, and two splits or
secessions. Settlement assignments include 69 equity exchanges, 70 asset transfers,
71 token migrations, 63 cash compensations, and 15 treasury-funding procedures.
Counts overlap rather than partition titles. Availability has profiles for 128
titles; capital release for 129; control for all 130.

The domain study, variation catalog, and TOP rulebook comparison were consulted.
TOP's contextual eligibility and company definitions and 1841's Ferdinandea
secession were inspected to challenge the interface. 1841 replaces the original
company with prescribed successors and varies their company forms by version;
TOP retains a parent, lets the player choose a branch, and does not immediately
float that branch. Corporate ownership also prevents treating a controlling player
and a company-owned portfolio as the same account. 1817 liquidation, 1822 minor
acquisition, 1846 conversion, and 1861/1867 nationalization remain distinct
procedures; 1889 has no corporate split. This slice adds no universal reorganization
state machine or speculative family-level settlement format.

## Rule choices and model boundary

TOP owns all split-specific calculations. The existing shared helpers supply
company tranche availability, owner identity, portfolios, share-unit counts,
ordinary certificate selection, treasury balances, stock-market prices, and train
ownership. TOP's existing phase-dependent starting-price calculation now serves
both ordinary starts and branches. Reusable settlement helpers need no new policy
in this preview; 17B can consume the exact proposed certificate destinations.

Eligibility requires the acting player's stock turn before its purchase/start,
a floated ten-share parent, that player's presidency, four directly owned shares,
two placed stations, an unstarted branch, and tranche capacity. The rulebook's
explicit flotation requirement applies despite its absence from the contextual
eligibility predicate. Ownership of Union Bank does not combine its shares with
its owner's four-share threshold or make its owner the parent company's president.

Each player and Union Bank separately exchanges half their parent share units,
rounded down. The splitting player retains the parent president certificate and
receives the child president certificate. Ordinary certificate selection reuses
`certificatesForShares`, so certificate counts are not confused with share units.
The Bank's nonreserved parent shares are rounded together across its pools and
move only into the parent treasury; the Bank receives no branch certificates.
Reserved exchange shares and existing treasury shares remain in place. All
proposed transfers preserve existing certificate identities; nothing is retired
or synthesized by the preview.

The child receives its remaining Bank share units times its selected starting
price. Funding and flotation are separate: the preview shows the grant and the
additional shares that must leave the Bank to reach 60%. It lists the parent's
cash, trains, Hunslet, and placed stations, identifying the printed home that must
remain with the parent. Asset allocation, new branch homes, train-limit decisions,
and the stock-turn continuation belong to 17B.

TOP setup now includes all six initially unstarted branches with nine certificates
and four available station pieces each. Branch IDs are qualified to distinguish
Stratford Branch from the Shipbuilding private, which also uses SB. The preview
fixture uses Souris and the book's 50/30/20 ownership, three stations, $120, one
3H train, and Hunslet. The generic example-position selector has a TOP-only Branch
split option; 1889 receives no split model, Action, handler, or canonical fields.
Prototype save identity 25 keeps earlier setup examples separate.

## UI lifetime and verification

A TOP session subclass owns parent/branch/price draft stages through the
existing frontend staged-selection helpers. Changing an earlier selection clears
downstream choices. Back and draft-first Undo remove one manual stage. A fully
cleared draft lets Undo reach canonical history. All three stages require explicit
selection, even if only one option is eligible. Drafts hide during visible-state
updates and History View, clear in `beforeNewState`, and are never persisted.
The TOP table displays the calculation; shared UI never imports TOP.

Tests cover the worked example, separate owner rounding, reserved and treasury
shares, Bank pools, eligibility and tranche gates, changing phase prices,
certificate conservation, exact state preservation, branch identities, and 1889
regression. Browser checks cover dependent selections, Back, Undo, price changes,
reload, and canonical action invalidation of the preview.
