# Operating steps

The order of a company's operating turn is declared once, in
`libs/18xx/src/operating/operatingSteps.ts`: `OperatingStepStates` lists the five step
machine states, `stateAfterOperatingStep(step, steps)` gives a step's successor and
returns between companies after the last, and `isOperatingStep` says whether a machine
state is a step. The runtime tells every step handler its successor from that list, and
tells the turn start which step is first. Each step creates its own step state when it is
entered; the turn start no longer creates the track step's.

Before this, three modules each copied the list (company decisions, private exchange,
transfer timing), three handlers named their successor themselves (the turn start,
earnings distribution, train buying), and `StartOperatingTurn` created `trackStep`, which
made "track is first" an assumption of the turn start rather than of the list.

## Evidence surveyed

The operating step lists the research engine built for 129 of 131 profiles
(`data/engine-round-samples.json`; game-start lists, default options), the base list in
`source/lib/engine/game/base.rb`, and `operating-steps-exhausted`, `minors-first`,
`train-limit-cleanup`, `pending-token` and `another-actor-response` in
`data/title-traits.json`.

- **The core holds.** 118 of 129 keep track, token, route, dividend, buy train in that
  order; no title places a separate token step before track, and none pays dividends
  after buying trains. Only 33 have nothing else ordered; 85 add ordered steps around the
  core; 11 alter it.
- **Added steps and where they sit.** Issue or redeem shares after trains (25: the 1822
  family, 1849, 1858) or before track (11: 1867, 1861, 18Ardennes); loan operations
  between dividend and trains (1867, 1861) or between route and dividend (1848);
  acquisition before track and after trains (the 1822 family, 1862); conversion before
  track (1866, 18FL) or at the end (1873, 1841); destination tokens between track and
  token (11); a blocking private purchase at the end of the turn (63).
- **Altered cores.** Track and token as one free-order step (9: 1846, 1825, 18GB); trains
  before running (18SJ, 18USA's pullman); a repeated run (1870's connection run,
  18Uruguay); no train step at all in 1840's line rounds.
- **One list per title.** A company type that skips a step is handled inside the step
  (35 titles guard on company type there; 1861 nationals, 1867 minors). No researched
  title changes its list by phase or option; System18 chooses by map.
- **Interrupts and windows** are not ordered steps: discarding to the train limit (118),
  a pending home or other token (63), emergency money (16); and non-blocking company
  decisions that stay open until a later step, such as a private's tile lay (94), buying
  a private (72) and exchange (37), which is how the family's company-decision and
  exchange handlers already wrap every step. 1846's share issuing and 1817's loans are
  such windows, not steps.
- **Turn end.** When the steps are done the next company follows operating order (127
  profiles); the unoperated remainder is re-sorted after share sales in 20.

## Shared behaviour and title-owned choices

Shared: the five core steps, their order, the successor lookup, the rule that a step owns
its step state, and what surrounds every step — game ending, company decisions, private
exchange, phase advance, discards, rusting, funding, and the turn end.

Title-owned today: nothing about the sequence; 1889 and TOP both use the core alone.

## Support now and later

Now: one family list, every successor derived from it. `stateAfterOperatingStep` and
`isOperatingStep` already take a list, so a longer list needs no change to them.

Letting a title supply the list is the next step and is deliberately not built, because
no title needs it yet and it is more than a parameter:

- `validateCompanyDecisions` runs while a State is hydrated, without rules, and uses the
  family list; a title's list has to reach hydration.
- A title's step handler needs the family's step wrappers (game ending, company
  decisions, private exchange); `titleStateHandlers` are not wrapped.
- `FinishOperatingTurn` clears the five steps' state; a title step's state needs clearing
  too, and `validatePhaseChange` finds the operating company through the five.
- `@tabletop/18xx-ui` draws five fixed steps in `OperatingSteps.svelte`.
- Three State invariants name the step after their own: track's state persists into
  station placement, the route's into earnings, earnings' into train buying.

Intentional limits beyond that: a step appearing twice (1870, 1844); track and token as
one free-order step; a window that closes at a named later step; operating rounds that
suspend (1880) or interleave stock turns (1866).

## Compatibility

Nothing serialized changes. The State after `StartOperatingTurn` is identical, since the
track step is entered within the same action; the deployed game's nine recorded turn
starts reproduce. Runtime-contract snapshots are unchanged. Logic Artifacts only.

## Examples that verify the decision

The successor of each core step, and of the last; a longer list a title might declare;
a machine state that is not a step is refused; the deployed game's recorded transitions
and both titles' complete-game tests.
