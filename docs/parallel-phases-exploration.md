# Parallel phases: design exploration

**Status:** exploration, 2026-10-10. Nothing here is decided and no engine work has started. The terms marked _provisional_ are working names, not glossary terms.

## Current direction in brief

Later sections were written in the order the ideas were worked out, and some revise earlier ones. This is where it stands.

- The Game stays an ordinary Game State Machine. At chosen Machine States a Player may take a **branch**: a private line of play from a branch point on the main line.
- A branch has its own Machine State, Action count, checksum and random cursors. Its Actions are ordinary Actions, private to the Player, and its net change is stored on the Game State so the Player's view needs nothing but the state.
- A Player sees the current shared state with their branch's changes applied. A branch never has to catch up with the main line.
- Branches change disjoint things and do not depend on what other branches change, so they can never conflict.
- A **Join** merges a branch onto the main line: its Actions are appended with final indices and their recorded changes applied, then a System Action moves the parent machine on. After a Join there is one ordinary history.
- A title chooses a **Barrier Join** (all finish, then all are applied) or an **Ordered Join** (a finished branch is applied once those ahead of it in Phase Order are, so a Player may wait to see them).
- Each seat has its own random stream, derived from the master seed.
- Contested or interactive play, such as selling and combat, stays in ordinary ordered Machine States.

## Why this exists

Some Game Titles have long stretches where every Player acts at once, each working through several steps. Stellar Horizons II is the driving case: its campaign is the goal, and its Footfall scenario is already implemented with a whole decade played simultaneously. Other titles have simultaneous parts that are entirely private.

The current engine treats such a stretch as one Machine State with several Active Players and one line of history. That works, but it has costs that showed up in Footfall, and it does not stretch to the campaign.

## What Footfall does today

- **One Machine State for the decade.** `PlayingTurn` keeps every Player active until they finish (`games/stellar-horizons-2/src/stateHandlers/playingTurn.ts`).
- **Each Player's position is a field.** `PlayerState.step` runs Build, Cargo, Movement, Exploration, Development, Done. Each Action checks only the acting Player's step.
- **One Simultaneous Action Group per decade.** The Game Client stamps turn Actions with `turn-<year>`, so the Game Runtime accepts them from a stale index.
- **Order-dependent work waits for everyone.** Exploring queues a survey; a later Machine State resolves the queue in initiative order. Tech costs count only ownership from before the decade.

This is one machine standing in for several. The problems below all come from that.

## Problems found

1. **One Player's dice lock everyone's Undo.** An Authorized Undo is refused if any Action from the target to the end of history is an Information-Revealing Action (`libs/backend-services/src/games/gameService.ts`, `undoAction`). `Explore` reveals a roll, so once any Player explores, no Player can undo anything they did before it.
2. **Waiting pays.** Every Action is visible as it happens. A Player who waits sees what others built, moved and rolled before choosing.
3. **Branches share a dice stream.** All rolls come from the one protected stream, so a Player's result depends on how many rolls others made first.
4. **Branches share pools.** Exploring draws tech markers from a common pool and developing a tech returns them. Draw order changes what others can draw.
5. **It cannot express the campaign.** The campaign needs several short simultaneous stretches per turn, separated by ordered and interactive phases (see below).

## The model: separate machines that join

During a simultaneous stretch, each Player runs their own machine. The stretch ends when every machine has finished, and order-dependent consequences are settled then.

Working vocabulary, all _provisional_:

- **Parallel Phase:** a stretch in which each participating Player acts independently.
- **Branch:** one Player's private line of play within a Parallel Phase, from a branch point on the main line to its Join.
- **Phase Order:** a total order over the branches, supplied by the title (for example initiative, or reverse initiative).
- **Commit:** the Action by which a Player finishes their branch.
- **Join:** the end of the phase, when all branches are committed and queued consequences resolve in Phase Order.
- **Hold:** a Player choosing not to act yet, to see the branches ahead of them.

### Order on request, by waiting

