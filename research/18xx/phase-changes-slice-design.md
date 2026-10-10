# Phase changes, train rusting, and interrupted operations

Surveyed the full research catalog: technology triggers (171 assignments across
129 titles), retirement (193/129), event application (362/130), train limits
(148/128), and interrupting decisions (488/129). Read the domain study's technology
and decision-order sections and the paired rulebooks. Counterexamples include
18MS scheduled salvage, 18Carolinas aggregate power loss, 1880's suspended whole
round, 1882's particular-train events, and titles with persistent trains. The
corresponding primary procedures confirm these are distinct from ordinary rusting.
Unresolved profiles are evidence gaps, not proof a mechanism is absent.
Use rusting for obsolete trains; salvage, capacity loss, and compulsory discards
retain their distinct meanings. An owned train awaiting its final opportunity
is marked rustsAfterOperation.

Implement identified phase occurrences, title-owned rust timing and discard order,
and a saved operating continuation using existing Actions and handlers. Each
occurrence records the triggering train and phases; replay cannot reapply it.
This slice implements purchase-triggered phase occurrences; exports, particular
train events without phase changes, salvage, capacity loss, and nested round
suspension remain extensions, rather than invented generic event infrastructure.
Tile colors, revenue stages, train limits, and TOP starting prices already read
phaseId. OperatingSet.roundCount remains its existing snapshot.

TOP §§7.6,13.2,14: current capacity is checked before purchase, rusting is immediate,
excess trains leave the game, and 4+ trains with no prior operating opportunity survive diesel until their
next operating opportunity. They cannot be traded. Completing that company's run
step consumes this opportunity, including a zero/suboptimal submitted run; it does
not grant indefinite survival by omitting the train. TOP's rulebook does not order
simultaneous discards; use triggering company first, then market order, PEIR last.
1889 §§8.7.1–8.7.4,9: excess trains return to Market; discards start with the buying
company, then descending market order. A company at capacity cannot buy even when
rusting would create space. A 4/5/6 can be exchanged for a diesel for 800 after
phase 6; the exchanged train returns to Market and a 4 rusts immediately. Market
trains retain identity/prior use and are separate from new depot supply.

BuyTrain saves a pending phase change and continuation. AdvancePhase applies
phase/rusting effects and queues excess companies. DiscardTrain changes the
active decision maker while retaining the original operator and its purchase
allowance. Once obligations are resolved, the saved machine state and controlling
owner resume. No extra player action starts or finishes the interruption.
Delayed rusting uses an automatic RustTrains action after
RunTrains. Ownership, availability, and pending rusting remain distinct facts.

Prototype controls display phase effects, pending company and owner, excess count,
train selection, and what resumes. Discard and diesel-exchange selections are
manual session state. Back clears selection; Undo clears manual selection before
committed history. History/visible-state updates hide drafts and beforeNewState
clears them. Components only invoke session methods. Fixtures avoid emergency
funding and phase-triggered private powers, integrated in slices 13–14. Game-ending
triggers remain in the ending slice.

Verification: 139 shared logic tests, six title tests, and 142 harness tests pass
(the additional final-operation route case was run in the focused ten-test phase
suite). Twelve browser checks pass across phase changes, depot purchases, routes,
and ordinary operating rounds. All shared/title builds and all four Svelte checks
pass. Tests cover pending-discard hydration, deterministic flattened replay and
Undo, preserved operating turns/allowances/set length, 1889 exchange price and
Market identity, and TOP rusting after both a submitted route and an unused
final operating opportunity.

## Header phase chart

The shared header shows the operating company's existing token. Clicking the phase
opens a native modal dialog with a full-viewport backdrop, focus containment,
Escape/close/backdrop dismissal, and focus restoration. This is local presentation,
not an Action, and does not alter history or the current phase.

The catalog survey above also guides this presentation: train introduction and
phases are not universally one-to-one, and rusting differs from obsolescence,
salvage and capacity loss. Phase rows and train roster rows are therefore separate
display data. TOP and 1889 build theirs from existing title-owned phase order,
tile colors, OR counts, train limits, depot supply/prices, and rust-phase tables.
Existing constant tables are exported for reuse without changing rule behavior.
No shared package imports a title. The small assembly helper covers these titles'
phase-triggered rusting; other titles can supply the display data directly and
need explicit presentation for richer events rather than inventing rust triggers.

TOP's owned 4+ operating-opportunity exception remains visible beside the schedule. 1889's
diesel availability/trade-in and private closure exception are described below
the tables. The chart shows each phase’s OR count without a separate explanatory note about set length.
Browser verification covers both title charts, current-phase highlighting,
operating token, keyboard dismissal/focus return, and backdrop dismissal.

## TOP's first operating opportunity — review finding 8

Confirmed with the user on 2026-10-03: a 4+ loses its first-opportunity protection
when its owning company settles earnings, including empty routes and routes that
omit that train. Buying a train later in the turn does not consume its opportunity.
The pinned reference's `step/dividend.rb` marks every owned train operated, and
`g_1871/game.rb` uses persistent `ever_operated` for diesel grace. Actual route use
and an operating opportunity are distinct facts.

Rechecked all 193 retirement assignments across 129 researched titles: 120 assign
immediate rust, 30 obsolescence and 30 final operation; other assignments include
maintenance, persistent trains, capacity loss and salvage. These are overlapping
assignments, not mutually exclusive title counts. 1830 and 1889 need ordinary
immediate rust; 1846's obsolete trains receive a final operation independently of
prior use. Only TOP directly queries `ever_operated` in the pinned title source.
The survey's unresolved profiles remain evidence gaps.

The shared earnings Action exposes an optional `afterDistribution` policy callback
after settlement and private effects. TOP alone records
`fourPlusTrainIdsWithOperatingOpportunity`; the other titles acquire no state
property. IDs persist across ownership changes. An absent record means no recorded
opportunity. Trains no longer record `hasRun` (2026-10-10): a train that runs is owned
when its company settles earnings, so it is already in this record before any phase can
change. The existing TOP save fixture is in phase
3H, before 4+ acquisition, so no compatibility reader or migration is needed.
This implements TOP's specific lifetime fact, not a general train-history system.

Regression cases cover pre-diesel empty routes, omission while another train runs,
ownership changes, a fresh 4+ purchased after earnings, immediate diesel rust,
existing used/unused post-diesel final opportunities, and settlement replay/Undo.
The phase-chart explanation uses operating opportunity rather than actual use.
