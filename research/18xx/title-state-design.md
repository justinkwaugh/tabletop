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

A title without additional state uses `FamilyStateDefinition` and gets the family handlers.

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
- `games/shikoku-1889/src/titleState.spec.ts`: a title with its own field,
  machine state and wrapped decision, and the refusals above.

On 2026-09-21 the pre-change runtime (`ebcd2f60`, built in a separate worktree) and the
changed runtime were run side by side on the deployed game: for all 181 recorded
transitions both produced identical States, and the pre-change runtime validated and
round-tripped every State the changed one wrote. Continuing play from the latest State
(`FinishTrack` for PEIR, cascading to `FinishStations`) gave identical results and the
same next Actions in both. This stands in for an already-loaded client's optimistic
execution against the new server.

The same combination was then run through the local hosted site: a three-account Hosted
Game created by the changed Logic Artifact and played from the pre-change UI Artifact,
which embeds the pre-change runtime. Nine Actions across the three clients were accepted,
each `checkSync` agreed, and turns passed between browsers without page errors. All three
clients were then reloaded onto the changed UI Artifact and played six more Actions in
the same game. Restarting the local development servers reloads an open tab, so the
mixed pair was served deliberately rather than by leaving a tab open across the swap.

Publish TOP's Logic Artifact and republish its UI Artifact, which embeds the Game
Runtime (ADR 0004).

## Intentional limits

- 1817 uses title-owned merger/acquisition records and machine states; 1830 owns its
  optional IPO purchase flag. `tranches`, the auction fields, the ownership exemptions
  and `companyPurchases` remain family fields; moving them must preserve deployed
  names, positions and required-ness.
- `Company.role` and certificate `number` stay in the shared entity schemas. They are
  TOP's; moving them would change the deployed game's State shape.
- The first change that adds a field or machine state to a deployed title must keep
  the field optional for stored games and move the title to `1.0.0`: the version check
  compares only the first number, and both titles are at `0.x`.
- A title's added handlers receive none of the family's cross-cutting handlers. Which
  of them a dedicated round needs is left to the first title with such a round.
- A title's initial fields and first machine state come from its `createOpening`
  (`titleState` and `begin`); see [opening contract](opening-contract-design.md).

## Preserving title types (2026-10-03)

The original extension schema retained title fields at runtime but composition erased
its static type. 1817 consequently read its own records through `object`, membership
checks and repeated subrecord validation, and wrote them through `Object.assign`.
The extension must preserve both the schema-derived raw State and its hydrated class.

`HydratedEighteenXXState`, the state definition, opening, title rules, initializer,
runtime, scenarios and session now carry that schema and class through composition.
`extendEighteenXXState` retains the union of family and title machine-state literals.
A required title field must be supplied in the opening and prepared scenario fixtures.
Hydration accepts untrusted input and validates against the title schema; downstream
rules use typed properties. The family constructor still enforces shared invariants.
1817's full-state procedures and handlers use its concrete State; 1830's option and
1817's optional records use typed property access. Focused mechanism rule interfaces
remain focused: a title policy adds only the title fields that policy consumes.

The catalog evidence above also governs this change. Titles with no extra state use
the family definition; 1830 demonstrates optional configuration; 1817 demonstrates
persistent records and extra decision rounds. The required-field regression fixture
challenges the assumption that every future extension is optional. No merger,
nationalization, conversion or round policy is promoted into the family by this work.

Title UI runtime, session and presentation definitions retain the concrete State,
including history and dehydration. Shared rendering consumes `EighteenXXSessionView`;
shared client controls consume `GameSessionView`. These expose the controls' existing
operations and history navigation without requiring the renderer, runtime or context
replacement machinery. Those implementation slots made the whole session invariant
in its State type and forced title callers to widen their types. They remain owned
by the concrete session. The playground registers a scenario host with each matching
UI and scenario initializer while their concrete types are known, instead of putting
incompatible UI runtimes in a family-typed registry. `GameUI` and the scenario host
carry those types through rendering. The context stores the same session object and uses the same
visible-state, selection, history, Undo and exploration lifecycle.

This is a source-level contract change. There is no new bridge message, host dependency,
serialized field, action or schema version. Old UI Artifacts and new Logic Artifacts
retain their existing wire contract. TOP, 1889, 1830 and 1817 UI Artifacts must be rebuilt
to include the changed family session/client code; publishing the Site Frontend alone
cannot update embedded clients. Other games need no coordinated publication for this
type-only client interface change.

Verification includes all four canonical schema/action snapshots, existing title and
family behavior suites, client session/history tests, and a required-field title fixture
that type-checks handlers, opening, initialization, hydration and dehydration while
rejecting missing/malformed serialized fields. Title UI checks cover concrete sessions
being accepted by shared controls without casts.

Validation for this revision: 1,223 targeted tests and 11 full-game replay checks pass;
Common's suite also passes. All four Logic builds, the four title UI checks, the shared
18xx UI check, the shared client check, and the required-field type fixture pass.
The unchanged canonical schema/action snapshots are included in the title suites.
Broader checks retain existing failures in the playground's `HistoryLoading.fixture.svelte`
(missing `onReturn`), the site's `startupBackground.spec.ts` (nullable canvas context),
and the shared UI's `mapDrawing.ts` lint (unused `TileLayout` import).
