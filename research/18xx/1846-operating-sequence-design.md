# 1846 first operating set

Connect existing operating procedures across companies and both operating rounds,
stopping before the second stock round. Phase-II trains, emergency finance and
corporate private acquisition remain outside this slice.

## Evidence and variation

GMT 2021 §6 and §6.1 specify two ORs after each stock round, private income at the
start of each, MS then Big 4, then majors in market order. Only the game's first OR
reverses the major price order; ties retain stock-space stack order (§4.31).
Reference snapshot 715567bdc7e5cc68a68a286b21dc8edd1a125e50:
g_1846/game.rb operating_order and operating_round; g_1846/round/operating.rb.
The normal three-to-five-player schedule inherits the base stock/operating-set
loop; the special two-player draft loop is explicitly excluded.

Surveyed all round-sequence (208 assignments) and actor-order (388 assignments)
profiles. Stock/OR sets appear in 123 profiles; special merger/acquisition,
exchange/formation, pre-operating choices and event-altered sets are meaningful
counterexamples. Market-price order appears in 125 assignments, minors first in
48, recalculated company order in 20, and first-OR low-price order in six.
These overlapping classifications include evidence gaps. 1830/1889's phase-based
OR counts, 1817's intervening acquisition procedures and TOP's special operators
are not assumed to follow 1846's fixed two-round sequence.

## Design

Reuse nextOperatingCompany, canStartOperatingRound, canStartStockRound and the
existing StartOperatingTurn/StartOperatingRound System Actions. A title-local
transition function chooses the next company, next OR, or ReadyForStockRound.
Major finish, independent settlement and closure share that decision. Round startup
recomputes order and resets completed companies through the shared Action, paying
private income once. No redundant user confirmation or new serialized fields.

1846's Steamboat choice remains before operations in each OR; skipping retains
its prior assignment. Existing operation steps reset normally on completion and
initialize on their next entry. The final boundary retains the exhausted set until
a future StartStockRound Action marks it complete and initializes trading. No
winner or additional OR is fabricated.

The ordinary train handler's action union now excludes FundTrain. Its emergency
subclass widens only its own action parameter and handles that action before
delegating, preserving the existing runtime constructor and funding behavior.

UI headings show the actual OR identity and the final stock-round boundary.
Existing History, action metadata, session submission and Undo contracts apply;
no host protocol or local transient selection changes.

## Verification

Exercise two majors at unequal prices through both ORs; verify low-to-high then
high-to-low order, controlling-player handoff, fresh operation steps, purchased
train usage and dividends, private income exactly twice, Steamboat persistence,
closure handoff, the no-major case, final boundary and full replay/reversal.

Validation: all 790 tests across the shared engine and five titles passed, including
three new sequence tests. Existing titles type-check; title logic/UI checks, lint,
package builds and bundles passed (existing dependency bundle warnings remain).
The native desktop walkthrough reached OR 1.2 after IC finished, reopened Steamboat
assignment and paid the next private income. Undo restored OR 1.1, train buying and
the pre-income player balances. Repeating Finish and completing OR 2 reached the
second-stock-round boundary with the correct Priority Deal holder.
