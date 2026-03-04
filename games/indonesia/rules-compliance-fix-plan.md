# Indonesia Rules Compliance Fix Plan

Date: 2026-03-05  
Source of review: `games/indonesia/indonesia-rules-09-EN.pdf` (text only)

## Scope Decisions (Confirmed)

1. Mandatory free expansion after fully selling goods must be maxed.
2. Delivery tie-break rule is only: maximize delivered amount.
3. Siap Saji adjacency after merger is an implicit confirmed rule.

Note: Prior review item `P1 #6` (Siap Saji auto-removal beyond halving) is excluded from this plan per the confirmed rule interpretation.

## Prioritized Backlog

## P0-A: Endgame Transition from Era C and Final Resolution

Problem:
- Era progression can attempt to increment beyond `C`, causing failure instead of ending game.
- End-of-game winner calculation/tie-break is not fully implemented.
- Last-earnings-double flow is not implemented.

Primary files:
- `src/stateHandlers/operationsFlow.ts`
- `src/model/gameState.ts`
- `src/stateHandlers/endOfGame.ts`
- `src/definition/stateHandlers.ts`

Planned changes:
1. Add explicit branch in operations flow: when era is `C` and New Era trigger is reached, transition into endgame resolution path (do not call era increment).
2. Implement endgame settlement:
- Compute final totals including bank + cash.
- Apply turn-order tie-break for equal totals.
- Set `winningPlayerIds` and terminal game result fields.
3. Implement last-earnings ledger lifecycle:
- Track per-player current-year operations earnings separately from cash.
- During non-final transitions: transfer ledger into cash at next-year start.
- During final resolution: double ledger and apply to final totals.
- Support negative ledger values.

Tests to add/update:
- Era C complete operations -> no crash, transitions to endgame.
- Endgame winner determination with tie-break by turn order.
- Last-earnings carry-over vs final doubling, including negative earnings.

## P0-B: Mandatory Company Operation (Skip Only When Truly Non-Operable)

Problem:
- Current operability logic risks conflating non-profitable operations with truly impossible operations.
- Clarification: profitability is not a skip criterion.
- Clarification: a company may be skipped only when it has no legal operation at all.

Primary files:
- `src/model/gameState.ts`
- `src/stateHandlers/operations.ts`
- `src/stateHandlers/researchAndDevelopment.ts`
- `src/actions/chooseOperatingCompany.ts` (and related action validators)

Planned changes:
1. Redefine “operable in round” as:
- owned + unoperated + has at least one legal operation branch.
- If none exists, the company is skippable.
2. Encode explicit skip criteria examples:
- Shipping company at max ships with no legal ship placement is skippable.
- Production company with no possible delivery and no legal expansion space is skippable.
3. Keep profitability out of operability decisions:
- If an operation is legal but unprofitable, it is still operable.
4. Ensure operations round progression remains correct with mixed operable/skippable companies.
5. Respect mandatory maxed free expansion when rules require it, as part of any legal production operation.

Tests to add/update:
- Shipping at cap/no legal placement is skipped.
- Production with no delivery and no expansion space is skipped.
- Legal-but-unprofitable production operation is still considered operable.
- Round progression with mixed operable and skippable companies.
- Mandatory-max free expansion case coverage.

## P1: Shipping Expansion Same-Area Placement

Problem:
- Validation disallows placing a new ship into a sea area where the company already has ships.

Primary files:
- `src/model/gameState.ts`
- Any shipping expansion validators/actions in `src/actions/*`

Planned changes:
1. Permit same-area placement as legal seed/continuation location.
2. Preserve existing constraints:
- company era cap,
- per-operation expansion allowance,
- adjacency chaining behavior.

Tests to add/update:
- Add ship into existing occupied company sea area.
- Ensure caps/limits still enforce correctly.

## P2: Immediate Delivered-Goods Cleanup When City Growth Is Skipped

Problem:
- If no city can grow, delivered-goods cleanup can be deferred until next operations entry.

Primary files:
- `src/stateHandlers/operationsFlow.ts`
- `src/stateHandlers/cityGrowth.ts`

Planned changes:
1. Guarantee demand/delivered-goods reset executes at end of operations regardless of whether City Growth state is entered.
2. Keep existing behavior when City Growth does run.

Tests to add/update:
- End of operations with no growable city still clears delivered markers immediately.
- Existing city growth path remains unchanged.

## P3: Turn-Order Bid Integer Validation

Problem:
- Bid action accepts non-negative numbers, including fractions.

Primary files:
- `src/actions/placeTurnOrderBid.ts`

Planned changes:
1. Require integer bid amounts.
2. Keep non-negative and affordability checks.

Tests to add/update:
- Fractional bid rejected.
- Integer edge cases accepted/rejected appropriately.

## Execution Order

1. `P0-A` endgame + ledger (foundation).
2. `P0-B` mandatory operations semantics.
3. `P1` shipping same-area placement.
4. `P2` immediate cleanup.
5. `P3` bid integer validation.

## Risks / Watchouts

1. Endgame and earnings-ledger changes affect scoring and many existing tests; isolate with dedicated fixtures.
2. Mandatory operation semantics may change UI assumptions for “selectable company” lists.
3. Delivery/expansion enforcement must not violate the “maximize delivered amount” constraint.