The Stellar Horizons rulebook says play within a phase is "generally simultaneous" and that initiative order applies "when order matters", naming who sees which ships are built, where ships move, attack order and trade order. So order is something a Player invokes, not the default.

The first idea was a visibility rule that gives that without any request protocol. It is superseded by the Ordered Join described under "Branches join one at a time", which gives the same information with no per-viewer rule. It is kept here for the reasoning:

- Actions in a branch are private until the branch is committed.
- A committed branch is visible to a Player when its owner is ahead of them in Phase Order, or when that Player has committed their own branch.

Consequences:

- A Player who does not care about order acts and commits. Everyone proceeds in parallel.
- A Player who does care holds, watches the branches ahead commit, then acts. They get exactly what strict order would have given them.
- A Player ahead in the order gains nothing by stalling, because they see nothing of later branches until they commit.
- Holds point one way along the order, so they cannot deadlock.

An explicit "wait for the players ahead" control is still worth having as interface, so others can see who is waiting on whom.

### Where order is forced

- **Contested resources.** When two branches can change the same thing, the outcome depends on order, not just knowledge. Selling to a shared demand marker is the campaign example. The branch structure below resolves this by keeping such interactions out of Parallel Phases, in an ordered phase.
- **Join queues.** Consequences that the rules resolve in order after a simultaneous step (surveys, anomalies, scarce card draws) are queued in the branch and settled at the Join. Footfall's surveys already work this way.
- **Interactive sequences.** Combat is ordered and involves both sides making choices. It is not a Parallel Phase.

## The driving case: a Stellar Horizons campaign turn

| Phase                         | Rulebook order                      | What couples Players                                                 | As a Parallel Phase                                    |
| ----------------------------- | ----------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| Economic (one event per turn) | varies                              | Blockade declarations; shared draws for trade goods and terraforming | Mostly; production and goods assignment are per-Player |
| Reduce transfer markers       | simultaneous                        | Nothing                                                              | Automatic                                              |
| Build and repair              | reverse initiative                  | Information only                                                     | Yes                                                    |
| Combat                        | initiative                          | Everything                                                           | No                                                     |
| Cargo and trade               | initiative                          | Selling to shared demand markers                                     | Partly; transfers yes, sales forced into order         |
| Movement                      | reverse initiative                  | Information only                                                     | Yes                                                    |
| Exploration                   | simultaneous; surveys by initiative | Surveys and anomalies                                                | Yes, with a Join queue                                 |
| Develop techs and buy cards   | simultaneous                        | Scarce cards                                                         | Yes, with a Join queue                                 |

So a campaign turn is several short Parallel Phases with ordered work between them, not one long branch. Footfall is the degenerate case: no combat or trade, so its phases can run together. A title whose simultaneous part is all private is the other end: one Parallel Phase with no holds, revealed at the Join.

Caveat: this table comes from the rulebook notes and the sequence-of-play chart. Card effects played out of turn have not been checked, and some player guide pages are missing from the sources.

## What this asks of the engine

Requirements, with the existing mechanism each one is closest to. These are starting points to examine, not designs.

- **Branch-scoped Undo.** Undo inside an uncommitted branch should look only at that branch, and stop at the Player's own Information-Revealing Actions. Today's Authorized Undo already reapplies other Players' Actions from the same Simultaneous Action Group; what blocks it is the reveal check covering the whole suffix.
- **Independent randomness per branch.** A roll in one branch must not depend on rolls in another, or replay after an Undo changes other Players' results. Today there is one protected stream with one cursor.
- **Shared pools drawn within branches.** Needs a rule that does not depend on arrival order.
- **Per-viewer, state-dependent visibility.** What a Player may see depends on Phase Order and on who has committed. Hidden-information delivery already projects Game State and Actions per Player Perspective and has Redacted Action Records. Whether its policies can express this rule is unverified.
- **Commit as an Action,** after which the branch's Actions are no longer Undo Candidates.
- **Holds and forced waits** that the site can tell apart from idleness. The site reads Active Players as the Players a Game is waiting on (noted in ADR 0009), so a holding Player and a blocked Player need a different status.
- **Join queues** resolved by System Actions in Phase Order.
- **Cheap phases.** A campaign turn enters and leaves several, alongside ordinary ordered Machine States. Which phases occur can vary by turn: combat is skipped when nobody can attack.
- **Independence checking.** The Commutation Proof (ADR 0009) already establishes that two Actions commute by executing both orders. It rejects Information-Revealing Actions today.

