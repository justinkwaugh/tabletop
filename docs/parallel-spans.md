# Parallel Spans: working design

**Status:** design agreed in discussion, 2026-10-12. Build steps 1 and 2 are implemented in the Game Runtime and covered by specs against a toy title (`libs/common/src/game/engine/parallelSpan.spec.ts` and `branchMerge.spec.ts`), and have been through a standards and spec review. The host is built. The Game Client is built for Local and Hosted Games. Stellar Horizons has adopted it, one span per phase of the decade. The [build order](#build-order) has the detail. Everything outside the [Open](#open) section and the [Common Actions](#common-actions) section is agreed; Common Actions are a proposal under discussion. Two independent reviews on 2026-10-12 found gaps; their corrections are folded in below and the decisions they raised are listed under Open. Where this document differs from [the exploration](./parallel-phases-exploration.md), this document is current; the exploration is kept for its reasoning.

## The model in brief

Some Game Titles have long periods where every Player acts at once, each working through several steps. During such a period each Player plays their own **Branch**: a private line of play through the Game Title's ordinary Game State Machine. A Branch starts in a Machine State the title has declared for this, wanders through whatever other Machine States its Actions lead to, and must be back in the starting Machine State to close. A closed Branch is merged onto the **Main Line**, where its Actions become ordinary history.

Because every Branch starts and ends in the same Machine State, the merged history reads as if the Players had taken turns. That observation shaped the design: it is why a Branch must close where it started, and why a Local Game needs no private Branches and plays the same Branches one after another on the Main Line.

It is an observation, not a rule the design has to keep. A Hosted and a Local history of the same Actions are not the same history: a Branch Close is recorded when its Player closes, so it sits wherever that fell. The engine specs still play the same Actions both ways and compare the Game State reached, as a check that private play followed by a Merge produces what playing in turn produces.

## Terms

These are working definitions. None is in a `CONTEXT.md` yet; they move to the glossaries named below when the behaviour is built. Capitalized terms not defined here are existing glossary terms.

### Game Runtime

**Parallel Span**:
The period from the Main Line entering a Branching Machine State until Span Completion, during which each participating Player plays a Branch. Game State records that a span is in progress.
_Avoid_: Parallel Phase, stretch, simultaneous turn, Simultaneous Action Group

**Branching Machine State**:
A Machine State that exists to mark where the Branches of a Parallel Span start and close. It is not a Machine State in which a Player takes a turn; play happens in the Machine States a Branch moves through after leaving it.
_Avoid_: branch state, hub state, fork state, Join state

**Branch**:
One Player's line of play within a Parallel Span: the ordered Actions that Player takes from the Branching Machine State until it is back there. A Branch runs the Game Title's one Game State Machine and its ordinary Machine State Handlers.
_Avoid_: sub-machine, nested machine, thread, block, Fork, Exploration

**Closed Branch**:
A Branch that has left the Branching Machine State and returned to it. A Branch that is not closed is open. Its Branch Close records that on the Main Line.
_Avoid_: Finished Branch, committed Branch

**Branch Scope**:
The part of Game State that one Player's Branch may change: what that Player owns. The Branch Scopes of different Players in a Parallel Span never overlap.

**Branch Independence**:
The property that the result of every Action in a Branch is the same whether or not the Branches ahead of it in Merge Order are on the Main Line. A Branch may freely read what any Player had before the span began.

**Common Scope** _(proposed; name agreed 2026-10-17)_:
The part of Game State that no Player owns: everything outside every Player's Branch Scope, apart from what the engine maintains. Only Common Actions change it during a Parallel Span.
_Avoid_: shared state, public state, the intersection, and `@tabletop/common` (the package, unrelated)

**Common Action** _(proposed; name agreed 2026-10-17)_:
A User Action, of a type the Game Title declares as common, that a Player of a Parallel Span takes on the Main Line while the span is in progress. The Branching Machine State's handler validates it, its cascade ends back in the Branching Machine State, and it changes only the Common Scope. It is to the Main Line what a Branch Action is to a Branch.
_Avoid_: Shared Action, joint action, Out-of-Turn Action, table action, side action

**Completion Queue**:
Entries that Branches record within their own Branch Scope for consequences that touch Game State outside it. They are settled at Span Completion, in the order the Game Title's rules give.
_Avoid_: Merge Queue, Join queue

**Branch Start**:
The System Action, supplied by the Game Title and generated by the engine, that opens a Player's Branch by moving it from the Branching Machine State into its first Machine State of play. It is the first Action of every Branch.

**Branch Close**:
The System Action, generated and owned by the engine, that records on the Main Line that a Player's Branch has returned to the Branching Machine State. It changes only the span record and the Active Players.
_Avoid_: Branch Commit, finish signal, done marker

**Span Completion**:
The System Action that ends a Parallel Span once every Branch is on the Main Line, moving the Game State Machine on from the Branching Machine State. No Player's Action ends a span.
_Avoid_: the Join's System Action

**Starting Position Randomness**:
Game Rule Randomness drawn from a stream that belongs to one Starting Position, so a result never depends on how many values another Player has drawn.
_Avoid_: per-seat randomness, per-Player randomness

### Game Lifecycle

**Main Line**:
The Canonical Action History of a Game Instance and the Game State it produces, as distinct from any Unmerged Branch.
_Avoid_: trunk, parent, shared state

**Unmerged Branch**:
A Branch of a Hosted Game that has not been merged, whether open or closed. It is private to its Player and held off the Main Line. A Local Game has none.

**Branch Point**:
The Main Line position, as an Action count and Action History Checksum, at which a Parallel Span began. Every Branch of that span belongs to it.

**Merge**:
The step that places one Closed Branch on the Main Line. Its Actions become a contiguous run of the Canonical Action History, in the order they were taken, and the Branch stops existing separately. A Merge is final.
_Avoid_: Join, commit, rebase

**Merge Order**:
The total order over the Players of a Parallel Span, supplied by the Game Title, in which their Branches are merged.

**Barrier Merge**:
The form of Merge in which no Branch is merged until every Branch of the Parallel Span is closed; then all are merged in Merge Order. Nobody sees another Player's Branch before the span ends.

**Ordered Merge**:
The form of Merge in which a Closed Branch is merged as soon as every Branch ahead of it in Merge Order has been merged. A Player may act at once without looking, or wait to see the Players ahead of them.

**Branch Change**:
The net difference an Unmerged Branch has made to the main-line Game State, confined to its Branch Scope.
_Avoid_: net change, working copy

### Game Client

**Branch View**:
The Game State a Player sees and acts on while their Branch is unmerged: the current main-line Game State with their Branch Change applied and their Branch's own Machine State, Active Players, Action count and checksum in place of the Main Line's.
_Avoid_: presented state

## The machine

1. **One machine.** A Branch is the Game Title's regular Game State Machine run in parallel, not a second machine. No extra Machine State Handlers are registered for it, and inside a Branch a handler sees an ordinary Game State.
2. **A Branch closes where it started.** It leaves the Branching Machine State, passes through whatever Machine States its play needs, and is closed when it is back. In a Hosted Game the Main Line itself stays in that Machine State until a Merge runs a Branch through it.
3. **The Branching Machine State is a marker, not a place to play.** Game Titles differ in how they lay out Machine States, and many re-enter a Machine State after each Action. That is why the state that marks branching is a dedicated one: returning to it can then mean only one thing, that the Branch is closed. A Machine State where Players take Actions is never the Branching Machine State, and no User Action is valid in it. (If Common Actions are adopted, they become the one exception: see [Common Actions](#common-actions), rule 3.) Its entry behaviour runs every time it is entered, as for any Machine State: when the span begins and each time a Branch returns. A return is part of that Branch, so the Branch Scope check applies to it. Work done once per span, such as dealing, belongs to the Action or Machine State that leads into the span, not to this entry.
4. **The engine opens every Branch with Branch Start.** Entry into the first Machine State of play may carry a Player with nothing to do straight through, so their Branch closes with no User Action at all.
5. **Only Span Completion ends a span.** If the last Player's Action moved the machine on for good, that Branch would run differently on the Main Line than it ran privately. A span in which no Player has anything to do completes at once, because every Branch Start runs through.
6. **Branch Start, Branch Close and Span Completion are steps of their own.** No handler queues them and they belong to no User Action's cascade. Whoever owns the history, the Game Client in a Local Game or the host in a Hosted Game, advances the span whenever the Main Line rests in the Branching Machine State: record that a Branch has closed, open the next Branch, or complete the span once every Branch is closed and on the Main Line. Executing a Player's Action never does any of these, so an Action runs the same privately, in a Local Game and in a Merge. Their identities are fixed when the span begins and held in the span record, and the engine recognises each by its identity. A recorded Branch Start therefore opens its Branch again when replayed on its own, and nothing but the span's own Span Completion can end it. A Branch must end its cascade when it closes: no System Action may still be waiting. Branch Start and Span Completion are supplied by the Game Title, because they do real work. Branch Close is the engine's own: a title declares nothing for it and no title code runs with it. A title already has its say at that moment, since the Branching Machine State's entry runs when the Branch returns, inside the Branch.
7. **A Local Game plays Branches on the Main Line, one at a time.** It has no Unmerged Branches. Branches are opened in Merge Order: the first on entering the span, the next when the one before closes. When a Branch returns, the Game Client advances the span: Branch Close for that Player, then the next Branch Start, or Span Completion after the last. An Undo of the Action that closed a Branch reverses those steps with it. This is why rule 2 is required and not only convenient.
8. **Inside a Branch the only Active Player is that Branch's Player,** until it closes. Between Branches the Active Players are those who have not closed. That is the one list of who is being waited on, and the site and a table both read it from the Game State. Inside a Player's own open Branch View the Active Player is that Player alone, and who else has closed is in the span record the view carries. The engine maintains Active Players once a span has begun. In a Local Game that is the Player whose Branch is being played on the Main Line, so the Game Client's existing choice of Acting Player follows the Merge Order without change.
9. **Game State records the span.** A Branch can take the Main Line through other Machine States, so the current Machine State cannot say whether a span is in progress. Game State records the span's Branch Point, its Players, which Players have closed, which Players' Branches are on the Main Line, whose Branch is being played, if any, and the identities of each Branch Start, each Branch Close and Span Completion. The Branch Start identities are how a handler or a System Action knows whose Branch it is in. Closing is a public act, as it is at a table, so it is recorded on the Main Line when it happens: in a Hosted Game the write that stores a Branch's closing Action also puts that Player's Branch Close on the Main Line, while the closing Action itself stays private until the Merge, since it only makes sense on top of the rest of that Branch. A Branch's own record still says it is closed, because that follows from its Machine State; the two are written together.
10. **Who takes part is the Active Players.** The Branching Machine State's entry sets the Active Players, as any Machine State's entry does, and the span's Players are exactly those. A Player it leaves out has no Branch and plays no part. That entry runs again each time a Branch returns; whatever it sets then is replaced at once by the engine.
11. **What a Game Title declares** for a Branching Machine State: the Merge Order, which must place every Active Player; Barrier Merge or Ordered Merge; and the Branch Start and Span Completion Actions.
12. **Out-of-Turn Actions are rejected during a Parallel Span,** for now. Common Actions, [proposed below](#common-actions), would be the one kind of Main Line User Action a span accepts.
13. **Contested and interactive play,** such as selling to a shared market or combat, stays in ordinary ordered Machine States.
14. **A Parallel Span lies within one turn.** Turns start and end on the Main Line, outside a span. A Branch never starts or ends one, so the shared turn records are not touched inside it.

## What a Branch may change

1. **Branch Scope is defined and enforced.** The Merge already proves Branch Independence, but the proof alone fails late: only when two Players collide in a live Game, and only at the Merge, after private play. A defined scope fails at the offending Action, every time, so a title's first test finds a wrong write. It does not catch one Branch reading what another changed; only the Merge does. It also keeps whoever implements a title, people and agents alike, from changing shared Game State by accident.
2. **Scope is ownership.** A Branch may change only what its Player owns: Game State inside an object that carries that Player's identity. This is wider than the owner-only policy in the visibility rules, which looks only at a value's immediate parent. A title declares no list of paths, so there is no list to widen when a check fails. State that is merely keyed by a Player's identity, without carrying it, is not owned. Where an object that carries one Player's identity sits inside an object that carries another's, the outermost decides: everything inside it belongs to that Player, so no part of Game State is in two Branch Scopes. Ownership is judged against the Game State as it stood before the Action, so a Branch cannot make something its own by writing its Player's identity onto it, and cannot give away what it owns, whether by writing another identity over its own or by taking its identity off an object that stays. Removing a whole entry it owns is still allowed.
3. **The engine checks every Branch Action,** and the System Actions it generates, and rejects one that changes anything else. The Machine State, Active Players, Action count, checksum and the span record are exempt, since the engine maintains them. Span Completion and what it generates are Main Line Actions and are not checked. The check runs wherever a Branch Action executes: privately, in a Local Game, and in a Merge.
4. **Stable addresses.** Under an Ordered Merge a Branch Change is applied to a Main Line that has moved, so anything a Branch changes needs an address that another Player's merged Branch cannot shift. Shared collections are keyed by identity, not by position. They do not have to be split per Player. The check enforces this: a Branch may add an entry it owns to a keyed collection and remove its own, but adding to or removing from a positional collection it does not own is rejected, as is removing another Player's entry and adding an entry inside what another Player owns.
5. **A Branch never writes outside its Branch Scope.** A Game Title that needs something shared inside a Parallel Span uses one of three patterns:
    - **Deal it at the start of the span,** when a Player needs the result during the span. The Main Line hands each Player their own share before Branches begin.
    - **Queue it for the end of the span,** when the result can wait. The Branch records a Completion Queue entry.
    - **Keep the Action in an ordered Machine State,** when Players truly contend for it.

## Common Actions

**Status:** proposed 2026-10-17, under discussion; on 2026-10-17 the user replaced execution outside the Game State Machine with handling in the Branching Machine State and a required return to it (rule 3); on 2026-10-18 the Stellar Horizons pact was settled, which brought in rule 5's exception, rule 7's holds and rule 6's lapse on a close. Nothing here is built. It comes from joint resolution of anomalies in the Stellar Horizons campaign, where Players negotiate while each is privately exploring (`games/stellar-horizons-2/docs/campaign-plan.md`).

Picture each Player's Branch Scope as a circle in a Venn diagram of Game State. The rules above guarantee that a Branch writes only inside its own circle, so the circles never overlap and no Branch touches what lies outside them all. A Common Action is the converse: a Main Line Action, taken while the span is in progress, that writes only outside every circle. The two kinds of write are disjoint by construction, so neither can disturb the other. A Common Action lands at an exact place in Main Line history while everyone else is busy, much as a Sequenced Out-of-Turn Action does in an 18xx stock round ([ADR 0009](./adr/0009-sequenced-out-of-turn-actions.md)); here "out of turn" means outside one's Branch.

### The rules

1. **The Common Scope is what no Player owns,** judged by the ownership rule of [What a Branch may change](#what-a-branch-may-change) rule 2: Game State outside every object that carries a Player's identity. The fields the engine maintains are not part of it. A record a title keeps in the Common Scope must not carry one Player's identity in the field that marks ownership, or it would belong to that Player; it names Players in other fields, such as a list of partners or who proposed it.
2. **A title declares its Common Actions.** An Action type is a Common Action when its schema requires a literal marking it so, as `outOfTurn` marks an Out-of-Turn Action; the host and the Game Client route by it (rule 11). Which Common Actions are valid, and when, is the Branching Machine State's handler's to say (rule 3). Any Player of the span may take one, whether their Branch is open, closed or already merged, from the Branch Point until Span Completion. Players outside the span and spectators may not.
3. **The Branching Machine State handles it, and it must return there.** A Common Action is validated and handled by the Machine State Handler of the span's Branching Machine State, as any Action is by the handler of the Machine State it is taken in. Its cascade may pass through other Machine States but must end back in the Branching Machine State, as a Branch must end its cascade when it closes, and the engine rejects one that does not. The Branching Machine State's entry runs when it returns, as it does on every entry. The engine maintains the Active Players and the span record as it does after a Branch returns, so a Common Action changes neither. In a Hosted Game the Main Line rests in the Branching Machine State throughout the span, so this is the ordinary machine. A Local Game is rule 12.
4. **The engine checks every Common Action** with the Branch Scope check inverted: one that adds, removes or replaces anything inside an object that carries any Player's identity, before or after it, is rejected.
5. **A Common Action reads only what everyone shares, except to check the acting Player's own side.** Its effect reads only the Common Scope, the span record and the Players, and never depends on what a Player owns. In a Hosted Game the Main Line holds each Player's own Game State as it was at the Branch Point or at their Merge; in a Local Game it holds another Player's Branch in progress. Reading owned state would make the two disagree, and would show one Player another's private play. Its validity may also read what the acting Player owns, as their own Branch View shows it, so that a Player offers only what they can guarantee themselves, as a Löwenherz Player offers only money they hold. What others are offered is checked only against what everyone can see. The host checks the acting Player's side against their stored Branch before recording the Action on the Main Line. In a Local Game the acting Player's own Game State on the Main Line is already current, since their Branch is in progress there, has not started, or has closed. A title keeps each such check one that, passed in the Branch View, also passes on the Main Line, so a later replay of the Main Line accepts the Action again. That holds when what is checked can only be used up inside a Branch, such as a ship that has not acted. Nobody learns anything but that the Player took the Action. The engine cannot check reads. A title's specs check them by playing the same Actions both ways.
6. **Consequences for what Players own settle after the span.** A Common Action changes records in the Common Scope. Anything they imply for what a Player owns, such as cash, markers or influence, follows at Span Completion or later on the Main Line, read together with the Completion Queue entries in the Players' own Game State. A Branch Close writes nothing in the Common Scope, since it is part of its Branch. A record that should change when a Player closes, such as an offer that lapses, is read with the span record instead: the title treats it as changed once that Player is closed.
7. **A Branch may rely only on what is settled, and may be held back by what is not.** A Branch Action may read the Common Scope, and a Player sees Common Actions arrive in their Branch View as they would any Main Line Action. Its result may depend only on records nothing can change before Span Completion: the title refuses any change to them, and the Common Action that settled them is Information-Revealing, so no Player can undo it. An agreement to a proposal is one. A pending offer can still be withdrawn or countered, so a Branch that relied on one might run differently when merged. A record that is not settled may still make Branch Actions invalid, such as an offer holding what its Player pledged: that only narrows what the Branch may do, and the Merge replays only Actions that were taken. A title keeps every recorded Action valid at the Merge: an offer holds only what was free when it was made, and has lapsed or been settled by the time its Player's Branch merges. The Merge's replay catches any other reliance, as it catches every read ([Merge](#merge) rule 1), and refuses the Merge: a defect in the title like any other.
8. **Everyone sees a Common Action at once.** It is a Main Line Action, published to every Player and projected by the title's visibility like any other. At a table, negotiation happens out loud.
9. **Undo.** A Player may undo their own latest Common Action unless it is Information-Revealing or another Player's Common Action has followed it, since that Player may have answered it. Branch Closes and Merges that came after it stay: the host takes the Common Action out and replays what followed, as it does when a Branch Close is taken off. They replay the same, because a Branch relies only on settled records and a Common Action changes nothing a Branch owns. Undo inside a Branch is unchanged. Common Actions sit outside every Branch, so an administrator's Undo may land just before or after one; the landing rules of [Host](#host) rule 9 are otherwise unchanged, with one addition _(proposal)_. An administrator's Undo that passes over an Information-Revealing Common Action during a span unsettles what it settled, and an Unmerged Branch may have relied on that. The host replays every Unmerged Branch on the Main Line the Undo leaves, as a Merge would, and refuses the Undo if any Branch would not replay the same. A Branch that was only held back by the record replays the same, since lifting a hold forbids nothing. Reopening a Branch that would not replay, instead of refusing, is possible later.
10. **Races in a Hosted Game.** A Common Action is taken at an exact Main Line position. If the Main Line has moved before it arrives:
    - **Only Branch Closes and Merges came between.** It is executed again on the current Main Line and recorded there if it makes exactly the same changes. It commutes with them by construction: they change nothing in the Common Scope, and no Merge relied on anything it can change.
    - **Another Player's Common Action came between.** It is recorded after it only if the Commutation Proof succeeds, as for a Sequenced Out-of-Turn Action. Otherwise it is rejected as raced and the Game Client resynchronises, so a Player never has a move recorded against an offer they did not see. An Information-Revealing Common Action raced this way, such as an agreement, is always rejected, since the Commutation Proof refuses Information-Revealing Actions: the Player sees the newer move before agreeing.
    - **The span has completed.** It is rejected.

    A Common Action is an ordinary Main Line write: it reads and writes no Unmerged Branch, so it collides only with other Main Line writes, such as a close and the Merges it brings, and is retried like them.

11. **Routing.** The host runs a declared Common Action on the Main Line even when its Player has an open Branch. The Game Client applies it optimistically to the Main Line, not to the Branch View, and the Branch View follows as it follows any Main Line Action.
12. **Local Games** _(proposal)_. A Local Game opens each Branch as soon as the one before it closes, and the first as soon as the span begins, so its Main Line never rests in the Branching Machine State: a Common Action arrives part-way through another Player's Branch, in that Branch's Machine State. The engine sets the open Branch aside, keeping its Machine State, its Active Players and whose Branch is open; runs the Common Action in the Branching Machine State by rule 3; and puts the Branch back. That reaches what a Hosted Main Line reaches, because a Common Action reads nothing a Branch owns (rule 5) and changes nothing it owns (rule 4). The Common Action is recorded among that Branch's Actions but is not part of it: that Branch's scope check skips it, the inverted check applies, and replay treats it as a run of its own. In a hotseat Game it is offered to the Players who are not acting, as Out-of-Turn Actions are.
13. **Available actions.** A Player of the span who is not acting, or is waiting with a closed Branch, is offered the span's Common Action types that the title says they may take now.

### Example: a joint attempt in Stellar Horizons

Settled with the user on 2026-10-18. During the exploration span, Players negotiate a pact on the Main Line with Common Actions, in the manner of Löwenherz's negotiation. A pact names an anomaly, two or more partners, the ships each partner pledges and how the reward is split. It lives in the Common Scope, listing its partners by identity in a field of its own. Only the partners it names take part; other Players see it and have no say.

- **Proposing.** A partner proposes terms. The handler checks the proposer's own side against their Branch View (rule 5): their pledged ships have not acted. It checks the other partners' side only against what everyone can see: their pledged ships were at the anomaly and able to take part when the span began. The pledged ships' combined strength must reach the difficulty, with the Starfarers' or Syndicate's reduction when they are partners. A ship's strength changes only when it explores, so the values everyone sees are exact for any ship still free. As in Löwenherz, where a Player may offer a sum the other may not have, nobody learns anything of another's Branch.
- **Answering.** Another partner counters with new terms, or accepts by proposing the same terms back, which is valid only if their own pledged ships are free in their Branch. A pact is agreed once every partner has proposed the same terms. The acceptance that completes it is Information-Revealing, as in Löwenherz, so nobody can undo it, and the handler refuses any withdrawal after it. Until then a Player may undo their latest proposal (rule 9), or withdraw it. A Player is a partner in at most one agreed pact for an anomaly.
- **Holding.** Proposing or accepting holds the Player's own pledged ships: their Branch may not use them for anything else while the proposal stands or once the pact is agreed (rule 7). An agreed pact therefore always has its ships and its strength, and needs no further step in any Branch.
- **Closing.** A Player may close their Branch at any time. A pending proposal that names a Player who has closed lapses, read from the span record (rule 6). The lapse gives no reason, so an Ordered Merge leaks nothing by it, even when it shows before that Player's place in the merge order. A proposal or acceptance that races the Close is executed again after it, fails and is refused as raced, which to that Player is the same lapse.
- **Resolving.** After the span, agreed pacts resolve among the solo attempts in initiative order, each pact at its earliest partner. Its pledged ships use their actions, and it resolves the anomaly unless an earlier attempt took it. The reward is split as agreed, and every partner counts a joint resolution for directives and titles. From the agreement on, the Game Client says plainly that the pact resolves when every Player has finished exploring.

### Decisions

- **Names.** Common Scope and Common Action agreed 2026-10-17, replacing Shared, which suggested joint ownership or an action taken together. Table is taken by Competitions.
- **Agreed 2026-10-18,** from the Stellar Horizons pact: a Common Action's validity checks the acting Player's own side in their Branch (rule 5); an offer holds what its Player pledged (rule 7); a close makes an offer naming that Player lapse, without a reason (rule 6); an agreed pact needs no further step in a Branch and resolves at Span Completion, and the Game Client says so; a Player is a partner in at most one agreed pact for an anomaly.
- **Agreed 2026-10-18: no special kind of Common Action for agreements.** An agreement is the Common Action that accepts a proposal, and it reveals information, so it is marked Information-Revealing, as Löwenherz marks an accepted deal. The cost is in rule 10: one raced by another Player's Common Action is always rejected. One raced only by Branch Closes and Merges is executed again rather than proved, so it is unaffected.
- **The Undo rule** (rule 9), agreed 2026-10-18: only one's own latest Common Action that is not Information-Revealing, before anyone answers it.
- **An administrator's Undo** (rule 9): the replay check over an Information-Revealing Common Action is a proposal.
- **Local Games** (rule 12): open.

## An Unmerged Branch

1. **Private and off the Main Line.** Only its Player receives its Actions and its Branch Change. Other Players learn only that it has closed, from its Branch Close on the Main Line. That much is no secret at a table either: everyone can see when a Player has finished a hidden simultaneous choice, or play could not continue.
2. **Its own bookkeeping.** An Unmerged Branch has its own Machine State, Action count starting from zero, and checksum. Its Active Players are not stored: an open Branch's is its Player, and a Closed Branch's is whoever the Main Line is still waiting on. These are not part of its Branch Change and are not subject to the Branch Scope check.
3. **Branch Change as patch operations,** recomputed after each Action from the main-line Game State and the Branch View.
4. **A Branch never has to catch up.** When the Main Line moves, the Branch View is the newer main-line Game State with the same Branch Change applied.
5. **History View covers the whole game** for a Player with an Unmerged Branch: the Main Line's history, then the Branch's own Actions. A Branch View always sits on the Main Line, so stepping back from the present goes through the Player's Branch, past its Branch Start, and on to the start of the game. The Game Client gives History View a joined copy in which the Branch's Actions are numbered on from the Main Line; play itself stays numbered within the Branch. An Exploration started from a position inside the Player's own Branch is not yet examined.
6. **Other Players' merged Actions are shown as they arrive,** animated like any other Action, including while the Player's own Branch is still open. They cannot change what the Player's Branch may do, but under an Ordered Merge they are there to be seen: a Player later in Merge Order may want to know what those ahead did before deciding. The Player's own Actions are not replayed at their own Merge, since they watched them as they played.
7. **Spectators see only the Main Line** during a Parallel Span.
8. **Undo inside a Branch** reverses only that Branch. Other Players see nothing of it, unless it reopens a Closed Branch, which takes that Player's Branch Close off the Main Line. The Game Runtime applies the rule itself: the Undo names a User Action and reverses it with everything after it; it never reaches Branch Start or the System Actions Branch Start generated; and it stops at the Player's own Information-Revealing Actions. Only an administrator may pass that last barrier. Undoing the Action that closed a Branch reopens it, for a Player and an administrator alike, as long as the Branch has not merged: the closing Action is reversed in the Branch, its Branch Close comes off the Main Line, and the Player is back in their open Branch with the rest of their play intact. Other Players' closes and any Merges that followed are left in place; the host takes them off with it and puts them back. Once a Branch has merged it is final: under a Barrier Merge a Player has until the last Player closes, and under an Ordered Merge until everyone ahead of them has closed. The waiting list can therefore go back up, which tells the others nothing about that Player's play.
9. **The Branch Point is an Undo barrier for Players.** Once a span has begun, no Player can Undo the Action that began it or anything before it. Otherwise that Player could discard everyone's private play and take the same rolls again knowing their results. While a span is in progress, everything on the Main Line is before the Branch Point, part of a merged Branch, or a Branch Close, so a Player's only Undo is inside their own Unmerged Branch. This is a rule for Hosted Games. A Local Game has no private play to protect and follows ordinary Local Undo, which already stops at an Information-Revealing Action: undoing the Action that closed a Branch reopens it, and undoing the Action that began the span undoes the span.

## Merge

1. **The Merge replays, and the replay is the proof.** The host runs a Closed Branch on the Main Line through the ordinary engine: Branch Start, then each of its User Actions. It requires each System Action cascade to match the recorded one, and the Game State after every Action to match what the Branch View showed after that Action, compared by content without regard to Action counts, checksums, positions or Active Players, as the Commutation Proof does for the first three. Comparing only where the Branch ended would pass a Branch that read what a Branch ahead of it changed and then wrote over the result: the merged history would show that Player something other than what they saw when they decided. What the Branch View showed after each Action is worked back from the Closed Branch with the recorded Actions' undo patches. The span record, which the engine alone maintains, is compared only where the Branch ended. This is the same execution a Local Game performs, it assigns final positions and undo patches, and it is what establishes Branch Independence: it catches a Branch that depends on what a Branch ahead of it changed, whether by changing the same thing or by reading it. Its cost is that every Branch Action executes twice on the host.
2. **Order and form.** Branches are merged in Merge Order, and the Merge refuses a Branch out of turn. Which are ready is the title's choice of form, read from the Game State's record of who has closed: under an Ordered Merge, the Closed Branches with nobody open ahead of them; under a Barrier Merge, none until every Branch is closed.
3. **After a Merge there is one ordinary history,** and the Merge is final: a merged Branch's Actions are never Undo Candidates for a Player. Span Completion is an Information-Revealing Action, since by then every Branch has been shown to everyone. That keeps a Player's later Undo from reaching back into a completed span, by the rule that already governs Undo everywhere.
4. **Branch Start runs twice in a Hosted Game.** Every Player's Unmerged Branch is created with its Branch Start when the span begins, so nobody waits to begin. The Merge generates Branch Start again on the Main Line and requires the same result. The host also creates any Unmerged Branch that is missing for a Game whose Main Line is in a span, as after a Fork taken at the Branch Point.
5. **Span Completion runs on the Main Line only,** once every Branch is there. Its identity and randomness come from the shared streams. A private Branch never contains it.
6. **A Merge that fails its check is refused,** and the Game is held for an administrator. This should never happen: it means a rule in one Branch depended on a Branch ahead of it, which is a defect in the title. A test helper that runs each of a title's Branches with and without the Branches ahead of it is how such rules are caught before release.

## Randomness

1. **Randomness inside a Branch is Starting Position Randomness.** Each stream is derived from the master seed by the Player's place in the order fixed at Game Initialization, and is read through an accessor that names the Player. Its position is part of what its Player owns. A title with no master seed gets generated seeds, as the shared streams do today.
2. **Two streams per Starting Position,** mirroring the shared pair today. A hidden one supplies Game Rule Randomness, so a Player cannot see their coming rolls. A public one supplies System Action Identity inside a Branch, so a Game Client can reproduce identities and they are the same before and after the Merge.
3. **Opting in.** The streams are created at Game Initialization when a Game Title declares a Branching Machine State. No system version is needed because no existing title uses them.
4. **The shared streams stay** for randomness on the Main Line: Game Initialization, dealing, and Span Completion.

## Host

1. **Unmerged Branches are stored beside the Game State,** not inside it. Players acting at the same moment do not write the same record, one Player's private Action does not invalidate what the host has cached for everyone else, and Unmerged Branches stay out of main-line undo patches, Forks and History. This is a host-only choice: titles and Game Clients are the same either way.
2. **One record per Unmerged Branch,** in two parts. A small document holds the Branch: its Player, Branch Point, status, bookkeeping and Branch Change, with its own cache entry. Its Actions are stored in chunks, in the same format and by the same code as the Main Line's, so Actions are stored one way everywhere. Executing a Player's next Action reads only the small document.
3. **A Branch Action writes only that record,** except the one that closes the Branch. It is published to the Branch's Player only, and the Action History Checksum and the entity tag other Players see do not change. The Action that closes a Branch also puts its Branch Close on the Main Line, published to everyone like any Main Line Action, so everyone learns of it and their entity tags change once. A Game Title that declares a Branching Machine State must define visibility, because a title without it publishes every Action to one shared topic.
4. **Stale Branches are ignored.** A stored Branch whose Branch Point does not match the Game's current Parallel Span is never applied, and is removed. Anything that ends a Parallel Span, or reverses the Main Line out of one, removes its Branches in the same transaction.
5. **The owner's entity tag and synchronization check** include their Branch's Action count and checksum.
6. **Active Players on the site** are the Game State's Active Players, which drop a Player once their Branch Close is on the Main Line.
7. **Forks** see only the Main Line. A Fork whose Main Line rests in a span, as one taken at the Branch Point or from inside a merged Branch does, is settled as a span is when it begins: it is written with a fresh Branch for each Player still to merge, and with the Branch Close of any whose fresh Branch closes at once, in the one write that creates the Game. A Fork carries no Unmerged Branches, so it lands before any Branch Close whose Branch is not yet merged.
8. **Hosted Games flagged as hotseat** are not a case this design covers; in practice they do not occur.
9. **An administrator's Undo and a Fork land only at the edge of a Branch,** for now: before a Player's Branch Start or after their Branch has closed. A position inside a merged Branch would leave that Player part-way through a Branch on the Main Line of a Hosted Game, with no private Branch to continue in. A request for such a position lands at the start of that Branch instead: the host reverses back through that Branch's Actions and its Branch Start, and takes that Player's Branch Close off the Main Line. The rule it keeps is that a Player is closed on the Main Line only while their stored Branch is closed: every Player whose merged Branch the Undo reverses has their Branch Close taken off and starts their Branch afresh, while a Player whose Branch Close the Undo merely passes over stays closed, with their Branch untouched. The same write gives that Player, and any other Player the Undo left without one, a fresh Branch, since a Game Client cannot offer an Action to a Player who has no Branch View to act in. The site waits on them again; it still does not wait on a Player whose Branch is closed. If something the Undo relied on changed while it was being worked out, the Undo is refused and can be tried again; what it relies on is the same as for a close, in rule 13. An administrator's Undo that would have to replay other Actions after landing inside a merged Branch is refused. An administrator's Undo that leaves the span altogether removes every stored Branch and clears any hold, which for now is the only way to release one. An administrator who replaces the Game State with one resting in a span likewise removes every stored Branch, and the same write gives each Player still to merge a fresh one.
10. **One endpoint for Actions.** A Player submits an Action the same way everywhere. The host routes it: when the Game rests in a span and the Player has an open Branch, the Action runs in their Branch; otherwise it runs on the Main Line. While a span is in progress the host accepts nothing else: an Action from a Player with no open Branch in it is refused. Common Actions, if adopted, change this rule: see [Common Actions](#common-actions), rule 11.
11. **What each Player is sent.** Everyone is sent the same projected main-line Game State. A Player with an Unmerged Branch is also sent that Branch and its Actions, projected for them.
12. **A refused Merge holds the span.** The host records the hold on the Game with the Player and the reason, logs it as an error, and attempts no further Merges while it stands. Players keep playing their own open Branches. An administrator clears it once the title is fixed.
13. **Whatever could make a Branch ready is settled in the same transaction.** The Action that begins a span creates every Branch and merges any that closed on Branch Start. The Action that closes a Branch is written together with every Merge it makes possible, and with Span Completion and the next span's Branches when it gets that far. Before it commits, that write checks what it relied on when the host decided what to merge: that the Main Line is where it was, that every Closed Branch is as it was, and that no Branch has appeared for a Player it is creating one for. If any of that has changed, as when two Players close at the same moment, the whole submission is retried from fresh data. A Player's open Branch is not part of the check: what they play in it changes nothing about a close, so playing never throws out somebody else's close. A Closed Branch is checked on its own because a Player can close, reopen and close again differently and leave the Main Line exactly where it was. Nothing is left half done, so no Closed Branch can be stranded waiting for a Merge.

## Stellar Horizons

Decided 2026-10-13, replacing the earlier plan of one span per decade with dealt tech markers: **each phase of the decade is a Parallel Span of its own.** The rulebook orders the phases in different directions, build and movement in reverse initiative order and cargo in initiative order, and a Player who wants to wait for those ahead of them needs the Merge Order of that phase; one span cannot serve both directions.

- **Phases as spans.** Build, Cargo, Movement, Exploration and Development each have a Branching Machine State and a Machine State of play. Build, Cargo and Movement are Ordered Merges in the rulebook's direction; Exploration and Development are simultaneous in the rulebook and merge as a Barrier. A phase declares its direction and form; the scenario's plan lists its phases, so a scenario can leave phases out, play a contested phase in turn on the Main Line, or group consecutive phases into one span later.
- **Branch Scope.** Ships and bases are keyed by identity. Surveys and anomaly attempts are queued in the Player's own state and settled in initiative order on the Main Line. Markers spent on techs are held by the Player until the end of the turn. Exploration dice come from the Player's hidden Starting Position stream.
- **Marker draws settle after the Exploration span.** An exploration records how many markers it earned; once every Branch has merged, the markers are drawn from the real pool in initiative order, which is the rulebook's own resolution order, and surveys are decided then. No dealing, no bound and no scarce-decade fallback are needed, because Development is a span of its own after the draws. Dealing remains a possible later opt-in that would let a scenario's plan group Exploration with Development and save one wait per decade; a decade the pool could not cover would fall back to the split that exists now.
- **Phases end by themselves** once the Player can do nothing more in them, through a System Action the Machine State of play queues on entry, except that exploring never ends the Exploration phase.
- **Cost.** Five waits per decade in asynchronous play instead of one. Accepted for fidelity to the rulebook's order; the plan being data leaves room to fold phases per scenario.

## Build order

1. Branch execution with the Branch Scope check and Starting Position Randomness, in the Game Runtime only, against a toy title. Done.
2. Branch Undo and the Merge, in the Game Runtime only, with the check that private play followed by a Merge reaches what playing the same Actions in turn reaches. Done.
3. Host, in four parts:
    1. Storage of Unmerged Branches and their cache entries. Done: `libs/backend-services/src/persistence/firestore/gameBranches.spec.ts`.
    2. Submission: routing a Player's Action to their Branch, creating Branches when a span begins, and merging. Done: `libs/common/src/game/engine/hostedSpan.spec.ts` for the settling logic and `libs/backend-services/src/games/gameSpans.spec.ts` for the service. Not yet: a Hosted Game that starts in a Branching Machine State, which the host refuses for now.
    3. What each Player is sent. Done: opening a Game and the sync check both carry the owner's Branch, and the owner's entity tag includes its Action count and checksum. The Game State and a Branch are read separately, so a Merge can land between the two. A read whose answer could be wrong for that reason confirms afterwards that the Main Line has not moved, and reads again if it has: opening a Game when the Player's Branch is missing, and a sync check that finds the Branch out of step. The sync check does not load the Game State while the Branch is in step. On the wire the Branch a Player is sent is `unmergedBranch`, the position a Game Client claims for its Branch is `branchPosition`, and the sync check's answer about the Branch is `branchSync`.
    4. Undo routing, and publishing a Branch's Actions to its Player only. Done: an Undo naming an Action in the Player's own Branch is a Branch Undo; any other Undo by a Player during a span is refused. A Branch Action is published to that Player's own topic, and to nobody else's, as the Branch as it now stands with the Actions just added, projected for them; a Branch Undo publishes the Branch as it now stands with the ids of the Actions it undid, on the wire `undoneActionIds`. The Action that closes a Branch is published the same way, and its Branch Close goes to everyone as a Main Line Action.
4. Game Client, in two parts:
    1. Local Games. Done, as rule 6 says: the Game Session executes a Local Game's Action through `executeInLocalGame`, which executes it and then advances the span, and the dev harness's stand-in host does the same. Specs: `libs/common/src/game/engine/localSpan.spec.ts` and, through a Game Session in a browser, `libs/frontend-components/tests/spanSession.spec.ts`. Not yet: a Local Game whose Main Line is already resting in the Branching Machine State when the Game Client receives it, which is a Game that starts there or an Exploration opened from a Hosted Game between Branches; and the check that finds how far Undo may reach in an Exploration opened from a projected Game, which replays each Action without advancing the span.
    2. Hosted Games: the Branch View. Built: the Game Session holds the Player's Branch as a second context beside the Main Line and shows it in place of the Main Line while the Player has an Unmerged Branch. Play in it is optimistic, as on the Main Line, and numbered by its place in the Branch. Undo, sync, reload and deferred history load all carry the Branch, and History View runs from the present back through the Branch to the start of the game. When the Main Line moves under it, the view is rebuilt with the function the host uses and the arriving Actions are animated; the Player's own Actions are skipped at their own Merge. The Site Frontend's API client passes the Branch through, and the game page hands it to the session. Specs: `libs/frontend-components/tests/spanSession.spec.ts`, against an in-memory host for the toy title (`libs/common/src/game/engine/tests/spanHost.ts`). A Fork asked for from inside the Player's own Branch is taken at the Main Line's latest Action, or at the position being viewed when History View is on the Main Line's part of the history. Not yet: an Exploration started from inside a Branch, and what an administrator's Host View shows, neither of which has a spec. Every session of a Player follows that Player's Branch as its Actions are published: a session one step behind applies them as it applies Actions arriving on the Main Line, and one further out of step falls back to a sync check. What is published can arrive late, after the session has moved on, so a session ignores an Action it already holds or has since undone, and applies an Undo only when it still holds one of the Actions that Undo names. Which other Players have closed reaches every table as a Branch Close on the Main Line.
5. Branch Close on the Main Line. Built across the engine, the host and the Game Client: `libs/common/src/game/engine/parallelSpan.spec.ts`, `hostedSpan.spec.ts` and `branchMerge.spec.ts`; `libs/backend-services/src/games/gameSpans.spec.ts`; and `libs/frontend-components/tests/spanSession.spec.ts`.
6. Stellar Horizons adoption. Done: the logic package (`games/stellar-horizons-2`, `src/definition/spans.spec.ts` for the spans, private play merged against play in turn, the Barrier and the settlement of draws) and the UI (`games/stellar-horizons-2-ui`). Not yet: cooperative Voyages and the later scenarios, which only need plan data and queues.

7. Common Actions, if adopted: the engine (declaration, handling in the Branching Machine State and the required return, the inverted scope check, Local Games, replay and Undo), then the host (routing, races), then the Game Client (routing, available actions, hotseat), each against the toy title before Stellar Horizons uses them.

The host is deployed first, then the Site Frontend, and only then does a title adopt this by republishing its UI Artifact. A Game Session reaches its Player's Branch only through the Site Frontend's API client, which before this change dropped it; a session that is sent no Branch asks for it with a sync check, once for each position the Main Line reaches, so a newer session on an older Site Frontend would be left on the Main Line unable to act. Titles that do not adopt it are unaffected: every field added to the Game UI Host Bridge Contract is optional, and an older session ignores them.

## Open

To measure:

- **Cost of the replaying Merge** on production hardware.

Not yet examined:

- **An explicit "wait for the Players ahead" control,** and whether waiting needs a limit.
- **Tournament Game Undo restrictions** inside a Branch.
- **How an administrator views Unmerged Branches.** Agreed that they need a way; deferred. Until then an administrator sees only the Main Line, and gets nothing visible back when acting for a Player during a span.
- **Explorations opened between Branches,** from a Main Line resting in the Branching Machine State, **or from inside the Player's own Branch.**
- **Simultaneous Action Groups:** whether they coexist with Parallel Spans in one title, and whether existing uses migrate.
- **A Branch inside a Branch.** The engine rejects a Branch that enters another Branching Machine State until this is examined.
- **A Game setting that overrides the title's form of Merge,** to force strict order or blind play.

## Naming notes

- **Merge** is in the avoid list of Commutation Proof in the Game Lifecycle glossary. That entry keeps the proof from being called a merge, so the two uses do not conflict.
- **Branching Machine State** replaces "branch state" from earlier discussion, which also reads as "the state of a Branch".
- **Starting Position** is defined in the Competitions glossary through a Tournament Entrant, and Game State does not store one: an assignment only sets the initial turn order. Starting Position Randomness needs that definition widened to any Player's place in the order fixed at Game Initialization.
- **Branch Close** was considered as Branch Commit, to keep to source-control terms. A committed game action already means an Action that is in the Action History and no longer a staged selection, so every Action in a Branch is committed in that sense; and in source control a branch has many commits. Close also pairs with an open Branch, a Closed Branch and Branch Start.
- **Closed Branch** was first called Finished Branch. That shares a word with Finished, the lifecycle state of a Game with a result, in the same glossary. Closed also pairs with open.
- **Completion Queue** was first called Merge Queue, but it is not a queue of Merges and is not settled in Merge Order. The name says when it is settled.
- **Branch** and **branch point** are used descriptively in three Game Client glossary definitions. An Exploration is hypothetical and is never merged, so it is not a Branch. When Branch and Branch Point enter the glossaries, those definitions are reworded so the word has one meaning:
    - Exploration Game Context: "A mutable private copy of another Game Context for trying alternate Actions without changing its source."
    - Exploration: "A private, Local, Hotseat line of play opened within a Game Session for trying alternate Actions, with unknown information simulated consistently with the explorer's permitted knowledge at the position it was opened from."
    - Hypothetical Game State: "… honoring facts available to the explorer at the position the Exploration was opened from. Later source-Game revelations do not constrain an Exploration opened earlier."

## The exploration's open questions

Numbers refer to the list at the end of the exploration.

| #   | Question                                               | Status                                                                                                   |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 1   | What a Branch may change                               | Agreed: Branch Scope by ownership, with stable addresses                                                 |
| 2   | Shared things touched inside a Branch                  | Agreed: deal, queue, or keep ordered. Stellar Horizons queues its marker draws                           |
| 3   | Form of the stored net change                          | Agreed: patch operations                                                                                 |
| 4   | Where a Branch's Machine State and bookkeeping sit     | Agreed: on the Branch; the engine runs on the Branch View unchanged                                      |
| 5   | The Merge in detail                                    | Agreed: replay on the Main Line, then Span Completion                                                    |
| 6   | System Action Identity inside a Branch                 | Agreed: a stream per Starting Position                                                                   |
| 7   | Randomness opt-in                                      | Agreed: created when a title declares a Branching Machine State                                          |
| 8   | Exploration, Forks and History with an Unmerged Branch | Forks see only the Main Line. History covers the whole game. Exploration open                            |
| 9   | Change signals when only a Branch moved                | Agreed: published to its Player only; others' checksum and entity tag unmoved                            |
| 10  | Active Players, turn indicator, timers                 | Agreed: the Game State's Active Players are who has not closed. Timers open                              |
| 11  | Out-of-Turn Actions and interactive sequences          | Agreed for now: rejected during a Parallel Span. Interactive play stays ordered. Common Actions proposed |
| 12  | Local Games and hotseat                                | Agreed: Branches played on the Main Line, one at a time in Merge Order                                   |
| 13  | Shared Game Client changes and republishing            | Each adopting title republishes its UI Artifact; other titles are unaffected                             |
| 14  | Tournament Undo restrictions                           | Open                                                                                                     |
| 15  | Overriding the title's form of Merge                   | Open                                                                                                     |
| 16  | Whether a Player's own rolls show before their Merge   | To that Player at once; to others not until the Merge                                                    |
| 17  | Spectators                                             | Agreed: the Main Line only. A view of Branches for administrators is deferred                            |
| 18  | Reopening a Closed Branch                              | Agreed: undoing the Action that closed it reopens it, until it merges                                    |
| 19  | Undo inside a Branch in the Game Client                | Built: offered in the Player's own Unmerged Branch, open or closed                                       |
| 20  | Abuse of waiting                                       | Open                                                                                                     |
| 21  | Simultaneous Action Groups alongside Parallel Spans    | Open                                                                                                     |
| 22  | Whether Footfall moves to this model                   | Yes, as build step 6. Stellar Horizons is unreleased, so no Games in progress                            |
| 23  | A Branch inside a Branch                               | Open                                                                                                     |

## What the exploration says that no longer holds

- A Branch is not a sub-machine with its own registered handlers.
- A Branch does not end in a separate terminal or Join Machine State; it ends in the Branching Machine State.
- A Branch's Actions are numbered from zero, not on from the Branch Point.
- The Branch Change is stored beside the Game State, not on it. The Branch's Player still receives it with their state.
- A Merge is not followed by its own System Action; one Span Completion follows the last Merge.
- "Seat" is the existing term Starting Position.
- Parallel Phase is Parallel Span, because "phase" is a rulebook word in many Game Titles. Phase Order is Merge Order.
- Join is Merge, because joining already means a User taking a Player position (Joined Player). Barrier Join and Ordered Join are Barrier Merge and Ordered Merge, and the Join queue is the Completion Queue.
