## User Interaction Patterns

This document defines shared patterns for multi-step local selection and the contextual `Undo` control.

## Staged Selection Model

Build every action that takes more than one client-side step from staged selection: UI-only progress held locally until the action is committed.

Each local selection step must be one of:

- `manual`: explicitly selected by the user
- `auto`: transient system selection (for example, only one valid option)

Committed actions are not local staged selections and must stay in game action history.

## Undo

A Game UI offers exactly one reversal control: the `Undo` button at the right end of the turn header (see [game UI layout](game-ui-layout.md)). It is contextual:

1. When a manual staged selection exists, Undo pops the highest manual stage and every stage after it. No game action is undone.
2. Otherwise Undo undoes the Undo Candidate (`undoableAction`) through `GameSession.undoCommittedAction()`.

Auto selections never absorb a press: when only auto selections remain, Undo goes straight to action undo.

A press records at most one Action. A UI never submits a chain of Actions for one choice: a step that follows from the player's choice with nothing left to decide is a System Action the game logic takes in that Action's cascade, so one Undo reverses the whole choice.

Pressing Undo repeatedly therefore walks back through the staged selection one manual step at a time, then through committed actions. Players reverse every step through this one control, so no panel renders a `Back` or step-cancel button of its own. A toggle is a selection, not a reversal control: choosing a selected piece or target again may deselect it.

A free-form draft is the exception to one step per press: a decision the player shapes by trying things, such as drawing train routes, is a single manual stage that each press replaces, so one Undo drops the whole draft rather than replaying every adjustment. Its panel may offer a reset to the suggested starting point, such as Auto returning to the best run found, which drops the stage the same way; it chooses where to start, not which step to cancel.

The base `GameSession` implements this contract for every staged selection registered with it, so a title registers its selections and does not override `undo()`:

```ts
constructor(options: SessionOptions) {
    super(options)
    this.localSelections.register(
        undoableStagedSelection(
            PlanStageOrder,
            () => this.planSelection,
            (selection) => (this.planSelection = selection)
        )
    )
}
```

`undo()` pops the first registered selection that has a manual stage, and only when none has does it call `undoCommittedAction()` to undo the Undo Candidate. Selections are tried in the order they were registered; register one with `'first'` to put it ahead of the rest. Popping a selection is local, so it does not wait for a pending submission or animation; only History View blocks it. A title with work to do before an action is undone, such as closing a menu, overrides `undoCommittedAction()`.

Show the button whenever a press would do something: `hasLocalSelection` (a registered selection has a manual stage) or `undoableAction` is set.

### Lifetime

The session clears every registered selection when it publishes a new Game State, before `beforeNewState` runs. A title whose selections outlive some transitions overrides `keepsLocalSelections(transition)`, which returns `false` by default. A simultaneous-play title keeps a player's draft when another player's Action arrives or the state is reconciled:

```ts
protected override keepsLocalSelections(transition: PresentedTransition): boolean {
    return transition.kind === 'other-action' || transition.kind === 'reconciliation'
}
```

A selection that belongs to one decision, such as one round's plan, also stores the key of that decision and reads as empty under any other key, so a kept selection can never be submitted elsewhere.

## Shared API (`frontend-components`)

The shared helpers live in `libs/frontend-components/src/lib/model/stagedSelection.ts` and are exported from `@tabletop/frontend-components`. Use them instead of ad hoc draft flags. `setStagedSelectionValue` clears every later stage; `popHighestManualStagedSelection` backs Undo. Stage/order mismatches throw (fail fast) rather than silently no-op. `undoableStagedSelection` wraps a selection as the `LocalSelection` the session's `localSelections` registers.

### Stacked stages

Some decisions are not a fixed sequence of steps: a player marks any of several targets, in any order, as often as they like, and Undo takes back the latest press. Hold such a decision in a stacked stage. `pushStagedSelectionValue` sets a stage as one manual press, clearing every later stage as setting does, and remembers the value it replaced: popping the stage restores that value instead of clearing the stage. Pushing a list with one more entry each press therefore lets Undo take back one entry at a time, and clears the stage with the first. Setting the stage with `setStagedSelectionValue` replaces it with no history, so one Undo then clears it.

What the entries add up to is the title's rule, not the helper's: the title folds the list into its Action, for example counting presses on a target or keeping the latest entry for each target. A later stage holds a follow-up to the next entry. In `games/dicke-kartoffeln-ui` the stage order is `edits`, then `seedField`: choosing a field to sow opens a picker beside it (`seedField`), so Undo closes the picker first, and choosing a seed pushes onto `edits`, which clears `seedField` and closes the picker.

A stage the player cannot see would make Undo look dead, so a title closes such a stage when its element leaves the screen. Dicke Kartoffeln closes the seed picker when the farmer looks away from their own farm. A kept selection must also stay in view: Dicke Kartoffeln derives its table view from the round alone, so another farmer sealing leaves the farmer's farm and open picker where they are.

## Integration Pattern

Game UIs should wrap the generic helpers in a domain-specific module, as `games/marracash-ui/src/lib/model/stagedSelection.ts` and `games/dicke-kartoffeln-ui/src/lib/model/draft.ts` do. Marracash and most older titles predate the registry and still override `undo()`; register instead, as Dicke Kartoffeln does, when touching them.

Goals:

- single source of truth for stage order
- clear domain-level method names
- no repeated stage literals in session code

Suggested shape:

1. Define `ValueByStage` map type.
2. Define `STAGE_ORDER` tuple from those keys.
3. Add a compile-time coverage assertion so keys cannot drift from stage order.
4. Expose domain helpers like `setXSelection` and `setYSelection`.
5. Register the selection with the session's `localSelections`, which supplies Undo and `hasLocalSelection`.

## Effect Safety

Auto-selection effects must be:

- stage-gated (run only in the owning stage)
- cardinality-gated (run only when valid choices are exactly one)
- idempotent (repeat runs produce the same state)

Do not use effect suppression flags to force undo behavior. Use source-tagged staged selection (`manual` vs `auto`) and deterministic selection state checks.

## Minimum Test Coverage

For each staged selection flow:

1. setting a stage clears downstream stages
2. Undo with a manual selection pops the highest manual stage and undoes no action
3. Undo with only auto selection proceeds to action undo
4. invalid stage/order mismatch throws
5. domain wrapper behavior for reselecting earlier stages

For each stacked stage, also:

6. Undo pops the latest press and keeps the earlier ones
7. pushing clears every later stage, and Undo pops an open later stage before any press
8. the selection is kept or cleared on each transition kind as the title's `keepsLocalSelections` says