## Branch structure (direction, not decided)

Each branch is its own state machine: a **sub-machine** (_provisional_; "nested machine" is the alternative name). The engine already knows how to run a machine, so a branch should be something it can run the same way.

What exists: one execution loop (`libs/common/src/game/engine/gameEngine.ts`). For each Action it checks the Player is active, asks the handler for the current `machineState` whether the Action is valid, applies it, takes the next Machine State from the handler, records the Action (index and checksum), runs the next handler's entry, which may queue System Actions, and stores an undo patch that is the difference of the whole Game State.

Direction:

- **A branch is a specific object on Game State,** independent of the other branches. A title registers the sub-machine's Machine State Handlers alongside its main ones.
- **An Action for a branch is checked against the parent first:** the parent must be in a Machine State that hosts that sub-machine, and the branch must belong to the acting Player. The cascade then runs against the branch: its handler validates, the Action applies to the branch, the handler gives the branch's next Machine State, and entry handlers queue System Actions that stay in the branch.
- **The full Game State is supplied for reference, read-only.** The engine already wraps state for execution under a Player Perspective (`guardForExecution`), so there is a precedent for a guarded view.
- **A branch's terminal Machine State is its Commit.** The Join is the parent's transition once every branch is terminal.

What follows from "truly independent":

- **The branch carries its own engine bookkeeping.** Today every Action writes shared fields: `actionCount`, `actionChecksum` and the public stream's cursor used for System Action Identity. If a branch Action wrote those, branches would not be independent. A branch therefore needs its own Machine State, Action count and checksum, and cursors, which is also what lets the existing loop run on it unchanged.
- **Independence can be enforced, not just promised.** A branch Action's undo patch must touch only its branch. That is a cheap check on patch paths, and it makes Action Reversal of a branch Action its own patch alone: no reversing and replaying other Players' Actions, no Commutation Proof, and an index that is validated per branch instead of exempted by a Simultaneous Action Group.
- **Read-only is not enough on its own.** If shared state changes during the phase, what a branch reads depends on timing. This note first concluded that nothing shared may be written until one Join for all branches. That is revised under "Branches join one at a time": a branch may join while others continue, provided each later branch Action records the shared state it saw.
- **So contested interactions are not Parallel Phases.** Selling to a shared demand marker changes shared state mid-phase and is interactive. It belongs in an ordered phase. "Order on request" then covers only who sees what, which matches the rulebook's own examples of ships built and ships moved.
- **Whatever a branch changes must live in the branch.** In Stellar Horizons the ships, bases, cash, markers and techs a Player changes are theirs, but live in shared arrays today. Effects on shared things, such as queueing a survey or returning markers to a pool, become entries the branch records and the parent applies at the Join.
- **Privacy has one unit.** A branch is a single subtree to hide or show under the visibility rule.

Still open here:

- **Branch lifetime.** See the next section.
- **Canonical history.** Settled later: an open branch has its own history, merged onto the main line at the Join.
- **Active Players** derived from non-terminal branches, with holding distinguished.
- **One level only,** or can a sub-machine host sub-machines?

## Branch lifetime (settled later: transient)

Two shapes:

- **Transient branches.** A sub-machine is created when its Parallel Phase starts and discarded at the Join. It holds working changes, which the parent applies to the shared state at the Join.
- **Long-lived threads.** Each Player has a sub-machine for the whole Game. It runs Actions during a phase and sits idle between phases. The Player's own state lives in it permanently.

How they compare:

