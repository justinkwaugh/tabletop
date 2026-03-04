## User Interaction Patterns

This document defines shared patterns for local UI selection flows, especially multi-step actions with `Back` and `Undo`.

## Staged Selection Model

Use staged local selection for UI-only progress before committing a game action.

Each local selection step must be one of:

- `manual`: explicitly selected by the user
- `auto`: transient system selection (for example, only one valid option)

Committed actions are not local staged selections and must stay in game action history.

## Back vs Undo Contract

- `Back`: only unwinds local manual selections.
- `Undo`: undoes committed game actions. It may clear manual local selection first, but it must not consume auto-only transient selection.

Practical rule:

- If only auto staged selection exists and there is no manual staged selection, `Undo` should proceed to action-history undo.

## Shared API (`frontend-components`)

Shared helpers are in `libs/frontend-components/src/lib/model/stagedSelection.ts`.

- `StagedSelectionState<TValueByStage>`
- `setStagedSelectionValue(...)`
- `clearStagedSelectionAtOrAfter(...)`
- `getStagedSelectionEntry(...)`
- `getStagedSelectionValue(...)`
- `getHighestManualStagedSelectionStage(...)`
- `hasManualStagedSelection(...)`
- `popHighestManualStagedSelection(...)`

Safety behavior:

- Stage/order mismatches throw (fail fast), rather than silently no-op.

## Integration Pattern

Game UIs should wrap the generic helpers in a domain-specific module.

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
2. pop/highest-manual behavior
3. auto-only selection is not treated as manual mid-action
4. invalid stage/order mismatch throws
5. domain wrapper behavior for reselecting earlier stages
