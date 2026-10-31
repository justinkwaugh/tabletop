# Run instructions: a company runs its best routes and pays without its president

Architecture decision: [ADR 0013, Actions carry the runs a client solved](../../docs/adr/0013-actions-carry-client-solved-runs.md).
Follows the [standing instructions slice](standing-instructions-slice-design.md) and
[its ignorable stops](standing-instruction-stops-design.md). There is no tracking issue;
the design was agreed in conversation on 2026-10-28.

## The problem

Late in a game a president often wants a company to do nothing but run and pay
out: lay no track, place no station, buy no train. Running is the hard part.
Most rules expect a company to earn the most its trains can, and finding that
run needs the autorouter, a WebAssembly search that runs only in clients. The
Game Runtime cannot call it: the search is bounded by wall-clock time, so two
machines could reach different answers from the same Game State, and Game
Logic must be deterministic.

A client can afford to solve whenever something changes. Across 1,434 solver
problems taken from six recorded finished games, the median solve is under a
millisecond. The combination search was reworked for this feature (see the
[autorouter design](autorouter-design.md)): before, late-game 1832 systems with
four trains took seconds and six did not finish in a minute; now the slowest
takes about 0.3 s in WebAssembly, inside the one-second limit.

## The decision, as agreed

- Only the company's president declares a Run Instruction, and their client
  attaches the company's best run, found by an exhaustive solve.
- While it stands, any player whose action could change that run solves it
  again in their own client and attaches the new run to that action. All
  clients are trusted to solve honestly.
- When the company operates, the runtime applies the stored run without
  solving: it finishes track and stations, runs the stored routes, pays out,
  and finishes the turn without buying a train.
- The instruction stops, so the president plays the turn by hand, when the
  company loses a train, when the run earns less than the run the president
  declared, when a client could not solve exhaustively, or when the turn needs
  a decision the instruction cannot make. A player may tell it to ignore the
  train-loss and lower-run stops, per company, as with Autopass.

## Evidence and family review

Running for the most revenue is a rule in most researched titles and a
convention everywhere else. The user ruled it effectively required for this
site, so the instruction must never run anything but the best run the solver
proves.

The reference implementation has no operating program. Its closest relative is
1873's `ProgramIndependentMines` (`lib/engine/action/program_independent_mines.rb`),
which skips a mine's track, train buying and closing for the mines' fixed
revenue; mines have no routes, so it says nothing about running. Its stock
programs (`program_share_pass.rb`, `program_buy_shares.rb`) are the evidence
for stopping on other players' "shenanigans" that the Autopass design already
recorded. No researched implementation runs trains automatically, so the run
refresh below has no precedent to copy.

The operating turn varies by title. An instruction takes no decision that is not
required, as the user put it, so each title's extras matter only where they are
compulsory:

- Family steps only: TOP, Shikoku 1889 and 1830 lay track, place a station, run,
  distribute and buy trains, with private powers in timing windows.
- 1846 drops the station step and adds issuing and redeeming shares, title
  track actions (`additionalConstructionActions`) and its own decision handlers.
- 1832 adds coal rights during construction and systems.
- 1817 adds loans, interest, the `RepayingLoans` step and liquidation.

Optional extras inside a step (issuing or redeeming shares, coal rights,
revenue tokens, taking or repaying loans) are passed over: a step's finish action
is offered only once everything compulsory is done, so finishing never skips a
required decision. 1817's `RepayingLoans` step pays interest automatically and
then finishes the turn. Decisions outside the instructed company's turn are not
its to make: 1846's steamboat assignment belongs to the player who owns the
private, at the start of the round; 1832's price protection, redemption consent
and merger phase belong to other presidents or happen between turns. A title
state the instruction does not drive pauses the turn for the president rather
than deciding.

Counterexamples considered:

- **A forced train purchase.** A company with no train that must buy one cannot
  skip buying, so the instruction stops. It cannot buy on the president's
  behalf: which train, and whether the president pays, are decisions.
- **Earnings choices.** Pay and withhold exist everywhere; 1817 adds half-pay.
  The instruction records the choice it makes, and a choice the title does not
  offer at that moment stops it. The first consumers offer pay only in the
  Site; the record keeps room for the others.
- **Zero revenue.** A company that runs nothing withholds automatically, as it
  does without the instruction.
- **Receivership.** A company in receivership has no president to declare one,
  and its receiver already operates automatically.
- **A new president.** The instruction belongs to the player who declared it,
  not to the company. If presidency moves, the next evaluation removes it.
- **Train changes.** A rusted, exported or discarded train lowers the run; a
  train the president moves in from another company changes it. Both are
  ordinary refresh triggers. A lost train stops it, whatever the run earns; a
  train moved in only changes the run.
- **Phase changes.** Higher offboard values raise the run; a refresh keeps the
  stored run optimal, and a higher run never stops anything.
