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