|                                        | Transient branches                                                                    | Long-lived threads                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Phase-start values for other Players   | Free: shared state is not written during the phase                                    | Needs a published snapshot kept beside the working state                        |
| Ordered phases between (combat, sales) | Ordinary engine on ordinary state                                                     | The parent writes into idle threads                                             |
| Title's state layout                   | Unchanged outside phases; the title supplies what a branch works on and how it merges | The Player's ships, cash and so on move into the thread for good                |
| Engine concept                         | Enter a phase, run branches, merge, discard                                           | A standing second level of machine                                              |
| A branch outliving a Join              | Not possible                                                                          | Possible: a Player could run ahead while the parent waits only at real barriers |

The leaning is transient, because shared state standing still is exactly what the other Players need to see and read, and nothing outside a phase changes. The parts that make a branch a branch (own bookkeeping, patches confined to it, a stream per seat) are the same in both, so starting transient does not close off threads later. The stream per seat is long-lived either way and lives on the parent.

The deciding question: does any title need a branch to continue past a Join, with a Player running ahead through later phases while others are still in an earlier one?

What transient branches still need settled:

- **What the working copy is.** Either a slice the title defines (what a branch may change, with a function to take it out and one to merge it back), or a private branch of the whole Game State whose changes must not overlap another branch's. The slice is explicit and can be checked on every Action. The whole-state branch would let existing handlers and rule code run unchanged, in the way an Exploration Game Context is a private branch today, but it enforces independence only at the merge and suits state keyed by identity better than arrays.
- **The merge.** Applied by the parent in Phase Order as part of the Join, together with the entries branches recorded for shared things.

## What a Player sees during a phase (requirement, design open)

The acting Player must see their working changes as if they were applied. A ship moved in a branch shows in its new system for that Player, although the shared state has not changed. The same holds for any branch a Player is allowed to see under the visibility rule.

Call the result the **presented state** (_provisional_): the shared state with the visible branches merged in, in Phase Order. For the acting Player that is at least their own branch. For others it is the shared state plus any committed branches they may see.

Consequences:

- **One merge, used twice.** The presented state should come from the same merge the Join performs, so what a Player sees is what will be applied. That requires the merge to be a function of the shared state and a branch, with no side effects, separate from the Join's ordered resolution of queued entries.
- **Game UI code reads an ordinary Game State.** Components should not need to know branches exist to draw the board.
- **Where it is produced.** The Game Client also executes branch Actions itself, so it needs the real branch structure, not only a flattened state. That points to the host delivering the shared state and the permitted branches, and the Game Client deriving the presented state. The Game Session already has one place where it hydrates the state it exposes to UI code (`gameSession.svelte.ts`).
- **It settles the direction for the working copy:** a private copy stored as accumulated changes (next section). The acting Player's presented state is then their branch's own state, and rule code and UI code both run unchanged. The alternative, a title-defined slice with its own merge function, would have rule code inside a branch reading two shapes.
- **Collections need identity.** Merging two branches' changes fails if they collide by position. The engine's patches address array elements by index (`statePatch.ts`), so two branches each adding a ship to one array would collide. Player-owned collections would need to be keyed by identity, or the merge would need to know each array's identity key.

Open:

- Other Players' branches become visible in batches, when a branch ahead commits or at the Join. How does the Game UI animate and explain many changes arriving at once?
- What does History navigation show inside a branch, and for branches seen later?
- What does a spectator's presented state contain?

## The working copy: stored as changes (direction)

A branch is a private copy of the Game State, stored as the changes it has accumulated against the shared state. Applying a branch's changes to the shared state gives that branch's view; applying every visible branch's changes gives the presented state. The changes stay valid while the shared state changes only in ways that cannot collide with them (see "Branches join one at a time").

The engine already produces patches: every Processed Action carries an undo patch, and Redacted Action Records advance projected state through a forward patch.

A sketch of one branch Action, to be tested against the engine:

1. Apply the branch's changes to the shared state to get the branch's state, and hydrate it.
2. Run the ordinary execution loop on that state, using the branch's own Machine State and bookkeeping.
3. Take the difference between the shared state and the branch's state after the cascade. That is the branch's new accumulated change.
4. Reject the Action if the change reaches outside what the branch may touch.
5. Store the change on the branch. The Action's effect on the stored Game State is confined to that branch.