- **Blocked stations and lost connections.** Another company's station or a
  tile upgrade can lower the run. That is the "someone hurt my run" stop.

## Shared behaviour

### State

`runInstructions` is an optional list in the family state's route fields, one
`StandingRunInstruction` per company:

- `companyId`, `playerId`: the company and the president who declared it.
- `payout`: the earnings choice it makes.
- `declaredRevenue` and `declaredTrainIds`: the run's revenue when declared and
  every train the company owned then, the baselines for a lower run and a lost
  train.
- `runs`: a non-empty list of Instructed Runs. The first is the run for the
  company's next operating turn. Each is either `{ routes, key }` or
  `{ unsolved: true, key }`.
- `ignoredStops` and `stopReason`, as for stock instructions.

`key` identifies the solver input the run was solved for: the part of the
autorouter's encoded problem the company can reach (the track and revenue
centers connected to its stations, short of blocked or forbidden stops, with its
trains, values and bonuses there), named by map identity so that changes
elsewhere on the map leave it unchanged. The runtime never reads it; clients
compare it with the key of the current position to decide whether to solve.
Across the six recorded finished games it changes about half as often as a
whole-map key and costs slightly less to compute (about 1 ms); wherever it stayed
the same, the solver's best revenue stayed the same.

### Actions

- `SetRunInstruction` (out of turn) declares or clears the instruction for one
  company. A declaration carries the payout, ignored stops and the first run.
  A clear that names the declaration it replaces withdraws it.
- `SetRunInstructionStops` (out of turn) changes ignored stops. An instruction
  stopped for a stop it now ignores resumes against its declared baseline; one
  stopped for any other reason stays stopped.
