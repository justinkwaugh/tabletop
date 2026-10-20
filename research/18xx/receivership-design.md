# Player elimination and receivership

Makes a bankrupt player's exit and a presidentless company's operation family
behaviour, selected by title rules, rather than a title's own runtime. Built for 1846
on 2026-10-19, replacing its own funding, bankruptcy and receiver states.

## Evidence surveyed

The September 8 title-profile assignments for failure consequences (178: 75 game-ending,
33 player-elimination, 27 continued-debt, 16 reorganization, 11 receivership, 8
liquidation, 7 bankruptcy) and control resolution (190). Counterexamples kept in view:
1889 and TOP end the game on a funding bankruptcy; 1817 eliminates on a cash crisis and
liquidates the player's companies; 1846 eliminates on a funding bankruptcy, passes
presidencies to the largest holders and puts the rest into receivership; 1848's
receivership follows exhausted bank loans; 1860 keeps receivership and bankruptcy
distinct and forbids president contributions.

## Shared behaviour and title-owned choices

**Elimination.** `EliminationRules { schema, eliminate(state, playerId) }` is one policy
for every way a player leaves: the family then surrenders their cash to the creditor
(the company whose train they could not fund, or the bank for a debt), removes them from
the turn order and the stock round, and records them in `bankruptPlayerIds`. The
bankruptcy Action records the policy's changes under the title's schema
(`DeclareBankruptcy.metadata.changes`, `GoBankrupt.metadata.changes`). A funding
bankruptcy without `trainFundingRules.elimination` still ends the game through
`Bankrupt`, as 1889 and TOP need. Final wealth still ranks every player, eliminated or
not; whether a bankrupt player may win is a title's ending question, not the family's.

**Continuation after a funding bankruptcy.** A successor president inherits the
obligation in the same `FundingTrain`; without one, a title with `receivershipRules`
continues in `BuyingTrains`, where the receiver buys what it can afford; otherwise the
turn ends.

**Receivership.** A started, open share company with no president whose president
certificate lies in a pool is in receivership (`inReceivership`). `ReceivershipRules`
supplies who acts for it (`operators`, 1846: every surviving player) and the terms on
which a presidency comes back out of the market (`presidencyClaim`, 1846: a 10% holder
pays the share price for half of the president's certificate when no other share of it is
in the market), which the shared `ClaimPresidency` Action applies as a stock turn's
purchase. The operating steps wrap in `ReceivershipHandler`: the receiver lays nothing,
its receivers run its trains, its only earnings choice applies itself, and it buys the
cheapest train it can afford when it needs one, or is excused. `actsFor` lets any
receiver act where a controlling owner would.

Title-owned: what elimination disposes of and how (1846: forced sales at price without
moving it, presidencies to the largest holders, independents and privates closed; 1817:
liquidation), who the receivers are, and the claim terms.

## Examples that verify the decision

`games/1846/src/trainFunding.spec.ts` and `receivership.spec.ts`: funding under 1846's
rules, automatic bankruptcy once funding is exhausted, successor and receivership
continuations, the receiver's automatic turn, presidency recovery, and the last-survivor
ending. 1817's bankruptcy spec covers the cash-crisis elimination.
