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
excess trains leave the game, and never-run 4+ trains survive diesel until their
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

TOP's never-run owned 4+ exception remains visible beside the schedule. 1889's
diesel availability/trade-in and private closure exception are described below
the tables. The chart shows each phase’s OR count without a separate explanatory note about set length.
Browser verification covers both title charts, current-phase highlighting,
operating token, keyboard dismissal/focus return, and backdrop dismissal.
