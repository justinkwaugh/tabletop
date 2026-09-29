# Out-of-turn private powers

Tracking issue: none yet.
Architecture decisions: [ADR 0009, Sequenced Out-of-Turn Actions](../../docs/adr/0009-sequenced-out-of-turn-actions.md), building on [ADR 0007](../../docs/adr/0007-out-of-turn-actions.md) and [ADR 0008](../../docs/adr/0008-supersedable-actions.md).

## Evidence and variation

Surveyed in `research/18xx-2026-09-08`: the power and decision trait assignments
(`website/public/downloads/trait-routes-powers-complete-assignments.md` and
`trait-decisions-complete-assignments.md`), the pinned reference source's ability
timing vocabulary and checks (`source/lib/engine/ability/README.md`,
`source/lib/engine/game/base.rb`), and every title's entity definitions under
`source/lib/engine/game/`. The trait notes truncate their rosters, so timing counts
come from each ability's declared timing in those entity definitions, per
implementation directory; child titles inheriting a parent's entities are not
recounted, and abilities declared in step files fall outside the counts. The counts
describe that snapshot, not universal rules. Also read this repository's
negotiated-transfers, private-lifecycle, standing-instructions, and 1889 evidence
notes.

Most powers belong to their owner's own turn: owning-corporation operation (48
directories), track step (41), owning player's track (14), owning player's stock
turn (13), and owning player's operating turn (11). Timings outside the owner's turn
are rare: unrestricted (11), any stock turn (3: 1832, 1844, 1889), between operating
turns (2: 1889 Mitsubishi Ferry, 1862 USA-Canada Toronto Steamship), and operating
round start (2: 1846, 18Uruguay). Triggered timings are common and are not
player-initiated: on sale (17), on train purchase (21), on par (5), and on operation,
run, auction end, or dividend (1–3 each).

Exchanges divide by timing. Any-time exchanges are 1830 Mohawk & Hudson, 1850Jr FSM,
18NL De Veluwe, 1889 Dôgo, and 1824. The first three's rule text allows the owner's
stock turn "or between the turns of other players or corporations in either stock or
operating rounds", so not during another operation; the reference engine's
unrestricted check is looser than that text, and 1824's exists for a forced
operating-round exchange. Own-stock-turn exchanges are 1847AE, the 1858 family,
1868WY P11, 1888, 1893, and 18NEB. TOP's exchanges are own-turn and record a stock
action in addition to buying and selling, cancelling the owner's pass. Exchanges with
no declared timing (1822, 1828, 1832, 18OE, 2038, among others) depend on each
title's step composition and were not traced: an evidence gap.

Off-turn construction powers are 1844's Mountain Railways and Mitsubishi in stock
rounds, and Mitsubishi and Toronto Steamship between operating turns. The reference
engine checks between-turns use as "before the next operator acts", not a gap between
companies; this design follows the rule text. Counterexamples: 18FL's Terminal
Company and Peninsular & Occidental tokens are player-owned, unrestricted, and act for
"the operating corporation", which may mean during another player's operation
(unverified against the rulebook). 1868WY P6c is also unrestricted, as is 1848's
Tasmania tile, declared in a step file. Delaware & Hudson and 1846's tile privates
serve only their owning corporation. Triggered decisions include Ehime's seller lay on
sale, 1828 Erie & Kalamazoo, 1822Africa P10, 1846 Steamboat's once-per-round
reassignment at round start, and 23 titles' responses by another actor. Thirty-two
titles have multi-action powers. No power-timing evidence involves hidden information
or simultaneous choice.

1889's own decisions stand. Dôgo may be exchanged during another player's turn and
during another company's operation; the exchange keeps the current company, turn,
and pass history, and a presidency change hands the remaining decisions to the new
president. Mitsubishi may be placed during stock rounds, during its owner's company's
operation, and between companies before a rival operates. Ehime's seller lay is an
explicit interruption handed to the seller.

## Three shapes, three mechanisms

A power the owner may start whenever they are not being waited on is a Sequenced
Out-of-Turn Action. A power usable only between other companies' turns needs the game
to wait at a moment nobody is otherwise waited on, so the owner asks for that with a
Private Power Request. A power triggered by an event remains a pending company
decision assigned to one player, as Ehime's is; neither of the first two mechanisms
applies.

**Paired actions.** Out-of-turn status is fixed per Action type, so one type cannot
serve both an Active Player's ordinary use and a non-active Player's off-turn use.
An off-turn-capable private action is therefore a pair: the existing regular type,
used by an Active Player, and a sequenced out-of-turn twin, used by an eligible Player
who is not active. Keeping the regular type unchanged leaves every other title's
Actions and host requirements untouched. The twin has the same payload, evaluation,
and application; only its registration and its not-active condition differ. A handler
offers a given Player at most one of the pair, so a client submits whichever the
Player's available Actions include. The twins are `ExchangePrivateOutOfTurn` and
`LayPrivateTileOutOfTurn`. A twin never records a stock action or changes passes,
since its Player holds no turn; terms with turn effects offer only the regular type.

