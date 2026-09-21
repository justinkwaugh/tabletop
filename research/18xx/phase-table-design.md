# Phase table

A title declares its phases once, as data, in a `PhaseTable`: an ordered list of phases,
each with an id, the train definitions whose first purchase starts it, its tile colours,
its operating-round count and its train limit. Train definitions gain an optional
`rustsOn`: the train definition whose purchase retires them. The table answers
`phase(id)`, `isAtLeast(current, id)`, `phaseAfterPurchase(current, trainDefinitionId)`
and `rustTiming(current, train)`.

The rule callbacks the family already calls stay as the seam:
`TrainRules.trainLimit` / `phaseAfterPurchase`, `TrackRules.availableColors`,
`OperatingRules.roundCount`, `PhaseRules.rustTiming`, `RouteRules.revenueStage`. They
receive the State and the company, which the known exceptions need. Titles implement them
as lookups in their table and keep only what is genuinely a rule. `EighteenXXTitleRules`
carries the table so the runtime can refuse a State whose `phaseId` names no phase, and
so the phase chart in `@tabletop/18xx-ui` reads the same table the rules use.

## Evidence surveyed

`technology-triggers`, `automatic-export`, `train-limits`, `special-train-exclusions`,
`train-retirement`, `event-application` and `round-sequence` in `data/title-traits.json`
(131 profiles); the 130 constructed samples in `data/engine-setup-samples.json` (814
phases; default options only, so variants are under-sampled; 18Zoo did not construct);
the engine and domain studies.

- **Start.** A train purchase starts a phase in 125 of 131 profiles. In 22 titles a
  phase lists several trains (1822, 1858, 18CO), and there one purchase can pass several
  phases: in 1822 phase 2 is started by a 2 or a 3 and phase 3 by a 3. Two titles start
  a phase on the Nth copy of a train (18India, 18 Royal Gorge). Export starts phases with
  no buyer in 37 profiles (18Chesapeake at the end of an OR set, the 1817 family after
  each OR). Four profiles advance on a schedule (1840, 1873, 18Mag, 18MS).
- **Identity.** A phase id equals its starting train's name in only 72 of 130 titles
  (1846 I–IV, 1835 `2.1`/`2.2`, 18CO `5b` on train `4D`). Every sampled list is one
  linear sequence; 12 titles build it from options or map (1832, 1870, 18USA, 1825).
- **Contents.** Tile colours and a train limit are on all 814 phases; an operating-round
  count on 749 (not 1880, 18CZ, 18Zoo, Steam over Holland). Each phase's colours contain
  the previous phase's in every sample. 46 titles give the train limit by company kind or
  share size; 6 compute it in code; 16 profiles exclude some trains from the count.
  Status strings are on 487 phases, 123 distinct, most used by one title.
- **Retirement.** Rust is declared on the train, never on the phase, in 121 of 130
  titles, and is triggered by a train purchase: in 11 titles a rust trigger starts no
  phase (1824, 1835, 18CZ, 2038). Five titles list several triggers; 15 give a train
  variant its own; 28 have obsolete trains that survive until they next run. Delayed or
  conditional rust is code in every title that has it, TOP's never-run 4+ included.
- **Events** attach to trains, not phases, in 115 of 130 titles, 9 of them on the Nth
  copy. Private abilities keyed by phase are a separate channel in 32 titles.
- **Operating rounds** are read from the phase when the stock round ends in 98 profiles,
  TOP among them, which is what `StartOperatingSet` does. 45 titles use one constant.

Before this change both titles kept an ordered id list and four `Record<phaseId, …>`
tables across four files, `phaseAfterPurchase` was identical in both and relied on a
phase id being a train id, rust was a train-to-phase-id map, the two titles held 15
`indexOf(phaseId)` comparisons, and each title UI imported six exports to rebuild the
table for `createPhaseChart`.

## Shared behaviour and title-owned choices

Shared: what a phase is; that phases are ordered; that a train purchase moves the game to
the latest phase, at or after the current one, which that train starts, so a purchase can
pass phases and a train that starts none changes nothing; that a train with `rustsOn`
rusts once the phase that train starts has been reached; comparisons between phases.

Title-owned: the table and the train definitions; anything that depends on the company or
on history. 1889 keeps diesel availability and its exchange price; TOP keeps the
never-run 4+ rusting after it next runs, PEIR's purchase limit and exemption from needing
a train. Private closure, exchange windows and price ranges stay title rules and use
`isAtLeast` in place of index arithmetic.

## Support now and later

Now: linear table fixed per title; `startedBy` as a list of train definitions; one
integer train limit per phase; one `rustsOn` per train definition; immediate rust, with
the title able to defer it.

Considered, not built, and each addable without touching the family's consumers because
the callbacks remain the seam:

- train limit by company kind or share size (46 titles), and trains excluded from the
  count;
- phase status flags; nothing in 1889 or TOP needs more than `isAtLeast`;
- several rust triggers, per-variant rust, and `obsoleteOn`;
- a table built from options, player count or map: a function returning the table.

Intentional limits, which need more than a wider table:

- A phase changes only through `BuyTrain`, with an operating company. Export, scheduled
  advancement and starting a phase on the Nth copy need another way into
  `preparePhaseChange`.
- Rust is evaluated when a phase changes, so a trigger train that starts no phase cannot
  rust anything.
- Events on trains are not modelled; private closure stays in `PrivateRules.phaseEffects`.
- The operating-round count is read when the operating set starts and is not recomputed.

## Compatibility

`phaseId` and everything else serialized is unchanged; `TrainDefinition` and the table
are static definitions outside the State. The new hydration check accepts the deployed
game's `3H`. Both titles' runtime-contract snapshots and the deployed game's 181 recorded
transitions, which include a phase advance, train purchases and tile-colour gating, must
be unchanged. Both title UI Artifacts are republished; Logic behaviour is identical.

## Examples that verify the decision

1889 and TOP: each phase's colours, rounds and limit, each train's rust, and the phase
after each purchase equal today's values; the replay and contract guards pass. Family
unit tests: a purchase that passes a phase (1822's 2-or-3 then 3); a phase id that is not
a train name (1846 I–IV); a train that starts no phase; a permanent train; `isAtLeast`
across the list; an unknown phase, an unknown `startedBy` or `rustsOn`, and a duplicate
id are refused.
