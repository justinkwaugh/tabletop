# 1846 recurring rounds and closure correction

## Scope and evidence

Continue from each two-OR set into a fresh stock round, then the next OR set,
within the existing phase-I feature coverage. GMT 2021 §§4.2, 5.51 and 6 specify
the stock/two-OR cycle, Priority Deal and first-OR-only reversed price order.
Reference snapshot 715567bdc7e5cc68a68a286b21dc8edd1a125e50:
game/base.rb next_round!, g_1846/game.rb operating_order and stock_round.
No auction, corporate-finance round or other intervening round belongs here.

Rule §8.1 removes a closed corporation's trains from the game. The new OR2
sequence made an owned-train closure reachable, exposing an incomplete title
CloseCorporation Action. Reproduction: launch GT40, buy and later sell one extra
share; the sale and stock-round market adjustment leave GT20. No-track OR1 pays
zero and falls to10, then buys a2. No-track OR2 pays zero and closes. Previously
the train remained owned by the closed company.

## Family variation and design

Rechecked the full round-sequence and actor-order profiles surveyed in the prior
sequence note: 208 and 388 assignments respectively. Ordinary stock/OR sets
(123 assignments) coexist with merger/acquisition (21), exchange/formation (18),
pre-operating choices (11), and event-altered OR sets (7). Player priority may
depend on the last actor, pass order, cash or special procedures. Reuse the
existing title rules and shared round startup; no family-wide fixed schedule or
priority invariant is introduced.

The failure-consequences survey covers 178 assignments: game end, elimination,
debt continuation, reorganization, receivership, liquidation, bankruptcy and
failure prevention. Closure is not interchangeable with bankruptcy or liquidation.
1846 removes trains; other titles can reclaim assets or auction them. Keep this
policy in the existing title closure Action and use shared trainsOwnedBy and
unownedTrain helpers to remove ownership with status 'removed'. Record
removedTrainIds alongside its other semantic metadata. No save compatibility
reader is needed for this unreleased title.

StartStockRound is already registered by stockActions. Add a title transition
handler that queues this System Action and uses canStartStockRound for validation.
The Action resets sales, purchase/pass flags and stock-turn state, marks the OR
set complete and starts Priority Deal's turn. Existing stock completion starts
the next numbered operating set. No new serialized feature fields or shared
handler abstraction is needed.

UI reads current round numbers and suppresses the previous set's operating-order
caption during trading. Existing controls, History and Undo apply. No host
contract or shared transient-state changes.

## Boundaries and verification

This is not a complete-game loop: later phases/trains, emergency finance,
inter-corporation train trading, corporate private purchases/powers and ending
rules remain deferred. Unlike the first-major slice, later companies can have
potential train-trade partners; those trades are an explicit unsupported choice.

Tests cover legal owned-train closure, removed-ID metadata, unrelated train
preservation, replay/Undo, correct next stock actor, fresh stock bookkeeping,
stock-round purchases, the next OR set's normal order, and repeated independent-only
sets without an automatic loop. Existing title stock tests cover ordinary trades,
sales, presidency, limit enforcement and stock-round completion.

Validation: 85 title tests and 18 shared stock/operating tests pass; logic/UI
checks, lint, package builds and both bundles pass. Dependency bundle warnings
are unchanged. The native desktop browser reached Stock round2 with Ben acting,
suppressed the completed OR caption, and offered the $80 IC treasury share.
Undo restored OR1.2 train buying; replaying Finish restored trading. Buying that
share and completing stock turns reached OR2.1 with IC treasury increased by $80.
No mobile or physical-artwork verification is claimed.