Titles opt in to registering twins. The shared private-action list registers the
regular types for every title, and registering a sequenced type obliges that title's
Logic Artifact to wait for host support; TOP, whose exchanges are own-turn only,
registers no twin and is unaffected.

The exchange and decisions handlers stop adding eligible owners to the Active
Players, so turn notifications, the dashboard, `isMyTurn`, and the table header name
only the Players the game waits on.

**Private Power Requests.** Only a player owning an unused, open private with a
between-turns power may make a Private Power Request. It is a standing out-of-turn,
supersedable declaration, like a Standing Instruction: cancelling supersedes it, and a
player holds at most one. Its consequence is not an Action performed for the player
but the game waiting on them: at a pause point the window's opening follows from Game
State, keeping execution deterministic as ADR 0007 requires, and a drop is a System
Action.

A pause point is the moment before the Operating Turn of a company the requester does
not control; their own companies need none, since they may act during them. The
Private Power Window no longer opens for every player with a legal use, only for
requesters with one. Several requesters before the same company are served in seat
order, each independently: continuing ends only that player's request. In the window
the requester is an Active Player, uses the regular action or continues the round,
and either ends the request.

Using the power in any way ends the owner's request as part of that use. Otherwise a
request lasts across rounds until a pause point. There, a requester without a legal
use has the request dropped by a System Action recording why: no legal use, private
closed, or owner changed, with a title-keyed escape like the Standing Instruction stop
reasons.

## 1889 policy

Dôgo: the regular exchange serves its owner as an Active Player; the twin serves a
non-active owner during the stock round and during an operating company's track,
station, route, earnings, and train-buying steps. Neither is offered between
companies, including in a Private Power Window, while a company decision is pending,
or during train funding, discards, or phase changes. No request is needed.

Mitsubishi: the regular lay serves its owner during their own stock turn, during their
company's operation, and in a window they requested; the twin serves a non-active
owner during a stock round. Neither is offered during a rival company's operation,
nor during the owner's own operation while a pending company decision makes another
player the one being waited on.

## Presentation

Each power has a small button beside the private on its owner's player card and a
persistent control in the action area. Both appear whether or not it is the owner's
turn, including while a non-active owner's action area shows the position summary.
Port placement uses the map's existing private-lay picker restricted to its
locations. The request is a toggle with Cancel; its owner alone sees it and the last
drop reason, as with "Autobuy stopped". In local hotseat, where one person plays every
seat, these controls act for the owner directly.

Every exchange and port lay, by either Action type, gives the other players a short
in-table notice naming the player and effect, such as "Alex exchanged Dôgo for an Iyo
share" or "Alex placed the port at Nakamura". A player whose Action lost a race is
told it was not applied because of the Action that arrived first; one whose race was
reconciled is told it was applied after that Action. These are table notices, not site
notifications, which remain for the players the game waits on. Notices present
arriving Processed Actions and never commit gameplay.

## Implemented now

- ADR 0009 support in the Game Runtime, host, and Game Client, as a prerequisite
  slice.
- `ExchangePrivateOutOfTurn` and `LayPrivateTileOutOfTurn`, registered by 1889 only.
- Exchange and decisions handlers no longer adding eligible owners to the Active
  Players.
- Private Power Requests, their drop System Action and reasons, and the Private Power
  Window opening only for requesters.
- The player-card buttons, persistent control, request toggle with drop reason, and
  notices.

## Deferred

Between-turns exchanges such as 1830's would use the same request and window once a
consumer exists; window eligibility would then come from a title rule over all
between-turns powers rather than track terms alone. Round-start moments (1846
Steamboat) need a request bound to that moment. Unrestricted powers acting during
another operation (18FL) are sequenced correctly under ADR 0009 but need a title
legality decision and evidence. Multi-action off-turn powers would need a pending
procedure, since a twin is one complete Action. Forced exchanges are System Actions.

## Verification examples

- Alex, not active, exchanges Dôgo during Blair's stock turn and during another
  company's train purchase, including the existing presidency-transfer case; Alex is
  never an Active Player and receives no turn notification.
- Blair buys a Kōchi share while Alex's exchange lands first: the race commutes and
  both are recorded. Blair buys the last Iyo IPO share instead: it does not, and the
  later arrival is rejected with a race notice.
- Blair cannot undo past Alex's exchange; Alex can undo it while it is the tail.
- The Mitsubishi owner places the port during another player's stock turn with the
  twin, and during their own company's operation with the regular lay; either ends a
  standing request without a drop reason.
- Without a request no window opens. With one it opens before the next rival company
  and ends on the lay or on continuing; two requesters are served in seat order. With
  all four port hexes built, the request is dropped at the pause point with its reason
  shown to the owner.
- Every exchange and port lay gives the other players a notice.
- TOP's registered Actions and behaviour are unchanged.
