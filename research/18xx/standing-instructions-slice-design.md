# Standing instructions: auto-pass and auto-buy declared out of turn

Tracking issue: [#88](https://github.com/justinkwaugh/tabletop/issues/88).
Architecture decision: [ADR 0007, Out-of-Turn Actions](../../docs/adr/0007-out-of-turn-actions.md).

## Evidence and family review

The mechanism is not a rule of any title. It is a play convenience: a player who
knows what they will do on their next stock turn should not make the table wait.
The research package's decision-order review, "Decision order, interrupted
procedures, and pending obligations" in `18xx-domain-model-study.md`, and the
"Passing and completion" trait (consecutive passes, all actors passed, pass order
retained, pass reset after specified actions) establish what a declared pass must
respect: passing contributes to round completion under the title's rule, and a
transaction by the same player invalidates earlier passes in pass-reset titles.
The [stock round slice](stock-round-slice-design.md) already encodes those
variations in `StockRoundRules`; a standing pass reuses `FinishStockTurn` and so
inherits them without a second pass model.

The reference implementation offers programmed stock purchases and passes to
every title by default and extends the idea to auction bids (18EU, 18MT), merger
round passes (1817, 1832, 1867, 18NewEngland), a draft and independent-mine
skips (1873), and closing-round passes (Rolling Stock). It also self-disables on
threatened control, forced sales, and mixed certificate sizes. That catalog is
evidence of demand and of the conditions players expect to stop automation. Its
program classes, auto-action generation, and validation mode were not copied.

Counterexamples considered for the interface:

- Titles where a player can buy for a company they control (TOP's Union Bank,
  1841 corporate holdings). The instruction buys for the player only and must
  never act for a company buyer: the evaluator fixes the buyer to the player and
  never consults the title's buyer list, and a TOP test holds that line. A
  buyer choice remains available on `BuyShares` for hand play.
- Titles with sell-then-buy versus buy-then-sell ordering and with multiple
  purchases per turn. The evaluator asks the composed handler what is available
  and asks `evaluateSharePurchase` for legality, so it follows whatever the
  title's stock rules permit rather than assuming one purchase.
- Titles whose stock round interleaves with operations (1866) or is interrupted
  (1880). The instruction lives on `StockRound` and ends with it; it does not
  claim to survive interleaving, which would need a lifetime rule.
- Certificate pools differ by title (IPO and market in 1889; market and company
  treasuries in TOP). No researched title offers a company's shares from more
  than two places at once: the company-side supply (IPO or treasury, never both)
  and the market; 1841's player-to-player purchase is negotiated and out of
  scope. The instruction therefore names one preferred pool and derives the
  seller from it; when that pool holds none of the company's shares the
  evaluator buys the cheapest legal alternative, and when the preferred pool
  holds shares it never substitutes another price.

## Shared assets and title-owned choices

Common gains Out-of-Turn Actions: an action type whose schema requires the
literal `outOfTurn: true`. The engine accepts it from a seated non-active player,
tolerates an index behind the current count, rejects the marker on undeclared
types, and leaves validity to the handler. Undo never offers such an action as a
candidate, does not treat it as another player's blocking action, and reapplies
it after reversing a suffix that contained it. When asked for a non-active
player's valid actions, the engine consults the handler and reports only that
player's out-of-turn types, which is how the Game Client learns a waiting
player may declare. The backend supersedes the same
player's latest unconsumed declaration of the same type at the tail of history
before applying a replacement, so repeated toggling cannot grow the Canonical
Action History; growth is bounded by real actions interleaved between toggles.
Supersede applies only while the declaration is the last action, so a
declaration the machine has already acted on is never reversed, and the host
validates the replacement against the reversed state before persisting the
reversal, so an invalid replacement such as clearing at the tail leaves history
intact and fails as an ordinary invalid action. Local games supersede in the
Game Client the same way.

`@tabletop/18xx` records a `StandingStockInstruction` per player in
`stockRound.instructions`: the instruction (pass, or buy company from pool until
floated or until N shares, optionally then pass) and a position snapshot taken
when it was set. `SetStockInstruction` sets or clears it; at most one per
player. `StockInstructionHandler` decorates the StockRound state outside the
automatic-turn and company-decision wrappers. On entry, once the inner handler
has scheduled nothing, it evaluates the current player's instruction and
schedules `FinishStockTurn` or `BuyShares` as System Actions, or
`StopStockInstruction` with a structured reason: a code plus the company and pool
ids it concerns, or a title-owned key. Wording lives in the UI, which maps codes
to text and lets a title supply text for its own keys. It validates a System pass, purchase, or
stop only when the evaluator would produce exactly that action. Instructions
clear when the stock round completes.

Stop conditions compare the current position to the snapshot rather than
scanning history: stock limits exceeded, a company started, a presidency changed
to someone other than the owner, bank-held shares of any company increased, a
rival's holding grew in a company the owner presides over without a majority,
mixed certificate sizes in the target pool, no eligible certificate, or a purchase
`evaluateSharePurchase` rejects, classified as unaffordable, ownership limit,
certificate limit, or a source the title does not sell from. Because a stop is a
System Action in the cascade of the action that brought the owner's turn around,
undoing the change that caused it reverses the stop with the rest of that suffix
and the instruction is reinstated; the 1889 suite verifies this. `BuyShares` now accepts a System source for
this path; its legality checks are unchanged.

Title extension points live on `StockRules.instructions`, so no runtime wiring
changes when a title needs them: `securePresidency` replaces the family's
majority test for "presidency threatened" (1817-style control rules);
`titleSnapshot` records a flat record of scalar facts next to the family
snapshot when an instruction is set or converted, for titles whose cancel rules
depend on data the family snapshot does not carry (loans, phase, tranche
state); and `positionChange` wraps the family cancel rules, receiving them as a
thunk so a title can add checks before or after, or replace them. The family
snapshot rows stay fixed so every title's stored instruction has the same core
shape. A title needing a new instruction kind adds its own action types and a
decorator handler in the same pattern rather than widening the family union.

Not implemented now: instructions that survive the round, per-buyer choice,
private visibility (the field carries a stable player id so the Owner policy
could apply later), and instructions for auction or merger rounds in other
titles, which would reuse the out-of-turn action and evaluator shape with
different evaluators.

## Presentation and persistence

A compact bar pinned to the bottom of the stock action body offers Autopass and
Autobuy to any seated player during a stock round in networked play. In local
hotseat play outside the developer harness it is hidden, since one person plays
every seat in turn, except while the client views as a non-active player, where the Game Client reports
only that player's out-of-turn actions as valid so the declaration can be made
for them and shows only the player's
own standing instruction with any pending stop reason and a Cancel; it never
presents other players' instructions. The form is local UI
state outside Back and Undo. Automatic passes and purchases render exactly like
the same actions taken by hand, and no history surface shows a declaration or
stop; they are navigation bookkeeping. Game State stays public, so this is a
presentation rule rather than enforced visibility.

The state field and the two action types are additive. Existing histories never
contain them, and the deployed TOP game's replay guards are untouched. The
runtime-contract snapshots changed for every action type because the base
`GameAction` schema gained the optional `outOfTurn` field; the change is additive.
Adopting the feature in hosted play needs a logic-changing Publication for each
title and a republished Site Frontend for the supersede and undo behavior.

## Verification

- Common: `outOfTurnAction.spec.ts` (accepted from a non-active player, stale
  index tolerated, marker rejected on undeclared types) and
  `actionHistory.spec.ts` (supersede lookup).
- 1889: `standingInstructions.spec.ts` covers out-of-turn declaration, automatic
  pass on the next turn with undo restoring the declared state, automatic
  purchase with the follow-up pass, a stop after another player's sale, immediate
  firing when the acting player declares, clearing, and a rejected purchase.
- UI: `stockInstructionModule.svelte.spec.ts`.
- Backend: `outOfTurnActions.spec.ts` drives `GameService` against a stateful
  fake store: a waiting player's declaration is accepted, a repeated declaration
  supersedes the tail one, an intervening action prevents supersede, and another
  player's Undo succeeds past a declaration and re-applies it.
