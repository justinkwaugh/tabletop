# Standing instructions: stops a player chooses to ignore

Follows the [standing instructions slice](standing-instructions-slice-design.md).
Prompted by player feedback asking to switch off the reasons an Autopass or
Autobuy cancels itself. There is no tracking issue; the design was agreed in
conversation on 2026-10-23.

## Evidence and family review

Stopping an instruction is a play convenience, not a rule of any title, so the
survey covers what players are protected from and which protections they may
waive, not rulebook text.

The reference implementation's stock-round programs stop on a forced sale and
on "shenanigans" by other players since the program was set: a company parred,
a share bought into a company the owner presides over insecurely, shares sold,
a company redeeming a player's share, a company taking a loan, and, for safety,
any action it does not recognise
(`step/buy_sell_par_shares.rb`, `should_stop_applying_program` and
`action_is_shenanigan?`). Its only waiver is all or nothing: the share-pass
program carries an `unconditional` flag ("Even when players take actions that
may impact you"), offered as a checkbox on the pass form only, never on a
programmed purchase (`action/program_share_pass.rb`,
`assets/app/view/game/auto_action/share_pass.rb`). Rolling Stock forces it on
(`force_unconditional_stock_pass?`). The flag is evidence that
players want to waive protections; the one switch is evidence that a coarse
waiver is all anyone has tried, not that finer choice is unwanted.

Titles extend the stop list with their own conditions: 1817 stops on a short
bought, 18USA on a train scrapped, 1822 on losing a winning bid, 1849 on a
20% double certificate coming available, 18GB on a company converting to ten
shares. In this repository those are title-owned stop reasons
(`code: 'title'`) produced through `StockRules.instructions.positionChange`; no
current title supplies one, but the hook is where they will live.

Counterexamples considered:

- **Forced or impossible stops.** Exceeding a stock limit, an unreachable or met
  Autobuy goal, mixed certificate sizes, and a purchase the title refuses are
  not protections against other players: the instruction cannot act correctly
  past them. They stay non-ignorable in every title.
- **Purchases versus passes.** The reference waives protections for passes only.
  Here a buy may waive them too: the shares-sold and presidency checks protect a
  buyer from paying into a falling or contested company as much as they protect
  a passer, and a player who watches the board and still wants the share should
  be able to say so. The goal and refusal checks still protect the purchase.
- **Coarse versus per-reason.** One switch would match the reference, but the
  feedback asked for individual reasons, and the family reasons are independent:
  a player may not care about new companies starting yet still want to stop if
  their presidency is threatened.
- **Saved preference versus per instruction.** The user judged the choice
  situational: which changes matter depends on the board when the instruction is
  set. Nothing carries across instructions, rounds, or games.
- **Title reasons.** Making title-owned reasons ignorable would need each title
  to name and describe them as switches. They stay always on until a title shows
  a need.

## Shared behaviour and title-owned choices

`@tabletop/18xx` defines the four ignorable family stops once, as
`ignorableStockInstructionStops` (`company-started`, `president-changed`,
`shares-sold`, `presidency-threatened`), and adds an optional, ordered,
duplicate-free `ignoredStops` list to both instruction kinds. The family
position check (`familyPositionChange`) skips an ignored stop; a title's
`positionChange` hook still receives the family check as a thunk and so
inherits the waiver without knowing about it. When an Autobuy meets its goal
and turns into a pass, the pass keeps the buy's ignored stops.

A new supersedable Out-of-Turn Action, `SetStockInstructionStops`, sets the list
on the player's instruction without retaking its position snapshot. A
replacement `SetStockInstruction` could not do this: supersession replays the
history without the original declaration and applies the replacement at the
tail, so the snapshot would be retaken there and a different pending change
would be lost silently.

A stop no longer deletes the instruction. `StopStockInstruction` records the
reason on it as `stopReason`, and the instruction stays in
`stockRound.instructions`, ignored by evaluation, until the player declares
again or the round completes. `SetStockInstructionStops` on a stopped
instruction resumes it with its original snapshot, so a second change it had not
yet reported stops it again at once with that reason. The stop the Site shows is
read from this State rather than reconstructed from history.

Titles choose nothing new: no hook was added. A title wanting its own reasons to
be ignorable would extend the ignorable list through `StockRules.instructions`
with keys and text it owns.

Not implemented now: ignoring title-owned reasons, waiving the forced and
impossible stops, a saved default, and any presentation to other players.

## Presentation

The bar stays one line. The "?" popover becomes the control: while a kind is
selected or an instruction runs, the four ignorable stops are switches under
"You choose" and the forced ones are bullets under "Always". The running
summary gains a muted "· ignores <stops>" suffix, the "Stops next turn" warning
an Ignore link, and the stopped notice a "Keep going, ignore <stop>" link that
resumes the instruction. Every new instruction starts watching every stop. The
full contract is in `libs/18xx-ui/ui-interaction-visual-contract.md`, Standing
instructions.

## Persistence and release

Both instruction kinds, `StopStockInstruction`'s replacement, and the
standing-instruction State record gain optional fields, and
`SetStockInstructionStops` is a new action type, so every 18xx title's
runtime-contract snapshot changes and old logic would reject new actions: each
title needs a logic major. Existing histories hold none of the new fields; an
instruction that stopped before the change was deleted then and simply shows no
stop notice.

Cancelling or re-declaring after a stops change cannot supersede the original
declaration, because replaying the stops change without it fails; the client
appends the replacement instead, so history keeps one extra record per change.

## Verification

- 1889 `standingInstructions.spec.ts`, "Ignored stops": an ignored sale no longer
  stops an Autopass; a stops change keeps the snapshot and switching back on
  restores the earlier stop; the then-pass conversion keeps ignored stops; a
  stops change needs an instruction; a resumed instruction stops again for a
  president change hidden behind the sale that stopped it; cancelling after a
  stops change appends rather than supersedes and leaks no stops; declared lists
  are stored ordered and without duplicates.
- UI: `stockInstructionModule.svelte.spec.ts` covers declaring with ignored
  stops, Ignore, Keep going, and the stopped instruction read from State.
- The 18xx playground drove the full flow in TOP: switches on a draft and a
  running instruction, a sale producing the warning and Ignore, the stop notice,
  and Keep going.