Notes:

- **Everything a branch does is a change in its own state,** including the advance of its per-seat random cursor. Nothing outside the branch is written until the Join.
- **Undo inside a branch** reverses the Action on the branch's state and stores the smaller change.
- **The Join** applies each branch's changes to the shared state in Phase Order, leaving out the branch's own bookkeeping, then resolves queued entries.
- **This revises the earlier wording** of an Action running "against the sub-state with the full state read-only". The Action runs against the combined state; the engine keeps only what it changed and checks that against what the branch may touch.

Open:

- How a title states what a branch may change, and how collections get the identity that merging needs.
- The form of the stored net change: a list of patch operations, or a sparse copy of the changed values, which would difference more cleanly from one Action to the next.
- How a branch's own Machine State and bookkeeping sit in its state so the existing loop reads them without special cases.

## The same thing seen from history: private Actions, applied later

A branch is also just a run of Actions that are private to their Player and whose effect on the shared state is deferred to the Join. Every Processed Action already stores its undo patch, and a forward patch is derived whenever an Action is projected for a Player Perspective. Seen this way the engine needs little that is new: Actions stay the unit of history, Undo, synchronization and redaction.

The two views describe one design:

- **History view:** a branch is the Player's pending private Actions.
- **State view:** a branch is the net change those Actions have made, stored on the Game State.

Why keep the state view as well, instead of deriving a branch from its Actions when needed:

- **A Player's view would not be stored.** A Game Client could not draw the right board or accept input until it had fetched and replayed that Player's pending Actions. With the net change on the Game State, projected to its owner, the state alone is enough to present and to act.
- **Execution needs only state.** The engine executes an Action against a Game State. If a branch lived only in history, executing the next branch Action would also need that Player's earlier ones. History is not always fully available; Undo already has to refuse when it would cross unavailable history.
- **No new kind of Action.** With the net change stored on the Game State, a private Action is an ordinary Processed Action: accepted, applied to Game State, recorded. Its change simply lands in its branch. Without it, the engine would need Actions that are accepted but not yet applied.

So the stored change is a materialized copy of what the pending private Actions add up to. It answers the open point above: the Game State holds the net change, and history holds each Action's own patch.

What is new, then, is small:

- An Action can be **private to its Player** until its branch is visible. Others receive a Redacted Action Record, as hidden-information titles already do.
- An Action's change can be **held in a branch** and applied to the shared state at the Join.

## Branches join one at a time (direction)

The model, restated: the Game is an ordinary Game State Machine. At some Machine States a Player may leave the main line, progress privately with their own view and change data, and join again. For a branch the engine keeps a private Machine State, Action count and checksum, random cursors, and whatever else must stay separate. A Join reconciles one branch with the shared state.

A branch joins when its Player finishes, while other Players may still be progressing privately. The shared state changes at that Join. The others see the joined change, which cannot conflict with theirs because branches change disjoint things.

This revises the earlier conclusion that the shared state must stand still for the whole phase. What is actually required:

- **Branches change disjoint things,** so a Join never overwrites another branch's work, and a branch's stored net change still applies to the shared state after someone else's Join.
- **A branch Action does not depend on what other branches change.** After a Join, a branch's later Actions run against newer shared state. If their results could differ because of it, the order of Joins would matter. See "A Join is a merge onto the main line".
- **Joining shows the branch to everyone,** so when a branch is applied decides who learns what. That is the choice between the two forms of Join below.

Naming: "fork" is taken. In Game Lifecycle a **Fork** derives a new Game Instance, and the Game Client glossary tells Exploration to avoid the word. This note uses **branch** (_provisional_). The glossary describes an Exploration as a private branch too, but does not define the word; a branch here is authoritative and merges back.

### Two forms of Join

A title chooses the form for each place branches are allowed.

