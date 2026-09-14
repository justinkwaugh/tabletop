# Complete stock rounds and establish operating sets

## Evidence and family review

This slice surveys all 131 title profiles in the research package's pinned
`data/title-traits.json`, rather than treating agreement between TOP and 1889 as
a family invariant. The relevant assignments are share transaction order (131
assignments, 130 titles), round sequence (208, 129), actor order (388, 129), and
passing/completion (429, 129), market topology (142, 130), and stock-price
movement (515, 130). Missing coverage remains an evidence gap. These are
classification records, not independently verified complete game simulations.

The research package's `18xx-domain-model-study.md`, “Decision order, interrupted
procedures, and pending obligations,” supplies the mechanism review. Its evidence
and title profiles distinguish:

- Transaction completion from passing, retained pass order, sale-only turns that
  count as passes in 1825, and conversion-specific completion in 18OE.
- After-last-actor priority, pass-order priority, 1822 cash ordering, and fixed or
  independently ordered decision makers.
- Ordinary stock/operating sets, consecutive stock rounds in 1822Africa, stock
  turns interleaved with operations in 1866, and stock interruptions in 1880.
- Sold-out bonuses (110 title profiles), Market-held share penalties (22), and
  exceptional market-cell movement. 1846 combines sold-out movement with a
  Market-share block drop; its pinned `game.rb` defines that policy at line 129.
- Market order, minors first, par order, special operators, and titles that
  recalculate operating order during an operating round.
- Pending formation choices, compulsory cleanup, and reactions to transactions
  that must resolve before the ordinary decision resumes.

The supplied TOP prototype rulebook §§6.1–6.2, 6.8–6.9, 7.1, and 14 and supplied
Shikoku 1889 rulebook §§7.1, 7.7, and 8 establish the executable behavior. Pinned
production definitions at `715567bdc7e5cc68a68a286b21dc8edd1a125e50`, TOP
`phases.rb` and 1889 `game.rb`, corroborate the phase/count tables. No external
implementation was copied or translated.

TOP keeps the current stock round's numbered order fixed. Passing awards the
lowest free next-round position; resuming removes only that player's position and
compacts the remaining order. Acting for Union Bank consumes its controlling
player's turn budget and the Bank's once-per-round allowance. It never creates a
separate human turn. Reserved exchanges and Union Bank shares count as sold out;
Bank and other company treasury shares do not. Sold-out markers move up in market
order, staying put at the top. PEIR operates last while open.

1889 ends after consecutive passes. A transaction resets that sequence; a player
may resume on their next turn. The next player after the final passer gets priority;
if nobody traded, the original order remains. Sold-out means all shares held by
players. Shares in either Bank pool prevent the bonus. Sold-out markers move up in
market order, staying put at the top.

TOP operating counts: 2H/3H = 1; 4H/5H/6H/2+/3+ = 2; 4+/7/D = 3.
1889 operating counts: 2 = 1; 3/4 = 2; 5/6/D = 3. Counts are recorded when the
operating set starts, so later phase changes do not silently change that set.

## Shared assets and title-owned choices

`StockRound` records completed status and ordered passed player IDs, alongside
existing sale history and company purchase usage. `StockTurn.acted` distinguishes
an untouched turn from one containing a stock action independently of its purchase
budget. Purchases, starts, and sales record activity and invalidate passes through
`recordStockAction`. Automatic flotation does not spend another stock action.
Later voluntary exchanges and splits must explicitly participate in this same
activity/budget procedure.

`StockRoundRules`, supplied as `StockRules.round`, selects pass invalidation and
calculates the next player order and sold-out eligibility. These decisions have two
real consumers. A callback for next order preserves the distinction between pass
semantics and priority rules. The implemented pass options cover these titles;
1825's sale-only pass rule and response/auction completion need a different turn
completion policy when implemented. This slice does not claim to handle them.

`FinishStockTurn` records whether the turn was a pass, closes the Common TurnManager
turn, and advances the next player unless everyone has passed. Advancing resets
only the turn budget. Round sale restrictions and Union Bank usage remain intact.
The same UI button says Pass for an untouched turn and Finish turn after activity.
Exceeding stock limits prevents finishing; pending flotation resolves first.

