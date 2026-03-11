# Shared Code and Types Policy

1. Before editing, run a duplication sweep in touched files (`rg`) and note candidate shared helpers/types.
2. Reuse existing helpers from `@tabletop/*` packages or local shared modules; do not add a local helper if an equivalent exists.
3. When duplicate logic appears in touched scope, extract/refactor to a shared module and update all call sites in the same change.
4. Reuse existing shared types from `@tabletop/*` packages or local shared modules; do not redefine equivalent structural types.
5. Prefer canonical shared types over inline structural aliases (example: use `Point` from `@tabletop/common` rather than `{ x: number; y: number }`).
6. Never use TypeScript type-assertion casts (for example `as SomeType`). `as const` is allowed for literal narrowing. If there is no safe way forward without a type-assertion cast, stop and ask for permission first.
7. Keep each layer focused: UI components should render and coordinate UI state, not own unrelated domain computation.
8. Keep derived/view-model types minimal: include only fields consumed by that specific render path.
9. If different render paths need different fields, split into separate derived shapes instead of one overloaded model.
10. Avoid speculative fallback logic: add fallback behavior only when explicitly required by product behavior.
11. Treat typed local configuration as trusted input; do not add repetitive runtime guards unless data is truly untrusted.
12. Apply normalization (rounding/snapping/clamping) at write/mutation boundaries, not repeatedly during read paths.
13. When branches share most logic, compute shared fields once and branch only for true differences.
14. Move reusable non-UI logic into utilities/modules; avoid embedding reusable algorithms in component files.
15. Before finalizing, run a complexity check: if a file mixes data assembly, domain logic, and rendering heavily, split/refactor.
16. Do not remove or relax guards just to unblock behavior. When a guard blocks expected behavior, first verify whether the guard condition, input assumptions, or upstream state derivation is incorrect; only change/remove the guard after identifying and fixing the root cause.
17. Centralize UI action initiation in the game session object. Components should call session methods (for example `session.placeCity(...)`) instead of constructing/applying actions directly via `createPlayerAction` + `applyAction`.
18. In files that define a class, if a helper is only used by that class, implement it as a private class method instead of a top-level function. Use top-level helpers only when shared across classes/functions.
19. For invariant conditions that are expected to always hold (for example required IDs passed from trusted game flow), use `assert`/`assertExists` with clear messages instead of silently returning fallback values like `false`.
20. In staged/multi-step UI flows, model UI progress as one of: `manual local selection`, `auto-selected transient selection`, or `committed game action`.
21. `Back` is only for manual local selection steps. It must never consume a committed game action.
22. `Undo` must undo committed game actions. It may clear manual local selection first, but must skip auto-selected transient steps (for example, auto-picked single options) and proceed to action-history undo.
23. Auto-selected transient state must be source-tracked (`auto` vs `manual`) so Undo/Back can behave deterministically.
24. Do not rely on reactive/effect suppression hacks to control Undo/Back behavior. Effects may trigger on load/replay and create non-deterministic loops.
25. Keep auto-selection idempotent and stage-gated: run only when in the exact stage that owns the choice, and only when choice cardinality is exactly one.
26. Every new game UI must include a filled-out `ui-interaction-visual-contract.md` before or alongside the first complex interactive visual behavior (board dimming, highlighting, overlays, hover previews, selection chrome, or piece emphasis). Start from `docs/ui-interaction-visual-contract.md`.
27. When a change introduces a new interactive visual mode or coupling, update that game's `ui-interaction-visual-contract.md` in the same change.
28. For bug fixes, default to root-cause correction, not symptom suppression. Do not add guards, narrowing, fallback behavior, or render-path overrides unless you can identify the causal chain that produces the bad behavior.
29. Before applying a bug fix, be able to state all of the following: the exact symptom, the upstream cause, the invariant being violated, and why the proposed change fixes that cause rather than only hiding it.
30. If the causal chain is not yet known, say so explicitly and continue tracing. Do not describe a state as “shouldn’t happen” and then patch around it as though that were an explanation.
31. Containment fixes are allowed only when explicitly framed as containment. In that case, label them as such, explain the unresolved root cause, and do not present the fix as complete.
32. For transient UI state in `GameSession`-driven UIs, verify the actual visible-state lifecycle before choosing an invalidation strategy. Current shared flow is: underlying context state updates -> exposed `currentVisibleGameState` derivation sets `updatingVisibleState = true` -> animations run -> `beforeNewState()`/game-specific `resetAction()` run -> exposed `gameState` is assigned -> `updatingVisibleState = false`.
33. Do not assume `gameState` change is always the correct lifetime boundary for temporary UI state. If a transient selection/hover must disappear before the exposed `gameState` publish, invalidate from `updatingVisibleState` and/or `resetAction()` instead.
34. Prefer writable deriveds over `$effect` for temporary UI state when the state has a clear invalid base value under the current lifecycle boundary. Typical pattern: derive `null` while `updatingVisibleState`, while the owning interaction mode is inactive, or when the selected id is no longer valid in current state; allow local UI code to assign the writable derived between those boundaries.
35. Use `$effect` for transient UI state only when coordinating with an external side effect or imperative API that cannot be expressed as derivation. Do not use `$effect` merely to notice state changes and clear local UI state after the fact.
36. When a temporary interaction state is shared across layers, keep it in the session/model layer and document it in the game's `ui-interaction-visual-contract.md`. Do not silently narrow a documented shared-state contract into one component without updating the contract.
37. Treat lifetime boundary and validity boundary as separate decisions. Lifetime answers “when should this temporary UI state disappear” (`updatingVisibleState`, `resetAction()`, `Back`, `Undo`). Validity answers “if it still exists, is it still allowed under current state.” Prefer deriving validity from current state and keeping lifetime ownership explicit.