- **Barrier Join** (_provisional_). Every branch must finish; then all are applied, in Phase Order. Nothing is seen until everyone is done. This is the form for play that is simultaneous and blind, and for titles whose simultaneous part is entirely private.
- **Ordered Join** (_provisional_), the optimistic form. A finished branch is applied as soon as every branch ahead of it in Phase Order has been applied. A Player can act at once without looking, or wait and see the Players ahead of them. This is Stellar Horizons' build and movement: order matters only to a Player who chooses to wait.

What the Ordered Join settles:

- **It gives exactly the information strict order would.** A Player sees a prefix of the Phase Order: the branches ahead of them that have finished, in order. A Player who finishes early out of turn is not shown to the Players ahead of them.
- **The per-viewer visibility rule is not needed.** That rule ("visible if its owner is ahead of you, or you have committed") is replaced by something simpler: a branch is visible only to its owner until it is applied, and applied branches are just the shared state. No projection has to depend on the viewer's place in the order.
- **Joins happen in one known order,** Phase Order, in both forms. Only their timing differs.

What differs for reconciliation:

- Under a Barrier Join the shared state does not change during the phase, so every branch Action ran against the same shared state.
- Under an Ordered Join a branch's later Actions run after earlier branches were applied. The independence rule is what makes that harmless.

In both forms a finished branch that has not yet been applied has been seen by nobody, so its Player could reopen it. A Join is final once applied.

A slow Player early in the Phase Order holds back what everyone behind them can see, but not their ability to act and finish.

### A Join is a merge onto the main line (direction)

A Join works like merging a branch that can never conflict.

- **A branch starts at a branch point:** a position on the main line, with the Action count and checksum there.
- **Branch Actions are numbered on from the branch point,** and the branch's checksum is computed from the branch point's checksum. Both are private to the branch and provisional.
- **A branch never has to catch up.** When the main line moves on, because another branch joined, the branch's Actions, numbering and checksum stay as they are. Its Player still sees the newer shared state, because the presented state is the current shared state with the branch's net change applied.
- **At the Join, the branch's Actions are appended to the main line** at its current end, in their order, with final indices. Their recorded changes are applied; the Actions are not run again. A System Action then marks the Join and moves the parent machine on, including resolving queued entries.

After a Join there is one ordinary history. The branch leaves nothing behind.

What this replaces from earlier in this note:

- A Join was to be one step with the branch's Actions as its detail. Instead the Actions themselves land on the main line, so other Players receive them as ordinary Actions, the log and animation show them one at a time, and History navigation needs nothing new.
- Each branch Action was to record the main-line position it saw. Instead the rule is stronger: a branch Action must not depend on anything another branch can change. Then the order in which branches land cannot matter. The host can verify this at the Join by running the branch's Actions on the main line and requiring the same results, the check Supersedable Actions already use.

What it takes:

