# Slice 19: game endings and final wealth

## Evidence and scope

Surveyed ending triggers, ending timing, and final valuation across all 130 titles
in the family trait catalog. Trigger and timing profiles cover 127 titles each;
valuation covers 128. Missing profiles remain evidence gaps. The trigger survey
includes 87 bank-exhaustion, 73 player-bankruptcy, 55 market-threshold, and 25
technology-event assignments. Timing includes 80 finish-set, 51 finish-round,
30 additional-set, and 78 immediate assignments. These overlap across titles.

The supplied Shikoku 1889 rulebook §10 requires bankruptcy to end immediately.
Bank exhaustion makes the Bank unlimited immediately, including the payment that
exhausts it. Finish the current OR set, or the next OR set when triggered in an SR.
Final wealth combines personal cash, shares at final market prices, and surviving
private face values. The bankrupt player remains eligible to win.

TOP's supplied prototype book §§8.1–8.3 and the end-game cheat sheet specify an
immediate bankruptcy ending, or completion of the diesel's OR set followed by one
final SR and three final ORs. The conflicting phase-summary shorthand remains
recorded in the rulebook comparison. This implementation uses the detailed §8.2
baseline proposed in the development plan. Remaining PEIR shares are worth $80
each. Union Bank's cash and stocks enter its owner's wealth, replacing its printed
purchase price. Ordinary company treasury cash, trains, and stations do not enter
player wealth independently of share value.

Reviewed contextual TOP valuation, 1841 debt-adjusted wealth, 1860 trainless-share
valuation, and 1880's three-round ending and importer settlement. These challenge
universal cash-plus-market-price scoring and a universal SR/OR ending sequence.
Research provides rules evidence only; implementation composes this repository's
cash settlement, portfolios, stock market, operating-set model, Actions, and handlers.

## Shared and title-owned responsibilities

`GameEnding` records a reason and, for deferred endings implemented now, the final
operating-set number. Absence of that number means immediate termination. The
number is fixed when the trigger is recorded; later rounds do not move the target.
An immediate trigger can replace a deferred schedule, so bankruptcy takes priority.
Other timing forms need an explicit later extension; this is not a universal
ending calendar. Each title supplies its trigger policy.

`ScheduleGameEnd` and `EndGame` are distinct System Actions, each with its own
schema and hydrated class. A handler wrapper checks ending consequences before
entering ordinary state handlers. Scheduling preserves the interrupted machine
state. At the final set boundary, termination takes precedence over starting an SR.
At bankruptcy it takes precedence over further operation. Ordinary phase effects
and required discards continue after a diesel trigger; the trigger does not end play.
The terminal `GameOver` handler exposes no Actions. Common's result and winner
fields are populated with stable player IDs; all tied leaders are retained.

Bank exhaustion belongs to shared payment settlement. Banks explicitly configured
with `unlimitedAfterExhaustion` pay in full at or below zero and retain a durable
`broken` flag. TOP's already-unlimited Bank does not trigger this transition.
Other finite balances still reject overdrafts. Validation remains atomic across
a payment batch, including the bank transition. Later deposits cannot reverse it.

Shared portfolio valuation supplies cash, certificate enumeration, market-share
values, itemized results, totals, and winner selection. Title policy supplies
certificate values. TOP expands Union Bank into its actual cash and stock items;
it does not credit those assets a second time through the charter's face value.
Only surviving certificates count. The implemented titles have no investment
ownership cycles; broader cross-company debt or recursive valuation requires a
separate policy, not speculative cycle handling here.

## Prototype and lifecycle

Both title tables display the canonical ending schedule and final itemized wealth.
The panel invokes the existing Session Undo method; it introduces no local draft
or gameplay Action initiation. History displays the results of its visible state.
The harness also reloads completed examples from its finished-games collection.
A new Final operating turn example starts immediately before the last company's
completion. The existing Diesel arrival and Bankruptcy examples exercise triggers.
The example version advances so older saved prototypes do not omit the new Bank
configuration or reuse a pre-scoring bankruptcy snapshot.

Verification covers finite-bank exact exhaustion and overspending, atomic rejection,
stock-round flotation causing exhaustion, deferred continuation, actual diesel
purchase, the final SR and three final ORs, bankruptcy precedence, tied winners,
Union Bank/PEIR/private valuation, terminal rejection, replay, reload and Undo.
Slice 18 remains deferred; manual route submission supplies authoritative revenue.

Share-sale affordability follows the payer's bank policy: a bank configured to become unlimited on exhaustion may fund the full sale, and ordinary cash settlement records the bank break. This applies to stock-round and compulsory-funding disposals. Finite banks without that policy retain their affordability restriction. Regression cases cover SR settlement/undo, emergency sales and completed train purchase, and the finite-bank counterexample.
