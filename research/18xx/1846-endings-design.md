# 1846 endings and final valuation

Complete the 3–5-player ending rules. GMT 2021 §10.1 finishes the stock round
and two operating rounds in whose sequence the bank exhausts its cash; §10.2
ends immediately when one player remains solvent. §§10.3–10.4 value cash and
shares at final market prices, include printed values of surviving player-owned
privates/independents, exclude treasury assets, and allow tied winners.

The pinned reference's `g_1846/game.rb` GAME_END_CHECK and
game_end_check_values also end immediately when every corporation and company
has closed (`game/base.rb` game_end_check_all_closed?). An unstarted corporation
or an open private prevents this trigger. Final-train purchases trigger an
additional set only for two-player play; that variant remains deferred.

## Family scope

Surveyed the full end-triggers (287 assignments), end-timing (300) and
final-valuation (128) profiles in the research title-traits catalog. Bankruptcy,
bank exhaustion, market thresholds, technology events, fixed rounds, depletion
and closure have distinct finishing boundaries. Profiles include immediate,
current-round/operation/set and additional-set endings; valuation includes
cash/holdings, personal debt, corporate debt-adjusted share prices, special
assets and excluded participants. Unverified profiles remain evidence gaps.

Primary counterexamples: 1860's nationalization progresses through corporate
operations (`g_1860/game.rb` check_nationalize? and nationalization methods);
1867 adjusts final prices for corporate loans (`g_1867/game.rb` player_value);
1841 allows bankruptcy with a personal loan (`g_1841/game.rb` bankruptcy_options).
Existing TOP adds a set after a diesel; 1817 adds a set whose length depends on
the triggering OR and retains merger/acquisition activity. These rules cannot
be replaced by a universal bank-break or immediate-bankruptcy policy.

## Design

1846 composes the existing GameEnding feature, ScheduleGameEnd/EndGame Actions,
GameEndingHandler and final-wealth machinery. Wrap title handlers after private
purchase/power composition so a bank break is captured on the first transition,
including private income, share sales and corporate issuance. Existing GameOver
remains terminal and preserves the last-survivor result from bankruptcy.

Use the family's OperatingSet state identity for the exhausted-set boundary,
replacing the title's StartingStockRound name. Its existing handler still starts
stock trading unless the shared ending wrapper schedules final settlement. No
extra transition Action, compatibility reader, or shared boundary policy is
needed. The only new serialized feature is the shared optional gameEnding fact.

Extract the identical bank-exhaustion/current-sequence calculation from 1830 and
1889 into bankExhaustionAtSetEnd; all three titles reuse it. Trigger precedence
remains title-owned. Narrow FinalWealthScoring to its consumed finalWealth feature
so 1846 need not acquire unrelated family state. Valuation reuses existing title
policy. Immediate all-closed ending supersedes a scheduled bank break, and the
existing last-survivor bankruptcy result supersedes both.

Reuse the shared GameEnding UI by narrowing its session/position types to the
money formatter, player names and ending fields it actually reads. Existing
callers retain the same props and behavior. 1846 displays the pending final set,
reason, tied winners and final totals in the playground. No new local interaction,
automatic client action, host bridge field, or animation behavior is introduced.
Old/new Site Frontend and UI Artifacts remain compatible. 1846 needs its logic
and UI published together when released; other titles may adopt the equivalent
shared calculation/type narrowing on their next publication, with no coordinated
host release required. Nothing is published by this slice.

## Verification

Canonical tests cover bank exhaustion during the initial and later stock rounds,
private income and exact/overdrawn corporate issuance in OR2; continued payments,
the final two-OR boundary, immediate all-closed precedence, unstarted/open entity
exclusions, last-survivor precedence, final values, ties, read-only terminal state,
scoring export, and complete replay/Undo. A Phase IV purchase does not schedule
an ending for three players. Existing family/title suites check the shared helper
extraction; UI checks cover existing GameEnding consumers.

Validation: 969 tests pass across the shared engine, all five title suites and
playground stock/recorded-game regressions. Five recorded 1830/1889 cases initially
used stale title build output; rebuilding those packages and rerunning all five
resolved the failures. Shared/title builds, title and shared UI checks, playground
checks, touched lint and the new ending suite's strict type check pass. Browser
verification covers the final action, results, Undo and read-only History; see
the title visual contract for the fixture and observed totals.