1. **Indices change at the Join.** A branch Action keeps its identity but moves from a provisional index to a final one, and the checksum is computed from identity and index. The owning Game Client has to swap its branch history for the main-line one.
2. **Stored patches are rewritten at the Join.** A branch Action's undo patch was taken against the branch's state and includes the branch's own bookkeeping.
3. **What is revealed is the title's ordinary choice.** At the Join each Action is projected for each Player Perspective as any Action is, so a title can keep some of a branch's Actions redacted afterwards.
4. **Undone branch Actions never reach the main line.** History inside an open branch can be rewritten freely.
5. **A Join arriving while a Player is mid-branch** changes their shared state only. Their branch is untouched, and no Action is rejected as stale, because a branch Action is validated against its branch's index.
6. **A Join is final** once applied.
7. **System Action Identity inside a branch** must not collide with other branches or the main line. Identities come from a shared cursor today.
8. **Paths that run rules again** (Supersedable replacement, Undo's reapplication) need to know an Action ran in a branch, or to rely on the independence rule.

## Ordering, storage, redaction, querying and checksum

These five mechanisms all assume one history with a dense index.

How each works today:

- **Ordering.** `recordAction` gives each Processed Action the next index and advances the Action count on Game State.
- **Storage.** Actions are stored in chunks addressed by index: chunk number is the index divided by the chunk size (`persistence/firestore/gameStore.ts`).
- **Redaction.** A Player's history is built by projecting each consecutive canonical state for their Perspective and differencing (`visibility/gameVisibility.ts`). It asserts the Actions are contiguous by index and end at the state's Action count.
- **Querying.** A Game Client synchronizes by sending its index and checksum; the host returns the Actions from that index to the current count (`gameService.checkSync`).
- **Checksum.** The Action checksum on Game State combines the identity and index of every Action (`util/checksum.ts`).

Two ways to fit branches in:

**A. Branch Actions on the main line.** One history, one dense index in arrival order. A branch Action is marked with its branch and its change is confined to the branch.

- Existing storage, querying and projection keep working in shape.
- Other Players receive a Redacted Action Record for every private Action. That leaks how many Actions a Player took and when, such as how many ships they built.
- A private Undo removes an Action from the middle of everyone's history, so every later index and the checksum change for all Players.
- Every branch Action arrives with a stale index and relies on an exemption.

**B. Branch Actions off the main line.** The main line keeps its dense index and is not advanced by branch Actions. Each branch has its own sequence, count and checksum. A Join is one System Action on the main line.

| Mechanism | Under B                                                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordering  | Main line as today. Within a branch, by branch index, counted on from the branch point. Branches need no order among themselves.                                                                              |
| Storage   | Open branches need their own storage, addressed by branch and branch index. At the Join their Actions move to the main-line chunks and the branch's storage is dropped.                                       |
| Redaction | None needed while a branch is open: other Players never receive its Actions. At the Join they are projected like any other Actions. The open branch itself is a part of Game State visible only to its owner. |
| Querying  | Main-line synchronization unchanged, and unaffected by other Players' open branches. A Player also synchronizes their own open branch by its index and checksum.                                              |
| Checksum  | The main checksum covers the main line. A branch's checksum is computed from its branch point and is discarded at the Join, when its Actions enter the main checksum with their final indices.                |

B is the leaning. It leaves the main-line machinery as it is and adds a smaller, temporary copy of it for open branches. Private Undo stays inside the branch, and nothing about a branch's activity reaches other Players except that it is still open.

Costs of B, and things to check:

- The Game Client holds a main-line history and, for the acting Player, an open branch.
- A branch Action still changes the stored Game State (its branch). Whatever tells other Game Clients that a Game changed, such as the Game's entity tag and Realtime Updates, must not make them treat that as new main-line history.
- How Exploration and Forks treat an open branch.

## Branch randomness (direction, not decided)

Each branch gets its own protected stream, seeded deterministically, so a roll in one branch never depends on another branch.

What exists: the protected stream is ChaCha20 keyed by a seed that `deriveGameSeeds` derives from the master seed with HKDF and a label (`libs/common/src/util/gameSeeds.ts`). Its state is the seed and a cursor (`invocations`), held in Game State under a host-only policy, so Action Reversal restores the cursor.

Direction:

- **Derive, don't draw.** A branch's seed is derived from the master seed with its own HKDF label, the way the public and protected seeds are. Drawing branch seeds from the shared stream would make them depend on how many rolls came before.
- **One stream per seat for the whole Game,** not per phase. A cursor per branch in Game State is the only new state, and phases need no identity for seeding.
- **Label by seat, not by Player.** Stellar Horizons already keeps its seeded setup independent of who sits where (`competition.spec.ts`). Deriving from the seat keeps a master seed reproducible across different Players.
- **The shared protected stream stays** for randomness at ordered points: Game Initialization, Join queues and System Actions.

In short: randomness is per seat. A roll then depends only on that seat's cursor, never on when other Players' Actions arrived.

Why it matters after a Join as well: joined Actions sit on the main line in merged order, which is not the order they originally arrived in. Anything that runs rules again over them would consume a shared stream in a different order and get different rolls. With a stream per seat the order between Players does not matter. The cursor is ordinary Game State, so each Action's patch carries its advance and stepping through history restores it. History navigation itself applies patches and runs no rules, so it does not depend on this.

The same reasoning applies to System Action Identity, which draws from a shared cursor today.

What this buys: after an Undo in one branch, the other branches' Actions replay to identical results. The host can verify that by requiring each replayed cascade to match the recorded one, as Supersedable Actions already do (ADR 0008). That check is what would let the reveal barrier be scoped to a branch.

What it does not solve:

- **Undoable writes to shared state.** If an Action that can be undone changes something another branch's roll reads, replay diverges. Developing a tech returns markers to the pool an exploration draws from. Such writes would have to wait for the Join.
- **Draws from a shared pool** depend on arrival order, and a Join puts Actions in merged order instead. So a draw from a shared pool inside a branch breaks the independence rule as it stands (open question 2).

Still open here: whether a title opts in through a new accessor or a system version, since changing which stream an Action reads changes outcomes for Games in progress; and Games with no master seed.

## Open questions

Reviewed against the current direction. Questions the direction has answered are listed last.

Needed before building

1. **What a branch may change.** How a title states it, and how collections get the identity that merging needs. Stellar Horizons keeps ships and bases in plain arrays.
2. **Shared things touched inside a branch.** Exploring draws tech markers from a common pool and queues surveys; developing a tech returns markers. Each needs a rule that keeps branches independent: a snapshot at the branch point, an entry settled at the Join, or keeping the Action out of branches.
3. **The form of the stored net change:** a list of patch operations, or a sparse copy of the changed values.
4. **How a branch's own Machine State and bookkeeping sit in Game State** so the existing execution loop runs on a branch without special cases. Untested.
5. **The Join in detail:** the System Action that marks it, moving Actions to final indices, regenerating their patches, the owner's Game Client swapping histories, and storage for open branches.
6. **System Action Identity inside a branch.**
7. **Randomness opt-in:** a new accessor or a system version, and Games without a master seed.

Not yet examined, and able to change the design

8. How Exploration and Forks treat an open branch, and what History navigation shows its owner.
9. Change signals when only a branch moved: the Game's entity tag, Realtime Updates and Attention Notices.
10. What Active Players, the turn indicator and timers show for a Player who has finished and is waiting to be applied, or is waiting to see those ahead.
11. Whether an Out-of-Turn Action can interrupt a branch, and how interactive sequences such as combat sit between branches.
12. Local Games and hotseat, where privacy between branches is meaningless.
13. Which changes touch shared Game Client behaviour bundled into UI Artifacts (ADR 0004), and which titles would need republishing.
14. Tournament Games' Undo restrictions.

Choices to make, not blockers

15. Should a Game be configurable to play a branching phase strictly in order, or blind, overriding the title's choice of Join?
16. Are a Player's own roll results shown to others before their branch joins? Under the current direction they are not.
17. What do spectators see while branches are open?
18. Is reopening a finished, unapplied branch wanted, and how is it offered?
19. How does the Game Client offer Undo within a branch and explain where it stops?
20. Can waiting be abused to slow a Game, and does it need a limit?
21. Do Simultaneous Action Groups coexist with branches in one title, and do existing groups migrate?
22. Does Footfall move to this model, and what happens to Games in progress?
23. Can a branch contain a branch?

Answered by the current direction

- **Branch lifetime.** A branch runs from a branch point to its Join, so it is transient. Long-lived per-Player threads do not fit the merge model.
- **What becomes visible at a Join.** The branch's Actions land on the main line and are projected like any others.
- **The information edge of acting last.** An Ordered Join preserves it; a Barrier Join is for play meant to be blind.
- **Contention inside a branch.** Not supported; contested and interactive play stays in ordered Machine States.
- **History shape.** An open branch has its own history, merged onto the main line at the Join.

## Not yet done

- No check of the engine's internals beyond the Undo rules, the index exemption and the glossary.
- No test in Stellar Horizons interleaves two Players within a decade, at logic level or for Undo.
- No survey of other titles that would use this, beyond Fresh Fish, Santiago, Kaivai and Sol already using Simultaneous Action Groups.