`StockRoundHandler` schedules `CompleteStockRound` after the final pass. That system
action updates priority and applies sold-out moves once, in the market order before
any moves. Common market utilities preserve stack arrival order. Its history
metadata records movement endpoints and next player order. It does not choose the
next kind of round. The current completion action implements the upward sold-out
bonus shared by TOP and 1889. Market-holdings penalties and exceptional sold-out
movement require extending this procedure when a consumer needs them; upward
one-space movement is not asserted as a family invariant.

The title runtime composes stock completion with `StartOperatingSetHandler` and
`StartOperatingSet`. `OperatingRules` supplies the count and initial company order.
`OperatingSet` records set number, round number, fixed round count, and company
order for the current round. Future operating-round progression recalculates order
at the prescribed boundary; this is not one immutable order for the entire set.
Keeping this transition separate lets other calendars reuse stock completion.

The current example stops at an explicit OperatingSet state with no operating
Actions. Its active player identity remains available for Common hotseat Undo;
the display shows the upcoming company order and controlling owners, not a claim
that the final passer controls operations. Establishing individual company turns
and any home decisions belongs to the operating slices.

## Presentation and persistence

The prototype stock panel displays the acting player, current turn order, and
passes (ordered cards for TOP, consecutive passes for 1889). The completed view
shows set length, first operating order and controlling owners, and next stock
round's player order. History includes turn finishes, passes, market adjustments,
and the operating-set start. There is no UI-triggered automatic gameplay.

Existing staged choices keep their Common Game Session lifecycle. Finishing is
disabled while a manual choice is open; Back and Undo retain their existing roles.
One Undo reverses the final pass and both automatic transitions. Earlier turn
finishes can be undone across hotseat player changes through Common's existing
behavior. No host contract changes are needed.

The harness uses fixture version 7, preserving earlier saved fixtures. StockRound
replaces the old TradingShares serialized example state; StartingOperatingSet and
OperatingSet replace the terminal InspectFinances example. Reload restores the
committed game, including player order, pass status, and completion.

## Verification

Engine scenarios cover all-pass/no-trade priority, turn advancement, transaction
completion versus pass, resuming after passing, retained versus reset passes,
round-long sale and Union Bank restrictions, phase snapshots, sold-out ownership
categories, market arrival order and top-edge behavior, excluded unstarted and
closed companies, action authority, deterministic system identities, canonical
hydration, processed replay, and complete final-pass Undo.

Desktop browser scenarios exercise player handoff, pass display, complete
rounds in both titles, saved completion after reload, Undo into the final stock
turn, and replaying that completion without duplicating its consequences. Existing
purchase/sale/formation browser scenarios remain applicable.

Mobile refinement and mobile-specific tests for this slice are deferred at the
user's request; the finance interface is a disposable logic prototype.

Verification completed: 109 shared logic tests and 70 paired finance/stock tests
pass, including 17 round-progression cases. Nine desktop browser checks pass.
Shared logic/UI, both title logic/UI builds, shared UI and harness type checks, and
the harness production build pass. The running `/economy` route responds normally.

A saved-fixture regression reproduced “Complete canonical state is required” by
placing the previous stock-state schema under the current example name. Selecting
by name alone reached canonical loading before compatibility could be handled.
The harness now preserves that save, selects another canonically loadable matching
example or creates a fresh one, and continues to surface unrelated errors. The
reproduction and both saved-example browser checks pass, as does the harness type
check. Canonical state validation itself is unchanged.

### Stock action strip presentation

The stock action strip reuses legal session choices and staged selection rather
than imposing a stock action sequence. The variation catalog's conventional
1830-family turns, 1841 corporate owners, and 1817-family special stock actions
motivate a persistent category selector with title-supplied additions. Only the
existing TOP/1889 categories are implemented; this adds no new trading rules.
Owner selection remains within Buy/Start and supports multiple eligible owners.
TOP supplies Split without a family dependency on TOP. Switching categories must
clear prior drafts; Pass/End turn commits separately. Browser checks cover legal
categories, persistent selection, and switching from Split into ordinary trading.
