# Title-owned state and machine states

A title can define its own Game State on top of the family's. `extendEighteenXXState(fields,
machineStates)` returns a closed schema holding the family fields, the title's fields and
the title's machine states. `EighteenXXTitleRules` then accepts:

- `state`: that schema, and a `hydrate` function returning the title's subclass of
  `HydratedEighteenXXState`, which passes its own validator to the family constructor;
- `titleStateHandlers`: handlers for the machine states the title added;
- `decisionHandlers`: per family machine state, a function that receives the family's
  decision handler and returns the one to use. It is applied inside the family's
  cross-cutting handlers (game ending, company decisions, private exchange, automatic
  completion), so those keep applying. It replaces `stockRoundHandler`; TOP uses it to
  make the stock round accept `SplitCompany`.

A title that supplies none of these gets exactly the family state and handlers.

## Evidence surveyed

`title-actions-design.md` and the traits it lists; `reorganization-operations` and
`round-sequence` in `data/title-traits.json`; the engine study's §9 on titles that lack
a mechanism, and the domain study's "Reorganizing businesses".

Merger or acquisition rounds appear in 21 titles and exchange or formation rounds in
18; mergers in 41, acquisitions in 44, conversions in 30, nationalization in 19. The
domain study requires pending proposals, choices and consideration to be explicit
state. 1817's merger and acquisition rounds, 1856's CGR formation and the 1867 and
1822 minor mergers each need pending multi-actor state and machine states of their
own. Titles without such a mechanism should not have to model it.

Before this change the family state was one closed schema and class. TOP's persistent
facts were therefore promoted into it (`tranches`, `ownershipLimitExemptions`,
`stockRound.companyPurchases`, `Company.role`, certificate `number`), 1889 writes
`tranches: []`, and TOP rebuilt the family stock round handler to wrap it.

## Shared behaviour and title-owned choices

The family owns the base fields, their cross-domain invariants, the family machine
states and their handler chains. A title owns any further fields and machine states,
how those are decided, and which family decisions it wraps. Family field names, family
machine-state names and family handlers cannot be redefined; `extendEighteenXXState`
and `createEighteenXXRuntime` refuse.

The family's static `EighteenXXState` type now gives `machineState` as `string`, since
a title's states are not known to the family. `EighteenXXMachineState` names the family's
literals. The serialized family schema still lists them exactly.

## Compatibility

One Hosted Game of TOP exists, and Hosted Games follow the current Publication.
Operational Compatibility requires the current Logic Artifact to load its latest
canonical State; Loaded Client Compatibility requires an already-loaded older client
to accept what a newer server writes. Both titles' schemas are closed, so every change
to a deployed title's State shape is visible to old clients.

This change moves no field and adds no machine state. It is held by:

- `games/*/src/runtimeContract.spec.ts`: each title's canonical State schema, Action
  schema digests and handled machine states match a checked-in snapshot;
- `games/the-old-prince/src/deployedGame.spec.ts`: the deployed game's latest State
  loads unchanged, its active player is offered the same Actions, and each of its 181
  recorded States is reproduced from its recorded Action. Four auction resolutions
  predate automatic lot offers and differ only in identifiers drawn;
- `apps/18xx-playground/src/demo/titleState.spec.ts`: a title with its own field,
  machine state and wrapped decision, and the refusals above.

Publish TOP's Logic Artifact and republish its UI Artifact, which embeds the Game
Runtime (ADR 0004).

## Intentional limits

- No title uses the capability yet. `tranches`, the auction fields, the ownership
  exemptions and `companyPurchases` remain family fields until a later slice makes
  them opt-in; for TOP they must keep their names, positions and required-ness.
- `Company.role` and certificate `number` stay in the shared entity schemas. They are
  TOP's; moving them would change the deployed game's State shape.
- The first change that adds a field or machine state to a deployed title must keep
  the field optional for stored games and move the title to `1.0.0`: the version check
  compares only the first number, and both titles are at `0.x`.
- The shared session is `GameSession<EighteenXXState, HydratedEighteenXXState>`, so the
  shared UI reads history State already typed and never re-validates it against the
  family schema; a title's own fields pass through. The host harness is still typed over
  base `GameState`, so a title's dev page and the playground host cast the definition at
  that boundary, as the other games do. `financialState` is now an alias of `gameState`.
- A title's added handlers receive none of the family's cross-cutting handlers. Which
  of them a dedicated round needs is left to the first title with such a round.
- `hydrate` receives the family-typed State; a title reads its own fields from its
  subclass. The class is not generic over the title's schema.
- The initializer still takes the title's opening through `createFinances`; a title's
  initial fields travel the same way until the opening contract is typed.