- Both are supersedable per company: they require `supersessionScope:
'companyId'` (ADR 0008's amendment), so a replacement supersedes the same
  player's earlier declaration for the same company, and toggling replaces the
  standing declaration instead of growing history. A declaration that has
  already acted cannot be superseded; the client appends then, so growth is
  bounded by the turns that actually happened.
- `StopRunInstruction` (System) records why the instruction stopped, or removes
  it when its player no longer presides.
- Every 18xx action may carry `instructedRuns`: for each company, the list of
  runs to store. The runtime replaces the company's `runs` with it when it
  processes the action, before the action's System cascade continues.

### Undo and explorations

A declaration made on the president's own turn runs that turn at once, inside
the declaration's own cascade. ADR 0007 treated every unsequenced declaration as
having no dependents, so such a declaration could not be undone, and undoing an
earlier action re-applied it and replayed the turn. The ADR now treats a
declaration the machine acted on in its own cascade like any other User Action:
it is an Undo target, it blocks another player's Undo, and it is not re-applied.
The shared `isStandingDeclaration` decides this from the action that follows it,
in the host's Undo, the Game Client's candidate and exploration Undo. Autopass
declared on one's own turn gains the same behaviour. A standing declaration that
Undo re-applies is dropped when the restored position no longer accepts it, such
as a cancel of an instruction the Undo itself removed, rather than failing the
Undo. It is also dropped when re-applying it would act at once, that is when its
cascade would hold anything after it: a run instruction whose company's turn the
Undo brought back, an Autopass whose stock turn it brought back, or a declaration
that would stop at once. Acting, or stopping, would be a turn of its own that
nobody took. The engine's `accepts` checks the first case without applying the
Action; the second is a cascade longer than the declaration. The Game Client's
Undo preview applies the same rule to every declaration it can read, rather than
replaying the host's patch.

Explorations start without live run instructions and never restore them on
Undo, as they already did for stock instructions.

### Consuming runs inside one cascade

A single action can carry several of a company's turns. Laying the last tile of
an operating round can run every instructed company, end the round, export a
train, rust others, and reach the same companies again in the next round.
Each company's turn uses `runs[0]`; after running, the runtime drops `runs[0]`
when another run follows it. A client therefore attaches one run for each
turn of the company the cascade reaches, then one for the position the cascade
ends in, and the last run stays stored for the next action.

### Evaluation

`RunInstructionHandler` decorates each family operating step. On entry, after
the step's own automatic actions have had their chance, it evaluates the
operating company's standing instruction:

1. Its player no longer presides: stop and remove it.
2. Before the run: `runs[0]` unsolved stops it (`routes-unsolved`); routes the
   current state rejects stop it (`routes-stale`); routes earning less than
   `declaredRevenue` stop it as `run-lowered`, unless that stop is ignored.
   Before all of these, a declared train the company no longer owns stops it as
   `train-lost`, whatever the run earns, unless that stop is ignored.
3. Then the step's own action: `FinishTrack`, `FinishStations`, `RunTrains`
   with `runs[0]`, `DistributeEarnings` with the payout (a payout the title
   does not offer stops it, `payout-unavailable`), and `FinishOperatingTurn` or
   `FinishTrains`; a company that must buy a train stops it (`must-buy-train`);
   in a title with loans, `FinishOperatingTurn` from the loan step.
4. It waits while another player's decision holds the step.

Only `train-lost` and `run-lowered` are ignorable. The others leave nothing
proven to apply or need the president.

A System action is valid only when the evaluation would produce exactly it,
so replaying a recorded cascade checks it against State alone and never needs
the attached runs or a solver.

### The client

The Game Session solves through the title's route worker with a one-second
limit. Before submitting any action while a run instruction is declared, it:

1. executes the action locally and walks the cascade's transitions;
2. lists, in cascade order, the position before each System `RunTrains` an
   instruction made, then each declared company's final position while its
   player still presides; each company's positions are numbered in that order,
   as the runtime spends its runs in order;
3. finds the earliest position whose key differs from the key of the run the
   runtime would use there, solves that one position, and attaches it as that
   company's run at that number, keeping the runs its earlier positions used;
4. executes the action again with the attachments, and repeats from step 2
   until no position is stale.

A run attached for one position cannot change any earlier position: earlier
positions depend only on what happened before them, and each company spends its
runs in order. So each round settles one more position, every position that
needs a solve is solved exactly once, and the pass ends after as many rounds as
there were stale positions. Attaching is what lets a cascade go further than a
stale run allowed: a company stopped at its turn by a stale run runs once the
right run is attached, and the cascade may then reach later instructed turns.

A position the solver cannot finish attaches `{ unsolved: true }`, which stops
the instruction when the company next operates. A declaration may carry runs for
the company it declares, for turns its own cascade reaches.

The declaration solves the current position the same way.

## Title-owned choices

A title opts in with `runInstructions: true` on its rules, and needs the
autorouter's encoder to support its route rules. TOP, Shikoku 1889, 1830, 1846,
1832 and 1817 opt in. Titles with hidden information (1846's draft) refresh runs
by executing the Action in the client's own view, as the Game Session does.

## Not implemented now

- Choosing withhold or half-pay in the Site.
- A history marker for automatic turns; they read like turns taken by hand.
- Repairing an `unsolved` run in the runtime. A later action's client refreshes
  it, or the president plays the turn.

## Presentation

Run instructions belong to their president's view, as Autopass does. The
instruction bar at the bottom of the current action panel, in every round,
carries an "Autorun" pill with a token for each open railway the viewer
presides over. Pressing a token turns its instruction on or off; a token that is
on has a green outline, and nothing else is written while it runs. Text appears
only for a problem: a run that could not be found, or the stop reason with "Keep
going, ignore …" for an ignorable stop. A "?" opens the stops: a grid with a row
per company and a switch per ignorable stop, chosen ahead for a company that is
off and declared at once for one that is on. Declaration and stop records are
bookkeeping that history does not show, as for Autopass. The full contract is in
`libs/18xx-ui/ui-interaction-visual-contract.md`, Run instructions.

## Persistence and release

Every 18xx action schema gains the optional `instructedRuns`, and three action
types and one optional State field are new, so every 18xx title's runtime
contract changes: each title needs a logic major and a UI republish, released
together. No existing history holds the new fields.

## Verification

- 1889 `runInstructions.spec.ts`, against the real engine and solver: an
  out-of-turn declaration, then the company finishing its turn by itself and
  Undo restoring the declared state; declarations only by the president with a
  legal run; runs attached to another player's action replacing the stored run,
  and attachments for an undeclared company rejected; a lower run stopping as
  `run-lowered` and resuming once ignored; a lost train stopping as
  `train-lost` even when the run earns as much; ignored train-loss and lower-run
  stops running on until the forced purchase stops it, which changing the
  ignored stops does not resume; an unsolved run stopping it; an attached run
  spent per turn with the last kept; a new president removing it.
- `shikokuAutorouter.spec.ts`: the problem key ignores where the turn stands and
  changes with the company, its trains and the phase.
- `@tabletop/18xx-ui`: `instructedRunRefresh.spec.ts` covers attaching runs from
  a simulated cascade with a fake solver, and `runInstructionModule.svelte.spec.ts`
  covers declaring, a failed solve, resuming and cancelling, and stops chosen
  before declaring being sent with the declaration and changed after it.
- Undo: `playerUndo.spec.ts` (a declaration that acted is the player's target and
  blocks another player's reach), the host's `outOfTurnActions.spec.ts` (it is
  undone without being re-applied), and 1889's run instruction spec (the
  president's own-turn declaration is their target; explorations drop live
  instructions).
- The 18xx playground drove 1889's operating-round position: declaring for the
  Iyo Railway ran its ¥90 run and paid; declaring for the Awa Railroad then
  operated the rest of the round and the next by themselves to the stock round.
