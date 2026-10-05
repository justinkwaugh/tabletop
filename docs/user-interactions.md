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
2. Otherwise Undo undoes the Undo Candidate (`undoableAction`) through `GameSession.undo()`.

Auto selections never absorb a press: when only auto selections remain, Undo goes straight to action undo.

Pressing Undo repeatedly therefore walks back through the staged selection one manual step at a time, then through committed actions. Players reverse every step through this one control, so no panel renders a `Back` or step-cancel button of its own.

Implement this in the session's `undo()` override so every caller gets the contextual behavior:

```ts
override async undo() {
    if (this.hasManualSelection) {
        this.selection = popHighestManualSelection(this.selection)
        return
    }
    await super.undo()
}
```

Show the button whenever a press would do something: a manual staged selection exists or `undoableAction` is set.

## Shared API (`frontend-components`)

The shared helpers live in `libs/frontend-components/src/lib/model/stagedSelection.ts` and are exported from `@tabletop/frontend-components`. Use them instead of ad hoc draft flags. `setStagedSelectionValue` clears every later stage; `popHighestManualStagedSelection` backs Undo. Stage/order mismatches throw (fail fast) rather than silently no-op.

## Integration Pattern

Game UIs should wrap the generic helpers in a domain-specific module, as `games/marracash-ui/src/lib/model/stagedSelection.ts` does.

Goals:

- single source of truth for stage order
- clear domain-level method names
- no repeated stage literals in session code

Suggested shape:

1. Define `ValueByStage` map type.
2. Define `STAGE_ORDER` tuple from those keys.
3. Add a compile-time coverage assertion so keys cannot drift from stage order.
4. Expose domain helpers like `setXSelection`, `setYSelection`, `hasManualSelection`, `popHighestManualSelection`.

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
