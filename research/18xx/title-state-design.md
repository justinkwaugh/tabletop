# Composed title state

Each title selects its fields and machine states with `composeEighteenXXState` and
its invariants with `defineEighteenXXState`. Composition adds only Common's Game
State envelope. There is no universal 18xx canonical schema or inherited class
containing every mechanism.

The schema determines both the raw and hydrated title types. Hydration validates
untrusted input, clones it, supplies Common's hydrated behavior, and runs the
selected invariants. An unsupported field is absent from the title type and rejected
by its closed schema. A supported decision can still be optional while inactive.
The title's exact types survive opening, initialization, handlers, runtime, scenarios,
Game Session, history, and dehydration.

## Mechanism selection

`RailwayFields` is an explicit convenience bundle for the stock/operating-round
runtime used by the four current titles. It includes ordinary finance, stock rounds,
operating sets, construction, stations, trains, phases, routes, earnings, purchase
offers, emergency train funding, and ending records. It is not a prerequisite for
state composition. A regression fixture composes and hydrates a bidding-only state
without companies, stock rounds, trains, or loans.

Additional selections are title-owned:

| Title | Selected mechanisms beyond the railway bundle                                                                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TOP   | Offer-pile auction, tranches, ownership exemptions, track consent, company roles, numbered shares                                                                                            |
| 1889  | Waterfall auction, private-power usage, pending private track, between-company private windows and requests                                                                                  |
| 1830  | Waterfall auction, private-power usage, pending private station, par after award, multiple stock-turn purchases, its brown-zone option                                                       |
| 1817  | Selection auction, company auction, borrowing, cash crises and player elimination, shorts, private-power usage, location markers, its options, private lay records, mergers and acquisitions |

Nested company and certificate schemas are selected too. Ordinary companies do not
acquire loan or role properties; ordinary certificates do not acquire short positions
or numbered shares. Shared finance invariants validate financial fields and references
while allowing extensions owned by the title schema. The title's closed schema still
rejects undeclared nested fields. A charter-company fixture verifies a new title-owned
company field without changing the family company definition.

`EighteenXXState` and `EighteenXXRuntimeSchema` without a title parameter are structural
views used by the existing shared runtime and UI. Their optional mechanism fields
allow shared queries to examine inactive or absent mechanisms. They are not schemas
used to initialize or persist titles. `HydratedEighteenXXState<typeof TitleState>`
contains exactly that title's fields and Common's methods, without those optional
fields being inherited from a family class.

Private usage reads and writes share helpers. Reading an absent tracker reports no
recorded use; consuming a power requires its tracker to exist. TOP has no such tracker:
its early-train private closes on use. The initializer creates the tracker only when
the title schema selects it. Granting an ownership exemption similarly requires the
selected collection instead of silently adding a feature to an unsupported title.

At runtime assembly, selected auction, loan, cash-crisis, company-auction, pending-par,
multiple-buy and related decision fields must agree with their rules. Declared machine
states and registered handlers must match exactly. Title rounds retain their own
sequencing and may wrap family decisions; selecting loans does not impose another
title's interest policy.

## Evidence surveyed

The full `research/18xx-2026-09-08/data/title-traits.json` assignment index covers 131
titles. Borrowing profiles include 82 titles tagged without standard loans, 22 with
corporate loans, and 27 with player loans. Allocation profiles include 46 waterfall,
13 selection, 11 bid-box, 20 open-draft, and five without initial private allocation.
These are scoped assignments, not mutually exclusive partitions; unresolved profiles
are not evidence of absence.

The domain-model study's ownership, borrowing, initial allocation, formation, and
round-sequence sections supply counterexamples to a universal base:

- 1867 snapshots loan quantities for interest; 1848 changes the lender and market
  consequences. Loan data and sequencing belong to selected mechanisms and policies.
- 1846's draft and 1822's committed bid boxes need different pending state from a
  waterfall or TOP's offer pile. No auction is mandatory for composition.
- 1825 release bands and 1862 charter obligations differ from TOP's tranches.
  Reusable formation logic must not require every title to carry tranches.
- 1817's merger/acquisition rounds, 1856's CGR formation, and 1867/1822 minor mergers
  need title-selected records. 1866's continuous stock/operating sequence challenges
  treating the current stock/operating runtime as the definition of the whole family.

The implemented scope is composition and validation of the four existing consumers,
plus an independent minimal-state fixture. It does not implement the other surveyed
mechanisms or introduce a feature-plugin framework. The existing stock/operating
runtime still requires its railway mechanisms and policies; titles with other
calendars can use the same state composition and individual mechanisms with a
different runtime.

## Saved states and publication

The only existing hosted save is one TOP game. TOP owns a reader that removes its
obsolete `usedPrivatePowerIds` field only when it is an empty array. There are no
compatibility readers for 1889, 1830, or 1817; their recorded test fixtures have been
updated to omit unused `tranches` and `ownershipLimitExemptions` instead.

Only TOP's known empty array is removed. Nonempty unsupported collections, malformed
values, unrelated properties, and undeclared nested fields remain errors. Canonical
validation and hydration use the same reader; current dehydration emits only the
selected schema. No rules record, financial value, action input, or action metadata is
migrated. Canonical schema snapshots and the TOP/1889 opening digests change deliberately;
action schema digests and handled machine states remain unchanged.

This is a serialized-state change. The existing TOP game can load through its reader,
but its older client requires a field the new logic no longer writes. TOP's release
must establish a Logic major-version boundary and publish matching Logic and UI
Artifacts. The other titles need matching current Logic/UI artifacts, without a saved-game
migration. Package version selection and actual artifact rollout belong to release;
this change does not publish anything. Rolling TOP back to old logic after new state is
written requires restoring its empty power tracker.

The Game UI Host Bridge Contract has no runtime change. Shared UI state access now
preserves each title's concrete types. Shared exploration controls expose their
commands rather than mutable title-specific contexts. A Site Frontend publication
alone cannot update the Game Client bundled into a title's UI Artifact.

## Verification

Each title has runtime rejection, hydration/copy isolation, and static state-shape
checks. TOP also verifies its saved-state reader. Fixtures cover a required title field, nested title-owned
company data, a state without railway mechanisms, and mismatched rule/state or
handler/state selection. Existing behavior, history, replay, and Undo suites exercise
the actual compositions, including full recorded games for all four titles.
Family/title builds, all four title UI checks, shared UI/client checks,
the playground check, and the new state-shape type assertions also pass.

The recorded TOP fixture remains unchanged on disk. Its latest state and all 181
recorded transitions are checked after removing only the obsolete empty power tracker;
its active player's available actions remain unchanged. Historical pre-automatic-offer
identifier exceptions remain the same as before this refactor.

The earlier 2026-10-03 type-preservation change established the generic runtime and
session path without changing serialized state. This composition change retains that
path and replaces its universal family-schema constraint. The earlier mixed-artifact
compatibility results apply to that type-only revision, not to this schema migration.
